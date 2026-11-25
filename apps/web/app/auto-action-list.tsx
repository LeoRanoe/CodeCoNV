"use client";

import { ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import {
  autoActionCounts,
  autoActionFormLabel,
  autoActionForms,
  autoActionRows,
  autoActionViews,
  filterAutoActions,
  inView,
} from "@/lib/actions/auto-list.mjs";
import type { OperationSnapshot } from "@/lib/supabase/operations";

type Row = {
  key: string; form: string; id: string; tab: string; code: string; title: string; status: string; owner: string; due: string;
  priority: string; discipline: string; buildingIds: string[]; contractor: string; waitingOn: string;
};

const viewLabels: Record<string, [string, string]> = {
  all: ["All open", "Alles open"],
  overdue: ["Overdue", "Te laat"],
  week: ["Due this week", "Deze week"],
  contractor: ["Waiting for contractor", "Wacht op aannemer"],
  supervision: ["Waiting for Supervision", "Wacht op Supervisie"],
  pm: ["Pending PM approval", "Wacht op goedkeuring PM"],
};

/**
 * Actions (developer specification v5.0, chapter 9): every submitted form that still needs follow-up,
 * listed automatically from its source record. A row is the record itself; it leaves when the record
 * is closed, approved or verified. Nothing is typed in a second time.
 */
export function AutoActionList({ data, buildings, parties, openRecord }: {
  data: OperationSnapshot;
  buildings: Array<{ id: string; name: string }>;
  parties: Array<{ id: string; name: string }>;
  openRecord: (tab: string, recordId: string) => void;
}) {
  const { locale, text } = useLanguage();
  const lang = locale === "nl-NL" ? "nl" : "en";
  const nowIso = useMemo(() => new Date().toISOString(), []);
  const [view, setView] = useState("all");
  const [form, setForm] = useState("");
  const [contractor, setContractor] = useState("");
  const [building, setBuilding] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [priority, setPriority] = useState("");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => autoActionRows({ ...data, buildings, parties } as unknown as Record<string, unknown>, { now: nowIso }) as unknown as Row[], [data, buildings, parties, nowIso]);
  const filtered = useMemo(() => filterAutoActions(rows, { form, contractor, buildingId: building, discipline, priority, search }) as Row[], [rows, form, contractor, building, discipline, priority, search]);
  const shown = filtered.filter((row) => inView(row, view, nowIso));
  const counts = autoActionCounts(rows) as Record<string, number>;
  const disciplines = useMemo(() => Array.from(new Set(rows.map((row) => row.discipline).filter(Boolean))).sort(), [rows]);
  const priorities = useMemo(() => Array.from(new Set(rows.map((row) => row.priority).filter(Boolean))).sort(), [rows]);
  const waitingText = (value: string) => value === "pm" ? text("Project Manager", "Projectmanager") : value === "supervision" ? text("Supervision", "Supervisie") : text("Contractor", "Aannemer");

  return (
    <div className="auto-actions" data-auto-actions>
      <div className="form-log-types" role="tablist" aria-label={text("Actions by form", "Acties per formulier")}>
        <button type="button" role="tab" aria-selected={form === ""} className={`form-log-type${form === "" ? " is-selected" : ""}`} onClick={() => setForm("")}>
          {text("All forms", "Alle formulieren")}<span>{rows.length}</span>
        </button>
        {autoActionForms.filter((key: string) => counts[key]).map((key: string) => (
          <button key={key} type="button" role="tab" aria-selected={form === key} className={`form-log-type${form === key ? " is-selected" : ""}`} onClick={() => setForm(key)}>
            {autoActionFormLabel(key, lang)}<span>{counts[key]}</span>
          </button>
        ))}
      </div>

      <div className="auto-action-views" role="tablist" aria-label={text("Views", "Weergaven")}>
        {autoActionViews.map((id: string) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} className={`form-log-type${view === id ? " is-selected" : ""}`} onClick={() => setView(id)}>
            {viewLabels[id][lang === "nl" ? 1 : 0]}<span>{filtered.filter((row) => inView(row, id, nowIso)).length}</span>
          </button>
        ))}
      </div>

      <div className="form-log-filters">
        <label className="form-field"><span>{text("Contractor / owner", "Aannemer / actiehouder")}</span><input value={contractor} onChange={(event) => setContractor(event.target.value)} /></label>
        <label className="form-field"><span>{text("Location", "Locatie")}</span>
          <select value={building} onChange={(event) => setBuilding(event.target.value)}><option value="">{text("All", "Alle")}</option>{buildings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        </label>
        <label className="form-field"><span>{text("Discipline", "Discipline")}</span>
          <select value={discipline} onChange={(event) => setDiscipline(event.target.value)}><option value="">{text("All", "Alle")}</option>{disciplines.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        </label>
        <label className="form-field"><span>{text("Priority", "Prioriteit")}</span>
          <select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">{text("All", "Alle")}</option>{priorities.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        </label>
        <label className="form-field"><span>{text("Search", "Zoeken")}</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      </div>

      {shown.length ? (
        <div className="form-log-scroll">
          <table className="form-log-table">
            <thead>
              <tr>
                <th scope="col">{text("Record", "Registratie")}</th>
                <th scope="col">{text("Form", "Formulier")}</th>
                <th scope="col">{text("Title", "Titel")}</th>
                <th scope="col">{text("Responsible", "Verantwoordelijke")}</th>
                <th scope="col">{text("Due date", "Uiterste datum")}</th>
                <th scope="col">{text("Status", "Status")}</th>
                <th scope="col">{text("Waiting for", "Wacht op")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.key}>
                  <td><button className="text-link" type="button" onClick={() => (row.tab === "verify" ? window.dispatchEvent(new CustomEvent("codeco:open-nav", { detail: "verify" })) : openRecord(row.tab, row.id))}>{row.code || "—"} <ArrowRight size={12} /></button></td>
                  <td>{autoActionFormLabel(row.form, lang)}</td>
                  <td>{row.title || "—"}</td>
                  <td>{row.owner || "—"}</td>
                  <td>{row.due || "—"}</td>
                  <td>{row.status || "—"}</td>
                  <td>{waitingText(row.waitingOn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-state">{text("Nothing needs follow-up in this view.", "In deze weergave is geen opvolging nodig.")}</p>
      )}
    </div>
  );
}
