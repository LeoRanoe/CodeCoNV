"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useMemo, useState } from "react";
import { Plus, Save, X } from "lucide-react";
import { useSpecDirectory } from "@/app/forms/spec-directory";
import { signoffProfiles } from "@/lib/forms/signoff";
import {
  riskRatings,
  specListDefaults,
  specListLabels,
  specListLocked,
  type SpecConfiguration,
  type SpecListKey,
  type SpecStageConfig,
  type SpecWorkflowConfig,
} from "@/lib/forms/spec-forms";
import { specLabel } from "@/lib/forms/spec-labels-nl";
import { useLanguage } from "@/lib/i18n";
import { saveSpecConfiguration } from "@/lib/supabase/operations";

const listKeys = Object.keys(specListDefaults) as SpecListKey[];

/**
 * Management · Specification settings: what the workbook leaves to the project.
 * - Lists marked "project-configurable" (shifts, units, crews, storage locations, risk and
 *   severity definitions, authorities to notify): add values, retire values. A retired value is
 *   no longer offered; records that already carry it keep it (they store the label itself).
 * - The HSE risk matrix: only an approved matrix calculates a rating; without one the rating is
 *   chosen from the controlled list.
 * - Workflow profiles: per stage the role name, the number of approvals before the record moves
 *   on (parallel review), the named approvers and the due days; delegations and the change-order
 *   approval limit. Nothing is set until the project sets it.
 */
export function SpecConfigurationPanel({ client, projectId, configuration, busy, run }: {
  client: SupabaseClient;
  projectId: string;
  configuration: SpecConfiguration | null | undefined;
  busy: boolean;
  run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>;
}) {
  const { language, text } = useLanguage();
  const directory = useSpecDirectory();
  const [draft, setDraft] = useState<SpecConfiguration>(() => structuredClone(configuration ?? {}));
  const [listKey, setListKey] = useState<SpecListKey>("shifts");
  const [newValue, setNewValue] = useState("");
  const [profileCode, setProfileCode] = useState("CHANGE-APPROVAL");
  const changed = JSON.stringify(draft) !== JSON.stringify(configuration ?? {});
  const list = draft.lists?.[listKey] ?? {};
  const setList = (patch: { added?: string[]; retired?: string[]; descriptions?: Record<string, string> }) =>
    setDraft((current) => ({ ...current, lists: { ...current.lists, [listKey]: { ...current.lists?.[listKey], ...patch } } }));
  const values = useMemo(() => [...specListDefaults[listKey], ...(list.added ?? [])].filter((value, index, all) => all.indexOf(value) === index), [list.added, listKey]);
  const profile = signoffProfiles[profileCode];
  const workflow: SpecWorkflowConfig = draft.workflows?.[profileCode] ?? {};
  const setWorkflow = (patch: Partial<SpecWorkflowConfig>) =>
    setDraft((current) => ({ ...current, workflows: { ...current.workflows, [profileCode]: { ...current.workflows?.[profileCode], ...patch } } }));
  const setStage = (stage: number, patch: Partial<SpecStageConfig>) =>
    setWorkflow({ stages: { ...workflow.stages, [String(stage)]: { ...workflow.stages?.[String(stage)], ...patch } } });
  const matrix = draft.risk_matrix ?? {};
  const likelihoods = specListDefaults.risk_likelihoods.concat(draft.lists?.risk_likelihoods?.added ?? []).filter((item) => !(draft.lists?.risk_likelihoods?.retired ?? []).includes(item));
  const severities = specListDefaults.risk_severities.concat(draft.lists?.risk_severities?.added ?? []).filter((item) => !(draft.lists?.risk_severities?.retired ?? []).includes(item));
  const ratings = riskRatings(draft);
  const people = directory.people;

  return (
    <section className="operation-panel spec-configuration" aria-label={text("Specification settings", "Specificatie-instellingen")}>
      <div className="operation-form">
        <div className="operation-form-heading"><div><h2>{text("Project lists", "Projectlijsten")}</h2></div></div>
        <p className="form-helper">{text("The workbook marks these lists as project-configurable. A retired value is no longer offered; records that carry it keep it.", "Het werkboek noemt deze lijsten projectafhankelijk. Een ingetrokken waarde wordt niet meer aangeboden; registraties die hem dragen houden hem.")}</p>
        {listKey === "disciplines" ? <p className="form-helper">{text("The 17 workbook disciplines stay: the Works Ongoing, Works Completed and Technical Instructions forms depend on them. Add the project's own disciplines here; Project Documents offers all of them. Records keep the discipline they were saved with.", "De 17 werkboekdisciplines blijven: de formulieren Werkzaamheden gaande, Werkzaamheden afgerond en Technische instructies hangen eraan. Voeg hier de eigen disciplines van het project toe; Projectdocumenten biedt ze allemaal aan. Registraties houden de discipline waarmee ze zijn opgeslagen.")}</p> : null}
        <label className="form-field">
          <span>{text("List", "Lijst")}</span>
          <select value={listKey} onChange={(event) => setListKey(event.target.value as SpecListKey)}>
            {listKeys.map((key) => <option key={key} value={key}>{specListLabels[key][language]}</option>)}
          </select>
        </label>
        <div className="form-field">
        <ul className="spec-config-values">
          {values.length ? values.map((value) => {
            const locked = (specListLocked[listKey] ?? []).includes(value);
            const retired = !locked && (list.retired ?? []).includes(value);
            const own = (list.added ?? []).includes(value);
            return (
              <li key={value}>
                <label className="spec-choice">
                  <input type="checkbox" checked={!retired} disabled={locked} onChange={(event) => setList({ retired: event.target.checked ? (list.retired ?? []).filter((item) => item !== value) : [...(list.retired ?? []), value] })} />
                  <span>{specLabel(value, language)}{own ? ` · ${text("added by the project", "toegevoegd door het project")}` : ""}{locked ? ` · ${text("workbook standard", "standaard van het werkboek")}` : ""}</span>
                </label>
                {listKey === "risk_likelihoods" || listKey === "risk_severities" ? (
                  <input aria-label={text(`Definition of ${value}`, `Definitie van ${value}`)} placeholder={text("Project definition (shown beside the option)", "Projectdefinitie (naast de keuze getoond)")} value={list.descriptions?.[value] ?? ""} maxLength={240} onChange={(event) => setList({ descriptions: { ...list.descriptions, [value]: event.target.value } })} />
                ) : null}
                {own ? <button type="button" className="spec-chip-remove" aria-label={text(`Remove ${value}`, `${value} verwijderen`)} onClick={() => setList({ added: (list.added ?? []).filter((item) => item !== value) })}><X size={14} aria-hidden="true" /></button> : null}
              </li>
            );
          }) : <li>{text("No values yet.", "Nog geen waarden.")}</li>}
        </ul>
        </div>
        <div className="form-field spec-people-add">
          <input value={newValue} maxLength={listKey === "disciplines" ? 80 : 120} aria-label={text("New value", "Nieuwe waarde")} placeholder={text("New value", "Nieuwe waarde")} onChange={(event) => setNewValue(event.target.value)} />
          <span />
          <button type="button" className="ui-button ui-button--secondary ui-button--sm" disabled={!newValue.trim() || values.some((value) => value.toLowerCase() === newValue.trim().toLowerCase())} onClick={() => { setList({ added: [...(list.added ?? []), newValue.trim()] }); setNewValue(""); }}><Plus size={14} aria-hidden="true" /> {text("Add", "Toevoegen")}</button>
        </div>
      </div>

      <div className="operation-form">
        <div className="operation-form-heading"><div><h2>{text("HSE risk matrix", "HSE-risicomatrix")}</h2></div></div>
        <p className="form-helper">{text("Only a matrix approved by HSE management calculates the risk rating. Without it, the rating is chosen from the controlled list below.", "Alleen een door HSE-management goedgekeurde matrix berekent de risicoklasse. Zonder matrix wordt de klasse gekozen uit de lijst hieronder.")}</p>
        <label className="form-field">
          <span>{text("Rating list (one per line)", "Klassenlijst (één per regel)")}</span>
          <textarea rows={4} value={(matrix.ratings ?? ratings).join("\n")} onChange={(event) => setDraft((current) => ({ ...current, risk_matrix: { ...current.risk_matrix, ratings: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) } }))} />
        </label>
        <label className="spec-choice">
          <input type="checkbox" checked={Boolean(matrix.enabled)} onChange={(event) => setDraft((current) => ({ ...current, risk_matrix: { ...current.risk_matrix, enabled: event.target.checked } }))} />
          <span>{text("The matrix below is approved and calculates the rating", "De matrix hieronder is goedgekeurd en berekent de klasse")}</span>
        </label>
        <div className="form-field">
        <div className="spec-matrix" role="table" aria-label={text("Likelihood × severity", "Waarschijnlijkheid × ernst")}>
          <div role="row" className="spec-matrix-row">
            <span role="columnheader" />
            {severities.map((severity) => <span role="columnheader" key={severity}>{specLabel(severity, language)}</span>)}
          </div>
          {likelihoods.map((likelihood) => (
            <div role="row" className="spec-matrix-row" key={likelihood}>
              <span role="rowheader">{specLabel(likelihood, language)}</span>
              {severities.map((severity) => {
                const cell = `${likelihood}|${severity}`;
                return (
                  <select role="cell" key={cell} aria-label={`${likelihood} × ${severity}`} value={matrix.cells?.[cell] ?? ""} onChange={(event) => setDraft((current) => ({ ...current, risk_matrix: { ...current.risk_matrix, cells: { ...current.risk_matrix?.cells, [cell]: event.target.value } } }))}>
                    <option value="">—</option>
                    {ratings.map((rating) => <option key={rating} value={rating}>{rating}</option>)}
                  </select>
                );
              })}
            </div>
          ))}
        </div>
        </div>
      </div>

      <div className="operation-form">
        <div className="operation-form-heading"><div><h2>{text("Sign-off workflows", "Ondertekeningsworkflows")}</h2></div></div>
        <p className="form-helper">{text("Per step: who acts, how many approvals are needed before the record moves on, and which people may approve. Empty means the workbook's default: one approval by any reviewer.", "Per stap: wie handelt, hoeveel goedkeuringen nodig zijn voordat de registratie verder gaat, en wie mag goedkeuren. Leeg betekent de standaard van het werkboek: één goedkeuring door een beoordelaar.")}</p>
        <label className="form-field">
          <span>{text("Workflow profile", "Workflowprofiel")}</span>
          <select value={profileCode} onChange={(event) => setProfileCode(event.target.value)}>
            {Object.values(signoffProfiles).map((item) => <option key={item.code} value={item.code}>{item.code} · {item.label[language]}</option>)}
          </select>
        </label>
        {profile?.stages.map((stage) => {
          const own = workflow.stages?.[String(stage.number)] ?? {};
          return (
            <fieldset className="spec-rows" key={stage.number}>
              <legend>{stage.number} · {stage.label[language]}</legend>
              <div className="spec-stage-grid">
                <label className="form-field"><span>{text("Role (English)", "Rol (Engels)")}</span><input value={own.role_en ?? ""} placeholder={stage.role.en} maxLength={120} onChange={(event) => setStage(stage.number, { role_en: event.target.value })} /></label>
                <label className="form-field"><span>{text("Role (Dutch)", "Rol (Nederlands)")}</span><input value={own.role_nl ?? ""} placeholder={stage.role.nl} maxLength={120} onChange={(event) => setStage(stage.number, { role_nl: event.target.value })} /></label>
                <label className="form-field"><span>{text("Approvals needed", "Benodigde goedkeuringen")}</span><input type="number" min={1} max={9} value={own.required_approvals ?? ""} placeholder="1" onChange={(event) => setStage(stage.number, { required_approvals: event.target.value ? Number(event.target.value) : undefined })} /></label>
                <label className="form-field"><span>{text("Due in (days)", "Termijn (dagen)")}</span><input type="number" min={0} max={365} value={own.due_days ?? ""} onChange={(event) => setStage(stage.number, { due_days: event.target.value ? Number(event.target.value) : undefined })} /></label>
              </div>
              <fieldset className="spec-choices">
                <legend>{text("Named approvers (empty: any reviewer)", "Benoemde goedkeurders (leeg: elke beoordelaar)")}</legend>
                <div className="spec-choice-list">
                  {people.map((person) => (
                    <label className="spec-choice" key={person.id}>
                      <input type="checkbox" checked={(own.approver_user_ids ?? []).includes(person.id)} onChange={(event) => setStage(stage.number, { approver_user_ids: event.target.checked ? [...(own.approver_user_ids ?? []), person.id] : (own.approver_user_ids ?? []).filter((id) => id !== person.id) })} />
                      <span>{person.name}{person.role ? ` · ${person.role}` : ""}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </fieldset>
          );
        })}
        {profileCode === "CHANGE-APPROVAL" ? (
          <div className="form-grid form-grid-2">
            <label className="form-field"><span>{text("Approval limit (amount)", "Goedkeuringslimiet (bedrag)")}</span><input type="number" min={0} value={workflow.approval_limit ?? ""} onChange={(event) => setWorkflow({ approval_limit: event.target.value ? Number(event.target.value) : null })} /></label>
            <label className="form-field">
              <span>{text("Approvers above the limit", "Goedkeurders boven de limiet")}</span>
              <select multiple value={workflow.above_limit_user_ids ?? []} onChange={(event) => setWorkflow({ above_limit_user_ids: [...event.target.selectedOptions].map((option) => option.value) })}>
                {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </label>
          </div>
        ) : null}
        <fieldset className="spec-rows">
          <legend>{text("Delegations", "Delegaties")}</legend>
          {(workflow.delegations ?? []).map((delegation, index) => (
            <div className="form-grid form-grid-2" key={index}>
              <label className="form-field"><span>{text("Approver", "Goedkeurder")}</span><select value={delegation.from} onChange={(event) => setWorkflow({ delegations: (workflow.delegations ?? []).map((item, at) => at === index ? { ...item, from: event.target.value } : item) })}><option value="">—</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
              <label className="form-field"><span>{text("Delegated to", "Gedelegeerd aan")}</span><select value={delegation.to} onChange={(event) => setWorkflow({ delegations: (workflow.delegations ?? []).map((item, at) => at === index ? { ...item, to: event.target.value } : item) })}><option value="">—</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
              <label className="form-field"><span>{text("Until", "Tot en met")}</span><input type="date" value={delegation.until ?? ""} onChange={(event) => setWorkflow({ delegations: (workflow.delegations ?? []).map((item, at) => at === index ? { ...item, until: event.target.value } : item) })} /></label>
              <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => setWorkflow({ delegations: (workflow.delegations ?? []).filter((_, at) => at !== index) })}><X size={14} aria-hidden="true" /> {text("Remove", "Verwijderen")}</button>
            </div>
          ))}
          <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => setWorkflow({ delegations: [...(workflow.delegations ?? []), { from: "", to: "", until: "" }] })}><Plus size={14} aria-hidden="true" /> {text("Add a delegation", "Delegatie toevoegen")}</button>
        </fieldset>
      </div>

      <div className="record-form-actions">
        <button type="button" className="ui-button ui-button--primary ui-button--md" disabled={busy || !changed} onClick={() => void run(() => saveSpecConfiguration(client, projectId, cleanConfiguration(draft)), text("Specification settings saved.", "Specificatie-instellingen opgeslagen."))}>
          <Save size={15} aria-hidden="true" /> {text("Save specification settings", "Specificatie-instellingen opslaan")}
        </button>
      </div>
    </section>
  );
}

/** Drops empty stage settings and half-filled delegations before the settings are stored. */
function cleanConfiguration(configuration: SpecConfiguration): SpecConfiguration {
  const workflows = Object.fromEntries(Object.entries(configuration.workflows ?? {}).map(([code, workflow]) => [code, {
    ...workflow,
    delegations: (workflow.delegations ?? []).filter((item) => item.from && item.to),
    stages: Object.fromEntries(Object.entries(workflow.stages ?? {}).map(([stage, value]) => [stage, Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== "" && !(Array.isArray(item) && !item.length)))]).filter(([, value]) => Object.keys(value).length)),
  }]));
  return { ...configuration, workflows };
}
