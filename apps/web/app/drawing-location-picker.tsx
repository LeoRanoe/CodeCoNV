"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { AlertTriangle, ChevronLeft, ChevronRight, Check, Loader2, MapPin, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

/** The drawings of a building that can actually be pointed at. */
export function pickableDrawings(files: FileRecord[], buildingId: string) {
  return files.filter((file) =>
    file.category === "drawing"
    && file.status === "available"
    && supportedDrawingMimeTypes.includes(file.mime_type)
    && (!file.building_id || !buildingId || file.building_id === buildingId));
}

/** How the chosen spot reads in the register and on the photo card. */
export function drawingLocationLabel(location: DrawingLocation, pageWord: string) {
  const name = location.fileName.replace(/\.[^.]+$/, "");
  return location.pageNumber > 1 ? `${name} · ${pageWord} ${location.pageNumber}` : name;
}

export function DrawingLocationPicker({
  drawings,
  client,
  initial,
  close,
  save,
}: {
  drawings: FileRecord[];
  client: SupabaseClient;
  initial?: DrawingLocation | null;
  close: () => void;
  save: (location: DrawingLocation) => void;
}) {
  const { text } = useLanguage();
  const [activeId, setActiveId] = useState(initial?.fileId ?? drawings[0]?.id ?? "");
  const activeDrawing = drawings.find((drawing) => drawing.id === activeId) ?? drawings[0] ?? null;
  const [pageNumber, setPageNumber] = useState(initial?.pageNumber ?? 1);
  const [pageCount, setPageCount] = useState(1);
  const [point, setPoint] = useState<{ xRatio: number; yRatio: number } | null>(
    initial && initial.fileId === activeId ? { xRatio: initial.xRatio, yRatio: initial.yRatio } : null,
  );

  if (!activeDrawing) return null;

  const choose = (clientX: number, clientY: number, target: HTMLElement) => {
    const normalized = normalizedImagePoint(clientX, clientY, target.getBoundingClientRect());
    setPoint({ xRatio: normalized.x, yRatio: normalized.y });
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal drawing-location-modal" role="dialog" aria-modal="true" aria-labelledby="drawing-location-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">{text("Location on the drawing", "Locatie op de tekening")}</p>
            <h2 id="drawing-location-title">{text("Tap where this photo was taken", "Tik waar deze foto is genomen")}</h2>
            <p>{text("The point is saved with the photo and stays on the drawing as a pin.", "Het punt wordt bij de foto opgeslagen en blijft als pin op de tekening staan.")}</p>
          </div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>

        <div className="modal-body drawing-location-body">
          {drawings.length > 1 ? (
            <div className="drawing-location-tabs" role="tablist" aria-label={text("Drawings", "Tekeningen")}>
              {drawings.map((drawing) => (
                <button
                  className={drawing.id === activeDrawing.id ? "active" : ""}
                  type="button"
                  role="tab"
                  aria-selected={drawing.id === activeDrawing.id}
                  onClick={() => { setActiveId(drawing.id); setPageNumber(1); setPoint(null); }}
                  key={drawing.id}
                >{drawing.original_name.replace(/\.[^.]+$/, "")}</button>
              ))}
            </div>
          ) : null}

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
        </div>

        <footer className="modal-actions">
          <button className="secondary-button" type="button" onClick={close}>{text("Cancel", "Annuleren")}</button>
          <button
            className="primary-button"
            type="button"
            disabled={!point}
            onClick={() => point && save({
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
  const [previewUrl, setPreviewUrl] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aspectRatio, setAspectRatio] = useState("4 / 3");

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
    if (!previewUrl || mimeType !== "application/pdf" || !canvasRef.current) return;
    let cancelled = false;
    let loadingTask: { destroy: () => Promise<void> } | null = null;
    void import("pdfjs-dist").then(async (pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const task = pdfjs.getDocument({ url: previewUrl });
      loadingTask = task;
      const pdf = await task.promise;
      if (cancelled) return;
      onPageCount(pdf.numPages);
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.45 });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
      setAspectRatio(`${viewport.width} / ${viewport.height}`);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Drawing canvas is unavailable.");
      await page.render({ canvas, canvasContext: context, viewport, transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0] }).promise;
      if (!cancelled) setLoading(false);
    }).catch((caught: unknown) => {
      if (!cancelled) {
        setLoading(false);
        setError(caught instanceof Error ? caught.message : text("PDF page could not be rendered.", "PDF-pagina kon niet worden weergegeven."));
      }
    });
    return () => {
      cancelled = true;
      void loadingTask?.destroy();
    };
  }, [mimeType, onPageCount, pageNumber, previewUrl, text]);

  if (error) return <div className="visual-load-state error"><AlertTriangle size={21} /> {error}</div>;

  return (
    <div className="drawing-canvas-frame drawing-location-frame">
      <div
        className="drawing-canvas-surface"
        style={{ aspectRatio }}
        role="button"
        tabIndex={0}
        aria-label={text("Drawing. Tap the spot where the photo was taken.", "Tekening. Tik op de plek waar de foto is genomen.")}
        onClick={(event) => onPoint(event.clientX, event.clientY, event.currentTarget)}
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
