"use client";

import { ArrowRight } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";
import { useLanguage } from "@/lib/i18n";
import { useProjectPermissions } from "@/lib/permissions/project-permissions";
import { getCachedProjectSnapshot, cacheProjectSnapshot } from "@/lib/offline/project-cache";
import { loadProjectOperations } from "@/lib/supabase/operations";
import { loadPortalSnapshot } from "@/lib/portal/portal-data";
import { summarizeProject } from "@/lib/reports/project-summary.mjs";
import { buildVerificationQueue } from "@/lib/verification/verification-model.mjs";

type Party = { id: string; name: string; type: string };

/**
 * The project overview of the requirements (section 12 and the menu's Overview): progress,
 * quality, HSE, pending change orders and instructions, inspections, contractors, documents and
 * verification, each from the stored records. A figure the app does not hold (a planned
 * percentage without a schedule) is said to be missing, never invented.
 */
export function OverviewPanels({
  client,
  projectId,
  organizationId,
  reportId,
  parties,
  actions,
  openModule,
  openNav,
}: {
  client: SupabaseClient;
  projectId: string;
  organizationId: string;
  reportId: string | null;
  parties: Party[];
  actions: Array<{ id: string; status: string; due_at: string | null; owner_party_id?: string | null; action_category?: string | null; title: string; action_number: string }>;
  openModule: (tab: "ncr" | "findings" | "hse" | "inspections" | "registers" | "documents") => void;
  openNav: (nav: "acties" | "verify" | "meer" | "rapporten") => void;
}) {
  const { locale, text } = useLanguage();
  const permissions = useProjectPermissions();
  const snapshotQuery = useQuery({
    // Its own key: sharing the search box's key re-rendered the overview above when it resolved.
    queryKey: ["project-operations", projectId, reportId, "overview-panels"],
    queryFn: async () => {
      try {
        const snapshot = await loadProjectOperations(client, projectId, organizationId, reportId);
        await cacheProjectSnapshot(projectId, reportId, snapshot).catch(() => undefined);
        return snapshot;
      } catch (error) {
        const cached = await getCachedProjectSnapshot(projectId, reportId).catch(() => null);
        if (cached) return cached;
        throw error;
      }
    },
    staleTime: 60_000,
  });
  const portalQuery = useQuery({ queryKey: ["portal-register", projectId], queryFn: () => loadPortalSnapshot(client, projectId), enabled: permissions.canAny("portal.share", "records.edit") });
  const documentsQuery = useQuery({
    queryKey: ["overview-documents", projectId],
    enabled: permissions.can("documents.read"),
    queryFn: async () => {
      const [documents, revisions] = await Promise.all([
        client.from("project_documents").select("id,document_number,title,current_revision_id").eq("project_id", projectId).limit(5000),
        client.from("project_document_revisions").select("id,document_id,revision,review_status,uploaded_at,superseded_at").eq("project_id", projectId).order("uploaded_at", { ascending: false }).limit(2000),
      ]);
      return { documents: documents.data ?? [], revisions: revisions.data ?? [] };
    },
  });
  const data = snapshotQuery.data;
  const summary = useMemo(() => data ? summarizeProject({
    findings: data.findings,
    hseEvents: data.hseEvents,
    registerEntries: data.registerEntries,
    inspections: data.inspections,
    boqProgressUpdates: data.boqProgressUpdates,
    actions,
    shares: portalQuery.data?.shares ?? [],
    documents: documentsQuery.data?.documents ?? [],
    revisions: documentsQuery.data?.revisions ?? [],
    parties,
  }) : null, [actions, data, documentsQuery.data, parties, portalQuery.data?.shares]);
  const queue = useMemo(() => data ? buildVerificationQueue({ findings: data.findings, inspections: data.inspections, registerEntries: data.registerEntries, actions, shares: portalQuery.data?.shares ?? [] }) : null, [actions, data, portalQuery.data?.shares]);

  if (!summary || !queue) return null;
  const number = (value: number | null) => value === null ? "–" : String(value);
  const panel = (title: string, open: () => void, children: ReactNode) => (
    <section className="ui-panel overview-extra-panel">
      <div className="ui-panel__heading"><h2>{title}</h2><button className="ui-button ui-button--quiet ui-button--sm" type="button" onClick={open} aria-label={`${text("Open", "Openen")}: ${title}`}><ArrowRight size={14} /></button></div>
      {children}
    </section>
  );
  const fact = (label: string, value: ReactNode, tone?: "red" | "amber") => (
    <div className={`overview-fact${tone ? ` overview-fact--${tone}` : ""}`}><dt>{label}</dt><dd>{value}</dd></div>
  );

  return (
    <div className="overview-panels" aria-label={text("Project overview", "Projectoverzicht")}>
      {panel(text("Progress", "Voortgang"), () => openModule("registers"), (
        <dl className="overview-facts">
          {fact(text("Actual (BOQ, latest per item)", "Werkelijk (BOQ, laatste per post)"), summary.progress.actual === null ? text("No progress recorded", "Geen voortgang vastgelegd") : `${summary.progress.actual}%`)}
          {fact(text("Planned", "Gepland"), text("No baseline schedule in the app", "Geen basisplanning in de app"))}
          {fact(text("BOQ items with progress", "BOQ-posten met voortgang"), `${summary.progress.items}`)}
        </dl>
      ))}
      {panel(text("Quality", "Kwaliteit"), () => openModule("ncr"), (
        <dl className="overview-facts">
          {fact(text("Open NCRs", "Open NCR's"), number(summary.quality.openNcr), summary.quality.openNcr ? "amber" : undefined)}
          {fact(text("Critical / high", "Kritiek / hoog"), number(summary.quality.severe), summary.quality.severe ? "red" : undefined)}
          {fact(text("Open issues", "Open issues"), number(summary.quality.openIssues))}
          {summary.quality.byContractor.slice(0, 3).map((row: { name: string; count: number }) => fact(row.name, `${row.count} ${text("open", "open")}`))}
        </dl>
      ))}
      {panel("HSE", () => openModule("hse"), (
        <dl className="overview-facts">
          {fact(text("Open observations", "Open observaties"), number(summary.hse.openObservations))}
          {fact(text("Incidents (30 days)", "Incidenten (30 dagen)"), number(summary.hse.incidents30), summary.hse.incidents30 ? "red" : undefined)}
          {fact(text("Open HSE follow-up", "Open HSE-opvolging"), number(summary.hse.openFollowUp))}
        </dl>
      ))}
      {panel(text("Pending actions, change orders and instructions", "Openstaande acties, wijzigingen en instructies"), () => openNav("acties"), (
        <dl className="overview-facts">
          {fact(text("Open actions", "Open acties"), number(summary.actions.open))}
          {fact(text("Overdue", "Te laat"), number(summary.actions.overdue), summary.actions.overdue ? "red" : undefined)}
          {fact(text("Pending change orders", "Openstaande wijzigingsopdrachten"), number(summary.registers.changeOrders))}
          {fact(text("Open technical instructions", "Open technische instructies"), number(summary.registers.instructions))}
        </dl>
      ))}
      {panel(text("Inspections", "Inspecties"), () => openModule("inspections"), (
        <dl className="overview-facts">
          {fact(text("Upcoming (7 days)", "Komend (7 dagen)"), number(summary.inspections.upcoming))}
          {fact(text("Overdue", "Te laat"), number(summary.inspections.overdue), summary.inspections.overdue ? "red" : undefined)}
          {fact(text("Failed / re-inspection", "Afgekeurd / herkeuring"), number(summary.inspections.followUp), summary.inspections.followUp ? "amber" : undefined)}
        </dl>
      ))}
      {panel(text("Verification", "Verificatie"), () => openNav("verify"), (
        <dl className="overview-facts">
          {fact(text("Waiting for verification", "Wacht op verificatie"), String(queue.all.length), queue.all.length ? "amber" : undefined)}
          {fact(text("NCRs", "NCR's"), String(queue.ncr.length))}
          {fact(text("Contractor evidence", "Bewijs aannemers"), String(queue.evidence.length))}
        </dl>
      ))}
      {panel(text("Contractors", "Aannemers"), () => openNav("meer"), summary.contractors.length ? (
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead><tr><th>{text("Contractor", "Aannemer")}</th><th>{text("Open", "Open")}</th><th>{text("Overdue", "Te laat")}</th><th>{text("Awaiting their response", "Wacht op hun reactie")}</th></tr></thead>
            <tbody>{summary.contractors.map((row: { id: string; name: string; open: number; overdue: number; awaiting: number }) => (
              <tr key={row.id}><td>{row.name}</td><td>{row.open}</td><td>{row.overdue}</td><td>{row.awaiting}</td></tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p className="record-list-empty">{text("No contractor has open items.", "Geen aannemer heeft open items.")}</p>)}
      {permissions.can("documents.read") ? panel(text("Documents", "Documenten"), () => openModule("documents"), (
        <>
          <dl className="overview-facts">
            {fact(text("Awaiting review", "Wacht op beoordeling"), String(summary.documents.awaitingReview), summary.documents.awaitingReview ? "amber" : undefined)}
            {fact(text("Revisions (7 days)", "Revisies (7 dagen)"), String(summary.documents.recentRevisions.length))}
          </dl>
          {summary.documents.recentRevisions.length ? (
            <ul className="overview-list">{summary.documents.recentRevisions.slice(0, 5).map((row: { id: string; label: string; uploaded_at: string }) => (
              <li key={row.id}><span>{row.label}</span><small>{new Date(row.uploaded_at).toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "America/Paramaribo" })}</small></li>
            ))}</ul>
          ) : null}
        </>
      )) : null}
    </div>
  );
}
