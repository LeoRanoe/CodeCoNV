"use client";

import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ClipboardCheck,
  DatabaseBackup,
  FileCheck2,
  FileText,
  HardDrive,
  KeyRound,
  Loader2,
  PackageCheck,
  Plus,
  RotateCcw,
  Settings,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import NextImage from "next/image";
import { useEffect, useRef, useState } from "react";
import { VisualEvidenceWorkspace } from "@/app/visual-evidence-workspace";
import { useLanguage } from "@/lib/i18n";
import type { FormalReportSnapshot } from "@/lib/reports/daily-report-pdf";
import type { ProjectParty } from "@/lib/supabase/data";
import { downloadProjectFile, isStorageGatewayConfigured, uploadProjectFile } from "@/lib/storage/gateway";
import {
  createChecklist,
  createFinding,
  createHseEvent,
  createLocationNode,
  createProjectParty,
  createRegisterEntry,
  downloadManualBackup,
  finishInspection,
  loadProjectOperations,
  recordDistribution,
  reviewReport,
  saveProjectSettings,
  signReport,
  startInspection,
  startRevision,
  transitionFinding,
  updateProductionReadiness,
  validateBackupDryRun,
  type Finding,
  type Inspection,
  type OperationSnapshot,
  type ProductionReadinessItem,
} from "@/lib/supabase/operations";

type WorkspaceMode = "project" | "reports" | "admin";
type ProjectTab = "inspections" | "findings" | "hse" | "registers" | "visual" | "files";

const findingStatusLabels: Record<string, string> = {
  draft: "Concept",
  open: "Open",
  assigned: "Toegewezen",
  in_progress: "In uitvoering",
  ready_for_verification: "Gereed voor verificatie",
  closed: "Gesloten",
  rejected: "Afgewezen",
  reopened: "Heropend",
  cancelled: "Geannuleerd",
};

const findingStatusLabelsEnglish: Record<string, string> = {
  draft: "Draft", open: "Open", assigned: "Assigned", in_progress: "In progress",
  ready_for_verification: "Ready for verification", closed: "Closed", rejected: "Rejected",
  reopened: "Reopened", cancelled: "Cancelled",
};

const reportStatusLabels: Record<string, string> = {
  draft: "Concept",
  in_progress: "In uitvoering",
  ready_for_review: "Gereed voor review",
  in_review: "In review",
  approved: "Goedgekeurd",
  signed: "Ondertekend",
  sent: "Verzonden",
  revised: "Revisie",
  returned: "Teruggestuurd",
  cancelled: "Geannuleerd",
};

const reportStatusLabelsEnglish: Record<string, string> = {
  draft: "Draft", in_progress: "In progress", ready_for_review: "Ready for review",
  in_review: "In review", approved: "Approved", signed: "Signed", sent: "Sent",
  revised: "Revision", returned: "Returned", cancelled: "Cancelled",
};

const registerLabels: Record<string, string> = {
  equipment: "Materieel",
  delivery: "Levering",
  test: "Test / meting",
  variation: "Meer-/minderwerk",
  delay: "Vertraging",
  communication: "Communicatie / besluit",
  risk: "Risico",
  document: "Document",
  drawing: "Tekening",
  rfi: "RFI",
  submittal: "Submittal",
  site_instruction: "Site instruction",
  meeting: "Vergadering",
  correspondence: "Correspondentie",
  cost: "Kostenbewaking",
  declaration: "Aannemersdeclaratie",
};

const registerLabelsEnglish: Record<string, string> = {
  equipment: "Equipment", delivery: "Delivery", test: "Test / measurement", variation: "Variation",
  delay: "Delay", communication: "Communication / decision", risk: "Risk", document: "Document",
  drawing: "Drawing", rfi: "RFI", submittal: "Submittal", site_instruction: "Site instruction",
  meeting: "Meeting", correspondence: "Correspondence", cost: "Cost control", declaration: "Contractor payment claim",
};

function formatDate(value: string | null, locale = "en-GB") {
  if (!value) return "No date";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Paramaribo",
  }).format(new Date(value));
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "The operation was not completed.";
}

export function OperationalWorkspace({
  mode,
  client,
  organizationId,
  projectId,
  projectName,
  buildingId,
  buildingName,
  reportId,
  reportNumber,
  reportStatus,
  currentUserName,
  parties,
  canManageOrganization,
  openUserAdmin,
  initialProjectTab = "inspections",
  openProjectArea,
}: {
  mode: WorkspaceMode;
  client: SupabaseClient;
  organizationId: string;
  projectId: string;
  projectName: string;
  buildingId: string;
  buildingName: string;
  reportId: string | null;
  reportNumber: string;
  reportStatus: string;
  currentUserName: string;
  parties: ProjectParty[];
  canManageOrganization: boolean;
  openUserAdmin: () => void;
  initialProjectTab?: "inspections" | "findings" | "visual";
  openProjectArea: (tab: "inspections" | "findings" | "visual") => void;
}) {
  const { text } = useLanguage();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["project-operations", projectId, reportId],
    queryFn: () => loadProjectOperations(client, projectId, organizationId, reportId),
  });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["project-operations", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["project-day", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["workspace"] }),
    ]);
  };

  const run = async (operation: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
      setNotice(success);
      await refresh();
      return true;
    } catch (caught) {
      setError(messageFrom(caught));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (query.isLoading) {
    return <div className="operation-loading"><Loader2 className="spin" size={22} /> {text("Loading project records…", "Projectregisters laden…")}</div>;
  }
  if (query.error || !query.data) {
    return <div className="operation-alert error"><AlertTriangle size={18} /> {messageFrom(query.error)}</div>;
  }

  return (
    <>
      {error ? <div className="operation-alert error"><AlertTriangle size={17} /> {error}</div> : null}
      {notice ? <div className="operation-alert success"><CheckCircle2 size={17} /> {notice}</div> : null}
      {mode === "project" ? (
        <ProjectOperations
          data={query.data}
          reportId={reportId}
          projectId={projectId}
          projectName={projectName}
          buildingId={buildingId}
          buildingName={buildingName}
          parties={parties}
          client={client}
          busy={busy}
          run={run}
          initialTab={initialProjectTab}
        />
      ) : null}
      {mode === "reports" ? (
        <ReportOperations
          data={query.data}
          reportId={reportId}
          reportNumber={reportNumber}
          reportStatus={reportStatus}
          currentUserName={currentUserName}
          busy={busy}
          run={run}
          client={client}
        />
      ) : null}
      {mode === "admin" ? (
        <AdminOperations
          data={query.data}
          client={client}
          organizationId={organizationId}
          projectId={projectId}
          projectName={projectName}
          reportStatus={reportStatus}
          buildingId={buildingId}
          buildingName={buildingName}
          parties={parties}
          canManageOrganization={canManageOrganization}
          openUserAdmin={openUserAdmin}
          openProjectArea={openProjectArea}
          busy={busy}
          run={run}
        />
      ) : null}
    </>
  );
}

function ProjectOperations({
  data,
  reportId,
  projectId,
  projectName,
  buildingId,
  buildingName,
  parties,
  client,
  busy,
  run,
  initialTab,
}: {
  data: OperationSnapshot;
  reportId: string | null;
  projectId: string;
  projectName: string;
  buildingId: string;
  buildingName: string;
  parties: ProjectParty[];
  client: SupabaseClient;
  busy: boolean;
  run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>;
  initialTab: ProjectTab;
}) {
  const { language, locale, text } = useLanguage();
  const registerNames = language === "en" ? registerLabelsEnglish : registerLabels;
  const [tab, setTab] = useState<ProjectTab>(initialTab);
  const [showForm, setShowForm] = useState(false);
  const [activeInspection, setActiveInspection] = useState<Inspection | null>(null);
  const [inspectionTitle, setInspectionTitle] = useState("");
  const [inspectionTemplateId, setInspectionTemplateId] = useState("");
  const [inspectionAnswers, setInspectionAnswers] = useState<Record<string, { result: string; notes: string }>>({});
  const [findingForm, setFindingForm] = useState({ type: "deficiency", title: "", description: "", severity: "medium", responsiblePartyId: "" });
  const [hseForm, setHseForm] = useState({ type: "unsafe_condition", title: "", description: "", severity: "medium", immediateMeasure: "", confidential: false });
  const [registerForm, setRegisterForm] = useState({ type: "delivery", title: "", details: "", responsiblePartyId: "" });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState("photo");
  const [uploadProgress, setUploadProgress] = useState(0);
  const inspectionTemplates = data.templates.filter((template) => template.module === "inspection" && template.status === "published");
  const activeTemplate = data.templates.find((template) => template.id === activeInspection?.template_id);

  const switchTab = (next: ProjectTab) => {
    setTab(next);
    setShowForm(false);
    setActiveInspection(null);
  };

  const beginInspection = async () => {
    if (!reportId) return;
    const templateId = inspectionTemplateId || inspectionTemplates[0]?.id;
    if (!templateId || inspectionTitle.trim().length < 3) return;
    let created: Inspection | null = null;
    const okay = await run(async () => {
      created = await startInspection(client, { projectId, buildingId, reportId, templateId, title: inspectionTitle.trim() });
    }, text("Inspection started; complete every required checkpoint.", "Inspectie gestart; vul nu ieder verplicht controlepunt in."));
    if (okay && created) {
      setActiveInspection(created);
      const template = data.templates.find((item) => item.id === templateId);
      setInspectionAnswers(Object.fromEntries((template?.items ?? []).map((item) => [item.id, { result: "", notes: "" }])));
      setShowForm(false);
    }
  };

  const submitInspection = async () => {
    if (!activeInspection || !activeTemplate) return;
    if (activeTemplate.items.some((item) => item.required && !inspectionAnswers[item.id]?.result)) return;
    const okay = await run(
      () => finishInspection(client, activeInspection, inspectionAnswers),
      text("Inspection completed. Failed points were automatically recorded as findings.", "Inspectie afgerond. Afgekeurde punten zijn automatisch als bevinding vastgelegd."),
    );
    if (okay) {
      setActiveInspection(null);
      setInspectionTitle("");
    }
  };

  const addFinding = async () => {
    if (!reportId || findingForm.title.trim().length < 3 || findingForm.description.trim().length < 3) return;
    const okay = await run(
      () => createFinding(client, {
        projectId,
        buildingId,
        reportId,
        type: findingForm.type,
        title: findingForm.title,
        description: findingForm.description,
        severity: findingForm.severity,
        responsiblePartyId: findingForm.responsiblePartyId,
      }),
      text("Finding numbered, saved centrally and given a rule-driven deadline.", "Bevinding genummerd, centraal opgeslagen en van een regelgestuurde deadline voorzien."),
    );
    if (okay) {
      setFindingForm({ type: "deficiency", title: "", description: "", severity: "medium", responsiblePartyId: "" });
      setShowForm(false);
    }
  };

  const addHse = async () => {
    if (!reportId || hseForm.title.trim().length < 3 || hseForm.description.trim().length < 3) return;
    const okay = await run(
      () => createHseEvent(client, { projectId, buildingId, reportId, ...hseForm }),
      text("HSE event recorded centrally; urgent classifications were escalated.", "HSE-gebeurtenis centraal geregistreerd; urgente classificaties zijn geëscaleerd."),
    );
    if (okay) {
      setHseForm({ type: "unsafe_condition", title: "", description: "", severity: "medium", immediateMeasure: "", confidential: false });
      setShowForm(false);
    }
  };

  const addRegisterEntry = async () => {
    if (!reportId || registerForm.title.trim().length < 3) return;
    const okay = await run(
      () => createRegisterEntry(client, {
        projectId,
        buildingId,
        reportId,
        type: registerForm.type,
        title: registerForm.title,
        responsiblePartyId: registerForm.responsiblePartyId,
        details: { description: registerForm.details },
      }),
      text(`${registerNames[registerForm.type] ?? "Record"} was saved centrally and linked to the daily report.`, `${registerNames[registerForm.type] ?? "Registeritem"} centraal opgeslagen en aan het dagrapport gekoppeld.`),
    );
    if (okay) {
      setRegisterForm({ type: "delivery", title: "", details: "", responsiblePartyId: "" });
      setShowForm(false);
    }
  };

  return (
    <>
      <header className="secondary-header">
        <div><p className="eyebrow">{projectName} · {buildingName}</p><h1>{text("Project records", "Projectregisters")}</h1><p>{text("Inspections, quality, safety and evidence from one controlled source.", "Inspecties, kwaliteit, veiligheid en bewijs vanuit één centrale bron.")}</p></div>
        {tab !== "files" && tab !== "visual" && !activeInspection ? <button className="primary-button" type="button" onClick={() => setShowForm((value) => !value)}><Plus size={15} /> {text("New record", "Nieuwe registratie")}</button> : null}
      </header>
      <div className="operation-tabs" role="tablist" aria-label={text("Project records", "Projectregisters")}>
        {([
          ["inspections", text("Inspections", "Inspecties"), data.inspections.length],
          ["findings", text("Findings / NCR", "Bevindingen / NCR"), data.findings.filter((item) => item.status !== "closed").length],
          ["hse", "HSE", data.hseEvents.length],
          ["registers", text("Other records", "Overige registers"), data.registerEntries.length],
          ["visual", text("Visual evidence", "Visueel bewijs"), data.visualCaptures.length],
          ["files", text("Files", "Bestanden"), data.files.length],
        ] as Array<[ProjectTab, string, number]>).map(([id, label, count]) => (
          <button className={tab === id ? "active" : ""} type="button" role="tab" aria-selected={tab === id} onClick={() => switchTab(id)} key={id}>{label}<span>{count}</span></button>
        ))}
      </div>

      {tab === "inspections" ? (
        <section className="operation-panel">
          {activeInspection && activeTemplate ? (
            <div className="operation-form wide">
              <div className="operation-form-heading"><div><span className="record-number">{activeInspection.inspection_number}</span><h2>{activeInspection.title}</h2></div><span className="task-status">{text("In progress", "In uitvoering")}</span></div>
              <p className="form-intro">{text("Answer every required checkpoint. A failed point automatically creates a traceable finding on completion; the app never closes it by itself.", "Beantwoord alle verplichte controlepunten. Een afkeur maakt bij afronding automatisch een traceerbare bevinding; de app sluit die nooit zelf.")}</p>
              <div className="checklist-run">
                {activeTemplate.items.map((item) => {
                  const current = inspectionAnswers[item.id] ?? { result: "", notes: "" };
                  return (
                    <fieldset className="checklist-question" key={item.id}>
                      <legend><span>{item.section}</span>{item.prompt}{item.required ? " *" : ""}</legend>
                      {item.guidance ? <small>{item.guidance}</small> : null}
                      <div className="answer-options">
                        {(item.response_type === "yes_no_na" ? [["yes", text("Yes", "Ja")], ["no", text("No", "Nee")], ["na", text("N/A", "N.v.t.")]] : [["pass", text("Pass", "Akkoord")], ["fail", text("Fail", "Niet akkoord")], ["na", text("N/A", "N.v.t.")]]).map(([value, label]) => (
                          <label key={value}><input type="radio" name={item.id} value={value} checked={current.result === value} onChange={() => setInspectionAnswers((answers) => ({ ...answers, [item.id]: { ...current, result: value } }))} /> {label}</label>
                        ))}
                      </div>
                      <input value={current.notes} onChange={(event) => setInspectionAnswers((answers) => ({ ...answers, [item.id]: { ...current, notes: event.target.value } }))} placeholder={text("Comment or evidence reference", "Opmerking of bewijsreferentie")} />
                    </fieldset>
                  );
                })}
              </div>
              <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setActiveInspection(null)}>{text("Complete later", "Later afronden")}</button><button className="primary-button" type="button" disabled={busy || activeTemplate.items.some((item) => item.required && !inspectionAnswers[item.id]?.result)} onClick={() => void submitInspection()}>{busy ? <Loader2 className="spin" size={15} /> : <FileCheck2 size={15} />} {text("Complete inspection", "Inspectie afronden")}</button></div>
            </div>
          ) : null}
          {showForm && !activeInspection ? (
            <div className="operation-form">
              <h2>{text("Start inspection", "Inspectie starten")}</h2>
              {!reportId ? <p className="inline-error">{text("Start the daily report through Project start first.", "Start eerst het dagrapport via Projectstart.")}</p> : null}
              <label className="form-field"><span>{text("Checklist", "Checklist")}</span><select value={inspectionTemplateId || inspectionTemplates[0]?.id || ""} onChange={(event) => setInspectionTemplateId(event.target.value)}>{inspectionTemplates.map((template) => <option value={template.id} key={template.id}>{template.name} · v{template.version_number}</option>)}</select></label>
              <label className="form-field"><span>{text("Subject / element", "Onderwerp / element")}</span><input value={inspectionTitle} onChange={(event) => setInspectionTitle(event.target.value)} placeholder={text("For example foundation reinforcement axes A-D", "Bijv. wapening fundering as A-D")} /></label>
              <button className="primary-button" type="button" disabled={busy || !reportId || inspectionTitle.trim().length < 3} onClick={() => void beginInspection()}><ClipboardCheck size={15} /> {text("Start checklist", "Start checklist")}</button>
            </div>
          ) : null}
          <RecordList empty={text("No formal inspections yet.", "Nog geen formele inspecties.")} rows={data.inspections.map((inspection) => ({
            id: inspection.id,
            icon: ClipboardCheck,
            title: inspection.title,
            meta: `${inspection.inspection_number} · ${formatDate(inspection.completed_at ?? inspection.started_at, locale)}`,
            status: inspection.status.replaceAll("_", " "),
            tone: inspection.status === "passed" ? "green" : inspection.status === "failed" ? "red" : "",
          }))} />
        </section>
      ) : null}

      {tab === "findings" ? (
        <section className="operation-panel">
          {showForm ? (
            <div className="operation-form">
              <h2>{text("Record finding / NCR", "Bevinding / NCR registreren")}</h2>
              <div className="form-grid-2">
                <label className="form-field"><span>{text("Type", "Type")}</span><select value={findingForm.type} onChange={(event) => setFindingForm({ ...findingForm, type: event.target.value })}><option value="observation">{text("Observation", "Observatie")}</option><option value="deficiency">{text("Deficiency", "Tekortkoming")}</option><option value="deviation">{text("Deviation", "Afwijking")}</option><option value="ncr">NCR</option><option value="improvement">{text("Improvement opportunity", "Verbeterkans")}</option></select></label>
                <label className="form-field"><span>{text("Severity", "Ernst")}</span><select value={findingForm.severity} onChange={(event) => setFindingForm({ ...findingForm, severity: event.target.value })}><option value="low">{text("Low · 14 days", "Laag · 14 dagen")}</option><option value="medium">{text("Medium · 7 days", "Middel · 7 dagen")}</option><option value="high">{text("High · 3 days", "Hoog · 3 dagen")}</option><option value="critical">{text("Critical · 1 day + escalation", "Kritiek · 1 dag + escalatie")}</option></select></label>
              </div>
              <label className="form-field"><span>{text("Title", "Titel")}</span><input value={findingForm.title} onChange={(event) => setFindingForm({ ...findingForm, title: event.target.value })} /></label>
              <label className="form-field"><span>{text("Factual description", "Feitelijke omschrijving")}</span><textarea value={findingForm.description} onChange={(event) => setFindingForm({ ...findingForm, description: event.target.value })} rows={3} /></label>
              <label className="form-field"><span>{text("Responsible party", "Verantwoordelijke partij")}</span><select value={findingForm.responsiblePartyId} onChange={(event) => setFindingForm({ ...findingForm, responsiblePartyId: event.target.value })}><option value="">{text("Not assigned", "Nog niet toegewezen")}</option>{parties.map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}</select></label>
              <button className="primary-button" type="button" disabled={busy || !reportId || findingForm.title.trim().length < 3 || findingForm.description.trim().length < 3} onClick={() => void addFinding()}><AlertTriangle size={15} /> {text("Save finding", "Bevinding opslaan")}</button>
            </div>
          ) : null}
          <FindingList findings={data.findings} busy={busy} transition={(finding, nextStatus, note, finalMeasure) => run(() => transitionFinding(client, finding.id, nextStatus, note, finalMeasure), `Bevinding ${finding.finding_number} staat nu op ${findingStatusLabels[nextStatus] ?? nextStatus}.`)} />
        </section>
      ) : null}

      {tab === "hse" ? (
        <section className="operation-panel">
          {showForm ? (
            <div className="operation-form">
              <h2>{text("HSE observation or incident", "HSE-observatie of incident")}</h2>
              <div className="form-grid-2">
                <label className="form-field"><span>{text("Type", "Type")}</span><select value={hseForm.type} onChange={(event) => setHseForm({ ...hseForm, type: event.target.value })}><option value="positive_observation">{text("Positive observation", "Positieve observatie")}</option><option value="unsafe_act">{text("Unsafe act", "Onveilige handeling")}</option><option value="unsafe_condition">{text("Unsafe condition", "Onveilige situatie")}</option><option value="near_miss">Near miss</option><option value="incident">Incident</option><option value="stop_work">Stop work</option><option value="toolbox">Toolbox meeting</option></select></label>
                <label className="form-field"><span>{text("Severity", "Ernst")}</span><select value={hseForm.severity} onChange={(event) => setHseForm({ ...hseForm, severity: event.target.value })}><option value="low">{text("Low", "Laag")}</option><option value="medium">{text("Medium", "Middel")}</option><option value="high">{text("High", "Hoog")}</option><option value="critical">{text("Critical", "Kritiek")}</option></select></label>
              </div>
              <label className="form-field"><span>{text("Title", "Titel")}</span><input value={hseForm.title} onChange={(event) => setHseForm({ ...hseForm, title: event.target.value })} /></label>
              <label className="form-field"><span>{text("What was observed?", "Wat is waargenomen?")}</span><textarea value={hseForm.description} onChange={(event) => setHseForm({ ...hseForm, description: event.target.value })} rows={3} /></label>
              <label className="form-field"><span>{text("Immediate measure", "Directe maatregel")}</span><textarea value={hseForm.immediateMeasure} onChange={(event) => setHseForm({ ...hseForm, immediateMeasure: event.target.value })} rows={2} /></label>
              <label className="check-field"><input type="checkbox" checked={hseForm.confidential} onChange={(event) => setHseForm({ ...hseForm, confidential: event.target.checked })} /> {text("Restrict this sensitive incident to authorized HSE roles", "Beperk dit gevoelige incident tot bevoegde HSE-rollen")}</label>
              <button className="primary-button" type="button" disabled={busy || !reportId || hseForm.title.trim().length < 3 || hseForm.description.trim().length < 3} onClick={() => void addHse()}><ShieldCheck size={15} /> {text("Save HSE record", "HSE-registratie opslaan")}</button>
            </div>
          ) : null}
          <RecordList empty={text("No formal HSE records yet.", "Nog geen formele HSE-registraties.")} rows={data.hseEvents.map((event) => ({ id: event.id, icon: ShieldCheck, title: event.confidential ? `${event.title} · ${text("confidential", "vertrouwelijk")}` : event.title, meta: `${event.event_number} · ${event.event_type.replaceAll("_", " ")} · ${formatDate(event.occurred_at, locale)}`, status: event.status.replaceAll("_", " "), tone: event.severity === "critical" ? "red" : event.status === "closed" ? "green" : "" }))} />
        </section>
      ) : null}

      {tab === "registers" ? (
        <section className="operation-panel">
          {showForm ? (
            <div className="operation-form">
              <h2>{text("Add project register item", "Projectregister aanvullen")}</h2>
              <label className="form-field"><span>{text("Register", "Register")}</span><select value={registerForm.type} onChange={(event) => setRegisterForm({ ...registerForm, type: event.target.value })}>{Object.entries(registerNames).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label className="form-field"><span>{text("Title / reference", "Titel / referentie")}</span><input value={registerForm.title} onChange={(event) => setRegisterForm({ ...registerForm, title: event.target.value })} /></label>
              <label className="form-field"><span>{text("Details, quantity, measure or decision", "Details, hoeveelheid, maatregel of besluit")}</span><textarea value={registerForm.details} onChange={(event) => setRegisterForm({ ...registerForm, details: event.target.value })} rows={3} /></label>
              <label className="form-field"><span>{text("Involved party", "Betrokken partij")}</span><select value={registerForm.responsiblePartyId} onChange={(event) => setRegisterForm({ ...registerForm, responsiblePartyId: event.target.value })}><option value="">{text("Not assigned", "Niet toegewezen")}</option>{parties.map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}</select></label>
              <button className="primary-button" type="button" disabled={busy || !reportId || registerForm.title.trim().length < 3} onClick={() => void addRegisterEntry()}><PackageCheck size={15} /> {text("Save register item", "Registeritem opslaan")}</button>
            </div>
          ) : null}
          <div className="register-summary-grid">{Object.entries(registerNames).map(([type, label]) => <div className="register-summary" key={type}><strong>{data.registerEntries.filter((entry) => entry.register_type === type).length}</strong><span>{label}</span></div>)}</div>
          <RecordList empty={text("No additional project registers yet.", "Nog geen aanvullende projectregisters.")} rows={data.registerEntries.map((entry) => ({ id: entry.id, icon: Wrench, title: entry.title, meta: `${entry.entry_number} · ${registerNames[entry.register_type] ?? entry.register_type} · ${formatDate(entry.occurred_at, locale)}`, status: entry.status, tone: entry.status === "closed" || entry.status === "approved" ? "green" : "" }))} />
        </section>
      ) : null}

      {tab === "visual" ? <VisualEvidenceWorkspace data={data} projectId={projectId} buildingId={buildingId} reportId={reportId} parties={parties} client={client} busy={busy} run={run} /> : null}

      {tab === "files" ? (
        <section className="operation-panel">
          {!isStorageGatewayConfigured ? <div className="operation-alert warning"><HardDrive size={18} /><div><strong>{text("Private Vercel Blob storage required", "Private Vercel Blob-opslag vereist")}</strong><span>{text("Connect a private Blob store to the Vercel project before uploading files.", "Koppel een private Blob-store aan het Vercel-project voordat bestanden worden geüpload.")}</span></div></div> : (
            <div className="operation-form">
              <h2>{text("Upload file to private CODECO storage", "Bestand naar private CODECO-opslag uploaden")}</h2>
              <div className="form-grid-2"><label className="form-field"><span>{text("Category", "Categorie")}</span><select value={uploadCategory} onChange={(event) => setUploadCategory(event.target.value)}><option value="photo">{text("Photo", "Foto")}</option><option value="document">Document</option><option value="certificate">{text("Certificate", "Certificaat")}</option><option value="drawing">{text("Drawing", "Tekening")}</option><option value="evidence">{text("Repair evidence", "Herstelbewijs")}</option></select></label><label className="form-field"><span>{text("File", "Bestand")} · max. {data.settings?.max_file_size_mb ?? 25} MB</span><input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} /></label></div>
              {uploadProgress > 0 ? <div className="upload-progress" aria-label={`Upload ${uploadProgress}%`}><span style={{ width: `${uploadProgress}%` }} /><small>{uploadProgress}%</small></div> : null}
              <button className="primary-button" type="button" disabled={busy || !uploadFile || uploadFile.size > (data.settings?.max_file_size_mb ?? 25) * 1024 * 1024} onClick={() => uploadFile && void run(() => uploadProjectFile(client, { projectId, buildingId, category: uploadCategory, file: uploadFile, onProgress: setUploadProgress }), text("File authorized and stored in private Vercel Blob.", "Bestand geautoriseerd en in private Vercel Blob opgeslagen.")).then((okay) => { if (okay) { setUploadFile(null); setUploadProgress(0); } })}><HardDrive size={15} /> {text("Start secure upload", "Veilige upload starten")}</button>
            </div>
          )}
          {data.files.length === 0 ? <div className="empty-list-state"><FileText size={22} /><strong>{text("No files yet", "Nog geen bestanden")}</strong><span>{text("Photos, drawings, certificates and evidence appear here without public storage links.", "Foto’s, tekeningen, certificaten en bewijs verschijnen hier zonder openbare opslaglinks.")}</span></div> : <div className="record-stack">{data.files.map((file) => <button className="record-row file-record-row" type="button" disabled={file.status !== "available" || !isStorageGatewayConfigured} onClick={() => void run(() => downloadProjectFile(client, file.id, file.original_name), text("Authorized download started.", "Geautoriseerde download gestart."))} key={file.id}><span className="action-icon"><FileText size={18} /></span><div><strong>{file.original_name}</strong><span>{file.category} · {(file.size_bytes / 1_000_000).toFixed(1)} MB · {formatDate(file.created_at, locale)}</span></div><span className={`task-status ${file.status === "available" ? "green" : ""}`}>{file.status}</span></button>)}</div>}
        </section>
      ) : null}
    </>
  );
}

function FindingList({ findings, busy, transition }: { findings: Finding[]; busy: boolean; transition: (finding: Finding, nextStatus: string, note: string, finalMeasure: string) => Promise<boolean> }) {
  const { language, locale, text } = useLanguage();
  const statusLabels = language === "en" ? findingStatusLabelsEnglish : findingStatusLabels;
  const [active, setActive] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [measure, setMeasure] = useState("");
  const next: Record<string, string> = { open: "in_progress", assigned: "in_progress", reopened: "in_progress", in_progress: "ready_for_verification", ready_for_verification: "closed" };
  return (
    <div className="record-stack">
      {findings.length === 0 ? <div className="empty-list-state"><CheckCircle2 size={22} /><strong>{text("No findings yet", "Nog geen bevindingen")}</strong><span>{text("Failed inspection points and manual NCRs appear here.", "Afgekeurde inspectiepunten en handmatige NCR’s verschijnen hier.")}</span></div> : null}
      {findings.map((finding) => {
        const nextStatus = next[finding.status];
        return (
          <article className="finding-card" key={finding.id}>
            <div className="finding-card-main"><span className={`record-severity ${finding.severity}`}>{finding.severity}</span><div><span className="record-number">{finding.finding_number} · {finding.finding_type.toUpperCase()}</span><h3>{finding.title}</h3><p>{finding.description}</p><small>Deadline {formatDate(finding.due_at, locale)}{finding.verified_at ? ` · ${text("verified", "geverifieerd")} ${formatDate(finding.verified_at, locale)}` : ""}</small></div><span className={`task-status ${finding.status === "closed" ? "green" : finding.severity === "critical" ? "red" : ""}`}>{statusLabels[finding.status] ?? finding.status}</span></div>
            {nextStatus ? <div className="finding-actions"><button className="secondary-button" type="button" onClick={() => setActive(active === finding.id ? null : finding.id)}>{nextStatus === "closed" ? text("Verify", "Verifiëren") : nextStatus === "ready_for_verification" ? text("Mark repair ready", "Herstel gereedmelden") : text("Update status", "Status bijwerken")}</button></div> : null}
            {active === finding.id && nextStatus ? (
              <div className="inline-transition">
                {nextStatus === "ready_for_verification" ? <label className="form-field"><span>{text("Final measure", "Definitieve maatregel")}</span><textarea rows={2} value={measure} onChange={(event) => setMeasure(event.target.value)} /></label> : null}
                <label className="form-field"><span>{nextStatus === "closed" ? text("Verification finding", "Verificatiebevinding") : text("Comment", "Toelichting")}</span><textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} /></label>
                <button className="primary-button" type="button" disabled={busy || note.trim().length < 2 || (nextStatus === "ready_for_verification" && measure.trim().length < 3)} onClick={() => void transition(finding, nextStatus, note, measure).then((okay) => { if (okay) { setActive(null); setNote(""); setMeasure(""); } })}>{text("Confirm human status change", "Bevestig menselijke statuswijziging")}</button>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function ReportOperations({ data, reportId, reportNumber, reportStatus, currentUserName, busy, run, client }: { data: OperationSnapshot; reportId: string | null; reportNumber: string; reportStatus: string; currentUserName: string; busy: boolean; run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>; client: SupabaseClient }) {
  const { language, locale, text } = useLanguage();
  const statusLabels = language === "en" ? reportStatusLabelsEnglish : reportStatusLabels;
  const [reviewComment, setReviewComment] = useState("");
  const [signerRole, setSignerRole] = useState("supervisor");
  const [declaration, setDeclaration] = useState(() => text("I declare that I reviewed this fixed report version and confirmed it truthfully.", "Ik verklaar dat ik deze vastgezette rapportversie heb gecontroleerd en naar waarheid heb bevestigd."));
  const [distribution, setDistribution] = useState({ name: "", address: "", channel: "manual" });
  const [revisionReason, setRevisionReason] = useState("");
  const canReview = reportStatus === "ready_for_review" || reportStatus === "in_review";
  const canSign = reportStatus === "approved" || reportStatus === "signed";
  const canDistribute = reportStatus === "signed" || reportStatus === "sent";
  return (
    <>
      <header className="secondary-header"><div><p className="eyebrow">{text("Formal report workflow", "Formele rapportworkflow")}</p><h1>{reportNumber}</h1><p>{text("Immutable version, review, declarations, distribution and revision history.", "Immutable versie, review, verklaringen, distributie en revisiehistorie.")}</p></div><span className={`report-state-pill ${reportStatus}`}>{statusLabels[reportStatus] ?? reportStatus}</span></header>
      {!reportId ? <div className="operation-alert warning"><AlertTriangle size={18} /> {text("Start the daily report through Project start first.", "Start eerst het dagrapport via Projectstart.")}</div> : null}
      <section className="workflow-grid">
        <div className="workflow-card"><div className="workflow-icon"><ClipboardCheck size={19} /></div><h2>1. Review</h2><p>{text("An authorized reviewer approves or returns the report with a reason. Approval automatically freezes the complete snapshot with SHA-256.", "Een bevoegde reviewer keurt goed of stuurt gemotiveerd terug. Bij goedkeuring bevriest de database automatisch de volledige momentopname met SHA-256.")}</p><label className="form-field"><span>{text("Review comment", "Reviewcommentaar")}</span><textarea rows={3} value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} /></label><div className="button-row"><button className="secondary-button" type="button" disabled={busy || !reportId || !canReview || reviewComment.trim().length < 2} onClick={() => void run(() => reviewReport(client, reportId!, "returned", reviewComment), text("Report returned for correction with a reason.", "Rapport gemotiveerd teruggestuurd voor correctie."))}>{text("Return", "Terugsturen")}</button><button className="primary-button" type="button" disabled={busy || !reportId || !canReview || reviewComment.trim().length < 2} onClick={() => void run(() => reviewReport(client, reportId!, "approved", reviewComment), text("Report approved and frozen as an immutable version.", "Rapport goedgekeurd en als immutable versie vastgezet."))}><FileCheck2 size={15} /> {text("Approve and freeze", "Goedkeuren & vastzetten")}</button></div></div>
        <div className="workflow-card"><div className="workflow-icon"><FileCheck2 size={19} /></div><h2>2. {text("Signing declaration", "Ondertekenverklaring")}</h2><p>{text("Identity, project role, version hash and declaration remain append-only. The legal level remains", "Identiteit, projectrol, versiehash en verklaring blijven append-only bewaard. Het juridische niveau blijft")} <strong>contract pending</strong> {text("until CODECO formally decides.", "totdat CODECO dit formeel kiest.")}</p><label className="form-field"><span>{text("Sign as", "Onderteken als")}</span><select value={signerRole} onChange={(event) => setSignerRole(event.target.value)}><option value="supervisor">Supervisor</option><option value="project_manager">{text("Project manager", "Projectleider")}</option><option value="lead_supervisor">Lead supervisor</option><option value="contractor">{text("Contractor", "Aannemer")}</option><option value="client">{text("Client", "Opdrachtgever")}</option><option value="quality_hse_manager">{text("Quality/HSE", "Kwaliteit/HSE")}</option></select></label><label className="form-field"><span>{text("Declaration", "Verklaring")}</span><textarea rows={3} value={declaration} onChange={(event) => setDeclaration(event.target.value)} /></label><button className="primary-button" type="button" disabled={busy || !reportId || !canSign || declaration.trim().length < 10} onClick={() => void run(() => signReport(client, reportId!, signerRole, currentUserName, declaration), text("Signing declaration immutably linked to the report version.", "Ondertekenverklaring onveranderbaar aan de rapportversie gekoppeld."))}><FileCheck2 size={15} /> {text("Record declaration", "Verklaring vastleggen")}</button></div>
        <div className="workflow-card"><div className="workflow-icon"><Users size={19} /></div><h2>3. {text("Distribution", "Distributie")}</h2><p>{text("Only record a delivery that actually occurred. Without an email connector, the app does not claim automatic delivery.", "Registreer alleen een verzending die werkelijk heeft plaatsgevonden. De app claimt zonder e-mailconnector geen automatische bezorging.")}</p><label className="form-field"><span>{text("Recipient", "Ontvanger")}</span><input value={distribution.name} onChange={(event) => setDistribution({ ...distribution, name: event.target.value })} /></label><label className="form-field"><span>{text("Address / reference", "Adres / referentie")}</span><input value={distribution.address} onChange={(event) => setDistribution({ ...distribution, address: event.target.value })} /></label><label className="form-field"><span>{text("Channel", "Kanaal")}</span><select value={distribution.channel} onChange={(event) => setDistribution({ ...distribution, channel: event.target.value })}><option value="manual">{text("Manual transfer", "Handmatige overdracht")}</option><option value="email">{text("Email (sent externally)", "E-mail (extern verzonden)")}</option><option value="download">{text("Secure download", "Beveiligde download")}</option></select></label><button className="primary-button" type="button" disabled={busy || !reportId || !canDistribute || distribution.name.trim().length < 2 || distribution.address.trim().length < 3} onClick={() => void run(() => recordDistribution(client, reportId!, distribution.name, distribution.address, distribution.channel), text("Traceable distribution record added to the fixed version.", "Aantoonbare distributieregel aan de vastgezette versie toegevoegd."))}><FileText size={15} /> {text("Record distribution", "Distributie registreren")}</button></div>
      </section>
      <section className="report-history-grid">
        <HistoryColumn title={text("Fixed versions", "Vastgezette versies")} empty={text("No immutable version yet.", "Nog geen immutable versie.")} rows={data.reportVersions.map((version) => <div className="history-version" key={version.id}><span>{text("Revision", "Revisie")} {version.revision} · {formatDate(version.created_at, locale)} · SHA {version.sha256.slice(0, 12)}…</span><button className="secondary-button" type="button" disabled={busy} onClick={() => void run(async () => { const { downloadFormalReportPdf } = await import("@/lib/reports/daily-report-pdf"); await downloadFormalReportPdf(version.snapshot as FormalReportSnapshot, version.revision, version.sha256); }, text(`Formal revision ${version.revision} downloaded directly from the immutable snapshot.`, `Formele revisie ${version.revision} rechtstreeks uit de immutable snapshot gedownload.`))}><FileText size={14} /> {text("Formal PDF", "Formele PDF")}</button></div>)} />
        <HistoryColumn title="Reviews" empty={text("No review decision yet.", "Nog geen reviewbesluit.")} rows={data.reportReviews.map((review) => `${statusLabels[review.decision] ?? review.decision} · ${review.comment} · ${formatDate(review.created_at, locale)}`)} />
        <HistoryColumn title={text("Declarations", "Verklaringen")} empty={text("No signing declaration yet.", "Nog geen ondertekenverklaring.")} rows={data.reportSignatures.map((signature) => `${signature.signer_name} · ${signature.signer_role} · ${formatDate(signature.signed_at, locale)}`)} />
        <HistoryColumn title={text("Distribution", "Distributie")} empty={text("No delivery recorded yet.", "Nog geen verzending geregistreerd.")} rows={data.reportDistributions.map((item) => `${item.recipient_name} · ${item.channel} · ${item.status}`)} />
      </section>
      {reportStatus === "approved" || reportStatus === "signed" || reportStatus === "sent" ? <div className="revision-bar"><div><strong>{text("Correction after freezing?", "Correctie na vastzetten?")}</strong><span>{text("The original version remains; corrections start a new revision.", "De oorspronkelijke versie blijft bestaan; correcties starten een nieuwe revisie.")}</span></div><input value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} placeholder={text("Required revision reason", "Verplichte revisiereden")} /><button className="secondary-button" type="button" disabled={busy || !reportId || revisionReason.trim().length < 5} onClick={() => void run(() => startRevision(client, reportId!, revisionReason), text("New report revision started; the original version remains immutable.", "Nieuwe rapportrevisie gestart; de oorspronkelijke versie blijft immutable."))}><RotateCcw size={15} /> {text("Start revision", "Start revisie")}</button></div> : null}
    </>
  );
}

function AdminOperations({ data, client, organizationId, projectId, projectName, reportStatus, buildingId, buildingName, parties, canManageOrganization, openUserAdmin, openProjectArea, busy, run }: { data: OperationSnapshot; client: SupabaseClient; organizationId: string; projectId: string; projectName: string; reportStatus: string; buildingId: string; buildingName: string; parties: ProjectParty[]; canManageOrganization: boolean; openUserAdmin: () => void; openProjectArea: (tab: "inspections" | "findings" | "visual") => void; busy: boolean; run: (operation: () => Promise<unknown>, success: string) => Promise<boolean> }) {
  const { text } = useLanguage();
  const [section, setSection] = useState<"overview" | "readiness" | "settings" | "structure" | "templates" | "backup">("overview");
  const [template, setTemplate] = useState({ module: "inspection", code: "", name: "", prompts: "" });
  const [settings, setSettings] = useState(() => ({ maxFileSizeMb: data.settings?.max_file_size_mb ?? 25, leadHours: data.settings?.notification_lead_hours ?? 24, retentionDays: data.settings?.retention_days?.toString() ?? "", reportPrefix: data.settings?.report_prefix ?? "DR" }));
  const [location, setLocation] = useState({ type: "zone", code: "", name: "", parentId: "", description: "" });
  const [party, setParty] = useState({ type: "contractor", code: "", name: "" });
  const fileInput = useRef<HTMLInputElement>(null);
  const latestScheduledBackup = data.backupRuns.find((item) => item.run_type === "scheduled" && item.status === "verified");
  const latestRestoreTest = data.backupRuns.find((item) => item.run_type === "restore_test" && item.status === "dry_run_passed");
  const openFindings = data.findings.filter((item) => !["closed", "cancelled"].includes(item.status));
  const criticalFindings = openFindings.filter((item) => item.severity === "critical" || item.severity === "high");
  const activeInspections = data.inspections.filter((item) => item.status === "planned" || item.status === "in_progress" || item.status === "failed");
  const readinessDone = data.productionReadiness.filter((item) => item.status === "done" || item.status === "not_applicable").length;
  const readinessPercent = data.productionReadiness.length ? Math.round((readinessDone / data.productionReadiness.length) * 100) : 0;
  const addTemplate = () => {
    const prompts = template.prompts.split("\n").map((value) => value.trim()).filter(Boolean);
    if (template.code.trim().length < 2 || template.name.trim().length < 3 || prompts.length === 0) return;
    void run(() => createChecklist(client, { organizationId, projectId, module: template.module, code: template.code, name: template.name, prompts }), text("Project checklist published; existing inspection results remain linked to their previous version.", "Projectchecklist gepubliceerd; bestaande inspectieresultaten blijven aan hun oude versie gekoppeld.")).then((okay) => { if (okay) setTemplate({ module: "inspection", code: "", name: "", prompts: "" }); });
  };
  return (
    <>
      <header className="secondary-header"><div><p className="eyebrow">{text("Management workspace", "Managementwerkruimte")} · {projectName}</p><h1>{section === "overview" ? text("Management overview", "Managementoverzicht") : text("Administration and control", "Beheer en controle")}</h1><p>{text("Decisions, access, project standards and continuity in one place.", "Besluiten, toegang, projectstandaarden en continuïteit op één plek.")}</p></div>{canManageOrganization ? <button className="primary-button" type="button" onClick={openUserAdmin}><Users size={15} /> {text("Manage team", "Team beheren")}</button> : null}</header>
      <div className="operation-tabs admin-tabs">{[["overview", text("Overview", "Overzicht")], ["settings", text("Team & rules", "Team & regels")], ["structure", text("Project setup", "Projectinrichting")], ["templates", text("Quality standards", "Kwaliteitsstandaarden")], ["readiness", text("Go-live", "Go-live")], ["backup", text("Continuity", "Continuïteit")]].map(([id, label]) => <button className={section === id ? "active" : ""} type="button" onClick={() => setSection(id as typeof section)} key={id}>{label}</button>)}</div>
      {section === "overview" ? <section className="management-overview">
        <div className="management-kpis">
          <button type="button" onClick={() => setSection("readiness")}><span>{text("Go-live readiness", "Go-live gereedheid")}</span><strong>{readinessPercent}%</strong><small>{readinessDone}/{data.productionReadiness.length} {text("controls complete", "controles gereed")}</small></button>
          <button className={criticalFindings.length ? "attention" : ""} type="button" onClick={() => openProjectArea("findings")}><span>{text("High-risk findings", "Hoog-risico bevindingen")}</span><strong>{criticalFindings.length}</strong><small>{openFindings.length} {text("findings still open", "bevindingen nog open")}</small></button>
          <button type="button" onClick={() => openProjectArea("inspections")}><span>{text("Active control work", "Actief controlewerk")}</span><strong>{activeInspections.length}</strong><small>{data.inspections.length} {text("inspections recorded", "inspecties geregistreerd")}</small></button>
          <button className={latestScheduledBackup ? "healthy" : "attention"} type="button" onClick={() => setSection("backup")}><span>{text("Continuity", "Continuïteit")}</span><strong>{latestScheduledBackup ? text("Verified", "Geverifieerd") : text("Pending", "Openstaand")}</strong><small>{latestScheduledBackup ? formatDate(latestScheduledBackup.verified_at) : text("Verified backup required", "Geverifieerde back-up vereist")}</small></button>
        </div>
        <div className="management-columns">
          <article className="management-card"><header><div><span className="module-card-icon"><AlertTriangle size={18} /></span><div><h2>{text("Management attention", "Managementaandacht")}</h2><p>{text("Items that may block delivery or control.", "Punten die oplevering of beheersing kunnen blokkeren.")}</p></div></div></header><div className="management-attention-list">{criticalFindings.length ? criticalFindings.slice(0, 4).map((item) => <div key={item.id}><span className="risk-dot" /><span><strong>{item.title}</strong><small>{item.finding_number} · {item.status.replaceAll("_", " ")}</small></span></div>) : <div className="management-clear"><CheckCircle2 size={18} /><span><strong>{text("No high-risk findings", "Geen hoog-risico bevindingen")}</strong><small>{text("Continue monitoring open work.", "Blijf openstaand werk volgen.")}</small></span></div>}</div></article>
          <article className="management-card"><header><div><span className="module-card-icon"><Settings size={18} /></span><div><h2>{text("Management controls", "Managementbediening")}</h2><p>{text("Go directly to the area you need to manage.", "Ga direct naar het onderdeel dat je wilt beheren.")}</p></div></div></header><div className="management-control-list"><button type="button" onClick={openUserAdmin}><Users size={16} /><span><strong>{text("Team and access", "Team en toegang")}</strong><small>{text("Invite, suspend and review roles", "Uitnodigen, opschorten en rollen controleren")}</small></span></button><button type="button" onClick={() => setSection("settings")}><Settings size={16} /><span><strong>{text("Project rules", "Projectregels")}</strong><small>{text("Reporting, deadlines and retention", "Rapportage, deadlines en bewaartermijn")}</small></span></button><button type="button" onClick={() => setSection("structure")}><Wrench size={16} /><span><strong>{text("Structure and parties", "Structuur en partijen")}</strong><small>{text("Locations, contractors and consultants", "Locaties, aannemers en adviseurs")}</small></span></button><button type="button" onClick={() => setSection("backup")}><DatabaseBackup size={16} /><span><strong>{text("Continuity controls", "Continuïteitscontrole")}</strong><small>{text("Backups and restore verification", "Back-ups en herstelverificatie")}</small></span></button></div></article>
        </div>
        <div className="management-context"><div><span>{text("Current report", "Huidig rapport")}</span><strong>{reportStatus.replaceAll("_", " ")}</strong></div><div><span>{text("Project locations", "Projectlocaties")}</span><strong>{data.locationNodes.length}</strong></div><div><span>{text("Published checklists", "Gepubliceerde checklists")}</span><strong>{data.templates.filter((item) => item.status === "published").length}</strong></div><div><span>{text("Controlled files", "Beheerde bestanden")}</span><strong>{data.files.length}</strong></div></div>
      </section> : null}
      {section === "readiness" ? <ReadinessChecklist items={data.productionReadiness} editable={canManageOrganization} busy={busy} run={run} client={client} /> : null}
      {section === "settings" ? <section className="operation-panel"><div className="admin-card-grid">{canManageOrganization ? <button className="module-card" type="button" onClick={openUserAdmin}><span className="module-card-icon"><Users size={19} /></span><h2>{text("Users and access", "Gebruikers en toegang")}</h2><p>{text("Only administrators create internal accounts and assign organization or project roles.", "Alleen beheerders maken interne accounts en wijzen organisatie- of projectrollen toe.")}</p></button> : null}<MfaSecurityCard client={client} /><div className="operation-form"><h2>{text("Project rules", "Projectregels")}</h2><div className="form-grid-2"><label className="form-field"><span>{text("Report prefix", "Rapportprefix")}</span><input value={settings.reportPrefix} onChange={(event) => setSettings({ ...settings, reportPrefix: event.target.value.toUpperCase() })} /></label><label className="form-field"><span>{text("File limit (MB)", "Bestandslimiet (MB)")}</span><input type="number" min="1" max="100" value={settings.maxFileSizeMb} onChange={(event) => setSettings({ ...settings, maxFileSizeMb: Number(event.target.value) })} /></label><label className="form-field"><span>{text("Reminder before deadline (hours)", "Herinnering vóór deadline (uur)")}</span><input type="number" min="1" max="720" value={settings.leadHours} onChange={(event) => setSettings({ ...settings, leadHours: Number(event.target.value) })} /></label><label className="form-field"><span>{text("Retention period (days)", "Bewaartermijn (dagen)")}</span><input type="number" min="30" value={settings.retentionDays} onChange={(event) => setSettings({ ...settings, retentionDays: event.target.value })} placeholder={text("Client decision required", "Klantbesluit vereist")} /></label></div><button className="primary-button" type="button" disabled={busy || !data.settings} onClick={() => data.settings && void run(() => saveProjectSettings(client, data.settings!, { report_prefix: settings.reportPrefix, max_file_size_mb: settings.maxFileSizeMb, notification_lead_hours: settings.leadHours, retention_days: settings.retentionDays ? Number(settings.retentionDays) : null }), text("Project rules stored centrally and audited.", "Projectregels centraal opgeslagen en geaudit."))}><Settings size={15} /> {text("Save rules", "Regels opslaan")}</button></div></div></section> : null}
      {section === "structure" ? <section className="operation-panel"><div className="admin-card-grid"><div className="operation-form"><h2>Locatieboom · {buildingName}</h2><div className="form-grid-2"><label className="form-field"><span>Type</span><select value={location.type} onChange={(event) => setLocation({ ...location, type: event.target.value })}><option value="zone">Zone</option><option value="floor">Verdieping</option><option value="room">Ruimte</option><option value="element">Element</option><option value="work_package">Werkpakket</option></select></label><label className="form-field"><span>Code</span><input value={location.code} onChange={(event) => setLocation({ ...location, code: event.target.value })} /></label></div><label className="form-field"><span>Naam</span><input value={location.name} onChange={(event) => setLocation({ ...location, name: event.target.value })} /></label><label className="form-field"><span>Bovenliggende locatie</span><select value={location.parentId} onChange={(event) => setLocation({ ...location, parentId: event.target.value })}><option value="">Direct onder {buildingName}</option>{data.locationNodes.filter((node) => node.building_id === buildingId).map((node) => <option value={node.id} key={node.id}>{node.code} · {node.name}</option>)}</select></label><label className="form-field"><span>Toelichting</span><input value={location.description} onChange={(event) => setLocation({ ...location, description: event.target.value })} /></label><button className="primary-button" type="button" disabled={busy || location.code.trim().length < 1 || location.name.trim().length < 2} onClick={() => void run(() => createLocationNode(client, { organizationId, projectId, buildingId, parentId: location.parentId, type: location.type, code: location.code, name: location.name, description: location.description }), "Locatie aan de vaste projecthiërarchie toegevoegd.").then((okay) => { if (okay) setLocation({ type: "zone", code: "", name: "", parentId: "", description: "" }); })}><Plus size={15} /> Locatie toevoegen</button><div className="compact-register">{data.locationNodes.filter((node) => node.building_id === buildingId).map((node) => <span key={node.id}><strong>{node.code}</strong> {node.name} · {node.node_type}</span>)}</div></div><div className="operation-form"><h2>Projectpartijen</h2><div className="form-grid-2"><label className="form-field"><span>Type</span><select value={party.type} onChange={(event) => setParty({ ...party, type: event.target.value })}><option value="client">Opdrachtgever</option><option value="supervisor">Supervisor</option><option value="contractor">Aannemer</option><option value="subcontractor">Onderaannemer</option><option value="supplier">Leverancier</option><option value="consultant">Adviseur</option><option value="other">Overig</option></select></label><label className="form-field"><span>Code</span><input value={party.code} onChange={(event) => setParty({ ...party, code: event.target.value })} /></label></div><label className="form-field"><span>Naam</span><input value={party.name} onChange={(event) => setParty({ ...party, name: event.target.value })} /></label><button className="primary-button" type="button" disabled={busy || party.code.trim().length < 1 || party.name.trim().length < 2} onClick={() => void run(() => createProjectParty(client, { organizationId, projectId, code: party.code, name: party.name, type: party.type }), "Projectpartij centraal toegevoegd en beschikbaar voor aanwezigheid en toewijzing.").then((okay) => { if (okay) setParty({ type: "contractor", code: "", name: "" }); })}><Users size={15} /> Partij toevoegen</button><div className="compact-register">{parties.map((item) => <span key={item.id}><strong>{item.name}</strong> {item.type}</span>)}</div></div></div></section> : null}
      {section === "templates" ? <section className="operation-panel"><div className="operation-form"><h2>{text("Publish new project checklist", "Nieuwe projectchecklist publiceren")}</h2><div className="form-grid-2"><label className="form-field"><span>{text("Module", "Module")}</span><select value={template.module} onChange={(event) => setTemplate({ ...template, module: event.target.value })}><option value="inspection">{text("Inspection", "Inspectie")}</option><option value="hse">HSE</option><option value="delivery">{text("Delivery", "Levering")}</option><option value="test">{text("Test / measurement", "Test / meting")}</option></select></label><label className="form-field"><span>Code</span><input value={template.code} onChange={(event) => setTemplate({ ...template, code: event.target.value })} placeholder={text("For example CONC-01", "Bijv. BETON-01")} /></label></div><label className="form-field"><span>{text("Name", "Naam")}</span><input value={template.name} onChange={(event) => setTemplate({ ...template, name: event.target.value })} /></label><label className="form-field"><span>{text("Checkpoints · one per line", "Controlepunten · één per regel")}</span><textarea rows={6} value={template.prompts} onChange={(event) => setTemplate({ ...template, prompts: event.target.value })} /></label><button className="primary-button" type="button" disabled={busy} onClick={addTemplate}><Plus size={15} /> {text("Publish checklist", "Checklist publiceren")}</button></div><div className="template-grid">{data.templates.map((item) => <article className="template-card" key={item.id}><span>{item.module.toUpperCase()} · {item.code} · v{item.version_number}</span><h3>{item.name}</h3><p>{item.items.length} {text("checkpoints", "controlepunten")} · {item.status}</p></article>)}</div></section> : null}
      {section === "backup" ? <section className="operation-panel"><div className="storage-status-grid"><div className={`storage-status-card ${isStorageGatewayConfigured ? "" : "blocked"}`}><HardDrive size={21} /><div><strong>Vercel Blob</strong><span>{isStorageGatewayConfigured ? text("Private same-origin storage routes active", "Private opslagroutes binnen dezelfde app actief") : text("Connect a private Blob store in Vercel", "Koppel een private Blob-store in Vercel")}</span></div></div><div className={`storage-status-card ${latestScheduledBackup ? "" : "blocked"}`}><DatabaseBackup size={21} /><div><strong>{text("Latest automatic backup", "Laatste automatische back-up")}</strong><span>{latestScheduledBackup ? formatDate(latestScheduledBackup.verified_at) : text("Waiting for the first daily run", "Wacht op de eerste dagelijkse run")}</span></div></div><div className={`storage-status-card ${latestRestoreTest ? "" : "blocked"}`}><Archive size={21} /><div><strong>{text("Latest restore integrity test", "Laatste herstel-integriteitstest")}</strong><span>{formatDate(latestRestoreTest?.verified_at ?? null)}</span></div></div></div><div className="backup-actions"><button className="primary-button" type="button" disabled={busy || !canManageOrganization} onClick={() => void run(() => downloadManualBackup(client, organizationId, projectId), text("Backup downloaded and checksum verified centrally. Keep a separate recovery copy.", "Back-up gedownload en checksum centraal geverifieerd. Bewaar een afzonderlijke herstelkopie."))}><DatabaseBackup size={15} /> {text("Download verified project backup", "Download geverifieerde projectback-up")}</button><button className="secondary-button" type="button" disabled={busy || !canManageOrganization} onClick={() => fileInput.current?.click()}><RotateCcw size={15} /> Restore dry run</button><input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void run(() => validateBackupDryRun(client, file), text("Restore dry run passed; no data was overwritten.", "Restore dry run geslaagd; er zijn geen gegevens overschreven.")); event.target.value = ""; }} /></div>{latestScheduledBackup ? <div className="operation-alert success"><DatabaseBackup size={18} /><div><strong>{text("Daily Vercel Blob backup active", "Dagelijkse Vercel Blob-back-up actief")}</strong><span>{text("Every stored backup is read back, checksum-verified and retained as 7 daily, 4 weekly and 3 monthly copies. Keep an additional copy outside this Vercel account for account-level disaster recovery.", "Elke opgeslagen back-up wordt teruggelezen, met SHA-256 gecontroleerd en bewaard als 7 dagelijkse, 4 wekelijkse en 3 maandelijkse kopieën. Bewaar daarnaast een kopie buiten dit Vercel-account voor herstel bij accountverlies.")}</span></div></div> : <div className="operation-alert warning"><AlertTriangle size={18} /><div><strong>{text("First automatic backup pending", "Eerste automatische back-up nog niet uitgevoerd")}</strong><span>{text("The daily job is configured. This status becomes green after its first verified production run.", "De dagelijkse taak is geconfigureerd. Deze status wordt groen na de eerste geverifieerde productierun.")}</span></div></div>}<HistoryColumn title={text("Backup history", "Back-uphistorie")} empty={text("No backup run yet.", "Nog geen back-uprun.")} rows={data.backupRuns.map((item) => `${item.run_type} · ${item.status} · ${formatDate(item.created_at)}${item.sha256 ? ` · SHA ${item.sha256.slice(0, 12)}…` : ""}`)} /></section> : null}
    </>
  );
}

const readinessStatusLabels: Record<ProductionReadinessItem["status"], string> = {
  todo: "Nog te doen",
  in_progress: "In uitvoering",
  done: "Gereed",
  not_applicable: "Niet van toepassing",
};

const readinessStatusLabelsEnglish: Record<ProductionReadinessItem["status"], string> = {
  todo: "To do", in_progress: "In progress", done: "Done", not_applicable: "Not applicable",
};

const readinessCategoryLabels: Record<ProductionReadinessItem["category"], string> = {
  accounts: "Accounts",
  configuration: "Configuratie",
  operations: "Beheer",
  legal: "Besluiten",
  acceptance: "Acceptatie",
};

const readinessCategoryLabelsEnglish: Record<ProductionReadinessItem["category"], string> = {
  accounts: "Accounts", configuration: "Configuration", operations: "Operations",
  legal: "Decisions", acceptance: "Acceptance",
};

function ReadinessChecklist({ items, editable, busy, run, client }: { items: ProductionReadinessItem[]; editable: boolean; busy: boolean; run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>; client: SupabaseClient }) {
  const { text } = useLanguage();
  const completed = items.filter((item) => item.status === "done" || item.status === "not_applicable").length;
  const blockingOpen = items.filter((item) => item.blocking && item.status !== "done" && item.status !== "not_applicable").length;
  const percentage = items.length ? Math.round((completed / items.length) * 100) : 0;

  return (
    <section className="operation-panel readiness-panel">
      <div className={`readiness-summary ${blockingOpen ? "blocked" : "ready"}`}>
        <div className="readiness-summary-icon">{blockingOpen ? <AlertTriangle size={22} /> : <ShieldCheck size={22} />}</div>
        <div className="readiness-summary-copy"><span>{text("Production status", "Productiestatus")}</span><strong>{blockingOpen ? text(`${blockingOpen} blocking items open`, `${blockingOpen} blokkerende punten open`) : text("Go-live checklist complete", "Go-live checklist voltooid")}</strong><p>{text(`${completed} of ${items.length} items demonstrably completed`, `${completed} van ${items.length} punten aantoonbaar afgerond`)} · {percentage}%</p></div>
        <div className="readiness-progress" aria-label={text(`${percentage} percent complete`, `${percentage} procent gereed`)}><span style={{ width: `${percentage}%` }} /></div>
      </div>
      <div className="operation-alert warning"><AlertTriangle size={18} /><div><strong>{text("Evidence references, never secrets", "Bewijsreferenties, nooit geheimen")}</strong><span>{text("Enter only a ticket number, date, responsible person or document location. Never paste passwords, tokens, OAuth secrets or recovery codes here.", "Vul alleen een ticketnummer, datum, verantwoordelijke of documentlocatie in. Plak hier geen wachtwoorden, tokens, OAuth-secrets of herstelcodes.")}</span></div></div>
      {!editable ? <div className="operation-alert"><ShieldCheck size={18} /><div><strong>{text("Read only", "Alleen-lezen")}</strong><span>{text("An organization administrator can update the central production status and evidence references.", "Een organisatiebeheerder kan de centrale productiestatus en bewijsreferenties bijwerken.")}</span></div></div> : null}
      <div className="readiness-list">
        {items.map((item) => <ReadinessItem key={`${item.id}:${item.status}:${item.evidence ?? ""}`} item={item} editable={editable} busy={busy} run={run} client={client} />)}
      </div>
    </section>
  );
}

function ReadinessItem({ item, editable, busy, run, client }: { item: ProductionReadinessItem; editable: boolean; busy: boolean; run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>; client: SupabaseClient }) {
  const { language, locale, text } = useLanguage();
  const statusLabels = language === "en" ? readinessStatusLabelsEnglish : readinessStatusLabels;
  const categoryLabels = language === "en" ? readinessCategoryLabelsEnglish : readinessCategoryLabels;
  const [status, setStatus] = useState<ProductionReadinessItem["status"]>(item.status);
  const [evidence, setEvidence] = useState(item.evidence ?? "");

  const requiresEvidence = status === "done" || status === "not_applicable";
  const unchanged = status === item.status && evidence.trim() === (item.evidence ?? "");

  return (
    <article className={`readiness-item ${item.status === "done" || item.status === "not_applicable" ? "complete" : ""}`}>
      <div className="readiness-item-main">
        <div className="readiness-item-heading"><div><span className="record-number">{categoryLabels[item.category]} · {item.code}</span><h2>{item.title}</h2></div>{item.blocking ? <span className="readiness-blocker">{text("Blocking", "Blokkerend")}</span> : <span className="readiness-optional">{text("Non-blocking", "Niet-blokkerend")}</span>}</div>
        <p>{item.description}</p>
        <span className="readiness-owner">{text("Owner", "Eigenaar")}: {item.owner_hint}{item.completed_at ? ` · ${text("Completed", "Afgerond")} ${formatDate(item.completed_at, locale)}` : ""}</span>
      </div>
      <div className="readiness-item-controls">
        <label className="form-field"><span>Status</span><select value={status} disabled={!editable || busy} onChange={(event) => setStatus(event.target.value as ProductionReadinessItem["status"])}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="form-field readiness-evidence"><span>{text("Evidence reference", "Bewijsreferentie")}{requiresEvidence ? text(" · required", " · verplicht") : ""}</span><textarea rows={2} maxLength={1000} value={evidence} disabled={!editable || busy} onChange={(event) => setEvidence(event.target.value)} placeholder={text("For example ticket CODECO-42 · checked 18-07-2026 by administrator", "Bijv. ticket CODECO-42 · gecontroleerd 18-07-2026 door beheerder")} /></label>
        <button className="primary-button" type="button" disabled={!editable || busy || unchanged || (requiresEvidence && evidence.trim().length < 5)} onClick={() => void run(() => updateProductionReadiness(client, item.id, status, evidence), text(`${item.code} updated centrally and recorded in the audit log.`, `${item.code} centraal bijgewerkt en in het auditlog vastgelegd.`))}><ShieldCheck size={15} /> {text("Save status", "Status opslaan")}</button>
      </div>
    </article>
  );
}

function MfaSecurityCard({ client }: { client: SupabaseClient }) {
  const { text } = useLanguage();
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void client.auth.mfa.listFactors().then(({ data, error: listError }) => {
      if (!active) return;
      if (listError) setError(listError.message);
      setVerified(Boolean(data?.totp.some((factor) => factor.status === "verified")));
      setLoading(false);
    });
    return () => { active = false; };
  }, [client]);

  const enroll = async () => {
    setLoading(true);
    setError("");
    const result = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "CODECO Supervisie" });
    if (result.error) setError(result.error.message);
    else {
      setFactorId(result.data.id);
      setQrCode(result.data.totp.qr_code);
      setSecret(result.data.totp.secret);
    }
    setLoading(false);
  };

  const verify = async () => {
    setLoading(true);
    setError("");
    const result = await client.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (result.error) setError(result.error.message);
    else {
      setVerified(true);
      setQrCode("");
      setSecret("");
      setMessage(text("Authenticator confirmed; this session now uses two-step verification.", "Authenticator bevestigd; deze sessie gebruikt nu tweestapsverificatie."));
    }
    setLoading(false);
  };

  return (
    <div className="mfa-card">
      <span className="module-card-icon"><KeyRound size={19} /></span>
      <div><h2>{text("Two-step verification", "Tweestapsverificatie")}</h2><p>{verified ? text("Authenticator active for this internal account.", "Authenticator actief voor dit interne account.") : text("Protect administration, review and signing actions with an authenticator app.", "Bescherm beheer-, review- en ondertekenhandelingen met een authenticator-app.")}</p></div>
      {error ? <span className="inline-error">{error}</span> : null}
      {message ? <span className="inline-success">{message}</span> : null}
      {!verified && !qrCode ? <button className="secondary-button" type="button" disabled={loading} onClick={() => void enroll()}>{loading ? <Loader2 className="spin" size={15} /> : <KeyRound size={15} />} {text("Set up authenticator", "Authenticator instellen")}</button> : null}
      {qrCode ? <div className="mfa-enroll"><NextImage src={qrCode} alt={text("QR code for CODECO two-step verification", "QR-code voor CODECO tweestapsverificatie")} width={150} height={150} unoptimized /><div><span>{text("Scan with your authenticator app or use this key:", "Scan met je authenticator-app of gebruik deze sleutel:")}</span><code>{secret}</code><label className="form-field"><span>{text("6-digit code", "6-cijferige code")}</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></label><button className="primary-button" type="button" disabled={loading || code.length !== 6} onClick={() => void verify()}>{text("Confirm authenticator", "Bevestig authenticator")}</button></div></div> : null}
    </div>
  );
}

function RecordList({ empty, rows }: { empty: string; rows: Array<{ id: string; icon: typeof ClipboardCheck; title: string; meta: string; status: string; tone: string }> }) {
  const { text } = useLanguage();
  if (!rows.length) return <div className="empty-list-state"><CheckCircle2 size={22} /><strong>{text("No records", "Geen registraties")}</strong><span>{empty}</span></div>;
  return <div className="record-stack">{rows.map((row) => { const Icon = row.icon; return <article className="record-row" key={row.id}><span className="action-icon"><Icon size={18} /></span><div><strong>{row.title}</strong><span>{row.meta}</span></div><span className={`task-status ${row.tone}`}>{row.status}</span></article>; })}</div>;
}

function HistoryColumn({ title, empty, rows }: { title: string; empty: string; rows: React.ReactNode[] }) {
  return <div className="history-column"><h3>{title}</h3>{rows.length ? <ul>{rows.map((row, index) => <li key={index}>{row}</li>)}</ul> : <p>{empty}</p>}</div>;
}
