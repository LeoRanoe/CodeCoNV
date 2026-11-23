"use client";

import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { formIcons } from "@/app/forms/form-icons";
import { SectionNav } from "@/app/section-nav";
import { workspaceFolders } from "@/lib/records/workspace-folders";
import { useLanguage } from "@/lib/i18n";
import { buildRecordDirectory, filterRecordDirectory, recordKindTabs } from "@/lib/records/record-directory.mjs";
import { statusText, typeText } from "@/lib/status-labels";
import type { OperationSnapshot } from "@/lib/supabase/operations";
import { pageAll } from "@/lib/supabase/page-all.mjs";

type DirectoryEntry = { id: string; kind: string; tab: string; code: string; title: string; subtitle: string; date?: string; status?: string; buildingIds?: string[]; subtype?: string; partyId?: string | null; responsible?: string; facets?: { discipline?: string } | null };
/** One row of public.search_project_archive (F04/F11). */
type ArchiveRow = { kind: string; form_type: string; record_id: string; code: string; title: string; status: string; at: string | null; building_ids: string[] | null; total_count: number };
type HistoryRow = { id: string; at: string; source: string; code: string; action: string; actor: string; detail: string };

const formKinds = ["ncr", "finding", "inspection", "hse", "register", "workforce", "report", "daily_work", "delay"];
const pageSize = 100;

/** F04: the form-type filter offers each form, register subtype and HSE observation/incident on its own. */
function formTypeOf(entry: DirectoryEntry) {
  if (entry.kind === "register" && entry.subtype) return `register:${entry.subtype}`;
  if (entry.kind === "hse" && entry.subtype) return `hse:${entry.subtype}`;
  return entry.kind;
}

/** Each source is read newest first, `depth` rows deep; "Load older" deepens all four (F04). */
async function loadHistory(client: SupabaseClient, projectId: string, depth: number, codes: Map<string, string>): Promise<{ rows: HistoryRow[]; more: boolean }> {
  const [signoff, portal, documents, verifications, people] = await Promise.all([
    pageAll((from: number, to: number) => client.from("record_signoff_events").select("id,record_kind,record_id,action,actor_name,actor_role,comments,previous_status,new_status,created_at").eq("project_id", projectId).order("created_at", { ascending: false }).order("id").range(from, to), depth),
    pageAll((from: number, to: number) => client.from("portal_events").select("id,share_id,action,actor_name,actor_side,comment,previous_status,resulting_status,created_at,portal_shares(record_code,title)").eq("project_id", projectId).neq("action", "view").order("created_at", { ascending: false }).order("id").range(from, to), depth),
    pageAll((from: number, to: number) => client.from("project_document_events").select("id,document_id,action,actor_user_id,from_status,to_status,comment,created_at,project_documents(document_number,title)").eq("project_id", projectId).order("created_at", { ascending: false }).order("id").range(from, to), depth),
    pageAll((from: number, to: number) => client.from("verifications").select("id,record_code,result,comment,verified_by,verified_at").eq("project_id", projectId).order("verified_at", { ascending: false }).order("id").range(from, to), depth),
    client.rpc("list_project_people", { p_project_id: projectId }),
  ]);
  const names = new Map(((people.data ?? []) as Array<{ user_id: string; display_name: string }>).map((person) => [person.user_id, person.display_name]));
  const one = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;
  const rows: HistoryRow[] = [
    ...((signoff.data ?? []) as Array<Record<string, string | null>>).map((row) => ({
      // F04: the sign-off names the record by its number, not by its kind.
      id: `s:${row.id}`, at: String(row.created_at), source: "signoff", code: codes.get(String(row.record_id)) || String(row.record_kind ?? ""), action: String(row.action ?? ""),
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
  // Each source was read newest first, `depth` rows deep. A source that filled its depth may hold
  // older rows that were not read, so the merged list is complete only down to the newest of those
  // cut-off points; rows older than it wait for "Load older history" (no gaps between sources).
  const cutoffs = [signoff, portal, documents, verifications]
    .map((result, index) => (result.truncated ? rows.filter((row) => row.source === ["signoff", "portal", "document", "verification"][index]).reduce((oldest, row) => (row.at < oldest ? row.at : oldest), "9999") : ""))
    .filter(Boolean);
  const frontier = cutoffs.length ? cutoffs.reduce((newest, at) => (at > newest ? at : newest)) : "";
  return { rows: rows.filter((row) => !frontier || row.at >= frontier).sort((a, b) => b.at.localeCompare(a.at)), more: Boolean(frontier) };
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
  /** The open folder (the same names as the Workspace); empty shows the folders themselves. */
  const [folder, setFolder] = useState("");
  const [status, setStatus] = useState("");
  const [building, setBuilding] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [historySource, setHistorySource] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [party, setParty] = useState("");
  const [responsible, setResponsible] = useState("");
  const [linkedAction, setLinkedAction] = useState("");
  const [shown, setShown] = useState(pageSize);
  const [historyDepth, setHistoryDepth] = useState(300);
  const partiesQuery = useQuery({
    queryKey: ["archive-parties", projectId],
    queryFn: async () => {
      const result = await client.from("parties").select("id,name").eq("project_id", projectId).order("name");
      if (result.error) throw result.error;
      return (result.data ?? []) as Array<{ id: string; name: string }>;
    },
    staleTime: 5 * 60_000,
  });
  const actionSourcesQuery = useQuery({
    queryKey: ["archive-action-sources", projectId],
    queryFn: async () => {
      const result = await pageAll((rangeFrom: number, rangeTo: number) => client.from("actions").select("source_id").eq("project_id", projectId).not("source_id", "is", null).order("id").range(rangeFrom, rangeTo), 50000);
      if (result.error) throw result.error;
      return new Set(((result.data ?? []) as Array<{ source_id: string }>).map((row) => row.source_id));
    },
    enabled: linkedAction !== "",
    staleTime: 60_000,
  });
  const directory = useMemo(() => (buildRecordDirectory({ ...data, buildings }) as DirectoryEntry[]).filter((entry) => formKinds.includes(entry.kind)), [buildings, data]);
  const linkedSources = actionSourcesQuery.data;
  const results = useMemo(() => {
    // F04: no fixed cap; every match is kept and shown a page at a time, newest first.
    const scoped = directory.filter((entry) => (!kind || formTypeOf(entry) === kind || entry.kind === kind)
      && (!party || entry.partyId === party)
      && (!responsible.trim() || String(entry.responsible ?? "").toLowerCase().includes(responsible.trim().toLowerCase()))
      && (!linkedAction || !linkedSources || (linkedAction === "yes") === linkedSources.has(entry.id)));
    const filtered = filterRecordDirectory(scoped, query, { status: status || undefined, buildingIds: building ? [building] : [], dateFrom: from, dateTo: to, discipline: discipline || undefined }, {}, Number.MAX_SAFE_INTEGER) as DirectoryEntry[];
    return query.trim() ? filtered : filtered.slice().sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
  }, [building, directory, discipline, from, kind, linkedAction, linkedSources, party, query, responsible, status, to]);
  // F04/F11: online, Submitted Forms is searched and paged by the database (search_project_archive),
  // so every permitted record is reachable whatever the project's size; offline (or on a database
  // without the function) it filters the cached snapshot above.
  const serverFilters = {
    p_project_id: projectId,
    p_query: query.trim() || null,
    p_kind: kind || null,
    p_status: status || null,
    p_building_id: building || null,
    p_from: from || null,
    p_to: to || null,
    p_discipline: discipline || null,
    p_party_id: party || null,
    p_responsible: responsible.trim() || null,
    p_linked_action: linkedAction ? linkedAction === "yes" : null,
  };
  const online = typeof navigator === "undefined" || navigator.onLine;
  const archiveQuery = useInfiniteQuery({
    queryKey: ["archive-search", serverFilters],
    queryFn: async ({ pageParam }: { pageParam: { at: string | null; id: string } | null }) => {
      const result = await client.rpc("search_project_archive", { ...serverFilters, p_before_at: pageParam?.at ?? null, p_before_id: pageParam?.id ?? null, p_limit: pageSize });
      if (result.error) throw result.error;
      return (result.data ?? []) as ArchiveRow[];
    },
    initialPageParam: null as { at: string | null; id: string } | null,
    getNextPageParam: (last: ArchiveRow[]) => (last.length === pageSize && last[last.length - 1]?.at ? { at: last[last.length - 1].at, id: last[last.length - 1].record_id } : undefined),
    enabled: section === "forms" && online,
    retry: false,
    staleTime: 30_000,
  });
  const fromServer = online && !archiveQuery.isError && Boolean(archiveQuery.data);
  const serverRows: DirectoryEntry[] = useMemo(() => (archiveQuery.data?.pages ?? []).flat().map((row) => ({
    id: row.record_id, kind: row.kind, tab: (recordKindTabs as Record<string, string>)[row.kind] ?? "home", code: row.code, title: row.title, subtitle: "",
    date: row.at ?? undefined, status: row.status, buildingIds: row.building_ids ?? [], subtype: row.form_type.includes(":") ? row.form_type.split(":")[1] : undefined,
  } as DirectoryEntry)), [archiveQuery.data]);
  const serverTotal = Number(archiveQuery.data?.pages[0]?.[0]?.total_count ?? 0);
  const listed = fromServer ? serverRows : results.slice(0, shown);
  const total = fromServer ? serverTotal : results.length;
  const formTypes = useMemo(() => [...new Set(directory.map(formTypeOf))].sort(), [directory]);
  const disciplines = useMemo(() => [...new Set(directory.map((entry) => entry.facets?.discipline).filter(Boolean))].sort() as string[], [directory]);
  const codes = useMemo(() => new Map(directory.filter((entry) => entry.code).map((entry) => [entry.id, entry.code])), [directory]);
  const statuses = [...new Set(directory.map((entry) => entry.status).filter(Boolean))].sort() as string[];
  const historyQuery = useQuery({ queryKey: ["record-history", projectId, historyDepth], queryFn: () => loadHistory(client, projectId, historyDepth, codes), enabled: section === "history" });
  const history = (historyQuery.data?.rows ?? []).filter((row) => (!historySource || row.source === historySource) && (!query.trim() || `${row.code} ${row.detail} ${row.actor}`.toLowerCase().includes(query.trim().toLowerCase())));
  const kindLabel = (value: string): string => value.startsWith("register:") ? typeText(value.slice(9), text)
    : value === "hse:incident" ? text("HSE incident", "HSE-incident") : value === "hse:observation" ? text("HSE observation", "HSE-observatie") : ({ workforce: text("Workforce", "Workforce"), ncr: "NCR", finding: text("Issue", "Issue"), inspection: text("Inspection", "Inspectie"), hse: "HSE", register: text("Register form", "Registerformulier"), report: text("Day report", "Dagrapport"), daily_work: text("Works / day log", "Werk / daglog"), delay: text("Delay", "Vertraging") } as Record<string, string>)[value] ?? value;
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
              <tbody>{history.map((row) => (
                <tr key={row.id}><td>{new Date(row.at).toLocaleString(locale, { timeZone: "America/Paramaribo" })}</td><td>{sourceLabel(row.source)}</td><td>{row.code}</td><td>{row.action.replaceAll("_", " ")}</td><td>{row.actor}</td><td>{row.detail}</td></tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="record-list-empty">{text("No history yet.", "Nog geen historie.")}</p>}
        {historyQuery.data?.more && !historyQuery.isFetching ? (
          <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => setHistoryDepth((depth) => depth + 300)}>{text("Load older history", "Oudere historie laden")}</button>
        ) : null}
      </section>
    );
  } else if (!folder && !query.trim()) {
    body = (
      <section className="ui-panel records-folders">
        <div className="workspace-launcher-grid client-workspace-grid" role="list" aria-label={text("Folders", "Mappen")}>
          {workspaceFolders.map((item) => {
            const Icon = formIcons[item.icon];
            const count = item.kind ? directory.filter((entry) => formTypeOf(entry) === item.kind || entry.kind === item.kind).length : undefined;
            return (
              <button className="workspace-launcher-tile ui-list-row" type="button" role="listitem" data-records-folder={item.id} key={item.id}
                onClick={() => { if (item.kind) { setKind(item.kind); setFolder(item.id); setShown(pageSize); } else setSection("photos"); }}>
                <span className="workspace-launcher-icon"><Icon size={23} /></span>
                {typeof count === "number" ? <span className="workspace-launcher-count" aria-hidden="true">{count}</span> : null}
                <strong>{text(item.en, item.nl)}</strong>
                <ArrowRight className="workspace-launcher-arrow" size={15} />
              </button>
            );
          })}
        </div>
        <button className="ui-button ui-button--secondary ui-button--md" type="button" data-records-folder="all" onClick={() => setFolder("*")}>{text("All records", "Alle registraties")} ({directory.length})</button>
      </section>
    );  } else {
    body = (
      <section className="ui-panel">
        <div className="records-folder-head">
          <button className="ui-button ui-button--quiet ui-button--sm" type="button" data-records-folder="back" onClick={() => { setFolder(""); setKind(""); setQuery(""); setShown(pageSize); }}><ArrowLeft size={14} /> {text("Folders", "Mappen")}</button>
          {folder && folder !== "*" ? <h2>{(() => { const open = workspaceFolders.find((item) => item.id === folder); return open ? text(open.en, open.nl) : ""; })()}</h2> : <h2>{text("All records", "Alle registraties")}</h2>}
        </div>
        <div className="portal-filters">
          <label className="form-field"><span>{text("Form type", "Formuliertype")}</span>
            <select value={kind} onChange={(event) => { setKind(event.target.value); if (folder && folder !== "*") setFolder("*"); setShown(pageSize); }}><option value="">{text("All", "Alle")}</option>{formTypes.map((value) => <option key={value} value={value}>{kindLabel(value)}</option>)}</select>
          </label>
          <label className="form-field"><span>{text("Status", "Status")}</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{text("All", "Alle")}</option>{statuses.map((value) => <option key={value} value={value}>{statusText(value, text)}</option>)}</select>
          </label>
          <label className="form-field"><span>{text("Building", "Gebouw")}</span>
            <select value={building} onChange={(event) => setBuilding(event.target.value)}><option value="">{text("All", "Alle")}</option>{buildings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          </label>
          <label className="form-field"><span>{text("Discipline", "Discipline")}</span>
            <select value={discipline} onChange={(event) => setDiscipline(event.target.value)}><option value="">{text("All", "Alle")}</option>{disciplines.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          </label>
          <label className="form-field"><span>{text("Contractor / party", "Aannemer / partij")}</span>
            <select value={party} onChange={(event) => setParty(event.target.value)}><option value="">{text("All", "Alle")}</option>{(partiesQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          </label>
          <label className="form-field"><span>{text("Responsible person", "Verantwoordelijke")}</span><input value={responsible} onChange={(event) => setResponsible(event.target.value)} /></label>
          <label className="form-field"><span>{text("Linked action", "Gekoppelde actie")}</span>
            <select value={linkedAction} onChange={(event) => setLinkedAction(event.target.value)}><option value="">{text("All", "Alle")}</option><option value="yes">{text("With an action", "Met actie")}</option><option value="no">{text("Without an action", "Zonder actie")}</option></select>
          </label>
          <label className="form-field"><span>{text("From", "Van")}</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label className="form-field"><span>{text("Through", "Tot en met")}</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        </div>
        <p className="portal-note" data-archive-source={fromServer ? "server" : "device"}>{total} {text("records", "registraties")}{fromServer ? "" : online ? "" : text(" · saved on this device", " · op dit apparaat")}</p>
        {listed.length ? (
          <div className="portal-list">
            {listed.map((entry) => (
              <button key={`${entry.kind}:${entry.id}`} type="button" className="ui-list-row portal-row" onClick={() => openRecord(entry.tab, entry.id)}>
                <span className="portal-row-main">
                  <span className="ui-list-row__code">{entry.code || "—"} · {kindLabel(formTypeOf(entry))}</span>
                  <span className="ui-list-row__title">{entry.title}</span>
                  <span className="ui-list-row__meta">{[entry.date ? new Date(entry.date).toLocaleDateString(locale, { timeZone: "America/Paramaribo" }) : "", (entry.buildingIds ?? []).map((id) => buildings.find((item) => item.id === id)?.name).filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</span>
                </span>
                {entry.status ? <span className="ui-status-badge ui-status-badge--blue">{statusText(entry.status, text)}</span> : null}
              </button>
            ))}
          </div>
        ) : <p className="record-list-empty">{text("No record matches this selection.", "Geen registratie voldoet aan deze selectie.")}</p>}
        {fromServer && archiveQuery.hasNextPage ? (
          <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={archiveQuery.isFetchingNextPage} onClick={() => void archiveQuery.fetchNextPage()}>{text(`Show ${Math.min(pageSize, total - listed.length)} more`, `Toon ${Math.min(pageSize, total - listed.length)} meer`)}</button>
        ) : null}
        {!fromServer && results.length > shown ? (
          <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => setShown((count) => count + pageSize)}>{text(`Show ${Math.min(pageSize, results.length - shown)} more`, `Toon ${Math.min(pageSize, results.length - shown)} meer`)}</button>
        ) : null}
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
