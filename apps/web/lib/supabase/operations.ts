import type { SupabaseClient } from "@supabase/supabase-js";

export type ChecklistItem = {
  id: string;
  template_id: string;
  section: string;
  prompt: string;
  response_type: "yes_no_na" | "pass_fail_na" | "number" | "text";
  required: boolean;
  sort_order: number;
  unit: string | null;
  minimum_value: number | null;
  maximum_value: number | null;
  failure_severity: "low" | "medium" | "high" | "critical";
  guidance: string | null;
};

export type ChecklistTemplate = {
  id: string;
  project_id: string | null;
  module: "inspection" | "hse" | "delivery" | "test";
  code: string;
  name: string;
  description: string | null;
  version_number: number;
  status: "draft" | "published" | "retired";
  items: ChecklistItem[];
};

export type Inspection = {
  id: string;
  template_id: string;
  inspection_number: string;
  title: string;
  status: "planned" | "in_progress" | "passed" | "failed" | "ready_for_reinspection" | "cancelled";
  planned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
};

export type Finding = {
  id: string;
  finding_number: string;
  finding_type: "observation" | "deficiency" | "deviation" | "ncr" | "improvement";
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  priority: "low" | "normal" | "high" | "critical";
  status: "draft" | "open" | "assigned" | "in_progress" | "ready_for_verification" | "closed" | "rejected" | "reopened" | "cancelled";
  responsible_party_id: string | null;
  assigned_user_id: string | null;
  due_at: string | null;
  cause: string | null;
  proposed_correction: string | null;
  final_measure: string | null;
  verified_at: string | null;
  created_at: string;
};

export type HseEvent = {
  id: string;
  event_number: string;
  event_type: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  status: string;
  confidential: boolean;
  immediate_measure: string | null;
  occurred_at: string;
};

export type RegisterEntry = {
  id: string;
  register_type: string;
  entry_number: string;
  title: string;
  status: string;
  occurred_at: string;
  due_at: string | null;
  details: Record<string, unknown>;
};

export type FileRecord = {
  id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  category: string;
  status: string;
  created_at: string;
};

export type ReportVersion = {
  id: string;
  revision: number;
  sha256: string;
  snapshot: Record<string, unknown>;
  signed_at: string | null;
  created_at: string;
};

export type ReportReview = { id: string; decision: string; comment: string; created_at: string };
export type ReportSignature = { id: string; signer_name: string; signer_role: string; legal_level: string; signed_at: string };
export type ReportDistribution = { id: string; recipient_name: string; recipient_address: string; channel: string; status: string; sent_at: string | null };
export type BackupRun = { id: string; run_type: string; status: string; schema_version: string; size_bytes: number | null; sha256: string | null; verified_at: string | null; created_at: string };

export type ProjectSettings = {
  id: string;
  project_id: string;
  report_prefix: string;
  default_language: string;
  max_file_size_mb: number;
  notification_lead_hours: number;
  retention_days: number | null;
  branding: Record<string, unknown>;
  modules: Record<string, boolean>;
  signing_workflow: Array<{ role: string; required: boolean }>;
};

export type LocationNode = {
  id: string;
  building_id: string;
  parent_id: string | null;
  node_type: "zone" | "floor" | "room" | "element" | "work_package";
  code: string;
  name: string;
  description: string | null;
  status: string;
};

export type ProductionReadinessItem = {
  id: string;
  code: string;
  category: "accounts" | "configuration" | "operations" | "legal" | "acceptance";
  title: string;
  description: string;
  owner_hint: string;
  blocking: boolean;
  status: "todo" | "in_progress" | "done" | "not_applicable";
  evidence: string | null;
  completed_at: string | null;
  sort_order: number;
};

export type OperationSnapshot = {
  templates: ChecklistTemplate[];
  inspections: Inspection[];
  findings: Finding[];
  hseEvents: HseEvent[];
  registerEntries: RegisterEntry[];
  files: FileRecord[];
  reportVersions: ReportVersion[];
  reportReviews: ReportReview[];
  reportSignatures: ReportSignature[];
  reportDistributions: ReportDistribution[];
  backupRuns: BackupRun[];
  settings: ProjectSettings | null;
  locationNodes: LocationNode[];
  productionReadiness: ProductionReadinessItem[];
};

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function loadProjectOperations(
  client: SupabaseClient,
  projectId: string,
  organizationId: string,
  reportId?: string | null,
): Promise<OperationSnapshot> {
  const [templateResult, inspectionResult, findingResult, hseResult, registerResult, fileResult, settingsResult, backupResult, locationResult, readinessResult] = await Promise.all([
    client.from("checklist_templates").select("id,project_id,module,code,name,description,version_number,status").or(`project_id.is.null,project_id.eq.${projectId}`).order("name"),
    client.from("inspections").select("id,template_id,inspection_number,title,status,planned_at,started_at,completed_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(100),
    client.from("findings").select("id,finding_number,finding_type,title,description,severity,priority,status,responsible_party_id,assigned_user_id,due_at,cause,proposed_correction,final_measure,verified_at,created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(100),
    client.from("hse_events").select("id,event_number,event_type,title,description,severity,status,confidential,immediate_measure,occurred_at").eq("project_id", projectId).order("occurred_at", { ascending: false }).limit(100),
    client.from("project_register_entries").select("id,register_type,entry_number,title,status,occurred_at,due_at,details").eq("project_id", projectId).order("occurred_at", { ascending: false }).limit(150),
    client.from("files").select("id,original_name,mime_type,size_bytes,category,status,created_at").eq("project_id", projectId).neq("status", "deleted").order("created_at", { ascending: false }).limit(100),
    client.from("project_settings").select("id,project_id,report_prefix,default_language,max_file_size_mb,notification_lead_hours,retention_days,branding,modules,signing_workflow").eq("project_id", projectId).maybeSingle(),
    client.from("backup_runs").select("id,run_type,status,schema_version,size_bytes,sha256,verified_at,created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(25),
    client.from("location_nodes").select("id,building_id,parent_id,node_type,code,name,description,status").eq("project_id", projectId).order("sort_order").limit(500),
    client.from("production_readiness_items").select("id,code,category,title,description,owner_hint,blocking,status,evidence,completed_at,sort_order").eq("organization_id", organizationId).order("sort_order"),
  ]);
  [templateResult, inspectionResult, findingResult, hseResult, registerResult, fileResult, settingsResult, backupResult, locationResult, readinessResult].forEach((result) => fail(result.error));
  const templateRows = (templateResult.data ?? []) as Omit<ChecklistTemplate, "items">[];
  const itemResult = templateRows.length
    ? await client.from("checklist_items").select("id,template_id,section,prompt,response_type,required,sort_order,unit,minimum_value,maximum_value,failure_severity,guidance").in("template_id", templateRows.map((template) => template.id)).order("sort_order")
    : { data: [], error: null };
  fail(itemResult.error);

  const reportFilters = reportId
    ? await Promise.all([
        client.from("report_versions").select("id,revision,sha256,snapshot,signed_at,created_at").eq("day_report_id", reportId).order("revision", { ascending: false }),
        client.from("report_reviews").select("id,decision,comment,created_at").eq("day_report_id", reportId).order("created_at", { ascending: false }),
        client.from("report_signatures").select("id,signer_name,signer_role,legal_level,signed_at").eq("day_report_id", reportId).order("signed_at", { ascending: false }),
        client.from("report_distributions").select("id,recipient_name,recipient_address,channel,status,sent_at").eq("day_report_id", reportId).order("created_at", { ascending: false }),
      ])
    : [];
  reportFilters.forEach((result) => fail(result.error));
  const items = (itemResult.data ?? []) as ChecklistItem[];
  return {
    templates: templateRows.map((template) => ({ ...template, items: items.filter((item) => item.template_id === template.id) })),
    inspections: (inspectionResult.data ?? []) as Inspection[],
    findings: (findingResult.data ?? []) as Finding[],
    hseEvents: (hseResult.data ?? []) as HseEvent[],
    registerEntries: (registerResult.data ?? []) as RegisterEntry[],
    files: (fileResult.data ?? []) as FileRecord[],
    settings: settingsResult.data as ProjectSettings | null,
    backupRuns: (backupResult.data ?? []) as BackupRun[],
    reportVersions: (reportFilters[0]?.data ?? []) as ReportVersion[],
    reportReviews: (reportFilters[1]?.data ?? []) as ReportReview[],
    reportSignatures: (reportFilters[2]?.data ?? []) as ReportSignature[],
    reportDistributions: (reportFilters[3]?.data ?? []) as ReportDistribution[],
    locationNodes: (locationResult.data ?? []) as LocationNode[],
    productionReadiness: (readinessResult.data ?? []) as ProductionReadinessItem[],
  };
}

export async function startInspection(client: SupabaseClient, input: { projectId: string; buildingId: string; reportId: string; templateId: string; title: string }) {
  const result = await client.rpc("start_project_inspection", {
    p_project_id: input.projectId,
    p_building_id: input.buildingId,
    p_day_report_id: input.reportId,
    p_template_id: input.templateId,
    p_title: input.title,
    p_idempotency_key: `inspection:${crypto.randomUUID()}`,
  });
  fail(result.error);
  return result.data as Inspection;
}

export async function finishInspection(client: SupabaseClient, inspection: Inspection, answers: Record<string, { result: string; notes: string }>) {
  for (const [itemId, answer] of Object.entries(answers)) {
    const saved = await client.rpc("save_inspection_response", {
      p_inspection_id: inspection.id,
      p_checklist_item_id: itemId,
      p_result: answer.result,
      p_numeric_value: null,
      p_text_value: null,
      p_notes: answer.notes,
      p_idempotency_key: `inspection-response:${inspection.id}:${itemId}`,
    });
    fail(saved.error);
  }
  const completed = await client.rpc("complete_project_inspection", { p_inspection_id: inspection.id });
  fail(completed.error);
  return completed.data as Inspection;
}

export async function createFinding(client: SupabaseClient, input: { projectId: string; buildingId: string; reportId: string; type: string; title: string; description: string; severity: string; responsiblePartyId?: string }) {
  const result = await client.rpc("create_project_finding", {
    p_project_id: input.projectId,
    p_building_id: input.buildingId,
    p_day_report_id: input.reportId,
    p_inspection_id: null,
    p_inspection_response_id: null,
    p_finding_type: input.type,
    p_title: input.title,
    p_description: input.description,
    p_severity: input.severity,
    p_responsible_party_id: input.responsiblePartyId || null,
    p_assigned_user_id: null,
    p_idempotency_key: `finding:${crypto.randomUUID()}`,
  });
  fail(result.error);
  return result.data as Finding;
}

export async function transitionFinding(client: SupabaseClient, findingId: string, nextStatus: string, note: string, finalMeasure = "") {
  const result = await client.rpc("transition_project_finding", {
    p_finding_id: findingId,
    p_next_status: nextStatus,
    p_note: note,
    p_cause: null,
    p_correction: null,
    p_final_measure: finalMeasure || null,
  });
  fail(result.error);
  return result.data as Finding;
}

export async function createHseEvent(client: SupabaseClient, input: { projectId: string; buildingId: string; reportId: string; type: string; title: string; description: string; severity: string; immediateMeasure: string; confidential: boolean }) {
  const result = await client.rpc("create_project_hse_event", {
    p_project_id: input.projectId,
    p_building_id: input.buildingId,
    p_day_report_id: input.reportId,
    p_event_type: input.type,
    p_title: input.title,
    p_description: input.description,
    p_severity: input.severity,
    p_immediate_measure: input.immediateMeasure,
    p_confidential: input.confidential,
    p_occurred_at: new Date().toISOString(),
    p_idempotency_key: `hse:${crypto.randomUUID()}`,
  });
  fail(result.error);
  return result.data as HseEvent;
}

export async function createRegisterEntry(client: SupabaseClient, input: { projectId: string; buildingId: string; reportId: string; type: string; title: string; responsiblePartyId?: string; details: Record<string, unknown> }) {
  const result = await client.rpc("create_project_register_entry", {
    p_project_id: input.projectId,
    p_building_id: input.buildingId,
    p_day_report_id: input.reportId,
    p_register_type: input.type,
    p_title: input.title,
    p_occurred_at: new Date().toISOString(),
    p_due_at: null,
    p_responsible_party_id: input.responsiblePartyId || null,
    p_details: input.details,
    p_idempotency_key: `register:${crypto.randomUUID()}`,
  });
  fail(result.error);
  return result.data as RegisterEntry;
}

export async function reviewReport(client: SupabaseClient, reportId: string, decision: "approved" | "returned", comment: string) {
  const result = await client.rpc("review_day_report", { p_day_report_id: reportId, p_decision: decision, p_comment: comment, p_idempotency_key: `review:${crypto.randomUUID()}` });
  fail(result.error);
  return result.data;
}

export async function signReport(client: SupabaseClient, reportId: string, role: string, name: string, declaration: string) {
  const result = await client.rpc("sign_report_version", { p_day_report_id: reportId, p_signer_role: role, p_signer_name: name, p_declaration: declaration, p_legal_level: "contract_pending" });
  fail(result.error);
  return result.data;
}

export async function recordDistribution(client: SupabaseClient, reportId: string, name: string, address: string, channel: string) {
  const result = await client.rpc("record_report_distribution", { p_day_report_id: reportId, p_recipient_name: name, p_recipient_address: address, p_channel: channel, p_delivery_confirmed: false });
  fail(result.error);
  return result.data;
}

export async function startRevision(client: SupabaseClient, reportId: string, reason: string) {
  const result = await client.rpc("start_report_revision", { p_day_report_id: reportId, p_reason: reason });
  fail(result.error);
  return result.data;
}

export async function createChecklist(client: SupabaseClient, input: { organizationId: string; projectId: string; module: string; code: string; name: string; prompts: string[] }) {
  const result = await client.rpc("create_project_checklist", {
    p_project_id: input.projectId,
    p_module: input.module,
    p_code: input.code,
    p_name: input.name,
    p_prompts: input.prompts,
  });
  fail(result.error);
  if (!result.data) throw new Error("De checklist kon niet worden aangemaakt.");
  return (result.data as ChecklistTemplate).id;
}

export async function saveProjectSettings(client: SupabaseClient, settings: ProjectSettings, update: Partial<ProjectSettings>) {
  const result = await client.from("project_settings").update(update).eq("id", settings.id).select("*").single();
  fail(result.error);
  return result.data as ProjectSettings;
}

export async function createLocationNode(client: SupabaseClient, input: { organizationId: string; projectId: string; buildingId: string; parentId?: string; type: string; code: string; name: string; description?: string }) {
  const userResult = await client.auth.getUser();
  fail(userResult.error);
  if (!userResult.data.user) throw new Error("Je sessie is verlopen.");
  const result = await client.from("location_nodes").insert({
    organization_id: input.organizationId,
    project_id: input.projectId,
    building_id: input.buildingId,
    parent_id: input.parentId || null,
    node_type: input.type,
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    created_by: userResult.data.user.id,
  });
  fail(result.error);
}

export async function updateProductionReadiness(
  client: SupabaseClient,
  itemId: string,
  status: ProductionReadinessItem["status"],
  evidence: string,
) {
  const result = await client.rpc("update_production_readiness_item", {
    p_item_id: itemId,
    p_status: status,
    p_evidence: evidence,
  });
  fail(result.error);
  return result.data as ProductionReadinessItem;
}

export async function createProjectParty(client: SupabaseClient, input: { organizationId: string; projectId: string; code: string; name: string; type: string }) {
  const userResult = await client.auth.getUser();
  fail(userResult.error);
  if (!userResult.data.user) throw new Error("Je sessie is verlopen.");
  const result = await client.from("parties").insert({
    organization_id: input.organizationId,
    project_id: input.projectId,
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    party_type: input.type,
    created_by: userResult.data.user.id,
  });
  fail(result.error);
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function downloadManualBackup(client: SupabaseClient, organizationId: string, projectId: string) {
  const rateLimit = await client.rpc("consume_security_rate_limit", { p_action_code: "manual_backup", p_max_requests: 5, p_window_minutes: 60 });
  fail(rateLimit.error);
  if (rateLimit.data !== true) throw new Error("De exportlimiet is bereikt. Probeer het over een uur opnieuw.");
  const result = await client.rpc("create_manual_backup_export", { p_organization_id: organizationId, p_project_id: projectId, p_idempotency_key: `manual:${crypto.randomUUID()}` });
  fail(result.error);
  const manifest = result.data as Record<string, unknown>;
  const text = JSON.stringify(manifest, null, 2);
  const bytes = new TextEncoder().encode(text);
  const sha256 = await sha256Hex(bytes);
  const verified = await client.rpc("verify_manual_backup_export", { p_backup_run_id: manifest.backup_run_id, p_sha256: sha256, p_size_bytes: bytes.byteLength });
  fail(verified.error);
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `codeco-project-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  return { manifest, sha256, size: bytes.byteLength };
}

export async function validateBackupDryRun(client: SupabaseClient, file: File) {
  const rateLimit = await client.rpc("consume_security_rate_limit", { p_action_code: "restore_dry_run", p_max_requests: 10, p_window_minutes: 60 });
  fail(rateLimit.error);
  if (rateLimit.data !== true) throw new Error("De restoretestlimiet is bereikt. Probeer het later opnieuw.");
  const manifest = JSON.parse(await file.text()) as Record<string, unknown>;
  const result = await client.rpc("dry_run_backup_restore", { p_manifest: manifest });
  fail(result.error);
  return result.data as BackupRun;
}
