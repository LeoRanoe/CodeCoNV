import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reads and writes of the Contractor Portal, the Client Portal and CODECO's share panel.
 * Every read goes through row-level security: a portal user only ever receives the shares,
 * events and files of its own organisation (migration 202611220001).
 */

export type PortalAudience = "contractor" | "client";

export type PortalShare = {
  id: string;
  project_id: string;
  organization_id: string;
  audience: PortalAudience;
  party_id: string;
  record_type: "finding" | "action" | "hse" | "inspection" | "register_entry" | "document" | "publication" | "file";
  record_id: string;
  record_code: string | null;
  building_id: string | null;
  title: string;
  visible_summary: string | null;
  requested_action: string;
  priority: string;
  due_at: string | null;
  contact_user_id: string | null;
  publication_type: string | null;
  period_start: string | null;
  period_end: string | null;
  publication_version: number;
  status: string;
  round: number;
  assigned_by: string;
  assigned_at: string;
  closed_at: string | null;
  updated_at: string;
};

export type PortalEvent = {
  id: string;
  sequence: number;
  share_id: string;
  round: number;
  action: string;
  actor_user_id: string;
  actor_name: string | null;
  actor_side: "codeco" | "contractor" | "client";
  actor_party_id: string | null;
  actor_roles: string | null;
  comment: string | null;
  payload: Record<string, unknown>;
  file_ids: string[];
  previous_status: string | null;
  resulting_status: string | null;
  created_at: string;
};

export type PortalShareFile = {
  share_id: string;
  file_id: string;
  source: "shared" | "response";
  added_at: string;
};

export type PortalFile = {
  id: string;
  original_name: string;
  mime_type: string;
  category: string;
  size_bytes: number;
  created_at: string;
  document_code: string | null;
};

export type PortalContext = {
  party_id: string;
  party_name: string;
  party_type: string;
  audience: PortalAudience | null;
  can_respond: boolean;
  can_review: boolean;
  can_approve: boolean;
};

export type PortalDocument = { id: string; document_number: string | null; title: string; folder_code: string; current_revision_id: string | null };

export type PortalSnapshot = {
  shares: PortalShare[];
  events: PortalEvent[];
  shareFiles: PortalShareFile[];
  files: Map<string, PortalFile>;
  documents: Map<string, PortalDocument>;
  revisions: Array<{ id: string; document_id: string; revision: string; review_status: string; issue_date: string | null; uploaded_at: string; file_id: string; superseded_at: string | null }>;
};

const shareColumns = "id,project_id,organization_id,audience,party_id,record_type,record_id,record_code,building_id,title,visible_summary,requested_action,priority,due_at,contact_user_id,publication_type,period_start,period_end,publication_version,status,round,assigned_by,assigned_at,closed_at,updated_at";
const eventColumns = "id,sequence,share_id,round,action,actor_user_id,actor_name,actor_side,actor_party_id,actor_roles,comment,payload,file_ids,previous_status,resulting_status,created_at";

function fail(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message || fallback);
}

export async function loadPortalContext(client: SupabaseClient, projectId: string): Promise<PortalContext | null> {
  const result = await client.rpc("my_portal_context", { p_project_id: projectId });
  if (result.error) fail(result.error, "The portal could not be opened.");
  const row = (result.data as PortalContext[] | null)?.[0];
  return row ?? null;
}

/** Everything a portal (or CODECO's share register) shows, in four reads. */
export async function loadPortalSnapshot(client: SupabaseClient, projectId: string, filter?: { recordType?: string; recordId?: string }): Promise<PortalSnapshot> {
  let shareQuery = client.from("portal_shares").select(shareColumns).eq("project_id", projectId).order("assigned_at", { ascending: false }).limit(1000);
  if (filter?.recordType) shareQuery = shareQuery.eq("record_type", filter.recordType);
  if (filter?.recordId) shareQuery = shareQuery.eq("record_id", filter.recordId);
  const shareResult = await shareQuery;
  if (shareResult.error) fail(shareResult.error, "Portal items could not be loaded.");
  const shares = (shareResult.data ?? []) as PortalShare[];
  const shareIds = shares.map((share) => share.id);
  if (!shareIds.length) return { shares, events: [], shareFiles: [], files: new Map(), documents: new Map(), revisions: [] };

  const [eventResult, fileLinkResult] = await Promise.all([
    client.from("portal_events").select(eventColumns).in("share_id", shareIds).order("sequence", { ascending: true }).limit(5000),
    client.from("portal_share_files").select("share_id,file_id,source,added_at").in("share_id", shareIds).limit(5000),
  ]);
  if (eventResult.error) fail(eventResult.error, "The portal history could not be loaded.");
  if (fileLinkResult.error) fail(fileLinkResult.error, "Portal files could not be loaded.");
  const shareFiles = (fileLinkResult.data ?? []) as PortalShareFile[];
  const fileIds = [...new Set(shareFiles.map((item) => item.file_id))];
  const documentIds = [...new Set(shares.filter((share) => share.record_type === "document").map((share) => share.record_id))];

  const [fileResult, documentResult, revisionResult] = await Promise.all([
    fileIds.length
      ? client.from("files").select("id,original_name,mime_type,category,size_bytes,created_at,document_code").in("id", fileIds)
      : Promise.resolve({ data: [], error: null }),
    documentIds.length
      ? client.from("project_documents").select("id,document_number,title,folder_code,current_revision_id").in("id", documentIds)
      : Promise.resolve({ data: [], error: null }),
    documentIds.length
      ? client.from("project_document_revisions").select("id,document_id,revision,review_status,issue_date,uploaded_at,file_id,superseded_at").in("document_id", documentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (fileResult.error) fail(fileResult.error, "Portal files could not be loaded.");
  if (documentResult.error) fail(documentResult.error, "Shared documents could not be loaded.");
  if (revisionResult.error) fail(revisionResult.error, "Document revisions could not be loaded.");

  return {
    shares,
    events: (eventResult.data ?? []) as PortalEvent[],
    shareFiles,
    files: new Map(((fileResult.data ?? []) as PortalFile[]).map((file) => [file.id, file])),
    documents: new Map(((documentResult.data ?? []) as PortalDocument[]).map((document) => [document.id, document])),
    revisions: (revisionResult.data ?? []) as PortalSnapshot["revisions"],
  };
}

export async function respondInPortal(client: SupabaseClient, input: { shareId: string; action: string; comment?: string; payload?: Record<string, unknown>; fileIds?: string[] }) {
  const result = await client.rpc("respond_in_portal", {
    p_share_id: input.shareId,
    p_action: input.action,
    p_comment: input.comment?.trim() || null,
    p_payload: input.payload ?? {},
    p_file_ids: input.fileIds ?? [],
  });
  if (result.error) fail(result.error, "The response was not saved.");
  return result.data as string;
}

export async function reviewPortalShare(client: SupabaseClient, input: { shareId: string; action: string; comment?: string; fileIds?: string[] }) {
  const result = await client.rpc("review_portal_share", {
    p_share_id: input.shareId,
    p_action: input.action,
    p_comment: input.comment?.trim() || null,
    p_file_ids: input.fileIds ?? [],
  });
  if (result.error) fail(result.error, "The review step was not saved.");
  return result.data as string;
}

export type ShareInput = {
  projectId: string;
  audience: PortalAudience;
  partyId: string;
  recordType: PortalShare["record_type"];
  recordId: string;
  title: string;
  summary?: string;
  requestedAction: string;
  priority?: string;
  dueAt?: string | null;
  fileIds?: string[];
  contactUserId?: string | null;
  publicationType?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
};

export async function shareToPortal(client: SupabaseClient, input: ShareInput) {
  const result = await client.rpc("share_to_portal", {
    p_project_id: input.projectId,
    p_audience: input.audience,
    p_party_id: input.partyId,
    p_record_type: input.recordType,
    p_record_id: input.recordId,
    p_title: input.title,
    p_summary: input.summary?.trim() || null,
    p_requested_action: input.requestedAction,
    p_priority: input.priority || "normal",
    p_due_at: input.dueAt || null,
    p_file_ids: input.fileIds ?? [],
    p_contact_user_id: input.contactUserId || null,
    p_publication_type: input.publicationType || null,
    p_period_start: input.periodStart || null,
    p_period_end: input.periodEnd || null,
  });
  if (result.error) fail(result.error, "The item was not shared.");
  return result.data as string;
}

export async function recordPortalAccess(client: SupabaseClient, shareId: string, kind: "view" | "download", fileId?: string) {
  // Logging an access never blocks opening the item.
  await client.rpc("record_portal_access", { p_share_id: shareId, p_kind: kind, p_file_id: fileId ?? null }).then(() => undefined, () => undefined);
}

export async function setMemberPortalParty(client: SupabaseClient, projectId: string, userId: string, partyId: string | null) {
  const result = await client.rpc("set_project_member_portal_party", { p_project_id: projectId, p_user_id: userId, p_party_id: partyId });
  if (result.error) fail(result.error, "The organisation was not linked.");
}

/** Files already attached to a record, offered when CODECO shares that record. */
export async function loadRecordFiles(client: SupabaseClient, projectId: string, recordType: string, recordId: string) {
  const linkType = recordType === "hse" ? "hse" : recordType;
  const links = await client.from("file_links").select("file_id").eq("project_id", projectId).eq("record_type", linkType).eq("record_id", recordId).limit(200);
  if (links.error) return [] as PortalFile[];
  const ids = [...new Set((links.data ?? []).map((row) => String(row.file_id)))];
  if (!ids.length) return [] as PortalFile[];
  const files = await client.from("files").select("id,original_name,mime_type,category,size_bytes,created_at,document_code").in("id", ids).eq("status", "available");
  return (files.data ?? []) as PortalFile[];
}

/** Project members linked to a party, for the contact picker and Management. */
export async function loadPortalMembers(client: SupabaseClient, projectId: string) {
  const result = await client.from("project_memberships").select("user_id,portal_party_id,status").eq("project_id", projectId).limit(1000);
  if (result.error) return [] as Array<{ user_id: string; portal_party_id: string | null; status: string }>;
  return (result.data ?? []) as Array<{ user_id: string; portal_party_id: string | null; status: string }>;
}
