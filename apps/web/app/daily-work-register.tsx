"use client";

import { CheckCircle2, HardHat, TimerOff } from "lucide-react";
import { useState } from "react";
import type { BuildingOption } from "@/app/building-picker";
import { RecordList } from "@/app/forms/record-list";
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
 * Browsable daily work history, below the day log on the Works page. The owner has to see
 * what is running, what is finished and where time was lost, not only be able to record it.
 * It is the same record list every other module shows; the page's own "New" button is the
 * one way to record, so this list carries no second one.
 */
export function DailyWorkRegister({
  records,
  dayReports,
  buildings,
  view,
  onViewChange,
  onOpen,
}: {
  records: DailyWorkRecord[];
  dayReports: DayReportSummary[];
  buildings: BuildingOption[];
  view: DailyWorkView;
  onViewChange: (view: DailyWorkView) => void;
  /** Opens the day log of a recorded day, read-only, in the workspace record viewer. */
  onOpen: (record: DailyWorkRecord, title: string, meta: string) => void;
}) {
  const { language, locale, text } = useLanguage();
  const [buildingFilter, setBuildingFilter] = useState("all");

  const dateByReport = new Map(dayReports.map((report) => [report.id, report]));
  const buildingName = (buildingId: string) => buildings.find((building) => building.id === buildingId)?.name ?? text("Building", "Gebouw");
  const formatDay = (record: DailyWorkRecord) => {
    const report = dateByReport.get(record.day_report_id);
    const value = report?.report_date ?? record.created_at;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00-03:00`) : new Date(value);
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "America/Paramaribo" }).format(date);
  };

  // A day can cover several buildings. Filtering on the primary building alone made a
  // multi-building day disappear from every building but the first one it was saved under.
  const recordBuildings = (record: DailyWorkRecord) => record.building_ids?.length ? record.building_ids : [record.building_id];
  const scoped = records.filter((record) => buildingFilter === "all" || recordBuildings(record).includes(buildingFilter));
  const isDelay = (record: DailyWorkRecord) => record.delay_cause !== "none" && Number(record.delay_hours) > 0;
  const visible = scoped.filter((record) => {
    if (view === "works_ongoing") return Boolean(record.work_ongoing?.trim());
    if (view === "works_completed") return Boolean(record.work_performed?.trim());
    return isDelay(record);
  });

  const views: Array<{ id: DailyWorkView; label: string; icon: typeof HardHat; count: number }> = [
    { id: "works_ongoing", label: text("Works ongoing", "Werkzaamheden gaande"), icon: HardHat, count: scoped.filter((record) => Boolean(record.work_ongoing?.trim())).length },
    { id: "works_completed", label: text("Works completed", "Werkzaamheden afgerond"), icon: CheckCircle2, count: scoped.filter((record) => Boolean(record.work_performed?.trim())).length },
    { id: "delays", label: text("Delays", "Vertragingen"), icon: TimerOff, count: scoped.filter(isDelay).length },
  ];
  const activeView = views.find((item) => item.id === view) ?? views[0];

  return (
    <section className="daily-work-register">
      <div className="daily-work-header-actions">
        <nav className="daily-work-tabs" role="tablist" aria-label={text("Daily work view", "Dagwerkweergave")}>
          {views.map((item) => (
            <button className={view === item.id ? "active" : ""} type="button" role="tab" aria-selected={view === item.id} onClick={() => onViewChange(item.id)} key={item.id}>
              <span><strong>{item.label}</strong><small>{item.count}</small></span>
            </button>
          ))}
        </nav>
        {buildings.length > 1 ? (
          <label className="form-field">
            <span>{text("Building", "Gebouw")}</span>
            <select value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)}>
              <option value="all">{text("All buildings", "Alle gebouwen")}</option>
              {buildings.map((building) => <option value={building.id} key={building.id}>{building.name}</option>)}
            </select>
          </label>
        ) : null}
      </div>

      <RecordList
        empty={text(`No ${activeView.label.toLowerCase()} recorded yet.`, `Nog geen ${activeView.label.toLowerCase()} vastgelegd.`)}
        rows={visible.map((record) => {
          const day = formatDay(record);
          const where = recordBuildings(record).map(buildingName).join(" · ");
          const title = view === "works_ongoing"
            ? record.work_ongoing ?? ""
            : view === "works_completed"
              ? record.work_performed
              : `${delayCauseLabels[record.delay_cause]?.[language] ?? record.delay_cause} · ${Number(record.delay_hours)} ${text("hours lost", "uur verlies")}`;
          const meta = [
            day,
            where,
            view === "works_ongoing" && record.tomorrow_plan ? `${text("Plan for tomorrow", "Planning morgen")}: ${record.tomorrow_plan}` : "",
            view === "works_completed" ? `${text("Progress", "Voortgang")} ${Number(record.progress_percent)}%` : "",
            view === "delays" ? record.delay_reason || record.day_summary : "",
            view === "delays"
              ? record.contractor_signed_by
                ? `${text("Acknowledged by", "Erkend door")} ${record.contractor_signed_by}${record.contractor_company ? ` · ${record.contractor_company}` : ""}`
                : text("Historical record · no contractor signature stored", "Historische registratie · geen aannemershandtekening opgeslagen")
              : "",
          ].filter(Boolean).join(" · ");
          return {
            id: `${record.id}:${view}`,
            icon: activeView.icon,
            title,
            meta,
            status: record.signed_by ? text("Signed", "Ondertekend") : text("Saved", "Opgeslagen"),
            tone: view === "delays" ? "red" : record.signed_by ? "green" : "",
            onOpen: () => onOpen(record, title, meta),
          };
        })}
      />
    </section>
  );
}
