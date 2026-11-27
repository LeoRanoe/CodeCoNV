"use client";

import { AlertTriangle, Copy, Loader2, Plus, Save, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { resolveDefaultBuildingId, type BuildingOption } from "@/app/building-picker";
import { type HandwrittenSignature } from "@/app/signature-pad";
import { RecordFormShell, RecordSignatureField } from "@/app/forms/record-form-shell";
import { RecordSignatures } from "@/app/forms/contractor-signature";
import { useSignedSubmit } from "@/app/forms/sign-submit";
import { formIcons } from "@/app/forms/form-icons";
import { DictateButton, appendDictation, inputWithMicStyle, micInputStyle } from "@/app/dictate-button";
import { useProjectPermissions } from "@/lib/permissions/project-permissions";
import { TimeField } from "@/app/time-field";
import { useLanguage } from "@/lib/i18n";
import { FormAutoBar, autoBarItems } from "@/app/forms/form-auto-bar";
import { clearFormDraft, loadFormDraft, saveFormDraft } from "@/lib/offline/form-drafts";
import {
  workforceDeviations,
  workforceHeadcount,
} from "@/lib/forms/workforce.mjs";

/**
 * Who was on site today, per contractor and per trade.
 *
 * One contractor regularly has several trades on site at once — four masons and three
 * carpenters is two lines, not one. A screen that offers a single counter per party cannot
 * record that at all, which is why this register is built around adding the trade that is
 * actually there rather than counting down a fixed list of parties.
 */
export type WorkforceRow = {
  partyId: string;
  party: string;
  discipline: string;
  count: number;
  shiftStart: string;
  shiftEnd: string;
  /** The gang within the organisation. Optional: not every project names its crews. */
  crew?: string;
  /** Shift, attendance status and competency status of the specification's Workforce form. */
  spec?: Record<string, string>;
};

export type WorkforceParty = { id: string; name: string };

/**
 * A recorded site visit. §4.3 asks for a visitor registration next to the counted crew: an
 * inspector, a client representative or a supplier is on site without manning the work, and
 * the report has to be able to say who was there.
 */
export type VisitorRow = {
  partyId: string;
  party: string;
  visitorName: string;
  count: number;
  shiftStart: string;
  shiftEnd: string;
};

/** Adds a trade, or raises the line that already carries it, so the same trade never doubles. */
export function addWorkforceRow(
  rows: WorkforceRow[],
  party: WorkforceParty,
  discipline: string,
  shift: { start: string; end: string },
  crew = "",
): WorkforceRow[] {
  // The same organisation can field two crews of the same trade, so the gang is part of
  // what makes a line unique — otherwise "ploeg 1" and "ploeg 2" would count as one.
  const existing = rows.findIndex((row) => row.partyId === party.id
    && row.discipline === discipline
    && (row.crew ?? "") === crew);
  if (existing >= 0) {
    return rows.map((row, index) => index === existing ? { ...row, count: row.count + 1 } : row);
  }
  return [...rows, {
    partyId: party.id,
    party: party.name,
    discipline,
    count: 1,
    shiftStart: shift.start,
    shiftEnd: shift.end,
    crew: crew || undefined,
  }];
}

/**
 * The register itself, shared by the workforce screen and the workforce block inside the
 * daily log. One component on purpose: when they were two, the daily log grew the ability to
 * add a trade and the standalone screen silently kept the old one-counter-per-party list.
 */
export function WorkforceRegister({
  rows,
  setRows,
  parties,
  disciplines,
  defaultShiftStart = "07:00",
  defaultShiftEnd = "16:00",
}: {
  rows: WorkforceRow[];
  setRows: (rows: WorkforceRow[]) => void;
  parties: WorkforceParty[];
  disciplines: string[];
  defaultShiftStart?: string;
  defaultShiftEnd?: string;
}) {
  const { text } = useLanguage();
  // Mockup 04 and Excel "Workforce": one row per discipline (worker discipline, contractor, number) and "+ Add row".
  // A trade the client added later is still offered when an older row carries it.
  const add = () => setRows([...rows, { partyId: "", party: "", discipline: "", count: 0, shiftStart: defaultShiftStart, shiftEnd: defaultShiftEnd }]);
  const change = (index: number, patch: Partial<WorkforceRow>) => setRows(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  const remove = (index: number) => setRows(rows.filter((_, rowIndex) => rowIndex !== index));

  if (!parties.length || !disciplines.length) {
    return (
      <div className="empty-list-state workforce-empty">
        <Users size={22} />
        <strong>{text("No project parties configured yet", "Nog geen projectpartijen ingericht")}</strong>
        <span>{text("No parties yet. An administrator adds them under Management → Structure and parties.", "Nog geen partijen. Een beheerder voegt ze toe onder Management → Structuur en partijen.")}</span>
      </div>
    );
  }

  return (
    <div className="workforce-table" role="group" aria-label={text("Workers on site", "Werknemers op de bouwplaats")}>
      <div className="workforce-table-head" aria-hidden="true">
        <span>{text("Worker discipline", "Discipline")}</span>
        <span>{text("Contractor", "Aannemer")}</span>
        <span>{text("Number", "Aantal")}</span>
        <span />
      </div>
      {rows.map((row, index) => {
        const line = index + 1;
        const options = disciplines.includes(row.discipline) || !row.discipline ? disciplines : [...disciplines, row.discipline];
        return (
          <div className="workforce-row" key={`row-${index}`}>
            <label className="workforce-cell">
              <span className="sr-only">{text(`Worker discipline, row ${line}`, `Discipline, rij ${line}`)}</span>
              <select value={row.discipline} onChange={(event) => change(index, { discipline: event.target.value })}>
                <option value="">{text("Select discipline", "Kies discipline")}</option>
                {options.map((discipline) => <option value={discipline} key={discipline}>{discipline}</option>)}
              </select>
              {row.crew ? <small>{row.crew}</small> : null}
            </label>
            <label className="workforce-cell">
              <span className="sr-only">{text(`Contractor, row ${line}`, `Aannemer, rij ${line}`)}</span>
              <select value={row.partyId} onChange={(event) => change(index, { partyId: event.target.value, party: parties.find((party) => party.id === event.target.value)?.name ?? "" })}>
                <option value="">{text("Select contractor", "Kies aannemer")}</option>
                {parties.map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}
              </select>
            </label>
            <label className="workforce-cell workforce-number">
              <span className="sr-only">{text(`Number, row ${line}`, `Aantal, rij ${line}`)}</span>
              <input type="number" inputMode="numeric" min={0} max={999} step={1} value={row.count ? String(row.count) : ""} placeholder="0"
                onChange={(event) => change(index, { count: Math.max(0, Math.min(999, Math.round(Number(event.target.value) || 0))) })} />
            </label>
            <button className="workforce-row-remove" type="button" onClick={() => remove(index)} aria-label={text(`Remove row ${line}`, `Verwijder rij ${line}`)}><X size={14} /></button>
          </div>
        );
      })}
      <div className="workforce-table-add">
        <button className="ui-button ui-button--secondary ui-button--md workforce-add-button" type="button" onClick={add}>
          <Plus size={15} /> {text("Add row", "Rij toevoegen")}
        </button>
        <small>{text("Adds a new row with discipline, contractor and number", "Voegt een rij toe met discipline, aannemer en aantal")}</small>
      </div>
    </div>
  );
}

/** A row is counted once it names the discipline, the contractor and a number. */
export const completeWorkforceRow = (row: WorkforceRow) => Boolean(row.discipline && row.partyId && row.count > 0);

/**
 * The database keeps one line per building, organisation and trade (and crew): two table rows for the same
 * discipline and contractor are one line with the numbers added up.
 */
export function mergeWorkforceRows(rows: WorkforceRow[]): WorkforceRow[] {
  const merged: WorkforceRow[] = [];
  for (const row of rows.filter(completeWorkforceRow)) {
    const existing = merged.find((entry) => entry.partyId === row.partyId && entry.discipline === row.discipline && (entry.crew ?? "") === (row.crew ?? ""));
    if (existing) existing.count += row.count;
    else merged.push({ ...row });
  }
  return merged;
}

type WorkforceDraft = {
  rowsByBuilding: Record<string, WorkforceRow[]>;
  visitorsByBuilding: Record<string, VisitorRow[]>;
  note: string;
  signature: HandwrittenSignature | null;
};

/**
 * The workforce form the Workforce tile opens: the register, plus the context that says
 * which building and which day it belongs to, and the way to take over yesterday's crew.
 * It is a workspace page like every other record form, not a pop-up.
 */
export function WorkforceForm({
  buildings,
  defaultBuildingId,
  initialRows,
  rowsForBuilding,
  parties,
  disciplines,
  defaultShiftStart,
  defaultShiftEnd,
  expectedWorkers,
  initialNote,
  initialVisitors,
  currentUserName,
  busy,
  draftKey,
  close,
  copyPreviousWorkday,
  save,
}: {
  buildings: BuildingOption[];
  defaultBuildingId: string;
  initialRows: WorkforceRow[];
  /** The crew already recorded for another building of the same day. */
  rowsForBuilding: (buildingId: string) => WorkforceRow[];
  parties: WorkforceParty[];
  disciplines: string[];
  defaultShiftStart: string;
  defaultShiftEnd: string;
  /** What the project start planned for today, so a deviation can be seen instead of guessed. */
  expectedWorkers: number | null;
  initialNote: string;
  initialVisitors: VisitorRow[];
  /** Filled into the signature by default, exactly as every other record form does it. */
  currentUserName?: string;
  busy: boolean;
  /** Where today's unsaved count is kept on the device. */
  draftKey: string;
  close: () => void;
  /** Returns the crew of the last workday that had one, or null when there is none yet. */
  copyPreviousWorkday: (buildingId?: string) => Promise<{ reportDate: string; rows: WorkforceRow[] } | null>;
  save: (
    perBuilding: Array<{ buildingId: string; rows: WorkforceRow[]; visitors: VisitorRow[] }>,
    note: string,
    signature: HandwrittenSignature | null,
  ) => boolean | void | Promise<boolean | void>;
}) {
  const { locale, text } = useLanguage();
  // Counting the crew is attendance.manage; everyone else may look but not change.
  const readOnly = !useProjectPermissions().can("attendance.manage");
  const firstBuildingId = resolveDefaultBuildingId(buildings, defaultBuildingId);
  const [buildingId, setBuildingId] = useState(firstBuildingId);
  /** The supervisor who counted the crew, signed on the register itself. */
  const [signature, setSignature] = useState<HandwrittenSignature | null>(null);
  /**
   * A crew per building, all of them at once. The client wrote it on this screen: "ik kan
   * hier niet van beide gebouwen invullen!" Switching used to throw away what was typed, so
   * a day covering two buildings meant opening the screen twice and saving twice.
   *
   * The counts are deliberately not shared between buildings: four masons in one building
   * and three in the other is seven people, and copying one list to both would say fourteen.
   */
  const [rowsByBuilding, setRowsByBuilding] = useState<Record<string, WorkforceRow[]>>(
    // A row per project party at zero was the fixed list the client crossed out. Only what
    // was really counted comes back.
    () => ({ [firstBuildingId]: initialRows.filter((row) => row.count > 0) }),
  );
  const [visitorsByBuilding, setVisitorsByBuilding] = useState<Record<string, VisitorRow[]>>(
    () => ({ [firstBuildingId]: initialVisitors }),
  );
  const [copyNote, setCopyNote] = useState("");
  /** undefined while the last workday is still being looked up, null when there is none. */
  const [previousDay, setPreviousDay] = useState<{ reportDate: string; rows: WorkforceRow[] } | null | undefined>(undefined);
  const [previousTotal, setPreviousTotal] = useState<number | null>(null);
  const [note, setNote] = useState(initialNote);
  const [visitorDraft, setVisitorDraft] = useState(() => ({ partyId: parties[0]?.id ?? "", visitorName: "" }));

  // A count that is interrupted — a call, the back button, a phone that locks — is kept on the
  // device and put back the next time the form opens, until it is confirmed.
  const [draftState, setDraftState] = useState<"loading" | "restored" | "ready">("loading");
  useEffect(() => {
    let cancelled = false;
    void loadFormDraft<WorkforceDraft>(draftKey).then((draft) => {
      if (cancelled) return;
      if (draft) {
        setRowsByBuilding((current) => ({ ...current, ...draft.value.rowsByBuilding }));
        setVisitorsByBuilding((current) => ({ ...current, ...draft.value.visitorsByBuilding }));
        setNote(draft.value.note ?? "");
        setSignature(draft.value.signature ?? null);
      }
      setDraftState(draft ? "restored" : "ready");
    });
    return () => { cancelled = true; };
  }, [draftKey]);
  const [saving, setSaving] = useState(false);
  // Only a change made on the form starts a draft; opening it and walking away does not.
  const draftArmed = useRef(false);
  useEffect(() => {
    if (draftState === "loading" || saving || readOnly) return;
    if (!draftArmed.current) { draftArmed.current = true; return; }
    const timer = window.setTimeout(() => {
      void saveFormDraft<WorkforceDraft>(draftKey, { rowsByBuilding, visitorsByBuilding, note, signature });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draftKey, draftState, note, readOnly, rowsByBuilding, saving, signature, visitorsByBuilding]);
  const discardDraft = () => {
    void clearFormDraft(draftKey);
    setRowsByBuilding({ [firstBuildingId]: initialRows.filter((row) => row.count > 0) });
    setVisitorsByBuilding({ [firstBuildingId]: initialVisitors });
    setNote(initialNote);
    setSignature(null);
    setDraftState("ready");
  };

  const rows = rowsByBuilding[buildingId] ?? [];
  const visitors = visitorsByBuilding[buildingId] ?? [];
  const setRows = (next: WorkforceRow[]) => setRowsByBuilding((current) => ({ ...current, [buildingId]: next }));
  const setVisitors = (next: VisitorRow[]) => setVisitorsByBuilding((current) => ({ ...current, [buildingId]: next }));

  const buildingTotals = buildings.map((building) => ({
    building,
    count: workforceHeadcount((rowsByBuilding[building.id] ?? rowsForBuilding(building.id)).filter(completeWorkforceRow)),
  }));
  const filledBuildings = buildings.filter((building) => (rowsByBuilding[building.id] ?? []).some(completeWorkforceRow)
    || (visitorsByBuilding[building.id] ?? []).length > 0);
  // The deviation is judged on the day as a whole: a crew moved from one building to the
  // other is not a shortage, and comparing per building would call it one twice.
  const total = buildingTotals.reduce((sum, entry) => sum + entry.count, 0);
  const deviations = workforceDeviations({ total, expected: expectedWorkers, previous: previousTotal });

  // Every other form in the app numbers its sections, and a number that jumps from 1 to 3
  // because a block did not apply today reads as a step that was skipped. The blocks that
  // are actually on screen are numbered 1, 2, 3.
  const showVisitors = parties.length > 0;
  const showDeviations = deviations.length > 0;

  const addVisitor = () => {
    const party = parties.find((item) => item.id === visitorDraft.partyId);
    const visitorName = visitorDraft.visitorName.trim();
    if (!party || visitorName.length < 2) return;
    setVisitors([...visitors, {
      partyId: party.id,
      party: party.name,
      visitorName,
      count: 1,
      shiftStart: defaultShiftStart,
      shiftEnd: defaultShiftEnd,
    }]);
    setVisitorDraft({ ...visitorDraft, visitorName: "" });
  };

  const switchBuilding = (nextBuildingId: string) => {
    setBuildingId(nextBuildingId);
    setCopyNote("");
    setPreviousDay(undefined);
    // What was already typed for this building stays; only a building never opened before
    // is filled from what the day already had recorded for it.
    setRowsByBuilding((current) => current[nextBuildingId]
      ? current
      : { ...current, [nextBuildingId]: rowsForBuilding(nextBuildingId).filter((row) => row.count > 0) });
  };

  // The last workday is loaded as soon as the screen opens, not only when the button is
  // pressed: §4.3 asks the app to signal a large deviation, and it cannot do that without
  // knowing what yesterday looked like.
  useEffect(() => {
    let active = true;
    void copyPreviousWorkday(buildingId)
      .then((previous) => { if (active) setPreviousDay(previous); })
      .catch(() => { if (active) setPreviousDay(null); });
    return () => { active = false; };
    // The loader is rebuilt on every render of the parent; the building is what changes here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  useEffect(() => {
    let active = true;
    void copyPreviousWorkday()
      .then((previous) => { if (active) setPreviousTotal(previous ? workforceHeadcount(previous.rows) : null); })
      .catch(() => { if (active) setPreviousTotal(null); });
    return () => { active = false; };
    // The project stays fixed while this form is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  const copyPrevious = () => {
    setCopyNote("");
    if (!previousDay) {
      setCopyNote(text(
        "No earlier workday with a recorded crew was found for this building.",
        "Er is voor dit gebouw geen eerdere werkdag met vastgelegde bezetting gevonden.",
      ));
      return;
    }
    // Taking over yesterday never wipes what was already counted today: the lines that are
    // already there keep the number the supervisor gave them.
    const merged = previousDay.rows.reduce((current, row) => current.some((existing) =>
      existing.partyId === row.partyId
      && existing.discipline === row.discipline
      && (existing.crew ?? "") === (row.crew ?? ""))
      ? current
      : [...current, { ...row, spec: undefined }], rows);
    setRows(merged);
    setCopyNote(text(`Crew of ${previousDay.reportDate} taken over.`, `Bezetting van ${previousDay.reportDate} overgenomen.`));
  };

  const confirm = async () => {
    setSaving(true);
    const result = await save(filledBuildings.map((building) => ({
      buildingId: building.id,
      rows: mergeWorkforceRows(rowsByBuilding[building.id] ?? []),
      visitors: visitorsByBuilding[building.id] ?? [],
    })), note, signature);
    if (result !== false) {
      // Confirmed: the count is the record now, not a draft. The form stays open for a
      // correction later in the day, which starts a new draft only when something changes.
      await clearFormDraft(draftKey);
      draftArmed.current = false;
      setDraftState("ready");
    }
    setSaving(false);
  };

  const signing = useSignedSubmit({
    value: signature,
    onChange: setSignature,
    submit: () => void confirm(),
    title: text("Sign and confirm the attendance", "Onderteken en bevestig de aanwezigheid"),
    declaration: text("I confirm that this attendance reflects the crew I counted on site.", "Ik bevestig dat deze aanwezigheid de bezetting weergeeft die ik op de bouwplaats heb geteld."),
    nameSuggestion: currentUserName,
    enabled: !readOnly,
  });

  // Mockup 04: the action bar says what is still needed, then Cancel, Save draft and "Sign, submit & notify".
  const incompleteRows = buildings.some((building) => (rowsByBuilding[building.id] ?? []).some((row) => !completeWorkforceRow(row) && Boolean(row.discipline || row.partyId || row.count > 0)));
  const stillNeeded = [
    filledBuildings.length ? "" : text("Workers on site", "Werknemers op de bouwplaats"),
    incompleteRows ? text("discipline, contractor and number on every row", "discipline, aannemer en aantal op elke rij") : "",
  ].filter(Boolean);
  const today = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "America/Paramaribo" }).format(new Date());
  const saveDraftNow = () => {
    draftArmed.current = true;
    void saveFormDraft<WorkforceDraft>(draftKey, { rowsByBuilding, visitorsByBuilding, note, signature });
  };

  return (
    <RecordFormShell
      title={text("Who is on site today?", "Wie is er vandaag op de bouwplaats?")}
      icon={formIcons.workforce}
      status={readOnly ? text("Read only", "Alleen lezen") : undefined}
      busy={busy}
      overlay={signing.dialog}
      className="wide sectioned-record-form workforce-form"
      headerAside={draftState === "restored" ? (
        <span className="daily-log-draft" role="status">
          {text("Unsaved count restored", "Niet-opgeslagen telling hersteld")}
          <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={discardDraft}>{text("Discard draft", "Concept weggooien")}</button>
        </span>
      ) : null}
    >
        <div className="workforce-body">
          {/* Every form opens with the same system-filled head (Excel v5.0, START HERE "Record header"; mockup 04). */}
          <FormAutoBar items={autoBarItems({
            idLabel: text("Record ID", "Registratienummer"),
            idValue: text("On submit", "Bij indienen"),
            dateLabel: text("Report date", "Rapportdatum"),
            dateValue: today,
            byLabel: text("Submitted by", "Ingediend door"),
            byValue: currentUserName || "—",
            statusValue: text("Draft", "Concept"),
            text,
          })} />
          <fieldset className="workforce-fieldset" disabled={readOnly}>
          <section className="record-section spec-section sheet-form workforce-sheet" aria-label={text("Form", "Formulier")}>
            {/* Mockup 04: the title is filled in by the app, "Workforce · date". */}
            <div className="sheet-title-row" data-sheet-title>
              <div className="form-field sheet-slot workforce-title">
                <span className="sheet-slot-label">{text("Title", "Titel")} <em className="record-section-required">*</em> <span className="form-auto-tag">{text("Auto", "Auto")}</span></span>
                <output>{text(`Workforce · ${today}`, `Bezetting · ${today}`)}</output>
              </div>
            </div>

            <section className="sheet-card workforce-section">
              <h3 className="sheet-section-title" data-sheet-section="1">
                <span className="sheet-section-number" aria-hidden="true">1</span>
                <span className="sheet-section-name">{text("Workforce", "Bezetting")}</span>
                <span className="sheet-section-hint">{text("How many workers are on site today?", "Hoeveel werknemers zijn er vandaag op de bouwplaats?")}</span>
              </h3>
              {/* One tab per building, each with its own crew; every building that gets a crew is written when you submit. */}
              {buildings.length > 1 ? (
                <div className="workforce-buildings" role="tablist" aria-label={text("Buildings", "Gebouwen")}>
                  {buildingTotals.map((entry) => (
                    <button className={entry.building.id === buildingId ? "active" : ""} type="button" role="tab" aria-selected={entry.building.id === buildingId} onClick={() => switchBuilding(entry.building.id)} key={entry.building.id}>
                      <span>{entry.building.name}</span>
                      <b>{entry.count}</b>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="workforce-label-row">
                <span className="sheet-slot-label">{text("Workers on site", "Werknemers op de bouwplaats")} <em className="record-section-required">*</em> <small>{text("(add a row per discipline)", "(een rij per discipline)")}</small></span>
                <button className="ui-button ui-button--quiet ui-button--md" type="button" disabled={previousDay === undefined} onClick={copyPrevious}>
                  {previousDay === undefined ? <Loader2 className="spin" size={13} /> : <Copy size={13} />} {text("Copy previous workday", "Vorige werkdag overnemen")}
                </button>
              </div>
              {copyNote ? <small className="form-helper" aria-live="polite">{copyNote}</small> : null}
              <div className="workforce-sections">
                <WorkforceRegister rows={rows} setRows={setRows} parties={parties} disciplines={disciplines} defaultShiftStart={defaultShiftStart} defaultShiftEnd={defaultShiftEnd} />
              </div>
              <div className="workforce-headline workforce-total">
                <span>{buildings.length > 1 ? text("Total workers on site · all buildings", "Totaal op de bouwplaats · alle gebouwen") : text("Total workers on site", "Totaal op de bouwplaats")}</span>
                <strong>{total}</strong>
                <span className="form-auto-tag">{text("Auto", "Auto")}</span>
              </div>
              {/* §4.3: a large deviation is signalled; the explanation goes in Remarks. */}
              {showDeviations ? (
                <ul className="workforce-deviation-list" role="status">
                  {deviations.map((deviation) => (
                    <li key={deviation.id}>
                      <AlertTriangle size={14} aria-hidden="true" />
                      <strong>{deviation.kind === "planned" ? text("Against the plan", "Tegenover de planning") : text("Against the last workday", "Tegenover de vorige werkdag")}</strong>
                      <span>{text(
                        `${deviation.total} on site against ${deviation.reference} — ${Math.round(deviation.share * 100)}% ${deviation.direction === "above" ? "more" : "fewer"}.`,
                        `${deviation.total} aanwezig tegenover ${deviation.reference} — ${Math.round(deviation.share * 100)}% ${deviation.direction === "above" ? "meer" : "minder"}.`,
                      )}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <label className="form-field workforce-remarks">
                <span>{text("Remarks", "Opmerkingen")}</span>
                <textarea rows={1} value={note} onChange={(event) => setNote(event.target.value)} placeholder={showDeviations ? text("Why is the crew different today?", "Waarom wijkt de bezetting vandaag af?") : text("Optional", "Optioneel")} />
                <DictateButton onText={(transcript) => setNote((current) => appendDictation(current, transcript))} />
              </label>
              {/* §4.3: visitors are on site but never part of the headcount. Not on the Excel sheet, so folded away. */}
              {showVisitors ? (
                <details className="workforce-visitors" open={visitors.length > 0 || undefined}>
                  <summary>{text("Visitors (not counted)", "Bezoekers (niet meegeteld)")} · {visitors.length}</summary>
                  <div className="workforce-add">
                    <label className="form-field">
                      <span>{text("Organisation", "Organisatie")}</span>
                      <select value={visitorDraft.partyId} onChange={(event) => setVisitorDraft({ ...visitorDraft, partyId: event.target.value })}>
                        {parties.map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}
                      </select>
                    </label>
                    <label className="form-field">
                      <span>{text("Name", "Naam")}</span>
                      <input style={inputWithMicStyle} value={visitorDraft.visitorName} onChange={(event) => setVisitorDraft({ ...visitorDraft, visitorName: event.target.value })}
                        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addVisitor(); } }}
                        placeholder={text("Who visited the site?", "Wie was er op bezoek?")} maxLength={160} />
                      <DictateButton style={micInputStyle} onText={(transcript) => setVisitorDraft((current) => ({ ...current, visitorName: appendDictation(current.visitorName, transcript).slice(0, 160) }))} />
                    </label>
                    <button className="ui-button ui-button--secondary ui-button--md workforce-add-button" type="button" disabled={visitorDraft.visitorName.trim().length < 2} onClick={addVisitor}>
                      <Plus size={15} /> {text("Add visitor", "Bezoeker toevoegen")}
                    </button>
                  </div>
                  <div className="workforce-rows">
                    {visitors.map((visitor, index) => (
                      <div className="workforce-visitor-row" key={`${visitor.partyId}:${visitor.visitorName}`}>
                        <span className="workforce-row-name"><strong>{visitor.visitorName}</strong><small>{visitor.party}</small></span>
                        <span className="workforce-shift">
                          <label><TimeField label={text(`Arrival of ${visitor.visitorName}`, `Aankomst van ${visitor.visitorName}`)} value={visitor.shiftStart} onChange={(value) => setVisitors(visitors.map((entry, entryIndex) => entryIndex === index ? { ...entry, shiftStart: value } : entry))} /></label>
                          <em>–</em>
                          <label><TimeField label={text(`Departure of ${visitor.visitorName}`, `Vertrek van ${visitor.visitorName}`)} value={visitor.shiftEnd} onChange={(value) => setVisitors(visitors.map((entry, entryIndex) => entryIndex === index ? { ...entry, shiftEnd: value } : entry))} /></label>
                        </span>
                        <button className="workforce-row-remove" type="button" onClick={() => setVisitors(visitors.filter((_, entryIndex) => entryIndex !== index))} aria-label={text(`Remove ${visitor.visitorName}`, `Verwijder ${visitor.visitorName}`)}><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </section>

            {/* Mockup 04: the sign-off card. Supervision records the workforce and submits it (WF-ATTENDANCE-SUPERVISION, final on submit). */}
            <section className="sheet-card">
              <h3 className="sheet-section-title" data-sheet-section="2">
                <span className="sheet-section-number" aria-hidden="true">2</span>
                <span className="sheet-section-name">{text("Sign-off / review workflow", "Ondertekening / beoordelingsproces")}</span>
                <span className="sheet-section-hint">WF-ATTENDANCE-SUPERVISION · {text("Workflow status", "Workflowstatus")}: <strong>{text("Draft", "Concept")}</strong> · AUTO</span>
              </h3>
              <p className="sheet-workflow">
                <span><span className="sheet-role sheet-role--supervision">{text("Supervision", "Supervisie")}</span> {text("records workforce", "legt de bezetting vast")}<span aria-hidden="true"> →</span></span>
                <span><span className="sheet-role sheet-role--supervision">{text("Supervision", "Supervisie")}</span> {text("submits", "dient in")}</span>
              </p>
              <div className="sheet-signoff">
                <RecordSignatures>
                  <RecordSignatureField
                    value={signature}
                    onChange={setSignature}
                    nameSuggestion={currentUserName}
                    role={text("Recording supervisor", "Vastleggende supervisor")}
                    declaration={text(
                      "I confirm that this attendance reflects the crew I counted on site.",
                      "Ik bevestig dat deze aanwezigheid de bezetting weergeeft die ik op de bouwplaats heb geteld.",
                    )}
                  />
                </RecordSignatures>
              </div>
            </section>
          </section>
          </fieldset>
          <div className="record-form-actions">
            {stillNeeded.length ? <small className="confirm-needs"><strong>{text(`${stillNeeded.length} required left`, `Nog ${stillNeeded.length} verplicht`)}</strong>: {stillNeeded.join(" · ")} · {text("auto-saved", "automatisch bewaard")}</small> : null}
            <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={close}><X size={14} /> {text("Cancel", "Annuleren")}</button>
            {readOnly ? null : <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={saveDraftNow}><Save size={14} /> {text("Save draft", "Concept opslaan")}</button>}
            {readOnly ? null : (
              <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || saving || stillNeeded.length > 0} onClick={signing.request}>
                {busy || saving ? <Loader2 className="spin" size={15} /> : <Save size={15} />} {filledBuildings.length > 1
                  ? text(`Sign, submit & notify · ${filledBuildings.length} buildings`, `Ondertekenen, indienen & melden · ${filledBuildings.length} gebouwen`)
                  : text("Sign, submit & notify", "Ondertekenen, indienen & melden")}
              </button>
            )}
          </div>
        </div>
    </RecordFormShell>
  );
}
