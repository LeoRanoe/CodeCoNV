"use client";

import { CalendarDays, CheckCircle2, HardHat, Plus, TimerOff } from "lucide-react";
import { useState } from "react";
import type { BuildingOption } from "@/app/building-picker";
import { useLanguage } from "@/lib/i18n";
import type { DailyWorkRecord, DayReportSummary } from "@/lib/supabase/operations";

export type DailyWorkView = "works_ongoing" | "works_completed" | "delays";

const delayCauseLabels: Record<string, { en: string; nl: string }> = {
  weather: { en: "Weather", nl: "Weer" },
  delivery: { en: "Delivery", nl: "Levering" },
  material: { en: "Material", nl: "Materiaal" },
  equipment: { en: "Equipment", nl: "Materieel" },
  other: { en: "Other", nl: "Overig" },
};

/**
 * Browsable daily work history. The owner has to see what is running, what is
 * finished and where time was lost, not only be able to record it.
 */
export function DailyWorkRegister({
  records,
  dayReports,
  buildings,
  view,
  onViewChange,
  onRecord,
}: {
  records: DailyWorkRecord[];
  dayReports: DayReportSummary[];
  buildings: BuildingOption[];
  view: DailyWorkView;
  onViewChange: (view: DailyWorkView) => void;
  onRecord: (view: DailyWorkView) => void;
}) {
  const { language, locale, text } = useLanguage();
  const [buildingFilter, setBuildingFilter] = useState("all");

  const dateByReport = new Map(dayReports.map((report) => [report.id, report]));
  const buildingName = (buildingId: string) => buildings.find((building) => building.id === buildingId)?.name ?? text("Building", "Gebouw");
  const formatDay = (record: DailyWorkRecord) => {
    const report = dateByReport.get(record.day_report_id);
    const value = report?.report_date ?? record.created_at;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00-03:00`) : new Date(value);
    return new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "America/Paramaribo" }).format(date);
  };

  const scoped = records.filter((record) => buildingFilter === "all" || record.building_id === buildingFilter);
  const visible = scoped.filter((record) => {
    if (view === "works_ongoing") return Boolean(record.work_ongoing?.trim());
    if (view === "works_completed") return Boolean(record.work_performed?.trim());
    return record.delay_cause !== "none" && Number(record.delay_hours) > 0;
  });

  const views: Array<{ id: DailyWorkView; label: string; icon: typeof HardHat; count: number }> = [
    { id: "works_ongoing", label: text("Works ongoing", "Werkzaamheden gaande"), icon: HardHat, count: scoped.filter((record) => Boolean(record.work_ongoing?.trim())).length },
    { id: "works_completed", label: text("Works completed", "Werkzaamheden afgerond"), icon: CheckCircle2, count: scoped.filter((record) => Boolean(record.work_performed?.trim())).length },
    { id: "delays", label: text("Delays", "Vertragingen"), icon: TimerOff, count: scoped.filter((record) => record.delay_cause !== "none" && Number(record.delay_hours) > 0).length },
  ];
  const activeView = views.find((item) => item.id === view) ?? views[0];

  return (
    <section className="daily-work-register">
      <header className="daily-work-heading">
        <div>
          <span className="record-number">{text("Daily work record", "Dagwerkregistratie")}</span>
          <h2>{text("What is running, what is finished and where time was lost", "Wat loopt, wat af is en waar tijd verloren ging")}</h2>
          <p>{text("Every line comes from a confirmed day closeout, so the owner sees the same facts as the report.", "Elke regel komt uit een bevestigde dagafsluiting, zodat de eigenaar dezelfde feiten ziet als het rapport.")}</p>
        </div>
        <div className="daily-work-header-actions">
          {buildings.length > 1 ? (
            <label className="form-field">
              <span>{text("Building", "Gebouw")}</span>
              <select value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)}>
                <option value="all">{text("All buildings", "Alle gebouwen")}</option>
                {buildings.map((building) => <option value={building.id} key={building.id}>{building.name}</option>)}
              </select>
            </label>
          ) : null}
          <button className="primary-button" type="button" onClick={() => onRecord(view)}><Plus size={15} /> {text("Record", "Vastleggen")}</button>
        </div>
      </header>

      <nav className="daily-work-tabs" role="tablist" aria-label={text("Daily work view", "Dagwerkweergave")}>
        {views.map((item) => {
          const Icon = item.icon;
          return (
            <button className={view === item.id ? "active" : ""} type="button" role="tab" aria-selected={view === item.id} onClick={() => onViewChange(item.id)} key={item.id}>
              <Icon size={17} />
              <span><strong>{item.label}</strong><small>{item.count} {text("days", "dagen")}</small></span>
            </button>
          );
        })}
      </nav>

      <div className="daily-work-list">
        {visible.map((record) => (
          <article key={`${record.id}:${view}`}>
            <header>
              <span className="daily-work-date"><CalendarDays size={14} /> {formatDay(record)}</span>
              <span className="daily-work-building">{buildingName(record.building_id)}</span>
            </header>
            {view === "works_ongoing" ? <>
              <p>{record.work_ongoing}</p>
              <small>{text("Plan for tomorrow", "Planning morgen")}: {record.tomorrow_plan}</small>
            </> : null}
            {view === "works_completed" ? <>
              <p>{record.work_performed}</p>
              <span className="daily-work-progress" aria-label={`${text("Progress", "Voortgang")} ${record.progress_percent}%`}>
                <span className="daily-work-progress-track"><i style={{ width: `${Math.min(100, Math.max(0, Number(record.progress_percent)))}%` }} /></span>
                <b>{Number(record.progress_percent)}%</b>
              </span>
            </> : null}
            {view === "delays" ? <>
              <p>{delayCauseLabels[record.delay_cause]?.[language] ?? record.delay_cause} · {Number(record.delay_hours)} {text("hours lost", "uur verlies")}</p>
              <small>{record.delay_reason || record.day_summary}</small>
              {record.contractor_signed_by ? <small className="delay-contractor-proof">{text("Acknowledged by", "Erkend door")} {record.contractor_signed_by}{record.contractor_company ? ` · ${record.contractor_company}` : ""} · {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "America/Paramaribo" }).format(new Date(record.contractor_signed_at!))}</small> : <small>{text("Historical record · no contractor signature stored", "Historische registratie · geen aannemershandtekening opgeslagen")}</small>}
            </> : null}
          </article>
        ))}
        {!visible.length ? (
          <div className="empty-list-state">
            <activeView.icon size={22} />
            <strong>{text(`No ${activeView.label.toLowerCase()} recorded yet`, `Nog geen ${activeView.label.toLowerCase()} vastgelegd`)}</strong>
            <span>{text("Confirm a daily closeout, or record one now.", "Bevestig een dagafsluiting of leg er nu een vast.")}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
