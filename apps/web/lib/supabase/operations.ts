import type { SupabaseClient } from "@supabase/supabase-js";
import { anchorChecklistLibrary, legacyAnchorPrompts } from "@/lib/checklists/anchor-library";
import { normalizeExternalShareToken } from "@/lib/external-share/token.mjs";

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

export type ChecklistLibraryTemplate = {
  code: string;
  module: "inspection" | "hse" | "delivery" | "test";
  category: string;
  name: string;
  description: string;
  prompts: string[];
  sort_order: number;
};

export type Inspection = {
  id: string;
  building_id: string;
  location_node_id: string | null;
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
  building_id: string;
  location_node_id: string | null;
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
  issue_management: {
    issue_type?: string;
    impact_summary?: string;
    action_steps?: string;
    escalation_required?: boolean;
    disposition?: "validated" | "to_be_corrected" | "alternative_solution";
    expected_resolution_date?: string | null;
    source_catalog_subject?: string;
  };
  verified_at: string | null;
  created_at: string;
};

export type FindingProgressUpdate = {
  id: string;
  finding_id: string;
  progress_percent: number;
  disposition: "validated" | "to_be_corrected" | "alternative_solution";
  note: string;
  inspected_at: string;
  created_at: string;
};

export type HseEvent = {
  id: string;
  building_id: string;
  location_node_id: string | null;
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
  building_id: string | null;
  location_node_id: string | null;
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
  building_id: string | null;
  folder_id: string | null;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  category: string;
  status: string;
  created_at: string;
};

export type MediaFolder = {
  id: string;
  building_id: string | null;
  parent_id: string | null;
  name: string;
  folder_type: "images" | "drawings" | "mixed";
  status: "active" | "archived";
  created_at: string;
};

export type ExternalShareLink = {
  id: string;
  organization_id: string;
  project_id: string;
  building_id: string | null;
  source_type: "finding" | "action" | "inspection" | "visual";
  source_id: string;
  source_number: string;
  title: string;
  summary: string;
  source_file_id: string | null;
  expires_at: string;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_by: string;
  created_at: string;
};

export type FileLinkRecordType =
  | "registration" | "inspection" | "inspection_response" | "finding" | "finding_update"
  | "hse" | "action" | "report" | "document" | "register_entry";

export type FileLink = {
  id: string;
  file_id: string;
  record_type: FileLinkRecordType;
  record_id: string;
  relationship: "attachment" | "before" | "after" | "evidence" | "original" | "annotation" | "certificate" | "preview";
  created_at: string;
};

/**
 * One confirmed day closeout, used to browse Works ongoing, Works completed and
 * Delays over time instead of only recording them.
 */
export type DailyWorkRecord = {
  id: string;
  building_id: string;
  day_report_id: string;
  day_summary: string;
  work_ongoing: string | null;
  work_performed: string;
  progress_percent: number;
  delay_cause: string;
  delay_hours: number;
  tomorrow_plan: string;
  created_at: string;
};

export type RevokeExternalShareResult = {
  share_id: string;
  revoked_at: string;
  already_revoked: boolean;
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
export type DayReportSummary = { id: string; report_date: string; report_number: string; status: string; completeness_percent: number; created_at: string; updated_at: string };
export type BackupRun = { id: string; run_type: string; status: string; schema_version: string; size_bytes: number | null; sha256: string | null; verified_at: string | null; created_at: string };

export type ProjectSettings = {
  id: string;
  project_id: string;
  report_prefix: string;
  default_language: string;
  max_file_size_mb: number;
  notification_lead_hours: number;
  email_notifications_enabled: boolean;
  push_notifications_enabled: boolean;
  retention_days: number | null;
  branding: Record<string, unknown>;
  modules: Record<string, boolean>;
  signing_workflow: Array<{ role: string; required: boolean }>;
  configuration_status: "setup" | "ready" | "active";
  default_shift_start: string;
  default_shift_end: string;
  disciplines: string[];
  finding_deadlines: Record<"low" | "medium" | "high" | "critical", number>;
  report_sections: string[];
  default_units: Record<string, string>;
  required_location_depth: "building" | "floor" | "room" | "element";
  report_header: string | null;
  report_footer: string | null;
};

export type BoqProgressUpdate = {
  id: string;
  register_entry_id: string;
  building_id: string;
  progress_percent: number;
  quantity_completed: number | null;
  note: string;
  recorded_at: string;
  created_at: string;
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

export type VisualCapture = {
  id: string;
  building_id: string;
  file_id: string;
  location_node_id: string | null;
  day_report_id: string | null;
  capture_type: "photo" | "panorama";
  title: string;
  description: string | null;
  location_label: string;
  tour_name: string | null;
  tour_order: number | null;
  captured_at: string;
  status: "active" | "archived";
  created_at: string;
};

export type VisualAnnotation = {
  id: string;
  capture_id: string;
  finding_id: string;
  coordinate_mode: "photo" | "spherical";
  x_ratio: number | null;
  y_ratio: number | null;
  yaw: number | null;
  pitch: number | null;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  /** Punch-list classification that drives the marker colour. Optional on snapshots cached before it shipped. */
  disposition?: "validated" | "to_be_corrected" | "alternative_solution";
  status: "active" | "void";
  created_at: string;
};

export type DrawingPin = {
  id: string;
  drawing_file_id: string;
  page_number: number;
  x_ratio: number;
  y_ratio: number;
  linked_record_type: "rfi" | "submittal" | "document" | "observation" | "inspection" | "visual";
  linked_record_id: string;
  linked_record_number: string;
  linked_record_title: string;
  note: string | null;
  status: "active" | "void";
  created_at: string;
};

export type NormalizedPoint = { x: number; y: number };

export type DrawingMarkup = {
  id: string;
  drawing_file_id: string;
  page_number: number;
  markup_type: "freehand" | "cloud" | "arrow" | "text";
  geometry: {
    points?: NormalizedPoint[];
    start?: NormalizedPoint;
    end?: NormalizedPoint;
    position?: NormalizedPoint;
  };
  color: string;
  stroke_width: number;
  text_content: string | null;
  status: "active" | "void";
  created_at: string;
};

export type PeriodReportSnapshot = {
  schema_version: string;
  generated_at: string;
  period: { start_date: string; end_date: string };
  project: Record<string, unknown>;
  day_reports: Array<Record<string, unknown>>;
  day_starts: Array<Record<string, unknown>>;
  day_closeouts: Array<Record<string, unknown>>;
  attendance: Array<Record<string, unknown>>;
  registrations: Array<Record<string, unknown>>;
  inspections: Array<Record<string, unknown>>;
  findings: Array<Record<string, unknown>>;
  hse_events: Array<Record<string, unknown>>;
  register_entries: Array<Record<string, unknown>>;
  visual_captures: Array<Record<string, unknown>>;
  open_actions: Array<Record<string, unknown>>;
  buildings: Array<Record<string, unknown>>;
  parties: Array<Record<string, unknown>>;
  files: Array<Record<string, unknown>>;
  media_folders: Array<Record<string, unknown>>;
  finding_progress_updates: Array<Record<string, unknown>>;
  boq_progress_updates?: Array<Record<string, unknown>>;
  location_nodes?: Array<Record<string, unknown>>;
  project_settings?: Record<string, unknown>;
};

export type OperationSnapshot = {
  templates: ChecklistTemplate[];
  checklistLibrary: ChecklistLibraryTemplate[];
  inspections: Inspection[];
  findings: Finding[];
  findingProgressUpdates: FindingProgressUpdate[];
  hseEvents: HseEvent[];
  registerEntries: RegisterEntry[];
  boqProgressUpdates: BoqProgressUpdate[];
  files: FileRecord[];
  reportVersions: ReportVersion[];
  reportReviews: ReportReview[];
  reportSignatures: ReportSignature[];
  reportDistributions: ReportDistribution[];
  dayReports?: DayReportSummary[];
  backupRuns: BackupRun[];
  settings: ProjectSettings | null;
  locationNodes: LocationNode[];
  productionReadiness: ProductionReadinessItem[];
  visualCaptures: VisualCapture[];
  visualAnnotations: VisualAnnotation[];
  drawingPins: DrawingPin[];
  drawingMarkups: DrawingMarkup[];
  mediaFolders: MediaFolder[];
  // Optional only for offline snapshots cached before link management shipped.
  externalShareLinks?: ExternalShareLink[];
  // Optional only for offline snapshots cached before file linking became visible.
  fileLinks?: FileLink[];
  // Optional only for offline snapshots cached before daily work became browsable.
  dailyWork?: DailyWorkRecord[];
  _offlineCached?: boolean;
  _offlineSavedAt?: string;
};

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function schemaFeatureMissing(error: { message: string } | null, feature: string) {
  const message = error?.message.toLowerCase() ?? "";
  return message.includes(feature.toLowerCase())
    && (message.includes("does not exist") || message.includes("schema cache") || message.includes("could not find"));
}

function rpcSignatureMissing(error: { message: string } | null, functionName: string) {
  const message = error?.message.toLowerCase() ?? "";
  return message.includes(functionName.toLowerCase())
    && (message.includes("schema cache") || message.includes("could not find the function"));
}

function legacySettingsCompatibility(branding: unknown) {
  if (!branding || typeof branding !== "object" || Array.isArray(branding)) return {};
  const compatibility = (branding as Record<string, unknown>).client_configuration_compatibility;
  return compatibility && typeof compatibility === "object" && !Array.isArray(compatibility)
    ? compatibility as Partial<ProjectSettings>
    : {};
}

export async function ensureProjectDayReport(
  client: SupabaseClient,
  projectId: string,
  reportId?: string | null,
) {
  if (reportId) return reportId;
  const reportDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Paramaribo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const result = await client.rpc("create_day_report", {
    p_project_id: projectId,
    p_report_date: reportDate,
    p_idempotency_key: `report:${projectId}:${reportDate}`,
  });
  fail(result.error);
  const createdId = (result.data as { id?: string } | null)?.id;
  if (!createdId) throw new Error("The daily report could not be prepared.");
  return createdId;
}

export async function loadProjectOperations(
  client: SupabaseClient,
  projectId: string,
  organizationId: string,
  reportId?: string | null,
): Promise<OperationSnapshot> {
  const [templateResult, libraryResult, inspectionResult, findingResult, findingProgressResult, hseResult, registerResult, boqProgressResult, fileResult, settingsResult, backupResult, locationResult, readinessResult, visualCaptureResult, visualAnnotationResult, drawingPinResult, drawingMarkupResult, mediaFolderResult, externalShareResult, dayReportResult, fileLinkResult, dailyWorkResult] = await Promise.all([
    client.from("checklist_templates").select("id,project_id,module,code,name,description,version_number,status").or(`project_id.is.null,project_id.eq.${projectId}`).order("name"),
    client.from("checklist_library_templates").select("code,module,category,name,description,prompts,sort_order").eq("active", true).order("sort_order"),
    client.from("inspections").select("id,building_id,location_node_id,template_id,inspection_number,title,status,planned_at,started_at,completed_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(100),
    client.from("findings").select("id,building_id,location_node_id,finding_number,finding_type,title,description,severity,priority,status,responsible_party_id,assigned_user_id,due_at,cause,proposed_correction,final_measure,issue_management,verified_at,created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(100),
    client.from("finding_progress_updates").select("id,finding_id,progress_percent,disposition,note,inspected_at,created_at").eq("project_id", projectId).order("inspected_at", { ascending: false }).limit(1000),
    client.from("hse_events").select("id,building_id,location_node_id,event_number,event_type,title,description,severity,status,confidential,immediate_measure,occurred_at").eq("project_id", projectId).order("occurred_at", { ascending: false }).limit(100),
    client.from("project_register_entries").select("id,building_id,location_node_id,register_type,entry_number,title,status,occurred_at,due_at,details").eq("project_id", projectId).order("occurred_at", { ascending: false }).limit(5000),
    client.from("boq_progress_updates").select("id,register_entry_id,building_id,progress_percent,quantity_completed,note,recorded_at,created_at").eq("project_id", projectId).order("recorded_at", { ascending: false }).limit(5000),
    client.from("files").select("id,building_id,folder_id,original_name,mime_type,size_bytes,category,status,created_at").eq("project_id", projectId).neq("status", "deleted").order("created_at", { ascending: false }).limit(500),
    client.from("project_settings").select("id,project_id,report_prefix,default_language,max_file_size_mb,notification_lead_hours,email_notifications_enabled,push_notifications_enabled,retention_days,branding,modules,signing_workflow,configuration_status,default_shift_start,default_shift_end,disciplines,finding_deadlines,report_sections,default_units,required_location_depth,report_header,report_footer").eq("project_id", projectId).maybeSingle(),
    client.from("backup_runs").select("id,run_type,status,schema_version,size_bytes,sha256,verified_at,created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(25),
    client.from("location_nodes").select("id,building_id,parent_id,node_type,code,name,description,status").eq("project_id", projectId).order("sort_order").limit(500),
    client.from("production_readiness_items").select("id,code,category,title,description,owner_hint,blocking,status,evidence,completed_at,sort_order").eq("organization_id", organizationId).order("sort_order"),
    client.from("visual_captures").select("id,building_id,file_id,location_node_id,day_report_id,capture_type,title,description,location_label,tour_name,tour_order,captured_at,status,created_at").eq("project_id", projectId).order("captured_at", { ascending: false }).limit(250),
    client.from("visual_annotations").select("id,capture_id,finding_id,coordinate_mode,x_ratio,y_ratio,yaw,pitch,title,description,severity,disposition,status,created_at").eq("project_id", projectId).order("created_at").limit(1000),
    client.from("drawing_pins").select("id,drawing_file_id,page_number,x_ratio,y_ratio,linked_record_type,linked_record_id,linked_record_number,linked_record_title,note,status,created_at").eq("project_id", projectId).order("created_at").limit(2000),
    client.from("drawing_markups").select("id,drawing_file_id,page_number,markup_type,geometry,color,stroke_width,text_content,status,created_at").eq("project_id", projectId).order("created_at").limit(5000),
    client.from("media_folders").select("id,building_id,parent_id,name,folder_type,status,created_at").eq("project_id", projectId).eq("status", "active").order("name").limit(500),
    client.from("external_share_links").select("id,organization_id,project_id,building_id,source_type,source_id,source_number,title,summary,source_file_id,expires_at,revoked_at,view_count,last_viewed_at,created_by,created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(500),
    client.from("day_reports").select("id,report_date,report_number,status,completeness_percent,created_at,updated_at").eq("project_id", projectId).order("report_date", { ascending: false }).limit(1000),
    client.from("file_links").select("id,file_id,record_type,record_id,relationship,created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(5000),
    client.from("day_closeouts").select("id,building_id,day_report_id,day_summary,work_ongoing,work_performed,progress_percent,delay_cause,delay_hours,tomorrow_plan,created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(400),
  ]);
  const compatibleRegisterResult = schemaFeatureMissing(registerResult.error, "location_node_id")
    ? await client.from("project_register_entries").select("id,building_id,register_type,entry_number,title,status,occurred_at,due_at,details").eq("project_id", projectId).order("occurred_at", { ascending: false }).limit(5000)
    : registerResult;
  const compatibleBoqProgressResult = schemaFeatureMissing(boqProgressResult.error, "boq_progress_updates")
    ? { data: [], error: null }
    : boqProgressResult;
  // File links only enrich the UI. A snapshot must still load when a role cannot read them.
  const compatibleFileLinkResult = fileLinkResult.error ? { data: [], error: null } : fileLinkResult;
  // Daily work only enriches the workspace; a missing column must not break the snapshot.
  const compatibleDailyWorkResult = dailyWorkResult.error ? { data: [], error: null } : dailyWorkResult;
  const compatibleVisualAnnotationResult = schemaFeatureMissing(visualAnnotationResult.error, "disposition")
    ? await client.from("visual_annotations").select("id,capture_id,finding_id,coordinate_mode,x_ratio,y_ratio,yaw,pitch,title,description,severity,status,created_at").eq("project_id", projectId).order("created_at").limit(1000)
    : visualAnnotationResult;
  const legacySettingsSchema = schemaFeatureMissing(settingsResult.error, "project_settings");
  const compatibleSettingsResult = legacySettingsSchema
    ? await client.from("project_settings").select("id,project_id,report_prefix,default_language,max_file_size_mb,notification_lead_hours,email_notifications_enabled,push_notifications_enabled,retention_days,branding,modules,signing_workflow").eq("project_id", projectId).maybeSingle()
    : settingsResult;
  [templateResult, libraryResult, inspectionResult, findingResult, findingProgressResult, hseResult, compatibleRegisterResult, compatibleBoqProgressResult, fileResult, compatibleSettingsResult, backupResult, locationResult, readinessResult, visualCaptureResult, compatibleVisualAnnotationResult, drawingPinResult, drawingMarkupResult, mediaFolderResult, externalShareResult, dayReportResult].forEach((result) => fail(result.error));
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
    checklistLibrary: [
      ...((libraryResult.data ?? []) as ChecklistLibraryTemplate[]),
      ...anchorChecklistLibrary
        .filter((builtIn) => !(libraryResult.data ?? []).some((row) => row.code === builtIn.code))
        .map((builtIn) => ({ ...builtIn, prompts: [...builtIn.prompts] })),
    ].sort((left, right) => left.sort_order - right.sort_order),
    inspections: (inspectionResult.data ?? []) as Inspection[],
    findings: (findingResult.data ?? []) as Finding[],
    findingProgressUpdates: (findingProgressResult.data ?? []) as FindingProgressUpdate[],
    hseEvents: (hseResult.data ?? []) as HseEvent[],
    registerEntries: (compatibleRegisterResult.data ?? []).map((entry) => ({
      ...entry,
      location_node_id: "location_node_id" in entry
        ? entry.location_node_id
        : typeof entry.details === "object" && entry.details && "location_node_id" in entry.details
          ? String(entry.details.location_node_id || "") || null
          : null,
    })) as RegisterEntry[],
    boqProgressUpdates: (compatibleBoqProgressResult.data ?? []) as BoqProgressUpdate[],
    files: (fileResult.data ?? []) as FileRecord[],
    settings: compatibleSettingsResult.data ? {
      configuration_status: "setup",
      default_shift_start: "07:00",
      default_shift_end: "16:00",
      disciplines: ["Carpenters", "Electricians", "HVAC", "Painters", "Facade", "Rebar / concrete workers", "Tiler", "Sanitary", "General"],
      finding_deadlines: { low: 14, medium: 7, high: 3, critical: 1 },
      report_sections: ["management", "workforce", "work", "logistics", "quality", "hse", "documents", "visual", "boq"],
      default_units: { length: "m", area: "m2", volume: "m3", weight: "kg", temperature: "C" },
      required_location_depth: "building",
      report_header: null,
      report_footer: null,
      ...compatibleSettingsResult.data,
      ...(legacySettingsSchema ? legacySettingsCompatibility(compatibleSettingsResult.data.branding) : {}),
    } as ProjectSettings : null,
    backupRuns: (backupResult.data ?? []) as BackupRun[],
    reportVersions: (reportFilters[0]?.data ?? []) as ReportVersion[],
    reportReviews: (reportFilters[1]?.data ?? []) as ReportReview[],
    reportSignatures: (reportFilters[2]?.data ?? []) as ReportSignature[],
    reportDistributions: (reportFilters[3]?.data ?? []) as ReportDistribution[],
    dayReports: (dayReportResult.data ?? []) as DayReportSummary[],
    locationNodes: (locationResult.data ?? []) as LocationNode[],
    productionReadiness: (readinessResult.data ?? []) as ProductionReadinessItem[],
    visualCaptures: (visualCaptureResult.data ?? []) as VisualCapture[],
    visualAnnotations: (compatibleVisualAnnotationResult.data ?? []) as VisualAnnotation[],
    drawingPins: (drawingPinResult.data ?? []) as DrawingPin[],
    drawingMarkups: (drawingMarkupResult.data ?? []) as DrawingMarkup[],
    mediaFolders: (mediaFolderResult.data ?? []) as MediaFolder[],
    externalShareLinks: (externalShareResult.data ?? []) as ExternalShareLink[],
    fileLinks: (compatibleFileLinkResult.data ?? []) as FileLink[],
    dailyWork: (compatibleDailyWorkResult.data ?? []) as DailyWorkRecord[],
  };
}

export async function createMediaFolder(client: SupabaseClient, input: {
  projectId: string;
  buildingId?: string | null;
  parentId?: string | null;
  name: string;
  folderType?: MediaFolder["folder_type"];
}) {
  const result = await client.rpc("create_media_folder", {
    p_project_id: input.projectId,
    p_building_id: input.buildingId || null,
    p_parent_id: input.parentId || null,
    p_name: input.name,
    p_folder_type: input.folderType ?? "images",
  });
  fail(result.error);
  return result.data as MediaFolder;
}

export async function createExternalShareLink(client: SupabaseClient, projectId: string, sourceType: "finding" | "action" | "inspection" | "visual", sourceId: string) {
  const result = await client.rpc("create_external_share_link", {
    p_project_id: projectId,
    p_source_type: sourceType,
    p_source_id: sourceId,
    p_expires_days: 14,
  });
  fail(result.error);
  const data = result.data as { share_id?: string; token?: string; expires_at?: string } | null;
  const token = normalizeExternalShareToken(data?.token);
  if (!data?.share_id || !data.expires_at || !token) {
    throw new Error("De database heeft geen geldige externe toegangscode aangemaakt. Probeer opnieuw.");
  }
  return { share_id: data.share_id, token, expires_at: data.expires_at };
}

export async function revokeExternalShareLink(client: SupabaseClient, shareId: string): Promise<RevokeExternalShareResult> {
  const result = await client.rpc("revoke_external_share_link", {
    p_share_id: shareId,
  });
  if (rpcSignatureMissing(result.error, "revoke_external_share_link")) {
    const current = await client.from("external_share_links").select("id,revoked_at").eq("id", shareId).single();
    fail(current.error);
    if (!current.data) throw new Error("De externe link bestaat niet meer.");
    if (current.data.revoked_at) {
      return { share_id: current.data.id, revoked_at: current.data.revoked_at, already_revoked: true };
    }
    const revokedAt = new Date().toISOString();
    const fallback = await client.from("external_share_links")
      .update({ revoked_at: revokedAt })
      .eq("id", shareId)
      .select("id,revoked_at")
      .single();
    fail(fallback.error);
    if (!fallback.data?.revoked_at) throw new Error("De externe link kon niet worden ingetrokken.");
    return { share_id: fallback.data.id, revoked_at: fallback.data.revoked_at, already_revoked: false };
  }
  fail(result.error);
  const data = result.data as Partial<RevokeExternalShareResult> | null;
  if (!data?.share_id || !data.revoked_at || typeof data.already_revoked !== "boolean") {
    throw new Error("De externe link kon niet veilig worden ingetrokken. Probeer opnieuw.");
  }
  return data as RevokeExternalShareResult;
}

export async function startInspection(client: SupabaseClient, input: { projectId: string; buildingId: string; locationNodeId?: string; reportId?: string | null; templateId: string; title: string }) {
  const reportId = await ensureProjectDayReport(client, input.projectId, input.reportId);
  let result = await client.rpc("start_project_inspection", {
    p_project_id: input.projectId,
    p_building_id: input.buildingId,
    p_day_report_id: reportId,
    p_template_id: input.templateId,
    p_title: input.title,
    p_idempotency_key: `inspection:${crypto.randomUUID()}`,
    p_location_node_id: input.locationNodeId || null,
  });
  if (rpcSignatureMissing(result.error, "start_project_inspection")) {
    result = await client.rpc("start_project_inspection", {
      p_project_id: input.projectId,
      p_building_id: input.buildingId,
      p_day_report_id: reportId,
      p_template_id: input.templateId,
      p_title: input.title,
      p_idempotency_key: `inspection:${crypto.randomUUID()}`,
    });
  }
  fail(result.error);
  return { ...(result.data as Inspection), location_node_id: (result.data as Inspection).location_node_id ?? input.locationNodeId ?? null };
}

/**
 * The answers already stored for one inspection, so a checklist that was left open can be
 * continued instead of started over. Returns an empty map when nothing was saved yet.
 */
export async function loadInspectionResponses(client: SupabaseClient, inspectionId: string) {
  const result = await client
    .from("inspection_responses")
    .select("checklist_item_id,result,numeric_value,text_value,notes")
    .eq("inspection_id", inspectionId)
    .limit(500);
  fail(result.error);
  const rows = (result.data ?? []) as Array<{
    checklist_item_id: string;
    result: string;
    numeric_value: number | null;
    text_value: string | null;
    notes: string | null;
  }>;
  return Object.fromEntries(rows.map((row) => [row.checklist_item_id, {
    result: row.result,
    notes: row.notes ?? "",
    numericValue: row.numeric_value ?? undefined,
    textValue: row.text_value ?? undefined,
  }]));
}

export async function finishInspection(
  client: SupabaseClient,
  inspection: Inspection,
  answers: Record<string, { result: string; notes: string; numericValue?: number; textValue?: string }>,
) {
  for (const [itemId, answer] of Object.entries(answers)) {
    const saved = await client.rpc("save_inspection_response", {
      p_inspection_id: inspection.id,
      p_checklist_item_id: itemId,
      p_result: answer.result,
      p_numeric_value: answer.result === "value" ? answer.numericValue ?? null : null,
      p_text_value: answer.result === "text" ? answer.textValue?.trim() || null : null,
      p_notes: answer.notes,
      p_idempotency_key: `inspection-response:${inspection.id}:${itemId}`,
    });
    fail(saved.error);
  }
  const completed = await client.rpc("complete_project_inspection", { p_inspection_id: inspection.id });
  fail(completed.error);
  return completed.data as Inspection;
}

export async function createFinding(client: SupabaseClient, input: {
  projectId: string;
  buildingId: string;
  reportId?: string | null;
  type: string;
  title: string;
  description: string;
  severity: string;
  responsiblePartyId?: string;
  issueType?: string;
  impactSummary?: string;
  actionSteps?: string;
  escalationRequired?: boolean;
  disposition?: "validated" | "to_be_corrected" | "alternative_solution";
  expectedResolutionDate?: string;
  sourceCatalogSubject?: string;
  locationNodeId?: string;
  idempotencyKey?: string;
}) {
  const reportId = await ensureProjectDayReport(client, input.projectId, input.reportId);
  const result = await client.rpc("create_project_finding", {
    p_project_id: input.projectId,
    p_building_id: input.buildingId,
    p_day_report_id: reportId,
    p_inspection_id: null,
    p_inspection_response_id: null,
    p_finding_type: input.type,
    p_title: input.title,
    p_description: input.description,
    p_severity: input.severity,
    p_responsible_party_id: input.responsiblePartyId || null,
    p_assigned_user_id: null,
    p_idempotency_key: input.idempotencyKey ?? `finding:${crypto.randomUUID()}`,
    p_issue_management: {
      issue_type: input.issueType || "quality",
      impact_summary: input.impactSummary?.trim() || "",
      action_steps: input.actionSteps?.trim() || "",
      escalation_required: Boolean(input.escalationRequired),
      disposition: input.disposition || "to_be_corrected",
      expected_resolution_date: input.expectedResolutionDate || null,
      source_catalog_subject: input.sourceCatalogSubject || null,
      location_node_id: input.locationNodeId || null,
    },
  });
  fail(result.error);
  return result.data as Finding;
}

export async function linkFileToRecord(
  client: SupabaseClient,
  input: {
    organizationId: string;
    projectId: string;
    fileId: string;
    recordType: "finding" | "action" | "inspection" | "hse" | "registration" | "register_entry";
    recordId: string;
    relationship?: "attachment" | "before" | "after" | "evidence";
  },
) {
  const userResult = await client.auth.getUser();
  fail(userResult.error);
  if (!userResult.data.user) throw new Error("Je sessie is verlopen.");
  const result = await client.from("file_links").upsert({
    organization_id: input.organizationId,
    project_id: input.projectId,
    file_id: input.fileId,
    record_type: input.recordType,
    record_id: input.recordId,
    relationship: input.relationship ?? "attachment",
    created_by: userResult.data.user.id,
  }, { onConflict: "file_id,record_type,record_id,relationship", ignoreDuplicates: true });
  fail(result.error);
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

export async function createHseEvent(client: SupabaseClient, input: { projectId: string; buildingId: string; locationNodeId?: string; reportId?: string | null; type: string; title: string; description: string; severity: string; immediateMeasure: string; confidential: boolean }) {
  const reportId = await ensureProjectDayReport(client, input.projectId, input.reportId);
  let result = await client.rpc("create_project_hse_event", {
    p_project_id: input.projectId,
    p_building_id: input.buildingId,
    p_day_report_id: reportId,
    p_event_type: input.type,
    p_title: input.title,
    p_description: input.description,
    p_severity: input.severity,
    p_immediate_measure: input.immediateMeasure,
    p_confidential: input.confidential,
    p_occurred_at: new Date().toISOString(),
    p_idempotency_key: `hse:${crypto.randomUUID()}`,
    p_location_node_id: input.locationNodeId || null,
  });
  if (rpcSignatureMissing(result.error, "create_project_hse_event")) {
    result = await client.rpc("create_project_hse_event", {
      p_project_id: input.projectId,
      p_building_id: input.buildingId,
      p_day_report_id: reportId,
      p_event_type: input.type,
      p_title: input.title,
      p_description: input.description,
      p_severity: input.severity,
      p_immediate_measure: input.immediateMeasure,
      p_confidential: input.confidential,
      p_occurred_at: new Date().toISOString(),
      p_idempotency_key: `hse:${crypto.randomUUID()}`,
    });
  }
  fail(result.error);
  return { ...(result.data as HseEvent), location_node_id: (result.data as HseEvent).location_node_id ?? input.locationNodeId ?? null };
}

export async function createRegisterEntry(client: SupabaseClient, input: { projectId: string; buildingId: string | null; locationNodeId?: string; reportId?: string | null; type: string; title: string; responsiblePartyId?: string; dueAt?: string | null; details: Record<string, unknown> }) {
  const reportId = await ensureProjectDayReport(client, input.projectId, input.reportId);
  const result = await client.rpc("create_project_register_entry", {
    p_project_id: input.projectId,
    p_building_id: input.buildingId || null,
    p_day_report_id: reportId,
    p_register_type: input.type,
    p_title: input.title,
    p_occurred_at: new Date().toISOString(),
    p_due_at: input.dueAt ? `${input.dueAt}T23:59:59-03:00` : null,
    p_responsible_party_id: input.responsiblePartyId || null,
    p_details: { ...input.details, location_node_id: input.locationNodeId || null },
    p_idempotency_key: `register:${crypto.randomUUID()}`,
  });
  fail(result.error);
  return result.data as RegisterEntry;
}

export async function respondToControlledDocument(client: SupabaseClient, entryId: string, response: {
  decision: string;
  comments: string;
  respondentName: string;
  respondentPosition: string;
  respondentCompany: string;
}) {
  const result = await client.rpc("respond_to_controlled_project_document", {
    p_entry_id: entryId,
    p_response: {
      decision: response.decision,
      comments: response.comments.trim(),
      respondent_name: response.respondentName.trim(),
      respondent_position: response.respondentPosition.trim(),
      respondent_company: response.respondentCompany.trim(),
      response_date: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Paramaribo" }).format(new Date()),
    },
    p_idempotency_key: `controlled-response:${crypto.randomUUID()}`,
  });
  fail(result.error);
  return result.data as RegisterEntry;
}

export async function recordFindingProgress(client: SupabaseClient, input: {
  findingId: string;
  progressPercent: number;
  disposition: "validated" | "to_be_corrected" | "alternative_solution";
  note: string;
}) {
  const result = await client.rpc("record_finding_progress", {
    p_finding_id: input.findingId,
    p_progress_percent: input.progressPercent,
    p_disposition: input.disposition,
    p_note: input.note.trim(),
    p_inspected_at: new Date().toISOString(),
    p_idempotency_key: `finding-progress:${crypto.randomUUID()}`,
  });
  fail(result.error);
  return result.data as FindingProgressUpdate;
}

export async function importProjectBoq(client: SupabaseClient, input: {
  projectId: string;
  buildingId: string;
  reportId?: string | null;
  items: Array<Record<string, unknown>>;
}) {
  const reportId = await ensureProjectDayReport(client, input.projectId, input.reportId);
  const result = await client.rpc("import_project_boq", {
    p_project_id: input.projectId,
    p_building_id: input.buildingId,
    p_day_report_id: reportId,
    p_items: input.items,
    p_idempotency_key: `boq-import:${crypto.randomUUID()}`,
  });
  fail(result.error);
  return Number(result.data ?? 0);
}

export async function recordBoqProgress(client: SupabaseClient, input: {
  registerEntryId: string;
  progressPercent: number;
  quantityCompleted?: number | null;
  note: string;
  recordedAt?: string;
}) {
  const result = await client.rpc("record_boq_progress", {
    p_register_entry_id: input.registerEntryId,
    p_progress_percent: input.progressPercent,
    p_quantity_completed: input.quantityCompleted ?? null,
    p_note: input.note.trim(),
    p_recorded_at: input.recordedAt || new Date().toISOString(),
  });
  if (!result.error) return result.data as BoqProgressUpdate;
  if (!rpcSignatureMissing(result.error, "record_boq_progress")) fail(result.error);

  const entryResult = await client.from("project_register_entries")
    .select("id,project_id,building_id,details")
    .eq("id", input.registerEntryId)
    .eq("register_type", "boq")
    .single();
  fail(entryResult.error);
  if (!entryResult.data) throw new Error("BOQ line not found.");
  const recordedAt = input.recordedAt || new Date().toISOString();
  const details = entryResult.data.details && typeof entryResult.data.details === "object"
    ? entryResult.data.details as Record<string, unknown>
    : {};
  const updateResult = await client.from("project_register_entries").update({
    details: {
      ...details,
      progress_percent: input.progressPercent,
      quantity_completed: input.quantityCompleted ?? null,
      progress_updated_at: recordedAt,
      progress_note: input.note.trim(),
    },
  }).eq("id", input.registerEntryId);
  fail(updateResult.error);
  return {
    id: `legacy-${input.registerEntryId}-${recordedAt}`,
    register_entry_id: input.registerEntryId,
    building_id: entryResult.data.building_id,
    progress_percent: input.progressPercent,
    quantity_completed: input.quantityCompleted ?? null,
    note: input.note.trim(),
    recorded_at: recordedAt,
    created_at: recordedAt,
  };
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

export async function installChecklistLibraryTemplate(client: SupabaseClient, projectId: string, libraryCode: string) {
  const result = await client.rpc("install_checklist_library_template", {
    p_project_id: projectId,
    p_library_code: libraryCode,
  });
  if (!result.error) return result.data as ChecklistTemplate;

  const legacyPrompts = legacyAnchorPrompts(libraryCode);
  if (!legacyPrompts) {
    fail(result.error);
  }
  const builtIn = anchorChecklistLibrary.find((item) => item.code === libraryCode);
  if (!builtIn || !legacyPrompts) {
    throw new Error(result.error.message);
  }
  const fallback = await client.rpc("create_project_checklist", {
    p_project_id: projectId,
    p_module: builtIn.module,
    p_code: builtIn.code,
    p_name: builtIn.name,
    p_prompts: legacyPrompts,
  });
  fail(fallback.error);
  return fallback.data as ChecklistTemplate;
}

export async function saveProjectSettings(client: SupabaseClient, settings: ProjectSettings, update: Partial<ProjectSettings>) {
  const result = await client.from("project_settings").update(update).eq("id", settings.id).select("*").single();
  if (!result.error) return result.data as ProjectSettings;
  if (!schemaFeatureMissing(result.error, "project_settings")) fail(result.error);

  const legacyKeys: Array<keyof ProjectSettings> = [
    "report_prefix",
    "default_language",
    "max_file_size_mb",
    "notification_lead_hours",
    "email_notifications_enabled",
    "push_notifications_enabled",
    "retention_days",
    "modules",
    "signing_workflow",
  ];
  const legacyUpdate: Record<string, unknown> = {};
  legacyKeys.forEach((key) => {
    if (key in update) legacyUpdate[key] = update[key];
  });
  const compatibility = {
    ...legacySettingsCompatibility(settings.branding),
    ...update,
  };
  delete compatibility.branding;
  legacyUpdate.branding = {
    ...settings.branding,
    ...(update.branding ?? {}),
    client_configuration_compatibility: compatibility,
  };

  const legacyResult = await client.from("project_settings")
    .update(legacyUpdate)
    .eq("id", settings.id)
    .select("id,project_id,report_prefix,default_language,max_file_size_mb,notification_lead_hours,email_notifications_enabled,push_notifications_enabled,retention_days,branding,modules,signing_workflow")
    .single();
  fail(legacyResult.error);
  return {
    ...settings,
    ...update,
    ...legacyResult.data,
  } as ProjectSettings;
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

export async function createVisualCapture(client: SupabaseClient, input: {
  projectId: string;
  buildingId: string;
  locationNodeId?: string;
  dayReportId?: string | null;
  fileId: string;
  captureType: VisualCapture["capture_type"];
  title: string;
  description?: string;
  locationLabel: string;
  tourName?: string;
  tourOrder?: number | null;
  capturedAt?: string;
}) {
  const result = await client.rpc("create_visual_capture", {
    p_project_id: input.projectId,
    p_building_id: input.buildingId,
    p_location_node_id: input.locationNodeId || null,
    p_day_report_id: input.dayReportId || null,
    p_file_id: input.fileId,
    p_capture_type: input.captureType,
    p_title: input.title,
    p_description: input.description || null,
    p_location_label: input.locationLabel,
    p_tour_name: input.tourName || null,
    p_tour_order: input.tourOrder ?? null,
    p_captured_at: input.capturedAt || new Date().toISOString(),
  });
  fail(result.error);
  return result.data as VisualCapture;
}

export async function createVisualAnnotationFinding(client: SupabaseClient, input: {
  captureId: string;
  coordinateMode: VisualAnnotation["coordinate_mode"];
  xRatio?: number | null;
  yRatio?: number | null;
  yaw?: number | null;
  pitch?: number | null;
  findingType: Finding["finding_type"];
  title: string;
  description: string;
  severity: Finding["severity"];
  responsiblePartyId?: string;
  /** Building the marker belongs to; may differ from the building the photo was filed under. */
  buildingId?: string;
  disposition?: "validated" | "to_be_corrected" | "alternative_solution";
}) {
  const result = await client.rpc("create_visual_annotation_finding", {
    p_capture_id: input.captureId,
    p_coordinate_mode: input.coordinateMode,
    p_x_ratio: input.xRatio ?? null,
    p_y_ratio: input.yRatio ?? null,
    p_yaw: input.yaw ?? null,
    p_pitch: input.pitch ?? null,
    p_finding_type: input.findingType,
    p_title: input.title,
    p_description: input.description,
    p_severity: input.severity,
    p_responsible_party_id: input.responsiblePartyId || null,
    p_idempotency_key: `visual-annotation:${crypto.randomUUID()}`,
    p_building_id: input.buildingId || null,
    p_disposition: input.disposition || "to_be_corrected",
  });
  fail(result.error);
  return result.data as VisualAnnotation;
}

export async function linkVisualAnnotationToFinding(client: SupabaseClient, input: {
  captureId: string;
  findingId: string;
  coordinateMode: VisualAnnotation["coordinate_mode"];
  xRatio?: number | null;
  yRatio?: number | null;
  yaw?: number | null;
  pitch?: number | null;
  description: string;
}) {
  const result = await client.rpc("create_visual_annotation_for_finding", {
    p_capture_id: input.captureId,
    p_finding_id: input.findingId,
    p_coordinate_mode: input.coordinateMode,
    p_x_ratio: input.xRatio ?? null,
    p_y_ratio: input.yRatio ?? null,
    p_yaw: input.yaw ?? null,
    p_pitch: input.pitch ?? null,
    p_description: input.description,
    p_idempotency_key: `visual-existing-finding:${crypto.randomUUID()}`,
  });
  fail(result.error);
  return result.data as VisualAnnotation;
}

export async function createDrawingPin(client: SupabaseClient, input: {
  drawingFileId: string;
  pageNumber: number;
  xRatio: number;
  yRatio: number;
  linkedRecordType: DrawingPin["linked_record_type"];
  linkedRecordId: string;
  note?: string;
}) {
  const result = await client.rpc("create_drawing_pin", {
    p_drawing_file_id: input.drawingFileId,
    p_page_number: input.pageNumber,
    p_x_ratio: input.xRatio,
    p_y_ratio: input.yRatio,
    p_linked_record_type: input.linkedRecordType,
    p_linked_record_id: input.linkedRecordId,
    p_note: input.note || null,
    p_idempotency_key: `drawing-pin:${crypto.randomUUID()}`,
  });
  fail(result.error);
  return result.data as DrawingPin;
}

export async function createDrawingMarkup(client: SupabaseClient, input: {
  drawingFileId: string;
  pageNumber: number;
  markupType: DrawingMarkup["markup_type"];
  geometry: DrawingMarkup["geometry"];
  color: string;
  strokeWidth: number;
  textContent?: string;
}) {
  const result = await client.rpc("create_drawing_markup", {
    p_drawing_file_id: input.drawingFileId,
    p_page_number: input.pageNumber,
    p_markup_type: input.markupType,
    p_geometry: input.geometry,
    p_color: input.color,
    p_stroke_width: input.strokeWidth,
    p_text_content: input.textContent || null,
    p_idempotency_key: `drawing-markup:${crypto.randomUUID()}`,
  });
  fail(result.error);
  return result.data as DrawingMarkup;
}

export async function voidDrawingMarkup(client: SupabaseClient, markupId: string, reason: string) {
  const result = await client.rpc("void_drawing_markup", {
    p_markup_id: markupId,
    p_reason: reason,
  });
  fail(result.error);
  return result.data as DrawingMarkup;
}

export async function buildPeriodReportSnapshot(
  client: SupabaseClient,
  projectId: string,
  startDate: string,
  endDate: string,
) {
  let result = await client.rpc("build_client_period_report_snapshot", {
    p_project_id: projectId,
    p_start_date: startDate,
    p_end_date: endDate,
  });
  if (rpcSignatureMissing(result.error, "build_client_period_report_snapshot")) {
    result = await client.rpc("build_period_report_snapshot", {
      p_project_id: projectId,
      p_start_date: startDate,
      p_end_date: endDate,
    });
  }
  fail(result.error);
  return result.data as PeriodReportSnapshot;
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
