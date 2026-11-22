"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/lib/i18n";

/**
 * Management → Project information (Word 13): the project's name and code, client, site address,
 * planned dates, time zone, currency and status. The fields live on the project row, so the
 * database's own rule (the projects update policy, `project.configure`) decides who may change
 * them; a role without it sees the same values read-only and the save is never offered.
 *
 * The time zone is shown but not editable: every CODECO project runs on America/Paramaribo
 * (recorded decision 12) and the screens and reports do not read a different one.
 */
type ProjectInformation = {
  id: string; code: string; name: string; client_name: string | null; location: string; timezone: string; status: string;
  start_date: string | null; end_date: string | null; currency: string | null; version: number;
};

const columns = "id,code,name,client_name,location,timezone,status,start_date,end_date,currency,version";
const editableStatuses = ["draft", "active", "on_hold", "completed"] as const;

export const projectStatusLabels: Record<string, { en: string; nl: string }> = {
  draft: { en: "Draft", nl: "Concept" },
  active: { en: "Active", nl: "Actief" },
  on_hold: { en: "On hold", nl: "On hold" },
  completed: { en: "Completed", nl: "Afgerond" },
  archived: { en: "Archived", nl: "Gearchiveerd" },
};

const fromProject = (item: ProjectInformation) => ({ client: item.client_name ?? "", address: item.location ?? "", start: item.start_date ?? "", end: item.end_date ?? "", currency: item.currency ?? "", status: item.status });
type ProjectDraft = ReturnType<typeof fromProject>;

export function ProjectInformationPanel({ client, projectId, canEdit }: { client: SupabaseClient; projectId: string; canEdit: boolean }) {
  const { language, text } = useLanguage();
  const queryClient = useQueryClient();
  const queryKey = ["project-information", projectId];
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await client.from("projects").select(columns).eq("id", projectId).single();
      if (result.error) throw result.error;
      return result.data as ProjectInformation;
    },
  });
  const project = query.data;
  const [edit, setEdit] = useState<{ version: number; values: ProjectDraft } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  if (query.isLoading) return <section className="operation-panel"><p role="status">{text("Loading project information…", "Projectgegevens laden…")}</p></section>;
  if (query.error || !project) return <section className="operation-panel"><p className="field-warning" role="alert">{text("The project information could not be read.", "De projectgegevens konden niet worden gelezen.")}</p></section>;

  const current = fromProject(project);
  const draft = edit?.values ?? current;
  const setDraft = (values: ProjectDraft) => setEdit((previous) => ({ version: previous?.version ?? project.version, values }));
  const changed = JSON.stringify(draft) !== JSON.stringify(current);
  const currency = draft.currency.trim().toUpperCase();
  const problem = !canEdit ? "" : draft.start && draft.end && draft.end < draft.start
    ? text("The planned completion date is before the start date.", "De geplande opleverdatum ligt vóór de startdatum.")
    : currency && !/^[A-Z]{3}$/.test(currency)
      ? text("The currency is a three-letter code, for example SRD, USD or EUR.", "De valuta is een code van drie letters, bijvoorbeeld SRD, USD of EUR.")
      : "";
  const archived = project.status === "archived";

  const save = async () => {
    if (problem) { setMessage({ kind: "error", text: problem }); return; }
    setBusy(true); setMessage(null);
    try {
      const result = await client.from("projects").update({
        client_name: draft.client.trim() || null,
        location: draft.address.trim(),
        start_date: draft.start || null,
        end_date: draft.end || null,
        currency: currency || null,
        ...(archived ? {} : { status: draft.status }),
      }).eq("id", projectId).eq("version", edit?.version ?? project.version).select(columns);
      if (result.error) throw result.error;
      if (!result.data?.length) throw new Error(text("Nothing was saved: you may not change the project information, or someone else changed it first. Reload and try again.", "Er is niets opgeslagen: u mag de projectgegevens niet wijzigen, of iemand anders was u voor. Laad opnieuw en probeer het nog eens."));
      queryClient.setQueryData(queryKey, result.data[0]);
      setEdit(null);
      setMessage({ kind: "ok", text: text("Project information saved.", "Projectgegevens opgeslagen.") });
    } catch (caught) {
      setMessage({ kind: "error", text: caught instanceof Error ? caught.message : String((caught as { message?: string })?.message ?? caught) });
    } finally { setBusy(false); }
  };

  return (
    <section className="operation-panel project-information" aria-label={text("Project information", "Projectgegevens")} data-project-information>
      <div className="operation-form">
        <div className="operation-form-heading"><div><h2>{text("Project information", "Projectgegevens")}</h2></div></div>
        {canEdit ? null : <p className="form-helper" data-project-information-readonly>{text("You can read the project information; changing it needs the project configuration right.", "U kunt de projectgegevens lezen; wijzigen vraagt het recht Projectinstellingen.")}</p>}
        <div className="form-grid form-grid-2">
          <label className="form-field"><span>{text("Project name", "Projectnaam")}</span><input value={project.name} readOnly aria-readonly="true" /></label>
          <label className="form-field"><span>{text("Project code", "Projectcode")}</span><input value={project.code} readOnly aria-readonly="true" /></label>
          <label className="form-field"><span>{text("Client", "Opdrachtgever")}</span><input data-project-field="client" value={draft.client} maxLength={180} readOnly={!canEdit} onChange={(event) => setDraft({ ...draft, client: event.target.value })} /></label>
          <label className="form-field"><span>{text("Site address", "Adres projectlocatie")}</span><input data-project-field="address" value={draft.address} maxLength={240} readOnly={!canEdit} onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></label>
          <label className="form-field"><span>{text("Start date", "Startdatum")}</span><input data-project-field="start" type="date" value={draft.start} readOnly={!canEdit} onChange={(event) => setDraft({ ...draft, start: event.target.value })} /></label>
          <label className="form-field"><span>{text("Planned completion date", "Geplande opleverdatum")}</span><input data-project-field="end" type="date" value={draft.end} min={draft.start || undefined} readOnly={!canEdit} onChange={(event) => setDraft({ ...draft, end: event.target.value })} /></label>
          <label className="form-field"><span>{text("Currency", "Valuta")}</span>
            <input data-project-field="currency" value={draft.currency} maxLength={3} list="project-currencies" placeholder="SRD" readOnly={!canEdit} onChange={(event) => setDraft({ ...draft, currency: event.target.value.toUpperCase() })} />
            <datalist id="project-currencies"><option value="SRD" /><option value="USD" /><option value="EUR" /></datalist>
          </label>
          <label className="form-field"><span>{text("Status", "Status")}</span>
            <select data-project-field="status" value={draft.status} disabled={!canEdit || archived} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
              {archived ? <option value="archived">{projectStatusLabels.archived[language]}</option> : editableStatuses.map((value) => <option key={value} value={value}>{projectStatusLabels[value][language]}</option>)}
            </select>
          </label>
          <label className="form-field"><span>{text("Time zone", "Tijdzone")}</span><input value={project.timezone} readOnly aria-readonly="true" /></label>
        </div>
        <p className="form-helper">{text("The time zone is the same for every CODECO project and is not changed here. An archived project is restored in Archive management, not here.", "De tijdzone is voor elk CODECO-project hetzelfde en wordt hier niet gewijzigd. Een gearchiveerd project wordt hersteld in archiefbeheer, niet hier.")}</p>
        {problem ? <p className="field-warning" role="alert">{problem}</p> : null}
        {message ? <p className={message.kind === "ok" ? "form-helper" : "field-warning"} role={message.kind === "ok" ? "status" : "alert"} data-project-information-message>{message.text}</p> : null}
      </div>
      {canEdit ? (
        <div className="record-form-actions">
          <button type="button" className="ui-button ui-button--primary ui-button--md" disabled={busy || !changed || Boolean(problem)} onClick={() => void save()}>
            {busy ? <Loader2 className="spin" size={15} aria-hidden="true" /> : <Save size={15} aria-hidden="true" />} {text("Save project information", "Projectgegevens opslaan")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
