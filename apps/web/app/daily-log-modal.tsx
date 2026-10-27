"use client";

import { Camera, CloudSun, HardHat, Loader2, ShieldCheck, TimerOff, Users, X } from "lucide-react";
import { useRef, useState } from "react";
import { BuildingMultiPicker, resolveDefaultBuildingId, type BuildingOption } from "@/app/building-picker";
import { appendDictation, DictateButton } from "@/app/dictate-button";
import { PhotoEvidenceList, toPhotoEvidence, type PhotoEvidence } from "@/app/photo-evidence";
import { SignatureField, type HandwrittenSignature } from "@/app/signature-pad";
import { workforceTotal, WorkforceRegister } from "@/app/workforce-register";
import { useLanguage } from "@/lib/i18n";
import type { DailyCloseoutAnswers, ProjectStartAnswers } from "@/lib/forms/daily-report";
import { signatureFromDetails } from "@/lib/signatures/handwritten-signature.mjs";

export type DailyLogAttendanceRow = {
  partyId: string;
  party: string;
  discipline: string;
  count: number;
  shiftStart: string;
  shiftEnd: string;
};

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
 * The previous "daily log" button opened a workforce counter instead, which is why
 * the client reported that the daily log was wrong. Workforce is still available
 * here, but as a supporting block rather than the whole log.
 */
export function DailyLogModal({
  buildings,
  defaultBuildingId,
  buildingName,
  projectStartAnswers,
  initialCloseout,
  attendanceRows,
  disciplines,
  parties,
  busy,
  close,
  openProjectStart,
  openFullQuestionnaire,
  save,
  focus,
}: {
  buildings: BuildingOption[];
  defaultBuildingId: string;
  buildingName: string;
  projectStartAnswers: ProjectStartAnswers | null;
  initialCloseout: DailyCloseoutAnswers | null;
  attendanceRows: DailyLogAttendanceRow[];
  disciplines: string[];
  parties: Array<{ id: string; name: string }>;
  busy: boolean;
  /**
   * Which record the supervisor came here for. The day closeout holds the works and the
   * delay alike, so both open this one screen — but on the block they were asked for,
   * instead of a whole day report to read past.
   */
  focus?: "delay" | "works_ongoing" | "works_completed";
  close: () => void;
  openProjectStart: () => void;
  openFullQuestionnaire: () => void;
  save: (input: {
    buildingIds: string[];
    answers: DailyCloseoutAnswers;
    attendance: DailyLogAttendanceRow[];
    photos: DailyLogPhoto[];
  }) => void | Promise<void>;
}) {
  const { text } = useLanguage();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  // One day can cover several buildings; the log is written once per chosen building.
  const [buildingIds, setBuildingIds] = useState<string[]>(() => {
    const resolved = resolveDefaultBuildingId(buildings, defaultBuildingId);
    return resolved ? [resolved] : [];
  });
  const buildingId = buildingIds[0] ?? resolveDefaultBuildingId(buildings, defaultBuildingId);
  // Only rows with a recorded headcount; a row per project party was noise on site.
  const [rows, setRows] = useState(() => attendanceRows.filter((row) => row.count > 0));
  const [photos, setPhotos] = useState<DailyLogPhoto[]>([]);
  const [showWorkforce, setShowWorkforce] = useState(false);

  const [log, setLog] = useState(() => ({
    constructionActivity: initialCloseout?.workOngoing ?? "",
    workPerformed: initialCloseout?.workPerformed ?? "",
    progressPercent: initialCloseout?.progressPercent ?? 0,
    qcPerformed: initialCloseout?.qualityDetails ?? "",
    inspectionResult: initialCloseout?.inspectionResult ?? "all_ok",
    hseIssues: initialCloseout?.hseDetails ?? "",
    hseEvent: initialCloseout?.hseEvent ?? "none",
    adviceToContractor: initialCloseout?.communication ?? "",
    delayCause: initialCloseout?.delayCause ?? "none",
    delayHours: initialCloseout?.delayHours ?? 0,
    delayReason: initialCloseout?.delayReason ?? "",
    contractorCompany: initialCloseout?.contractorCompany ?? "",
    tomorrowPlan: initialCloseout?.tomorrowPlan ?? "",
  }));
  /** The supervisor who closed the day, signed on the day's own form. */
  const [daySignature, setDaySignature] = useState<HandwrittenSignature | null>(() => signatureFromDetails(
    initialCloseout?.signedBy,
    initialCloseout?.signedAt,
    initialCloseout?.signatureImage,
  ) as HandwrittenSignature | null);
  const [contractorSignature, setContractorSignature] = useState<HandwrittenSignature | null>(() => signatureFromDetails(
    initialCloseout?.contractorSignedBy,
    initialCloseout?.contractorSignedAt,
    initialCloseout?.contractorSignatureImage,
  ) as HandwrittenSignature | null);

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

  const addPhotos = (files: FileList | null) => {
    const captured = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
    if (captured.length) setPhotos((current) => [...current, ...captured.map((file) => toPhotoEvidence(file))]);
  };

  const attendanceTotal = workforceTotal(rows);
  // The database requires a full closeout record; these blocks are the ones the client
  // fills in, the rest keeps whatever was recorded earlier or an explicit "none".
  const answers: DailyCloseoutAnswers = {
    daySummary: log.constructionActivity.trim(),
    weatherSummary: weatherLabel || initialCloseout?.weatherSummary || "",
    workOngoing: log.constructionActivity.trim(),
    workPerformed: log.workPerformed.trim(),
    progressPercent: log.progressPercent,
    inspectionResult: log.inspectionResult,
    qualityIssues: log.inspectionResult === "issues" ? "yes" : "no",
    qualityDetails: log.qcPerformed.trim(),
    hseEvent: log.hseEvent,
    hseDetails: log.hseIssues.trim(),
    equipmentStatus: initialCloseout?.equipmentStatus ?? "",
    deliveries: initialCloseout?.deliveries ?? "",
    testsMeasurements: initialCloseout?.testsMeasurements ?? "",
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
    risks: initialCloseout?.risks ?? "",
    tomorrowPlan: log.tomorrowPlan.trim(),
    photoCount: (initialCloseout?.photoCount ?? 0) + photos.length,
    attachmentsConfirmed: initialCloseout?.attachmentsConfirmed ?? photos.length > 0,
  };

  const delayOnly = focus === "delay";
  const ongoingOnly = focus === "works_ongoing";
  const completedOnly = focus === "works_completed";
  const workOnly = ongoingOnly || completedOnly;
  // A focused entry lives in the day closeout, so the day still has to say what happened.
  // When the closeout already exists this screen only asks about the one thing the button
  // was pressed for; when it does not, the day's own blocks are required too, and stand
  // open for that reason.
  const dayContextRequired = !(delayOnly || workOnly) || !initialCloseout;
  // Works ongoing and works completed are the same form; each button still has to end up
  // with the field it was pressed for filled in.
  const summaryRequired = dayContextRequired || ongoingOnly;
  const performedRequired = dayContextRequired || completedOnly;
  const problems: string[] = [];
  if (delayOnly && answers.delayCause === "none") problems.push(text("Choose what caused the delay.", "Kies waardoor de vertraging is ontstaan."));
  if (summaryRequired && answers.daySummary.length < 20) problems.push(text("Describe the construction activity and location in at least one full sentence.", "Beschrijf de bouwactiviteit en locatie in minimaal één volledige zin."));
  if (performedRequired && answers.workPerformed.length < 10) problems.push(text("Describe the work completed today.", "Beschrijf het werk dat vandaag is afgerond."));
  if (dayContextRequired && answers.tomorrowPlan.length < 3) problems.push(text("Enter the plan for tomorrow.", "Vul de planning voor morgen in."));
  if (answers.inspectionResult === "issues" && (answers.qualityDetails?.length ?? 0) < 10) problems.push(text("Describe the quality finding.", "Omschrijf de kwaliteitsbevinding."));
  if (answers.hseEvent !== "none" && (answers.hseDetails?.length ?? 0) < 10) problems.push(text("Describe the HSE event.", "Omschrijf de HSE-gebeurtenis."));
  if (answers.delayCause !== "none" && (answers.delayReason?.length ?? 0) < 10) problems.push(text("Describe what actually caused the delay in at least one sentence.", "Beschrijf in minimaal één zin wat de vertraging daadwerkelijk heeft veroorzaakt."));
  if (answers.delayCause !== "none" && (answers.contractorCompany?.length ?? 0) < 2) problems.push(text("Enter the responsible contractor company.", "Vul het verantwoordelijke aannemersbedrijf in."));
  if (answers.delayCause !== "none" && !contractorSignature) problems.push(text("The contractor signature is required because the contractor is responsible for the work affected by this delay.", "De handtekening van de aannemer is verplicht omdat de aannemer verantwoordelijk is voor het werk waarop deze vertraging betrekking heeft."));

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal daily-log-modal" role="dialog" aria-modal="true" aria-labelledby="daily-log-title">
        <header className="modal-header">
          <div>
            <h2 id="daily-log-title">{delayOnly
              ? text("Record a delay", "Vertraging vastleggen")
              : ongoingOnly ? text("Record works ongoing", "Werkzaamheden gaande vastleggen")
                : completedOnly ? text("Record works completed", "Werkzaamheden afgerond vastleggen")
                  : text("Today on site", "Vandaag op de bouwplaats")}</h2>
          </div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>

        <div className={`daily-log-body${delayOnly ? " focus-delay" : ongoingOnly ? " focus-works focus-ongoing" : completedOnly ? " focus-works focus-completed" : ""}`}>
          <BuildingMultiPicker
            id="daily-log-building"
            buildings={buildings}
            value={buildingIds}
            onChange={setBuildingIds}
            hint={text("Saved once per building.", "Eén keer per gebouw opgeslagen.")}
          />

          <section className="daily-log-block weather">
            <h3><CloudSun size={16} /> {text("Weather conditions", "Weersomstandigheden")}</h3>
            {projectStartAnswers ? (
              <p className="daily-log-readout"><strong>{weatherLabel}</strong><span>{shiftLabel}</span></p>
            ) : (
              <div className="daily-log-missing">
                <span>{text("Weather and hours are not confirmed yet (Project start).", "Weer en uren zijn nog niet bevestigd (Projectstart).")}</span>
                <button className="secondary-button ui-button ui-button--secondary ui-button--md" type="button" onClick={openProjectStart}>{text("Confirm project start", "Bevestig projectstart")}</button>
              </div>
            )}
          </section>

          {/* Works ongoing and works completed are two fields of one record — the day
              closeout keeps both for the same building and day, because a supervisor who
              finished something usually also has something still running. Opening the same
              form from two tiles is therefore right; showing the same form was not. The
              field you came for is the one that is open, and the other folds away until
              you ask for it. */}
          <section className="daily-log-block daily-log-works">
            <h3><HardHat size={16} /> {ongoingOnly
              ? text("What is running right now", "Wat er op dit moment loopt")
              : completedOnly
                ? text("What was finished today", "Wat vandaag is afgerond")
                : text("Construction activity & location", "Bouwactiviteit & locatie")}</h3>
            {/* These write into the works-ongoing field, so they only belong beside it. */}
            {completedOnly ? null : <div className="quick-issue-presets" aria-label={text("Common activities", "Veelvoorkomende activiteiten")}>
              {activityChoices.map((choice) => (
                <button type="button" onClick={() => setLog((current) => ({ ...current, constructionActivity: appendDictation(current.constructionActivity, `${choice} · ${buildings.find((building) => building.id === buildingId)?.name ?? buildingName}`) }))} key={choice}>{choice}</button>
              ))}
            </div>}
            {(() => {
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
                  <span>{text("Progress", "Voortgang")} · {log.progressPercent}%</span>
                  <input type="range" min={0} max={100} step={5} value={log.progressPercent} onChange={(event) => setLog({ ...log, progressPercent: Number(event.target.value) })} />
                </label>
              );

              /* The other field is still part of this record, so it stays reachable — but
                 folded, not merely faded, because a dimmed field beside an identical one
                 reads as the same form twice. */
              if (ongoingOnly) {
                return (
                  <>
                    {ongoingField}
                    {progressField}
                    <details className="daily-log-secondary">
                      <summary>{text("Also finished something today?", "Vandaag ook iets afgerond?")}</summary>
                      {completedField}
                    </details>
                  </>
                );
              }
              if (completedOnly) {
                return (
                  <>
                    {completedField}
                    {progressField}
                    <details className="daily-log-secondary">
                      <summary>{text("Also work still running?", "Ook werk dat nog loopt?")}</summary>
                      {ongoingField}
                    </details>
                  </>
                );
              }
              return (
                <>
                  {ongoingField}
                  <div className="form-grid-2">{completedField}{progressField}</div>
                </>
              );
            })()}
          </section>

          <section className="daily-log-block">
            <h3><ShieldCheck size={16} /> {text("QC performed & advice", "QC uitgevoerd & advies")}</h3>
            <div className="quick-issue-presets" aria-label={text("Inspection result", "Inspectieresultaat")}>
              {([["all_ok", text("All checked, in order", "Alles gecontroleerd, in orde")], ["issues", text("Findings recorded", "Bevindingen vastgelegd")], ["none", text("No inspection today", "Geen inspectie vandaag")]] as const).map(([value, label]) => (
                <button className={log.inspectionResult === value ? "active" : ""} type="button" onClick={() => setLog({ ...log, inspectionResult: value })} key={value}>{label}</button>
              ))}
            </div>
            <label className="form-field">
              <span>{text("What was checked?", "Wat is er gecontroleerd?")}</span>
              <textarea rows={3} value={log.qcPerformed} onChange={(event) => setLog({ ...log, qcPerformed: event.target.value })} />
              <DictateButton onText={(transcript) => setLog((current) => ({ ...current, qcPerformed: appendDictation(current.qcPerformed, transcript) }))} />
            </label>
          </section>

          <section className="daily-log-block">
            <h3><ShieldCheck size={16} /> {text("Health & safety issues", "Gezondheid & veiligheid")}</h3>
            <div className="quick-issue-presets" aria-label={text("HSE event", "HSE-gebeurtenis")}>
              {([["none", text("No incident", "Geen incident")], ["near_miss", "Near miss"], ["incident", "Incident"]] as const).map(([value, label]) => (
                <button className={log.hseEvent === value ? "active" : ""} type="button" onClick={() => setLog({ ...log, hseEvent: value })} key={value}>{label}</button>
              ))}
            </div>
            {log.hseEvent !== "none" ? (
              <label className="form-field">
                <span>{text("What happened, and which measure was taken?", "Wat is er gebeurd en welke maatregel is genomen?")}</span>
                <textarea rows={2} value={log.hseIssues} onChange={(event) => setLog({ ...log, hseIssues: event.target.value })} />
                <DictateButton onText={(transcript) => setLog((current) => ({ ...current, hseIssues: appendDictation(current.hseIssues, transcript) }))} />
              </label>
            ) : null}
          </section>

          <section className="daily-log-block">
            <h3><Users size={16} /> {text("General advice to the contractor", "Algemeen advies aan de aannemer")}</h3>
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
          </section>

          <section className="daily-log-block daily-log-delay">
            <h3><TimerOff size={16} /> {text("Delay and plan for tomorrow", "Vertraging en planning morgen")}</h3>
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
          </section>

          <details className="daily-log-extra" open={showWorkforce} onToggle={(event) => setShowWorkforce(event.currentTarget.open)}>
            <summary>{text("Workforce and photos", "Bezetting en foto's")}<span>{attendanceTotal} {text("people", "personen")} · {photos.length} {text("photos", "foto's")}</span></summary>
            {/* The same register as the Workforce screen itself. When these were two
                components, this one grew the ability to add a trade and the standalone screen
                silently kept a single counter per party. */}
            <WorkforceRegister
              rows={rows}
              setRows={setRows}
              parties={parties}
              disciplines={disciplines}
              defaultShiftStart={attendanceRows[0]?.shiftStart ?? "07:00"}
              defaultShiftEnd={attendanceRows[0]?.shiftEnd ?? "16:00"}
            />

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

            <input ref={cameraInputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={(event) => { addPhotos(event.target.files); event.target.value = ""; }} />
            <button className="secondary-button ui-button ui-button--secondary ui-button--md" type="button" onClick={() => cameraInputRef.current?.click()}><Camera size={15} /> {text("Add photo", "Foto toevoegen")}</button>
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
          </details>

          {/* The day is signed by the person who closed it, the way every other record in
              the app is signed. Optional, so an unfinished day can still be saved. */}
          <section className="daily-log-block daily-log-signature">
            <h3><ShieldCheck size={16} /> {text("Signature", "Handtekening")}</h3>
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
          </section>

          {problems.length ? (
            <div className="operation-alert warning" role="status">
              <div>
                <strong>{text("Still needed before saving", "Nog nodig voor opslaan")}</strong>
                <span>{problems.join(" ")}</span>
              </div>
            </div>
          ) : null}
        </div>

        <footer className="modal-actions daily-log-footer">
          <button className="ghost-button ui-button ui-button--quiet ui-button--md" type="button" onClick={openFullQuestionnaire}>{text("Open the full daily questions", "Open de volledige dagvragen")}</button>
          <div className="button-row">
            <button className="secondary-button ui-button ui-button--secondary ui-button--lg" type="button" onClick={close}>{text("Cancel", "Annuleren")}</button>
            <button className="primary-button ui-button ui-button--primary ui-button--lg" type="button" disabled={busy || problems.length > 0} onClick={() => void save({ buildingIds, answers, attendance: rows, photos })}>
              {busy ? <Loader2 className="spin" size={15} /> : null} {text("Save daily log", "Daglog opslaan")}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
