"use client";

import {
  ArrowUpRight,
  Check,
  Loader2,
  MapPin,
  PenLine,
  Square,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { appendDictation, DictateButton } from "@/app/dictate-button";
import { useLanguage } from "@/lib/i18n";
import {
  markedPhotoName,
  markupCanvasSize,
  markupScale,
  normalizedImagePoint,
  photoMarkupPlacement,
  photoMarkupReport,
  photoMarkupSummary,
  photoMarkupToneColors,
} from "@/lib/images/field-image.mjs";

type MarkerTone = "to_be_corrected" | "alternative_solution" | "validated";
type Severity = "low" | "medium" | "high" | "critical";
type Point = { x: number; y: number };

type Marker = {
  id: string;
  xRatio: number;
  yRatio: number;
  tone: MarkerTone;
  label: string;
  description: string;
  severity: Severity;
  buildingId: string;
  locationNodeId: string;
  element: string;
  workPackage: string;
  responsiblePartyId: string;
};

type Shape =
  | { id: string; kind: "pen"; tone: MarkerTone; width: number; points: Point[] }
  | { id: string; kind: "arrow"; tone: MarkerTone; width: number; from: Point; to: Point }
  | { id: string; kind: "box"; tone: MarkerTone; width: number; from: Point; to: Point };

type Tool = "marker" | "pen" | "arrow" | "box";

/** A choice the surrounding screen already knows about, offered inside the marking pad. */
export type MarkupOption = { id: string; label: string; buildingId?: string };

/**
 * What the screen around the pad can tell it about the project. Everything is optional: a
 * screen that does not know the rooms simply does not show the room field.
 */
export type PhotoMarkupContext = {
  buildings?: MarkupOption[];
  defaultBuildingId?: string;
  locations?: MarkupOption[];
  parties?: MarkupOption[];
  workPackages?: string[];
};

/** One marking, in words, exactly as it is numbered on the photo. */
export type PhotoMarkupNote = {
  number: number;
  label: string;
  description: string;
  tone: MarkerTone;
  severity: Severity;
  buildingId: string;
  buildingName: string;
  locationNodeId: string;
  locationLabel: string;
  element: string;
  workPackage: string;
  responsiblePartyId: string;
  responsiblePartyName: string;
  xRatio: number;
  yRatio: number;
};

export type PhotoMarkupResult = {
  file: File;
  /** One line, for a caption field. */
  summary: string;
  /** The full numbered detail, for a description field. */
  report: string;
  notes: PhotoMarkupNote[];
  markerCount: number;
};

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The detail of a marked photo is a numbered block, not a sentence, so it is appended on its
 * own lines instead of running into whatever the supervisor already wrote.
 */
export function appendPhotoDetail(current: string, block: string) {
  if (!block.trim()) return current;
  return current.trim() ? `${current.trim()}\n\n${block.trim()}` : block.trim();
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("unreadable-image"));
    image.src = url;
  });
}

function emptyMarker(tone: MarkerTone, point: Point, buildingId: string): Marker {
  return {
    id: newId(),
    xRatio: point.x,
    yRatio: point.y,
    tone,
    label: "",
    description: "",
    severity: "medium",
    buildingId,
    locationNodeId: "",
    element: "",
    workPackage: "",
    responsiblePartyId: "",
  };
}

/**
 * Marking a photo is the fastest way a supervisor can say what is wrong: tap the spot on the
 * picture, say what is wrong there, where it belongs and who has to fix it. The drawing is
 * burnt into the photo itself, so the picture keeps its meaning in a report, an e-mail or a
 * printed punch list — no viewer, no database record and no connection required. The written
 * detail comes back with the file so the record's own text stays in step with the picture.
 */
export function PhotoMarkupPad({
  file,
  close,
  save,
  context = {},
}: {
  file: File;
  close: () => void;
  save: (result: PhotoMarkupResult) => void;
  context?: PhotoMarkupContext;
}) {
  const { text } = useLanguage();
  const imageRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef<{ id: string; moved: boolean } | null>(null);
  const draggingMarkerRef = useRef<{ id: string; moved: boolean } | null>(null);
  const [tool, setTool] = useState<Tool>("marker");
  const [tone, setTone] = useState<MarkerTone>("to_be_corrected");
  const [penWidth, setPenWidth] = useState(4);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [history, setHistory] = useState<Array<{ kind: "marker" | "shape"; id: string }>>([]);
  const [selected, setSelected] = useState<{ kind: "marker" | "shape"; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  const buildings = useMemo(() => context.buildings ?? [], [context.buildings]);
  const parties = useMemo(() => context.parties ?? [], [context.parties]);
  const workPackages = context.workPackages ?? [];
  const defaultBuildingId = context.defaultBuildingId ?? (buildings.length === 1 ? buildings[0].id : "");
  const activeMarker = selected?.kind === "marker" ? markers.find((marker) => marker.id === selected.id) ?? null : null;

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
  const severityLabels: Record<Severity, string> = {
    low: text("Low · 14 days", "Laag · 14 dagen"),
    medium: text("Medium · 7 days", "Middel · 7 dagen"),
    high: text("High · 3 days", "Hoog · 3 dagen"),
    critical: text("Critical · 1 day", "Kritiek · 1 dag"),
  };
  const shortSeverity: Record<Severity, string> = {
    low: text("Low", "Laag"),
    medium: text("Medium", "Middel"),
    high: text("High", "Hoog"),
    critical: text("Critical", "Kritiek"),
  };

  const describeMarker = useCallback((marker: Marker, index: number): PhotoMarkupNote => ({
    number: index + 1,
    label: marker.label.trim(),
    description: marker.description.trim(),
    tone: marker.tone,
    severity: marker.severity,
    buildingId: marker.buildingId,
    buildingName: buildings.find((building) => building.id === marker.buildingId)?.label ?? "",
    locationNodeId: marker.locationNodeId,
    locationLabel: (context.locations ?? []).find((location) => location.id === marker.locationNodeId)?.label ?? "",
    element: marker.element.trim(),
    workPackage: marker.workPackage,
    responsiblePartyId: marker.responsiblePartyId,
    responsiblePartyName: parties.find((party) => party.id === marker.responsiblePartyId)?.label ?? "",
    xRatio: marker.xRatio,
    yRatio: marker.yRatio,
  }), [buildings, context.locations, parties]);

  // The drawing lives on top of the photo at the size the photo happens to be shown, so every
  // point is stored as a ratio and repainted whenever that size changes.
  const paintOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    const image = imageRef.current;
    const context2d = canvas?.getContext("2d");
    if (!canvas || !image || !context2d) return;
    const rect = image.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(rect.width * ratio) || canvas.height !== Math.round(rect.height * ratio)) {
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
    }
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    context2d.setTransform(ratio, 0, 0, ratio, 0, 0);
    context2d.clearRect(0, 0, rect.width, rect.height);
    drawShapes(context2d, shapes, rect.width, rect.height, {
      strokeScale: Math.min(rect.width, rect.height) / 400,
      fontSize: Math.max(12, Math.round(Math.min(rect.width, rect.height) * 0.05)),
    });
  }, [shapes]);

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

  const remember = (kind: "marker" | "shape", id: string) => setHistory((current) => [...current, { kind, id }]);

  const addMarker = (point: Point) => {
    const marker = emptyMarker(tone, point, defaultBuildingId);
    setMarkers((current) => [...current, marker]);
    remember("marker", marker.id);
    setSelected({ kind: "marker", id: marker.id });
  };


  const startOnStage = (event: React.PointerEvent<HTMLDivElement>) => {
    if (draggingMarkerRef.current) return;
    if (tool === "marker") return;
    // Without this the browser starts dragging the photo as an image, which cancels the
    // pointer stream and cuts the line off after a few millimetres.
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = ratioFrom(event.clientX, event.clientY);
    const id = newId();
    const shape: Shape = tool === "pen"
      ? { id, kind: "pen", tone, width: penWidth, points: [point] }
      : { id, kind: tool, tone, width: penWidth, from: point, to: point };
    drawingRef.current = { id, moved: false };
    setShapes((current) => [...current, shape]);
    setSelected(null);
  };

  const moveOnStage = (event: React.PointerEvent<HTMLElement>) => {
    const point = ratioFrom(event.clientX, event.clientY);
    const dragging = draggingMarkerRef.current;
    if (dragging) {
      dragging.moved = true;
      setMarkers((current) => current.map((marker) => marker.id === dragging.id ? { ...marker, xRatio: point.x, yRatio: point.y } : marker));
      return;
    }
    const drawing = drawingRef.current;
    if (!drawing) return;
    drawing.moved = true;
    setShapes((current) => current.map((shape) => {
      if (shape.id !== drawing.id) return shape;
      if (shape.kind === "pen") return { ...shape, points: [...shape.points, point] };
      if (shape.kind === "arrow" || shape.kind === "box") return { ...shape, to: point };
      return shape;
    }));
  };

  const endOnStage = () => {
    const dragging = draggingMarkerRef.current;
    if (dragging) {
      draggingMarkerRef.current = null;
      if (!dragging.moved) setSelected({ kind: "marker", id: dragging.id });
      return;
    }
    const drawing = drawingRef.current;
    drawingRef.current = null;
    if (!drawing) return;
    // A tap that never moved is not a line; it would only add invisible clutter.
    if (drawing.moved) remember("shape", drawing.id);
    else setShapes((current) => current.filter((shape) => shape.id !== drawing.id));
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((current) => current.slice(0, -1));
    if (last.kind === "marker") setMarkers((current) => current.filter((marker) => marker.id !== last.id));
    else setShapes((current) => current.filter((shape) => shape.id !== last.id));
    if (selected?.id === last.id) setSelected(null);
  };

  const clearAll = () => {
    setMarkers([]);
    setShapes([]);
    setHistory([]);
    setSelected(null);
  };

  const patchMarker = (id: string, patch: Partial<Marker>) => setMarkers((current) =>
    current.map((marker) => marker.id === id ? { ...marker, ...patch } : marker));

  const removeSelected = () => {
    if (!selected) return;
    if (selected.kind === "marker") setMarkers((current) => current.filter((marker) => marker.id !== selected.id));
    else setShapes((current) => current.filter((shape) => shape.id !== selected.id));
    setHistory((current) => current.filter((entry) => entry.id !== selected.id));
    setSelected(null);
  };

  /** Burn the drawing into the picture itself, at the resolution of the original photo. */
  const flatten = async () => {
    setBusy(true);
    setError("");
    try {
      const image = await loadImage(previewUrl);
      const size = markupCanvasSize(image.naturalWidth, image.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const context2d = canvas.getContext("2d");
      if (!size.width || !context2d) throw new Error("unreadable-image");
      context2d.drawImage(image, 0, 0, size.width, size.height);
      const metrics = markupScale(size.width, size.height);

      drawShapes(context2d, shapes, size.width, size.height, {
        strokeScale: Math.min(size.width, size.height) / 400,
        fontSize: metrics.fontSize,
      });

      context2d.textAlign = "center";
      context2d.textBaseline = "middle";
      context2d.font = `700 ${metrics.fontSize}px system-ui, sans-serif`;
      markers.forEach((marker, index) => {
        const x = marker.xRatio * size.width;
        const y = marker.yRatio * size.height;
        context2d.beginPath();
        context2d.arc(x, y, metrics.markerRadius, 0, Math.PI * 2);
        context2d.fillStyle = photoMarkupToneColors[marker.tone];
        context2d.fill();
        context2d.lineWidth = Math.max(2, Math.round(metrics.markerRadius * 0.16));
        context2d.strokeStyle = "#ffffff";
        context2d.stroke();
        context2d.fillStyle = "#ffffff";
        context2d.fillText(String(index + 1), x, y + metrics.fontSize * 0.04);
      });

      // Nothing but the numbers and the drawing goes onto the picture. What the numbers mean
      // is a detail of the photo, kept beside it, so the picture stays a picture.
      const notes = markers.map(describeMarker);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("unreadable-image");
      // The marked photo keeps the moment the picture was taken, not the moment it was marked,
      // so the evidence stays in the order the site was walked.
      const marked = new File([blob], markedPhotoName(file.name), { type: "image/jpeg", lastModified: file.lastModified });
      save({
        file: marked,
        summary: photoMarkupSummary(markers.map((marker) => ({ label: marker.label }))),
        report: photoMarkupReport(notes, {
          severityLabels: shortSeverity,
          responsibleLabel: text("Responsible", "Verantwoordelijke"),
        }),
        notes,
        markerCount: markers.length,
      });
    } catch {
      setError(text(
        "The markings could not be saved onto this photo. The original photo stays attached.",
        "De markeringen konden niet op deze foto worden vastgelegd. De oorspronkelijke foto blijft gekoppeld.",
      ));
    } finally {
      setBusy(false);
    }
  };

  const empty = !markers.length && !shapes.length;
  const markerLocations = (context.locations ?? []).filter((location) =>
    !location.buildingId || !activeMarker?.buildingId || location.buildingId === activeMarker.buildingId);
  const tools: Array<{ id: Tool; label: string; icon: typeof MapPin }> = [
    { id: "marker", label: text("Marker", "Marker"), icon: MapPin },
    { id: "pen", label: text("Draw", "Tekenen"), icon: PenLine },
    { id: "arrow", label: text("Arrow", "Pijl"), icon: ArrowUpRight },
    { id: "box", label: text("Frame", "Kader"), icon: Square },
  ];

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal photo-markup-modal" role="dialog" aria-modal="true" aria-labelledby="photo-markup-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">{text("Mark on the photo", "Markeren op de foto")}</p>
            <h2 id="photo-markup-title">{text("Tap the photo where the problem is", "Tik op de foto waar het probleem zit")}</h2>
            <p>{text("Place a numbered marker, draw an arrow or a frame, and write what is wrong, where it belongs and who has to fix it.", "Plaats een genummerde marker, teken een pijl of kader, en schrijf op wat er mis is, waar het bij hoort en wie het moet oplossen.")}</p>
          </div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>

        <div className="modal-body photo-markup-body">
          {/* Tools and photo stay pinned together while the detail below them is filled in.
              Typing on a phone scrolls the field into place, and the picture being described
              must not disappear off-screen while that happens. */}
          <div className="photo-markup-pinned">
          <div className="photo-markup-toolbar">
          <div className="photo-markup-modes" role="group" aria-label={text("Marking tool", "Markeergereedschap")}>
            {tools.map((entry) => {
              const Icon = entry.icon;
              return <button className={tool === entry.id ? "active" : ""} type="button" onClick={() => setTool(entry.id)} key={entry.id}><Icon size={15} /> {entry.label}</button>;
            })}
          </div>
          {/* The colour of what gets placed next. It deliberately never recolours something
              that is already on the photo: each marking keeps its own classification, which is
              changed in its own panel. */}
          <div className="photo-markup-tones" role="group" aria-label={text("Colour for the next marking", "Kleur voor de volgende markering")}>
            {(Object.keys(toneLabels) as MarkerTone[]).map((option) => (
              <button
                className={tone === option ? "active" : ""}
                type="button"
                style={{ ["--markup-tone" as string]: photoMarkupToneColors[option] }}
                onClick={() => setTone(option)}
                key={option}
              >{toneLabels[option]}</button>
            ))}
          </div>
          <div className="photo-markup-history">
            <label className="photo-markup-width">
              <PenLine size={14} />
              <input type="range" min={2} max={12} step={1} value={penWidth} onChange={(event) => setPenWidth(Number(event.target.value))} aria-label={text("Line thickness", "Lijndikte")} />
            </label>
            <button className="ghost-button" type="button" onClick={undo} disabled={!history.length}><Undo2 size={15} /> {text("Undo", "Ongedaan maken")}</button>
            <button className="ghost-button" type="button" onClick={clearAll} disabled={empty}><Trash2 size={15} /> {text("Clear", "Wissen")}</button>
          </div>
          </div>
          <div
            className={`photo-markup-stage ${tool}`}
            onPointerDown={startOnStage}
            onPointerMove={moveOnStage}
            onPointerUp={endOnStage}
            onPointerCancel={endOnStage}
            onClick={(event) => {
              if (event.target !== imageRef.current || tool !== "marker") return;
              addMarker(ratioFrom(event.clientX, event.clientY));
            }}
          >
            {/* The frame is exactly the picture, so a marker sits where it was tapped even
                when a portrait photo leaves bars beside it. */}
            <div className="photo-markup-frame">
            {/* A local blob URL cannot pass through the Next image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={previewUrl}
              alt={text("Photo to mark", "Te markeren foto")}
              draggable={false}
              onLoad={paintOverlay}
              onDragStart={(event) => event.preventDefault()}
              role={tool === "marker" ? "button" : undefined}
              tabIndex={tool === "marker" ? 0 : undefined}
              aria-label={tool === "marker" ? text("Photo. Tap to place a marker.", "Foto. Tik om een marker te plaatsen.") : undefined}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                if (tool !== "marker") return;
                event.preventDefault();
                addMarker({ x: 0.5, y: 0.5 });
              }}
            />
            <canvas className="photo-markup-overlay" ref={overlayRef} />
            {markers.map((marker, index) => (
              <button
                className={`photo-markup-marker ${selected?.id === marker.id ? "active" : ""}`}
                style={{ left: `${marker.xRatio * 100}%`, top: `${marker.yRatio * 100}%`, ["--markup-tone" as string]: photoMarkupToneColors[marker.tone] }}
                type="button"
                // A marker can be dragged to the exact spot after it has been placed.
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  draggingMarkerRef.current = { id: marker.id, moved: false };
                }}
                onPointerMove={(event) => { if (draggingMarkerRef.current?.id === marker.id) moveOnStage(event); }}
                onPointerUp={(event) => { event.stopPropagation(); endOnStage(); }}
                onPointerCancel={endOnStage}
                onClick={(event) => { event.stopPropagation(); setSelected({ kind: "marker", id: marker.id }); }}
                aria-label={marker.label.trim() || `${text("Marker", "Marker")} ${index + 1}`}
                key={marker.id}
              >{index + 1}</button>
            ))}
            </div>
          </div>
          </div>

          {activeMarker ? (
            <div className="photo-markup-editor">
              <div className="photo-markup-editor-heading">
                <span className="record-number">{text("Marker", "Marker")} {markers.findIndex((marker) => marker.id === activeMarker.id) + 1}</span>
                <button className="field-clear-button" type="button" onClick={removeSelected}><Trash2 size={13} /> {text("Remove marker", "Marker verwijderen")}</button>
              </div>
              <div className="quick-issue-presets" aria-label={text("Choose what is wrong here", "Kies wat hier mis is")}>
                {labelPresets.map((preset) => (
                  <button
                    className={activeMarker.label === preset ? "active" : ""}
                    type="button"
                    onClick={() => patchMarker(activeMarker.id, { label: activeMarker.label === preset ? "" : preset })}
                    key={preset}
                  >{preset}</button>
                ))}
              </div>
              <label className="form-field">
                <span>{text("What is wrong at this spot?", "Wat is er mis op deze plek?")}</span>
                <input
                  value={activeMarker.label}
                  onChange={(event) => patchMarker(activeMarker.id, { label: event.target.value })}
                  placeholder={text("Choose above or type it in a few words.", "Kies hierboven of typ het in een paar woorden.")}
                  autoFocus
                />
              </label>
              <label className="form-field">
                <span>{text("Full description · what, how much, what has to happen", "Volledige omschrijving · wat, hoeveel, wat moet er gebeuren")}</span>
                <textarea
                  rows={3}
                  value={activeMarker.description}
                  onChange={(event) => patchMarker(activeMarker.id, { description: event.target.value })}
                  placeholder={text("For example: three anchors missing on the left column; refit and have it re-inspected.", "Bijvoorbeeld: drie ankers ontbreken op de linkerkolom; opnieuw plaatsen en laten herkeuren.")}
                />
                <DictateButton onText={(transcript) => patchMarker(activeMarker.id, { description: appendDictation(activeMarker.description, transcript) })} />
              </label>
              <div className="form-grid-2">
                <label className="form-field">
                  <span>{text("Severity", "Ernst")}</span>
                  <select value={activeMarker.severity} onChange={(event) => patchMarker(activeMarker.id, { severity: event.target.value as Severity })}>
                    {(Object.keys(severityLabels) as Severity[]).map((option) => <option value={option} key={option}>{severityLabels[option]}</option>)}
                  </select>
                </label>
                <label className="form-field">
                  <span>{text("Classification · colour", "Classificatie · kleur")}</span>
                  <select value={activeMarker.tone} onChange={(event) => patchMarker(activeMarker.id, { tone: event.target.value as MarkerTone })}>
                    {(Object.keys(toneLabels) as MarkerTone[]).map((option) => <option value={option} key={option}>{toneLabels[option]}</option>)}
                  </select>
                </label>
              </div>
              {/* Where the marking belongs. Only the parts this screen actually knows about. */}
              {buildings.length || markerLocations.length || workPackages.length || parties.length ? (
                <fieldset className="photo-markup-placement">
                  <legend>{text("Where does this belong?", "Waar hoort dit bij?")}</legend>
                  <div className="form-grid-2">
                    {buildings.length > 1 ? (
                      <label className="form-field">
                        <span>{text("Building", "Gebouw")}</span>
                        <select value={activeMarker.buildingId} onChange={(event) => patchMarker(activeMarker.id, { buildingId: event.target.value, locationNodeId: "" })}>
                          <option value="">{text("Not specified", "Niet aangegeven")}</option>
                          {buildings.map((building) => <option value={building.id} key={building.id}>{building.label}</option>)}
                        </select>
                      </label>
                    ) : null}
                    {markerLocations.length ? (
                      <label className="form-field">
                        <span>{text("Floor / room / element", "Verdieping / ruimte / element")}</span>
                        <select value={activeMarker.locationNodeId} onChange={(event) => patchMarker(activeMarker.id, { locationNodeId: event.target.value })}>
                          <option value="">{text("Not specified", "Niet aangegeven")}</option>
                          {markerLocations.map((location) => <option value={location.id} key={location.id}>{location.label}</option>)}
                        </select>
                      </label>
                    ) : null}
                    {workPackages.length ? (
                      <label className="form-field">
                        <span>{text("Work package", "Werkpakket")}</span>
                        <select value={activeMarker.workPackage} onChange={(event) => patchMarker(activeMarker.id, { workPackage: event.target.value })}>
                          <option value="">{text("Not specified", "Niet aangegeven")}</option>
                          {workPackages.map((option) => <option value={option} key={option}>{option}</option>)}
                        </select>
                      </label>
                    ) : null}
                    {parties.length ? (
                      <label className="form-field">
                        <span>{text("Responsible party", "Verantwoordelijke partij")}</span>
                        <select value={activeMarker.responsiblePartyId} onChange={(event) => patchMarker(activeMarker.id, { responsiblePartyId: event.target.value })}>
                          <option value="">{text("Not assigned", "Niet toegewezen")}</option>
                          {parties.map((party) => <option value={party.id} key={party.id}>{party.label}</option>)}
                        </select>
                      </label>
                    ) : null}
                    <label className="form-field">
                      <span>{text("Exact spot · own words", "Exacte plek · eigen woorden")}</span>
                      <input
                        value={activeMarker.element}
                        onChange={(event) => patchMarker(activeMarker.id, { element: event.target.value })}
                        placeholder={text("For example: column line B, 2nd floor", "Bijvoorbeeld: kolom lijn B, 2e verdieping")}
                      />
                    </label>
                  </div>
                </fieldset>
              ) : null}
            </div>
          ) : (
            <>
              <p className="photo-markup-hint">
                {tool === "marker"
                  ? text("Tap the photo to place a marker, then write what is wrong and where it belongs. Drag a marker to move it.", "Tik op de foto om een marker te plaatsen en schrijf daarna wat er mis is en waar het bij hoort. Sleep een marker om hem te verplaatsen.")
                  : tool === "box"
                    ? text("Drag a frame around the area the problem covers.", "Sleep een kader om het gebied waar het probleem zich uitstrekt.")
                    : tool === "arrow"
                      ? text("Drag from where you start to what you are pointing at.", "Sleep van je startpunt naar wat je aanwijst.")
                      : text("Drag over the photo to circle or underline the problem.", "Sleep over de foto om het probleem te omcirkelen of te onderstrepen.")}
              </p>
              {markers.length ? (
                <ol className="photo-markup-list" aria-label={text("Markings on this photo", "Markeringen op deze foto")}>
                  {markers.map((marker, index) => {
                    const note = describeMarker(marker, index);
                    return (
                      <li key={marker.id}>
                        <button type="button" onClick={() => setSelected({ kind: "marker", id: marker.id })}>
                          <span className="photo-markup-list-number" style={{ ["--markup-tone" as string]: photoMarkupToneColors[marker.tone] }}>{index + 1}</span>
                          <span>
                            <strong>{note.label || text("No description yet", "Nog geen omschrijving")}</strong>
                            <small>{[shortSeverity[marker.severity], photoMarkupPlacement(note)].filter(Boolean).join(" · ")}</small>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : null}
            </>
          )}
          {error ? <p className="field-error" role="alert">{error}</p> : null}
        </div>

        <footer className="modal-actions">
          <button className="secondary-button" type="button" onClick={close}>{text("Cancel", "Annuleren")}</button>
          <button className="primary-button" type="button" disabled={busy || empty} onClick={() => void flatten()}>
            {busy ? <Loader2 className="spin" size={15} /> : <Check size={15} />}
            {busy ? text("Saving markings…", "Markeringen opslaan…") : text("Save markings on the photo", "Markeringen op de foto opslaan")}
          </button>
        </footer>
      </section>
    </div>
  );
}

/** One drawing routine for the live overlay and for the flattened photo, so they match. */
function drawShapes(
  context: CanvasRenderingContext2D,
  shapes: Shape[],
  width: number,
  height: number,
  options: { strokeScale: number; fontSize: number },
) {
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const shape of shapes) {
    context.strokeStyle = photoMarkupToneColors[shape.tone];
    context.fillStyle = photoMarkupToneColors[shape.tone];
    context.lineWidth = Math.max(1, shape.width * options.strokeScale);
    if (shape.kind === "pen") {
      if (shape.points.length < 2) continue;
      context.beginPath();
      context.moveTo(shape.points[0].x * width, shape.points[0].y * height);
      for (const point of shape.points.slice(1)) context.lineTo(point.x * width, point.y * height);
      context.stroke();
      continue;
    }
    const fromX = shape.from.x * width;
    const fromY = shape.from.y * height;
    const toX = shape.to.x * width;
    const toY = shape.to.y * height;
    if (shape.kind === "box") {
      context.strokeRect(Math.min(fromX, toX), Math.min(fromY, toY), Math.abs(toX - fromX), Math.abs(toY - fromY));
      continue;
    }
    context.beginPath();
    context.moveTo(fromX, fromY);
    context.lineTo(toX, toY);
    context.stroke();
    // The head is drawn as a filled triangle so it stays sharp at any photo resolution.
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const headLength = Math.max(context.lineWidth * 3.4, 10);
    context.beginPath();
    context.moveTo(toX, toY);
    context.lineTo(toX - headLength * Math.cos(angle - Math.PI / 7), toY - headLength * Math.sin(angle - Math.PI / 7));
    context.lineTo(toX - headLength * Math.cos(angle + Math.PI / 7), toY - headLength * Math.sin(angle + Math.PI / 7));
    context.closePath();
    context.fill();
  }
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
