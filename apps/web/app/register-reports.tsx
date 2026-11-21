"use client";

import { FileSpreadsheet, Loader2, Printer } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { pageAll } from "@/lib/supabase/page-all.mjs";
import { useProjectPermissions } from "@/lib/permissions/project-permissions";
import { downloadBlob } from "@/lib/browser/download";
import { loadPortalSnapshot } from "@/lib/portal/portal-data";
import { contractorPerformance } from "@/lib/reports/project-summary.mjs";
import { statusMeta } from "@/lib/documents/document-register.mjs";
import { actionReferenceDate, defaultPeriod, documentReferenceDate, inPeriod } from "@/lib/reports/report-period.mjs";
import { statusText, priorityText } from "@/lib/status-labels";
import type { OperationSnapshot } from "@/lib/supabase/operations";

type Kind = "contractor" | "actions" | "documents";
type Party = { id: string; name: string; type: string };

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n;]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/**
 * The register reports of section 11 that the period report does not cover: contractor
 * performance, the action register (open, overdue, closed) and the document register with
 * outstanding reviews. Each states its period, cut-off, filters and generation time, and
 * exports to Excel (CSV) and PDF (print).
 */
export function RegisterReports({ client, projectId, projectName, data, parties, actions }: {
  client: SupabaseClient;
  projectId: string;
  projectName: string;
  data: OperationSnapshot;
  parties: Party[];
  actions: Array<{ id: string; action_number: string; title: string; status: string; priority: string; due_at: string | null; created_at?: string | null; owner_party_id?: string | null; action_category?: string | null; closure_reason?: string | null }>;
}) {
  const { language, locale, text } = useLanguage();
  const permissions = useProjectPermissions();
  const [kind, setKind] = useState<Kind>("contractor");
  // F11: the period is in project-local days and applies to one reference date per report (report-period.mjs).
  const [from, setFrom] = useState(() => defaultPeriod().from);
  const [to, setTo] = useState(() => defaultPeriod().to);
  const [party, setParty] = useState("");
  const [state, setState] = useState("all");
  const portalQuery = useQuery({ queryKey: ["portal-register", projectId], queryFn: () => loadPortalSnapshot(client, projectId), enabled: permissions.canAny("portal.share", "records.edit") });
  const documentsQuery = useQuery({
    queryKey: ["report-documents", projectId],
    enabled: kind === "documents" && permissions.can("documents.read"),
    queryFn: async () => {
      const [documents, revisions] = await Promise.all([
        // F11: paged past the API row cap; the report counts every document and revision.
        pageAll((from: number, to: number) => client.from("project_documents").select("id,document_number,title,folder_code,discipline,current_revision_id,originator_name,originator_party_id").eq("project_id", projectId).order("id").range(from, to), 50000),
        pageAll((from: number, to: number) => client.from("project_document_revisions").select("id,document_id,revision,review_status,uploaded_at,reviewed_at").eq("project_id", projectId).order("id").range(from, to), 100000),
      ]);
      if (documents.error) throw documents.error;
      if (revisions.error) throw revisions.error;
      return { documents: documents.data ?? [], revisions: revisions.data ?? [] };
    },
  });
  const partyName = (id: string | null | undefined) => parties.find((item) => item.id === id)?.name ?? "";
  const now = new Date();
  const generated = now.toLocaleString(locale, { timeZone: "America/Paramaribo" });

  const table = useMemo((): { head: string[]; rows: Array<Array<string | number>> } => {
    if (kind === "contractor") {
      const rows = contractorPerformance({ shares: portalQuery.data?.shares ?? [], events: portalQuery.data?.events ?? [], findings: data.findings, actions, parties }, { from, to })
        .filter((row: { id: string }) => !party || row.id === party);
      return {
        head: [text("Contractor", "Aannemer"), text("Assigned", "Toegewezen"), text("Answered", "Beantwoord"), text("On time", "Op tijd"), text("Avg. days to answer", "Gem. dagen tot antwoord"), text("Returned", "Teruggestuurd"), text("Overdue now", "Nu te laat"), text("NCRs raised", "NCR's"), text("NCRs closed", "NCR's gesloten"), text("Open actions", "Open acties"), text("Overdue actions", "Acties te laat")],
        rows: rows.map((row: { name: string; assigned: number; answered: number; onTime: number; averageDays: number | null; returned: number; overdue: number; ncrRaised: number; ncrClosed: number; openActions: number; overdueActions: number }) =>
          [row.name, row.assigned, row.answered, row.onTime, row.averageDays ?? "–", row.returned, row.overdue, row.ncrRaised, row.ncrClosed, row.openActions, row.overdueActions]),
      };
    }
    if (kind === "actions") {
      const closed = (status: string) => ["verified", "cancelled"].includes(status);
      const rows = actions
        .filter((action) => !party || action.owner_party_id === party)
        .filter((action) => state === "all" || (state === "open" && !closed(action.status)) || (state === "overdue" && !closed(action.status) && Boolean(action.due_at) && new Date(action.due_at!) < now) || (state === "closed" && closed(action.status)))
        .filter((action) => inPeriod(actionReferenceDate(action), from, to));
      return {
        head: [text("Action", "Actie"), text("Title", "Titel"), text("Kind", "Soort"), text("Responsible", "Verantwoordelijke"), text("Priority", "Prioriteit"), text("Due", "Uiterlijk"), text("Status", "Status"), text("Overdue", "Te laat")],
        rows: rows.map((action) => [action.action_number, action.title,
          ({ corrective: text("Corrective", "Corrigerend"), preventive: text("Preventive", "Preventief"), follow_up: text("Follow-up", "Vervolg") } as Record<string, string>)[action.action_category ?? "follow_up"] ?? "",
          partyName(action.owner_party_id), priorityText(action.priority, text), action.due_at ? new Date(action.due_at).toLocaleDateString(locale, { timeZone: "America/Paramaribo" }) : "",
          statusText(action.status, text), !closed(action.status) && action.due_at && new Date(action.due_at) < now ? text("yes", "ja") : ""]),
      };
    }
    const revisions = new Map((documentsQuery.data?.revisions ?? []).map((revision) => [revision.id, revision]));
    const rows = (documentsQuery.data?.documents ?? [])
      .map((document) => ({ document, current: revisions.get(document.current_revision_id) }))
      .filter((row) => !party || row.document.originator_party_id === party)
      .filter((row) => state === "all" || (state === "open" && ["submitted", "under_review", "revise_resubmit"].includes(row.current?.review_status ?? "")))
      .filter((row) => inPeriod(documentReferenceDate(row.current), from, to));
    return {
      head: [text("Number", "Nummer"), text("Title", "Titel"), text("Folder", "Map"), text("Discipline", "Discipline"), text("Originator", "Opsteller"), text("Revision", "Revisie"), text("Status", "Status"), text("Received", "Ontvangen"), text("Days waiting", "Dagen wachtend")],
      rows: rows.map(({ document, current }) => [document.document_number ?? "", document.title, document.folder_code, document.discipline ?? "",
        document.originator_party_id ? partyName(document.originator_party_id) : document.originator_name ?? "", current?.revision ?? "",
        current ? statusMeta(current.review_status)[language] : "", current ? current.uploaded_at.slice(0, 10) : "",
        current && ["submitted", "under_review"].includes(current.review_status) ? Math.floor((now.getTime() - new Date(current.uploaded_at).getTime()) / 86_400_000) : ""]),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, from, to, party, state, portalQuery.data, documentsQuery.data, data.findings, actions, parties, language]);

  const title = ({ contractor: text("Contractor performance summary", "Prestatieoverzicht aannemers"), actions: text("Action register", "Actieregister"), documents: text("Document register / outstanding submittals", "Documentregister / openstaande indieningen") } as Record<Kind, string>)[kind];
  const filters = [party ? partyName(party) : text("all organisations", "alle organisaties"), kind !== "contractor" && state !== "all" ? state : ""].filter(Boolean).join(" · ");
  // What the period is applied to, stated in the export and on screen.
  const periodBasis = kind === "actions" ? text("due date (raised date if none)", "uiterste datum (anders datum aangemaakt)")
    : kind === "documents" ? text("date the current revision was received", "ontvangstdatum huidige revisie")
    : text("date assigned or raised", "datum toegewezen of gemeld");
  const exportCsv = () => {
    const lines = [[title], [`${text("Project", "Project")}: ${projectName}`], [`${text("Period", "Periode")}: ${from} – ${to} (${periodBasis})`], [`${text("Data cut-off", "Peildatum")}: ${generated}`], [`${text("Filters", "Filters")}: ${filters}`], [], table.head, ...table.rows];
    downloadBlob(new Blob([`﻿${lines.map((line) => line.map(csvCell).join(",")).join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" }), `${projectName.replace(/[^a-z0-9]+/gi, "-")}-${kind}-${to}.csv`);
  };
  const print = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const escape = (value: unknown) => String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escape(title)}</title><style>body{font:12px system-ui,sans-serif;margin:24px;color:#161a20}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 4px;color:#4a5a66}table{border-collapse:collapse;width:100%;margin-top:12px}th,td{border:1px solid #b3c1c9;padding:4px 6px;text-align:left}th{background:#f2f6f7}</style></head><body>
      <h1>${escape(projectName)} · ${escape(title)}</h1><p>${escape(text("Period", "Periode"))}: ${escape(from)} – ${escape(to)} (${escape(periodBasis)})</p><p>${escape(text("Data cut-off and generated", "Peildatum en gegenereerd"))}: ${escape(generated)}</p><p>${escape(text("Filters", "Filters"))}: ${escape(filters)}</p>
      <table><thead><tr>${table.head.map((cell) => `<th>${escape(cell)}</th>`).join("")}</tr></thead><tbody>${table.rows.map((row) => `<tr>${row.map((cell) => `<td>${escape(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  };
  const loading = (kind === "contractor" && portalQuery.isLoading) || (kind === "documents" && documentsQuery.isLoading);

  return (
    <section className="ui-panel register-reports" aria-label={text("Register reports", "Registerrapporten")}>
      <div className="ui-panel__heading"><h2>{text("Register reports", "Registerrapporten")}</h2></div>
      <div className="portal-filters">
        <label className="form-field"><span>{text("Report", "Rapport")}</span>
          <select value={kind} onChange={(event) => { setKind(event.target.value as Kind); setState("all"); }}>
            <option value="contractor">{text("Contractor performance summary", "Prestatieoverzicht aannemers")}</option>
            <option value="actions">{text("Action register / overdue actions", "Actieregister / acties te laat")}</option>
            {permissions.can("documents.read") ? <option value="documents">{text("Document register / outstanding submittals", "Documentregister / openstaande indieningen")}</option> : null}
          </select>
        </label>
        <label className="form-field"><span>{text("From", "Van")}</span><input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="form-field"><span>{text("Through", "Tot en met")}</span><input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label>
        <label className="form-field"><span>{kind === "documents" ? text("Originator", "Opsteller") : text("Contractor", "Aannemer")}</span>
          <select value={party} onChange={(event) => setParty(event.target.value)}><option value="">{text("All", "Alle")}</option>{parties.filter((item) => item.type !== "supervisor").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        </label>
        {kind !== "contractor" ? (
          <label className="form-field"><span>{text("Show", "Tonen")}</span>
            <select value={state} onChange={(event) => setState(event.target.value)}>
              <option value="all">{text("All", "Alle")}</option>
              <option value="open">{kind === "documents" ? text("Outstanding reviews", "Openstaande beoordelingen") : text("Open", "Open")}</option>
              {kind === "actions" ? <option value="overdue">{text("Overdue", "Te laat")}</option> : null}
              {kind === "actions" ? <option value="closed">{text("Closed", "Gesloten")}</option> : null}
            </select>
          </label>
        ) : null}
      </div>
      <p className="portal-note" data-report-period-basis={kind}>{text("Period", "Periode")} {from} – {to} ({periodBasis}) · {text("data cut-off", "peildatum")} {generated} · {filters}</p>
      {loading ? <p className="portal-loading"><Loader2 className="spin" size={14} /> {text("Loading…", "Laden…")}</p> : table.rows.length ? (
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead><tr>{table.head.map((cell) => <th key={cell}>{cell}</th>)}</tr></thead>
            <tbody>{table.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : <p className="record-list-empty">{text("Nothing to report for this selection.", "Niets te rapporteren voor deze selectie.")}</p>}
      <div className="portal-response-actions">
        <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={!table.rows.length} onClick={exportCsv}><FileSpreadsheet size={15} /> Excel (CSV)</button>
        <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={!table.rows.length} onClick={print}><Printer size={15} /> PDF</button>
      </div>
    </section>
  );
}
