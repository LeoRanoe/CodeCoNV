"use client";

import { Eraser, PenLine, Undo2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { strokeLayout, strokePoint } from "@/lib/images/stroke-layout.mjs";
import { useLanguage } from "@/lib/i18n";
import { useBackToClose } from "@/lib/navigation/app-history";
import {
  handwrittenSignature,
  isSigned,
  signatureExportBox,
  signatureExportSize,
  signatureInkBounds,
} from "@/lib/signatures/handwritten-signature.mjs";

export type HandwrittenSignature = { name: string; image: string; signedAt: string };

type Stroke = { points: Array<{ x: number; y: number }> };

/**
 * Signing happens at the moment the document is made, with the hand of the person who
 * signs it. The pad writes nothing anywhere by itself: it hands the drawn signature back
 * to the form, which stores it with the record it belongs to.
 */
export function SignaturePad({
  title,
  declaration,
  nameSuggestion = "",
  nameOptions = [],
  lockName = false,
  close,
  save,
}: {
  title: string;
  /** The sentence the signature stands under, so nobody signs a box without a meaning. */
  declaration: string;
  nameSuggestion?: string;
  /** Names this project knows, so signing for somebody else is a choice, not typing. */
  nameOptions?: string[];
  /** The signatory is the signed-in account itself: the name is shown, not typed. */
  lockName?: boolean;
  close: () => void;
  save: (signature: HandwrittenSignature) => void;
}) {
  const { text } = useLanguage();
  useBackToClose(true, close);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef(false);
  const pointerRef = useRef<number | null>(null);
  const spaceRef = useRef({ width: 0, height: 0 });
  const mountedRef = useRef(false);
  const [name, setName] = useState(nameSuggestion);
  const [empty, setEmpty] = useState(true);
  const [error, setError] = useState("");

  const paint = (target?: HTMLCanvasElement, exporting = false) => {
    const canvas = target ?? canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const space = spaceRef.current;
    const bounds = exporting ? { width: space.width, height: space.height } : canvas.getBoundingClientRect();
    const layout = strokeLayout(space, bounds);
    if (!layout) return;
    const ratio = canvas.width / bounds.width;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(ratio * layout.scale, 0, 0, ratio * layout.scale, ratio * layout.x, ratio * layout.y);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#14201c";
    context.lineWidth = 2.6;
    for (const stroke of strokesRef.current) {
      if (!stroke.points.length) continue;
      context.beginPath();
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (const point of stroke.points.slice(1)) context.lineTo(point.x, point.y);
      // A single tap is a dot, not an invisible stroke.
      if (stroke.points.length === 1) context.lineTo(stroke.points[0].x + 0.1, stroke.points[0].y);
      context.stroke();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    mountedRef.current = true;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      if (!spaceRef.current.width) spaceRef.current = { width: rect.width, height: rect.height };
      pointerRef.current = null;
      drawingRef.current = false;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      const context = canvas.getContext("2d");
      context?.setTransform(ratio, 0, 0, ratio, 0, 0);
      paint();
    };
    resize();
    window.addEventListener("resize", resize);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => { mountedRef.current = false; observer.disconnect(); window.removeEventListener("resize", resize); };
  }, []);

  const pointFrom = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return strokePoint(event.clientX, event.clientY, rect, spaceRef.current) ?? { x: 0, y: 0 };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!event.isPrimary || event.button !== 0 || pointerRef.current !== null) return;
    pointerRef.current = event.pointerId;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    strokesRef.current = [...strokesRef.current, { points: [pointFrom(event)] }];
    setEmpty(false);
    paint();
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || pointerRef.current !== event.pointerId) return;
    event.preventDefault();
    const current = strokesRef.current[strokesRef.current.length - 1];
    if (!current) return;
    current.points.push(pointFrom(event));
    paint();
  };

  const end = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointerRef.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    pointerRef.current = null;
    drawingRef.current = false;
  };

  const undo = () => {
    pointerRef.current = null; drawingRef.current = false;
    strokesRef.current = strokesRef.current.slice(0, -1);
    setEmpty(strokesRef.current.length === 0);
    paint();
  };

  const clear = () => {
    pointerRef.current = null; drawingRef.current = false;
    strokesRef.current = [];
    setEmpty(true);
    paint();
  };

  /** Only the written ink is kept, scaled into one small image that fits a form line. */
  const exportSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || empty) return null;
    const original = document.createElement("canvas");
    original.width = Math.max(1, Math.round(spaceRef.current.width * 2));
    original.height = Math.max(1, Math.round(spaceRef.current.height * 2));
    paint(original, true);
    const ratio = original.width / spaceRef.current.width;
    const box = signatureExportBox(signatureInkBounds(strokesRef.current), spaceRef.current.width, spaceRef.current.height);
    const target = document.createElement("canvas");
    const scale = Math.min(signatureExportSize.width / box.width, signatureExportSize.height / box.height, 2);
    target.width = Math.max(1, Math.round(box.width * scale));
    target.height = Math.max(1, Math.round(box.height * scale));
    const context = target.getContext("2d");
    if (!context) return null;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, target.width, target.height);
    context.drawImage(
      original,
      box.x * ratio, box.y * ratio, box.width * ratio, box.height * ratio,
      0, 0, target.width, target.height,
    );
    return target.toDataURL("image/png");
  };

  const confirm = () => {
    const image = exportSignature();
    const signature = image ? handwrittenSignature(name, image) : null;
    if (!signature) {
      setError(name.trim().length < 2
        ? text("Fill in the name of the person signing.", "Vul de naam in van wie tekent.")
        : text("Write the signature in the field first.", "Zet eerst de handtekening in het vak."));
      return;
    }
    save(signature);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal signature-modal" role="dialog" aria-modal="true" aria-labelledby="signature-title">
        <header className="modal-header">
          <div>
            <h2 id="signature-title">{title}</h2>
            <p>{declaration}</p>
          </div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>

        <div className="modal-body signature-body">
          <label className="form-field">
            <span>{text("Name of the signatory", "Naam van de ondertekenaar")}</span>
            <input value={name} onChange={(event) => { setName(event.target.value); setError(""); }} list={lockName ? undefined : "signature-name-options"} autoComplete="name" readOnly={lockName} />
            {nameOptions.length ? <datalist id="signature-name-options">{nameOptions.map((option) => <option value={option} key={option} />)}</datalist> : null}
          </label>

          <div className="signature-pad-frame">
            <canvas
              className="signature-canvas"
              ref={canvasRef}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              onPointerLeave={end}
              aria-label={text("Signature field", "Handtekeningvak")}
            />
            {empty ? <span className="signature-placeholder"><PenLine size={15} /> {text("Sign here with your finger or a pen", "Teken hier met je vinger of een pen")}</span> : null}
            <span className="signature-baseline" />
          </div>

          <div className="signature-tools">
            <button className="ui-button ui-button--quiet ui-button--md ghost-button" type="button" onClick={undo} disabled={empty}><Undo2 size={15} /> {text("Undo", "Ongedaan maken")}</button>
            <button className="ui-button ui-button--quiet ui-button--md ghost-button" type="button" onClick={clear} disabled={empty}><Eraser size={15} /> {text("Clear", "Wissen")}</button>
          </div>
          {error ? <p className="field-error" role="alert">{error}</p> : null}
        </div>

        <footer className="modal-actions">
          <button className="ui-button ui-button--secondary ui-button--md secondary-button" type="button" onClick={close}>{text("Cancel", "Annuleren")}</button>
          <button className="ui-button ui-button--primary ui-button--md primary-button" type="button" disabled={empty || name.trim().length < 2} onClick={confirm}><PenLine size={15} /> {text("Sign the document", "Onderteken het document")}</button>
        </footer>
      </section>
    </div>
  );
}

/**
 * The block that stands on a form where a signature belongs. Unsigned it is one button;
 * signed it shows the signature that was written, with the name and the moment under it.
 */
export function SignatureField({
  label,
  declaration,
  hint,
  nameSuggestion = "",
  nameOptions = [],
  lockName = false,
  locked = false,
  value,
  onChange,
  disabled = false,
  disabledHint = "",
}: {
  label: string;
  declaration: string;
  hint?: string;
  nameSuggestion?: string;
  nameOptions?: string[];
  lockName?: boolean;
  /** A stored signature that cannot be replaced or removed any more. */
  locked?: boolean;
  value: HandwrittenSignature | null;
  onChange: (signature: HandwrittenSignature | null) => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const { locale, text } = useLanguage();
  const [signing, setSigning] = useState(false);
  const moment = (stamp: string) => stamp
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "America/Paramaribo" }).format(new Date(stamp))
    : "";

  return (
    <div className={`signature-field ${isSigned(value) ? "signed" : ""}`}>
      <div className="signature-field-copy">
        <strong>{label}</strong>
        <small>{disabled && disabledHint ? disabledHint : isSigned(value) ? `${value!.name} · ${moment(value!.signedAt)}` : hint ?? declaration}</small>
      </div>
      {isSigned(value) ? (
        <div className="signature-field-proof">
          {/* A drawn signature is a data URL, which the image optimizer cannot handle. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value!.image} alt={text(`Signature of ${value!.name}`, `Handtekening van ${value!.name}`)} />
          {locked ? null : <div className="signature-field-actions">
            <button className="ui-button ui-button--quiet ui-button--md ghost-button" type="button" disabled={disabled} onClick={() => setSigning(true)}><PenLine size={14} /> {text("Sign again", "Opnieuw tekenen")}</button>
            <button className="ui-button ui-button--quiet ui-button--md ghost-button" type="button" disabled={disabled} onClick={() => onChange(null)}><Eraser size={14} /> {text("Remove", "Verwijderen")}</button>
          </div>}
        </div>
      ) : (
        <button className="ui-button ui-button--secondary ui-button--md secondary-button signature-open-button" type="button" disabled={disabled} onClick={() => setSigning(true)}>
          <PenLine size={15} /> {text("Sign now", "Nu ondertekenen")}
        </button>
      )}
      {signing ? (
        <SignaturePad
          title={label}
          declaration={declaration}
          nameSuggestion={value?.name || nameSuggestion}
          nameOptions={nameOptions}
          lockName={lockName}
          close={() => setSigning(false)}
          save={(signature) => { onChange(signature); setSigning(false); }}
        />
      ) : null}
    </div>
  );
}
