"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Calculator, CheckCircle2, Mic, MicOff, NotebookPen, Save, ShieldCheck } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { createRegisterEntry, type OperationSnapshot } from "@/lib/supabase/operations";

type SpeechRecognitionResultLike = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function speechConstructor() {
  const browser = window as typeof window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition ?? null;
}

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

export function FieldTools({ data, projectId, buildingId, reportId, client, busy, run }: {
  data: OperationSnapshot;
  projectId: string;
  buildingId: string;
  reportId: string | null;
  client: SupabaseClient;
  busy: boolean;
  run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>;
}) {
  const { language, locale, text } = useLanguage();
  const [note, setNote] = useState({ type: "notepad", title: "", body: "" });
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [dimensions, setDimensions] = useState({ length: "", width: "", height: "", quantity: "1" });
  const [expression, setExpression] = useState("");
  const [expressionResult, setExpressionResult] = useState<string>("");
  const [calculatorError, setCalculatorError] = useState("");
  const notes = data.registerEntries.filter((entry) => ["notepad", "agreement", "technical_instruction"].includes(entry.register_type));
  const length = numeric(dimensions.length);
  const width = numeric(dimensions.width);
  const height = numeric(dimensions.height);
  const quantity = numeric(dimensions.quantity) || 1;
  const measurements = useMemo(() => ({ area: length * width * quantity, volume: length * width * height * quantity }), [height, length, quantity, width]);
  const speechAvailable = typeof window !== "undefined" && Boolean(speechConstructor());

  const toggleSpeech = () => {
    if (listening) { recognitionRef.current?.stop(); return; }
    const Constructor = speechConstructor();
    if (!Constructor) return;
    const recognition = new Constructor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = language === "nl" ? "nl-NL" : "en-US";
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) if (event.results[index].isFinal) transcript += `${event.results[index][0].transcript} `;
      if (transcript.trim()) setNote((current) => ({ ...current, body: `${current.body}${current.body ? " " : ""}${transcript.trim()}` }));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => { setListening(false); recognitionRef.current = null; };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const saveNote = async () => {
    if (!reportId || note.title.trim().length < 3 || note.body.trim().length < 3) return;
    const okay = await run(() => createRegisterEntry(client, {
      projectId, buildingId, reportId, type: note.type, title: note.title.trim(),
      details: { text: note.body.trim(), recorded_at: new Date().toISOString(), source: listening ? "voice_and_keyboard" : "keyboard" },
    }), text("Field note stored centrally with its automatic date and time.", "Veldnotitie centraal opgeslagen met automatische datum en tijd."));
    if (okay) setNote({ type: "notepad", title: "", body: "" });
  };

  const runExpression = () => {
    setCalculatorError("");
    try { setExpressionResult(new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(calculateExpression(expression))); }
    catch (caught) { setExpressionResult(""); setCalculatorError(caught instanceof Error ? caught.message : "Ongeldige berekening."); }
  };

  return (
    <section className="field-tools-grid">
      <div className="field-tool-card note-tool-card">
        <div className="field-tool-heading"><span className="module-card-icon"><NotebookPen size={19} /></span><div><span className="record-number">{text("Field notepad", "Veldnotitieblok")}</span><h2>{text("Type or dictate a dated project note", "Typ of dicteer een gedateerde projectnotitie")}</h2></div></div>
        <div className="form-grid-2"><label className="form-field"><span>{text("Record type", "Type registratie")}</span><select value={note.type} onChange={(event) => setNote({ ...note, type: event.target.value })}><option value="notepad">{text("Notepad", "Notitieblok")}</option><option value="agreement">{text("Agreement", "Afspraak")}</option><option value="technical_instruction">{text("Technical instruction", "Technische instructie")}</option></select></label><label className="form-field"><span>{text("Subject", "Onderwerp")}</span><input value={note.title} onChange={(event) => setNote({ ...note, title: event.target.value })} /></label></div>
        <label className="form-field"><span>{text("Text", "Tekst")}</span><textarea rows={7} value={note.body} onChange={(event) => setNote({ ...note, body: event.target.value })} /></label>
        <div className="button-row"><button className={`secondary-button ${listening ? "recording" : ""}`} type="button" disabled={!speechAvailable} onClick={toggleSpeech}>{listening ? <MicOff size={15} /> : <Mic size={15} />} {listening ? text("Stop dictation", "Stop dicteren") : text("Dictate", "Dicteren")}</button><button className="primary-button" type="button" disabled={busy || !reportId || note.title.trim().length < 3 || note.body.trim().length < 3} onClick={() => void saveNote()}><Save size={15} /> {text("Save note", "Notitie opslaan")}</button></div>
        <p className="field-tool-hint">{speechAvailable ? text("Dictation starts only after your click. Review the recognized text before saving.", "Dicteren start uitsluitend na jouw klik. Controleer de herkende tekst vóór opslaan.") : text("This browser does not provide speech recognition; keyboard entry remains available.", "Deze browser biedt geen spraakherkenning; invoer met het toetsenbord blijft beschikbaar.")}</p>
      </div>

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
        {notes.length ? notes.map((entry) => <article key={entry.id}><div><strong>{entry.title}</strong><span>{entry.entry_number} · {entry.register_type.replaceAll("_", " ")}</span></div><small>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "America/Paramaribo" }).format(new Date(entry.occurred_at))}</small><p>{String(entry.details.text ?? entry.details.description ?? "")}</p></article>) : <div className="empty-list-state"><NotebookPen size={20} /><strong>{text("No field notes yet", "Nog geen veldnotities")}</strong></div>}
      </div>
    </section>
  );
}
