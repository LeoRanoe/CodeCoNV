import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import {
  getProjectStartAutomation,
  type DailyCloseoutAnswers,
  type ProjectStartAnswers,
} from "@/lib/forms/daily-report";
import type { InternalUserInviteAnswers } from "@/lib/forms/users";
import { validAccessToken } from "@/lib/supabase/access-token";

export type WorkspaceBuilding = {
  id: string;
  name: string;
  description: string;
  progress: number;
  openIssues: number;
  issueCount: number;
  ncrCount: number;
  inspectionCount: number;
  technicalInstructionCount: number;
  changeOrderCount: number;
  agreementCount: number;
  photoCount: number;
  todayPlannedWork: string[];
};

export type WorkspaceProject = {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  location: string;
  client: string;
  progress: number;
  openIssues: number;
  issueCount: number;
  ncrCount: number;
  inspectionCount: number;
  technicalInstructionCount: number;
  changeOrderCount: number;
  agreementCount: number;
  buildings: WorkspaceBuilding[];
};

export type WorkspaceOrganization = {
  id: string;
  name: string;
  slug: string;
};

export type WorkspaceSnapshot = {
  user: User;
  profileName: string;
  organizations: WorkspaceOrganization[];
  projects: WorkspaceProject[];
  canBootstrapOrganization: boolean;
  manageableOrganizationIds: string[];
  _offlineCached?: boolean;
  _offlineSavedAt?: string;
};

export type InternalRole = {
  id: string;
  code: string;
  name: string;
  scope: "organization" | "project";
};

export type InternalMember = {
  userId: string;
  email: string;
  displayName: string | null;
  membershipStatus: "invited" | "active" | "suspended" | "revoked";
  accessStatus: "invited" | "active";
  organizationRoles: Array<{ code: string; name: string }>;
  projectRoles: Array<{
    projectId: string;
    projectName: string;
    roleCode: string;
    roleName: string;
  }>;
};

export type InternalAccessSnapshot = {
  roles: InternalRole[];
  members: InternalMember[];
};

export type ProjectParty = {
  id: string;
  name: string;
  type: string;
};

export type ProjectAction = {
  id: string;
  action_number: string;
  title: string;
  description: string | null;
  due_at: string | null;
  priority: "low" | "normal" | "high" | "critical";
  status: "open" | "accepted" | "in_progress" | "ready_for_verification" | "verified" | "cancelled";
  building_id: string | null;
  location_node_id: string | null;
  owner_user_id: string | null;
  owner_party_id: string | null;
  closure_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type ActionUpdate = {
  id: string;
  action_id: string;
  update_type: "created" | "status" | "comment" | "evidence";
  message: string;
  from_status: string | null;
  to_status: string | null;
  created_by: string;
  created_at: string;
};

export type ProjectNotification = {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  source_type: string | null;
  source_id: string | null;
  due_at: string | null;
  read_at: string | null;
  email_status: "pending" | "sending" | "sent" | "failed" | "skipped";
  email_sent_at: string | null;
  push_status: "pending" | "sending" | "sent" | "failed" | "skipped";
  push_sent_at: string | null;
  created_at: string;
};

export type ProjectDaySnapshot = {
  report: Record<string, unknown> | null;
  startChecks: Array<Record<string, unknown>>;
  closeouts: Array<Record<string, unknown>>;
  registrations: Array<Record<string, unknown>>;
  attendance: Array<Record<string, unknown>>;
  parties: ProjectParty[];
  actions: ProjectAction[];
  actionUpdates: ActionUpdate[];
  _offlineCached?: boolean;
  _offlineSavedAt?: string;
};

export type NewBuilding = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
};

export type AttendanceInput = {
  partyId: string;
  discipline: string;
  count: number;
  shiftStart: string;
  shiftEnd: string;
};

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function schemaColumnMissing(error: { message: string } | null, column: string) {
  const message = error?.message.toLowerCase() ?? "";
  return message.includes(column.toLowerCase()) && message.includes("does not exist");
}

function rpcSignatureMissing(error: { message: string } | null, functionName: string) {
  const message = error?.message.toLowerCase() ?? "";
  return message.includes(functionName.toLowerCase())
    && (message.includes("schema cache") || message.includes("could not find the function"));
}

async function currentUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  fail(error);
  if (!data.user) throw new Error("Je sessie is verlopen. Meld je opnieuw aan.");
  return data.user;
}

export function reportDateInSuriname(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Paramaribo",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function surinameLocalDateTimeToIso(value: string) {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(normalized)) {
    throw new Error("Kies een geldige datum en tijd.");
  }
  const parsed = new Date(`${normalized}-03:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error("Kies een geldige datum en tijd.");
  return parsed.toISOString();
}

export async function loadWorkspace(client: SupabaseClient): Promise<WorkspaceSnapshot> {
  const user = await currentUser(client);
  const [membershipResult, bootstrapResult] = await Promise.all([
    client
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("status", "active"),
    client.rpc("can_bootstrap_organization"),
  ]);
  fail(membershipResult.error);
  fail(bootstrapResult.error);

  const organizationIds = Array.from(new Set((membershipResult.data ?? []).map((row) => row.organization_id as string)));
  if (organizationIds.length === 0) {
    return {
      user,
      profileName: String(user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? "Gebruiker"),
      organizations: [],
      projects: [],
      canBootstrapOrganization: Boolean(bootstrapResult.data),
      manageableOrganizationIds: [],
    };
  }

  const [organizationResult, profileResult, projectResult] = await Promise.all([
    client.from("organizations").select("id,name,slug").in("id", organizationIds).order("name"),
    client.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    client
      .from("projects")
      .select("id,organization_id,code,name,location,client_name,status")
      .in("organization_id", organizationIds)
      .in("status", ["draft", "active", "on_hold"])
      .order("name"),
  ]);
  fail(organizationResult.error);
  fail(profileResult.error);
  fail(projectResult.error);

  const manageResults = await Promise.all(
    organizationIds.map(async (organizationId) => {
      const result = await client.rpc("can_manage_organization_members", { p_organization_id: organizationId });
      fail(result.error);
      return result.data ? organizationId : null;
    }),
  );

  const projectRows = projectResult.data ?? [];
  const projectIds = projectRows.map((row) => row.id as string);
  const today = reportDateInSuriname();
  const todayStart = new Date(`${today}T00:00:00-03:00`).toISOString();
  const tomorrow = new Date(`${today}T00:00:00-03:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [buildingResult, actionResult, progressResult, findingResult, inspectionResult, registerResult, visualResult, dayStartResult] = projectIds.length
    ? await Promise.all([
        client
          .from("buildings")
          .select("id,project_id,name,description,status")
          .in("project_id", projectIds)
          .eq("status", "active")
          .order("name"),
        client
          .from("actions")
          .select("project_id,building_id,status")
          .in("project_id", projectIds)
          .in("status", ["open", "accepted", "in_progress", "ready_for_verification"]),
        client
          .from("day_closeouts")
          .select("project_id,building_id,progress_percent,created_at")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false }),
        client
          .from("findings")
          .select("project_id,building_id,finding_type,status")
          .in("project_id", projectIds)
          .in("status", ["draft", "open", "assigned", "in_progress", "ready_for_verification", "rejected", "reopened"]),
        client
          .from("inspections")
          .select("project_id,building_id,status")
          .in("project_id", projectIds)
          .neq("status", "cancelled"),
        client
          .from("project_register_entries")
          .select("project_id,building_id,register_type,status")
          .in("project_id", projectIds)
          .in("register_type", ["technical_instruction", "site_instruction", "change_order", "variation", "agreement"])
          .neq("status", "cancelled"),
        client
          .from("visual_captures")
          .select("project_id,building_id")
          .in("project_id", projectIds)
          .eq("status", "active"),
        client
          .from("day_start_checks")
          .select("project_id,building_id,planned_work,created_at")
          .in("project_id", projectIds)
          .gte("created_at", todayStart)
          .lt("created_at", tomorrow.toISOString()),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];
  fail(buildingResult.error);
  fail(actionResult.error);
  fail(progressResult.error);
  fail(findingResult.error);
  fail(inspectionResult.error);
  fail(registerResult.error);
  fail(visualResult.error);
  fail(dayStartResult.error);

  const progressByProject = new Map<string, number>();
  for (const row of progressResult.data ?? []) {
    const projectId = row.project_id as string;
    if (!progressByProject.has(projectId)) progressByProject.set(projectId, Number(row.progress_percent));
  }

  const projects: WorkspaceProject[] = projectRows.map((project) => {
    const projectId = project.id as string;
    const progress = progressByProject.get(projectId) ?? 0;
    const openIssues = (actionResult.data ?? []).filter((row) => row.project_id === projectId).length;
    const findings = (findingResult.data ?? []).filter((row) => row.project_id === projectId);
    const registers = (registerResult.data ?? []).filter((row) => row.project_id === projectId);
    return {
      id: projectId,
      organizationId: project.organization_id as string,
      name: String(project.name),
      code: String(project.code),
      location: String(project.location),
      client: String(project.client_name ?? "Niet ingesteld"),
      progress,
      openIssues,
      issueCount: findings.filter((row) => row.finding_type !== "ncr").length,
      ncrCount: findings.filter((row) => row.finding_type === "ncr").length,
      inspectionCount: (inspectionResult.data ?? []).filter((row) => row.project_id === projectId).length,
      technicalInstructionCount: registers.filter((row) => ["technical_instruction", "site_instruction"].includes(String(row.register_type))).length,
      changeOrderCount: registers.filter((row) => ["change_order", "variation"].includes(String(row.register_type))).length,
      agreementCount: registers.filter((row) => row.register_type === "agreement").length,
      buildings: (buildingResult.data ?? [])
        .filter((building) => building.project_id === projectId)
        .map((building) => {
          const buildingId = building.id as string;
          const buildingFindings = (findingResult.data ?? []).filter((row) => row.building_id === buildingId);
          const buildingRegisters = (registerResult.data ?? []).filter((row) => row.building_id === buildingId);
          const latestProgress = (progressResult.data ?? []).find((row) => row.building_id === buildingId);
          return {
            id: buildingId,
            name: String(building.name),
            description: String(building.description ?? "Projectgebouw"),
            progress: latestProgress ? Number(latestProgress.progress_percent) : progress,
            openIssues: (actionResult.data ?? []).filter((row) => row.building_id === buildingId).length,
            issueCount: buildingFindings.filter((row) => row.finding_type !== "ncr").length,
            ncrCount: buildingFindings.filter((row) => row.finding_type === "ncr").length,
            inspectionCount: (inspectionResult.data ?? []).filter((row) => row.building_id === buildingId).length,
            technicalInstructionCount: buildingRegisters.filter((row) => ["technical_instruction", "site_instruction"].includes(String(row.register_type))).length,
            changeOrderCount: buildingRegisters.filter((row) => ["change_order", "variation"].includes(String(row.register_type))).length,
            agreementCount: buildingRegisters.filter((row) => row.register_type === "agreement").length,
            photoCount: (visualResult.data ?? []).filter((row) => row.building_id === buildingId).length,
            todayPlannedWork: (dayStartResult.data ?? []).filter((row) => row.building_id === buildingId).map((row) => String(row.planned_work)),
          };
        }),
    };
  });

  return {
    user,
    profileName: String(profileResult.data?.display_name ?? user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? "Gebruiker"),
    organizations: (organizationResult.data ?? []).map((organization) => ({
      id: organization.id as string,
      name: String(organization.name),
      slug: String(organization.slug),
    })),
    projects,
    canBootstrapOrganization: Boolean(bootstrapResult.data),
    manageableOrganizationIds: manageResults.filter((organizationId): organizationId is string => Boolean(organizationId)),
  };
}

export async function loadInternalAccess(
  client: SupabaseClient,
  organizationId: string,
): Promise<InternalAccessSnapshot> {
  const result = await client.rpc("list_internal_access", { p_organization_id: organizationId });
  fail(result.error);
  const data = result.data as Partial<InternalAccessSnapshot> | null;
  return {
    roles: Array.isArray(data?.roles) ? data.roles : [],
    members: Array.isArray(data?.members) ? data.members : [],
  };
}

export async function setInternalUserAccessStatus(
  client: SupabaseClient,
  organizationId: string,
  userId: string,
  nextStatus: "active" | "suspended" | "revoked",
  reason: string,
) {
  const result = await client.rpc("set_internal_user_access_status", {
    p_organization_id: organizationId,
    p_user_id: userId,
    p_next_status: nextStatus,
    p_reason: reason,
  });
  fail(result.error);
  return result.data;
}

export async function setUserProjectRole(
  client: SupabaseClient,
  input: { organizationId: string; userId: string; projectId: string; roleCode: string; reason: string },
) {
  const result = await client.rpc("set_user_project_role", {
    p_organization_id: input.organizationId,
    p_user_id: input.userId,
    p_project_id: input.projectId,
    p_role_code: input.roleCode,
    p_reason: input.reason,
  });
  if (rpcSignatureMissing(result.error, "set_user_project_role")) {
    const response = await fetch("/api/admin/project-role", {
      method: "POST",
      headers: {
        authorization: `Bearer ${await validAccessToken(client)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    });
    const body = await response.json().catch(() => null) as { error?: string; result?: unknown } | null;
    if (!response.ok) throw new Error(body?.error ?? "De projectrechten konden niet worden aangepast.");
    return body?.result;
  }
  fail(result.error);
  return result.data;
}

export async function inviteInternalUser(
  client: SupabaseClient,
  input: InternalUserInviteAnswers,
) {
  const accessToken = await validAccessToken(client);
  const response = await fetch("/api/admin/users", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => null) as { error?: string; invitation?: unknown } | null;
  if (!response.ok) throw new Error(data?.error ?? "De uitnodiging kon niet worden verzonden.");
  return data?.invitation;
}

export async function loadProjectDay(
  client: SupabaseClient,
  projectId: string,
  reportDate = reportDateInSuriname(),
): Promise<ProjectDaySnapshot> {
  const [reportResult, partyResult, actionResult] = await Promise.all([
    client
      .from("day_reports")
      .select("id,organization_id,project_id,report_date,report_number,status,completeness_percent,created_at,updated_at")
      .eq("project_id", projectId)
      .eq("report_date", reportDate)
      .maybeSingle(),
    client.from("parties").select("id,name,party_type").eq("project_id", projectId).eq("active", true).order("name"),
    client
      .from("actions")
      .select("id,action_number,title,description,due_at,priority,status,building_id,location_node_id,owner_user_id,owner_party_id,closure_reason,created_at,updated_at")
      .eq("project_id", projectId)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(50),
  ]);
  const compatibleActionResult = schemaColumnMissing(actionResult.error, "location_node_id")
    ? await client
        .from("actions")
        .select("id,action_number,title,description,due_at,priority,status,building_id,owner_user_id,owner_party_id,closure_reason,created_at,updated_at")
        .eq("project_id", projectId)
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(50)
    : actionResult;
  fail(reportResult.error);
  fail(partyResult.error);
  fail(compatibleActionResult.error);
  const actionRows = (compatibleActionResult.data ?? []).map((action) => ({
    ...action,
    location_node_id: "location_node_id" in action ? action.location_node_id : null,
  })) as ProjectAction[];
  const actionIds = actionRows.map((action) => action.id);
  const actionUpdateResult = actionIds.length
    ? await client
        .from("action_updates")
        .select("id,action_id,update_type,message,from_status,to_status,created_by,created_at")
        .in("action_id", actionIds)
        .order("created_at", { ascending: false })
        .limit(250)
    : { data: [], error: null };
  fail(actionUpdateResult.error);

  const report = reportResult.data as Record<string, unknown> | null;
  if (!report) {
    return {
      report: null,
      startChecks: [],
      closeouts: [],
      registrations: [],
      attendance: [],
      parties: (partyResult.data ?? []).map((party) => ({ id: party.id as string, name: String(party.name), type: String(party.party_type) })),
      actions: actionRows,
      actionUpdates: (actionUpdateResult.data ?? []) as ActionUpdate[],
    };
  }

  const reportId = report.id as string;
  const [startResult, closeoutResult, registrationResult, attendanceResult] = await Promise.all([
    client.from("day_start_checks").select("*").eq("day_report_id", reportId),
    client.from("day_closeouts").select("*").eq("day_report_id", reportId),
    client
      .from("site_registrations")
      .select("id,registration_type,title,description,priority,occurred_at,status,building_id,location_node_id,created_by")
      .eq("day_report_id", reportId)
      .order("occurred_at", { ascending: false })
      .limit(100),
    client
      .from("attendance_entries")
      .select("id,party_id,discipline,shift_start,shift_end,headcount,building_id")
      .eq("day_report_id", reportId)
      .order("created_at"),
  ]);
  const compatibleRegistrationResult = schemaColumnMissing(registrationResult.error, "location_node_id")
    ? await client
        .from("site_registrations")
        .select("id,registration_type,title,description,priority,occurred_at,status,building_id,created_by")
        .eq("day_report_id", reportId)
        .order("occurred_at", { ascending: false })
        .limit(100)
    : registrationResult;
  fail(startResult.error);
  fail(closeoutResult.error);
  fail(compatibleRegistrationResult.error);
  fail(attendanceResult.error);

  return {
    report,
    startChecks: (startResult.data ?? []) as Array<Record<string, unknown>>,
    closeouts: (closeoutResult.data ?? []) as Array<Record<string, unknown>>,
    registrations: (compatibleRegistrationResult.data ?? []).map((registration) => ({
      ...registration,
      location_node_id: "location_node_id" in registration ? registration.location_node_id : null,
    })) as Array<Record<string, unknown>>,
    attendance: (attendanceResult.data ?? []) as Array<Record<string, unknown>>,
    parties: (partyResult.data ?? []).map((party) => ({ id: party.id as string, name: String(party.name), type: String(party.party_type) })),
    actions: actionRows,
    actionUpdates: (actionUpdateResult.data ?? []) as ActionUpdate[],
  };
}

export async function bootstrapOrganization(
  client: SupabaseClient,
  input: { name: string; slug: string; displayName: string },
) {
  const result = await client.rpc("bootstrap_organization", {
    p_name: input.name,
    p_slug: input.slug,
    p_display_name: input.displayName,
  });
  fail(result.error);
  return result.data;
}

export async function createProjectWorkspace(
  client: SupabaseClient,
  input: {
    organizationId: string;
    code: string;
    name: string;
    location: string;
    clientName: string;
    buildingCode: string;
    buildingName: string;
    additionalBuildings: string;
    locationLevels: string;
    contractorName: string;
    defaultLanguage: "en" | "nl";
    shiftStart: string;
    shiftEnd: string;
    reportPrefix: string;
    requiredLocationDepth: "building" | "floor" | "room" | "element";
    disciplines: string;
    lowDeadlineDays: number;
    mediumDeadlineDays: number;
    highDeadlineDays: number;
    criticalDeadlineDays: number;
    notificationLeadHours: number;
    reportHeader: string;
    reportFooter: string;
    enableWorkforce: boolean;
    enableInspections: boolean;
    enableQuality: boolean;
    enableHse: boolean;
    enableDocuments: boolean;
    enableVisualEvidence: boolean;
  },
) {
  const result = await client.rpc("create_project_workspace", {
    p_organization_id: input.organizationId,
    p_code: input.code,
    p_name: input.name,
    p_location: input.location,
    p_client_name: input.clientName,
    p_building_code: input.buildingCode,
    p_building_name: input.buildingName,
    p_contractor_name: input.contractorName,
  });
  fail(result.error);
  const workspace = result.data as { project_id: string; building_id: string; created: boolean };
  const user = await currentUser(client);
  const disciplines = input.disciplines.split("\n").map((value) => value.trim()).filter(Boolean);
  const settingsResult = await client
    .from("project_settings")
    .update({
      configuration_status: "setup",
      report_prefix: input.reportPrefix.trim().toUpperCase(),
      default_language: input.defaultLanguage,
      default_shift_start: input.shiftStart,
      default_shift_end: input.shiftEnd,
      notification_lead_hours: input.notificationLeadHours,
      disciplines,
      required_location_depth: input.requiredLocationDepth,
      finding_deadlines: {
        low: input.lowDeadlineDays,
        medium: input.mediumDeadlineDays,
        high: input.highDeadlineDays,
        critical: input.criticalDeadlineDays,
      },
      report_header: input.reportHeader.trim() || null,
      report_footer: input.reportFooter.trim() || null,
      modules: {
        attendance: input.enableWorkforce,
        inspections: input.enableInspections,
        quality: input.enableQuality,
        hse: input.enableHse,
        actions: true,
        documents: input.enableDocuments,
        visual_evidence: input.enableVisualEvidence,
      },
    })
    .eq("project_id", workspace.project_id);
  fail(settingsResult.error);

  const buildingRows: Array<{ id: string; code: string }> = [
    { id: workspace.building_id, code: input.buildingCode.trim().toUpperCase() },
  ];
  const existingBuildings = await client
    .from("buildings")
    .select("id,code")
    .eq("project_id", workspace.project_id);
  fail(existingBuildings.error);
  const existingByCode = new Map((existingBuildings.data ?? []).map((building) => [String(building.code).toUpperCase(), String(building.id)]));
  const includedBuildingIds = new Set(buildingRows.map((building) => building.id));
  for (const line of input.additionalBuildings.split("\n").map((value) => value.trim()).filter(Boolean)) {
    const [rawCode, ...nameParts] = line.split("|");
    const code = rawCode?.trim().toUpperCase();
    const name = nameParts.join("|").trim();
    if (!code || name.length < 2) continue;
    const existingId = existingByCode.get(code);
    const building = existingId
      ? { id: existingId }
      : await createBuilding(client, { projectId: workspace.project_id, code, name });
    existingByCode.set(code, building.id);
    if (!includedBuildingIds.has(building.id)) {
      buildingRows.push({ id: building.id, code });
      includedBuildingIds.add(building.id);
    }
  }

  const locationDefinitions = input.locationLevels.split("\n").map((line) => {
    const [type, code, name, parentCode] = line.split("|").map((value) => value.trim());
    return { type, code: code?.toUpperCase(), name, parentCode: parentCode?.toUpperCase() };
  }).filter((item) => ["zone", "floor", "room", "element", "work_package"].includes(item.type) && item.code && item.name?.length >= 2);

  for (const building of buildingRows) {
    const existingLocations = await client
      .from("location_nodes")
      .select("id,code")
      .eq("project_id", workspace.project_id)
      .eq("building_id", building.id);
    fail(existingLocations.error);
    const idsByCode = new Map((existingLocations.data ?? []).map((location) => [String(location.code).toUpperCase(), String(location.id)]));
    for (const [index, definition] of locationDefinitions.entries()) {
      if (idsByCode.has(definition.code)) continue;
      const inserted = await client.from("location_nodes").insert({
        organization_id: input.organizationId,
        project_id: workspace.project_id,
        building_id: building.id,
        parent_id: definition.parentCode ? idsByCode.get(definition.parentCode) ?? null : null,
        node_type: definition.type,
        code: definition.code,
        name: definition.name,
        sort_order: (index + 1) * 10,
        created_by: user.id,
      }).select("id").single();
      fail(inserted.error);
      if (!inserted.data) throw new Error("De projectlocatie kon niet worden aangemaakt.");
      idsByCode.set(definition.code, String(inserted.data.id));
    }
  }
  const activation = await client
    .from("project_settings")
    .update({ configuration_status: "active" })
    .eq("project_id", workspace.project_id);
  fail(activation.error);
  return workspace;
}

export async function createBuilding(
  client: SupabaseClient,
  input: { projectId: string; code: string; name: string; description?: string },
) {
  const result = await client.rpc("create_building", {
    p_project_id: input.projectId,
    p_code: input.code,
    p_name: input.name,
    p_description: input.description || null,
  });
  fail(result.error);
  return result.data as NewBuilding;
}

async function createOrGetReport(client: SupabaseClient, projectId: string, reportDate: string) {
  const result = await client.rpc("create_day_report", {
    p_project_id: projectId,
    p_report_date: reportDate,
    p_idempotency_key: `report:${projectId}:${reportDate}`,
  });
  fail(result.error);
  return result.data as Record<string, unknown>;
}

export async function saveProjectStart(
  client: SupabaseClient,
  input: {
    projectId: string;
    buildingId: string;
    locationNodeId?: string;
    answers: ProjectStartAnswers;
    reportDate?: string;
  },
) {
  const user = await currentUser(client);
  const reportDate = input.reportDate ?? reportDateInSuriname();
  let report = await createOrGetReport(client, input.projectId, reportDate);
  const reportId = report.id as string;
  const payload = {
    organization_id: report.organization_id,
    project_id: input.projectId,
    building_id: input.buildingId,
    day_report_id: reportId,
    weather_condition: input.answers.weatherCondition,
    temperature_c: input.answers.temperatureC,
    wind_condition: input.answers.windCondition,
    shift_start: input.answers.shiftStart,
    shift_end: input.answers.shiftEnd,
    planned_work: input.answers.plannedWork,
    expected_workers: input.answers.expectedWorkers,
    inspection_planned: input.answers.inspectionPlanned === "yes",
    high_risk_work: input.answers.highRiskWork === "yes",
    concrete_work: input.answers.concreteWork === "yes",
    work_permit_status: input.answers.workPermit,
    drawing_status: input.answers.drawingStatus,
    drawing_issue_reported: input.answers.drawingIssueReported,
    risk_notes: input.answers.riskNotes || null,
    automation_rules_snapshot: getProjectStartAutomation(input.answers),
  };
  const existing = await client.from("day_start_checks").select("id").eq("day_report_id", reportId).eq("building_id", input.buildingId).maybeSingle();
  fail(existing.error);
  if (existing.data) {
    const update = await client.from("day_start_checks").update(payload).eq("id", existing.data.id);
    fail(update.error);
  } else {
    const insert = await client.from("day_start_checks").insert({
      ...payload,
      idempotency_key: `start:${reportId}:${input.buildingId}`,
      created_by: user.id,
    });
    fail(insert.error);
  }

  if (report.status === "draft" || report.status === "returned") {
    const update = await client
      .from("day_reports")
      .update({ status: "in_progress", completeness_percent: 35 })
      .eq("id", reportId)
      .select("id,organization_id,project_id,report_number,status,completeness_percent")
      .single();
    fail(update.error);
    report = update.data as Record<string, unknown>;
  }
  return report;
}

export async function saveDailyCloseout(
  client: SupabaseClient,
  input: {
    report: Record<string, unknown>;
    projectId: string;
    buildingId: string;
    answers: DailyCloseoutAnswers;
  },
) {
  const user = await currentUser(client);
  const reportId = input.report.id as string;
  const payload = {
    organization_id: input.report.organization_id,
    project_id: input.projectId,
    building_id: input.buildingId,
    day_report_id: reportId,
    day_summary: input.answers.daySummary,
    weather_summary: input.answers.weatherSummary,
    work_ongoing: input.answers.workOngoing || null,
    work_performed: input.answers.workPerformed,
    progress_percent: input.answers.progressPercent,
    inspection_result: input.answers.inspectionResult,
    quality_issues: input.answers.qualityIssues === "yes",
    quality_details: input.answers.qualityDetails || null,
    hse_event: input.answers.hseEvent,
    hse_details: input.answers.hseDetails || null,
    equipment_status: input.answers.equipmentStatus || null,
    deliveries: input.answers.deliveries || null,
    tests_measurements: input.answers.testsMeasurements || null,
    variation_work_status: input.answers.variationWork,
    delay_cause: input.answers.delayCause,
    delay_hours: input.answers.delayHours,
    communication: input.answers.communication || null,
    risks: input.answers.risks || null,
    tomorrow_plan: input.answers.tomorrowPlan,
    photo_count: input.answers.photoCount,
    attachments_confirmed: input.answers.attachmentsConfirmed,
  };
  const existing = await client.from("day_closeouts").select("id").eq("day_report_id", reportId).eq("building_id", input.buildingId).maybeSingle();
  fail(existing.error);
  if (existing.data) {
    const update = await client.from("day_closeouts").update(payload).eq("id", existing.data.id);
    fail(update.error);
  } else {
    const insert = await client.from("day_closeouts").insert({
      ...payload,
      idempotency_key: `closeout:${reportId}:${input.buildingId}`,
      created_by: user.id,
    });
    fail(insert.error);
  }
  const reportUpdate = await client.from("day_reports").update({ completeness_percent: 90 }).eq("id", reportId);
  fail(reportUpdate.error);
}

export async function saveSiteRegistration(
  client: SupabaseClient,
  input: {
    projectId: string;
    buildingId: string;
    locationNodeId?: string;
    type: string;
    title: string;
    description: string;
    priority: string;
  },
) {
  let result = await client.rpc("create_site_registration", {
    p_project_id: input.projectId,
    p_building_id: input.buildingId,
    p_report_date: reportDateInSuriname(),
    p_registration_type: input.type,
    p_title: input.title,
    p_description: input.description,
    p_priority: input.priority,
    p_occurred_at: new Date().toISOString(),
    p_idempotency_key: `registration:${crypto.randomUUID()}`,
    p_location_node_id: input.locationNodeId || null,
  });
  if (rpcSignatureMissing(result.error, "create_site_registration")) {
    result = await client.rpc("create_site_registration", {
      p_project_id: input.projectId,
      p_building_id: input.buildingId,
      p_report_date: reportDateInSuriname(),
      p_registration_type: input.type,
      p_title: input.title,
      p_description: input.description,
      p_priority: input.priority,
      p_occurred_at: new Date().toISOString(),
      p_idempotency_key: `registration:${crypto.randomUUID()}`,
    });
  }
  fail(result.error);
  return result.data;
}

export async function saveAttendance(
  client: SupabaseClient,
  input: {
    report: Record<string, unknown>;
    projectId: string;
    buildingId: string;
    rows: AttendanceInput[];
  },
) {
  const user = await currentUser(client);
  const reportId = input.report.id as string;
  const existingResult = await client
    .from("attendance_entries")
    .select("id,party_id,discipline")
    .eq("day_report_id", reportId)
    .eq("building_id", input.buildingId);
  fail(existingResult.error);
  const existing = new Map((existingResult.data ?? []).map((row) => [`${row.party_id}:${row.discipline}`, row.id as string]));

  for (const row of input.rows) {
    const key = `${row.partyId}:${row.discipline}`;
    const payload = {
      organization_id: input.report.organization_id,
      project_id: input.projectId,
      building_id: input.buildingId,
      day_report_id: reportId,
      party_id: row.partyId,
      discipline: row.discipline,
      shift_start: row.shiftStart,
      shift_end: row.shiftEnd,
      headcount: row.count,
    };
    const existingId = existing.get(key);
    if (existingId) {
      const update = await client.from("attendance_entries").update(payload).eq("id", existingId);
      fail(update.error);
    } else {
      const insert = await client.from("attendance_entries").insert({
        ...payload,
        idempotency_key: `attendance:${reportId}:${input.buildingId}:${row.partyId}:${row.discipline}`.slice(0, 200),
        created_by: user.id,
      });
      fail(insert.error);
    }
  }
}

export async function submitReportForReview(client: SupabaseClient, reportId: string) {
  const result = await client.rpc("submit_day_report_for_review", { p_day_report_id: reportId });
  fail(result.error);
  return result.data as Record<string, unknown>;
}

export async function createProjectAction(
  client: SupabaseClient,
  input: {
    projectId: string;
    buildingId: string;
    locationNodeId?: string;
    ownerPartyId: string;
    ownerUserId: string;
    title: string;
    description: string;
    dueAt: string;
    priority: ProjectAction["priority"];
  },
) {
  const idempotencyKey = `action:${crypto.randomUUID()}`;
  const result = await client.rpc("create_project_action", {
    p_project_id: input.projectId,
    p_building_id: input.buildingId,
    p_owner_party_id: input.ownerPartyId,
    p_owner_user_id: input.ownerUserId,
    p_title: input.title,
    p_description: input.description,
    p_due_at: surinameLocalDateTimeToIso(input.dueAt),
    p_priority: input.priority,
    p_idempotency_key: idempotencyKey,
    p_location_node_id: input.locationNodeId || null,
  });
  if (rpcSignatureMissing(result.error, "create_project_action")) {
    const compatible = await client.rpc("create_project_action", {
      p_project_id: input.projectId,
      p_building_id: input.buildingId,
      p_owner_party_id: input.ownerPartyId,
      p_title: input.title,
      p_description: input.description,
      p_due_at: surinameLocalDateTimeToIso(input.dueAt),
      p_priority: input.priority,
      p_idempotency_key: idempotencyKey,
    });
    fail(compatible.error);
    const action = compatible.data as ProjectAction & { organization_id?: string; project_id?: string };
    const assigned = await client.from("actions").update({ owner_user_id: input.ownerUserId }).eq("id", action.id).select("*").single();
    fail(assigned.error);
    if (action.organization_id && action.project_id) {
      const user = await currentUser(client);
      const history = await client.from("action_updates").insert({
        organization_id: action.organization_id,
        project_id: action.project_id,
        action_id: action.id,
        update_type: "comment",
        message: "Actie toegewezen aan bedrijfsmedewerker.",
        created_by: user.id,
      });
      fail(history.error);
    }
    return assigned.data as ProjectAction;
  }
  fail(result.error);
  return result.data as ProjectAction;
}

export async function assignProjectAction(
  client: SupabaseClient,
  input: { actionId: string; ownerUserId: string; note: string },
) {
  const result = await client.rpc("assign_project_action", {
    p_action_id: input.actionId,
    p_owner_user_id: input.ownerUserId,
    p_note: input.note,
  });
  if (rpcSignatureMissing(result.error, "assign_project_action")) {
    const existing = await client.from("actions").select("id,organization_id,project_id").eq("id", input.actionId).single();
    fail(existing.error);
    if (!existing.data) throw new Error("De projecttaak bestaat niet meer.");
    const assigned = await client.from("actions").update({ owner_user_id: input.ownerUserId }).eq("id", input.actionId).select("*").single();
    fail(assigned.error);
    const user = await currentUser(client);
    const history = await client.from("action_updates").insert({
      organization_id: existing.data.organization_id,
      project_id: existing.data.project_id,
      action_id: input.actionId,
      update_type: "comment",
      message: input.note,
      created_by: user.id,
    });
    fail(history.error);
    return assigned.data as ProjectAction;
  }
  fail(result.error);
  return result.data as ProjectAction;
}

export async function transitionProjectAction(
  client: SupabaseClient,
  input: { actionId: string; nextStatus: ProjectAction["status"]; note: string },
) {
  const result = await client.rpc("transition_project_action", {
    p_action_id: input.actionId,
    p_next_status: input.nextStatus,
    p_note: input.note,
  });
  fail(result.error);
  return result.data as ProjectAction;
}

export async function loadProjectNotifications(client: SupabaseClient, projectId: string) {
  const refresh = await client.rpc("refresh_project_notifications", { p_project_id: projectId });
  fail(refresh.error);
  const result = await client
    .from("notifications")
    .select("id,notification_type,title,body,source_type,source_id,due_at,read_at,email_status,email_sent_at,push_status,push_sent_at,created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(100);
  fail(result.error);
  return (result.data ?? []) as ProjectNotification[];
}

export async function markNotificationRead(client: SupabaseClient, notificationId: string) {
  const result = await client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId);
  fail(result.error);
}

export async function getSession(client: SupabaseClient): Promise<Session | null> {
  const { data, error } = await client.auth.getSession();
  fail(error);
  return data.session;
}
