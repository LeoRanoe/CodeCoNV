"use client";

import { ArrowDown, ArrowUp, Columns3, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { RegisterExportButtons } from "@/app/register-export-buttons";
import { downloadBlob } from "@/lib/browser/download";
import { formTabOrder } from "@/lib/forms/record-defaults.mjs";
import { useLanguage } from "@/lib/i18n";
import {
  buildFormLog,
  filterFormLog,
  formLogCsv,
  formLogFilters,
  formLogLabels,
  formLogReport,
  formLogTotals,
  periodRange,
} from "@/lib/records/form-logs.mjs";
import type { OperationSnapshot } from "@/lib/supabase/operations";

type Row = { id: string; cells: Record<string, string>; status: string; record: Record<string, unknown> };
type FormKey = (typeof formTabOrder)[number];

/** The module a log row opens in (the workspace tabs of record-directory.mjs). */
const openTabFor: Record<string, string> = {
  photo: "files",
  workforce: "workforce",
  issue: "findings",
  ncr: "ncr",
  hse: "hse",
  hse_incident: "hse",
  inspection: "inspections",
};

const periods = [
  ["", "All dates", "Alle datums"],
  ["today", "Today", "Vandaag"],
  ["week", "This week", "Deze week"],
  ["last_week", "Last week", "Vorige week"],
  ["month", "This month", "Deze maand"],
  ["custom", "Custom", "Zelf kiezen"],
] as const;

const storageKey = (form: string) => `codeco.formlog.columns.${form}`;

/**
 * Records & Photos → Form Logs (developer specification v5.0): one logbook per form type with the
 * default columns of the "Form Logs" sheet, filters, totals and an Excel / CSV / PDF export of the
 * filtered view. Columns can be shown, hidden, reordered and sorted; the choice is kept per user
 * on this device. A row opens the record. Drafts are not shown.
 */
export function FormLogs({ data, buildings, parties = [], openRecord, initialForm = "issue", canSeeSensitive = false }: {
  data: OperationSnapshot;
  buildings: Array<{ id: string; name: string }>;
  parties?: Array<{ id: string; name: string }>;
  openRecord: (tab: string, recordId: string) => void;
  initialForm?: FormKey;
  canSeeSensitive?: boolean;
}) {
  const { locale, text } = useLanguage();
  const lang = locale === "nl-NL" ? "nl" : "en";
  const [form, setForm] = useState<FormKey>(initialForm);
  const [period, setPeriod] = useState("");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [status, setStatus] = useState("");
  const [building, setBuilding] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [contractor, setContractor] = useState("");
  const [author, setAuthor] = useState("");
  const [search, setSearch] = useState("");
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; direction: 1 | -1 } | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [layoutByForm, setLayoutByForm] = useState<Record<string, { order: string[]; hidden: string[] }>>(() => {
    if (typeof window === "undefined") return {};
    const saved: Record<string, { order: string[]; hidden: string[] }> = {};
    for (const key of formTabOrder) {
      try {
        const stored = window.localStorage.getItem(storageKey(key));
        if (stored) saved[key] = JSON.parse(stored);
      } catch { /* a layout that cannot be read is the default */ }
    }
    return saved;
  });

  const nowIso = useMemo(() => new Date().toISOString(), []);
  const snapshot = useMemo(() => ({ ...data, buildings, parties }) as unknown as Record<string, unknown>, [data, buildings, parties]);
  const log = useMemo(() => buildFormLog(snapshot, form, { now: nowIso, canSeeSensitive }), [snapshot, form, nowIso, canSeeSensitive]);
  const range = useMemo(() => periodRange(period, nowIso, custom) as { from: string; to: string }, [period, nowIso, custom]);
  const filtered = useMemo(() => filterFormLog(log, { ...range, status, buildingId: building, discipline, contractor, author, search, extra }) as Row[], [log, range, status, building, discipline, contractor, author, search, extra]);
  const rows = useMemo(() => {
    if (!sort) return filtered;
    return [...filtered].sort((a, b) => sort.direction * (a.cells[sort.key] ?? "").localeCompare(b.cells[sort.key] ?? "", undefined, { numeric: true }));
  }, [filtered, sort]);

  const layout = layoutByForm[form] ?? { order: log.columns.map((column: { key: string }) => column.key), hidden: [] };
  const knownKeys: string[] = log.columns.map((column: { key: string }) => column.key);
  const order = [...layout.order.filter((key) => knownKeys.includes(key)), ...knownKeys.filter((key) => !layout.order.includes(key))];
  const columns = order.map((key) => log.columns.find((column: { key: string }) => column.key === key)).filter(Boolean) as Array<{ key: string; label: { en: string; nl: string } }>;
  const visible = columns.filter((column) => !layout.hidden.includes(column.key));

  const saveLayout = (next: { order: string[]; hidden: string[] }) => {
    setLayoutByForm((current) => ({ ...current, [form]: next }));
    try { window.localStorage.setItem(storageKey(form), JSON.stringify(next)); } catch { /* storage may be unavailable */ }
  };
  const move = (key: string, delta: number) => {
    const index = order.indexOf(key);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    saveLayout({ order: next, hidden: layout.hidden });
  };
  const toggle = (key: string) => saveLayout({ order, hidden: layout.hidden.includes(key) ? layout.hidden.filter((item) => item !== key) : [...layout.hidden, key] });

  const totals = formLogTotals(form, rows as never[], { nowIso }) as Array<{ key: string; label: { en: string; nl: string }; value: string }>;
  const filterColumns = (formLogFilters as unknown as Record<string, Array<[string, string]>>)[form] ?? [];
  const disciplines = useMemo(() => Array.from(new Set((log.rows as Array<{ discipline: string }>).map((row) => row.discipline).filter(Boolean))).sort(), [log]);
  const periodLabel = periods.find((item) => item[0] === period)?.[lang === "nl" ? 2 : 1] ?? "";
  const filtersText = [
    `${text("Period", "Periode")}: ${range.from || range.to ? `${range.from || "…"} – ${range.to || "…"}` : periodLabel}`,
    status ? `${text("Status", "Status")}: ${status}` : "",
    building ? `${text("Building", "Gebouw")}: ${buildings.find((item) => item.id === building)?.name ?? ""}` : "",
    discipline ? `${text("Discipline", "Discipline")}: ${discipline}` : "",
    contractor ? `${text("Contractor", "Aannemer")}: ${contractor}` : "",
    search ? `${text("Search", "Zoeken")}: ${search}` : "",
  ].filter(Boolean).join(" · ");
  const getReport = () => {
    const report = formLogReport({ ...log, columns: visible } as never, rows as never[], { language: lang, filtersText, generatedAt: new Date().toLocaleString(lang === "nl" ? "nl-NL" : "en-GB") });
    return report as { title: string; metadata: string[]; headers: string[]; rows: string[][] };
  };
  const filename = `${form}-log-${nowIso.slice(0, 10)}`;
  const counts = useMemo(() => {
    const byForm: Record<string, number> = {};
    for (const key of formTabOrder) byForm[key] = (buildFormLog(snapshot, key, { now: nowIso }).rows as unknown[]).length;
    return byForm;
  }, [snapshot, nowIso]);

  return (
    <section className="form-logs" data-form-logs>
      <div className="form-log-types" role="tablist" aria-label={text("Form logs", "Logboeken")}>
        {formTabOrder.map((key) => (
          <button key={key} type="button" role="tab" aria-selected={key === form} className={`form-log-type${key === form ? " is-selected" : ""}`} onClick={() => { setForm(key); setExtra({}); setSort(null); }}>
            {(formLogLabels as Record<string, { en: string; nl: string }>)[key][lang]}<span>{counts[key]}</span>
          </button>
        ))}
      </div>

      <div className="form-log-filters">
        <label className="form-field"><span>{text("Period", "Periode")}</span>
          <select value={period} onChange={(event) => setPeriod(event.target.value)}>{periods.map((item) => <option key={item[0]} value={item[0]}>{lang === "nl" ? item[2] : item[1]}</option>)}</select>
        </label>
        {period === "custom" ? (
          <>
            <label className="form-field"><span>{text("From", "Van")}</span><input type="date" value={custom.from} onChange={(event) => setCustom({ ...custom, from: event.target.value })} /></label>
            <label className="form-field"><span>{text("To", "Tot")}</span><input type="date" value={custom.to} onChange={(event) => setCustom({ ...custom, to: event.target.value })} /></label>
          </>
        ) : null}
        <label className="form-field"><span>{text("Status", "Status")}</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">{text("All", "Alle")}</option>
            <option value="open">{text("Open", "Open")}</option>
            <option value="closed">{text("Closed", "Gesloten")}</option>
          </select>
        </label>
        <label className="form-field"><span>{text("Building / location", "Gebouw / locatie")}</span>
          <select value={building} onChange={(event) => setBuilding(event.target.value)}><option value="">{text("All", "Alle")}</option>{buildings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        </label>
        <label className="form-field"><span>{text("Discipline", "Discipline")}</span>
          <select value={discipline} onChange={(event) => setDiscipline(event.target.value)}><option value="">{text("All", "Alle")}</option>{disciplines.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        </label>
        <label className="form-field"><span>{text("Contractor / company", "Aannemer / bedrijf")}</span><input value={contractor} onChange={(event) => setContractor(event.target.value)} /></label>
        <label className="form-field"><span>{text("Created by", "Aangemaakt door")}</span><input value={author} onChange={(event) => setAuthor(event.target.value)} /></label>
        {filterColumns.map(([filterKey, columnKey]) => (
          <label className="form-field" key={filterKey}><span>{columns.find((column) => column.key === columnKey)?.label[lang] ?? log.columns.find((column: { key: string }) => column.key === columnKey)?.label[lang]}</span>
            <input value={extra[filterKey] ?? ""} onChange={(event) => setExtra({ ...extra, [filterKey]: event.target.value })} />
          </label>
        ))}
        <label className="form-field"><span>{text("Search ID, title and text", "Zoek op ID, titel en tekst")}</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      </div>

      <div className="form-log-bar">
        <ul className="form-log-totals" aria-label={text("Totals", "Totalen")}>
          {totals.map((item) => <li key={item.key}><span>{item.label[lang]}</span><strong>{item.value}</strong></li>)}
        </ul>
        <div className="form-log-actions">
          <button className="ui-button ui-button--secondary ui-button--md" type="button" aria-expanded={columnsOpen} onClick={() => setColumnsOpen(!columnsOpen)}><Columns3 size={15} /> {text("Columns", "Kolommen")}</button>
          <RegisterExportButtons getReport={getReport} filename={filename} disabled={!rows.length} />
          <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={!rows.length} onClick={() => downloadBlob(new Blob([`﻿${formLogCsv(getReport())}`], { type: "text/csv;charset=utf-8" }), `${filename}.csv`)}><Download size={15} /> CSV</button>
        </div>
      </div>

      {columnsOpen ? (
        <ul className="form-log-columns" aria-label={text("Columns", "Kolommen")}>
          {columns.map((column) => (
            <li key={column.key}>
              <label><input type="checkbox" checked={!layout.hidden.includes(column.key)} onChange={() => toggle(column.key)} /> {column.label[lang]}</label>
              <button className="ui-button ui-button--quiet ui-button--sm" type="button" aria-label={`${column.label[lang]}: ${text("move up", "omhoog")}`} onClick={() => move(column.key, -1)}><ArrowUp size={13} /></button>
              <button className="ui-button ui-button--quiet ui-button--sm" type="button" aria-label={`${column.label[lang]}: ${text("move down", "omlaag")}`} onClick={() => move(column.key, 1)}><ArrowDown size={13} /></button>
            </li>
          ))}
        </ul>
      ) : null}

      {rows.length ? (
        <div className="form-log-scroll">
          <table className="form-log-table">
            <thead>
              <tr>
                {visible.map((column) => (
                  <th key={column.key} scope="col" aria-sort={sort?.key === column.key ? (sort.direction === 1 ? "ascending" : "descending") : "none"}>
                    <button type="button" onClick={() => setSort(sort?.key === column.key ? { key: column.key, direction: sort.direction === 1 ? -1 : 1 } : { key: column.key, direction: 1 })}>{column.label[lang]}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {visible.map((column, index) => (
                    <td key={column.key}>
                      {index === 0 ? <button className="text-link" type="button" onClick={() => openRecord(openTabFor[form] ?? "registers", form === "workforce" ? row.id.split(":")[0] : row.id)}>{row.cells[column.key] || "—"}</button> : (row.cells[column.key] || "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-state">{text("No records of this type match.", "Geen registraties van dit type gevonden.")}</p>
      )}
    </section>
  );
}
