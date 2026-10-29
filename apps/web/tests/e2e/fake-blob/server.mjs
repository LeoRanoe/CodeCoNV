/**
 * A stand-in for the Vercel Blob service, for the local stack only. It keeps files in memory and
 * speaks just enough of the wire protocol for the app's own routes: the signed token, the
 * presigned PUT the browser sends, head, delete and the private download the server reads back.
 * It listens on 127.0.0.1 and nowhere else.
 */
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

function storeIdFromToken(token) {
  return String(token ?? "").split("_")[3] || "fakestore0001";
}

function cors(response) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,PUT,POST,DELETE,OPTIONS");
  response.setHeader("access-control-allow-headers", "*");
  response.setHeader("access-control-expose-headers", "*");
}

function json(response, status, body) {
  cors(response);
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
}

function notFound(response) {
  json(response, 404, { error: { code: "not_found", message: "The requested blob does not exist" } });
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function pathnameOf(value) {
  try {
    const parsed = new URL(value);
    const path = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    return path.startsWith("__blob/") ? path.slice("__blob/".length) : path;
  } catch {
    return value;
  }
}

function describe(pathname, entry, base) {
  const url = `${base}/__blob/${encodeURI(pathname)}`;
  return {
    url,
    downloadUrl: `${url}?download=1`,
    pathname,
    contentType: entry.contentType,
    contentDisposition: `inline; filename="${pathname.split("/").pop()}"`,
    cacheControl: "public, max-age=2592000",
    size: entry.body.byteLength,
    uploadedAt: entry.uploadedAt,
    etag: entry.etag,
  };
}

export function startFakeBlob(port = 3411) {
  const store = new Map();
  const base = `http://127.0.0.1:${port}`;
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", base);
      if (request.method === "OPTIONS") {
        cors(response);
        response.statusCode = 204;
        response.end();
        return;
      }
      if (url.pathname === "/__health") return json(response, 200, { ok: true, files: store.size });
      if (url.pathname === "/__reset") {
        store.clear();
        return json(response, 200, { ok: true });
      }
      if (url.pathname === "/__files") return json(response, 200, { files: [...store.keys()] });

      // The private download the server reads back after an upload. The SDK builds a
      // vercel-storage address; the preload rewrites it to this path.
      if (url.pathname.startsWith("/__blob/") && request.method === "GET") {
        const pathname = decodeURIComponent(url.pathname.slice("/__blob/".length));
        const entry = store.get(pathname);
        if (!entry) return notFound(response);
        cors(response);
        response.statusCode = 200;
        response.setHeader("content-type", entry.contentType);
        response.setHeader("content-length", String(entry.body.byteLength));
        response.setHeader("etag", entry.etag);
        response.setHeader("last-modified", new Date(entry.uploadedAt).toUTCString());
        response.end(entry.body);
        return;
      }

      if (url.pathname === "/signed-token" && request.method === "POST") {
        const options = JSON.parse((await readBody(request)).toString("utf8") || "{}");
        const token = String(request.headers.authorization ?? "").replace(/^Bearer /, "");
        const payload = {
          storeId: storeIdFromToken(token),
          pathname: options.pathname,
          operations: options.operations ?? ["put", "get", "head", "delete"],
          validUntil: options.validUntil ?? Date.now() + 10 * 60 * 1000,
          maximumSizeInBytes: options.maximumSizeInBytes,
          allowedContentTypes: options.allowedContentTypes,
        };
        const delegationToken = `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.fake-signature`;
        return json(response, 200, { delegationToken, clientSigningToken: "fake-client-signing-token" });
      }

      if (url.pathname === "/delete" && request.method === "POST") {
        const { urls } = JSON.parse((await readBody(request)).toString("utf8") || "{}");
        for (const item of urls ?? []) store.delete(pathnameOf(item));
        return json(response, 200, {});
      }

      if (url.pathname === "/" && request.method === "PUT") {
        const pathname = url.searchParams.get("pathname");
        if (!pathname) return json(response, 400, { error: { code: "bad_request", message: "pathname is required" } });
        const body = await readBody(request);
        const contentType = String(request.headers["x-content-type"] ?? request.headers["content-type"] ?? "application/octet-stream");
        if (store.has(pathname) && request.headers["x-allow-overwrite"] === "0") {
          return json(response, 400, { error: { code: "blob_already_exists", message: "This blob already exists" } });
        }
        const entry = { body, contentType, uploadedAt: new Date().toISOString(), etag: `"${body.byteLength.toString(16)}-${Date.now().toString(16)}"` };
        store.set(pathname, entry);
        return json(response, 200, describe(pathname, entry, base));
      }

      if (url.pathname === "/" && request.method === "GET") {
        const target = url.searchParams.get("url");
        if (target === null) {
          return json(response, 200, { blobs: [...store.keys()].map((key) => describe(key, store.get(key), base)), hasMore: false });
        }
        const pathname = pathnameOf(target);
        const entry = store.get(pathname);
        if (!entry) return notFound(response);
        return json(response, 200, describe(pathname, entry, base));
      }

      return json(response, 404, { error: { code: "not_found", message: `Unhandled ${request.method} ${url.pathname}` } });
    } catch (error) {
      return json(response, 500, { error: { code: "internal_server_error", message: String(error) } });
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve({ server, base, store }));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.FAKE_BLOB_PORT || 3411);
  const { base } = await startFakeBlob(port);
  console.log(`fake blob store on ${base}`);
}
