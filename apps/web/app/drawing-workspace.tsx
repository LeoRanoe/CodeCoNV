"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AlertTriangle,
  Camera,
  Cloud,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileQuestion,
  FileText,
  FileUp,
  Image as ImageIcon,
  Link2,
  Loader2,
  MapPin,
  MousePointer2,
  PenLine,
  Plus,
  ShieldCheck,
  Type,
  ArrowUpRight,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BuildingPicker, resolveDefaultBuildingId, type BuildingOption } from "@/app/building-picker";
import { appendDictation, DictateButton } from "@/app/dictate-button";
import { useLanguage } from "@/lib/i18n";
import { loadProjectFilePreviewObjectUrl, uploadProjectFile } from "@/lib/storage/gateway";
import {
  createDrawingMarkup,
  createDrawingPin,
  type DrawingMarkup,
  type DrawingPin,
  type FileRecord,
  type NormalizedPoint,
  type OperationSnapshot,
} from "@/lib/supabase/operations";

type DrawingWorkspaceProps = {
  data: OperationSnapshot;
  projectId: string;
  buildingId: string;
  buildings: BuildingOption[];
  client: SupabaseClient;
  busy: boolean;
  run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>;
  onOpenLinkedRecord: (recordType: DrawingPin["linked_record_type"], recordId: string) => void;
};

type PinPoint = { xRatio: number; yRatio: number };
type DrawingTool = "pin" | DrawingMarkup["markup_type"];

type LinkOption = {
  id: string;
  number: string;
  title: string;
  meta: string;
};

const supportedDrawingMimeTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const dwgMimeTypes = ["application/octet-stream", "application/acad", "application/dwg", "application/x-acad", "image/vnd.dwg"];

function isDwgFile(file: { name?: string; original_name?: string; type?: string; mime_type?: string }) {
  const name = file.name ?? file.original_name ?? "";
  const mimeType = file.type ?? file.mime_type ?? "";
  return name.toLowerCase().endsWith(".dwg") && (dwgMimeTypes.includes(mimeType) || !mimeType);
}

const linkTypeLabels: Record<DrawingPin["linked_record_type"], { en: string; nl: string }> = {
  rfi: { en: "Link an RFI", nl: "Koppel een RFI" },
  submittal: { en: "Link a submittal", nl: "Koppel een submittal" },
  document: { en: "Link a document", nl: "Koppel een document" },
  observation: { en: "Link an observation / NCR", nl: "Koppel een observatie / NCR" },
  inspection: { en: "Link an inspection", nl: "Koppel een inspectie" },
  visual: { en: "Link a photo / 360° camera image", nl: "Koppel een foto / 360°-camerabeeld" },
};

const pinTypeClass: Record<DrawingPin["linked_record_type"], string> = {
  rfi: "red",
  submittal: "orange",
  document: "blue",
  observation: "purple",
  inspection: "green",
  visual: "cyan",
};

export function DrawingWorkspace({ data, projectId, buildingId, buildings, client, busy, run, onOpenLinkedRecord }: DrawingWorkspaceProps) {
  const { language, text } = useLanguage();
  const maxFileSizeBytes = (data.settings?.max_file_size_mb ?? 25) * 1024 * 1024;
  const drawings = data.files.filter((file) => file.category === "drawing" && file.status === "available" && supportedDrawingMimeTypes.includes(file.mime_type));
  const dwgSources = data.files.filter((file) => file.category === "drawing" && file.status === "available" && isDwgFile(file));
  const [activeDrawingId, setActiveDrawingId] = useState(drawings[0]?.id ?? "");
  const activeDrawing = drawings.find((file) => file.id === activeDrawingId) ?? drawings[0] ?? null;
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [point, setPoint] = useState<PinPoint | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [linkType, setLinkType] = useState<DrawingPin["linked_record_type"]>("rfi");
  const [linkedRecordId, setLinkedRecordId] = useState("");
  const [note, setNote] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [tool, setTool] = useState<DrawingTool>("pin");
  const [markupColor, setMarkupColor] = useState("#D92D20");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [markupText, setMarkupText] = useState("");
  const [uploadBuildingId, setUploadBuildingId] = useState(() => resolveDefaultBuildingId(buildings, buildingId));

  const activePins = activeDrawing
    ? data.drawingPins.filter((pin) => pin.drawing_file_id === activeDrawing.id && pin.page_number === pageNumber && pin.status === "active")
    : [];
  const selectedPin = data.drawingPins.find((pin) => pin.id === selectedPinId) ?? null;
  const activeMarkups = activeDrawing
    ? data.drawingMarkups.filter((markup) => markup.drawing_file_id === activeDrawing.id && markup.page_number === pageNumber && markup.status === "active")
    : [];

  const linkOptions = useMemo<LinkOption[]>(() => {
    if (linkType === "rfi" || linkType === "submittal") {
      return data.registerEntries
        .filter((entry) => entry.register_type === linkType)
        .map((entry) => ({ id: entry.id, number: entry.entry_number, title: entry.title, meta: entry.status }));
    }
    if (linkType === "document") {
      const registerDocuments = data.registerEntries
        .filter((entry) => entry.register_type === "document")
        .map((entry) => ({ id: entry.id, number: entry.entry_number, title: entry.title, meta: entry.status }));
      const projectFiles = data.files
        .filter((file) => file.status === "available" && ["document", "certificate"].includes(file.category))
        .map((file) => ({ id: file.id, number: "FILE", title: file.original_name, meta: file.category }));
      return [...registerDocuments, ...projectFiles];
    }
    if (linkType === "observation") {
      return data.findings.map((finding) => ({ id: finding.id, number: finding.finding_number, title: finding.title, meta: `${finding.finding_type} · ${finding.status}` }));
    }
    if (linkType === "inspection") {
      return data.inspections.map((inspection) => ({ id: inspection.id, number: inspection.inspection_number, title: inspection.title, meta: inspection.status }));
    }
    return data.visualCaptures
      .filter((capture) => capture.status === "active")
      .map((capture) => ({ id: capture.id, number: capture.capture_type === "panorama" ? "360" : "PHOTO", title: capture.title, meta: capture.location_label }));
  }, [data.files, data.findings, data.inspections, data.registerEntries, data.visualCaptures, linkType]);
  const selectedRecordId = linkOptions.some((option) => option.id === linkedRecordId) ? linkedRecordId : linkOptions[0]?.id ?? "";

  const selectDrawing = (drawingId: string) => {
    setActiveDrawingId(drawingId);
    setPageNumber(1);
    setPageCount(1);
    setPoint(null);
    setSelectedPinId(null);
  };

  const uploadDrawing = async () => {
    if (!uploadFile || uploadFile.size > maxFileSizeBytes || (!supportedDrawingMimeTypes.includes(uploadFile.type) && !isDwgFile(uploadFile))) return;
    const okay = await run(
      () => uploadProjectFile(client, { projectId, buildingId: uploadBuildingId, category: "drawing", file: uploadFile, onProgress: setUploadProgress }),
      text("Drawing uploaded securely. Open it here to place project links.", "Tekening veilig geüpload. Open deze hier om projectkoppelingen te plaatsen."),
    );
    if (okay) {
      setUploadFile(null);
      setUploadProgress(0);
    }
  };

  const savePin = async () => {
    if (!activeDrawing || !point || !selectedRecordId) return;
    const okay = await run(
      () => createDrawingPin(client, {
        drawingFileId: activeDrawing.id,
        pageNumber,
        xRatio: point.xRatio,
        yRatio: point.yRatio,
        linkedRecordType: linkType,
        linkedRecordId: selectedRecordId,
        note,
      }),
      text("The drawing location and project record are now linked and auditable.", "De tekenlocatie en het projectrecord zijn nu gekoppeld en auditeerbaar."),
    );
    if (okay) {
      setPoint(null);
      setNote("");
    }
  };

  const saveMarkup = async (geometry: DrawingMarkup["geometry"]) => {
    if (!activeDrawing || tool === "pin") return false;
    return run(
      () => createDrawingMarkup(client, {
        drawingFileId: activeDrawing.id,
        pageNumber,
        markupType: tool,
        geometry,
        color: markupColor,
        strokeWidth,
        textContent: tool === "text" ? markupText.trim() : undefined,
      }),
      text("Markup saved as an audited drawing overlay.", "Markering als geaudite tekenlaag opgeslagen."),
    );
  };

  return (
    <section className="drawing-workspace-shell">
      <div className="visual-toolbar">
        <div>
          <span className="record-number">{text("Drawings workspace", "Tekeningenwerkruimte")}</span>
          <h2>{text("Pins that open the exact project record", "Pins die het juiste projectrecord openen")}</h2>
          <p>{text("Upload a PDF or drawing image, choose a page and link an exact location to an RFI, submittal, document, observation, inspection or site image.", "Upload een PDF of tekeningsafbeelding, kies een pagina en koppel een exacte locatie aan een RFI, submittal, document, observatie, inspectie of terreinbeeld.")}</p>
        </div>
      </div>

      <div className="drawing-upload-strip">
        <BuildingPicker id="drawing-upload-building" buildings={buildings} value={uploadBuildingId} onChange={setUploadBuildingId} />
        <label className="form-field">
          <span>{text(`New drawing · DWG source, PDF, JPEG, PNG or WebP · max. ${data.settings?.max_file_size_mb ?? 25} MB`, `Nieuwe tekening · DWG-bron, PDF, JPEG, PNG of WebP · max. ${data.settings?.max_file_size_mb ?? 25} MB`)}</span>
          <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp,.dwg,.pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
        </label>
        <button className="primary-button" type="button" disabled={busy || !uploadFile || uploadFile.size > maxFileSizeBytes || (!supportedDrawingMimeTypes.includes(uploadFile.type) && !isDwgFile(uploadFile))} onClick={() => void uploadDrawing()}>
          {busy ? <Loader2 className="spin" size={15} /> : <FileUp size={15} />} {text("Upload drawing", "Tekening uploaden")}
        </button>
        {uploadFile && uploadFile.size > maxFileSizeBytes ? <p className="field-error">{text("This drawing exceeds the project file limit.", "Deze tekening is groter dan de bestandslimiet van het project.")}</p> : null}
        {uploadProgress > 0 ? <div className="upload-progress" aria-label={`${text("Upload", "Upload")} ${uploadProgress}%`}><span style={{ width: `${uploadProgress}%` }} /><small>{uploadProgress}%</small></div> : null}
      </div>

      {dwgSources.length ? <div className="operation-alert"><FileText size={18} /><div><strong>{text(`${dwgSources.length} native DWG source file(s) retained`, `${dwgSources.length} native DWG-bronbestand(en) bewaard`)}</strong><span>{text("DWG is stored and downloadable as the contractual source. Upload its controlled PDF export beside it for browser markup and pins.", "DWG wordt als contractueel bronbestand opgeslagen en is downloadbaar. Upload daarnaast de gecontroleerde PDF-export voor markeringen en pins in de browser.")}</span></div></div> : null}

      {drawings.length && activeDrawing ? (
        <div className="drawing-workspace-grid">
          <aside className="drawing-file-list" aria-label={text("Drawing list", "Tekeningenlijst") }>
            {drawings.map((drawing) => {
              const pinCount = data.drawingPins.filter((pin) => pin.drawing_file_id === drawing.id && pin.status === "active").length;
              return (
                <button type="button" className={drawing.id === activeDrawing.id ? "active" : ""} onClick={() => selectDrawing(drawing.id)} key={drawing.id}>
                  <span className="visual-list-icon">{drawing.mime_type === "application/pdf" ? <FileText size={17} /> : <ImageIcon size={17} />}</span>
                  <span><strong>{drawing.original_name}</strong><small>{pinCount} {text(pinCount === 1 ? "linked pin" : "linked pins", pinCount === 1 ? "gekoppelde pin" : "gekoppelde pins")}</small></span>
                </button>
              );
            })}
          </aside>

          <div className="drawing-stage-column">
            <div className="drawing-stage-header">
              <div><span className="record-number">{activeDrawing.mime_type === "application/pdf" ? "PDF" : text("Drawing image", "Tekeningsafbeelding")}</span><h2>{activeDrawing.original_name}</h2></div>
              <div className="tour-controls">
                <button type="button" aria-label={text("Previous page", "Vorige pagina")} disabled={pageNumber <= 1} onClick={() => { setPageNumber((page) => Math.max(1, page - 1)); setPoint(null); }}><ChevronLeft size={17} /></button>
                <span>{pageNumber} / {pageCount}</span>
                <button type="button" aria-label={text("Next page", "Volgende pagina")} disabled={pageNumber >= pageCount} onClick={() => { setPageNumber((page) => Math.min(pageCount, page + 1)); setPoint(null); }}><ChevronRight size={17} /></button>
              </div>
            </div>
            <div className="drawing-markup-toolbar" role="toolbar" aria-label={text("Drawing and linking tools", "Teken- en koppelingstools")}>
              {([
                ["pin", MapPin, text("Link pin", "Koppelpin")],
                ["freehand", PenLine, text("Freehand", "Vrij tekenen")],
                ["cloud", Cloud, text("Revision cloud", "Revisiewolk")],
                ["arrow", ArrowUpRight, text("Arrow", "Pijl")],
                ["text", Type, "Tekst"],
              ] as Array<[DrawingTool, typeof MapPin, string]>).map(([id, Icon, label]) => (
                <button type="button" className={tool === id ? "active" : ""} aria-pressed={tool === id} onClick={() => { setTool(id); setPoint(null); setSelectedPinId(null); }} key={id}><Icon size={15} /> {label}</button>
              ))}
              <label className="drawing-color-control"><span>{text("Color", "Kleur")}</span><input type="color" value={markupColor} onChange={(event) => setMarkupColor(event.target.value.toUpperCase())} /></label>
              <label className="drawing-stroke-control"><span>{text("Line", "Lijn")}</span><select value={strokeWidth} onChange={(event) => setStrokeWidth(Number(event.target.value))}><option value={2}>2 px</option><option value={3}>3 px</option><option value={5}>5 px</option><option value={8}>8 px</option></select></label>
              {tool === "text" ? <label className="drawing-text-control"><span>{text("Text to place", "Te plaatsen tekst")}</span><input maxLength={500} value={markupText} onChange={(event) => setMarkupText(event.target.value)} placeholder={text("Type the drawing note", "Typ de tekeningnotitie")} /></label> : null}
            </div>
            <DrawingCanvas
              key={activeDrawing.id}
              file={activeDrawing}
              pageNumber={pageNumber}
              pins={activePins}
              markups={activeMarkups}
              pendingPoint={point}
              tool={tool}
              color={markupColor}
              strokeWidth={strokeWidth}
              textContent={markupText}
              client={client}
              onPageCount={(count) => { setPageCount(count); setPageNumber((page) => Math.min(page, count)); }}
              onPoint={(nextPoint) => { setPoint(nextPoint); setSelectedPinId(null); }}
              onSelectPin={(pinId) => { setSelectedPinId(pinId); setPoint(null); }}
              onCreateMarkup={saveMarkup}
            />
            <div className="visual-stage-help">{tool === "pin" ? <MapPin size={15} /> : <MousePointer2 size={15} />}<span>{tool === "pin" ? text("Click the exact drawing location, then choose the record to link. Pins use normalized coordinates and remain correctly positioned when the drawing scales.", "Klik op de exacte locatie in de tekening en kies daarna het te koppelen record. Pins gebruiken genormaliseerde coördinaten en blijven correct staan wanneer de tekening schaalt.") : text("Draw directly over the secured preview. Freehand lines, clouds, arrows and text are stored as normalized, auditable overlays without changing the original.", "Teken direct over de beveiligde weergave. Vrije lijnen, wolken, pijlen en tekst worden genormaliseerd en geaudit opgeslagen zonder het origineel te wijzigen.")}</span></div>
          </div>

          <aside className="drawing-link-panel">
            {point ? (
              <div className="drawing-link-form">
                <div><span className="record-number">{text("Link item", "Item koppelen")}</span><h2>{text("Select item to be linked", "Selecteer het te koppelen item")}</h2><p>X {Math.round(point.xRatio * 100)}% · Y {Math.round(point.yRatio * 100)}% · {text("page", "pagina")} {pageNumber}</p></div>
                <div className="drawing-link-types">
                  {(Object.keys(linkTypeLabels) as Array<DrawingPin["linked_record_type"]>).map((type) => (
                    <button type="button" className={linkType === type ? "active" : ""} onClick={() => { setLinkType(type); setLinkedRecordId(""); }} key={type}>
                      {type === "visual" ? <Camera size={15} /> : type === "inspection" ? <ClipboardCheck size={15} /> : type === "observation" ? <AlertTriangle size={15} /> : type === "document" ? <FileText size={15} /> : <FileQuestion size={15} />}
                      {linkTypeLabels[type][language]}
                    </button>
                  ))}
                </div>
                {linkOptions.length ? (
                  <label className="form-field"><span>{text("Project record", "Projectrecord")}</span><select value={selectedRecordId} onChange={(event) => setLinkedRecordId(event.target.value)}>{linkOptions.map((option) => <option value={option.id} key={option.id}>{option.number} · {option.title} · {option.meta}</option>)}</select></label>
                ) : <div className="operation-alert warning"><AlertTriangle size={18} /><div><strong>{text("No records available for this type", "Geen records van dit type beschikbaar")}</strong><span>{text("Create the record in the appropriate project register first.", "Maak het record eerst aan in het bijbehorende projectregister.")}</span></div></div>}
                <details className="optional-text-entry">
                  <summary>{text("Add an exceptional pin note", "Uitzonderlijke pinnotitie toevoegen")}</summary>
                  <label className="form-field"><span>{text("Pin note · optional", "Notitie bij pin · optioneel")}</span><textarea rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} /><DictateButton onText={(transcript) => setNote((current) => appendDictation(current, transcript))} /></label>
                </details>
                <div className="button-row"><button className="secondary-button" type="button" onClick={() => setPoint(null)}>{text("Cancel", "Annuleren")}</button><button className="primary-button" type="button" disabled={busy || !selectedRecordId} onClick={() => void savePin()}><Link2 size={15} /> {text("Create link", "Koppeling maken")}</button></div>
              </div>
            ) : selectedPin ? <DrawingPinDetails pin={selectedPin} onOpen={() => onOpenLinkedRecord(selectedPin.linked_record_type, selectedPin.linked_record_id)} /> : (
              <div className="visual-panel-empty"><MapPin size={24} /><strong>{text("Place or select a drawing pin", "Plaats of selecteer een tekeningspin")}</strong><span>{text("Every pin keeps its page, exact position and record identity in the audit trail.", "Elke pin bewaart pagina, exacte positie en recordidentiteit in het auditspoor.")}</span></div>
            )}
          </aside>
        </div>
      ) : (
        <div className="empty-list-state visual-empty"><FileUp size={24} /><strong>{text("No previewable drawing yet", "Nog geen bekijkbare tekening")}</strong><span>{text("Upload a PDF or drawing image to start placing linked project records.", "Upload een PDF of tekeningsafbeelding om gekoppelde projectrecords te plaatsen.")}</span></div>
      )}

      <div className="operation-alert"><ShieldCheck size={18} /><div><strong>{text("Original drawing remains unchanged", "Originele tekening blijft ongewijzigd")}</strong><span>{text("Links are stored as a separate audited overlay. DWG source files should be retained in Files and exported to PDF for browser review and pinning.", "Koppelingen worden als afzonderlijke, geaudite overlay opgeslagen. Bewaar DWG-bronbestanden bij Bestanden en exporteer ze naar PDF voor browsercontrole en pins.")}</span></div></div>
    </section>
  );
}

function DrawingCanvas({ file, pageNumber, pins, markups, pendingPoint, tool, color, strokeWidth, textContent, client, onPageCount, onPoint, onSelectPin, onCreateMarkup }: {
  file: FileRecord;
  pageNumber: number;
  pins: DrawingPin[];
  markups: DrawingMarkup[];
  pendingPoint: PinPoint | null;
  tool: DrawingTool;
  color: string;
  strokeWidth: number;
  textContent: string;
  client: SupabaseClient;
  onPageCount: (count: number) => void;
  onPoint: (point: PinPoint) => void;
  onSelectPin: (pinId: string) => void;
  onCreateMarkup: (geometry: DrawingMarkup["geometry"]) => Promise<boolean>;
}) {
  const { text } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aspectRatio, setAspectRatio] = useState("4 / 3");
  const [draftPoints, setDraftPoints] = useState<NormalizedPoint[]>([]);
  const drawingRef = useRef(false);
  const draftPointsRef = useRef<NormalizedPoint[]>([]);

  const updateDraftPoints = (points: NormalizedPoint[]) => {
    draftPointsRef.current = points;
    setDraftPoints(points);
  };

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
      if (active) setError(caught instanceof Error ? caught.message : text("Drawing could not be loaded.", "Tekening kon niet worden geladen."));
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

  const placePoint = (clientX: number, clientY: number, target: HTMLElement) => {
    const bounds = target.getBoundingClientRect();
    onPoint({
      xRatio: Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width)),
      yRatio: Math.min(1, Math.max(0, (clientY - bounds.top) / bounds.height)),
    });
  };

  const normalizedPoint = (clientX: number, clientY: number, target: HTMLElement): NormalizedPoint => {
    const bounds = target.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (clientY - bounds.top) / bounds.height)),
    };
  };

  const beginMarkup = (event: React.PointerEvent<HTMLDivElement>) => {
    if (tool === "pin") return;
    event.preventDefault();
    const start = normalizedPoint(event.clientX, event.clientY, event.currentTarget);
    if (tool === "text") {
      if (textContent.trim()) void onCreateMarkup({ position: start });
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    updateDraftPoints([start]);
  };

  const continueMarkup = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current || tool === "pin" || tool === "text") return;
    const point = normalizedPoint(event.clientX, event.clientY, event.currentTarget);
    const points = draftPointsRef.current;
    updateDraftPoints(tool === "arrow" ? [points[0], point] : [...points, point]);
  };

  const finishMarkup = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current || tool === "pin" || tool === "text") return;
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    drawingRef.current = false;
    const finalPoint = normalizedPoint(event.clientX, event.clientY, event.currentTarget);
    const currentPoints = draftPointsRef.current;
    const points = tool === "arrow" ? [currentPoints[0], finalPoint].filter(Boolean) : [...currentPoints, finalPoint];
    updateDraftPoints([]);
    if (points.length < 2) return;
    void onCreateMarkup(tool === "arrow" ? { start: points[0], end: points[points.length - 1] } : { points });
  };

  return (
    <div className="drawing-canvas-frame">
      {error ? <div className="visual-load-state error"><AlertTriangle size={21} /> {error}</div> : null}
      {!error ? (
        <div
          className="drawing-canvas-surface"
          style={{ aspectRatio }}
          role="button"
          tabIndex={0}
          aria-label={text("Drawing. Click to place a linked pin.", "Tekening. Klik om een gekoppelde pin te plaatsen.")}
          onClick={(event) => { if (tool === "pin") placePoint(event.clientX, event.clientY, event.currentTarget); }}
          onKeyDown={(event) => { if (tool === "pin" && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onPoint({ xRatio: 0.5, yRatio: 0.5 }); } }}
          onPointerDown={beginMarkup}
          onPointerMove={continueMarkup}
          onPointerUp={finishMarkup}
          onPointerCancel={() => { drawingRef.current = false; updateDraftPoints([]); }}
        >
          {mimeType === "application/pdf" ? <canvas ref={canvasRef} /> : previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={file.original_name} onLoad={(event) => { setAspectRatio(`${event.currentTarget.naturalWidth} / ${event.currentTarget.naturalHeight}`); setLoading(false); onPageCount(1); }} onError={() => { setLoading(false); setError(text("Drawing image could not be displayed.", "De tekeningafbeelding kon niet worden weergegeven.")); }} />
          ) : null}
          <svg className="drawing-markup-layer" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
            <defs><marker id={`drawing-arrow-${file.id}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="context-stroke" /></marker></defs>
            {markups.map((markup) => <MarkupShape markup={markup} arrowMarkerId={`drawing-arrow-${file.id}`} key={markup.id} />)}
            {draftPoints.length > 1 ? tool === "arrow" ? <line x1={draftPoints[0].x * 1000} y1={draftPoints[0].y * 1000} x2={draftPoints[draftPoints.length - 1].x * 1000} y2={draftPoints[draftPoints.length - 1].y * 1000} stroke={color} strokeWidth={strokeWidth * 2.5} vectorEffect="non-scaling-stroke" markerEnd={`url(#drawing-arrow-${file.id})`} /> : <polyline points={draftPoints.map((point) => `${point.x * 1000},${point.y * 1000}`).join(" ")} fill="none" stroke={color} strokeWidth={strokeWidth * 2.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={tool === "cloud" ? "1 10" : undefined} vectorEffect="non-scaling-stroke" /> : null}
          </svg>
          {pins.map((pin, index) => <button className={`drawing-pin ${pinTypeClass[pin.linked_record_type]}`} style={{ left: `${Number(pin.x_ratio) * 100}%`, top: `${Number(pin.y_ratio) * 100}%` }} type="button" aria-label={`${pin.linked_record_number} · ${pin.linked_record_title}`} onClick={(event) => { event.stopPropagation(); onSelectPin(pin.id); }} key={pin.id}><span>{index + 1}</span></button>)}
          {pendingPoint ? <span className="drawing-pin pending" style={{ left: `${pendingPoint.xRatio * 100}%`, top: `${pendingPoint.yRatio * 100}%` }}><Plus size={13} /></span> : null}
          {loading ? <div className="drawing-loading"><Loader2 className="spin" size={22} /> {text("Rendering secured drawing…", "Beveiligde tekening wordt weergegeven…")}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

function MarkupShape({ markup, arrowMarkerId }: { markup: DrawingMarkup; arrowMarkerId: string }) {
  const width = Number(markup.stroke_width) * 2.5;
  if ((markup.markup_type === "freehand" || markup.markup_type === "cloud") && markup.geometry.points?.length) {
    return <polyline points={markup.geometry.points.map((point) => `${point.x * 1000},${point.y * 1000}`).join(" ")} fill="none" stroke={markup.color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={markup.markup_type === "cloud" ? "1 10" : undefined} vectorEffect="non-scaling-stroke" />;
  }
  if (markup.markup_type === "arrow" && markup.geometry.start && markup.geometry.end) {
    return <line x1={markup.geometry.start.x * 1000} y1={markup.geometry.start.y * 1000} x2={markup.geometry.end.x * 1000} y2={markup.geometry.end.y * 1000} stroke={markup.color} strokeWidth={width} vectorEffect="non-scaling-stroke" markerEnd={`url(#${arrowMarkerId})`} />;
  }
  if (markup.markup_type === "text" && markup.geometry.position && markup.text_content) {
    return <g transform={`translate(${markup.geometry.position.x * 1000} ${markup.geometry.position.y * 1000})`}><rect x="-5" y="-24" width={Math.min(600, Math.max(110, markup.text_content.length * 14))} height="34" rx="5" fill="white" fillOpacity=".92" stroke={markup.color} strokeWidth="2" vectorEffect="non-scaling-stroke" /><text x="4" y="0" fill={markup.color} fontSize="24" fontWeight="700">{markup.text_content}</text></g>;
  }
  return null;
}

function DrawingPinDetails({ pin, onOpen }: { pin: DrawingPin; onOpen: () => void }) {
  const { text } = useLanguage();
  return (
    <div className="visual-annotation-details">
      <span className={`visual-severity-line ${pinTypeClass[pin.linked_record_type]}`} />
      <span className="record-number">{pin.linked_record_number} · {pin.linked_record_type.replaceAll("_", " ")}</span>
      <h2>{pin.linked_record_title}</h2>
      {pin.note ? <p>{pin.note}</p> : null}
      <dl>
        <div><dt>{text("Drawing page", "Tekeningspagina")}</dt><dd>{pin.page_number}</dd></div>
        <div><dt>{text("Exact position", "Exacte positie")}</dt><dd>X {Math.round(Number(pin.x_ratio) * 100)}% · Y {Math.round(Number(pin.y_ratio) * 100)}%</dd></div>
      </dl>
      <button className="primary-button" type="button" onClick={onOpen}><ArrowUpRight size={15} /> {text("Open linked project record", "Open gekoppeld projectrecord")}</button>
      <div className="operation-alert"><Link2 size={18} /><div><strong>{text("Traceable project link", "Traceerbare projectkoppeling")}</strong><span>{text("The drawing, page, coordinate and linked record identity remain together in the audit trail.", "Tekening, pagina, coördinaat en identiteit van het gekoppelde record blijven samen in het auditspoor.")}</span></div></div>
    </div>
  );
}
