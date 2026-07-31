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
import { useEffect, useMemo, useRef, useState } from "react";
import { BuildingPicker, resolveDefaultBuildingId, type BuildingOption } from "@/app/building-picker";
import { appendDictation, DictateButton } from "@/app/dictate-button";
import { useLanguage } from "@/lib/i18n";
import { fieldPhotoMimeTypes, normalizedImagePoint, validatePanoramaDimensions } from "@/lib/images/field-image.mjs";
import { compressFieldPhoto, dataSaverEnabled, forceSyncOfflineUploads, queueOfflineUpload } from "@/lib/offline/upload-queue";
import { isStorageGatewayConfigured, loadProjectFileObjectUrl } from "@/lib/storage/gateway";
import {
  createVisualAnnotationFinding,
  linkVisualAnnotationToFinding,
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
  buildingName: string;
  buildings: BuildingOption[];
  reportId: string | null;
  parties: ProjectParty[];
  client: SupabaseClient;
  busy: boolean;
  run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>;
  initialFindingId?: string;
  initialFiles?: File[];
  onInitialFilesConsumed?: () => void;
};

const emptyIssue = {
  findingType: "deficiency" as Finding["finding_type"],
  title: "",
  description: "",
  severity: "medium" as Finding["severity"],
  responsiblePartyId: "",
  disposition: "to_be_corrected" as "validated" | "to_be_corrected" | "alternative_solution",
  /** Empty means "same building as the photo". One image can cover more than one building. */
  buildingId: "",
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

export function VisualEvidenceWorkspace({ data, projectId, buildingId, buildingName, buildings, reportId, parties, client, busy, run, initialFindingId, initialFiles = [], onInitialFilesConsumed }: VisualEvidenceWorkspaceProps) {
  const { text } = useLanguage();
  const maxFileSizeBytes = (data.settings?.max_file_size_mb ?? 25) * 1024 * 1024;
  const captures = data.visualCaptures.filter((capture) => capture.status === "active");
  const initialFinding = data.findings.find((finding) => finding.id === initialFindingId) ?? null;
  const initialAnnotation = initialFinding ? data.visualAnnotations.find((annotation) => annotation.finding_id === initialFinding.id && annotation.status === "active") ?? null : null;
  const initialCapture = initialAnnotation
    ? captures.find((capture) => capture.id === initialAnnotation.capture_id)
    : initialFinding
      ? captures.find((capture) => capture.building_id === initialFinding.building_id)
      : null;
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [pendingSelectionFileId, setPendingSelectionFileId] = useState("");
  const [activeCaptureId, setActiveCaptureId] = useState(initialCapture?.id ?? captures[0]?.id ?? "");
  const activeCapture = captures.find((capture) => capture.file_id === pendingSelectionFileId)
    ?? captures.find((capture) => capture.id === activeCaptureId)
    ?? captures[0]
    ?? null;
  const activeFile = activeCapture ? captureFile(activeCapture, data.files) : null;
  const activeAnnotations = activeCapture ? data.visualAnnotations.filter((annotation) => annotation.capture_id === activeCapture.id && annotation.status === "active") : [];
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const filePreviewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  const [fileError, setFileError] = useState("");
  const [cameraSourceConfirmed, setCameraSourceConfirmed] = useState(false);
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
  const [issue, setIssue] = useState(() => initialFinding ? {
    findingType: initialFinding.finding_type,
    title: initialFinding.title,
    description: initialFinding.description,
    severity: initialFinding.severity,
    responsiblePartyId: initialFinding.responsible_party_id ?? "",
    disposition: (initialFinding.issue_management?.disposition ?? "to_be_corrected") as typeof emptyIssue["disposition"],
    buildingId: initialFinding.building_id,
  } : emptyIssue);
  const [existingFindingId, setExistingFindingId] = useState(initialFinding?.id ?? "");
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(initialAnnotation?.id ?? null);
  const [captureBuildingId, setCaptureBuildingId] = useState(() => initialFinding?.building_id ?? resolveDefaultBuildingId(buildings, buildingId));
  const captureBuildingName = buildings.find((building) => building.id === captureBuildingId)?.name ?? buildingName;
  const existingFinding = data.findings.find((finding) => finding.id === existingFindingId) ?? null;
  const initialFileHandled = useRef(false);
  const [cameraHandoff, setCameraHandoff] = useState(false);

  const stageImage = (selected: File | null, type: VisualCapture["capture_type"]) => {
    setFile(selected);
    setFileError("");
    setCameraSourceConfirmed(false);
    if (!selected) return;
    const automaticName = type === "photo"
      ? text("Field photo", "Veldfoto")
      : selected.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 180);
    setCaptureForm((current) => ({
      ...current,
      type,
      title: automaticName,
      locationLabel: current.locationLabel || captureBuildingName,
      tourName: type === "photo" ? "" : current.tourName,
      tourOrder: type === "photo" ? "" : current.tourOrder,
    }));
    setShowUpload(true);
  };

  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    };
  }, [filePreviewUrl]);

  const discardCapture = () => {
    setFile(null);
    setFileError("");
    setCameraSourceConfirmed(false);
    setCameraHandoff(false);
    setShowUpload(false);
    setCaptureForm({ type: "photo", title: "", description: "", locationLabel: "", locationNodeId: "", tourName: "", tourOrder: "" });
  };

  useEffect(() => {
    if (initialFileHandled.current || !initialFiles.length) return;
    initialFileHandled.current = true;
    const handoff = window.setTimeout(() => {
      stageImage(initialFiles[0], "photo");
      setCameraHandoff(true);
      onInitialFilesConsumed?.();
    }, 0);
    return () => window.clearTimeout(handoff);
    // stageImage intentionally runs once for the camera hand-off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFiles, onInitialFilesConsumed]);

  const tour = (() => {
    if (!activeCapture?.tour_name) return [];
    return captures
      .filter((capture) => capture.tour_name === activeCapture.tour_name)
      .sort((left, right) => (left.tour_order ?? 0) - (right.tour_order ?? 0));
  })();
  const tourIndex = activeCapture ? tour.findIndex((capture) => capture.id === activeCapture.id) : -1;

  const uploadCapture = async () => {
    if (!file || captureForm.title.trim().length < 3 || captureForm.locationLabel.trim().length < 2 || (captureForm.type === "panorama" && !cameraSourceConfirmed)) return;
    setFileError("");
    try {
      const dimensions = await imageDimensions(file);
      if (captureForm.type === "panorama") {
        const validation = validatePanoramaDimensions(dimensions.width, dimensions.height);
        if (validation.reason === "ratio") {
          setFileError(text("A 360° camera image must be a stitched 2:1 equirectangular export.", "Een 360°-camerabeeld moet een gestitchte equirectangulaire export met verhouding 2:1 zijn."));
          return;
        }
        if (validation.reason === "resolution") {
          setFileError(text("The 360° camera export must be at least 3840 × 1920 pixels so site details remain inspectable.", "De 360°-camera-export moet minimaal 3840 × 1920 pixels zijn zodat terreindetails controleerbaar blijven."));
          return;
        }
        if (!validation.valid) throw new Error("invalid-image");
      }
    } catch {
      setFileError(text("The selected file is not a readable image.", "Het gekozen bestand is geen leesbare afbeelding."));
      return;
    }
    const folderName = captureForm.type === "panorama" ? text("360° tours", "360°-rondgangen") : text("Daily progress", "Dagvoortgang");
    const existingFolder = data.mediaFolders.find((folder) => (!folder.building_id || folder.building_id === captureBuildingId) && folder.name.toLocaleLowerCase() === folderName.toLocaleLowerCase());
    const folderId = existingFolder?.id ?? null;
    const prepared = captureForm.type === "photo"
      ? await compressFieldPhoto(file, dataSaverEnabled())
      : { blob: file as Blob, fileName: file.name, mimeType: file.type, compressed: false };
    const okay = await run(async () => {
      const queued = await queueOfflineUpload({
        projectId,
        buildingId: captureBuildingId,
        reportId,
        folderId,
        folderName,
        kind: captureForm.type,
        file: prepared.blob,
        fileName: prepared.fileName,
        mimeType: prepared.mimeType,
        title: captureForm.title.trim(),
        description: captureForm.description.trim(),
        locationLabel: captureForm.locationLabel.trim(),
        locationNodeId: captureForm.locationNodeId || null,
        tourName: captureForm.tourName || null,
        tourOrder: captureForm.tourName ? Number(captureForm.tourOrder) : null,
        capturedAt: new Date(file.lastModified || Date.now()).toISOString(),
        originalSize: file.size,
        queuedSize: prepared.blob.size,
        compressed: prepared.compressed,
      });
      setPendingSelectionFileId(queued.id);
      if (navigator.onLine) {
        await forceSyncOfflineUploads(client, projectId, {
          paused: text(
            "The connection changed before central image confirmation. The image remains safe on this device. Keep this form open, then open Photos & folders and tap Sync now.",
            "De verbinding veranderde vóór de centrale beeldbevestiging. Het beeld blijft veilig op dit apparaat. Houd dit formulier open, open daarna Foto’s & mappen en tik op Nu synchroniseren.",
          ),
          failed: (pendingCount) => text(
            `${pendingCount} image upload(s) could not be confirmed centrally. They remain safe on this device. Keep this form open, then open Photos & folders and tap Sync now.`,
            `${pendingCount} beeld-upload(s) konden niet centraal worden bevestigd. Ze blijven veilig op dit apparaat. Houd dit formulier open, open daarna Foto’s & mappen en tik op Nu synchroniseren.`,
          ),
        });
      }
    }, text(
      "Visual secured on this device; central synchronization runs automatically.",
      "Beeld veilig op dit apparaat opgeslagen; centrale synchronisatie loopt automatisch.",
    ));
    if (okay) {
      setCaptureForm({ type: "photo", title: "", description: "", locationLabel: "", locationNodeId: "", tourName: "", tourOrder: "" });
      setFile(null);
      setFileError("");
      setCameraSourceConfirmed(false);
      setShowUpload(false);
    }
  };

  const saveIssue = async () => {
    if (!activeCapture || !point || issue.title.trim().length < 3 || issue.description.trim().length < 3) return;
    const okay = await run(
      () => existingFinding
        ? linkVisualAnnotationToFinding(client, {
            captureId: activeCapture.id,
            findingId: existingFinding.id,
            coordinateMode: point.mode,
            xRatio: point.mode === "photo" ? point.xRatio : null,
            yRatio: point.mode === "photo" ? point.yRatio : null,
            yaw: point.mode === "spherical" ? point.yaw : null,
            pitch: point.mode === "spherical" ? point.pitch : null,
            description: issue.description,
          })
        : createVisualAnnotationFinding(client, {
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
            buildingId: issue.buildingId || captureBuildingId,
            disposition: issue.disposition,
          }),
      existingFinding
        ? text(`Marker linked to ${existingFinding.finding_number}.`, `Marker gekoppeld aan ${existingFinding.finding_number}.`)
        : text("Issue marker and traceable finding created together.", "Probleemmarker en traceerbare bevinding zijn samen aangemaakt."),
    );
    if (okay) {
      setPoint(null);
      setIssue(emptyIssue);
      setExistingFindingId("");
    }
  };

  const chooseTourCapture = (offset: number) => {
    if (!tour.length || tourIndex < 0) return;
    const next = tour[(tourIndex + offset + tour.length) % tour.length];
    setPendingSelectionFileId("");
    setActiveCaptureId(next.id);
    setPoint(null);
    setSelectedAnnotationId(null);
  };

  const selectedAnnotation = data.visualAnnotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null;
  const selectedFinding = selectedAnnotation ? data.findings.find((finding) => finding.id === selectedAnnotation.finding_id) ?? null : null;

  return (
    <section className="visual-evidence-shell">
      <div className="visual-toolbar">
        <div><span className="record-number">{text("Visual evidence", "Visueel bewijs")}</span><h2>{text("Photos, 360° camera tours and exact issue locations", "Foto’s, 360°-cameratours en exacte probleemlocaties")}</h2><p>{text("Standard photos are the default. The interactive 360° mode accepts a stitched export from a dedicated 360° camera such as Insta360, not a flat phone panorama.", "Gewone foto’s zijn standaard. De interactieve 360°-modus accepteert een gestitchte export van een speciale 360°-camera zoals Insta360, geen vlakke telefoonpanorama.")}</p></div>
        <div className="visual-toolbar-actions">
          <input ref={cameraInputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { stageImage(event.currentTarget.files?.[0] ?? null, "photo"); event.currentTarget.value = ""; }} />
          <button className="primary-button camera-primary-action" type="button" disabled={!isStorageGatewayConfigured} onClick={() => cameraInputRef.current?.click()}><Camera size={17} /> {text("Take photo", "Maak foto")}</button>
          <button className="secondary-button" type="button" disabled={!isStorageGatewayConfigured} onClick={() => { setCaptureForm({ ...captureForm, type: "panorama", title: "", locationLabel: captureBuildingName }); setFile(null); setShowUpload(true); }}><ScanLine size={16} /> {text("Upload 360°", "Upload 360°")}</button>
        </div>
      </div>

      {existingFinding ? <div className="operation-alert success visual-finding-link-banner"><CircleDot size={18} /><div><strong>{text(`Selected issue: ${existingFinding.finding_number}`, `Geselecteerd issue: ${existingFinding.finding_number}`)} · {existingFinding.title}</strong><span>{text("Choose a visual image and click the exact problem location. The pointer and issue will then remain linked.", "Kies een beeld en klik op de exacte probleemlocatie. De pointer en het issue blijven daarna gekoppeld.")}</span></div></div> : null}
      {cameraHandoff && showUpload ? <div className="operation-alert success visual-camera-handoff"><Camera size={18} /><div><strong>{text("Step 1 of 2 · confirm and save this photo", "Stap 1 van 2 · bevestig en sla deze foto op")}</strong><span>{text("After saving, the photo opens here. Click the exact location to create or link an Issue or NCR.", "Na opslaan opent de foto hier. Klik op de exacte locatie om een Issue of NCR te maken of te koppelen.")}</span></div></div> : null}

      {!isStorageGatewayConfigured ? <div className="operation-alert warning"><ShieldCheck size={18} /><div><strong>{text("Private image storage must be connected", "Private beeldopslag moet worden gekoppeld")}</strong><span>{text("Connect a private Vercel Blob store to enable authorized uploads and viewing.", "Koppel een private Vercel Blob-store om geautoriseerde uploads en weergave mogelijk te maken.")}</span></div></div> : null}

      {showUpload ? (
        <div className="operation-form wide visual-upload-form">
          <div className="operation-form-heading"><div><span className="record-number">{text("New visual evidence", "Nieuw visueel bewijs")}</span><h2>{captureForm.type === "panorama" ? text("Upload 360° camera image", "Upload 360°-camerabeeld") : text("Photo ready to save", "Foto klaar om op te slaan")}</h2></div><span className="experimental-badge">{captureForm.type === "panorama" ? text("360° camera source", "360°-camerabron") : text("Point & shoot", "Richten & klaar")}</span></div>
          {captureForm.type === "photo" && filePreviewUrl ? (
            <div className="visual-photo-preview">
              {/* A local blob URL cannot pass through the Next image optimizer. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={filePreviewUrl} alt={text("Captured photo preview", "Voorbeeld van gemaakte foto")} />
            </div>
          ) : null}
          <div className="form-grid-2">
            <BuildingPicker id="capture-building" buildings={buildings} value={captureBuildingId} onChange={(next) => { setCaptureBuildingId(next); setCaptureForm((current) => ({ ...current, locationNodeId: "" })); }} />
            <label className="form-field"><span>{text("Project location node", "Projectlocatie")}</span><select value={captureForm.locationNodeId} onChange={(event) => setCaptureForm({ ...captureForm, locationNodeId: event.target.value })}><option value="">{text("No structured location selected", "Geen gestructureerde locatie gekozen")}</option>{data.locationNodes.filter((node) => node.building_id === captureBuildingId).map((node) => <option value={node.id} key={node.id}>{node.code} · {node.name}</option>)}</select></label>
            {captureForm.type === "panorama" ? <label className="form-field"><span>{text(`360° image · JPEG, PNG or WebP · max. ${data.settings?.max_file_size_mb ?? 25} MB`, `360°-beeld · JPEG, PNG of WebP · max. ${data.settings?.max_file_size_mb ?? 25} MB`)}</span><input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={(event) => stageImage(event.currentTarget.files?.[0] ?? null, "panorama")} /></label> : <div className="visual-review-actions"><button className="secondary-button visual-retake-button" type="button" onClick={() => cameraInputRef.current?.click()}><Camera size={16} /> {text("Retake photo", "Foto opnieuw maken")}</button><button className="secondary-button visual-discard-button" type="button" onClick={discardCapture}>{text("Discard photo", "Foto verwijderen")}</button></div>}
          </div>
          <details className="optional-text-entry">
            <summary>{text("Adjust title, location or context", "Titel, locatie of context aanpassen")}</summary>
            <div className="form-grid">
              <label className="form-field"><span>{text("Title", "Titel")}</span><input value={captureForm.title} onChange={(event) => setCaptureForm({ ...captureForm, title: event.target.value })} /></label>
              <label className="form-field"><span>{text("Room / location", "Ruimte / locatie")}</span><input value={captureForm.locationLabel} onChange={(event) => setCaptureForm({ ...captureForm, locationLabel: event.target.value })} /></label>
              <label className="form-field"><span>{text("Context", "Context")}</span><textarea rows={2} value={captureForm.description} onChange={(event) => setCaptureForm({ ...captureForm, description: event.target.value })} /><DictateButton onText={(transcript) => setCaptureForm((current) => ({ ...current, description: appendDictation(current.description, transcript) }))} /></label>
            </div>
          </details>
          {captureForm.type === "panorama" ? <div className="form-grid-2"><label className="form-field"><span>{text("Tour name · optional", "Tournaam · optioneel")}</span><input value={captureForm.tourName} onChange={(event) => setCaptureForm({ ...captureForm, tourName: event.target.value })} placeholder={text("Ground floor walkthrough", "Rondgang begane grond")} /></label><label className="form-field"><span>{text("Position in tour", "Volgorde in tour")}</span><input type="number" min="1" max="10000" disabled={!captureForm.tourName} value={captureForm.tourOrder} onChange={(event) => setCaptureForm({ ...captureForm, tourOrder: event.target.value })} /></label></div> : null}
          {captureForm.type === "panorama" ? <><div className="operation-alert"><ScanLine size={18} /><div><strong>{text("Dedicated 360° camera required", "Speciale 360°-camera vereist")}</strong><span>{text("Use a stitched 2:1 equirectangular export of at least 3840 × 1920 pixels from an Insta360 or equivalent 360° camera. A swept phone panorama is not accepted.", "Gebruik een gestitchte equirectangulaire 2:1-export van minimaal 3840 × 1920 pixels uit een Insta360 of gelijkwaardige 360°-camera. Een geveegde telefoonpanorama wordt niet geaccepteerd.")}</span></div></div><label className="check-field"><input type="checkbox" checked={cameraSourceConfirmed} onChange={(event) => setCameraSourceConfirmed(event.target.checked)} /> {text("I confirm this is an export from a dedicated 360° camera.", "Ik bevestig dat dit een export uit een speciale 360°-camera is.")}</label></> : null}
          {file && file.size > maxFileSizeBytes ? <p className="field-error">{text("This image exceeds the project file limit.", "Deze afbeelding is groter dan de bestandslimiet van het project.")}</p> : null}
          {fileError ? <p className="field-error" role="alert">{fileError}</p> : null}
          <button className="primary-button" type="button" disabled={busy || !file || file.size > maxFileSizeBytes || !fieldPhotoMimeTypes.includes(file.type) || captureForm.title.trim().length < 3 || captureForm.locationLabel.trim().length < 2 || (captureForm.type === "panorama" && (!cameraSourceConfirmed || Boolean(captureForm.tourName) !== Boolean(captureForm.tourOrder)))} onClick={() => void uploadCapture()}>{busy ? <Loader2 className="spin" size={15} /> : <Camera size={15} />} {captureForm.type === "panorama" ? text("Secure and sync 360° image", "Beveilig en synchroniseer 360°-beeld") : text("Save photo", "Foto opslaan")}</button>
        </div>
      ) : null}

      {captures.length ? (
        <div className="visual-workspace-grid">
          <aside className="visual-capture-list" aria-label={text("Visual evidence list", "Lijst visueel bewijs")}>
            {captures.map((capture) => {
              const count = data.visualAnnotations.filter((annotation) => annotation.capture_id === capture.id && annotation.status === "active").length;
              return <button type="button" className={activeCapture?.id === capture.id ? "active" : ""} onClick={() => { setPendingSelectionFileId(""); setActiveCaptureId(capture.id); setPoint(null); setSelectedAnnotationId(null); }} key={capture.id}><span className="visual-list-icon">{capture.capture_type === "panorama" ? <ScanLine size={17} /> : <ImageIcon size={17} />}</span><span><strong>{capture.title}</strong><small>{capture.location_label} · {count} {text(count === 1 ? "issue" : "issues", count === 1 ? "probleem" : "problemen")}</small></span>{capture.capture_type === "panorama" ? <em>360°</em> : null}</button>;
            })}
          </aside>
          <div className="visual-stage-column">
            {activeCapture && activeFile ? (
              <>
                <div className="visual-stage-header"><div><span className="record-number">{activeCapture.capture_type === "panorama" ? text("Interactive 360° camera image", "Interactief 360°-camerabeeld") : text("Annotated photo", "Geannoteerde foto")}</span><h2>{activeCapture.title}</h2><p><MapPin size={13} /> {activeCapture.location_label}{activeCapture.tour_name ? ` · ${activeCapture.tour_name}` : ""}</p></div>{tour.length > 1 ? <div className="tour-controls"><button type="button" aria-label={text("Previous 360° camera image", "Vorig 360°-camerabeeld")} onClick={() => chooseTourCapture(-1)}><ChevronLeft size={17} /></button><span>{tourIndex + 1} / {tour.length}</span><button type="button" aria-label={text("Next 360° camera image", "Volgend 360°-camerabeeld")} onClick={() => chooseTourCapture(1)}><ChevronRight size={17} /></button></div> : null}</div>
                <VisualViewer key={activeCapture.id} capture={activeCapture} file={activeFile} annotations={activeAnnotations} pendingPoint={point} client={client} onPoint={(nextPoint) => { setPoint(nextPoint); setSelectedAnnotationId(null); }} onSelectAnnotation={(annotationId) => { setSelectedAnnotationId(annotationId); setPoint(null); }} />
                <div className="visual-stage-help"><CircleDot size={15} /><span>{text("Click the exact damaged or non-conforming area to create a marker. Drag to inspect the 360° camera view; use the center-marker button for keyboard entry.", "Klik exact op de beschadiging of afwijking om een marker te maken. Sleep om het 360°-camerabeeld te inspecteren; gebruik de middenmarkerknop voor toetsenbordbediening.")}</span></div>
              </>
            ) : null}
          </div>
          <aside className="visual-issue-panel">
            {point && activeCapture ? <IssueForm point={point} capture={activeCapture} issue={issue} setIssue={setIssue} findings={data.findings} annotations={data.visualAnnotations} existingFindingId={existingFindingId} setExistingFindingId={setExistingFindingId} parties={parties} buildings={buildings} captureBuildingId={captureBuildingId} busy={busy} save={() => void saveIssue()} cancel={() => { setPoint(null); setIssue(emptyIssue); setExistingFindingId(""); }} /> : selectedAnnotation && selectedFinding ? <AnnotationDetails annotation={selectedAnnotation} finding={selectedFinding} /> : <div className="visual-panel-empty"><ScanLine size={24} /><strong>{text("Select or place a marker", "Selecteer of plaats een marker")}</strong><span>{text("The exact image position and the formal finding remain linked.", "De exacte beeldpositie en de formele bevinding blijven gekoppeld.")}</span></div>}
          </aside>
        </div>
      ) : <div className="empty-list-state visual-empty"><Camera size={24} /><strong>{text("No visual evidence yet", "Nog geen visueel bewijs")}</strong><span>{text("Start with a standard photo, or add a dedicated 360° camera export for an interactive site tour.", "Start met een gewone foto of voeg een export uit een speciale 360°-camera toe voor een interactieve terreinrondgang.")}</span></div>}
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
  const [imageFailed, setImageFailed] = useState(false);
  const placeFromPointer = (clientX: number, clientY: number, target: HTMLElement) => {
    const bounds = target.getBoundingClientRect();
    const point = normalizedImagePoint(clientX, clientY, bounds);
    onPoint({ mode: "photo", xRatio: point.x, yRatio: point.y });
  };
  if (imageFailed) return <div className="visual-load-state error"><AlertTriangle size={21} /> {text("The secured photo could not be displayed. Reload the image and try again.", "De beveiligde foto kon niet worden weergegeven. Laad het beeld opnieuw en probeer nogmaals.")}</div>;
  return (
    <div className="photo-annotation-stage">
      <div className="photo-annotation-canvas" role="button" tabIndex={0} aria-label={text("Photo. Click to mark an issue.", "Foto. Klik om een probleem te markeren.")} onClick={(event) => placeFromPointer(event.clientX, event.clientY, event.currentTarget)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onPoint({ mode: "photo", xRatio: 0.5, yRatio: 0.5 }); } }}>
        {/* The original aspect ratio is preserved so normalized marker coordinates stay exact. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={title} onError={() => setImageFailed(true)} />
        {annotations.map((annotation, index) => annotation.x_ratio !== null && annotation.y_ratio !== null ? <button className={`visual-marker ${markerTone(annotation)}`} style={{ left: `${Number(annotation.x_ratio) * 100}%`, top: `${Number(annotation.y_ratio) * 100}%` }} type="button" aria-label={`${annotation.title} · ${annotation.severity}`} onClick={(event) => { event.stopPropagation(); onSelectAnnotation(annotation.id); }} key={annotation.id}>{index + 1}</button> : null)}
        {pendingPoint ? <span className="visual-marker pending" style={{ left: `${pendingPoint.xRatio * 100}%`, top: `${pendingPoint.yRatio * 100}%` }}><Plus size={13} /></span> : null}
      </div>
      <button className="viewer-center-action" type="button" onClick={() => onPoint({ mode: "photo", xRatio: 0.5, yRatio: 0.5 })}><CircleDot size={15} /> {text("Place marker at image center", "Plaats marker in midden")}</button>
    </div>
  );
}

/**
 * Marker colour follows the client's punch-list classification, not severity:
 * Validate = green, To be corrected = orange, Need an alternative solution = red.
 * Markers created before the classification shipped fall back to severity.
 */
function markerTone(annotation: VisualAnnotation) {
  if (annotation.disposition === "validated") return "validated";
  if (annotation.disposition === "to_be_corrected") return "to-be-corrected";
  if (annotation.disposition === "alternative_solution") return "alternative-solution";
  return annotation.severity;
}

function PanoramaViewer({ imageUrl, annotations, pendingPoint, onPoint, onSelectAnnotation }: { imageUrl: string; annotations: VisualAnnotation[]; pendingPoint: Extract<VisualPoint, { mode: "spherical" }> | null; onPoint: (point: VisualPoint) => void; onSelectAnnotation: (annotationId: string) => void }) {
  const { text } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<import("@photo-sphere-viewer/core").Viewer | null>(null);
  const markersRef = useRef<import("@photo-sphere-viewer/markers-plugin").MarkersPlugin | null>(null);
  const onPointRef = useRef(onPoint);
  const onSelectAnnotationRef = useRef(onSelectAnnotation);
  const markerDataRef = useRef({ annotations, pendingPoint });
  const [viewerState, setViewerState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    onPointRef.current = onPoint;
    onSelectAnnotationRef.current = onSelectAnnotation;
    markerDataRef.current = { annotations, pendingPoint };
  }, [annotations, onPoint, onSelectAnnotation, pendingPoint]);

  useEffect(() => {
    let active = true;
    if (!containerRef.current) return;
    setViewerState("loading");
    void Promise.all([import("@photo-sphere-viewer/core"), import("@photo-sphere-viewer/markers-plugin")]).then(([core, markers]) => {
      if (!active || !containerRef.current) return;
      const viewer = new core.Viewer({
        container: containerRef.current,
        panorama: imageUrl,
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
      viewer.addEventListener(core.events.ReadyEvent.type, () => {
        if (active) setViewerState("ready");
      });
      viewer.addEventListener(core.events.PanoramaErrorEvent.type, () => {
        if (active) setViewerState("error");
      });
      viewerRef.current = viewer;
      markersRef.current = markerPlugin;
      markerPlugin.setMarkers(panoramaMarkers(markerDataRef.current.annotations, markerDataRef.current.pendingPoint));
    }).catch(() => {
      if (active) setViewerState("error");
    });
    return () => {
      active = false;
      markersRef.current = null;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, [imageUrl, retry, text]);

  useEffect(() => {
    markersRef.current?.setMarkers(panoramaMarkers(annotations, pendingPoint));
  }, [annotations, pendingPoint]);

  const markCenter = () => {
    const position = viewerRef.current?.getPosition();
    if (position) onPoint({ mode: "spherical", yaw: position.yaw, pitch: position.pitch });
  };

  return <div className="panorama-stage" data-viewer-state={viewerState}>
    <div className="panorama-viewer" ref={containerRef} />
    {viewerState === "loading" ? <div className="panorama-status"><Loader2 className="spin" size={22} /> {text("Opening interactive 360° image…", "Interactief 360°-beeld openen…")}</div> : null}
    {viewerState === "error" ? <div className="panorama-status error"><AlertTriangle size={22} /><span>{text("The 360° viewer could not start on this device.", "De 360°-viewer kon niet starten op dit apparaat.")}</span><button type="button" onClick={() => setRetry((value) => value + 1)}>{text("Try again", "Probeer opnieuw")}</button></div> : null}
    {viewerState === "ready" ? <button className="viewer-center-action" type="button" onClick={markCenter}><CircleDot size={15} /> {text("Mark center of current view", "Markeer midden van huidige weergave")}</button> : null}
  </div>;
}

function panoramaMarkers(annotations: VisualAnnotation[], pendingPoint: Extract<VisualPoint, { mode: "spherical" }> | null): import("@photo-sphere-viewer/markers-plugin").MarkerConfig[] {
  const markers: import("@photo-sphere-viewer/markers-plugin").MarkerConfig[] = annotations.flatMap((annotation, index) => annotation.yaw === null || annotation.pitch === null ? [] : [{
    id: annotation.id,
    position: { yaw: Number(annotation.yaw), pitch: Number(annotation.pitch) },
    html: `<span class="panorama-marker-dot ${markerTone(annotation)}">${index + 1}</span>`,
    size: { width: 34, height: 34 },
    anchor: "center center",
    className: "panorama-marker-shell",
  }]);
  if (pendingPoint) markers.push({ id: "pending:new", position: { yaw: pendingPoint.yaw, pitch: pendingPoint.pitch }, html: '<span class="panorama-marker-dot pending">+</span>', size: { width: 34, height: 34 }, anchor: "center center", className: "panorama-marker-shell" });
  return markers;
}

function IssueForm({ point, capture, issue, setIssue, findings, annotations, existingFindingId, setExistingFindingId, parties, buildings, captureBuildingId, busy, save, cancel }: { point: VisualPoint; capture: VisualCapture; issue: typeof emptyIssue; setIssue: (issue: typeof emptyIssue) => void; findings: Finding[]; annotations: VisualAnnotation[]; existingFindingId: string; setExistingFindingId: (id: string) => void; parties: ProjectParty[]; buildings: BuildingOption[]; captureBuildingId: string; busy: boolean; save: () => void; cancel: () => void }) {
  const { text } = useLanguage();
  const existingFinding = findings.find((finding) => finding.id === existingFindingId) ?? null;
  const availableFindings = findings.filter((finding) => finding.id === existingFindingId || !annotations.some((annotation) => annotation.finding_id === finding.id && annotation.status === "active"));
  const issuePresets: Array<Pick<typeof emptyIssue, "findingType" | "title" | "description" | "severity">> = [
    { findingType: "deficiency", severity: "medium", title: text("Crack or damage", "Scheur of beschadiging"), description: text("Visible damage at the marked location requires repair and verification.", "Zichtbare beschadiging op de gemarkeerde locatie vraagt herstel en verificatie.") },
    { findingType: "deficiency", severity: "medium", title: text("Work incomplete", "Werk niet volledig"), description: text("The work at the marked location is not fully completed.", "Het werk op de gemarkeerde locatie is niet volledig uitgevoerd.") },
    { findingType: "deviation", severity: "high", title: text("Incorrect dimensions", "Verkeerde maatvoering"), description: text("The marked work does not match the approved dimensions.", "Het gemarkeerde werk komt niet overeen met de goedgekeurde maatvoering.") },
    { findingType: "observation", severity: "high", title: text("Safety risk", "Veiligheidsrisico"), description: text("The marked condition creates an immediate safety risk.", "De gemarkeerde situatie vormt een direct veiligheidsrisico.") },
    { findingType: "deficiency", severity: "low", title: text("Finish or cleaning", "Afwerking of schoonmaak"), description: text("The marked finish or work area does not meet the required condition.", "De gemarkeerde afwerking of werkzone voldoet niet aan de vereiste staat.") },
  ];
  return (
    <div className="visual-issue-form">
      <div><span className="record-number">{text("New issue marker", "Nieuwe probleemmarker")}</span><h2>{capture.location_label}</h2><p>{point.mode === "photo" ? `X ${Math.round(point.xRatio * 100)}% · Y ${Math.round(point.yRatio * 100)}%` : `${text("Yaw", "Draaihoek")} ${degrees(point.yaw)} · ${text("Pitch", "Hoogtehoek")} ${degrees(point.pitch)}`}</p></div>
      <label className="form-field"><span>{text("Link marker to", "Koppel marker aan")}</span><select value={existingFindingId} onChange={(event) => {
        const finding = findings.find((item) => item.id === event.target.value);
        setExistingFindingId(event.target.value);
        setIssue(finding ? {
          findingType: finding.finding_type,
          title: finding.title,
          description: finding.description,
          severity: finding.severity,
          responsiblePartyId: finding.responsible_party_id ?? "",
          disposition: finding.issue_management?.disposition ?? "to_be_corrected",
          buildingId: finding.building_id,
        } : emptyIssue);
      }}><option value="">{text("Create a new issue", "Maak een nieuw issue")}</option>{availableFindings.map((finding) => <option value={finding.id} key={finding.id}>{finding.finding_number} · {finding.title}</option>)}</select></label>
      {existingFinding ? <div className="operation-alert success"><CircleDot size={18} /><div><strong>{existingFinding.finding_number} · {existingFinding.title}</strong><span>{text("This pointer will be added to the existing formal issue.", "Deze pointer wordt aan het bestaande formele issue toegevoegd.")}</span></div></div> : <>
        <div className="quick-issue-presets" aria-label={text("Choose a common issue", "Kies een veelvoorkomend probleem")}>{issuePresets.map((preset) => <button className={issue.title === preset.title ? "active" : ""} type="button" onClick={() => setIssue({ ...issue, ...preset })} key={preset.title}>{preset.title}</button>)}</div>
        <label className="form-field"><span>{text("Issue type", "Probleemtype")}</span><select value={issue.findingType} onChange={(event) => setIssue({ ...issue, findingType: event.target.value as Finding["finding_type"] })}><option value="observation">{text("Observation", "Observatie")}</option><option value="deficiency">{text("Deficiency", "Tekortkoming")}</option><option value="deviation">{text("Deviation", "Afwijking")}</option><option value="ncr">NCR</option><option value="improvement">{text("Improvement opportunity", "Verbeterkans")}</option></select></label>
        <label className="form-field"><span>{text("Marker classification · color", "Markerclassificatie · kleur")}</span><select value={issue.disposition} onChange={(event) => setIssue({ ...issue, disposition: event.target.value as typeof issue.disposition })}><option value="validated">{text("Validated · green", "Gevalideerd · groen")}</option><option value="to_be_corrected">{text("To be corrected · orange", "Te corrigeren · oranje")}</option><option value="alternative_solution">{text("Alternative solution required · red", "Alternatieve oplossing nodig · rood")}</option></select></label>
        <BuildingPicker id="marker-building" buildings={buildings} value={issue.buildingId || captureBuildingId} onChange={(next) => setIssue({ ...issue, buildingId: next })} />
        <label className="form-field"><span>{text("Severity", "Ernst")}</span><select value={issue.severity} onChange={(event) => setIssue({ ...issue, severity: event.target.value as Finding["severity"] })}><option value="low">{text("Low · 14 days", "Laag · 14 dagen")}</option><option value="medium">{text("Medium · 7 days", "Middel · 7 dagen")}</option><option value="high">{text("High · 3 days", "Hoog · 3 dagen")}</option><option value="critical">{text("Critical · 1 day + escalation", "Kritiek · 1 dag + escalatie")}</option></select></label>
        <label className="form-field"><span>{text("Title", "Titel")}</span><input value={issue.title} onChange={(event) => setIssue({ ...issue, title: event.target.value })} placeholder={text("Choose above or type a short title.", "Kies hierboven of typ een korte titel.")} /></label>
        <label className="form-field"><span>{text("Responsible party", "Verantwoordelijke partij")}</span><select value={issue.responsiblePartyId} onChange={(event) => setIssue({ ...issue, responsiblePartyId: event.target.value })}><option value="">{text("Not assigned", "Niet toegewezen")}</option>{parties.map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}</select></label>
      </>}
      <label className="form-field"><span>{existingFinding ? text("What does the pointer indicate?", "Wat wijst de pointer precies aan?") : text("Factual description", "Feitelijke omschrijving")}</span><textarea rows={3} value={issue.description} onChange={(event) => setIssue({ ...issue, description: event.target.value })} /><DictateButton onText={(transcript) => setIssue({ ...issue, description: appendDictation(issue.description, transcript) })} /></label>
      <div className="button-row"><button className="secondary-button" type="button" onClick={cancel}>{text("Cancel", "Annuleren")}</button><button className="primary-button" type="button" disabled={busy || issue.title.trim().length < 3 || issue.description.trim().length < 3} onClick={save}><AlertTriangle size={15} /> {existingFinding ? text("Link pointer to issue", "Koppel pointer aan issue") : text("Create finding", "Bevinding maken")}</button></div>
    </div>
  );
}

function AnnotationDetails({ annotation, finding }: { annotation: VisualAnnotation; finding: Finding }) {
  const { locale, text } = useLanguage();
  return <div className="visual-annotation-details"><span className={`visual-severity-line ${annotation.severity}`} /><span className="record-number">{finding.finding_number} · {annotation.severity}</span><h2>{annotation.title}</h2><p>{annotation.description}</p><dl><div><dt>{text("Finding status", "Status bevinding")}</dt><dd>{finding.status.replaceAll("_", " ")}</dd></div><div><dt>{text("Exact position", "Exacte positie")}</dt><dd>{annotation.coordinate_mode === "photo" ? `X ${Math.round(Number(annotation.x_ratio) * 100)}% · Y ${Math.round(Number(annotation.y_ratio) * 100)}%` : `${degrees(Number(annotation.yaw))} · ${degrees(Number(annotation.pitch))}`}</dd></div><div><dt>{text("Due", "Deadline")}</dt><dd>{finding.due_at ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "America/Paramaribo" }).format(new Date(finding.due_at)) : "—"}</dd></div></dl><div className="operation-alert"><ShieldCheck size={18} /><div><strong>{text("Traceable link", "Traceerbare koppeling")}</strong><span>{text("This marker, original image and finding remain linked in the audit trail.", "Deze marker, het originele beeld en de bevinding blijven gekoppeld in het auditspoor.")}</span></div></div></div>;
}
