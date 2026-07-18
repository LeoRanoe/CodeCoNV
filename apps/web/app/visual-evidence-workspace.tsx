"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AlertTriangle,
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Plus,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { isStorageGatewayConfigured, loadProjectFileObjectUrl, uploadProjectFile } from "@/lib/storage/gateway";
import {
  createVisualAnnotationFinding,
  createVisualCapture,
  type FileRecord,
  type Finding,
  type OperationSnapshot,
  type VisualAnnotation,
  type VisualCapture,
} from "@/lib/supabase/operations";
import type { ProjectParty } from "@/lib/supabase/data";

type VisualPoint =
  | { mode: "photo"; xRatio: number; yRatio: number }
  | { mode: "spherical"; yaw: number; pitch: number };

type VisualEvidenceWorkspaceProps = {
  data: OperationSnapshot;
  projectId: string;
  buildingId: string;
  reportId: string | null;
  parties: ProjectParty[];
  client: SupabaseClient;
  busy: boolean;
  run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>;
};

const emptyIssue = {
  findingType: "deficiency" as Finding["finding_type"],
  title: "",
  description: "",
  severity: "medium" as Finding["severity"],
  responsiblePartyId: "",
};

function degrees(value: number | null) {
  return value === null ? "—" : `${Math.round(value * (180 / Math.PI))}°`;
}

function captureFile(capture: VisualCapture, files: FileRecord[]) {
  return files.find((file) => file.id === capture.file_id) ?? null;
}

function imageDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("invalid-image"));
    };
    image.src = objectUrl;
  });
}

export function VisualEvidenceWorkspace({ data, projectId, buildingId, reportId, parties, client, busy, run }: VisualEvidenceWorkspaceProps) {
  const { text } = useLanguage();
  const maxFileSizeBytes = (data.settings?.max_file_size_mb ?? 25) * 1024 * 1024;
  const captures = data.visualCaptures.filter((capture) => capture.status === "active");
  const [activeCaptureId, setActiveCaptureId] = useState(captures[0]?.id ?? "");
  const activeCapture = captures.find((capture) => capture.id === activeCaptureId) ?? captures[0] ?? null;
  const activeFile = activeCapture ? captureFile(activeCapture, data.files) : null;
  const activeAnnotations = activeCapture ? data.visualAnnotations.filter((annotation) => annotation.capture_id === activeCapture.id && annotation.status === "active") : [];
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [captureForm, setCaptureForm] = useState({
    type: "photo" as VisualCapture["capture_type"],
    title: "",
    description: "",
    locationLabel: "",
    locationNodeId: "",
    tourName: "",
    tourOrder: "",
  });
  const [point, setPoint] = useState<VisualPoint | null>(null);
  const [issue, setIssue] = useState(emptyIssue);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  const tour = (() => {
    if (!activeCapture?.tour_name) return [];
    return captures
      .filter((capture) => capture.tour_name === activeCapture.tour_name)
      .sort((left, right) => (left.tour_order ?? 0) - (right.tour_order ?? 0));
  })();
  const tourIndex = activeCapture ? tour.findIndex((capture) => capture.id === activeCapture.id) : -1;

  const uploadCapture = async () => {
    if (!file || captureForm.title.trim().length < 3 || captureForm.locationLabel.trim().length < 2) return;
    setFileError("");
    try {
      const dimensions = await imageDimensions(file);
      if (captureForm.type === "panorama" && Math.abs((dimensions.width / dimensions.height) - 2) > 0.04) {
        setFileError(text("A 360° panorama must be a 2:1 equirectangular image.", "Een 360°-panorama moet een equirectangulair beeld met verhouding 2:1 zijn."));
        return;
      }
    } catch {
      setFileError(text("The selected file is not a readable image.", "Het gekozen bestand is geen leesbare afbeelding."));
      return;
    }
    let created: VisualCapture | null = null;
    const okay = await run(async () => {
      const uploaded = await uploadProjectFile(client, {
        projectId,
        buildingId,
        category: "photo",
        file,
        onProgress: setUploadProgress,
      });
      created = await createVisualCapture(client, {
        projectId,
        buildingId,
        dayReportId: reportId,
        fileId: uploaded.fileId,
        captureType: captureForm.type,
        title: captureForm.title,
        description: captureForm.description,
        locationLabel: captureForm.locationLabel,
        locationNodeId: captureForm.locationNodeId,
        tourName: captureForm.type === "panorama" ? captureForm.tourName : "",
        tourOrder: captureForm.type === "panorama" && captureForm.tourName ? Number(captureForm.tourOrder) : null,
      });
    }, text("Visual evidence uploaded to private storage and registered centrally.", "Visueel bewijs is privé opgeslagen en centraal geregistreerd."));
    if (okay && created) {
      setActiveCaptureId((created as VisualCapture).id);
      setCaptureForm({ type: "photo", title: "", description: "", locationLabel: "", locationNodeId: "", tourName: "", tourOrder: "" });
      setFile(null);
      setFileError("");
      setUploadProgress(0);
      setShowUpload(false);
    }
  };

  const saveIssue = async () => {
    if (!activeCapture || !point || issue.title.trim().length < 3 || issue.description.trim().length < 3) return;
    const okay = await run(
      () => createVisualAnnotationFinding(client, {
        captureId: activeCapture.id,
        coordinateMode: point.mode,
        xRatio: point.mode === "photo" ? point.xRatio : null,
        yRatio: point.mode === "photo" ? point.yRatio : null,
        yaw: point.mode === "spherical" ? point.yaw : null,
        pitch: point.mode === "spherical" ? point.pitch : null,
        findingType: issue.findingType,
        title: issue.title,
        description: issue.description,
        severity: issue.severity,
        responsiblePartyId: issue.responsiblePartyId,
      }),
      text("Issue marker and traceable finding created together.", "Probleemmarker en traceerbare bevinding zijn samen aangemaakt."),
    );
    if (okay) {
      setPoint(null);
      setIssue(emptyIssue);
    }
  };

  const chooseTourCapture = (offset: number) => {
    if (!tour.length || tourIndex < 0) return;
    const next = tour[(tourIndex + offset + tour.length) % tour.length];
    setActiveCaptureId(next.id);
    setPoint(null);
    setSelectedAnnotationId(null);
  };

  const selectedAnnotation = data.visualAnnotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null;
  const selectedFinding = selectedAnnotation ? data.findings.find((finding) => finding.id === selectedAnnotation.finding_id) ?? null : null;

  return (
    <section className="visual-evidence-shell">
      <div className="visual-toolbar">
        <div><span className="record-number">{text("Visual evidence", "Visueel bewijs")}</span><h2>{text("Photos, 360° tours and exact issue locations", "Foto’s, 360°-tours en exacte probleemlocaties")}</h2><p>{text("Standard photos are the default. Use a 360° panorama only when the source image is equirectangular.", "Gewone foto’s zijn standaard. Gebruik 360° alleen voor een equirectangulair bronbeeld.")}</p></div>
        <button className="primary-button" type="button" disabled={!isStorageGatewayConfigured} onClick={() => setShowUpload((visible) => !visible)}><Plus size={15} /> {text("Add visual", "Beeld toevoegen")}</button>
      </div>

      {!isStorageGatewayConfigured ? <div className="operation-alert warning"><ShieldCheck size={18} /><div><strong>{text("Private image storage must be connected", "Private beeldopslag moet worden gekoppeld")}</strong><span>{text("Metadata, rights and annotations are ready. Upload and viewing remain disabled until CODECO activates the secured Google Drive gateway.", "Metadata, rechten en annotaties zijn gereed. Upload en weergave blijven uit totdat CODECO de beveiligde Google Drive-gateway activeert.")}</span></div></div> : null}

      {showUpload ? (
        <div className="operation-form wide visual-upload-form">
          <div className="operation-form-heading"><div><span className="record-number">{text("New visual evidence", "Nieuw visueel bewijs")}</span><h2>{text("Upload an image", "Afbeelding uploaden")}</h2></div><span className="experimental-badge">{captureForm.type === "panorama" ? text("Experimental 360°", "Experimenteel 360°") : text("Standard", "Standaard")}</span></div>
          <div className="visual-type-picker">
            <button type="button" className={captureForm.type === "photo" ? "active" : ""} onClick={() => setCaptureForm({ ...captureForm, type: "photo", tourName: "", tourOrder: "" })}><ImageIcon size={20} /><strong>{text("Standard photo", "Gewone foto")}</strong><span>{text("Default · exact 2D issue pins", "Standaard · exacte 2D-probleempunten")}</span></button>
            <button type="button" className={captureForm.type === "panorama" ? "active" : ""} onClick={() => setCaptureForm({ ...captureForm, type: "panorama" })}><ScanLine size={20} /><strong>{text("360° panorama", "360°-panorama")}</strong><span>{text("Optional · interactive room view", "Optioneel · interactieve ruimteweergave")}</span></button>
          </div>
          <div className="form-grid-2">
            <label className="form-field"><span>{text("Title", "Titel")}</span><input value={captureForm.title} onChange={(event) => setCaptureForm({ ...captureForm, title: event.target.value })} placeholder={text("Room 1 wall inspection", "Inspectie wand kamer 1")} /></label>
            <label className="form-field"><span>{text("Room / location", "Ruimte / locatie")}</span><input value={captureForm.locationLabel} onChange={(event) => setCaptureForm({ ...captureForm, locationLabel: event.target.value })} placeholder={text("Room 1 · north wall", "Kamer 1 · noordwand")} /></label>
            <label className="form-field"><span>{text("Project location node", "Projectlocatie")}</span><select value={captureForm.locationNodeId} onChange={(event) => setCaptureForm({ ...captureForm, locationNodeId: event.target.value })}><option value="">{text("No structured location selected", "Geen gestructureerde locatie gekozen")}</option>{data.locationNodes.filter((node) => node.building_id === buildingId).map((node) => <option value={node.id} key={node.id}>{node.code} · {node.name}</option>)}</select></label>
            <label className="form-field"><span>{text(`Image · JPEG, PNG or WebP · max. ${data.settings?.max_file_size_mb ?? 25} MB`, `Afbeelding · JPEG, PNG of WebP · max. ${data.settings?.max_file_size_mb ?? 25} MB`)}</span><input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setFileError(""); }} /></label>
          </div>
          <label className="form-field"><span>{text("Context", "Context")}</span><textarea rows={2} value={captureForm.description} onChange={(event) => setCaptureForm({ ...captureForm, description: event.target.value })} /></label>
          {captureForm.type === "panorama" ? <div className="form-grid-2"><label className="form-field"><span>{text("Tour name · optional", "Tournaam · optioneel")}</span><input value={captureForm.tourName} onChange={(event) => setCaptureForm({ ...captureForm, tourName: event.target.value })} placeholder={text("Ground floor walkthrough", "Rondgang begane grond")} /></label><label className="form-field"><span>{text("Position in tour", "Volgorde in tour")}</span><input type="number" min="1" max="10000" disabled={!captureForm.tourName} value={captureForm.tourOrder} onChange={(event) => setCaptureForm({ ...captureForm, tourOrder: event.target.value })} /></label></div> : null}
          {captureForm.type === "panorama" ? <div className="operation-alert"><ScanLine size={18} /><div><strong>{text("360° source requirement", "Vereiste voor 360°-bron")}</strong><span>{text("Use a 2:1 equirectangular export from the 360° camera. Ordinary photos belong in Standard photo mode.", "Gebruik een 2:1 equirectangulaire export van de 360°-camera. Gewone foto’s horen in de standaardmodus.")}</span></div></div> : null}
          {uploadProgress > 0 ? <div className="upload-progress" aria-label={`${text("Upload", "Upload")} ${uploadProgress}%`}><span style={{ width: `${uploadProgress}%` }} /><small>{uploadProgress}%</small></div> : null}
          {file && file.size > maxFileSizeBytes ? <p className="field-error">{text("This image exceeds the project file limit.", "Deze afbeelding is groter dan de bestandslimiet van het project.")}</p> : null}
          {fileError ? <p className="field-error" role="alert">{fileError}</p> : null}
          <button className="primary-button" type="button" disabled={busy || !file || file.size > maxFileSizeBytes || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || captureForm.title.trim().length < 3 || captureForm.locationLabel.trim().length < 2 || (captureForm.type === "panorama" && Boolean(captureForm.tourName) !== Boolean(captureForm.tourOrder))} onClick={() => void uploadCapture()}>{busy ? <Loader2 className="spin" size={15} /> : <Camera size={15} />} {text("Upload securely", "Veilig uploaden")}</button>
        </div>
      ) : null}

      {captures.length ? (
        <div className="visual-workspace-grid">
          <aside className="visual-capture-list" aria-label={text("Visual evidence list", "Lijst visueel bewijs")}>
            {captures.map((capture) => {
              const count = data.visualAnnotations.filter((annotation) => annotation.capture_id === capture.id && annotation.status === "active").length;
              return <button type="button" className={activeCapture?.id === capture.id ? "active" : ""} onClick={() => { setActiveCaptureId(capture.id); setPoint(null); setSelectedAnnotationId(null); }} key={capture.id}><span className="visual-list-icon">{capture.capture_type === "panorama" ? <ScanLine size={17} /> : <ImageIcon size={17} />}</span><span><strong>{capture.title}</strong><small>{capture.location_label} · {count} {text(count === 1 ? "issue" : "issues", count === 1 ? "probleem" : "problemen")}</small></span>{capture.capture_type === "panorama" ? <em>360°</em> : null}</button>;
            })}
          </aside>
          <div className="visual-stage-column">
            {activeCapture && activeFile ? (
              <>
                <div className="visual-stage-header"><div><span className="record-number">{activeCapture.capture_type === "panorama" ? text("Interactive 360°", "Interactief 360°") : text("Annotated photo", "Geannoteerde foto")}</span><h2>{activeCapture.title}</h2><p><MapPin size={13} /> {activeCapture.location_label}{activeCapture.tour_name ? ` · ${activeCapture.tour_name}` : ""}</p></div>{tour.length > 1 ? <div className="tour-controls"><button type="button" aria-label={text("Previous panorama", "Vorig panorama")} onClick={() => chooseTourCapture(-1)}><ChevronLeft size={17} /></button><span>{tourIndex + 1} / {tour.length}</span><button type="button" aria-label={text("Next panorama", "Volgend panorama")} onClick={() => chooseTourCapture(1)}><ChevronRight size={17} /></button></div> : null}</div>
                <VisualViewer key={activeCapture.id} capture={activeCapture} file={activeFile} annotations={activeAnnotations} pendingPoint={point} client={client} onPoint={(nextPoint) => { setPoint(nextPoint); setSelectedAnnotationId(null); }} onSelectAnnotation={(annotationId) => { setSelectedAnnotationId(annotationId); setPoint(null); }} />
                <div className="visual-stage-help"><CircleDot size={15} /><span>{text("Click the exact damaged or non-conforming area to create a marker. Drag to look around a panorama; use the center-marker button for keyboard entry.", "Klik exact op de beschadiging of afwijking om een marker te maken. Sleep om rond te kijken; gebruik de middenmarkerknop voor toetsenbordbediening.")}</span></div>
              </>
            ) : null}
          </div>
          <aside className="visual-issue-panel">
            {point && activeCapture ? <IssueForm point={point} capture={activeCapture} issue={issue} setIssue={setIssue} parties={parties} busy={busy} save={() => void saveIssue()} cancel={() => { setPoint(null); setIssue(emptyIssue); }} /> : selectedAnnotation && selectedFinding ? <AnnotationDetails annotation={selectedAnnotation} finding={selectedFinding} /> : <div className="visual-panel-empty"><ScanLine size={24} /><strong>{text("Select or place a marker", "Selecteer of plaats een marker")}</strong><span>{text("The exact image position and the formal finding remain linked.", "De exacte beeldpositie en de formele bevinding blijven gekoppeld.")}</span></div>}
          </aside>
        </div>
      ) : <div className="empty-list-state visual-empty"><Camera size={24} /><strong>{text("No visual evidence yet", "Nog geen visueel bewijs")}</strong><span>{text("Start with a standard photo, or add an optional 360° panorama for an interactive room tour.", "Start met een gewone foto of voeg optioneel een 360°-panorama toe voor een interactieve ruimtetour.")}</span></div>}
    </section>
  );
}

function VisualViewer({ capture, file, annotations, pendingPoint, client, onPoint, onSelectAnnotation }: { capture: VisualCapture; file: FileRecord; annotations: VisualAnnotation[]; pendingPoint: VisualPoint | null; client: SupabaseClient; onPoint: (point: VisualPoint) => void; onSelectAnnotation: (annotationId: string) => void }) {
  const { text } = useLanguage();
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    void loadProjectFileObjectUrl(client, file.id).then((url) => {
      objectUrl = url;
      if (active) setImageUrl(url);
      else URL.revokeObjectURL(url);
    }).catch((caught: unknown) => {
      if (active) setError(caught instanceof Error ? caught.message : text("Image could not be loaded.", "Afbeelding kon niet worden geladen."));
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [client, file.id, text]);

  if (error) return <div className="visual-load-state error"><AlertTriangle size={21} /> {error}</div>;
  if (!imageUrl) return <div className="visual-load-state"><Loader2 className="spin" size={21} /> {text("Loading secured image…", "Beveiligd beeld laden…")}</div>;
  if (capture.capture_type === "panorama") return <PanoramaViewer imageUrl={imageUrl} annotations={annotations} pendingPoint={pendingPoint?.mode === "spherical" ? pendingPoint : null} onPoint={onPoint} onSelectAnnotation={onSelectAnnotation} />;
  return <PhotoAnnotationViewer imageUrl={imageUrl} title={capture.title} annotations={annotations} pendingPoint={pendingPoint?.mode === "photo" ? pendingPoint : null} onPoint={onPoint} onSelectAnnotation={onSelectAnnotation} />;
}

function PhotoAnnotationViewer({ imageUrl, title, annotations, pendingPoint, onPoint, onSelectAnnotation }: { imageUrl: string; title: string; annotations: VisualAnnotation[]; pendingPoint: Extract<VisualPoint, { mode: "photo" }> | null; onPoint: (point: VisualPoint) => void; onSelectAnnotation: (annotationId: string) => void }) {
  const { text } = useLanguage();
  const placeFromPointer = (clientX: number, clientY: number, target: HTMLElement) => {
    const bounds = target.getBoundingClientRect();
    onPoint({ mode: "photo", xRatio: Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width)), yRatio: Math.min(1, Math.max(0, (clientY - bounds.top) / bounds.height)) });
  };
  return (
    <div className="photo-annotation-stage">
      <div className="photo-annotation-canvas" role="button" tabIndex={0} aria-label={text("Photo. Click to mark an issue.", "Foto. Klik om een probleem te markeren.")} onClick={(event) => placeFromPointer(event.clientX, event.clientY, event.currentTarget)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onPoint({ mode: "photo", xRatio: 0.5, yRatio: 0.5 }); } }}>
        {/* The original aspect ratio is preserved so normalized marker coordinates stay exact. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={title} />
        {annotations.map((annotation, index) => annotation.x_ratio !== null && annotation.y_ratio !== null ? <button className={`visual-marker ${annotation.severity}`} style={{ left: `${Number(annotation.x_ratio) * 100}%`, top: `${Number(annotation.y_ratio) * 100}%` }} type="button" aria-label={`${annotation.title} · ${annotation.severity}`} onClick={(event) => { event.stopPropagation(); onSelectAnnotation(annotation.id); }} key={annotation.id}>{index + 1}</button> : null)}
        {pendingPoint ? <span className="visual-marker pending" style={{ left: `${pendingPoint.xRatio * 100}%`, top: `${pendingPoint.yRatio * 100}%` }}><Plus size={13} /></span> : null}
      </div>
      <button className="viewer-center-action" type="button" onClick={() => onPoint({ mode: "photo", xRatio: 0.5, yRatio: 0.5 })}><CircleDot size={15} /> {text("Place marker at image center", "Plaats marker in midden")}</button>
    </div>
  );
}

function PanoramaViewer({ imageUrl, annotations, pendingPoint, onPoint, onSelectAnnotation }: { imageUrl: string; annotations: VisualAnnotation[]; pendingPoint: Extract<VisualPoint, { mode: "spherical" }> | null; onPoint: (point: VisualPoint) => void; onSelectAnnotation: (annotationId: string) => void }) {
  const { text } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<import("@photo-sphere-viewer/core").Viewer | null>(null);
  const markersRef = useRef<import("@photo-sphere-viewer/markers-plugin").MarkersPlugin | null>(null);
  const onPointRef = useRef(onPoint);
  const onSelectAnnotationRef = useRef(onSelectAnnotation);
  const markerDataRef = useRef({ annotations, pendingPoint });

  useEffect(() => {
    onPointRef.current = onPoint;
    onSelectAnnotationRef.current = onSelectAnnotation;
    markerDataRef.current = { annotations, pendingPoint };
  }, [annotations, onPoint, onSelectAnnotation, pendingPoint]);

  useEffect(() => {
    let active = true;
    if (!containerRef.current) return;
    void Promise.all([import("@photo-sphere-viewer/core"), import("@photo-sphere-viewer/markers-plugin")]).then(([core, markers]) => {
      if (!active || !containerRef.current) return;
      const viewer = new core.Viewer({
        container: containerRef.current,
        panorama: imageUrl,
        adapter: core.EquirectangularAdapter.withConfig({ shader: true }),
        plugins: [[markers.MarkersPlugin, { clickEventOnMarker: true }]],
        navbar: ["zoom", "move", "fullscreen"],
        mousewheelCtrlKey: false,
        touchmoveTwoFingers: false,
        defaultZoomLvl: 45,
        lang: { loadError: text("The 360° image could not be rendered.", "Het 360°-beeld kon niet worden weergegeven."), fullscreen: text("Fullscreen", "Volledig scherm"), zoom: text("Zoom", "Zoom") },
      });
      const markerPlugin = viewer.getPlugin<import("@photo-sphere-viewer/markers-plugin").MarkersPlugin>(markers.MarkersPlugin);
      viewer.addEventListener(core.events.ClickEvent.type, ({ data }) => {
        if (!data.marker) onPointRef.current({ mode: "spherical", yaw: data.yaw, pitch: data.pitch });
      });
      markerPlugin.addEventListener(markers.events.SelectMarkerEvent.type, ({ marker }) => {
        if (!marker.id.startsWith("pending:")) onSelectAnnotationRef.current(marker.id);
      });
      viewerRef.current = viewer;
      markersRef.current = markerPlugin;
      markerPlugin.setMarkers(panoramaMarkers(markerDataRef.current.annotations, markerDataRef.current.pendingPoint));
    });
    return () => {
      active = false;
      markersRef.current = null;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, [imageUrl, text]);

  useEffect(() => {
    markersRef.current?.setMarkers(panoramaMarkers(annotations, pendingPoint));
  }, [annotations, pendingPoint]);

  const markCenter = () => {
    const position = viewerRef.current?.getPosition();
    if (position) onPoint({ mode: "spherical", yaw: position.yaw, pitch: position.pitch });
  };

  return <div className="panorama-stage"><div className="panorama-viewer" ref={containerRef} /><button className="viewer-center-action" type="button" onClick={markCenter}><CircleDot size={15} /> {text("Mark center of current view", "Markeer midden van huidige weergave")}</button></div>;
}

function panoramaMarkers(annotations: VisualAnnotation[], pendingPoint: Extract<VisualPoint, { mode: "spherical" }> | null): import("@photo-sphere-viewer/markers-plugin").MarkerConfig[] {
  const markers: import("@photo-sphere-viewer/markers-plugin").MarkerConfig[] = annotations.flatMap((annotation, index) => annotation.yaw === null || annotation.pitch === null ? [] : [{
    id: annotation.id,
    position: { yaw: Number(annotation.yaw), pitch: Number(annotation.pitch) },
    html: `<span class="panorama-marker-dot ${annotation.severity}">${index + 1}</span>`,
    size: { width: 34, height: 34 },
    anchor: "center center",
    className: "panorama-marker-shell",
  }]);
  if (pendingPoint) markers.push({ id: "pending:new", position: { yaw: pendingPoint.yaw, pitch: pendingPoint.pitch }, html: '<span class="panorama-marker-dot pending">+</span>', size: { width: 34, height: 34 }, anchor: "center center", className: "panorama-marker-shell" });
  return markers;
}

function IssueForm({ point, capture, issue, setIssue, parties, busy, save, cancel }: { point: VisualPoint; capture: VisualCapture; issue: typeof emptyIssue; setIssue: (issue: typeof emptyIssue) => void; parties: ProjectParty[]; busy: boolean; save: () => void; cancel: () => void }) {
  const { text } = useLanguage();
  return <div className="visual-issue-form"><div><span className="record-number">{text("New issue marker", "Nieuwe probleemmarker")}</span><h2>{capture.location_label}</h2><p>{point.mode === "photo" ? `X ${Math.round(point.xRatio * 100)}% · Y ${Math.round(point.yRatio * 100)}%` : `${text("Yaw", "Draaihoek")} ${degrees(point.yaw)} · ${text("Pitch", "Hoogtehoek")} ${degrees(point.pitch)}`}</p></div><label className="form-field"><span>{text("Issue type", "Probleemtype")}</span><select value={issue.findingType} onChange={(event) => setIssue({ ...issue, findingType: event.target.value as Finding["finding_type"] })}><option value="observation">{text("Observation", "Observatie")}</option><option value="deficiency">{text("Deficiency", "Tekortkoming")}</option><option value="deviation">{text("Deviation", "Afwijking")}</option><option value="ncr">NCR</option><option value="improvement">{text("Improvement opportunity", "Verbeterkans")}</option></select></label><label className="form-field"><span>{text("Severity", "Ernst")}</span><select value={issue.severity} onChange={(event) => setIssue({ ...issue, severity: event.target.value as Finding["severity"] })}><option value="low">{text("Low · 14 days", "Laag · 14 dagen")}</option><option value="medium">{text("Medium · 7 days", "Middel · 7 dagen")}</option><option value="high">{text("High · 3 days", "Hoog · 3 dagen")}</option><option value="critical">{text("Critical · 1 day + escalation", "Kritiek · 1 dag + escalatie")}</option></select></label><label className="form-field"><span>{text("Title", "Titel")}</span><input value={issue.title} onChange={(event) => setIssue({ ...issue, title: event.target.value })} placeholder={text("Damaged plaster on north wall", "Beschadigd pleisterwerk op noordwand")} /></label><label className="form-field"><span>{text("Factual description", "Feitelijke omschrijving")}</span><textarea rows={3} value={issue.description} onChange={(event) => setIssue({ ...issue, description: event.target.value })} /></label><label className="form-field"><span>{text("Responsible party", "Verantwoordelijke partij")}</span><select value={issue.responsiblePartyId} onChange={(event) => setIssue({ ...issue, responsiblePartyId: event.target.value })}><option value="">{text("Not assigned", "Niet toegewezen")}</option>{parties.map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}</select></label><div className="button-row"><button className="secondary-button" type="button" onClick={cancel}>{text("Cancel", "Annuleren")}</button><button className="primary-button" type="button" disabled={busy || issue.title.trim().length < 3 || issue.description.trim().length < 3} onClick={save}><AlertTriangle size={15} /> {text("Create finding", "Bevinding maken")}</button></div></div>;
}

function AnnotationDetails({ annotation, finding }: { annotation: VisualAnnotation; finding: Finding }) {
  const { locale, text } = useLanguage();
  return <div className="visual-annotation-details"><span className={`visual-severity-line ${annotation.severity}`} /><span className="record-number">{finding.finding_number} · {annotation.severity}</span><h2>{annotation.title}</h2><p>{annotation.description}</p><dl><div><dt>{text("Finding status", "Status bevinding")}</dt><dd>{finding.status.replaceAll("_", " ")}</dd></div><div><dt>{text("Exact position", "Exacte positie")}</dt><dd>{annotation.coordinate_mode === "photo" ? `X ${Math.round(Number(annotation.x_ratio) * 100)}% · Y ${Math.round(Number(annotation.y_ratio) * 100)}%` : `${degrees(Number(annotation.yaw))} · ${degrees(Number(annotation.pitch))}`}</dd></div><div><dt>{text("Due", "Deadline")}</dt><dd>{finding.due_at ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "America/Paramaribo" }).format(new Date(finding.due_at)) : "—"}</dd></div></dl><div className="operation-alert"><ShieldCheck size={18} /><div><strong>{text("Traceable link", "Traceerbare koppeling")}</strong><span>{text("This marker, original image and finding remain linked in the audit trail.", "Deze marker, het originele beeld en de bevinding blijven gekoppeld in het auditspoor.")}</span></div></div></div>;
}
