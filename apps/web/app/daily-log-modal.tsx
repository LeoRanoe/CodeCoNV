"use client";

import { ArrowRight, Camera, PenLine } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BuildingMultiPicker, resolveDefaultBuildingId, type BuildingOption } from "@/app/building-picker";
import { appendDictation, DictateButton } from "@/app/dictate-button";
import { RecordFormSection, RecordFormShell } from "@/app/forms/record-form-shell";
import { PhotoEvidenceList, toPhotoEvidence, type PhotoEvidence } from "@/app/photo-evidence";
import { SignatureField, type HandwrittenSignature } from "@/app/signature-pad";
import { SketchPad } from "@/app/sketch-pad";
import { useLanguage } from "@/lib/i18n";
import type { DailyCloseoutAnswers, ProjectStartAnswers } from "@/lib/forms/daily-report";
import { normalizeImageFile } from "@/lib/images/normalize-image";
import { closeoutFromToday, type DayLogToday } from "@/lib/forms/closeout-from-today";
import { clearFormDraft, loadFormDraft, saveFormDraft } from "@/lib/offline/form-drafts";

export type { DayLogToday };
import { signatureFromDetails } from "@/lib/signatures/handwritten-signature.mjs";

/** Everything typed, signed and photographed in the day log, as it is kept on the device. */
type DailyLogDraft = {
  buildingIds: string[];
  log: DailyLogFields;
  photos: DailyLogPhoto[];
  daySignature: HandwrittenSignature | null;
  contractorSignature: HandwrittenSignature | null;
};

type DailyLogFields = {
  constructionActivity: string;
  workPerformed: string;
  progressPercent: number | null;
  adviceToContractor: string;
  delayCause: DailyCloseoutAnswers["delayCause"];
  delayHours: number;
  delayReason: string;
  contractorCompany: string;
  tomorrowPlan: string;
  equipmentStatus: string;
  testsMeasurements: string;
  risks: string;
};

export type DayLogFocus = "delay" | "works_ongoing" | "works_completed";

/**
 * A photo plus everything the supervisor said about it. Without those words a day with eight
 * photos ends up in the report as eight numbered files nobody can place afterwards.
 */
export type DailyLogPhoto = PhotoEvidence;

/**
 * The client's own daily log, taken from their weekly report (TELESUR CSC).
 * Each day in that document is exactly these blocks, in this order:
 *
 *   WEATHER CONDITIONS · working hours
 *   CONSTRUCTION IN PROGRESS → CONSTRUCTION ACTIVITY & LOCATION
 *   QC PERFORMED & ADVISE
 *   HEALTH & SAFETY ISSUES
 *   GENERAL ADVICE TO THE CONTRACTOR
 *
 * This is the only form for the day closeout, and it is a workspace page like every other
 * record form, not a pop-up. The workforce, inspections, issues, HSE, materials delivered,
 * agreements and change orders each have their own module; the day log reads them, it does
 * not ask for them a second time.
 */
export function DailyLogForm({
  buildings,
  defaultBuildingId,
  buildingName,
  projectStartAnswers,
  initialCloseout,
  attendanceTotal,
  today,
  parties,
  busy,
  draftKey,
  close,
  openProjectStart,
  openWorkforce,
  openModule,
  save,
  focus,
}: {
  buildings: BuildingOption[];
  defaultBuildingId: string;
  buildingName: string;
  projectStartAnswers: ProjectStartAnswers | null;
  initialCloseout: DailyCloseoutAnswers | null;
  /** The headcount from the Workforce register, shown here and written there. */
  attendanceTotal: number;
  today: DayLogToday;
  parties: Array<{ id: string; name: string }>;
  busy: boolean;
  /** Where this day's unsaved log is kept on the device. */
  draftKey: string;
  /**
   * Which record the supervisor came here for. The day closeout holds the works and the
   * delay alike, so both open this one form — but on the block they were asked for,
   * instead of a whole day report to read past.
   */
  focus?: "delay" | "works_ongoing" | "works_completed";
  close: () => void;
  openProjectStart: () => void;
  openWorkforce: () => void;
  openModule: (module: "inspections" | "findings" | "ncr" | "hse") => void;
  save: (input: {
    buildingIds: string[];
    answers: DailyCloseoutAnswers;
    photos: DailyLogPhoto[];
  }) => boolean | void | Promise<boolean | void>;
}) {
  const { locale, text } = useLanguage();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  // One day can cover several buildings; the log is written once per chosen building.
  const defaultBuildingIds = () => {
    const resolved = resolveDefaultBuildingId(buildings, defaultBuildingId);
    return resolved ? [resolved] : [];
  };
  const [buildingIds, setBuildingIds] = useState<string[]>(defaultBuildingIds);
  const buildingId = buildingIds[0] ?? resolveDefaultBuildingId(buildings, defaultBuildingId);
  const [photos, setPhotos] = useState<DailyLogPhoto[]>([]);
  // A sketch made on site travels with the day as a picture, next to the photos.
  const [sketching, setSketching] = useState(false);

  const emptyLog = (): DailyLogFields => ({
    constructionActivity: initialCloseout?.workOngoing ?? "",
    workPerformed: initialCloseout?.workPerformed ?? "",
    progressPercent: initialCloseout?.progressPercent ?? null,
    adviceToContractor: initialCloseout?.communication ?? "",
    delayCause: initialCloseout?.delayCause ?? "none",
    delayHours: initialCloseout?.delayHours ?? 0,
    delayReason: initialCloseout?.delayReason ?? "",
    contractorCompany: initialCloseout?.contractorCompany ?? "",
    tomorrowPlan: initialCloseout?.tomorrowPlan ?? "",
    equipmentStatus: initialCloseout?.equipmentStatus ?? "",
    testsMeasurements: initialCloseout?.testsMeasurements ?? "",
    risks: initialCloseout?.risks ?? projectStartAnswers?.riskNotes ?? "",
  });
  const [log, setLog] = useState<DailyLogFields>(emptyLog);
  /** The supervisor who closed the day, signed on the day's own form. */
  const initialDaySignature = () => signatureFromDetails(
    initialCloseout?.signedBy,
    initialCloseout?.signedAt,
    initialCloseout?.signatureImage,
  ) as HandwrittenSignature | null;
  const initialContractorSignature = () => signatureFromDetails(
    initialCloseout?.contractorSignedBy,
    initialCloseout?.contractorSignedAt,
    initialCloseout?.contractorSignatureImage,
  ) as HandwrittenSignature | null;
  const [daySignature, setDaySignature] = useState<HandwrittenSignature | null>(initialDaySignature);
  const [contractorSignature, setContractorSignature] = useState<HandwrittenSignature | null>(initialContractorSignature);

  const weatherLabel = projectStartAnswers
    ? `${({ sunny: text("Sunny", "Zonnig"), partly_cloudy: text("Partly cloudy", "Licht bewolkt"), cloudy: text("Cloudy", "Bewolkt"), rain: text("Rain", "Regen"), heavy_rain: text("Heavy rain", "Zware regen") } as Record<string, string>)[projectStartAnswers.weatherCondition]} · ${projectStartAnswers.temperatureC}°C`
    : "";
  const shiftLabel = projectStartAnswers ? `${projectStartAnswers.shiftStart}–${projectStartAnswers.shiftEnd}` : "";

  const activityChoices = [
    text("Concrete and rebar", "Beton en wapening"),
    text("Facade cladding", "Gevelbekleding"),
    text("Paving works", "Bestratingswerkzaamheden"),
    text("Electrical installation", "Elektrische installatie"),
    text("Finishing works", "Afwerking"),
  ];
  const adviceChoices = [
    text("Continue as agreed", "Voortzetten zoals afgesproken"),
    text("Correct before continuing", "Corrigeren voor voortzetting"),
    text("Deliver missing documents", "Ontbrekende documenten aanleveren"),
    text("Improve site housekeeping", "Verbeter de orde op de bouwplaats"),
  ];
  const workforceNoteChoices = [
    text("Too few workers for the planned work.", "Onvoldoende arbeiders voor het geplande werk."),
    text("More workers can be deployed on this activity.", "Er kunnen meer arbeiders op deze activiteit worden ingezet."),
    text("Workforce is sufficient for the planned work.", "De bezetting is voldoende voor het geplande werk."),
    text("Key discipline was absent today.", "Een belangrijke discipline was vandaag afwezig."),
    text("Workers arrived late on site.", "Arbeiders zijn te laat op de bouwplaats gekomen."),
    text("Extra shift or overtime is needed to stay on schedule.", "Extra dienst of overwerk nodig om op planning te blijven."),
  ];

  // Judged by the bytes: a camera that labels a JPEG "image/jpg" or not at all still counts,
  // and the photo is stored with the type it really has.
  const addPhotos = async (files: FileList | null) => {
    const captured = (await Promise.all(Array.from(files ?? []).map((file) => normalizeImageFile(file).catch(() => null))))
      .filter((file): file is File => Boolean(file));
    if (captured.length) setPhotos((current) => [...current, ...captured.map((file) => toPhotoEvidence(file))]);
  };

  /*
   * The safety net. A draft left by an earlier visit is put back once, before anything is
   * written; from then on every change is kept on the device, photos included, until the day
   * log is saved. Back, a reload or a phone that drops the tab behind the camera lose nothing.
   */
  const [draftState, setDraftState] = useState<"loading" | "restored" | "ready">("loading");
  useEffect(() => {
    let cancelled = false;
    void loadFormDraft<DailyLogDraft>(draftKey).then((draft) => {
      if (cancelled) return;
      if (draft) {
        const value = draft.value;
        const known = (value.buildingIds ?? []).filter((id) => buildings.some((building) => building.id === id));
        if (known.length) setBuildingIds(known);
        setLog((current) => ({ ...current, ...value.log }));
        setPhotos(Array.isArray(value.photos) ? value.photos : []);
        setDaySignature(value.daySignature ?? null);
        setContractorSignature(value.contractorSignature ?? null);
      }
      setDraftState(draft ? "restored" : "ready");
    });
    return () => { cancelled = true; };
    // The draft is read once for the form that was opened; the building list does not reopen it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);
  // Saving is what ends the draft. A write still waiting when the save goes through must not
  // bring the draft back afterwards.
  const savedRef = useRef(false);
  // Only a change made on the form starts a draft; opening it and walking away does not.
  const draftArmed = useRef(false);
  useEffect(() => {
    if (draftState === "loading" || savedRef.current) return;
    if (!draftArmed.current) { draftArmed.current = true; return; }
    const timer = window.setTimeout(() => {
      if (savedRef.current) return;
      void saveFormDraft<DailyLogDraft>(draftKey, { buildingIds, log, photos, daySignature, contractorSignature });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [buildingIds, contractorSignature, daySignature, draftKey, draftState, log, photos]);
  const discardDraft = () => {
    void clearFormDraft(draftKey);
    setBuildingIds(defaultBuildingIds());
    setLog(emptyLog());
    setPhotos([]);
    setDaySignature(initialDaySignature());
    setContractorSignature(initialContractorSignature());
    setDraftState("ready");
  };

  const derived = closeoutFromToday(today);
  // The database requires a full closeout record; these blocks are the ones the client
  // fills in, the rest is read from the other modules or keeps what was recorded earlier.
  const answers: DailyCloseoutAnswers = {
    daySummary: log.constructionActivity.trim(),
    weatherSummary: weatherLabel || initialCloseout?.weatherSummary || "",
    workOngoing: log.constructionActivity.trim(),
    workPerformed: log.workPerformed.trim(),
    progressPercent: log.progressPercent,
    ...derived,
    equipmentStatus: log.equipmentStatus.trim(),
    // Materials delivered and change orders have their own registers in the workspace; the
    // day log keeps what an older closeout said and does not ask for them again.
    deliveries: initialCloseout?.deliveries ?? "",
    testsMeasurements: log.testsMeasurements.trim(),
    variationWork: initialCloseout?.variationWork ?? "none",
    delayCause: log.delayCause,
    delayHours: log.delayCause === "none" ? 0 : log.delayHours,
    delayReason: log.delayCause === "none" ? "" : log.delayReason.trim(),
    contractorCompany: log.delayCause === "none" ? "" : log.contractorCompany.trim(),
    contractorSignedBy: log.delayCause === "none" ? "" : contractorSignature?.name ?? "",
    contractorSignedAt: log.delayCause === "none" ? "" : contractorSignature?.signedAt ?? "",
    contractorSignatureImage: log.delayCause === "none" ? "" : contractorSignature?.image ?? "",
    signedBy: daySignature?.name ?? "",
    signedAt: daySignature?.signedAt ?? "",
    signatureImage: daySignature?.image ?? "",
    communication: log.adviceToContractor.trim(),
    risks: log.risks.trim(),
    tomorrowPlan: log.tomorrowPlan.trim(),
    photoCount: (initialCloseout?.photoCount ?? 0) + photos.length,
    attachmentsConfirmed: initialCloseout?.attachmentsConfirmed ?? photos.length > 0,
  };

  const delayOnly = focus === "delay";
  const ongoingOnly = focus === "works_ongoing";
  const completedOnly = focus === "works_completed";
  const workOnly = ongoingOnly || completedOnly;
  // A focused entry lives in the day closeout, so the day still has to say what happened.
  // When the closeout already exists this form only asks about the one thing the button
  // was pressed for; when it does not, the day's own blocks are required too.
  const dayContextRequired = !(delayOnly || workOnly) || !initialCloseout;
  // Works ongoing and works completed are the same form; each tile still has to end up
  // with the field it was opened for filled in.
  const summaryRequired = dayContextRequired || ongoingOnly;
  const performedRequired = dayContextRequired || completedOnly;
  const problems: string[] = [];
  // The day report stands on the weather of the day; without the project start there is none,
  // and the database refuses the closeout. Saying so here beats a failed save.
  if (answers.weatherSummary.trim().length < 5) problems.push(text("Confirm the project start first: weather and working hours.", "Bevestig eerst de projectstart: weer en werktijden."));
  if (!buildingIds.length && buildings.length > 1) problems.push(text("Choose at least one building.", "Kies minimaal één gebouw."));
  if (delayOnly && answers.delayCause === "none") problems.push(text("Choose what caused the delay.", "Kies waardoor de vertraging is ontstaan."));
  if (summaryRequired && answers.daySummary.length < 20) problems.push(text("Describe the construction activity and location in at least one full sentence.", "Beschrijf de bouwactiviteit en locatie in minimaal één volledige zin."));
  if (performedRequired && answers.workPerformed.length < 10) problems.push(text("Describe the work completed today.", "Beschrijf het werk dat vandaag is afgerond."));
  if (dayContextRequired && answers.tomorrowPlan.length < 3) problems.push(text("Enter the plan for tomorrow.", "Vul de planning voor morgen in."));
  if (answers.delayCause !== "none" && answers.delayHours <= 0) problems.push(text("Enter the hours lost to the delay.", "Vul de uren verlies door de vertraging in."));
  if (answers.delayCause !== "none" && (answers.delayReason?.length ?? 0) < 10) problems.push(text("Describe what actually caused the delay in at least one sentence.", "Beschrijf in minimaal één zin wat de vertraging daadwerkelijk heeft veroorzaakt."));
  if (answers.delayCause !== "none" && (answers.contractorCompany?.length ?? 0) < 2) problems.push(text("Enter the responsible contractor company.", "Vul het verantwoordelijke aannemersbedrijf in."));
  if (answers.delayCause !== "none" && !contractorSignature) problems.push(text("The contractor signature is required because the contractor is responsible for the work affected by this delay.", "De handtekening van de aannemer is verplicht omdat de aannemer verantwoordelijk is voor het werk waarop deze vertraging betrekking heeft."));

  // The list of what is still missing appears once the supervisor tries to save, not while
  // the first word is being typed.
  const [triedSave, setTriedSave] = useState(false);
  const submit = async () => {
    if (problems.length) {
      setTriedSave(true);
      // The list of what is missing stands at the top of the form; on a phone the save button
      // is a long way below it, so the form brings the list into view.
      window.requestAnimationFrame(() => document.querySelector(".daily-log-form .record-form-validation")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    savedRef.current = true;
    const result = await save({ buildingIds, answers, photos });
    // A save that did not go through keeps the draft alive for the next attempt.
    if (result === false) savedRef.current = false;
    else await clearFormDraft(draftKey);
  };

  const ongoingField = (
    <label className="form-field daily-log-field-ongoing" key="ongoing">
      <span>{text("What is in progress, and where?", "Wat is er gaande, en waar?")}</span>
      <textarea rows={3} value={log.constructionActivity} onChange={(event) => setLog({ ...log, constructionActivity: event.target.value })} />
      <DictateButton onText={(transcript) => setLog((current) => ({ ...current, constructionActivity: appendDictation(current.constructionActivity, transcript) }))} />
    </label>
  );
  const completedField = (
    <label className="form-field daily-log-field-completed" key="completed">
      <span>{text("Work completed today", "Werk vandaag afgerond")}</span>
      <textarea rows={completedOnly ? 3 : 2} value={log.workPerformed} onChange={(event) => setLog({ ...log, workPerformed: event.target.value })} />
      <DictateButton onText={(transcript) => setLog((current) => ({ ...current, workPerformed: appendDictation(current.workPerformed, transcript) }))} />
    </label>
  );
  const progressField = (
    <label className="form-field" key="progress">
      <span>{text("Progress", "Voortgang")} · {log.progressPercent === null ? text("not entered", "niet ingevuld") : `${log.progressPercent}%`}</span>
      <input type="range" min={0} max={100} step={5} value={log.progressPercent ?? 0} onChange={(event) => setLog({ ...log, progressPercent: Number(event.target.value) })} />
    </label>
  );

  const recordedToday = (rows: Array<{ id: string; code: string; title: string }>, module: "inspections" | "findings" | "ncr" | "hse", empty: string, label: string) => (
    <div className="daily-log-today">
      {rows.length ? (
        <ul>{rows.map((row) => <li key={row.id}><strong>{row.code}</strong> {row.title}</li>)}</ul>
      ) : <p>{empty}</p>}
      <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={() => openModule(module)}>{label} <ArrowRight size={14} /></button>
    </div>
  );

  // Each block is written once and placed in the order the tile asks for: the block that
  // was asked for comes first, and the numbers follow what is on screen.
  const blocks: Array<{ id: string; title: string; className?: string; content: ReactNode }> = [
    {
      id: "day",
      title: text("Buildings and weather", "Gebouwen en weer"),
      className: "daily-log-day",
      content: (
        <>
          <BuildingMultiPicker
            id="daily-log-building"
            buildings={buildings}
            value={buildingIds}
            onChange={setBuildingIds}
            hint={text("Saved once per building.", "Eén keer per gebouw opgeslagen.")}
          />
          {projectStartAnswers ? (
            <p className="daily-log-readout"><span>{text("Weather conditions", "Weersomstandigheden")}</span><strong>{weatherLabel}</strong><span>{shiftLabel}</span></p>
          ) : (
            <div className="daily-log-missing">
              <span>{text("Weather and hours are not confirmed yet (Project start).", "Weer en uren zijn nog niet bevestigd (Projectstart).")}</span>
              <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={openProjectStart}>{text("Confirm project start", "Bevestig projectstart")}</button>
            </div>
          )}
        </>
      ),
    },
    {
      id: "works",
      title: ongoingOnly
        ? text("What is running right now", "Wat er op dit moment loopt")
        : completedOnly
          ? text("What was finished today", "Wat vandaag is afgerond")
          : text("Construction activity & location", "Bouwactiviteit & locatie"),
      className: "daily-log-works",
      content: (
        <>
          {/* These write into the works-ongoing field, so they only belong beside it. */}
          {completedOnly ? null : <div className="quick-issue-presets" aria-label={text("Common activities", "Veelvoorkomende activiteiten")}>
            {activityChoices.map((choice) => (
              <button type="button" onClick={() => setLog((current) => ({ ...current, constructionActivity: appendDictation(current.constructionActivity, `${choice} · ${buildings.find((building) => building.id === buildingId)?.name ?? buildingName}`) }))} key={choice}>{choice}</button>
            ))}
          </div>}
          {/* Works ongoing and works completed are two fields of one record. The field the
              tile was opened for is open; the other is folded, not faded, because a dimmed
              field beside an identical one reads as the same form twice — unless the day has
              no closeout yet, in which case both are asked for and both stand open. */}
          {ongoingOnly && !performedRequired ? (
            <>
              {ongoingField}
              {progressField}
              <details className="daily-log-secondary">
                <summary>{text("Also finished something today?", "Vandaag ook iets afgerond?")}</summary>
                {completedField}
              </details>
            </>
          ) : completedOnly && !summaryRequired ? (
            <>
              {completedField}
              {progressField}
              <details className="daily-log-secondary">
                <summary>{text("Also work still running?", "Ook werk dat nog loopt?")}</summary>
                {ongoingField}
              </details>
            </>
          ) : (
            <>
              {ongoingField}
              <div className="form-grid-2">{completedField}{progressField}</div>
            </>
          )}
        </>
      ),
    },
    {
      id: "quality",
      title: text("QC performed & advice", "QC uitgevoerd & advies"),
      content: (
        <>
          {recordedToday(today.inspections, "inspections", text("No inspection recorded today.", "Vandaag geen inspectie vastgelegd."), text("Open inspections", "Open inspecties"))}
          {today.findings.length ? recordedToday(today.findings, today.findings.every((finding) => finding.type === "ncr") ? "ncr" : "findings", "", text("Open issues", "Open issues")) : null}
        </>
      ),
    },
    {
      id: "hse",
      title: text("Health & safety issues", "Gezondheid & veiligheid"),
      content: recordedToday(today.hse, "hse", text("No HSE record today.", "Vandaag geen HSE-registratie."), text("Open HSE", "Open HSE")),
    },
    {
      id: "advice",
      title: text("General advice to the contractor", "Algemeen advies aan de aannemer"),
      content: (
        <>
          <div className="quick-issue-presets" aria-label={text("Standard advice", "Standaardadvies")}>
            {adviceChoices.map((choice) => (
              <button className={log.adviceToContractor === choice ? "active" : ""} type="button" onClick={() => setLog({ ...log, adviceToContractor: choice })} key={choice}>{choice}</button>
            ))}
          </div>
          <label className="form-field">
            <span>{text("Advice recorded for the contractor", "Vastgelegd advies voor de aannemer")}</span>
            <textarea rows={2} value={log.adviceToContractor} onChange={(event) => setLog({ ...log, adviceToContractor: event.target.value })} />
            <DictateButton onText={(transcript) => setLog((current) => ({ ...current, adviceToContractor: appendDictation(current.adviceToContractor, transcript) }))} />
          </label>
        </>
      ),
    },
    {
      id: "workforce",
      title: text("Workforce", "Bezetting"),
      className: "daily-log-workforce",
      content: (
        <>
          {/* The crew is counted in the Workforce register, once. The day log shows the
              count and judges the manning level; it does not count a second time. */}
          <p className="daily-log-readout">
            <strong>{attendanceTotal === 1 ? text("1 person recorded today", "1 persoon vandaag vastgelegd") : text(`${attendanceTotal} people recorded today`, `${attendanceTotal} personen vandaag vastgelegd`)}</strong>
            <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={openWorkforce}>{text("Open workforce", "Open bezetting")} <ArrowRight size={14} /></button>
          </p>
          {/* Counting people is not the same as judging the manning level. These notes are
              the sentences the client wants in the report about the workforce. */}
          <div className="quick-issue-presets" aria-label={text("Standard notes about the workforce", "Standaardnotities over de bezetting")}>
            {workforceNoteChoices.map((choice) => (
              <button
                className={log.adviceToContractor.includes(choice) ? "active" : ""}
                type="button"
                onClick={() => setLog((current) => ({
                  ...current,
                  adviceToContractor: current.adviceToContractor.includes(choice)
                    ? current.adviceToContractor.replace(choice, "").replace(/\s{2,}/g, " ").trim()
                    : appendDictation(current.adviceToContractor, choice),
                }))}
                key={choice}
              >{choice}</button>
            ))}
          </div>
        </>
      ),
    },
    {
      id: "delay",
      title: text("Delay and plan for tomorrow", "Vertraging en planning morgen"),
      className: "daily-log-delay",
      content: (
        <>
          <div className="form-grid-2">
            <label className="form-field">
              <span>{text("Delay cause", "Oorzaak vertraging")}</span>
              <select value={log.delayCause} onChange={(event) => setLog({ ...log, delayCause: event.target.value as typeof log.delayCause })}>
                <option value="none">{text("No delay", "Geen vertraging")}</option>
                <option value="weather">{text("Weather", "Weer")}</option>
                <option value="delivery">{text("Delivery", "Levering")}</option>
                <option value="material">{text("Material", "Materiaal")}</option>
                <option value="equipment">{text("Equipment", "Materieel")}</option>
                <option value="other">{text("Other", "Overig")}</option>
              </select>
            </label>
            {log.delayCause !== "none" ? (
              <label className="form-field">
                <span>{text("Hours lost", "Uren verlies")}</span>
                <input type="number" min={0} max={24} step={0.5} value={log.delayHours} onChange={(event) => setLog({ ...log, delayHours: Number(event.target.value) })} />
              </label>
            ) : null}
          </div>
          {log.delayCause !== "none" ? <div className="delay-responsibility-block">
            <label className="form-field">
              <span>{text("Reason for delay", "Reden van vertraging")}</span>
              <textarea rows={3} value={log.delayReason} onChange={(event) => setLog({ ...log, delayReason: event.target.value })} />
              <DictateButton onText={(transcript) => setLog((current) => ({ ...current, delayReason: appendDictation(current.delayReason, transcript) }))} />
            </label>
            <label className="form-field">
              <span>{text("Responsible contractor company", "Verantwoordelijk aannemersbedrijf")}</span>
              <input value={log.contractorCompany} onChange={(event) => setLog({ ...log, contractorCompany: event.target.value })} />
            </label>
            <SignatureField
              label={text("Required contractor signature", "Verplichte handtekening aannemer")}
              declaration={text("I acknowledge this delay and my responsibility for the affected work.", "Ik erken deze vertraging en mijn verantwoordelijkheid voor het betreffende werk.")}
              hint={text("Required because the contractor is responsible for the affected work.", "Verplicht omdat de aannemer verantwoordelijk is voor het betreffende werk.")}
              value={contractorSignature}
              onChange={setContractorSignature}
            />
          </div> : null}
          <label className="form-field">
            <span>{text("Plan for tomorrow", "Planning voor morgen")}</span>
            <textarea rows={2} value={log.tomorrowPlan} onChange={(event) => setLog({ ...log, tomorrowPlan: event.target.value })} />
            <DictateButton onText={(transcript) => setLog((current) => ({ ...current, tomorrowPlan: appendDictation(current.tomorrowPlan, transcript) }))} />
          </label>
        </>
      ),
    },
    {
      id: "photos",
      title: text("Photos", "Foto's"),
      className: "daily-log-photos",
      content: (
        <>
          <input ref={cameraInputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={(event) => { const files = event.target.files; void addPhotos(files).finally(() => { event.target.value = ""; }); }} />
          <div className="button-row">
            <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => cameraInputRef.current?.click()}><Camera size={15} /> {text("Add photo", "Foto toevoegen")}</button>
            <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={() => setSketching(true)}><PenLine size={15} /> {text("Make a sketch", "Schets maken")}</button>
          </div>
          {sketching ? <SketchPad close={() => setSketching(false)} save={(file) => { setPhotos((current) => [...current, toPhotoEvidence(file, { category: "overview" })]); setSketching(false); }} /> : null}
          {/* One photo block, the same as everywhere else: the picture, the way into
              marking, and the words that belong to it. */}
          <PhotoEvidenceList
            photos={photos}
            setPhotos={setPhotos}
            markupContext={{
              buildings: buildings.map((building) => ({ id: building.id, label: building.name })),
              defaultBuildingId: buildingId,
              parties: parties.map((party) => ({ id: party.id, label: party.name })),
            }}
          />
        </>
      ),
    },
    {
      id: "extra",
      title: text("Equipment, tests and open risks", "Materieel, testen en open risico's"),
      content: (
        // The report has three lines nobody else in the app asks for. They stay folded:
        // most days they say "nothing to report".
        <details className="daily-log-secondary">
          <summary>{log.equipmentStatus || log.testsMeasurements || log.risks ? text("Filled in", "Ingevuld") : text("Nothing to report", "Niets te melden")}</summary>
          <label className="form-field">
            <span>{text("Equipment and status", "Materieel en status")}</span>
            <textarea rows={2} value={log.equipmentStatus} onChange={(event) => setLog({ ...log, equipmentStatus: event.target.value })} />
          </label>
          <label className="form-field">
            <span>{text("Tests and measurements", "Testen en meetwaarden")}</span>
            <textarea rows={2} value={log.testsMeasurements} onChange={(event) => setLog({ ...log, testsMeasurements: event.target.value })} />
          </label>
          <label className="form-field">
            <span>{text("Open risks", "Open risico's")}</span>
            <textarea rows={2} value={log.risks} onChange={(event) => setLog({ ...log, risks: event.target.value })} />
          </label>
        </details>
      ),
    },
    {
      id: "signature",
      title: text("Signature", "Handtekening"),
      className: "daily-log-signature",
      content: (
        // The day is signed by the person who closed it, the way every other record in the
        // app is signed. Optional, so an unfinished day can still be saved.
        <SignatureField
          label={text("Sign this day", "Onderteken deze dag")}
          declaration={text(
            "I confirm that this record reflects what I saw and recorded on site today.",
            "Ik bevestig dat deze registratie weergeeft wat ik vandaag op de bouwplaats heb gezien en vastgelegd.",
          )}
          hint={text("The name and the moment are stored with the day.", "De naam en het moment worden bij de dag opgeslagen.")}
          value={daySignature}
          onChange={setDaySignature}
        />
      ),
    },
  ];
  const leading = delayOnly ? "delay" : workOnly ? "works" : "";
  const ordered = leading ? [...blocks.filter((block) => block.id === leading), ...blocks.filter((block) => block.id !== leading)] : blocks;

  const todayLabel = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "America/Paramaribo" }).format(new Date());

  return (
    <RecordFormShell
      code={`${text("Day log", "Daglog")} · ${todayLabel}`}
      title={delayOnly
        ? text("Record a delay", "Vertraging vastleggen")
        : ongoingOnly ? text("Record works ongoing", "Werkzaamheden gaande vastleggen")
          : completedOnly ? text("Record works completed", "Werkzaamheden afgerond vastleggen")
            : text("Today on site", "Vandaag op de bouwplaats")}
      status={initialCloseout ? text("Saved earlier today", "Eerder vandaag opgeslagen") : text("Draft", "Concept")}
      validation={triedSave ? problems : []}
      busy={busy}
      saveLabel={text("Save daily log", "Daglog opslaan")}
      onSave={() => void submit()}
      onCancel={close}
      className="wide sectioned-record-form daily-log-form"
      headerAside={draftState === "restored" ? (
        <span className="daily-log-draft" role="status">
          {text("Unsaved draft restored", "Niet-opgeslagen concept hersteld")}
          <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={discardDraft}>{text("Discard draft", "Concept weggooien")}</button>
        </span>
      ) : null}
    >
      <div className={`daily-log-body${delayOnly ? " focus-delay" : ongoingOnly ? " focus-works focus-ongoing" : completedOnly ? " focus-works focus-completed" : ""}`}>
        {ordered.map((block, index) => (
          <RecordFormSection number={index + 1} title={block.title} className={block.className} key={block.id}>
            {block.content}
          </RecordFormSection>
        ))}
      </div>
    </RecordFormShell>
  );
}
