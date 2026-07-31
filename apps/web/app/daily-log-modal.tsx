"use client";

import { Camera, CloudSun, HardHat, Loader2, ShieldCheck, TimerOff, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BuildingPicker, resolveDefaultBuildingId, type BuildingOption } from "@/app/building-picker";
import { appendDictation, DictateButton } from "@/app/dictate-button";
import { useLanguage } from "@/lib/i18n";
import type { DailyCloseoutAnswers, ProjectStartAnswers } from "@/lib/forms/daily-report";

export type DailyLogAttendanceRow = {
  partyId: string;
  party: string;
  discipline: string;
  count: number;
  shiftStart: string;
  shiftEnd: string;
};

/**
 * A photo plus the name the supervisor gives it. Without a name a day with eight photos
 * ends up in the report as eight numbered files nobody can place afterwards.
 */
export type DailyLogPhoto = {
  file: File;
  caption: string;
};

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
  close: () => void;
  openProjectStart: () => void;
  openFullQuestionnaire: () => void;
  save: (input: {
    buildingId: string;
    answers: DailyCloseoutAnswers;
    attendance: DailyLogAttendanceRow[];
    photos: DailyLogPhoto[];
  }) => void | Promise<void>;
}) {
  const { text } = useLanguage();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [buildingId, setBuildingId] = useState(() => resolveDefaultBuildingId(buildings, defaultBuildingId));
  const [rows, setRows] = useState(attendanceRows);
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
    tomorrowPlan: initialCloseout?.tomorrowPlan ?? "",
  }));

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

  const setCount = (index: number, delta: number) => setRows((current) =>
    current.map((row, rowIndex) => rowIndex === index ? { ...row, count: Math.max(0, row.count + delta) } : row));

  const addPhotos = (files: FileList | null) => {
    const captured = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
    if (captured.length) setPhotos((current) => [...current, ...captured.map((file) => ({ file, caption: "" }))]);
  };
  const setCaption = (index: number, caption: string) => setPhotos((current) =>
    current.map((photo, photoIndex) => photoIndex === index ? { ...photo, caption } : photo));
  const removePhoto = (index: number) => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index));
  const photoPreviews = useMemo(() => photos.map((photo) => URL.createObjectURL(photo.file)), [photos]);
  useEffect(() => () => photoPreviews.forEach((preview) => URL.revokeObjectURL(preview)), [photoPreviews]);

  const attendanceTotal = rows.reduce((sum, row) => sum + row.count, 0);
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
    communication: log.adviceToContractor.trim(),
    risks: initialCloseout?.risks ?? "",
    tomorrowPlan: log.tomorrowPlan.trim(),
    photoCount: (initialCloseout?.photoCount ?? 0) + photos.length,
    attachmentsConfirmed: initialCloseout?.attachmentsConfirmed ?? photos.length > 0,
  };

  const problems: string[] = [];
  if (answers.daySummary.length < 20) problems.push(text("Describe the construction activity and location in at least one full sentence.", "Beschrijf de bouwactiviteit en locatie in minimaal één volledige zin."));
  if (answers.workPerformed.length < 10) problems.push(text("Describe the work completed today.", "Beschrijf het werk dat vandaag is afgerond."));
  if (answers.tomorrowPlan.length < 3) problems.push(text("Enter the plan for tomorrow.", "Vul de planning voor morgen in."));
  if (answers.inspectionResult === "issues" && (answers.qualityDetails?.length ?? 0) < 10) problems.push(text("Describe the quality finding.", "Omschrijf de kwaliteitsbevinding."));
  if (answers.hseEvent !== "none" && (answers.hseDetails?.length ?? 0) < 10) problems.push(text("Describe the HSE event.", "Omschrijf de HSE-gebeurtenis."));

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal daily-log-modal" role="dialog" aria-modal="true" aria-labelledby="daily-log-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">{text("Daily log", "Daglog")}</p>
            <h2 id="daily-log-title">{text("Today on site", "Vandaag op de bouwplaats")}</h2>
            <p>{text("The same blocks as your weekly report, in the same order.", "Dezelfde blokken als in je weekrapport, in dezelfde volgorde.")}</p>
          </div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>

        <div className="daily-log-body">
          <BuildingPicker id="daily-log-building" buildings={buildings} value={buildingId} onChange={setBuildingId} />

          <section className="daily-log-block weather">
            <h3><CloudSun size={16} /> {text("Weather conditions", "Weersomstandigheden")}</h3>
            {projectStartAnswers ? (
              <p className="daily-log-readout"><strong>{weatherLabel}</strong><span>{shiftLabel}</span></p>
            ) : (
              <div className="daily-log-missing">
                <span>{text("Weather and working hours come from Project start and are not confirmed yet.", "Weer en werktijden komen uit Projectstart en zijn nog niet bevestigd.")}</span>
                <button className="secondary-button" type="button" onClick={openProjectStart}>{text("Confirm project start", "Bevestig projectstart")}</button>
              </div>
            )}
          </section>

          <section className="daily-log-block">
            <h3><HardHat size={16} /> {text("Construction activity & location", "Bouwactiviteit & locatie")}</h3>
            <div className="quick-issue-presets" aria-label={text("Common activities", "Veelvoorkomende activiteiten")}>
              {activityChoices.map((choice) => (
                <button type="button" onClick={() => setLog((current) => ({ ...current, constructionActivity: appendDictation(current.constructionActivity, `${choice} · ${buildings.find((building) => building.id === buildingId)?.name ?? buildingName}`) }))} key={choice}>{choice}</button>
              ))}
            </div>
            <label className="form-field">
              <span>{text("What is in progress, and where?", "Wat is er gaande, en waar?")}</span>
              <textarea rows={3} value={log.constructionActivity} onChange={(event) => setLog({ ...log, constructionActivity: event.target.value })} />
              <DictateButton onText={(transcript) => setLog((current) => ({ ...current, constructionActivity: appendDictation(current.constructionActivity, transcript) }))} />
            </label>
            <div className="form-grid-2">
              <label className="form-field">
                <span>{text("Work completed today", "Werk vandaag afgerond")}</span>
                <textarea rows={2} value={log.workPerformed} onChange={(event) => setLog({ ...log, workPerformed: event.target.value })} />
                <DictateButton onText={(transcript) => setLog((current) => ({ ...current, workPerformed: appendDictation(current.workPerformed, transcript) }))} />
              </label>
              <label className="form-field">
                <span>{text("Progress", "Voortgang")} · {log.progressPercent}%</span>
                <input type="range" min={0} max={100} step={5} value={log.progressPercent} onChange={(event) => setLog({ ...log, progressPercent: Number(event.target.value) })} />
              </label>
            </div>
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

          <section className="daily-log-block">
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
            <label className="form-field">
              <span>{text("Plan for tomorrow", "Planning voor morgen")}</span>
              <textarea rows={2} value={log.tomorrowPlan} onChange={(event) => setLog({ ...log, tomorrowPlan: event.target.value })} />
              <DictateButton onText={(transcript) => setLog((current) => ({ ...current, tomorrowPlan: appendDictation(current.tomorrowPlan, transcript) }))} />
            </label>
          </section>

          <details className="daily-log-extra" open={showWorkforce} onToggle={(event) => setShowWorkforce(event.currentTarget.open)}>
            <summary>{text("Workforce and photos", "Bezetting en foto's")}<span>{attendanceTotal} {text("people", "personen")} · {photos.length} {text("photos", "foto's")}</span></summary>
            <div className="daily-log-workforce">
              {rows.map((row, index) => (
                <div key={`${row.partyId}:${row.discipline}`}>
                  <span><strong>{row.discipline}</strong><small>{row.party}</small></span>
                  <div className="daily-log-counter">
                    <button type="button" onClick={() => setCount(index, -1)} aria-label={text(`One less ${row.discipline}`, `Eén ${row.discipline} minder`)}>−</button>
                    <b>{row.count}</b>
                    <button type="button" onClick={() => setCount(index, 1)} aria-label={text(`One more ${row.discipline}`, `Eén ${row.discipline} meer`)}>+</button>
                  </div>
                </div>
              ))}
              {!rows.length ? <p className="form-helper">{text("No workforce rows yet. Add parties and disciplines under Management.", "Nog geen bezettingsregels. Voeg partijen en disciplines toe onder Management.")}</p> : null}
              {disciplines.length && parties.length ? null : <p className="form-helper">{text("Configure project parties and disciplines to record workforce here.", "Configureer projectpartijen en disciplines om hier bezetting vast te leggen.")}</p>}
            </div>

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
            <button className="secondary-button" type="button" onClick={() => cameraInputRef.current?.click()}><Camera size={15} /> {text("Add photo", "Foto toevoegen")}</button>
            {photos.length ? (
              <div className="daily-log-photo-list">
                {photos.map((photo, index) => (
                  <div key={photoPreviews[index]}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreviews[index]} alt={photo.file.name} />
                    <label className="form-field">
                      <span>{text("Photo name for the report", "Fotonaam voor het rapport")}</span>
                      <input
                        value={photo.caption}
                        onChange={(event) => setCaption(index, event.target.value)}
                        placeholder={text("For example: rebar column line B", "Bijvoorbeeld: wapening kolom lijn B")}
                      />
                    </label>
                    <button className="daily-log-photo-remove" type="button" onClick={() => removePhoto(index)} aria-label={text(`Remove ${photo.file.name}`, `Verwijder ${photo.file.name}`)}><X size={13} /></button>
                  </div>
                ))}
              </div>
            ) : null}
          </details>

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
          <button className="ghost-button" type="button" onClick={openFullQuestionnaire}>{text("Open the full daily questions", "Open de volledige dagvragen")}</button>
          <div className="button-row">
            <button className="secondary-button" type="button" onClick={close}>{text("Cancel", "Annuleren")}</button>
            <button className="primary-button" type="button" disabled={busy || problems.length > 0} onClick={() => void save({ buildingId, answers, attendance: rows, photos })}>
              {busy ? <Loader2 className="spin" size={15} /> : null} {text("Save daily log", "Daglog opslaan")}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
