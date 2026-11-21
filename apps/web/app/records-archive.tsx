"use client";

import { Search } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { SectionNav } from "@/app/section-nav";
import { useLanguage } from "@/lib/i18n";
import { buildRecordDirectory, filterRecordDirectory } from "@/lib/records/record-directory.mjs";
import { statusText, typeText } from "@/lib/status-labels";
import type { OperationSnapshot } from "@/lib/supabase/operations";

type DirectoryEntry = { id: string; kind: string; tab: string; code: string; title: string; subtitle: string; date?: string; status?: string; buildingIds?: string[] };
type HistoryRow = { id: string; at: string; source: string; code: string; action: string; actor: string; detail: string };

const formKinds = ["ncr", "finding", "inspection", "hse", "register", "report", "daily_work", "delay"];

async function loadHistory(client: SupabaseClient, projectId: string): Promise<HistoryRow[]> {
  const [signoff, portal, documents, verifications, people] = await Promise.all([
    client.from("record_signoff_events").select("id,record_kind,record_id,action,actor_name,actor_role,comments,previous_status,new_status,created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(300),
    client.from("portal_events").select("id,share_id,action,actor_name,actor_side,comment,previous_status,resulting_status,created_at,portal_shares(record_code,title)").eq("project_id", projectId).neq("action", "view").order("created_at", { ascending: false }).limit(300),
    client.from("project_document_events").select("id,document_id,action,actor_user_id,from_status,to_status,comment,created_at,project_documents(document_number,title)").eq("project_id", projectId).order("created_at", { ascending: false }).limit(300),
    client.from("verifications").select("id,record_code,result,comment,verified_by,verified_at").eq("project_id", projectId).order("verified_at", { ascending: false }).limit(300),
    client.rpc("list_project_people", { p_project_id: projectId }),
  ]);
  const names = new Map(((people.data ?? []) as Array<{ user_id: string; display_name: string }>).map((person) => [person.user_id, person.display_name]));
  const one = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;
  const rows: HistoryRow[] = [
    ...((signoff.data ?? []) as Array<Record<string, string | null>>).map((row) => ({
      id: `s:${row.id}`, at: String(row.created_at), source: "signoff", code: String(row.record_kind ?? ""), action: String(row.action ?? ""),
      actor: [row.actor_name, row.actor_role].filter(Boolean).join(" · "), detail: [row.previous_status && row.new_status ? `${row.previous_status} → ${row.new_status}` : "", row.comments ?? ""].filter(Boolean).join(" · "),
    })),
    ...((portal.data ?? []) as Array<Record<string, unknown>>).map((row) => {
      const share = one(row.portal_shares as { record_code: string | null; title: string } | Array<{ record_code: string | null; title: string }>);
      return {
        id: `p:${row.id}`, at: String(row.created_at), source: "portal", code: share?.record_code ?? share?.title ?? "", action: String(row.action),
        actor: [row.actor_name, row.actor_side].filter(Boolean).join(" · "), detail: [row.previous_status && row.resulting_status && row.previous_status !== row.resulting_status ? `${row.previous_status} → ${row.resulting_status}` : "", row.comment ?? ""].filter(Boolean).join(" · "),
      };
    }),
    ...((documents.data ?? []) as Array<Record<string, unknown>>).map((row) => {
      const document = one(row.project_documents as { document_number: string | null; title: string } | Array<{ document_number: string | null; title: string }>);
      return {
        id: `d:${row.id}`, at: String(row.created_at), source: "document", code: document?.document_number ?? document?.title ?? "", action: String(row.action),
        actor: names.get(String(row.actor_user_id)) ?? "", detail: [row.from_status || row.to_status ? `${row.from_status ?? ""} → ${row.to_status ?? ""}` : "", row.comment ?? ""].filter(Boolean).join(" · "),
      };
    }),
    ...((verifications.data ?? []) as Array<Record<string, string | null>>).map((row) => ({
      id: `v:${row.id}`, at: String(row.verified_at), source: "verification", code: String(row.record_code ?? ""), action: String(row.result),
      actor: names.get(String(row.verified_by)) ?? "", detail: String(row.comment ?? ""),
    })),
  ];
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * Records & Photos (requirements section 5 and the menu): the archive of what supervision
 * produced: submitted forms with their filters, the photo library, attachments, and one
 * record history across sign-offs, portal rounds, document revisions and verifications.
 */
export function RecordsArchive({ client, projectId, data, buildings, photoLibrary, attachments, openRecord }: {
  client: SupabaseClient;
  projectId: string;
  data: OperationSnapshot;
  buildings: Array<{ id: string; name: string }>;
  photoLibrary: ReactNode;
  attachments: ReactNode;
  openRecord: (tab: string, recordId: string) => void;
}) {
  const { locale, text } = useLanguage();
  const [section, setSection] = useState("forms");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [building, setBuilding] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [historySource, setHistorySource] = useState("");
  const directory = useMemo(() => (buildRecordDirectory({ ...data, buildings }) as DirectoryEntry[]).filter((entry) => formKinds.includes(entry.kind)), [buildings, data]);
  const results = useMemo(() => {
    const filtered = filterRecordDirectory(directory, query, { kind: kind || undefined, status: status || undefined, buildingIds: building ? [building] : [], dateFrom: from, dateTo: to }, {}, 500) as DirectoryEntry[];
    return query.trim() || kind || status || building || from || to ? filtered
      : directory.slice().sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? ""))).slice(0, 200);
  }, [building, directory, from, kind, query, status, to]);
  const statuses = [...new Set(directory.map((entry) => entry.status).filter(Boolean))].sort() as string[];
  const historyQuery = useQuery({ queryKey: ["record-history", projectId], queryFn: () => loadHistory(client, projectId), enabled: section === "history" });
  const history = (historyQuery.data ?? []).filter((row) => (!historySource || row.source === historySource) && (!query.trim() || `${row.code} ${row.detail} ${row.actor}`.toLowerCase().includes(query.trim().toLowerCase())));
  const kindLabel = (value: string) => ({ ncr: "NCR", finding: text("Issue", "Issue"), inspection: text("Inspection", "Inspectie"), hse: "HSE", register: text("Register form", "Registerformulier"), report: text("Day report", "Dagrapport"), daily_work: text("Works / day log", "Werk / daglog"), delay: text("Delay", "Vertraging") } as Record<string, string>)[value] ?? value;
  const sourceLabel = (value: string) => ({ signoff: text("Sign-off", "Ondertekening"), portal: text("Portal", "Portaal"), document: text("Document", "Document"), verification: text("Verification", "Verificatie") } as Record<string, string>)[value] ?? value;

  let body: ReactNode;
  if (section === "photos") body = photoLibrary;
  else if (section === "attachments") body = attachments;
  else if (section === "history") {
    body = (
      <section className="ui-panel">
        <div className="portal-filters">
          <label className="form-field"><span>{text("Kind of event", "Soort gebeurtenis")}</span>
            <select value={historySource} onChange={(event) => setHistorySource(event.target.value)}>
              <option value="">{text("All", "Alle")}</option>
              {["signoff", "portal", "document", "verification"].map((value) => <option key={value} value={value}>{sourceLabel(value)}</option>)}
            </select>
          </label>
        </div>
        {historyQuery.isLoading ? <p className="portal-loading">{text("Loading…", "Laden…")}</p> : history.length ? (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead><tr><th>{text("When", "Wanneer")}</th><th>{text("Kind", "Soort")}</th><th>{text("Record", "Record")}</th><th>{text("Step", "Stap")}</th><th>{text("By", "Door")}</th><th>{text("Detail", "Detail")}</th></tr></thead>
              <tbody>{history.slice(0, 500).map((row) => (
                <tr key={row.id}><td>{new Date(row.at).toLocaleString(locale, { timeZone: "America/Paramaribo" })}</td><td>{sourceLabel(row.source)}</td><td>{row.code}</td><td>{row.action.replaceAll("_", " ")}</td><td>{row.actor}</td><td>{row.detail}</td></tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="record-list-empty">{text("No history yet.", "Nog geen historie.")}</p>}
      </section>
    );
  } else {
    body = (
      <section className="ui-panel">
        <div className="portal-filters">
          <label className="form-field"><span>{text("Form type", "Formuliertype")}</span>
            <select value={kind} onChange={(event) => setKind(event.target.value)}><option value="">{text("All", "Alle")}</option>{formKinds.map((value) => <option key={value} value={value}>{kindLabel(value)}</option>)}</select>
          </label>
          <label className="form-field"><span>{text("Status", "Status")}</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{text("All", "Alle")}</option>{statuses.map((value) => <option key={value} value={value}>{statusText(value, text)}</option>)}</select>
          </label>
          <label className="form-field"><span>{text("Building", "Gebouw")}</span>
            <select value={building} onChange={(event) => setBuilding(event.target.value)}><option value="">{text("All", "Alle")}</option>{buildings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          </label>
          <label className="form-field"><span>{text("From", "Van")}</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label className="form-field"><span>{text("Through", "Tot en met")}</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        </div>
        <p className="portal-note">{results.length} {text("records", "registraties")}</p>
        {results.length ? (
          <div className="portal-list">
            {results.map((entry) => (
              <button key={`${entry.kind}:${entry.id}`} type="button" className="ui-list-row portal-row" onClick={() => openRecord(entry.tab, entry.id)}>
                <span className="portal-row-main">
                  <span className="ui-list-row__code">{entry.code || "—"} · {kindLabel(entry.kind)}{entry.kind === "register" ? ` · ${typeText(entry.subtitle, text)}` : ""}</span>
                  <span className="ui-list-row__title">{entry.title}</span>
                  <span className="ui-list-row__meta">{[entry.date ? new Date(entry.date).toLocaleDateString(locale, { timeZone: "America/Paramaribo" }) : "", (entry.buildingIds ?? []).map((id) => buildings.find((item) => item.id === id)?.name).filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</span>
                </span>
                {entry.status ? <span className="ui-status-badge ui-status-badge--blue">{statusText(entry.status, text)}</span> : null}
              </button>
            ))}
          </div>
        ) : <p className="record-list-empty">{text("No record matches this selection.", "Geen registratie voldoet aan deze selectie.")}</p>}
      </section>
    );
  }

  return (
    <section className="verification-workspace records-archive">
      <header className="secondary-header ui-page-header"><div><h1>{text("Records & Photos", "Registraties & foto's")}</h1></div>
        {section === "forms" || section === "history" ? <label className="document-register-search"><Search size={15} /><span className="sr-only">{text("Search records", "Doorzoek registraties")}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text("Number, title, person or words", "Nummer, titel, persoon of woorden")} /></label> : null}
      </header>
      <SectionNav label={text("Records & Photos sections", "Onderdelen registraties & foto's")} items={[
        { id: "forms", label: text("Submitted forms", "Ingediende formulieren"), count: directory.length },
        { id: "photos", label: text("Photo library", "Fotobibliotheek") },
        { id: "attachments", label: text("Attachments", "Bijlagen") },
        { id: "history", label: text("Record history", "Recordhistorie") },
      ].map((item) => ({ ...item, selected: section === item.id, onSelect: () => setSection(item.id) }))} />
      <div className="portal-section">{body}</div>
    </section>
  );
}
