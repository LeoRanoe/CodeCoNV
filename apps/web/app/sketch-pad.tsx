"use client";

import { Eraser, PenLine, Undo2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { strokeLayout, strokePoint } from "@/lib/images/stroke-layout.mjs";
import { useLanguage } from "@/lib/i18n";
import { useBackToClose } from "@/lib/navigation/app-history";

type Stroke = { color: string; width: number; points: Array<{ x: number; y: number }> };

const sketchColors = ["#14201c", "#d92d20", "#1d6feb", "#f07400"];

/**
 * A sketch belongs on site: a quick hand drawing of what is wrong or how something has to
 * be built. The result leaves as a normal PNG photo, so it travels the same road as every
 * other piece of evidence — no new storage, no new record type.
 */
export function SketchPad({ close, save }: { close: () => void; save: (file: File) => void }) {
  const { text } = useLanguage();
  // A full-screen pad is a page: the back gesture closes the pad, nothing else.
  useBackToClose(true, close);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef(false);
  const pointerRef = useRef<number | null>(null);
  const spaceRef = useRef({ width: 0, height: 0 });
  const mountedRef = useRef(false);
  const [color, setColor] = useState(sketchColors[0]);
  const [width, setWidth] = useState(3);
  const [empty, setEmpty] = useState(true);
  const exportingRef = useRef(false);
  const [busy, setBusy] = useState(false);
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
    for (const stroke of strokesRef.current) {
      if (!stroke.points.length) continue;
      context.strokeStyle = stroke.color;
      context.lineWidth = stroke.width;
      context.beginPath();
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (const point of stroke.points.slice(1)) context.lineTo(point.x, point.y);
      if (stroke.points.length === 1) context.lineTo(stroke.points[0].x + 0.1, stroke.points[0].y);
      context.stroke();
    }
  };

  // The canvas keeps its drawing surface at the size it is shown at, so a sketch made on a
  // phone is not stretched when it is saved.
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
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    strokesRef.current = [...strokesRef.current, { color, width, points: [pointFrom(event)] }];
    setEmpty(false);
    paint();
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || pointerRef.current !== event.pointerId) return;
    const strokes = strokesRef.current;
    const current = strokes[strokes.length - 1];
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

  const useSketch = () => {
    const canvas = canvasRef.current;
    if (!canvas || empty || exportingRef.current) return;
    exportingRef.current = true;
    setBusy(true);
    const output = document.createElement("canvas");
    output.width = Math.max(1, Math.round(spaceRef.current.width * 2));
    output.height = Math.max(1, Math.round(spaceRef.current.height * 2));
    paint(output, true);
    output.toBlob((blob) => {
      exportingRef.current = false;
      if (!mountedRef.current) return;
      setBusy(false);
      if (!blob) { setError(text("The sketch could not be exported. Try again.", "De schets kon niet worden opgeslagen. Probeer opnieuw.")); return; }
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      save(new File([blob], `sketch-${stamp}.png`, { type: "image/png" }));
    }, "image/png");
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal sketch-modal" role="dialog" aria-modal="true" aria-labelledby="sketch-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">{text("Sketch", "Schets")}</p>
            <h2 id="sketch-title">{text("Draw the situation", "Teken de situatie")}</h2>
          </div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>

        <div className="sketch-toolbar">
          <div className="sketch-colors" role="group" aria-label={text("Pen colour", "Penkleur")}>
            {sketchColors.map((option) => (
              <button
                className={color === option ? "active" : ""}
                type="button"
                style={{ background: option }}
                onClick={() => setColor(option)}
                aria-label={option}
                key={option}
              />
            ))}
          </div>
          <label className="sketch-width">
            <PenLine size={15} />
            <input type="range" min={2} max={10} step={1} value={width} onChange={(event) => setWidth(Number(event.target.value))} aria-label={text("Pen thickness", "Pendikte")} />
          </label>
          <button className="ghost-button" type="button" onClick={undo} disabled={empty}><Undo2 size={15} /> {text("Undo", "Ongedaan maken")}</button>
          <button className="ghost-button" type="button" onClick={clear} disabled={empty}><Eraser size={15} /> {text("Clear", "Wissen")}</button>
        </div>

        <canvas
          className="sketch-canvas"
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
        />

        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <footer className="modal-actions">
          <button className="secondary-button" type="button" onClick={close}>{text("Cancel", "Annuleren")}</button>
          <button className="primary-button" type="button" disabled={empty || busy} onClick={useSketch}>{text("Add the sketch", "Voeg de schets toe")}</button>
        </footer>
      </section>
    </div>
  );
}
