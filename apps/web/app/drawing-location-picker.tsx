"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { AlertTriangle, ChevronLeft, ChevronRight, Check, FileText, Loader2, MapPin, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { BuildingOption } from "@/app/building-picker";
import { useLanguage } from "@/lib/i18n";
import { normalizedImagePoint } from "@/lib/images/field-image.mjs";
import { loadProjectFilePreviewObjectUrl } from "@/lib/storage/gateway";
import type { FileRecord } from "@/lib/supabase/operations";

/**
 * "Locatie kunnen kiezen in PDF" — the client does not want to type a room name that only the
 * person who was there understands. Pointing at the spot on the building drawing says exactly
 * where a photo was taken, and the point stays on the drawing afterwards as a pin, so the same
 * picture can be found back from the plan instead of from a list of file names.
 */
export type DrawingLocation = {
  fileId: string;
  fileName: string;
  pageNumber: number;
  xRatio: number;
  yRatio: number;
};

const supportedDrawingMimeTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/**
 * The drawings that can be pointed at, with the ones of the building you are standing in
 * first. A photo is not always taken in the building whose drawings were uploaded last,
 * and a picker that shows one drawing and calls it "the" drawing is exactly what the
 * client ran into: "bij point on drawing moet ik een tekening kunnen kiezen".
 */
export function pickableDrawings(files: FileRecord[], buildingId: string) {
  return files
    .filter((file) =>
      file.category === "drawing"
      && file.status === "available"
      && supportedDrawingMimeTypes.includes(file.mime_type))
    .sort((left, right) => {
      const rank = (file: FileRecord) => (buildingId && file.building_id === buildingId ? 0 : file.building_id ? 2 : 1);
      return rank(left) - rank(right) || left.original_name.localeCompare(right.original_name);
    });
}

/** How the chosen spot reads in the register and on the photo card. */
export function drawingLocationLabel(location: DrawingLocation, pageWord: string) {
  const name = location.fileName.replace(/\.[^.]+$/, "");
  return location.pageNumber > 1 ? `${name} · ${pageWord} ${location.pageNumber}` : name;
}

export function DrawingLocationPicker({
  drawings,
  buildings = [],
  client,
  initial,
  close,
  save,
}: {
  drawings: FileRecord[];
  /** Only to name the building a drawing belongs to, so two floor plans stay apart. */
  buildings?: BuildingOption[];
  client: SupabaseClient;
  initial?: DrawingLocation | null;
  close: () => void;
  save: (location: DrawingLocation) => void;
}) {
  const { text } = useLanguage();
  const [activeId, setActiveId] = useState(initial?.fileId ?? "");
  const activeDrawing = drawings.find((drawing) => drawing.id === activeId) ?? null;
  const [query, setQuery] = useState("");
  const [pageNumber, setPageNumber] = useState(initial?.pageNumber ?? 1);
  const [pageCount, setPageCount] = useState(1);
  const [point, setPoint] = useState<{ xRatio: number; yRatio: number } | null>(
    initial && initial.fileId === activeId ? { xRatio: initial.xRatio, yRatio: initial.yRatio } : null,
  );

  const buildingName = (drawing: FileRecord) => buildings.find((building) => building.id === drawing.building_id)?.name
    ?? text("Whole project", "Hele project");
  const term = query.trim().toLowerCase();
  const shown = term
    ? drawings.filter((drawing) => `${drawing.original_name} ${drawing.document_code ?? ""} ${buildingName(drawing)}`.toLowerCase().includes(term))
    : drawings;

  const choose = (clientX: number, clientY: number, target: HTMLElement) => {
    const normalized = normalizedImagePoint(clientX, clientY, target.getBoundingClientRect());
    setPoint({ xRatio: normalized.x, yRatio: normalized.y });
  };

  return (
    <div className="modal-backdrop" role="presentation" onPointerDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal drawing-location-modal" role="dialog" aria-modal="true" aria-labelledby="drawing-location-title">
        <header className="modal-header">
          <div>
            <h2 id="drawing-location-title">{activeDrawing
              ? text("Tap where this photo was taken", "Tik waar deze foto is genomen")
              : text("Choose the drawing first", "Kies eerst de tekening")}</h2>
            <p>{activeDrawing
              ? text("Saved as a pin on the drawing.", "Opgeslagen als pin op de tekening.")
              : text("Choose the drawing this photo belongs to.", "Kies de tekening waar deze foto bij hoort.")}</p>
          </div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>

        <div className="modal-body drawing-location-body">
          {/* Choosing comes first. The picker used to open straight on whichever drawing
              happened to be first in the list, and called it the location of the photo. */}
          {!activeDrawing ? (
            <div className="drawing-choice-list">
              {drawings.length > 4 ? (
                <label className="drawing-choice-search">
                  <Search size={15} />
                  <span className="sr-only">{text("Search drawings", "Zoek tekeningen")}</span>
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text("Search name, code or building", "Zoek naam, code of gebouw")} />
                </label>
              ) : null}
              {shown.map((drawing) => (
                <button
                  type="button"
                  onClick={() => { setActiveId(drawing.id); setPageNumber(1); setPoint(null); }}
                  key={drawing.id}
                >
                  <span className="drawing-choice-icon"><FileText size={18} /></span>
                  <span>
                    <strong>{drawing.original_name.replace(/\.[^.]+$/, "")}</strong>
                    <small>{buildingName(drawing)} · {drawing.mime_type === "application/pdf" ? "PDF" : text("Image", "Afbeelding")}{drawing.document_code ? ` · ${drawing.document_code}` : ""}</small>
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))}
              {!shown.length ? <p className="form-intro">{text("No drawing matches this search.", "Geen tekening gevonden met deze zoekterm.")}</p> : null}
            </div>
          ) : (
            <>
              <div className="drawing-location-chosen">
                <span><strong>{activeDrawing.original_name.replace(/\.[^.]+$/, "")}</strong><small>{buildingName(activeDrawing)}{activeDrawing.document_code ? ` · ${activeDrawing.document_code}` : ""}</small></span>
                {drawings.length > 1 ? (
                  <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={() => { setActiveId(""); setPoint(null); setPageNumber(1); }}>
                    <ChevronLeft size={15} /> {text("Choose another drawing", "Andere tekening kiezen")}
                  </button>
                ) : null}
              </div>

              <DrawingPointCanvas
                key={`${activeDrawing.id}-${pageNumber}`}
                file={activeDrawing}
                pageNumber={pageNumber}
                client={client}
                point={point}
                onPageCount={setPageCount}
                onPoint={choose}
              />

              {pageCount > 1 ? (
                <div className="drawing-location-pages">
                  <button type="button" disabled={pageNumber <= 1} onClick={() => { setPageNumber(pageNumber - 1); setPoint(null); }} aria-label={text("Previous page", "Vorige pagina")}><ChevronLeft size={17} /></button>
                  <span>{text(`Page ${pageNumber} of ${pageCount}`, `Pagina ${pageNumber} van ${pageCount}`)}</span>
                  <button type="button" disabled={pageNumber >= pageCount} onClick={() => { setPageNumber(pageNumber + 1); setPoint(null); }} aria-label={text("Next page", "Volgende pagina")}><ChevronRight size={17} /></button>
                </div>
              ) : null}
            </>
          )}
        </div>

        <footer className="modal-actions">
          <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={close}>{text("Cancel", "Annuleren")}</button>
          <button
            className="ui-button ui-button--primary ui-button--md"
            type="button"
            disabled={!point || !activeDrawing}
            onClick={() => point && activeDrawing && save({
              fileId: activeDrawing.id,
              fileName: activeDrawing.original_name,
              pageNumber,
              xRatio: point.xRatio,
              yRatio: point.yRatio,
            })}
          ><Check size={15} /> {text("Use this spot", "Gebruik deze plek")}</button>
        </footer>
      </section>
    </div>
  );
}

function DrawingPointCanvas({ file, pageNumber, client, point, onPageCount, onPoint }: {
  file: FileRecord;
  pageNumber: number;
  client: SupabaseClient;
  point: { xRatio: number; yRatio: number } | null;
  onPageCount: (count: number) => void;
  onPoint: (clientX: number, clientY: number, target: HTMLElement) => void;
}) {
  const { text } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const pointerStartRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aspectRatio, setAspectRatio] = useState("4 / 3");
  const [surfaceWidth, setSurfaceWidth] = useState(0);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const measure = () => setSurfaceWidth(Math.max(1, Math.round(surface.getBoundingClientRect().width)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(surface);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    void loadProjectFilePreviewObjectUrl(client, file.id).then((preview) => {
      objectUrl = preview.url;
      if (active) {
        setPreviewUrl(preview.url);
        setMimeType(preview.mimeType);
      } else URL.revokeObjectURL(preview.url);
    }).catch((caught: unknown) => {
      if (active) {
        setLoading(false);
        setError(caught instanceof Error ? caught.message : text("Drawing could not be loaded.", "Tekening kon niet worden geladen."));
      }
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [client, file.id, text]);

  useEffect(() => {
    if (!previewUrl || mimeType !== "application/pdf" || !canvasRef.current || !surfaceWidth) return;
    let cancelled = false;
    let loadingTask: { destroy: () => Promise<void> } | null = null;
    let renderTask: { promise: Promise<void>; cancel: () => void } | null = null;
    setLoading(true);
    setError("");
    void import("pdfjs-dist").then(async (pdfjs) => {
      if (cancelled) return;
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const task = pdfjs.getDocument({ url: previewUrl });
      loadingTask = task;
      const pdf = await task.promise;
      if (cancelled) return;
      onPageCount(pdf.numPages);
      const page = await pdf.getPage(pageNumber);
      const naturalViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: surfaceWidth / naturalViewport.width });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
      setAspectRatio(`${viewport.width} / ${viewport.height}`);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Drawing canvas is unavailable.");
      renderTask = page.render({ canvas, canvasContext: context, viewport, transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0] });
      await renderTask.promise;
      if (!cancelled) setLoading(false);
    }).catch((caught: unknown) => {
      if (!cancelled && !(caught instanceof Error && caught.name === "RenderingCancelledException")) {
        setLoading(false);
        setError(caught instanceof Error ? caught.message : text("PDF page could not be rendered.", "PDF-pagina kon niet worden weergegeven."));
      }
    });
    return () => {
      cancelled = true;
      renderTask?.cancel();
      void loadingTask?.destroy().catch(() => undefined);
    };
  }, [mimeType, onPageCount, pageNumber, previewUrl, surfaceWidth, text]);

  if (error) return <div className="visual-load-state error"><AlertTriangle size={21} /> {error}</div>;

  return (
    <div className="drawing-canvas-frame drawing-location-frame">
      <div
        ref={surfaceRef}
        className="drawing-canvas-surface"
        style={{ aspectRatio }}
        role="button"
        tabIndex={0}
        aria-label={text("Drawing. Tap the spot where the photo was taken.", "Tekening. Tik op de plek waar de foto is genomen.")}
        onPointerDown={(event) => {
          if (loading || !event.isPrimary || event.button !== 0) return;
          pointerStartRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={(event) => {
          const start = pointerStartRef.current;
          pointerStartRef.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          if (loading || !start || start.id !== event.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
          onPoint(event.clientX, event.clientY, event.currentTarget);
        }}
        onPointerCancel={() => { pointerStartRef.current = null; }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          const bounds = event.currentTarget.getBoundingClientRect();
          onPoint(bounds.left + (bounds.width / 2), bounds.top + (bounds.height / 2), event.currentTarget);
        }}
      >
        {mimeType === "application/pdf" ? <canvas ref={canvasRef} /> : previewUrl ? (
          // A stored drawing is fetched as a blob, which cannot pass through the image optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={file.original_name}
            onLoad={(event) => { setAspectRatio(`${event.currentTarget.naturalWidth} / ${event.currentTarget.naturalHeight}`); setLoading(false); onPageCount(1); }}
            onError={() => { setLoading(false); setError(text("Drawing image could not be displayed.", "De tekeningafbeelding kon niet worden weergegeven.")); }}
          />
        ) : null}
        {point ? <span className="drawing-pin pending" style={{ left: `${point.xRatio * 100}%`, top: `${point.yRatio * 100}%` }}><MapPin size={13} /></span> : null}
        {loading ? <div className="drawing-loading"><Loader2 className="spin" size={22} /> {text("Rendering secured drawing…", "Beveiligde tekening wordt weergegeven…")}</div> : null}
      </div>
    </div>
  );
}
