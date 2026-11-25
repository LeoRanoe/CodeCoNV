"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, type ReactNode } from "react";
import { SpecDirectoryProvider } from "@/app/forms/spec-directory";
import type { BuildingOption } from "@/app/building-picker";
import { useLanguage } from "@/lib/i18n";
import { specLabel } from "@/lib/forms/spec-labels-nl";
import type { SpecFormKey } from "@/lib/forms/spec-forms";
import { useProjectPermissions } from "@/lib/permissions/project-permissions";
import { buildRecordDirectory, recordKindTabs } from "@/lib/records/record-directory.mjs";
import { loadProjectPeople, type OperationSnapshot } from "@/lib/supabase/operations";
import { pageAll } from "@/lib/supabase/page-all.mjs";
import type { SpecDocument, SpecRevision } from "@/app/forms/spec-directory";
import type { InternalMember, ProjectParty } from "@/lib/supabase/data";

/**
 * Feeds the specification's pickers from the project's live registers: its people (members and
 * company staff), its parties (contractors, suppliers …), its own records and its location tree.
 */
export function WorkspaceSpecDirectory({ client, projectId, snapshot, buildings, parties, companyEmployees, currentUserId, currentUserName, openRecord, children }: {
  client: SupabaseClient;
  projectId: string;
  snapshot: OperationSnapshot;
  buildings: BuildingOption[];
  parties: ProjectParty[];
  companyEmployees: InternalMember[];
  currentUserId: string;
  currentUserName: string;
  openRecord: (tab: string, recordId: string) => void;
  children: ReactNode;
}) {
  const { language } = useLanguage();
  const permissions = useProjectPermissions();
  const peopleQuery = useQuery({
    queryKey: ["project-people", projectId],
    queryFn: () => loadProjectPeople(client, projectId),
    staleTime: 5 * 60_000,
    networkMode: "always",
  });
  // F11: the Project Documents register, for exact revision references (paged past the API cap).
  const documentsQuery = useQuery({
    queryKey: ["spec-document-revisions", projectId],
    queryFn: async () => {
      const [documents, revisions] = await Promise.all([
        pageAll((from: number, to: number) => client.from("project_documents").select("id,document_number,title,current_revision_id").eq("project_id", projectId).order("id").range(from, to), 50000),
        pageAll((from: number, to: number) => client.from("project_document_revisions").select("id,document_id,revision,review_status,uploaded_at,superseded_at").eq("project_id", projectId).order("id").range(from, to), 100000),
      ]);
      // A database without the register (or a user without access) offers no documents.
      return { documents: (documents.data ?? []) as SpecDocument[], revisions: (revisions.data ?? []) as SpecRevision[] };
    },
    staleTime: 60_000,
  });
  const refetchDocuments = documentsQuery.refetch;
  const refreshDocuments = useCallback(() => { void refetchDocuments(); }, [refetchDocuments]);
  const people = useMemo(() => {
    const listed = peopleQuery.data ?? [];
    if (listed.length) return listed;
    // A database without the people function still offers the company staff it knows.
    return companyEmployees.map((member) => ({ id: member.userId, name: member.displayName?.trim() || member.email, role: member.projectRoles.find((role) => role.projectId === projectId)?.roleName ?? "" }));
  }, [companyEmployees, peopleQuery.data, projectId]);
  const records = useMemo(() => buildRecordDirectory({ ...snapshot, buildings })
    .filter((entry) => ["finding", "ncr", "hse", "inspection", "register"].includes(entry.kind) && entry.code)
    .map((entry) => ({ id: entry.id, kind: entry.kind, registerType: entry.kind === "register" ? entry.subtitle : undefined, code: entry.code, title: entry.title, linkSpec: entry.linkSpec, linkedRefs: entry.linkedRefs })), [buildings, snapshot]);
  const locations = useMemo(() => {
    const names = new Map(buildings.map((building) => [building.id, building.name]));
    return [
      ...buildings.map((building) => ({ id: `building:${building.id}`, label: building.name })),
      ...snapshot.locationNodes.filter((node) => node.status !== "archived").map((node) => ({ id: node.id, label: `${names.get(node.building_id) ?? ""} · ${node.code} ${node.name}`.trim() })),
    ];
  }, [buildings, snapshot.locationNodes]);
  const canReview = permissions.can("findings.verify") || permissions.can("reports.review");
  const value = useMemo(() => ({
    people,
    parties: parties.map((party) => ({ id: party.id, name: party.name, type: party.type })),
    records,
    locations,
    documents: documentsQuery.data?.documents ?? [],
    revisions: documentsQuery.data?.revisions ?? [],
    refreshDocuments,
    config: snapshot.settings?.spec_configuration ?? null,
    canDecide: (form: SpecFormKey) => canReview || ((form === "hse" || form === "hse_incident") && permissions.can("hse.manage")) || (form === "inspection" && permissions.can("inspections.manage")),
    canSeeSensitive: permissions.can("hse.manage"),
    currentUser: currentUserId ? { id: currentUserId, name: currentUserName } : null,
    translate: (item: string) => specLabel(item, language),
    openRecord: (ref: string) => {
      const [kind, id] = ref.split(":");
      if (!id) return;
      openRecord((recordKindTabs as Record<string, string>)[kind] ?? "home", id);
    },
  }), [documentsQuery.data, refreshDocuments, canReview, currentUserId, currentUserName, language, locations, openRecord, parties, people, permissions, records, snapshot.settings?.spec_configuration]);
  return <SpecDirectoryProvider value={value}>{children}</SpecDirectoryProvider>;
}
