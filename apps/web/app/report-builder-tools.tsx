"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { CalendarClock, Loader2, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { addReportDays, reportPresetRange, reportPresets } from "@/lib/reports/report-builder.mjs";

/** The builder's settings that a template keeps (Word 11.1: "Save as template"). */
export type ReportBuilderSettings = {
  reportChoice: string;
  forms: string[];
  preset: string;
  label: string;
  filter: Record<string, unknown>;
  /** Word 11.1 options; a template saved before they existed has none of them. */
  photoMode?: string;
  signatures?: boolean;
  signoffLog?: boolean;
  openFromBefore?: boolean;
};

type ReportPresetId = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month";
type Template = { id: string; name: string; settings: ReportBuilderSettings };
type Schedule = {
  id: string;
  name: string;
  template_id: string | null;
  frequency: "workdays" | "weekly" | "monthly";
  weekday: number | null;
  day_of_month: number | null;
  run_time: string;
  recipient_user_ids: string[];
  publish_to_client: boolean;
  active: boolean;
};
type Person = { id: string; name: string; role: string };

const presetLabels: Record<ReportPresetId, { en: string; nl: string }> = {
  today: { en: "Today", nl: "Vandaag" },
  yesterday: { en: "Yesterday", nl: "Gisteren" },
  this_week: { en: "This week", nl: "Deze week" },
  last_week: { en: "Last week", nl: "Vorige week" },
  this_month: { en: "This month", nl: "Deze maand" },
  last_month: { en: "Last month", nl: "Vorige maand" },
};

/** Quick presets of the report builder: Today, Yesterday, This week, Last week, This month, Last month. */
export function ReportPresets({ today, onPick }: { today: string; onPick: (range: { start: string; end: string }, label: string, preset: ReportPresetId) => void }) {
  const { text } = useLanguage();
  return (
    <div className="report-presets" role="group" aria-label={text("Quick periods", "Snelle periodes")}>
      {(reportPresets as ReportPresetId[]).map((id) => (
        <button className="ui-button ui-button--quiet ui-button--md" type="button" key={id} onClick={() => onPick(reportPresetRange(id, today), text(presetLabels[id].en, presetLabels[id].nl), id)}>
          {text(presetLabels[id].en, presetLabels[id].nl)}
        </button>
      ))}
    </div>
  );
}

/** Saved builder settings: save the current choice under a name, apply or remove a saved one. */
export function ReportTemplates({ client, projectId, current, canEdit, onApply, onChanged }: {
  client: SupabaseClient;
  projectId: string;
  current: ReportBuilderSettings;
  canEdit: boolean;
  onApply: (settings: ReportBuilderSettings) => void;
  onChanged?: (templates: Array<{ id: string; name: string }>) => void;
}) {
  const { text } = useLanguage();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fetchTemplates = useCallback(async () => {
    const result = await client.from("report_templates").select("id,name,settings").eq("project_id", projectId).order("name");
    return result;
  }, [client, projectId]);
  const applyTemplates = useCallback((result: Awaited<ReturnType<typeof fetchTemplates>>) => {
    if (result.error) { setError(result.error.message); return; }
    const rows = (result.data ?? []) as Template[];
    setTemplates(rows);
    onChanged?.(rows.map((row) => ({ id: row.id, name: row.name })));
  }, [onChanged]);
  const load = useCallback(async () => { applyTemplates(await fetchTemplates()); }, [fetchTemplates, applyTemplates]);
  useEffect(() => {
    let alive = true;
    void fetchTemplates().then((result) => { if (alive) applyTemplates(result); });
    return () => { alive = false; };
  }, [fetchTemplates, applyTemplates]);

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    setBusy(true);
    setError("");
    const existing = templates.find((template) => template.name.toLowerCase() === trimmed.toLowerCase());
    const result = existing
      ? await client.from("report_templates").update({ settings: current }).eq("id", existing.id)
      : await client.from("report_templates").insert({ project_id: projectId, name: trimmed, settings: current });
    setBusy(false);
    if (result.error) { setError(result.error.message); return; }
    setName("");
    await load();
  };

  const remove = async (id: string) => {
    setBusy(true);
    const result = await client.from("report_templates").delete().eq("id", id);
    setBusy(false);
    if (result.error) { setError(result.error.message); return; }
    await load();
  };

  return (
    <fieldset className="report-templates">
      <legend>{text("Templates", "Sjablonen")}</legend>
      {templates.length ? (
        <ul>
          {templates.map((template) => (
            <li key={template.id}>
              <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => onApply(template.settings)}>{template.name}</button>
              {canEdit ? <button className="ui-button ui-button--quiet ui-button--md" type="button" disabled={busy} onClick={() => void remove(template.id)} aria-label={text(`Delete template ${template.name}`, `Sjabloon ${template.name} verwijderen`)}><Trash2 size={14} /></button> : null}
            </li>
          ))}
        </ul>
      ) : <small>{text("No saved templates yet.", "Nog geen opgeslagen sjablonen.")}</small>}
      {canEdit ? (
        <div className="report-template-save">
          <input aria-label={text("Template name", "Naam sjabloon")} value={name} maxLength={120} placeholder={text("Name of the template", "Naam van het sjabloon")} onChange={(event) => setName(event.target.value)} />
          <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={busy || name.trim().length < 2} onClick={() => void save()}>
            {busy ? <Loader2 className="spin" size={14} /> : <Save size={14} />} {text("Save as template", "Opslaan als sjabloon")}
          </button>
        </div>
      ) : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </fieldset>
  );
}

const weekdayNames = [
  { value: 1, en: "Monday", nl: "Maandag" },
  { value: 2, en: "Tuesday", nl: "Dinsdag" },
  { value: 3, en: "Wednesday", nl: "Woensdag" },
  { value: 4, en: "Thursday", nl: "Donderdag" },
  { value: 5, en: "Friday", nl: "Vrijdag" },
];

/**
 * Schedules (Word 11.1): "daily report every working day at 18:00, weekly every Monday 08:00", with the
 * users who are told when it is due. The scheduler runs at 08:00 and 18:00 project time.
 */
export function ReportSchedules({ client, projectId, templates, people, canEdit, canPublish }: {
  client: SupabaseClient;
  projectId: string;
  templates: Array<{ id: string; name: string }>;
  people: Person[];
  canEdit: boolean;
  /** Only an authorized CODECO user may let a schedule publish to the Client Portal. */
  canPublish: boolean;
}) {
  const { text } = useLanguage();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [frequency, setFrequency] = useState<Schedule["frequency"]>("workdays");
  const [weekday, setWeekday] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [runTime, setRunTime] = useState("18:00");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fetchSchedules = useCallback(async () => {
    return client.from("report_schedules").select("id,name,template_id,frequency,weekday,day_of_month,run_time,recipient_user_ids,publish_to_client,active").eq("project_id", projectId).order("name");
  }, [client, projectId]);
  const applySchedules = useCallback((result: Awaited<ReturnType<typeof fetchSchedules>>) => {
    if (result.error) { setError(result.error.message); return; }
    setSchedules((result.data ?? []) as Schedule[]);
  }, []);
  const load = useCallback(async () => { applySchedules(await fetchSchedules()); }, [fetchSchedules, applySchedules]);
  useEffect(() => {
    let alive = true;
    void fetchSchedules().then((result) => { if (alive) applySchedules(result); });
    return () => { alive = false; };
  }, [fetchSchedules, applySchedules]);

  const create = async () => {
    if (name.trim().length < 2 || !recipients.length) return;
    setBusy(true);
    setError("");
    const result = await client.from("report_schedules").insert({
      project_id: projectId,
      name: name.trim(),
      template_id: templateId || null,
      frequency,
      weekday: frequency === "weekly" ? weekday : null,
      day_of_month: frequency === "monthly" ? dayOfMonth : null,
      run_time: runTime,
      recipient_user_ids: recipients,
      publish_to_client: publish && canPublish,
    });
    setBusy(false);
    if (result.error) { setError(result.error.message); return; }
    setName("");
    setRecipients([]);
    await load();
  };

  const toggleActive = async (schedule: Schedule) => {
    setBusy(true);
    const result = await client.from("report_schedules").update({ active: !schedule.active }).eq("id", schedule.id);
    setBusy(false);
    if (result.error) setError(result.error.message);
    await load();
  };

  const remove = async (id: string) => {
    setBusy(true);
    const result = await client.from("report_schedules").delete().eq("id", id);
    setBusy(false);
    if (result.error) setError(result.error.message);
    await load();
  };

  const describe = (schedule: Schedule) => {
    const time = schedule.run_time.slice(0, 5);
    if (schedule.frequency === "workdays") return text(`Every working day at ${time}`, `Elke werkdag om ${time}`);
    if (schedule.frequency === "weekly") {
      const day = weekdayNames.find((item) => item.value === schedule.weekday);
      return text(`Every ${day?.en ?? "week"} at ${time}`, `Elke ${(day?.nl ?? "week").toLowerCase()} om ${time}`);
    }
    return text(`Day ${schedule.day_of_month} of the month at ${time}`, `Dag ${schedule.day_of_month} van de maand om ${time}`);
  };

  return (
    <fieldset className="report-schedules">
      <legend><CalendarClock size={15} aria-hidden="true" /> {text("Schedules", "Planning")}</legend>
      {schedules.length ? (
        <ul>
          {schedules.map((schedule) => (
            <li key={schedule.id}>
              <strong>{schedule.name}</strong>
              <span>{describe(schedule)} · {schedule.recipient_user_ids.length} {text("recipients", "ontvangers")}{schedule.publish_to_client ? ` · ${text("publish to Client Portal", "publiceren naar Client Portal")}` : ""}{templates.find((template) => template.id === schedule.template_id) ? ` · ${templates.find((template) => template.id === schedule.template_id)!.name}` : ""}</span>
              {canEdit ? (
                <>
                  <button className="ui-button ui-button--quiet ui-button--md" type="button" disabled={busy} onClick={() => void toggleActive(schedule)}>{schedule.active ? text("Pause", "Pauzeren") : text("Resume", "Hervatten")}</button>
                  <button className="ui-button ui-button--quiet ui-button--md" type="button" disabled={busy} onClick={() => void remove(schedule.id)} aria-label={text(`Delete schedule ${schedule.name}`, `Planning ${schedule.name} verwijderen`)}><Trash2 size={14} /></button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : <small>{text("No schedules yet.", "Nog geen planning.")}</small>}
      {canEdit ? (
        <div className="report-schedule-form">
          <label className="form-field"><span>{text("Name", "Naam")}</span><input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} /></label>
          <label className="form-field"><span>{text("Template", "Sjabloon")}</span>
            <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
              <option value="">{text("Current choice", "Huidige keuze")}</option>
              {templates.map((template) => <option value={template.id} key={template.id}>{template.name}</option>)}
            </select>
          </label>
          <label className="form-field"><span>{text("Repeat", "Herhaling")}</span>
            <select value={frequency} onChange={(event) => setFrequency(event.target.value as Schedule["frequency"])}>
              <option value="workdays">{text("Every working day", "Elke werkdag")}</option>
              <option value="weekly">{text("Every week", "Elke week")}</option>
              <option value="monthly">{text("Every month", "Elke maand")}</option>
            </select>
          </label>
          {frequency === "weekly" ? (
            <label className="form-field"><span>{text("Day", "Dag")}</span>
              <select value={weekday} onChange={(event) => setWeekday(Number(event.target.value))}>
                {weekdayNames.map((day) => <option value={day.value} key={day.value}>{text(day.en, day.nl)}</option>)}
              </select>
            </label>
          ) : null}
          {frequency === "monthly" ? (
            <label className="form-field"><span>{text("Day of the month", "Dag van de maand")}</span>
              <input type="number" min={1} max={28} value={dayOfMonth} onChange={(event) => setDayOfMonth(Math.min(28, Math.max(1, Number(event.target.value) || 1)))} />
            </label>
          ) : null}
          <label className="form-field"><span>{text("Time", "Tijd")}</span>
            <select value={runTime} onChange={(event) => setRunTime(event.target.value)}>
              <option value="08:00">08:00</option>
              <option value="18:00">18:00</option>
            </select>
          </label>
          <fieldset className="report-recipients">
            <legend>{text("Send to", "Verstuur naar")}</legend>
            {people.map((person) => (
              <label className="check-field" key={person.id}>
                <input type="checkbox" checked={recipients.includes(person.id)} onChange={() => setRecipients((current) => current.includes(person.id) ? current.filter((id) => id !== person.id) : [...current, person.id])} />
                {person.name}{person.role ? ` · ${person.role}` : ""}
              </label>
            ))}
          </fieldset>
          {canPublish ? (
            <label className="check-field"><input type="checkbox" checked={publish} onChange={(event) => setPublish(event.target.checked)} /> {text("Publish to Client Portal after review", "Na controle publiceren naar Client Portal")}</label>
          ) : null}
          <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || name.trim().length < 2 || !recipients.length} onClick={() => void create()}>
            {busy ? <Loader2 className="spin" size={14} /> : <CalendarClock size={14} />} {text("Schedule report", "Rapport plannen")}
          </button>
        </div>
      ) : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </fieldset>
  );
}

export { addReportDays };
