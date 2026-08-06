"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Calculator, CheckCircle2, NotebookPen, Save, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { AgreementSignatureFields, agreementSignatureDetails, emptyAgreementSignature } from "@/app/agreement-signature";
import { resolveDefaultBuildingId, type BuildingOption } from "@/app/building-picker";
import { appendDictation, DictateButton, speechToTextAvailable } from "@/app/dictate-button";
import { RecordBuildingsField, RecordFormSection, RecordFormShell, RecordSignatureField } from "@/app/forms/record-form-shell";
import { LocationPicker, locationBreadcrumb } from "@/app/location-picker";
import type { HandwrittenSignature } from "@/app/signature-pad";
import { useLanguage } from "@/lib/i18n";
import type { ProjectParty } from "@/lib/supabase/data";
import { createRegisterEntry, type OperationSnapshot } from "@/lib/supabase/operations";

function numeric(value: string) {
  const result = Number(value.replace(",", "."));
  return Number.isFinite(result) ? result : 0;
}

function calculateExpression(source: string) {
  const tokens = source.replace(/,/g, ".").match(/\d+(?:\.\d+)?|[()+\-*/]/g) ?? [];
  if (tokens.join("") !== source.replace(/[\s,]/g, (match) => match === "," ? "." : "")) throw new Error("Ongeldig teken in berekening.");
  let index = 0;
  const factor = (): number => {
    const token = tokens[index];
    if (token === "+" || token === "-") { index += 1; return token === "-" ? -factor() : factor(); }
    if (token === "(") { index += 1; const result = expression(); if (tokens[index] !== ")") throw new Error("Ontbrekend sluithaakje."); index += 1; return result; }
    if (!token || !/^\d/.test(token)) throw new Error("Ongeldige berekening.");
    index += 1;
    return Number(token);
  };
  const term = (): number => {
    let result = factor();
    while (tokens[index] === "*" || tokens[index] === "/") {
      const operator = tokens[index]; index += 1; const right = factor();
      if (operator === "/" && right === 0) throw new Error("Delen door nul is niet toegestaan.");
      result = operator === "*" ? result * right : result / right;
    }
    return result;
  };
  const expression = (): number => {
    let result = term();
    while (tokens[index] === "+" || tokens[index] === "-") { const operator = tokens[index]; index += 1; const right = term(); result = operator === "+" ? result + right : result - right; }
    return result;
  };
  const result = expression();
  if (index !== tokens.length || !Number.isFinite(result)) throw new Error("Ongeldige berekening.");
  return result;
}

export function FieldTools({ data, projectId, buildingId, buildings, parties, reportId, currentUserName, client, busy, run }: {
  data: OperationSnapshot;
  projectId: string;
  buildingId: string;
  buildings: BuildingOption[];
  parties: ProjectParty[];
  reportId: string | null;
  currentUserName: string;
  client: SupabaseClient;
  busy: boolean;
  run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>;
}) {
  const { locale, text } = useLanguage();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Paramaribo" }).format(new Date());
  const currentTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Paramaribo" }).format(new Date());
  const emptyNote = { type: "notepad", title: "", body: "", agreementDate: today, agreementTime: currentTime, dueDate: "", responsiblePartyId: "", status: "agreed" };
  const [note, setNote] = useState(emptyNote);
  // The same agreement record as on the register form, so it can be signed here too.
  const [agreement, setAgreement] = useState({ ...emptyAgreementSignature });
  const [noteBuildingId, setNoteBuildingId] = useState(() => resolveDefaultBuildingId(buildings, buildingId));
  const [noteBuildingIds, setNoteBuildingIds] = useState(() => [resolveDefaultBuildingId(buildings, buildingId)].filter(Boolean));
  const [noteSignature, setNoteSignature] = useState<HandwrittenSignature | null>(null);
  const [noteLocationNodeId, setNoteLocationNodeId] = useState("");
  const [dictated, setDictated] = useState(false);
  const [dimensions, setDimensions] = useState({ length: "", width: "", height: "", quantity: "1" });
  const [expression, setExpression] = useState("");
  const [expressionResult, setExpressionResult] = useState<string>("");
  const [calculatorError, setCalculatorError] = useState("");
  const notes = data.registerEntries.filter((entry) => ["notepad", "agreement", "technical_instruction"].includes(entry.register_type));
  const agreementPartyOptions = Array.from(new Set(["CODECO N.V.", ...parties.map((party) => party.name)].filter(Boolean)));
  const length = numeric(dimensions.length);
  const width = numeric(dimensions.width);
  const height = numeric(dimensions.height);
  const quantity = numeric(dimensions.quantity) || 1;
  const measurements = useMemo(() => ({ area: length * width * quantity, volume: length * width * height * quantity }), [height, length, quantity, width]);
  const speechAvailable = speechToTextAvailable();

  const saveNote = async () => {
    if (note.title.trim().length < 3 || note.body.trim().length < 3) return;
    const targetBuildingIds = noteBuildingIds.length ? noteBuildingIds : [noteBuildingId];
    const okay = await run(() => createRegisterEntry(client, {
      projectId, buildingId: targetBuildingIds[0], buildingIds: targetBuildingIds, locationNodeId: noteLocationNodeId, reportId, type: note.type, title: note.title.trim(),
      responsiblePartyId: note.responsiblePartyId || undefined,
      dueAt: note.dueDate || null,
      details: {
        text: note.body.trim(),
        recorded_at: new Date().toISOString(),
        source: dictated ? "voice_and_keyboard" : "keyboard",
        agreement_date: note.type === "agreement" ? note.agreementDate : null,
        agreement_time: note.type === "agreement" ? note.agreementTime : null,
        agreement_status: note.type === "agreement" ? note.status : null,
        ...(note.type === "agreement" ? agreementSignatureDetails(agreement) : {}),
        responsible_party_name: parties.find((party) => party.id === note.responsiblePartyId)?.name ?? "",
        due_date: note.dueDate || null,
      },
      signedBy: note.type === "agreement" ? undefined : noteSignature?.name,
      signedAt: note.type === "agreement" ? undefined : noteSignature?.signedAt,
      signatureImage: note.type === "agreement" ? null : noteSignature?.image ?? null,
    }), note.type === "agreement"
      ? text("Agreement stored with date, time, responsible party and deadline.", "Afspraak opgeslagen met datum, tijd, verantwoordelijke partij en deadline.")
      : text("Field note stored centrally with its automatic date and time.", "Veldnotitie centraal opgeslagen met automatische datum en tijd."));
    if (okay) { setNote({ ...emptyNote }); setAgreement({ ...emptyAgreementSignature }); setNoteSignature(null); setNoteLocationNodeId(""); setDictated(false); }
  };

  const runExpression = () => {
    setCalculatorError("");
    try { setExpressionResult(new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(calculateExpression(expression))); }
    catch (caught) { setExpressionResult(""); setCalculatorError(caught instanceof Error ? caught.message : "Ongeldige berekening."); }
  };

  return (
    <section className="field-tools-grid">
      <RecordFormShell code={text("Field notepad", "Veldnotitieblok")} title={text("Type or dictate a dated project note", "Typ of dicteer een gedateerde projectnotitie")} status={text("New", "Nieuw")} busy={busy} className="field-tool-card note-tool-card">
        <RecordFormSection number={1} title={text("Context and subject", "Context en onderwerp")}>
        <RecordBuildingsField id="note-buildings" buildings={buildings} value={noteBuildingIds} onChange={(next) => { setNoteBuildingIds(next); setNoteBuildingId(next[0] ?? noteBuildingId); setNoteLocationNodeId(""); }} />
        <div className="form-grid-2"><label className="form-field"><span>{text("Record type", "Type registratie")}</span><select value={note.type} onChange={(event) => setNote({ ...note, type: event.target.value })}><option value="notepad">{text("Notepad", "Notitieblok")}</option><option value="agreement">{text("Formal agreement", "Formele afspraak")}</option></select></label><label className="form-field"><span>{note.type === "agreement" ? text("Agreement subject", "Onderwerp afspraak") : text("Subject", "Onderwerp")}</span><input value={note.title} onChange={(event) => setNote({ ...note, title: event.target.value })} /></label></div>
        <LocationPicker id="note-location" nodes={data.locationNodes} buildingId={noteBuildingId} value={noteLocationNodeId} onChange={setNoteLocationNodeId} requiredDepth={data.settings?.required_location_depth ?? "building"} />
        </RecordFormSection>
        {note.type === "agreement" ? <div className="agreement-fields">
          <div className="form-grid-2">
            <label className="form-field"><span>{text("Agreement date", "Datum afspraak")}</span><input type="date" value={note.agreementDate} onChange={(event) => setNote({ ...note, agreementDate: event.target.value })} /></label>
            <label className="form-field"><span>{text("Agreement time", "Tijd afspraak")}</span><input type="time" value={note.agreementTime} onChange={(event) => setNote({ ...note, agreementTime: event.target.value })} /></label>
            <label className="form-field"><span>{text("Responsible project party", "Verantwoordelijke projectpartij")}</span><select value={note.responsiblePartyId} onChange={(event) => setNote({ ...note, responsiblePartyId: event.target.value })}><option value="">{text("Choose party", "Kies partij")}</option>{parties.map((party) => <option value={party.id} key={party.id}>{party.name} · {party.type}</option>)}</select></label>
            <label className="form-field"><span>{text("Deadline / follow-up date", "Deadline / opvolgdatum")}</span><input type="date" min={note.agreementDate} value={note.dueDate} onChange={(event) => setNote({ ...note, dueDate: event.target.value })} /></label>
            <label className="form-field"><span>{text("Agreement status", "Status afspraak")}</span><select value={note.status} onChange={(event) => setNote({ ...note, status: event.target.value })}><option value="agreed">{text("Agreed", "Afgesproken")}</option><option value="open">{text("Open for confirmation", "Open voor bevestiging")}</option><option value="in_progress">{text("In progress", "In uitvoering")}</option><option value="completed">{text("Completed", "Afgerond")}</option></select></label>
          </div>
          <AgreementSignatureFields options={agreementPartyOptions} value={agreement} onChange={setAgreement} />
          <div className="operation-alert"><CheckCircle2 size={17} /><div><strong>{text("Traceable agreement", "Traceerbare afspraak")}</strong><span>{text("Project, building, author and registration time are added automatically. The agreement date and deadline remain visible in reports.", "Project, gebouw, maker en registratietijd worden automatisch toegevoegd. De afspraakdatum en deadline blijven zichtbaar in rapporten.")}</span></div></div>
        </div> : null}
        <label className="form-field"><span>{text("Text", "Tekst")}</span><textarea rows={7} value={note.body} onChange={(event) => setNote({ ...note, body: event.target.value })} /><DictateButton onText={(transcript) => { setNote((current) => ({ ...current, body: appendDictation(current.body, transcript) })); setDictated(true); }} /></label>
        {note.type !== "agreement" ? <RecordSignatureField value={noteSignature} onChange={setNoteSignature} nameSuggestion={currentUserName} declaration={text("I confirm that this note reflects what I recorded on site.", "Ik bevestig dat deze notitie weergeeft wat ik op de bouwplaats heb vastgelegd.")} /> : null}
        <div className="button-row"><button className="primary-button" type="button" disabled={busy || ((data.settings?.required_location_depth ?? "building") !== "building" && !noteLocationNodeId) || note.title.trim().length < 3 || note.body.trim().length < 3 || (note.type === "agreement" && (!note.agreementDate || !note.agreementTime))} onClick={() => void saveNote()}><Save size={15} /> {note.type === "agreement" ? text("Save agreement", "Afspraak opslaan") : text("Save note", "Notitie opslaan")}</button></div>
        {!speechAvailable ? <p className="field-tool-hint">{text("This browser does not provide speech recognition; keyboard entry remains available.", "Deze browser biedt geen spraakherkenning; invoer met het toetsenbord blijft beschikbaar.")}</p> : null}
      </RecordFormShell>

      <div className="field-tool-card calculator-card">
        <div className="field-tool-heading"><span className="module-card-icon"><Calculator size={19} /></span><div><span className="record-number">{text("Construction calculator", "Bouwcalculator")}</span><h2>{text("Area, volume and arithmetic", "Oppervlakte, inhoud en rekenwerk")}</h2></div></div>
        <div className="calculator-inputs"><label className="form-field"><span>{text("Length (m)", "Lengte (m)")}</span><input inputMode="decimal" value={dimensions.length} onChange={(event) => setDimensions({ ...dimensions, length: event.target.value })} /></label><label className="form-field"><span>{text("Width (m)", "Breedte (m)")}</span><input inputMode="decimal" value={dimensions.width} onChange={(event) => setDimensions({ ...dimensions, width: event.target.value })} /></label><label className="form-field"><span>{text("Height (m)", "Hoogte (m)")}</span><input inputMode="decimal" value={dimensions.height} onChange={(event) => setDimensions({ ...dimensions, height: event.target.value })} /></label><label className="form-field"><span>{text("Quantity", "Aantal")}</span><input inputMode="decimal" value={dimensions.quantity} onChange={(event) => setDimensions({ ...dimensions, quantity: event.target.value })} /></label></div>
        <div className="calculator-results"><div><span>{text("Area", "Oppervlakte")}</span><strong>{new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(measurements.area)} m²</strong></div><div><span>{text("Volume", "Inhoud")}</span><strong>{new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(measurements.volume)} m³</strong></div></div>
        <label className="form-field"><span>{text("Expression", "Berekening")}</span><div className="calculator-expression"><input inputMode="decimal" value={expression} onChange={(event) => setExpression(event.target.value)} placeholder="(12.5 * 3) + 8" /><button className="secondary-button" type="button" disabled={!expression.trim()} onClick={runExpression}>=</button></div></label>
        {expressionResult ? <div className="calculator-answer"><CheckCircle2 size={17} /><strong>{expressionResult}</strong></div> : null}{calculatorError ? <span className="field-error">{calculatorError}</span> : null}
        <div className="operation-alert"><ShieldCheck size={17} /><div><strong>{text("Calculation aid only", "Alleen rekenhulp")}</strong><span>{text("The supervisor remains responsible for units, tolerances and contractual quantities.", "De supervisor blijft verantwoordelijk voor eenheden, toleranties en contracthoeveelheden.")}</span></div></div>
      </div>

      <div className="field-tool-card saved-notes-card">
        <span className="record-number">{text("Saved notes and agreements", "Opgeslagen notities en afspraken")}</span>
        {notes.length ? notes.map((entry) => <article key={entry.id}><div><strong>{entry.title}</strong><span>{entry.entry_number} · {buildings.find((building) => building.id === entry.building_id)?.name ?? text("Project-wide", "Projectbreed")}{entry.location_node_id ? ` → ${locationBreadcrumb(data.locationNodes, entry.location_node_id)}` : ""} · {entry.register_type.replaceAll("_", " ")}</span></div><small>{entry.register_type === "agreement" && entry.details.agreement_date ? `${text("Agreement", "Afspraak")} ${String(entry.details.agreement_date)} ${String(entry.details.agreement_time ?? "")} · ${text("Deadline", "Deadline")} ${String(entry.details.due_date ?? "—")}` : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "America/Paramaribo" }).format(new Date(entry.occurred_at))}</small><p>{String(entry.details.text ?? entry.details.description ?? "")}</p></article>) : <div className="empty-list-state"><NotebookPen size={20} /><strong>{text("No field notes yet", "Nog geen veldnotities")}</strong></div>}
      </div>
    </section>
  );
}
