"use client";

import { Check, CloudSun, Copy, Loader2, MapPin, Minus, Plus, Users, X } from "lucide-react";
import { useState } from "react";
import { BuildingPicker, resolveDefaultBuildingId, type BuildingOption } from "@/app/building-picker";
import { useLanguage } from "@/lib/i18n";

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
};

export type WorkforceParty = { id: string; name: string };

export function workforceTotal(rows: WorkforceRow[]) {
  return rows.reduce((sum, row) => sum + row.count, 0);
}

/** Adds a trade, or raises the line that already carries it, so the same trade never doubles. */
export function addWorkforceRow(
  rows: WorkforceRow[],
  party: WorkforceParty,
  discipline: string,
  shift: { start: string; end: string },
): WorkforceRow[] {
  const existing = rows.findIndex((row) => row.partyId === party.id && row.discipline === discipline);
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
  const [draft, setDraft] = useState(() => ({ partyId: parties[0]?.id ?? "", discipline: disciplines[0] ?? "" }));

  const add = () => {
    const party = parties.find((item) => item.id === draft.partyId);
    if (!party || !draft.discipline) return;
    setRows(addWorkforceRow(rows, party, draft.discipline, { start: defaultShiftStart, end: defaultShiftEnd }));
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
        <span>{text(
          "An administrator adds the contractor, the subcontractors and the trades under Management → structure and parties. Workforce can be recorded from that moment on.",
          "Een beheerder voegt de aannemer, de onderaannemers en de disciplines toe via Management → structuur en partijen. Vanaf dat moment kan bezetting worden vastgelegd.",
        )}</span>
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
        <button className="secondary-button workforce-add-button" type="button" onClick={add}>
          <Plus size={15} /> {text("Add person", "Persoon toevoegen")}
        </button>
      </div>

      <div className="workforce-rows">
        {rows.map((row, index) => (
          <div className="workforce-row" key={`${row.partyId}:${row.discipline}`}>
            <span className="workforce-row-name">
              <strong>{row.discipline}</strong>
              <small>{row.party}</small>
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
          <p className="form-helper">{text(
            "Nobody recorded yet. Choose a party and a trade above and add the people who are on site today.",
            "Nog niemand vastgelegd. Kies hierboven een partij en een discipline en voeg toe wie er vandaag op de bouwplaats is.",
          )}</p>
        ) : null}
      </div>
    </>
  );
}

/**
 * The workforce screen the Workforce tile opens: the register, plus the context that says
 * which building and which day it belongs to, and the way to take over yesterday's crew.
 */
export function WorkforceModal({
  buildings,
  defaultBuildingId,
  buildingName,
  initialRows,
  rowsForBuilding,
  parties,
  disciplines,
  defaultShiftStart,
  defaultShiftEnd,
  weatherLabel,
  busy,
  close,
  copyPreviousWorkday,
  save,
}: {
  buildings: BuildingOption[];
  defaultBuildingId: string;
  buildingName: string;
  initialRows: WorkforceRow[];
  /** The crew already recorded for another building of the same day. */
  rowsForBuilding: (buildingId: string) => WorkforceRow[];
  parties: WorkforceParty[];
  disciplines: string[];
  defaultShiftStart: string;
  defaultShiftEnd: string;
  weatherLabel: string;
  busy: boolean;
  close: () => void;
  /** Returns the crew of the last workday that had one, or null when there is none yet. */
  copyPreviousWorkday: (buildingId: string) => Promise<{ reportDate: string; rows: WorkforceRow[] } | null>;
  save: (rows: WorkforceRow[], buildingId: string) => void | Promise<void>;
}) {
  const { text } = useLanguage();
  const [buildingId, setBuildingId] = useState(() => resolveDefaultBuildingId(buildings, defaultBuildingId));
  const [rows, setRows] = useState(initialRows);
  const [copying, setCopying] = useState(false);
  const [copyNote, setCopyNote] = useState("");
  const total = workforceTotal(rows);
  const chosenBuildingName = buildings.find((building) => building.id === buildingId)?.name ?? buildingName;

  const switchBuilding = (nextBuildingId: string) => {
    setBuildingId(nextBuildingId);
    setCopyNote("");
    setRows(nextBuildingId === defaultBuildingId ? initialRows : rowsForBuilding(nextBuildingId));
  };

  const copyPrevious = async () => {
    setCopying(true);
    setCopyNote("");
    try {
      const previous = await copyPreviousWorkday(buildingId);
      if (!previous) {
        setCopyNote(text(
          "No earlier workday with a recorded crew was found for this building.",
          "Er is voor dit gebouw geen eerdere werkdag met vastgelegde bezetting gevonden.",
        ));
        return;
      }
      // Taking over yesterday never wipes what was already counted today: the trades that are
      // already on the list keep the number the supervisor gave them.
      const merged = previous.rows.reduce((current, row) => current.some((existing) => existing.partyId === row.partyId && existing.discipline === row.discipline)
        ? current
        : [...current, row], rows);
      setRows(merged);
      setCopyNote(text(`Crew of ${previous.reportDate} taken over.`, `Bezetting van ${previous.reportDate} overgenomen.`));
    } catch {
      setCopyNote(text(
        "The earlier workday could not be loaded. Check the connection and try again.",
        "De eerdere werkdag kon niet worden geladen. Controleer de verbinding en probeer opnieuw.",
      ));
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal report-modal workforce-modal" role="dialog" aria-modal="true" aria-labelledby="workforce-title">
        <header className="modal-header">
          <div>
            <span className="record-number">{text("Workforce", "Workforce")}</span>
            <h2 id="workforce-title">{text("Who is on site today?", "Wie is er vandaag op de bouwplaats?")}</h2>
            <p>{text("Per contractor and per trade. The totals travel into the day report by themselves.", "Per aannemer en per discipline. De totalen komen vanzelf in het dagrapport terecht.")}</p>
          </div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>

        <div className="modal-body workforce-body">
          <div className="workforce-context">
            <span><MapPin size={17} /><small>{text("Building", "Gebouw")}</small><strong>{chosenBuildingName}</strong></span>
            {weatherLabel ? <span><CloudSun size={17} /><small>{text("Weather", "Weer")}</small><strong>{weatherLabel}</strong></span> : null}
            <span><Users size={17} /><small>{text("On site", "Aanwezig")}</small><strong>{total}</strong></span>
          </div>

          <BuildingPicker id="workforce-building" buildings={buildings} value={buildingId} onChange={switchBuilding} />

          <div className="workforce-toolbar">
            <button className="ghost-button" type="button" disabled={copying} onClick={() => void copyPrevious()}>
              {copying ? <Loader2 className="spin" size={13} /> : <Copy size={13} />} {text("Copy previous workday", "Vorige werkdag overnemen")}
            </button>
            {copyNote ? <small aria-live="polite">{copyNote}</small> : null}
          </div>

          <WorkforceRegister
            rows={rows}
            setRows={setRows}
            parties={parties}
            disciplines={disciplines}
            defaultShiftStart={defaultShiftStart}
            defaultShiftEnd={defaultShiftEnd}
            editShifts
          />

          <div className="modal-actions">
            <span className="form-note"><Check size={13} /> {text("Project, building, date and report are linked automatically.", "Project, gebouw, datum en rapport worden automatisch gekoppeld.")}</span>
            <button className="primary-button" type="button" disabled={busy || !rows.length} onClick={() => void save(rows, buildingId)}>
              {busy ? <Loader2 className="spin" size={15} /> : <Check size={15} />} {text("Confirm attendance", "Aanwezigheid bevestigen")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
