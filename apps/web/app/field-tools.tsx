"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Calculator, CheckCircle2, NotebookPen, Pencil, Save, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { AgreementSignatureFields, agreementSignatureDetails, emptyAgreementSignature } from "@/app/agreement-signature";
import { resolveDefaultBuildingId, type BuildingOption } from "@/app/building-picker";
import { appendDictation, DictateButton, speechToTextAvailable } from "@/app/dictate-button";
import { RecordBuildingsField, RecordFormSection, RecordFormShell, RecordSignatureField } from "@/app/forms/record-form-shell";
import { LocationPicker, locationBreadcrumb } from "@/app/location-picker";
import type { HandwrittenSignature } from "@/app/signature-pad";
import { signatureFromDetails } from "@/lib/signatures/handwritten-signature.mjs";
import { useLanguage } from "@/lib/i18n";
import type { ProjectParty } from "@/lib/supabase/data";
import { createRegisterEntry, updateRegisterRecord, type OperationSnapshot } from "@/lib/supabase/operations";
import { typeText, partyTypeText } from "@/lib/status-labels";

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
  /** The saved note being corrected, so saving updates it instead of writing a second one. */
  const [editingNoteId, setEditingNoteId] = useState("");
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

  /** Loads a saved note back into the form above, so it can be read and corrected. */
  const openNote = (entry: OperationSnapshot["registerEntries"][number]) => {
    const details = entry.details ?? {};
    setNote({
      type: entry.register_type === "agreement" ? "agreement" : "notepad",
      title: entry.title,
      body: String(details.text ?? details.description ?? ""),
      agreementDate: String(details.agreement_date ?? today),
      agreementTime: String(details.agreement_time ?? currentTime),
      dueDate: String(details.due_date ?? ""),
      responsiblePartyId: String(details.responsible_party_id ?? ""),
      status: String(details.agreement_status ?? "agreed"),
    });
    setNoteBuildingId(entry.building_id ?? noteBuildingId);
    setNoteBuildingIds(entry.building_ids?.length ? entry.building_ids : entry.building_id ? [entry.building_id] : []);
    setNoteLocationNodeId(entry.location_node_id ?? "");
    setNoteSignature(signatureFromDetails(entry.signed_by, entry.signed_at, entry.signature_image) as HandwrittenSignature | null);
    setEditingNoteId(entry.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveNote = async () => {
    if (note.title.trim().length < 3 || note.body.trim().length < 3) return;
    const targetBuildingIds = noteBuildingIds.length ? noteBuildingIds : [noteBuildingId];
    const noteDetails = {
      text: note.body.trim(),
      recorded_at: new Date().toISOString(),
      source: dictated ? "voice_and_keyboard" : "keyboard",
      agreement_date: note.type === "agreement" ? note.agreementDate : null,
      agreement_time: note.type === "agreement" ? note.agreementTime : null,
      agreement_status: note.type === "agreement" ? note.status : null,
      ...(note.type === "agreement" ? agreementSignatureDetails(agreement) : {}),
      responsible_party_name: parties.find((party) => party.id === note.responsiblePartyId)?.name ?? "",
      due_date: note.dueDate || null,
    };
    // Correcting an open note updates it. Its number and its type were assigned when it
    // was written and are not touched here.
    const okay = await run(() => editingNoteId
      ? updateRegisterRecord(client, {
        projectId,
        id: editingNoteId,
        buildingId: targetBuildingIds[0] ?? null,
        buildingIds: targetBuildingIds,
        locationNodeId: noteLocationNodeId,
        title: note.title.trim(),
        dueAt: note.dueDate || null,
        details: noteDetails,
        signature: note.type !== "agreement" && noteSignature
          ? { name: noteSignature.name, signedAt: noteSignature.signedAt, image: noteSignature.image }
          : null,
      })
      : createRegisterEntry(client, {
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
      ? text("Agreement saved.", "Afspraak opgeslagen.")
      : text("Field note saved.", "Veldnotitie opgeslagen."));
    if (okay) { setNote({ ...emptyNote }); setAgreement({ ...emptyAgreementSignature }); setNoteSignature(null); setNoteLocationNodeId(""); setDictated(false); setEditingNoteId(""); }
  };

  const runExpression = () => {
    setCalculatorError("");
    try { setExpressionResult(new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(calculateExpression(expression))); }
    catch (caught) { setExpressionResult(""); setCalculatorError(caught instanceof Error ? caught.message : "Ongeldige berekening."); }
  };

  return (
    <section className="field-tools-grid">
      <RecordFormShell
        code={notes.find((entry) => entry.id === editingNoteId)?.entry_number ?? text("Field notepad", "Veldnotitieblok")}
        title={editingNoteId ? text("Correct this note", "Deze notitie corrigeren") : text("Type or dictate a dated project note", "Typ of dicteer een gedateerde projectnotitie")}
        status={editingNoteId ? text("Editing", "Bewerken") : text("New", "Nieuw")}
        busy={busy}
        className="field-tool-card note-tool-card"
        headerAside={editingNoteId ? <button className="ghost-button" type="button" onClick={() => { setNote({ ...emptyNote }); setNoteSignature(null); setNoteLocationNodeId(""); setEditingNoteId(""); }}>{text("New note", "Nieuwe notitie")}</button> : null}
      >
        <RecordFormSection number={1} title={text("Context and subject", "Context en onderwerp")}>
        <RecordBuildingsField id="note-buildings" buildings={buildings} value={noteBuildingIds} onChange={(next) => { setNoteBuildingIds(next); setNoteBuildingId(next[0] ?? noteBuildingId); setNoteLocationNodeId(""); }} />
        <div className="form-grid-2"><label className="form-field"><span>{text("Record type", "Type registratie")}</span><select value={note.type} onChange={(event) => setNote({ ...note, type: event.target.value })}><option value="notepad">{text("Notepad", "Notitieblok")}</option><option value="agreement">{text("Formal agreement", "Formele afspraak")}</option></select></label><label className="form-field"><span>{note.type === "agreement" ? text("Agreement subject", "Onderwerp afspraak") : text("Subject", "Onderwerp")}</span><input value={note.title} onChange={(event) => setNote({ ...note, title: event.target.value })} /></label></div>
        <LocationPicker id="note-location" nodes={data.locationNodes} buildingId={noteBuildingId} value={noteLocationNodeId} onChange={setNoteLocationNodeId} requiredDepth={data.settings?.required_location_depth ?? "building"} />
        </RecordFormSection>
        {note.type === "agreement" ? <div className="agreement-fields">
          <div className="form-grid-2">
            <label className="form-field"><span>{text("Agreement date", "Datum afspraak")}</span><input type="date" value={note.agreementDate} onChange={(event) => setNote({ ...note, agreementDate: event.target.value })} /></label>
            <label className="form-field"><span>{text("Agreement time", "Tijd afspraak")}</span><input type="time" value={note.agreementTime} onChange={(event) => setNote({ ...note, agreementTime: event.target.value })} /></label>
            <label className="form-field"><span>{text("Responsible project party", "Verantwoordelijke projectpartij")}</span><select value={note.responsiblePartyId} onChange={(event) => setNote({ ...note, responsiblePartyId: event.target.value })}><option value="">{text("Choose party", "Kies partij")}</option>{parties.map((party) => <option value={party.id} key={party.id}>{party.name} · {partyTypeText(party.type, text)}</option>)}</select></label>
            <label className="form-field"><span>{text("Deadline / follow-up date", "Deadline / opvolgdatum")}</span><input type="date" min={note.agreementDate} value={note.dueDate} onChange={(event) => setNote({ ...note, dueDate: event.target.value })} /></label>
            <label className="form-field"><span>{text("Agreement status", "Status afspraak")}</span><select value={note.status} onChange={(event) => setNote({ ...note, status: event.target.value })}><option value="agreed">{text("Agreed", "Afgesproken")}</option><option value="open">{text("Open for confirmation", "Open voor bevestiging")}</option><option value="in_progress">{text("In progress", "In uitvoering")}</option><option value="completed">{text("Completed", "Afgerond")}</option></select></label>
          </div>
          <AgreementSignatureFields options={agreementPartyOptions} value={agreement} onChange={setAgreement} />
          <div className="operation-alert"><CheckCircle2 size={17} /><div><strong>{text("Traceable agreement", "Traceerbare afspraak")}</strong></div></div>
        </div> : null}
        <label className="form-field"><span>{text("Text", "Tekst")}</span><textarea rows={7} value={note.body} onChange={(event) => setNote({ ...note, body: event.target.value })} /><DictateButton onText={(transcript) => { setNote((current) => ({ ...current, body: appendDictation(current.body, transcript) })); setDictated(true); }} /></label>
        {note.type !== "agreement" ? <RecordSignatureField value={noteSignature} onChange={setNoteSignature} nameSuggestion={currentUserName} declaration={text("I confirm that this note reflects what I recorded on site.", "Ik bevestig dat deze notitie weergeeft wat ik op de bouwplaats heb vastgelegd.")} /> : null}
        <div className="button-row"><button className="primary-button" type="button" disabled={busy || ((data.settings?.required_location_depth ?? "building") !== "building" && !noteLocationNodeId) || note.title.trim().length < 3 || note.body.trim().length < 3 || (note.type === "agreement" && (!note.agreementDate || !note.agreementTime))} onClick={() => void saveNote()}><Save size={15} /> {editingNoteId ? text("Save changes", "Wijzigingen opslaan") : note.type === "agreement" ? text("Save agreement", "Afspraak opslaan") : text("Save note", "Notitie opslaan")}</button></div>
        {!speechAvailable ? <p className="field-tool-hint">{text("Speech recognition is not available in this browser.", "Spraakherkenning is niet beschikbaar in deze browser.")}</p> : null}
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
        {notes.length ? notes.map((entry) => <article className={editingNoteId === entry.id ? "record-focused" : ""} key={entry.id}><div><strong>{entry.title}</strong><span>{entry.entry_number} · {buildings.find((building) => building.id === entry.building_id)?.name ?? text("Project-wide", "Projectbreed")}{entry.location_node_id ? ` → ${locationBreadcrumb(data.locationNodes, entry.location_node_id)}` : ""} · {typeText(entry.register_type, text)}</span></div><small>{entry.register_type === "agreement" && entry.details.agreement_date ? `${text("Agreement", "Afspraak")} ${String(entry.details.agreement_date)} ${String(entry.details.agreement_time ?? "")} · ${text("Deadline", "Deadline")} ${String(entry.details.due_date ?? "—")}` : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "America/Paramaribo" }).format(new Date(entry.occurred_at))}</small><p>{String(entry.details.text ?? entry.details.description ?? "")}</p><div className="record-row-actions"><button className="secondary-button" type="button" onClick={() => openNote(entry)}><Pencil size={14} /> {text("Open and edit", "Openen en bewerken")}</button></div></article>) : <div className="empty-list-state"><NotebookPen size={20} /><strong>{text("No field notes yet", "Nog geen veldnotities")}</strong></div>}
      </div>
    </section>
  );
}
