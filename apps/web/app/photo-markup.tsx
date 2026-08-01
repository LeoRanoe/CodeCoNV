"use client";

import { Check, Loader2, MapPin, PenLine, Trash2, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import {
  markedPhotoName,
  markupCanvasSize,
  markupScale,
  normalizedImagePoint,
  photoMarkupSummary,
  photoMarkupToneColors,
} from "@/lib/images/field-image.mjs";

type MarkerTone = "to_be_corrected" | "alternative_solution" | "validated";
type Marker = { id: string; xRatio: number; yRatio: number; label: string; tone: MarkerTone };
type Stroke = { tone: MarkerTone; points: Array<{ x: number; y: number }> };

/** The marked photo plus the written list of what was marked on it. */
export type PhotoMarkupResult = { file: File; summary: string; markerCount: number };

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("unreadable-image"));
    image.src = url;
  });
}

/**
 * Marking a photo is the fastest way a supervisor can say what is wrong: tap the spot on the
 * picture, pick or type what is wrong there, done. The markings are burnt into the photo
 * itself, so the picture keeps its meaning in a report, an e-mail or a printed punch list —
 * no viewer, no database record and no connection required. The written list comes back with
 * the file so the record's own text stays in step with what the picture shows.
 */
export function PhotoMarkupPad({
  file,
  close,
  save,
  busyLabel,
}: {
  file: File;
  close: () => void;
  save: (result: PhotoMarkupResult) => void;
  busyLabel?: string;
}) {
  const { text } = useLanguage();
  const imageRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [mode, setMode] = useState<"mark" | "draw">("mark");
  const [tone, setTone] = useState<MarkerTone>("to_be_corrected");
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [activeMarkerId, setActiveMarkerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  const activeMarker = markers.find((marker) => marker.id === activeMarkerId) ?? null;
  const labelPresets = [
    text("Crack or damage", "Scheur of beschadiging"),
    text("Work incomplete", "Werk niet volledig"),
    text("Incorrect dimensions", "Verkeerde maatvoering"),
    text("Safety risk", "Veiligheidsrisico"),
    text("Finish or cleaning", "Afwerking of schoonmaak"),
    text("Leak or moisture", "Lekkage of vocht"),
  ];
  const toneLabels: Record<MarkerTone, string> = {
    to_be_corrected: text("To be corrected", "Te corrigeren"),
    alternative_solution: text("Alternative solution", "Andere oplossing"),
    validated: text("Approved", "Goedgekeurd"),
  };

  // The freehand lines live on top of the photo at the size the photo happens to be shown,
  // so they are stored as ratios and repainted whenever that size changes.
  const paintOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    const image = imageRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !image || !context) return;
    const rect = image.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(rect.width * ratio) || canvas.height !== Math.round(rect.height * ratio)) {
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
    }
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = Math.max(3, Math.round(Math.min(rect.width, rect.height) * 0.01));
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      context.strokeStyle = photoMarkupToneColors[stroke.tone];
      context.beginPath();
      context.moveTo(stroke.points[0].x * rect.width, stroke.points[0].y * rect.height);
      for (const point of stroke.points.slice(1)) context.lineTo(point.x * rect.width, point.y * rect.height);
      context.stroke();
    }
  }, [strokes]);

  useEffect(() => {
    paintOverlay();
    const image = imageRef.current;
    if (!image || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", paintOverlay);
      return () => window.removeEventListener("resize", paintOverlay);
    }
    const observer = new ResizeObserver(() => paintOverlay());
    observer.observe(image);
    return () => observer.disconnect();
  }, [paintOverlay]);

  const ratioFrom = (clientX: number, clientY: number) => {
    const image = imageRef.current;
    if (!image) return { x: 0.5, y: 0.5 };
    return normalizedImagePoint(clientX, clientY, image.getBoundingClientRect());
  };

  const addMarker = (clientX: number, clientY: number) => {
    const point = ratioFrom(clientX, clientY);
    const marker: Marker = { id: newId(), xRatio: point.x, yRatio: point.y, label: "", tone };
    setMarkers((current) => [...current, marker]);
    setActiveMarkerId(marker.id);
  };

  const startStroke = (event: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== "draw") return;
    // Without this the browser starts dragging the photo as an image, which cancels the
    // pointer stream and cuts the line off after a few millimetres.
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const point = ratioFrom(event.clientX, event.clientY);
    setStrokes((current) => [...current, { tone, points: [{ x: point.x, y: point.y }] }]);
  };

  const extendStroke = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current) return;
    const point = ratioFrom(event.clientX, event.clientY);
    setStrokes((current) => {
      if (!current.length) return current;
      const last = current[current.length - 1];
      return [...current.slice(0, -1), { ...last, points: [...last.points, { x: point.x, y: point.y }] }];
    });
  };

  const endStroke = () => {
    drawingRef.current = false;
    // A tap that never moved is a dot, not a line; it would only add invisible clutter.
    setStrokes((current) => current.filter((stroke) => stroke.points.length > 1));
  };

  const undo = () => {
    if (mode === "draw" && strokes.length) {
      setStrokes((current) => current.slice(0, -1));
      return;
    }
    if (markers.length) {
      const removed = markers[markers.length - 1];
      setMarkers((current) => current.slice(0, -1));
      if (activeMarkerId === removed.id) setActiveMarkerId("");
      return;
    }
    setStrokes((current) => current.slice(0, -1));
  };

  const clearAll = () => {
    setMarkers([]);
    setStrokes([]);
    setActiveMarkerId("");
  };

  const updateActiveMarker = (patch: Partial<Marker>) => {
    setMarkers((current) => current.map((marker) => marker.id === activeMarkerId ? { ...marker, ...patch } : marker));
  };

  const removeActiveMarker = () => {
    setMarkers((current) => current.filter((marker) => marker.id !== activeMarkerId));
    setActiveMarkerId("");
  };

  /** Burn the markings into the picture itself, at the resolution of the original photo. */
  const flatten = async () => {
    setBusy(true);
    setError("");
    try {
      const image = await loadImage(previewUrl);
      const size = markupCanvasSize(image.naturalWidth, image.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext("2d");
      if (!size.width || !context) throw new Error("unreadable-image");
      context.drawImage(image, 0, 0, size.width, size.height);
      const metrics = markupScale(size.width, size.height);

      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = metrics.strokeWidth;
      for (const stroke of strokes) {
        if (stroke.points.length < 2) continue;
        context.strokeStyle = photoMarkupToneColors[stroke.tone];
        context.beginPath();
        context.moveTo(stroke.points[0].x * size.width, stroke.points[0].y * size.height);
        for (const point of stroke.points.slice(1)) context.lineTo(point.x * size.width, point.y * size.height);
        context.stroke();
      }

      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = `700 ${metrics.fontSize}px system-ui, sans-serif`;
      markers.forEach((marker, index) => {
        const x = marker.xRatio * size.width;
        const y = marker.yRatio * size.height;
        context.beginPath();
        context.arc(x, y, metrics.markerRadius, 0, Math.PI * 2);
        context.fillStyle = photoMarkupToneColors[marker.tone];
        context.fill();
        context.lineWidth = Math.max(2, Math.round(metrics.markerRadius * 0.16));
        context.strokeStyle = "#ffffff";
        context.stroke();
        context.fillStyle = "#ffffff";
        context.fillText(String(index + 1), x, y + metrics.fontSize * 0.04);
      });

      // The legend keeps the picture readable on its own: number, colour and the words the
      // supervisor typed, printed on the photo instead of only in a database field.
      const lines = markers
        .map((marker, index) => ({ marker, index }))
        .filter((entry) => entry.marker.label.trim().length > 0);
      if (lines.length) {
        const lineHeight = Math.round(metrics.legendFontSize * 1.65);
        const padding = Math.round(metrics.legendFontSize * 0.7);
        const bandHeight = lines.length * lineHeight + padding * 2;
        context.fillStyle = "rgba(12, 20, 17, 0.72)";
        context.fillRect(0, size.height - bandHeight, size.width, bandHeight);
        context.textAlign = "left";
        context.font = `600 ${metrics.legendFontSize}px system-ui, sans-serif`;
        lines.forEach((entry, row) => {
          const baseline = size.height - bandHeight + padding + row * lineHeight + lineHeight / 2;
          const dotRadius = Math.round(metrics.legendFontSize * 0.42);
          const dotX = padding + dotRadius;
          context.beginPath();
          context.arc(dotX, baseline, dotRadius, 0, Math.PI * 2);
          context.fillStyle = photoMarkupToneColors[entry.marker.tone];
          context.fill();
          context.fillStyle = "#ffffff";
          const label = `${entry.index + 1}. ${entry.marker.label.trim()}`;
          const room = size.width - (dotX + dotRadius + padding) - padding;
          let printed = label;
          while (printed.length > 4 && context.measureText(printed).width > room) {
            printed = `${printed.slice(0, -2).trimEnd()}…`;
          }
          context.fillText(printed, dotX + dotRadius + padding / 2, baseline);
        });
      }

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("unreadable-image");
      const marked = new File([blob], markedPhotoName(file.name), { type: "image/jpeg", lastModified: Date.now() });
      save({ file: marked, summary: photoMarkupSummary(markers), markerCount: markers.length });
    } catch {
      setError(text(
        "The markings could not be saved onto this photo. The original photo stays attached.",
        "De markeringen konden niet op deze foto worden vastgelegd. De oorspronkelijke foto blijft gekoppeld.",
      ));
    } finally {
      setBusy(false);
    }
  };

  const empty = !markers.length && !strokes.length;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal photo-markup-modal" role="dialog" aria-modal="true" aria-labelledby="photo-markup-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">{text("Mark on the photo", "Markeren op de foto")}</p>
            <h2 id="photo-markup-title">{text("Tap the photo where the problem is", "Tik op de foto waar het probleem zit")}</h2>
            <p>{text("Every tap places a numbered marker you can name. The markers are saved into the photo itself.", "Elke tik plaatst een genummerde marker die je een naam geeft. De markers worden in de foto zelf opgeslagen.")}</p>
          </div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>

        <div className="photo-markup-toolbar">
          <div className="photo-markup-modes" role="group" aria-label={text("Marking tool", "Markeergereedschap")}>
            <button className={mode === "mark" ? "active" : ""} type="button" onClick={() => setMode("mark")}><MapPin size={15} /> {text("Place marker", "Marker plaatsen")}</button>
            <button className={mode === "draw" ? "active" : ""} type="button" onClick={() => { setMode("draw"); setActiveMarkerId(""); }}><PenLine size={15} /> {text("Draw", "Tekenen")}</button>
          </div>
          <div className="photo-markup-tones" role="group" aria-label={text("Marker classification", "Markerclassificatie")}>
            {(Object.keys(toneLabels) as MarkerTone[]).map((option) => (
              <button
                className={tone === option ? "active" : ""}
                type="button"
                style={{ ["--markup-tone" as string]: photoMarkupToneColors[option] }}
                onClick={() => { setTone(option); if (activeMarker) updateActiveMarker({ tone: option }); }}
                key={option}
              >{toneLabels[option]}</button>
            ))}
          </div>
          <div className="photo-markup-history">
            <button className="ghost-button" type="button" onClick={undo} disabled={empty}><Undo2 size={15} /> {text("Undo", "Ongedaan maken")}</button>
            <button className="ghost-button" type="button" onClick={clearAll} disabled={empty}><Trash2 size={15} /> {text("Clear", "Wissen")}</button>
          </div>
        </div>

        <div className="modal-body photo-markup-body">
          <div
            className={`photo-markup-stage ${mode}`}
            onPointerDown={startStroke}
            onPointerMove={extendStroke}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onClick={(event) => { if (mode === "mark" && event.target === imageRef.current) addMarker(event.clientX, event.clientY); }}
          >
            {/* A local blob URL cannot pass through the Next image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={previewUrl}
              alt={text("Photo to mark", "Te markeren foto")}
              draggable={false}
              onLoad={paintOverlay}
              onDragStart={(event) => event.preventDefault()}
              role={mode === "mark" ? "button" : undefined}
              tabIndex={mode === "mark" ? 0 : undefined}
              aria-label={mode === "mark" ? text("Photo. Tap to place a marker.", "Foto. Tik om een marker te plaatsen.") : undefined}
              onKeyDown={(event) => {
                if (mode !== "mark" || (event.key !== "Enter" && event.key !== " ")) return;
                event.preventDefault();
                const rect = event.currentTarget.getBoundingClientRect();
                addMarker(rect.left + rect.width / 2, rect.top + rect.height / 2);
              }}
            />
            <canvas className="photo-markup-overlay" ref={overlayRef} />
            {markers.map((marker, index) => (
              <button
                className={`photo-markup-marker ${marker.id === activeMarkerId ? "active" : ""}`}
                style={{ left: `${marker.xRatio * 100}%`, top: `${marker.yRatio * 100}%`, ["--markup-tone" as string]: photoMarkupToneColors[marker.tone] }}
                type="button"
                onClick={(event) => { event.stopPropagation(); setActiveMarkerId(marker.id); setMode("mark"); }}
                aria-label={marker.label.trim() || `${text("Marker", "Marker")} ${index + 1}`}
                key={marker.id}
              >{index + 1}</button>
            ))}
          </div>

          {activeMarker ? (
            <div className="photo-markup-editor">
              <div className="photo-markup-editor-heading">
                <span className="record-number">{text("Marker", "Marker")} {markers.findIndex((marker) => marker.id === activeMarker.id) + 1}</span>
                <button className="field-clear-button" type="button" onClick={removeActiveMarker}><Trash2 size={13} /> {text("Remove marker", "Marker verwijderen")}</button>
              </div>
              <div className="quick-issue-presets" aria-label={text("Choose what is wrong here", "Kies wat hier mis is")}>
                {labelPresets.map((preset) => (
                  <button
                    className={activeMarker.label === preset ? "active" : ""}
                    type="button"
                    onClick={() => updateActiveMarker({ label: activeMarker.label === preset ? "" : preset })}
                    key={preset}
                  >{preset}</button>
                ))}
              </div>
              <label className="form-field">
                <span>{text("What is wrong at this spot?", "Wat is er mis op deze plek?")}</span>
                <input
                  value={activeMarker.label}
                  onChange={(event) => updateActiveMarker({ label: event.target.value })}
                  placeholder={text("Choose above or type it in a few words.", "Kies hierboven of typ het in een paar woorden.")}
                  autoFocus
                />
              </label>
            </div>
          ) : (
            <p className="photo-markup-hint">
              {mode === "mark"
                ? text("Tap the photo to place a marker, then say what is wrong there.", "Tik op de foto om een marker te plaatsen en zeg daarna wat er mis is.")
                : text("Drag over the photo to circle or point at the problem.", "Sleep over de foto om het probleem te omcirkelen of aan te wijzen.")}
            </p>
          )}
          {error ? <p className="field-error" role="alert">{error}</p> : null}
        </div>

        <footer className="modal-actions">
          <button className="secondary-button" type="button" onClick={close}>{text("Cancel", "Annuleren")}</button>
          <button className="primary-button" type="button" disabled={busy || empty} onClick={() => void flatten()}>
            {busy ? <Loader2 className="spin" size={15} /> : <Check size={15} />}
            {busy ? busyLabel ?? text("Saving markings…", "Markeringen opslaan…") : text("Save markings on the photo", "Markeringen op de foto opslaan")}
          </button>
        </footer>
      </section>
    </div>
  );
}

/**
 * The one affordance every photo in the app should carry. It is deliberately a visible button
 * with words on it: the client's supervisors did not discover that a thumbnail was tappable.
 */
export function MarkPhotoButton({ onClick, markerCount, compact }: { onClick: () => void; markerCount?: number; compact?: boolean }) {
  const { text } = useLanguage();
  const marked = (markerCount ?? 0) > 0;
  return (
    <button
      className={`mark-photo-button ${compact ? "compact" : ""} ${marked ? "marked" : ""}`}
      type="button"
      onClick={onClick}
    >
      <MapPin size={compact ? 13 : 15} />
      {marked
        ? text(`${markerCount} marked · edit`, `${markerCount} gemarkeerd · aanpassen`)
        : text("Mark on photo", "Markeer op foto")}
    </button>
  );
}
