interface Env {
  APP_ORIGIN: string;
  MAX_FILE_SIZE_MB: string;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REFRESH_TOKEN: string;
  GOOGLE_ROOT_FOLDER_ID: string;
  UPLOAD_SESSION_SECRET: string;
}

type AuthenticatedUser = { id: string; email?: string };
type ProjectRow = { id: string; organization_id: string; code: string; name: string };
type BuildingRow = { id: string; name: string; code: string };
type FileRow = {
  id: string;
  project_id: string;
  building_id: string | null;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string | null;
  status: string;
  category: string;
  drive_file_id?: string | null;
};

type UploadToken = {
  sessionUrl: string;
  fileId: string;
  parentId: string;
  projectId: string;
  total: number;
  mime: string;
  sha256: string;
  exp: number;
};

const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";
const CATEGORY_FOLDERS: Record<string, string> = {
  photo: "Foto's",
  document: "Documenten",
  certificate: "Certificaten",
  drawing: "Tekeningen",
  report: "Rapporten",
  evidence: "Bewijs",
  backup: "Back-ups",
  export: "Exports",
};

function cors(env: Env) {
  return {
    "access-control-allow-origin": env.APP_ORIGIN,
    "access-control-allow-headers": "authorization, content-type, content-range, x-upload-token",
    "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function json(env: Env, body: unknown, status = 200, extra: HeadersInit = {}) {
  return Response.json(body, {
    status,
    headers: {
      ...cors(env),
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
      "x-content-type-options": "nosniff",
      ...extra,
    },
  });
}

class GatewayError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function requiredEnv(env: Env) {
  const keys: Array<keyof Env> = [
    "APP_ORIGIN", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY",
    "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN",
    "GOOGLE_ROOT_FOLDER_ID", "UPLOAD_SESSION_SECRET",
  ];
  return keys.filter((key) => !env[key]?.trim());
}

function bearer(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) throw new GatewayError("Aanmelden is vereist.", 401);
  const token = authorization.slice(7).trim();
  if (!token) throw new GatewayError("Aanmelden is vereist.", 401);
  return token;
}

async function authenticate(request: Request, env: Env) {
  const token = bearer(request);
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new GatewayError("Je sessie is verlopen.", 401);
  const user = await response.json() as AuthenticatedUser;
  if (!user.id) throw new GatewayError("Je sessie is verlopen.", 401);
  return { token, user };
}

async function supabaseRows<T>(env: Env, token: string, path: string) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${token}`,
      accept: "application/json",
    },
  });
  if (!response.ok) throw new GatewayError("De centrale projectrechten konden niet worden bevestigd.", response.status === 401 ? 401 : 403);
  return response.json() as Promise<T[]>;
}

async function projectForUser(env: Env, token: string, projectId: string) {
  const rows = await supabaseRows<ProjectRow>(env, token, `projects?id=eq.${encodeURIComponent(projectId)}&select=id,organization_id,code,name&limit=1`);
  if (!rows[0]) throw new GatewayError("Je hebt geen toegang tot dit project.", 403);
  return rows[0];
}

async function buildingForUser(env: Env, token: string, projectId: string, buildingId: string) {
  const rows = await supabaseRows<BuildingRow>(env, token, `buildings?id=eq.${encodeURIComponent(buildingId)}&project_id=eq.${encodeURIComponent(projectId)}&select=id,name,code&limit=1`);
  if (!rows[0]) throw new GatewayError("Het gebouw hoort niet bij dit project.", 400);
  return rows[0];
}

async function googleAccessToken(env: Env) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new GatewayError("De private Google Drive-koppeling is niet beschikbaar.", 503);
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new GatewayError("De private Google Drive-koppeling is niet beschikbaar.", 503);
  return data.access_token;
}

function driveQuote(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

async function ensureFolder(accessToken: string, parentId: string, key: string, name: string) {
  const query = `'${driveQuote(parentId)}' in parents and mimeType='${DRIVE_FOLDER_MIME}' and trashed=false and appProperties has { key='codecoKey' and value='${driveQuote(key)}' }`;
  const list = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=1`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!list.ok) throw new GatewayError("De private Drive-map kon niet worden gecontroleerd.", 502);
  const existing = await list.json() as { files?: Array<{ id: string }> };
  if (existing.files?.[0]?.id) return existing.files[0].id;
  const create = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ name, mimeType: DRIVE_FOLDER_MIME, parents: [parentId], appProperties: { codecoKey: key } }),
  });
  if (!create.ok) throw new GatewayError("De private Drive-map kon niet worden aangemaakt.", 502);
  const folder = await create.json() as { id?: string };
  if (!folder.id) throw new GatewayError("Google Drive gaf geen map-ID terug.", 502);
  return folder.id;
}

async function targetFolder(env: Env, token: string, accessToken: string, project: ProjectRow, buildingId: string | null, category: string) {
  const projectsFolder = await ensureFolder(accessToken, env.GOOGLE_ROOT_FOLDER_ID, "system:projects", "Projecten");
  const projectFolder = await ensureFolder(accessToken, projectsFolder, `project:${project.id}`, `${project.code}-${project.id}`);
  let parent = projectFolder;
  if (buildingId) {
    const buildings = await ensureFolder(accessToken, projectFolder, `project:${project.id}:buildings`, "Gebouwen");
    const building = await buildingForUser(env, token, project.id, buildingId);
    parent = await ensureFolder(accessToken, buildings, `building:${building.id}`, `${building.code}-${building.id}`);
  } else {
    parent = await ensureFolder(accessToken, projectFolder, `project:${project.id}:wide`, "Projectbreed");
  }
  return ensureFolder(accessToken, parent, `category:${category}`, CATEGORY_FOLDERS[category] ?? "Documenten");
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

async function signUploadToken(env: Env, payload: UploadToken) {
  const encoded = base64Url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${encoded}.${base64Url(await hmac(env.UPLOAD_SESSION_SECRET, encoded))}`;
}

async function verifyUploadToken(env: Env, token: string) {
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) throw new GatewayError("Ongeldige uploadsessie.", 401);
  const expected = await hmac(env.UPLOAD_SESSION_SECRET, encoded);
  const provided = decodeBase64Url(signature);
  if (expected.length !== provided.length) throw new GatewayError("Ongeldige uploadsessie.", 401);
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected[index] ^ provided[index];
  if (mismatch !== 0) throw new GatewayError("Ongeldige uploadsessie.", 401);
  const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(encoded))) as UploadToken;
  if (payload.exp < Date.now() || !payload.sessionUrl.startsWith("https://www.googleapis.com/upload/drive/")) {
    throw new GatewayError("De uploadsessie is verlopen.", 401);
  }
  return payload;
}

async function reserveFile(env: Env, token: string, user: AuthenticatedUser, project: ProjectRow, input: { buildingId: string | null; name: string; mimeType: string; category: string }) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/files?select=id`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: JSON.stringify({
      organization_id: project.organization_id,
      project_id: project.id,
      building_id: input.buildingId,
      original_name: input.name,
      mime_type: input.mimeType,
      size_bytes: 0,
      category: input.category,
      status: "pending",
      created_by: user.id,
    }),
  });
  if (!response.ok) throw new GatewayError("Je hebt geen bestandsrecht voor dit project.", 403);
  const rows = await response.json() as Array<{ id: string }>;
  if (!rows[0]?.id) throw new GatewayError("Bestandsmetadata kon niet worden gereserveerd.", 502);
  return rows[0].id;
}

async function updateFileAsGateway(env: Env, fileId: string, update: Record<string, unknown>) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/files?id=eq.${encodeURIComponent(fileId)}`, {
    method: "PATCH",
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify(update),
  });
  if (!response.ok) throw new GatewayError("Drive-upload is voltooid maar centrale metadata kon niet worden bevestigd.", 502);
}

async function initiateUpload(request: Request, env: Env) {
  const { token, user } = await authenticate(request, env);
  const input = await request.json().catch(() => ({})) as {
    projectId?: string;
    buildingId?: string | null;
    name?: string;
    mimeType?: string;
    sizeBytes?: number;
    sha256?: string;
    category?: string;
  };
  const projectId = input.projectId?.trim() ?? "";
  const name = input.name?.trim() ?? "";
  const mimeType = input.mimeType?.trim() ?? "";
  const category = input.category?.trim() ?? "document";
  const total = Number(input.sizeBytes);
  const sha256 = input.sha256?.toLowerCase() ?? "";
  const maximum = Math.min(Number(env.MAX_FILE_SIZE_MB || "25"), 100) * 1024 * 1024;
  if (!projectId || name.length < 1 || name.length > 255 || mimeType.length < 3 || !Number.isSafeInteger(total) || total < 1 || total > maximum || !/^[a-f0-9]{64}$/.test(sha256) || !CATEGORY_FOLDERS[category]) {
    throw new GatewayError(`Controleer bestandstype, checksum en de limiet van ${Math.floor(maximum / 1024 / 1024)} MB.`);
  }
  const project = await projectForUser(env, token, projectId);
  const fileId = await reserveFile(env, token, user, project, { buildingId: input.buildingId ?? null, name, mimeType, category });
  try {
    const accessToken = await googleAccessToken(env);
    const parentId = await targetFolder(env, token, accessToken, project, input.buildingId ?? null, category);
    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,mimeType,parents", {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json; charset=UTF-8",
        "x-upload-content-type": mimeType,
        "x-upload-content-length": String(total),
      },
      body: JSON.stringify({
        name,
        mimeType,
        parents: [parentId],
        appProperties: { codecoFileId: fileId, projectId, category },
      }),
    });
    const sessionUrl = response.headers.get("location");
    if (!response.ok || !sessionUrl) throw new GatewayError("Google Drive kon geen hervatbare uploadsessie starten.", 502);
    const uploadToken = await signUploadToken(env, { sessionUrl, fileId, parentId, projectId, total, mime: mimeType, sha256, exp: Date.now() + 60 * 60 * 1000 });
    await updateFileAsGateway(env, fileId, { status: "uploading", drive_parent_id: parentId });
    return json(env, { fileId, uploadToken, chunkSize: 1024 * 1024, expiresInSeconds: 3600 }, 201);
  } catch (error) {
    await updateFileAsGateway(env, fileId, { status: "failed" }).catch(() => undefined);
    throw error;
  }
}

function parseRange(value: string, total: number) {
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(value);
  if (!match) throw new GatewayError("Content-Range ontbreekt of is ongeldig.");
  const start = Number(match[1]);
  const end = Number(match[2]);
  const declaredTotal = Number(match[3]);
  if (declaredTotal !== total || start < 0 || end < start || end >= total) throw new GatewayError("Uploadbereik valt buiten het bestand.");
  return { start, end, length: end - start + 1, final: end === total - 1 };
}

async function uploadChunk(request: Request, env: Env) {
  const { token } = await authenticate(request, env);
  const opaqueToken = request.headers.get("x-upload-token") ?? "";
  const session = await verifyUploadToken(env, opaqueToken);
  await projectForUser(env, token, session.projectId);
  const fileRows = await supabaseRows<FileRow>(env, token, `files?id=eq.${encodeURIComponent(session.fileId)}&select=id,project_id,status&limit=1`);
  if (!fileRows[0] || !["pending", "uploading"].includes(fileRows[0].status)) throw new GatewayError("Upload is niet beschikbaar voor deze gebruiker.", 403);
  const range = parseRange(request.headers.get("content-range") ?? "", session.total);
  if (!range.final && range.length % (256 * 1024) !== 0) throw new GatewayError("Uploadchunks moeten, behalve de laatste, een veelvoud van 256 KiB zijn.");
  if (Number(request.headers.get("content-length")) !== range.length) throw new GatewayError("Chunkgrootte komt niet overeen met Content-Range.");
  const response = await fetch(session.sessionUrl, {
    method: "PUT",
    headers: {
      "content-type": session.mime,
      "content-length": String(range.length),
      "content-range": `bytes ${range.start}-${range.end}/${session.total}`,
    },
    body: request.body,
  });
  if (response.status === 308) {
    return json(env, { complete: false, receivedRange: response.headers.get("range") }, 200);
  }
  if (!response.ok) {
    if (response.status === 404) await updateFileAsGateway(env, session.fileId, { status: "failed" }).catch(() => undefined);
    throw new GatewayError(response.status >= 500 ? "Drive-upload is tijdelijk onderbroken; hervat dezelfde sessie." : "Drive-upload is geweigerd.", response.status >= 500 ? 503 : 502);
  }
  const driveFile = await response.json() as { id?: string; size?: string };
  if (!driveFile.id || Number(driveFile.size) !== session.total) throw new GatewayError("Google Drive bevestigde niet de verwachte bestandsgrootte.", 502);
  await updateFileAsGateway(env, session.fileId, {
    drive_file_id: driveFile.id,
    drive_parent_id: session.parentId,
    size_bytes: session.total,
    sha256: session.sha256,
    status: "available",
  });
  return json(env, { complete: true, fileId: session.fileId }, 200);
}

async function downloadFile(request: Request, env: Env, fileId: string) {
  const { token } = await authenticate(request, env);
  const rows = await supabaseRows<FileRow>(env, token, `files?id=eq.${encodeURIComponent(fileId)}&select=id,project_id,original_name,mime_type,size_bytes,status,drive_file_id&limit=1`);
  const file = rows[0];
  if (!file || file.status !== "available" || !file.drive_file_id) throw new GatewayError("Bestand bestaat niet of je hebt geen toegang.", 404);
  const accessToken = await googleAccessToken(env);
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.drive_file_id)}?alt=media`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok || !response.body) throw new GatewayError("Het private bestand kon niet uit Drive worden gelezen.", response.status === 404 ? 404 : 502);
  const headers = new Headers(cors(env));
  headers.set("content-type", file.mime_type);
  headers.set("content-length", String(file.size_bytes));
  headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`);
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(response.body, { status: 200, headers });
}

async function quota(request: Request, env: Env) {
  const { token } = await authenticate(request, env);
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  const permission = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/can_manage_organization_members`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ p_organization_id: organizationId }),
  });
  if (!permission.ok || await permission.json() !== true) throw new GatewayError("Alleen een organisatiebeheerder ziet opslagquota.", 403);
  const accessToken = await googleAccessToken(env);
  const response = await fetch("https://www.googleapis.com/drive/v3/about?fields=storageQuota,user(displayName,emailAddress)", { headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new GatewayError("Drive-quota is tijdelijk niet beschikbaar.", 502);
  const data = await response.json() as { storageQuota?: { limit?: string; usage?: string; usageInDrive?: string }; user?: { displayName?: string; emailAddress?: string } };
  return json(env, {
    account: data.user,
    limitBytes: data.storageQuota?.limit ? Number(data.storageQuota.limit) : null,
    usageBytes: data.storageQuota?.usage ? Number(data.storageQuota.usage) : null,
    usageInDriveBytes: data.storageQuota?.usageInDrive ? Number(data.storageQuota.usageInDrive) : null,
  });
}

async function handle(request: Request, env: Env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env) });
  if (url.pathname === "/health" && request.method === "GET") {
    const missing = requiredEnv(env);
    return json(env, { status: missing.length ? "configuration_required" : "ready", googleDriveConfigured: !missing.some((key) => String(key).startsWith("GOOGLE_")), missingCount: missing.length }, missing.length ? 503 : 200);
  }
  if (url.pathname === "/v1/uploads/initiate" && request.method === "POST") return initiateUpload(request, env);
  if (url.pathname === "/v1/uploads/chunk" && request.method === "PUT") return uploadChunk(request, env);
  const fileMatch = /^\/v1\/files\/([0-9a-f-]{36})\/content$/.exec(url.pathname);
  if (fileMatch && request.method === "GET") return downloadFile(request, env, fileMatch[1]);
  if (url.pathname === "/v1/quota" && request.method === "GET") return quota(request, env);
  throw new GatewayError("Endpoint bestaat niet.", 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (request.headers.get("origin") && request.headers.get("origin") !== env.APP_ORIGIN) {
        throw new GatewayError("Origin niet toegestaan.", 403);
      }
      return await handle(request, env);
    } catch (error) {
      if (error instanceof GatewayError) return json(env, { error: error.message }, error.status);
      return json(env, { error: "De opslaggateway kon de bewerking niet veilig voltooien." }, 500);
    }
  },
};

export { parseRange, signUploadToken, verifyUploadToken };
