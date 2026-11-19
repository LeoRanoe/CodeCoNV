"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { ChevronLeft, ChevronRight, Image as ImageIcon, Loader2, Users } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { BuildingOption } from "@/app/building-picker";
import { delayCauseLabels } from "@/app/daily-work-register";
import { formIcons, registerIcon } from "@/app/forms/form-icons";

import { ReportDownloadButtons } from "@/app/report-download-buttons";
import { useLanguage } from "@/lib/i18n";
import { loadProjectThumbnailUrl } from "@/lib/images/thumbnail";
import { buildDayOverview, daysWithRecords, SITE_TIME_ZONE, todayOnSite } from "@/lib/reports/day-overview";
import { severityText, statusText } from "@/lib/status-labels";
import { buildDayExport } from "@/lib/reports/day-overview-export";
import type { FileRecord, OperationSnapshot } from "@/lib/supabase/operations";

type RecordTab = "findings" | "ncr" | "hse" | "inspections" | "registers" | "daily" | "files";

/** Moves a site day (YYYY-MM-DD) by whole days, at noon so no time zone can shift it. */
function shiftDay(day: string, days: number) {
  const moment = new Date(`${day}T12:00:00-03:00`);
  moment.setDate(moment.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: SITE_TIME_ZONE }).format(moment);
}

function DayPhoto({ client, file }: { client: SupabaseClient; file: FileRecord }) {
  const [source, setSource] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void loadProjectThumbnailUrl(client, file.id).then((url) => { if (active) setSource(url); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [client, file.id]);
  if (failed) return <span className="day-overview-photo-fallback"><ImageIcon size={18} aria-hidden="true" /></span>;
  // Private object URLs cannot pass through the Next image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return source ? <img src={source} alt={file.original_name} loading="lazy" onError={() => setFailed(true)} /> : <span className="day-overview-photo-fallback"><Loader2 className="spin" size={16} aria-hidden="true" /></span>;
}

/** One line per record; the whole line opens the record itself. */
type DayRow = { id: string; icon: typeof Users; title: string; meta: string; statusLabel: string; tone: string; onOpen?: () => void };

function DayRows({ rows }: { rows: DayRow[] }) {
  return (
    <ul className="day-overview-list">
      {rows.map((row) => {
        const Icon = row.icon;
        return (
          <li key={row.id}>
            <button type="button" onClick={row.onOpen} disabled={!row.onOpen}>
              <Icon size={17} aria-hidden="true" />
              <span><strong>{row.title}</strong>{row.meta ? <small>{row.meta}</small> : null}</span>
              <span className={`task-status ui-status-badge ${row.tone === "red" ? "ui-status-badge--red" : row.tone === "green" ? "ui-status-badge--green" : ""}`}>{row.statusLabel}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function DayBlock({ icon: Icon, title, count, children }: { icon: typeof Users; title: string; count: number; children: ReactNode }) {
  return (
    <section className="day-overview-block" aria-label={title}>
      <h3><Icon size={18} aria-hidden="true" /><span>{title}</span><b>{count}</b></h3>
      {children}
    </section>
  );
}

/**
 * "Eén centraal rapport": every record filled in under Workspace on one site day, in the
 * order of the Workspace tiles, each block under the icon of its own form. Only what was
 * recorded is shown; a form with nothing on the day is named once at the end, never filled
 * with a default. The same day downloads as PDF or Word with every section included.
 */
export function DayOverviewReport({
  data,
  client,
  projectName,
  projectCode,
  currentUserName,
  buildings,
  partyNames,
  registerNames,
  busy,
  run,
  openRecord,
}: {
  data: OperationSnapshot;
  client: SupabaseClient;
  projectName: string;
  projectCode: string;
  currentUserName: string;
  buildings: BuildingOption[];
  partyNames: Record<string, string>;
  registerNames: Record<string, string>;
  busy: boolean;
  run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>;
  openRecord: (tab: RecordTab, recordId?: string) => void;
}) {
  const { language, locale, text } = useLanguage();
  const today = todayOnSite();
  const [day, setDay] = useState(today);
  const overview = useMemo(() => buildDayOverview(day, {
    dayReports: data.dayReports,
    findings: data.findings,
    hseEvents: data.hseEvents,
    registerEntries: data.registerEntries,
    dailyWork: data.dailyWork,
    attendance: data.attendance,
    inspections: data.inspections,
    visualCaptures: data.visualCaptures,
  }), [data, day]);
  const recordedDays = useMemo(() => daysWithRecords({
    dayReports: data.dayReports,
    findings: data.findings,
    hseEvents: data.hseEvents,
    registerEntries: data.registerEntries,
    visualCaptures: data.visualCaptures,
  }).filter((recorded) => recorded <= today).slice(0, 14), [data, today]);

  const dayLabel = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: SITE_TIME_ZONE }).format(new Date(`${day}T12:00:00-03:00`));
  const timeOf = (value: string | null | undefined) => value
    ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: SITE_TIME_ZONE }).format(new Date(value))
    : "";
  const buildingNames = (primary: string | null | undefined, all?: string[]) => {
    const ids = all?.length ? all : primary ? [primary] : [];
    if (buildings.length > 1 && ids.length === buildings.length) return text("All buildings", "Alle gebouwen");
    return ids.map((id) => buildings.find((building) => building.id === id)?.name).filter(Boolean).join(" · ");
  };
  const meta = (...parts: Array<string | null | undefined | false>) => parts.filter(Boolean).join(" · ");

  // ---- rows per form ------------------------------------------------------------------
  const findingRows = (records: typeof overview.issues, tab: "findings" | "ncr", icon: typeof Users): DayRow[] => records.map((record) => ({
    id: `day-${record.id}`,
    icon,
    title: record.title,
    meta: meta(record.finding_number, timeOf(record.created_at), buildingNames(record.building_id, record.building_ids), severityText(record.severity, text), record.issue_management?.responsible_person ? text(`for ${record.issue_management.responsible_person}`, `voor ${record.issue_management.responsible_person}`) : ""),
    statusLabel: statusText(record.status, text),
    tone: record.status === "closed" ? "green" : record.severity === "critical" ? "red" : "",
    onOpen: () => openRecord(tab, record.id),
  }));
  const workRows = (records: typeof overview.worksOngoing, kind: "ongoing" | "completed" | "delay"): DayRow[] => records.map((record) => ({
    id: `day-${kind}-${record.id}`,
    icon: kind === "ongoing" ? formIcons.works_ongoing : kind === "completed" ? formIcons.works_completed : formIcons.delays,
    title: kind === "ongoing"
      ? record.work_ongoing ?? ""
      : kind === "completed"
        ? record.work_performed
        : `${delayCauseLabels[record.delay_cause]?.[language] ?? record.delay_cause} · ${Number(record.delay_hours)} ${text("hours lost", "uur verlies")}`,
    meta: meta(
      buildingNames(record.building_id, record.building_ids),
      kind === "completed" && record.progress_percent !== null && record.progress_percent !== undefined ? `${text("Progress", "Voortgang")} ${Number(record.progress_percent)}%` : "",
      kind === "delay" ? record.delay_reason || "" : "",
      kind === "delay" && record.contractor_company ? record.contractor_company : "",
      record.signed_by ? `${text("signed by", "ondertekend door")} ${record.signed_by}` : "",
    ),
    statusLabel: record.signed_by ? text("Signed", "Ondertekend") : text("Saved", "Opgeslagen"),
    tone: kind === "delay" ? "red" : record.signed_by ? "green" : "",
    onOpen: () => openRecord("daily"),
  }));

  // Workforce: per organisation and trade, the way the attendance form counts them.
  const workforceGroups = useMemo(() => {
    const groups = new Map<string, { label: string; headcount: number }>();
    for (const entry of overview.workforce.entries) {
      if (entry.entry_type === "visitor") continue;
      const label = [partyNames[entry.party_id] || text("Unknown organisation", "Onbekende organisatie"), entry.discipline].filter(Boolean).join(" · ");
      const group = groups.get(label) ?? { label, headcount: 0 };
      group.headcount += Number(entry.headcount) || 0;
      groups.set(label, group);
    }
    return [...groups.values()].sort((left, right) => right.headcount - left.headcount);
  }, [overview.workforce.entries, partyNames, text]);

  const registerOrder = [
    ["delivery", formIcons.delivery],
    ["technical_instruction", formIcons.technical_instruction],
    ["change_order", formIcons.change_order],
    ["delay_report", formIcons.delay_report],
    ["lessons_learned", formIcons.lessons_learned],
    ["agreement", formIcons.agreement],
  ] as const;
  const otherRegisterTypes = Object.keys(overview.registers).filter((type) => !registerOrder.some(([known]) => known === type) && overview.registers[type].length);
  const registerRows = (type: string): DayRow[] => (overview.registers[type] ?? []).map((record) => ({
    id: `day-${record.id}`,
    icon: registerIcon(type),
    title: record.title,
    meta: meta(record.entry_number, timeOf(record.occurred_at), buildingNames(record.building_id, record.building_ids), otherRegisterTypes.includes(type) ? registerNames[type] ?? type : ""),
    statusLabel: statusText(record.status, text),
    tone: record.status === "closed" || record.status === "approved" ? "green" : "",
    onOpen: () => openRecord("registers", record.id),
  }));

  const blocks: Array<{ key: string; title: string; icon: typeof Users; count: number; content: ReactNode }> = [
    {
      key: "workforce",
      title: text("Workforce", "Workforce"),
      icon: formIcons.workforce,
      count: overview.workforce.headcount,
      content: overview.workforce.entries.length ? (
        <div className="day-overview-workforce">
          <p><strong>{text(`${overview.workforce.headcount} on site`, `${overview.workforce.headcount} aanwezig`)}</strong>{overview.workforce.visitors ? <span>{text(` · ${overview.workforce.visitors} visitor(s)`, ` · ${overview.workforce.visitors} bezoeker(s)`)}</span> : null}</p>
          <dl>{workforceGroups.map((group) => <div key={group.label}><dt>{group.label}</dt><dd>{group.headcount}</dd></div>)}</dl>
        </div>
      ) : null,
    },
    { key: "works_ongoing", title: text("Works ongoing", "Werkzaamheden gaande"), icon: formIcons.works_ongoing, count: overview.worksOngoing.length, content: overview.worksOngoing.length ? <DayRows rows={workRows(overview.worksOngoing, "ongoing")} /> : null },
    { key: "works_completed", title: text("Works completed", "Werkzaamheden afgerond"), icon: formIcons.works_completed, count: overview.worksCompleted.length, content: overview.worksCompleted.length ? <DayRows rows={workRows(overview.worksCompleted, "completed")} /> : null },
    { key: "delays", title: text("Delays", "Vertragingen"), icon: formIcons.delays, count: overview.delays.length, content: overview.delays.length ? <DayRows rows={workRows(overview.delays, "delay")} /> : null },
    { key: "issues", title: text("Issues", "Issues"), icon: formIcons.issue, count: overview.issues.length, content: overview.issues.length ? <DayRows rows={findingRows(overview.issues, "findings", formIcons.issue)} /> : null },
    { key: "ncr", title: "NCR", icon: formIcons.ncr, count: overview.ncrs.length, content: overview.ncrs.length ? <DayRows rows={findingRows(overview.ncrs, "ncr", formIcons.ncr)} /> : null },
    {
      key: "hse",
      title: "HSE",
      icon: formIcons.hse,
      count: overview.hse.length,
      content: overview.hse.length ? <DayRows rows={overview.hse.map((record) => ({
        id: `day-${record.id}`,
        icon: record.event_type === "incident" ? formIcons.hse_incident : formIcons.hse,
        title: record.confidential ? `${record.title} · ${text("confidential", "vertrouwelijk")}` : record.title,
        meta: meta(record.event_number, timeOf(record.occurred_at), buildingNames(record.building_id, record.building_ids), severityText(record.severity, text), record.responsible_person ? text(`for ${record.responsible_person}`, `voor ${record.responsible_person}`) : ""),
        statusLabel: statusText(record.status, text),
        tone: record.status === "closed" ? "green" : record.severity === "critical" ? "red" : "",
        onOpen: () => openRecord("hse", record.id),
      }))} /> : null,
    },
    {
      key: "inspections",
      title: text("Inspections", "Inspecties"),
      icon: formIcons.inspection,
      count: overview.inspections.length,
      content: overview.inspections.length ? <DayRows rows={overview.inspections.map((record) => ({
        id: `day-${record.id}`,
        icon: formIcons.inspection,
        title: record.title,
        meta: meta(record.inspection_number, timeOf(record.completed_at ?? record.started_at), buildingNames(record.building_id, record.building_ids), record.signed_by ? `${text("signed by", "ondertekend door")} ${record.signed_by}` : ""),
        statusLabel: statusText(record.status, text),
        tone: record.status === "passed" ? "green" : record.status === "failed" ? "red" : "",
        onOpen: () => openRecord("inspections", record.id),
      }))} /> : null,
    },
    ...registerOrder.map(([type, icon]) => ({
      key: type,
      title: registerNames[type] ?? type,
      icon,
      count: overview.registers[type]?.length ?? 0,
      content: overview.registers[type]?.length ? <DayRows rows={registerRows(type)} /> : null,
    })),
    {
      key: "other_registers",
      title: text("Other registers", "Overige registers"),
      icon: registerIcon("document"),
      count: otherRegisterTypes.reduce((total, type) => total + overview.registers[type].length, 0),
      content: otherRegisterTypes.length ? <DayRows rows={otherRegisterTypes.flatMap(registerRows)} /> : null,
    },
    {
      key: "photos",
      title: text("Photos", "Foto's"),
      icon: formIcons.photos,
      count: overview.photos.length,
      content: overview.photos.length ? (
        <ul className="day-overview-photos">
          {overview.photos.slice(0, 24).map((capture) => {
            const file = data.files.find((item) => item.id === capture.file_id);
            return (
              <li key={capture.id}>
                <button type="button" onClick={() => openRecord("files", capture.file_id)} aria-label={capture.title || text("Open photo", "Foto openen")}>
                  {file ? <DayPhoto client={client} file={file} /> : <span className="day-overview-photo-fallback"><ImageIcon size={18} aria-hidden="true" /></span>}
                  <span>{capture.title || capture.location_label || timeOf(capture.captured_at)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null,
    },
  ];
  /**
   * "Zijn eigen rapport van alles": the file is built from exactly the records on this screen,
   * every form of Workspace in it with all of its boxes and signatures, and the day's photos.
   */
  const nothingRecorded = text("Nothing recorded on this day.", "Niets geregistreerd op deze dag.");
  const exportDocument = async () => {
    const momentOf = (value: string | null | undefined) => value
      ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: SITE_TIME_ZONE }).format(new Date(value))
      : "";
    // The photos travel as small previews inside the file; one that cannot be read is listed by name.
    const photos = await Promise.all(overview.photos.slice(0, 48).map(async (capture) => {
      let image: string | null = null;
      const file = data.files.find((item) => item.id === capture.file_id);
      if (file?.mime_type.startsWith("image/")) {
        try {
          const url = await loadProjectThumbnailUrl(client, file.id);
          const blob = await (await fetch(url)).blob();
          image = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          });
        } catch {
          image = null;
        }
      }
      return {
        title: capture.title || capture.location_label || file?.original_name || text("Photo", "Foto"),
        meta: [timeOf(capture.captured_at), buildingNames(capture.building_id), capture.description ?? ""].filter(Boolean).join(" · "),
        image,
      };
    }));
    return buildDayExport({
      workforce: { headcount: overview.workforce.headcount, visitors: overview.workforce.visitors, entries: overview.workforce.entries as unknown as Record<string, unknown>[] },
      worksOngoing: overview.worksOngoing as unknown as Record<string, unknown>[],
      worksCompleted: overview.worksCompleted as unknown as Record<string, unknown>[],
      delays: overview.delays as unknown as Record<string, unknown>[],
      issues: overview.issues as unknown as Record<string, unknown>[],
      ncrs: overview.ncrs as unknown as Record<string, unknown>[],
      hse: overview.hse as unknown as Record<string, unknown>[],
      inspections: overview.inspections as unknown as Record<string, unknown>[],
      registers: overview.registers as unknown as Record<string, Record<string, unknown>[]>,
      photos,
    }, {
      text,
      projectName,
      projectCode,
      dayLabel,
      day,
      generatedBy: currentUserName,
      generatedAt: momentOf(new Date().toISOString()),
      buildingNames,
      partyName: (id) => (id ? partyNames[id] ?? "" : ""),
      registerNames,
      statusText: (code) => statusText(code, text),
      severityText: (code) => severityText(code, text),
      delayCause: (code) => delayCauseLabels[code ?? ""]?.[language] ?? (code ?? ""),
      timeOf,
      momentOf,
    });
  };

  const filled = blocks.filter((block) => block.content);
  const empty = blocks.filter((block) => !block.content && block.key !== "other_registers");

  return (
    <section className="day-overview" aria-label={text("Day overview", "Dagoverzicht")}>
      <header className="day-overview-header">
        <div>
          <h2>{dayLabel}</h2>
          <p>{text(`${projectName} · ${overview.total} records from Workspace`, `${projectName} · ${overview.total} registraties uit Workspace`)}</p>
        </div>
        <div className="day-overview-day-picker">
          <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => setDay(shiftDay(day, -1))} aria-label={text("Previous day", "Vorige dag")}><ChevronLeft size={16} /></button>
          <label className="form-field">
            <span className="sr-only">{text("Day", "Dag")}</span>
            <input type="date" value={day} max={today} onChange={(event) => { if (event.target.value) setDay(event.target.value); }} />
          </label>
          <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={day >= today} onClick={() => setDay(shiftDay(day, 1))} aria-label={text("Next day", "Volgende dag")}><ChevronRight size={16} /></button>
          {day !== today ? <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={() => setDay(today)}>{text("Today", "Vandaag")}</button> : null}
        </div>
      </header>
      {recordedDays.length ? (
        <div className="day-overview-recent" role="group" aria-label={text("Days with records", "Dagen met registraties")}>
          {recordedDays.map((recorded) => (
            <button type="button" className={recorded === day ? "active" : ""} aria-pressed={recorded === day} onClick={() => setDay(recorded)} key={recorded}>
              {new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: SITE_TIME_ZONE }).format(new Date(`${recorded}T12:00:00-03:00`))}
            </button>
          ))}
        </div>
      ) : null}
      <ReportDownloadButtons
        disabled={busy}
        className="day-overview-download"
        onDownloadPdf={() => run(async () => {
          const document = await exportDocument();
          const { downloadDayExportPdf } = await import("@/lib/reports/day-overview-pdf");
          await downloadDayExportPdf(document, nothingRecorded, (page, total) => text(`Page ${page} of ${total}`, `Pagina ${page} van ${total}`));
        }, text(`Day report of ${day} downloaded.`, `Dagrapport van ${day} gedownload.`))}
        onDownloadWord={() => run(async () => {
          const document = await exportDocument();
          const { downloadDayExportDocx } = await import("@/lib/reports/day-overview-docx");
          await downloadDayExportDocx(document, nothingRecorded);
        }, text(`Day report of ${day} downloaded as Word.`, `Dagrapport van ${day} als Word gedownload.`))}
      />
      {filled.length ? filled.map((block) => (
        <DayBlock icon={block.icon} title={block.title} count={block.count} key={block.key}>{block.content}</DayBlock>
      )) : (
        <div className="empty-list-state"><strong>{text("Nothing recorded on this day", "Niets geregistreerd op deze dag")}</strong><span>{text("Records made under Workspace appear here on the day they were made.", "Registraties uit Workspace verschijnen hier op de dag dat ze zijn gemaakt.")}</span></div>
      )}
      {filled.length && empty.length ? (
        <p className="day-overview-nothing">
          <strong>{text("Nothing recorded", "Niets geregistreerd")}:</strong> {empty.map((block) => block.title).join(" · ")}
        </p>
      ) : null}
    </section>
  );
}
