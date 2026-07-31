"use client";

import { Eraser, PenLine, Undo2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n";

type Stroke = { color: string; width: number; points: Array<{ x: number; y: number }> };

const sketchColors = ["#14201c", "#d92d20", "#1d6feb", "#f07400"];

/**
 * A sketch belongs on site: a quick hand drawing of what is wrong or how something has to
 * be built. The result leaves as a normal PNG photo, so it travels the same road as every
 * other piece of evidence — no new storage, no new record type.
 */
export function SketchPad({ close, save }: { close: () => void; save: (file: File) => void }) {
  const { text } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef(false);
  const [color, setColor] = useState(sketchColors[0]);
  const [width, setWidth] = useState(3);
  const [empty, setEmpty] = useState(true);
  const [busy, setBusy] = useState(false);

  const paint = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const stroke of strokesRef.current) {
      if (stroke.points.length < 2) continue;
      context.strokeStyle = stroke.color;
      context.lineWidth = stroke.width;
      context.beginPath();
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (const point of stroke.points.slice(1)) context.lineTo(point.x, point.y);
      context.stroke();
    }
  };

  // The canvas keeps its drawing surface at the size it is shown at, so a sketch made on a
  // phone is not stretched when it is saved.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      const context = canvas.getContext("2d");
      context?.setTransform(ratio, 0, 0, ratio, 0, 0);
      paint();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const pointFrom = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    strokesRef.current = [...strokesRef.current, { color, width, points: [pointFrom(event)] }];
    setEmpty(false);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const strokes = strokesRef.current;
    const current = strokes[strokes.length - 1];
    if (!current) return;
    current.points.push(pointFrom(event));
    paint();
  };

  const end = () => {
    drawingRef.current = false;
  };

  const undo = () => {
    strokesRef.current = strokesRef.current.slice(0, -1);
    setEmpty(strokesRef.current.length === 0);
    paint();
  };

  const clear = () => {
    strokesRef.current = [];
    setEmpty(true);
    paint();
  };

  const useSketch = () => {
    const canvas = canvasRef.current;
    if (!canvas || empty) return;
    setBusy(true);
    canvas.toBlob((blob) => {
      setBusy(false);
      if (!blob) return;
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
            <p>{text("The sketch is added as a photo, with the same project context.", "De schets wordt als foto toegevoegd, met dezelfde projectcontext.")}</p>
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

        <footer className="modal-actions">
          <button className="secondary-button" type="button" onClick={close}>{text("Cancel", "Annuleren")}</button>
          <button className="primary-button" type="button" disabled={empty || busy} onClick={useSketch}>{text("Add the sketch", "Voeg de schets toe")}</button>
        </footer>
      </section>
    </div>
  );
}
