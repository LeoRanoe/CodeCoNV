"use client";

import { AlertTriangle, Copy, Loader2, Minus, Plus, Sigma, UserCheck, Users, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { resolveDefaultBuildingId, type BuildingOption } from "@/app/building-picker";
import { type HandwrittenSignature } from "@/app/signature-pad";
import { RecordFormSection, RecordFormShell, RecordSignatureField } from "@/app/forms/record-form-shell";
import { DictateButton, appendDictation } from "@/app/dictate-button";
import { useProjectPermissions } from "@/lib/permissions/project-permissions";
import { useLanguage } from "@/lib/i18n";
import { clearFormDraft, loadFormDraft, saveFormDraft } from "@/lib/offline/form-drafts";
import {
  workforceByDiscipline,
  workforceByParty,
  workforceDeviations,
  workforceNoteRequired,
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

export function workforceTotal(rows: WorkforceRow[]) {
  return rows.reduce((sum, row) => sum + row.count, 0);
}

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
  editShifts = false,
}: {
  rows: WorkforceRow[];
  setRows: (rows: WorkforceRow[]) => void;
  parties: WorkforceParty[];
  disciplines: string[];
  defaultShiftStart?: string;
  defaultShiftEnd?: string;
  /** The standalone screen can correct a shift; inside the daily log that is one field too many. */
  editShifts?: boolean;
}) {
  const { text } = useLanguage();
  const [draft, setDraft] = useState(() => ({ partyId: parties[0]?.id ?? "", discipline: disciplines[0] ?? "", crew: "" }));

  const add = () => {
    const party = parties.find((item) => item.id === draft.partyId);
    if (!party || !draft.discipline) return;
    setRows(addWorkforceRow(rows, party, draft.discipline, { start: defaultShiftStart, end: defaultShiftEnd }, draft.crew.trim()));
  };
  const setCount = (index: number, delta: number) => setRows(rows.map((row, rowIndex) =>
    rowIndex === index ? { ...row, count: Math.max(0, row.count + delta) } : row));
  const setShift = (index: number, part: "shiftStart" | "shiftEnd", value: string) => setRows(rows.map((row, rowIndex) =>
    rowIndex === index ? { ...row, [part]: value } : row));
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
    <>
      {/* Add the trade that is really on site, instead of counting down a fixed row for every
          project party — which is what the client crossed out. */}
      <div className="workforce-add">
        <label className="form-field">
          <span>{text("Party", "Partij")}</span>
          <select value={draft.partyId} onChange={(event) => setDraft({ ...draft, partyId: event.target.value })}>
            {parties.map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>{text("Trade", "Discipline")}</span>
          <select value={draft.discipline} onChange={(event) => setDraft({ ...draft, discipline: event.target.value })}>
            {disciplines.map((discipline) => <option value={discipline} key={discipline}>{discipline}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>{text("Crew · optional", "Ploeg · optioneel")}</span>
          <input
            value={draft.crew}
            onChange={(event) => setDraft({ ...draft, crew: event.target.value })}
            placeholder={text("For example: crew 2", "Bijvoorbeeld: ploeg 2")}
            maxLength={100}
          />
        </label>
        <button className="ui-button ui-button--secondary ui-button--md workforce-add-button" type="button" onClick={add}>
          <Plus size={15} /> {text("Add person", "Persoon toevoegen")}
        </button>
      </div>

      <div className="workforce-rows">
        {rows.map((row, index) => (
          <div className="workforce-row" key={`${row.partyId}:${row.discipline}:${row.crew ?? ""}`}>
            <span className="workforce-row-name">
              <strong>{row.discipline}</strong>
              <small>{row.crew ? `${row.party} · ${row.crew}` : row.party}</small>
            </span>
            {editShifts ? (
              <span className="workforce-shift">
                <label>
                  <span className="sr-only">{text(`Shift start for ${row.discipline}`, `Aanvang dienst voor ${row.discipline}`)}</span>
                  <input type="time" value={row.shiftStart} onChange={(event) => setShift(index, "shiftStart", event.target.value)} />
                </label>
                <em>–</em>
                <label>
                  <span className="sr-only">{text(`Shift end for ${row.discipline}`, `Einde dienst voor ${row.discipline}`)}</span>
                  <input type="time" value={row.shiftEnd} onChange={(event) => setShift(index, "shiftEnd", event.target.value)} />
                </label>
              </span>
            ) : <small className="workforce-shift-static">{row.shiftStart}–{row.shiftEnd}</small>}
            <span className="counter-control">
              <button type="button" onClick={() => setCount(index, -1)} aria-label={text(`One fewer ${row.discipline}`, `Eén ${row.discipline} minder`)}><Minus size={14} /></button>
              <strong>{row.count}</strong>
              <button type="button" onClick={() => setCount(index, 1)} aria-label={text(`One more ${row.discipline}`, `Eén ${row.discipline} meer`)}><Plus size={14} /></button>
            </span>
            <button className="workforce-row-remove" type="button" onClick={() => remove(index)} aria-label={text(`Remove ${row.discipline}`, `Verwijder ${row.discipline}`)}><X size={14} /></button>
          </div>
        ))}
        {!rows.length ? (
          <p className="form-helper">{text("Nobody recorded yet.", "Nog niemand vastgelegd.")}</p>
        ) : null}
      </div>
    </>
  );
}

/**
 * One block of the workforce screen. It is the shared record-form section every other form
 * in the app is built from — inspections, HSE, registers and the field tools all render the
 * same numbered card. Workforce used to carry its own look-alike, which is exactly how the
 * two drifted apart; the icon and the running count are the only additions it needs.
 */
function WorkforceSection({ icon, step, title, subtitle, count, action, children }: {
  icon: ReactNode;
  /** Position in the form, so the screen reads as one numbered flow like every other form. */
  step: number;
  title: string;
  subtitle?: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <RecordFormSection
      className="workforce-section"
      number={step}
      title={title}
      description={subtitle}
      aside={typeof count === "number"
        ? <span className="workforce-section-count"><span className="workforce-section-icon">{icon}</span><strong>{count}</strong></span>
        : <span className="workforce-section-count"><span className="workforce-section-icon">{icon}</span></span>}
    >
      {action}
      {children}
    </RecordFormSection>
  );
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
  copyPreviousWorkday: (buildingId: string) => Promise<{ reportDate: string; rows: WorkforceRow[] } | null>;
  save: (
    perBuilding: Array<{ buildingId: string; rows: WorkforceRow[]; visitors: VisitorRow[] }>,
    note: string,
    signature: HandwrittenSignature | null,
  ) => boolean | void | Promise<boolean | void>;
}) {
  const { text } = useLanguage();
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
    count: workforceTotal(rowsByBuilding[building.id] ?? []),
  }));
  const filledBuildings = buildings.filter((building) => (rowsByBuilding[building.id] ?? []).length > 0
    || (visitorsByBuilding[building.id] ?? []).length > 0);
  // The deviation is judged on the day as a whole: a crew moved from one building to the
  // other is not a shortage, and comparing per building would call it one twice.
  const total = buildingTotals.reduce((sum, entry) => sum + entry.count, 0);
  const allRows = buildings.flatMap((building) => rowsByBuilding[building.id] ?? []);
  const byParty = workforceByParty(allRows);
  const byDiscipline = workforceByDiscipline(allRows);
  const previousTotal = previousDay ? workforceTotal(previousDay.rows) : null;
  const deviations = workforceDeviations({ total, expected: expectedWorkers, previous: previousTotal });
  const noteMissing = workforceNoteRequired(deviations, note);

  // Every other form in the app numbers its sections, and a number that jumps from 1 to 3
  // because a block did not apply today reads as a step that was skipped. The blocks that
  // are actually on screen are numbered 1, 2, 3.
  const showVisitors = parties.length > 0;
  const showTotals = byParty.length > 0 || byDiscipline.length > 0;
  const showDeviations = deviations.length > 0;
  const stepTotals = showVisitors ? 3 : 2;
  const stepDeviations = stepTotals + (showTotals ? 1 : 0);

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
      : [...current, row], rows);
    setRows(merged);
    setCopyNote(text(`Crew of ${previousDay.reportDate} taken over.`, `Bezetting van ${previousDay.reportDate} overgenomen.`));
  };

  const confirm = async () => {
    setSaving(true);
    const result = await save(filledBuildings.map((building) => ({
      buildingId: building.id,
      rows: rowsByBuilding[building.id] ?? [],
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

  return (
    <RecordFormShell
      code={text("Workforce", "Workforce")}
      title={text("Who is on site today?", "Wie is er vandaag op de bouwplaats?")}
      status={readOnly ? text("Read only", "Alleen lezen") : undefined}
      busy={busy}
      canSave={!readOnly && filledBuildings.length > 0 && !noteMissing}
      // Asked for once there is a count to explain, not on an empty form.
      validation={noteMissing && filledBuildings.length ? [text("Explain the deviation to confirm.", "Licht de afwijking toe om te bevestigen.")] : []}
      saveLabel={filledBuildings.length > 1
        ? text(`Confirm attendance · ${filledBuildings.length} buildings`, `Aanwezigheid bevestigen · ${filledBuildings.length} gebouwen`)
        : text("Confirm attendance", "Aanwezigheid bevestigen")}
      onSave={readOnly ? undefined : () => void confirm()}
      onCancel={close}
      className="wide sectioned-record-form workforce-form"
      headerAside={draftState === "restored" ? (
        <span className="daily-log-draft" role="status">
          {text("Unsaved count restored", "Niet-opgeslagen telling hersteld")}
          <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={discardDraft}>{text("Discard draft", "Concept weggooien")}</button>
        </span>
      ) : null}
    >
        <div className="workforce-body">
          <fieldset className="workforce-fieldset" disabled={readOnly}>
          {/* The location and weather tiles that used to stand here were struck through on
              the client's own screenshot. What is left is the number they left standing. */}
          <div className="workforce-headline">
            <span><Users size={18} /> {text("On site today", "Vandaag aanwezig")}</span>
            <strong>{total}</strong>
          </div>

          {/* One tab per building, each with its own crew. Every building that gets a crew is
              written when you confirm, so both are filled in without saving twice. */}
          {buildings.length > 1 ? (
            <div className="workforce-buildings" role="tablist" aria-label={text("Buildings", "Gebouwen")}>
              {buildingTotals.map((entry) => (
                <button
                  className={entry.building.id === buildingId ? "active" : ""}
                  type="button"
                  role="tab"
                  aria-selected={entry.building.id === buildingId}
                  onClick={() => switchBuilding(entry.building.id)}
                  key={entry.building.id}
                >
                  <span>{entry.building.name}</span>
                  <b>{entry.count}</b>
                </button>
              ))}
            </div>
          ) : null}

          <div className="record-form-sections workforce-sections">
          <WorkforceSection
            icon={<Users size={17} />}
            step={1}
            title={text("Workforce by trade", "Bezetting per discipline")}
            count={workforceTotal(rows)}
            action={(
              <div className="workforce-toolbar">
                <button className="ui-button ui-button--quiet ui-button--md" type="button" disabled={previousDay === undefined} onClick={copyPrevious}>
                  {previousDay === undefined ? <Loader2 className="spin" size={13} /> : <Copy size={13} />} {text("Copy previous workday", "Vorige werkdag overnemen")}
                </button>
                {copyNote ? <small aria-live="polite">{copyNote}</small> : null}
              </div>
            )}
          >
            <WorkforceRegister
              rows={rows}
              setRows={setRows}
              parties={parties}
              disciplines={disciplines}
              defaultShiftStart={defaultShiftStart}
              defaultShiftEnd={defaultShiftEnd}
              editShifts
            />
          </WorkforceSection>

          {/* §4.3: the visitor registration. Kept apart from the counted crew on purpose —
              an inspector on site is not manning the work and must never inflate the
              headcount the contractor is held to. */}
          {showVisitors ? (
            <WorkforceSection
              icon={<UserCheck size={17} />}
              step={2}
              title={text("Visitors", "Bezoekers")}
              subtitle={text("Not counted in the headcount.", "Niet meegeteld in de bezetting.")}
              count={visitors.length}
            >
              <div className="workforce-add">
                <label className="form-field">
                  <span>{text("Organisation", "Organisatie")}</span>
                  <select value={visitorDraft.partyId} onChange={(event) => setVisitorDraft({ ...visitorDraft, partyId: event.target.value })}>
                    {parties.map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}
                  </select>
                </label>
                <label className="form-field">
                  <span>{text("Name", "Naam")}</span>
                  <input
                    value={visitorDraft.visitorName}
                    onChange={(event) => setVisitorDraft({ ...visitorDraft, visitorName: event.target.value })}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addVisitor(); } }}
                    placeholder={text("Who visited the site?", "Wie was er op bezoek?")}
                    maxLength={160}
                  />
                </label>
                <button className="ui-button ui-button--secondary ui-button--md workforce-add-button" type="button" disabled={visitorDraft.visitorName.trim().length < 2} onClick={addVisitor}>
                  <Plus size={15} /> {text("Add visitor", "Bezoeker toevoegen")}
                </button>
              </div>
              <div className="workforce-rows">
                {visitors.map((visitor, index) => (
                  <div className="workforce-row" key={`${visitor.partyId}:${visitor.visitorName}`}>
                    <span className="workforce-row-name">
                      <strong>{visitor.visitorName}</strong>
                      <small>{visitor.party}</small>
                    </span>
                    <span className="workforce-shift">
                      <label>
                        <span className="sr-only">{text(`Arrival of ${visitor.visitorName}`, `Aankomst van ${visitor.visitorName}`)}</span>
                        <input type="time" value={visitor.shiftStart} onChange={(event) => setVisitors(visitors.map((entry, entryIndex) => entryIndex === index ? { ...entry, shiftStart: event.target.value } : entry))} />
                      </label>
                      <em>–</em>
                      <label>
                        <span className="sr-only">{text(`Departure of ${visitor.visitorName}`, `Vertrek van ${visitor.visitorName}`)}</span>
                        <input type="time" value={visitor.shiftEnd} onChange={(event) => setVisitors(visitors.map((entry, entryIndex) => entryIndex === index ? { ...entry, shiftEnd: event.target.value } : entry))} />
                      </label>
                    </span>
                    <button className="workforce-row-remove" type="button" onClick={() => setVisitors(visitors.filter((_, entryIndex) => entryIndex !== index))} aria-label={text(`Remove ${visitor.visitorName}`, `Verwijder ${visitor.visitorName}`)}><X size={14} /></button>
                  </div>
                ))}
                {!visitors.length ? <p className="form-helper">{text("No visitors recorded today.", "Vandaag geen bezoekers vastgelegd.")}</p> : null}
              </div>
            </WorkforceSection>
          ) : null}

          {/* §4.3: totals per organisation and per discipline. The report is read per
              contractor, and the planning is read per trade. Over the whole day, so a crew
              moved between buildings is counted once. */}
          {showTotals ? (
            <WorkforceSection
              icon={<Sigma size={17} />}
              step={stepTotals}
              title={text("Totals for today", "Totalen van vandaag")}
              subtitle={buildings.length > 1
                ? text("Across all buildings together.", "Over alle gebouwen samen.")
                : undefined}
              count={total}
            >
              <div className="workforce-totals">
                <div>
                  <h4>{text("Per organisation", "Per organisatie")}</h4>
                  <dl>{byParty.map((entry) => <div key={entry.key}><dt>{entry.label}</dt><dd>{entry.count}</dd></div>)}</dl>
                </div>
                <div>
                  <h4>{text("Per trade", "Per discipline")}</h4>
                  <dl>{byDiscipline.map((entry) => <div key={entry.key}><dt>{entry.label}</dt><dd>{entry.count}</dd></div>)}</dl>
                </div>
              </div>
            </WorkforceSection>
          ) : null}

          {/* §4.3: signal a large deviation and ask for the sentence that explains it. Both
              stand in one block: a warning whose answer sits somewhere else on the screen is
              a warning that gets read twice and answered once. */}
          {showDeviations ? (
            <WorkforceSection
              icon={<AlertTriangle size={17} />}
              step={stepDeviations}
              title={text("Deviating workforce", "Afwijkende bezetting")}
            >
              <ul className="workforce-deviation-list">
                {deviations.map((deviation) => (
                  <li key={deviation.id}>
                    <strong>{deviation.kind === "planned"
                      ? text("Against the plan", "Tegenover de planning")
                      : text("Against the last workday", "Tegenover de vorige werkdag")}</strong>
                    <span>{text(
                      `${deviation.total} on site against ${deviation.reference} — ${Math.round(deviation.share * 100)}% ${deviation.direction === "above" ? "more" : "fewer"}.`,
                      `${deviation.total} aanwezig tegenover ${deviation.reference} — ${Math.round(deviation.share * 100)}% ${deviation.direction === "above" ? "meer" : "minder"}.`,
                    )}</span>
                  </li>
                ))}
              </ul>
              <label className="form-field">
                <span>{text("Explanation", "Toelichting")}</span>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={text("For example: two crews moved to the other building.", "Bijvoorbeeld: twee ploegen zijn naar het andere gebouw verplaatst.")}
                />
                <DictateButton onText={(transcript) => setNote((current) => appendDictation(current, transcript))} />
              </label>
            </WorkforceSection>
          ) : null}

          {/* The count is signed by the person who made it, like every other record — and
              through the same field, in the same place under the last section, so a
              supervisor recognises it from the forms they already fill in. */}
          <RecordSignatureField
            value={signature}
            onChange={setSignature}
            nameSuggestion={currentUserName}
            declaration={text(
              "I confirm that this attendance reflects the crew I counted on site.",
              "Ik bevestig dat deze aanwezigheid de bezetting weergeeft die ik op de bouwplaats heb geteld.",
            )}
          />
          </div>
          </fieldset>
        </div>
    </RecordFormShell>
  );
}
