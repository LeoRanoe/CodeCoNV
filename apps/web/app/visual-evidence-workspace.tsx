"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AlertTriangle,
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Compass,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Maximize2,
  Move3d,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BuildingChoiceField, BuildingMultiPicker, resolveDefaultBuildingId, type BuildingOption } from "@/app/building-picker";
import { appendDictation, DictateButton } from "@/app/dictate-button";
import { DrawingLocationPicker, drawingLocationLabel, pickableDrawings, type DrawingLocation } from "@/app/drawing-location-picker";
import { dutchDirectionLabels } from "@/app/photo-evidence";
import { appendPhotoDetail, MarkPhotoButton, PhotoMarkupPad } from "@/app/photo-markup";
import { SignatureField, type HandwrittenSignature } from "@/app/signature-pad";
import { useLanguage } from "@/lib/i18n";
import { imageContentType, orderedTour, validTourPosition } from "@/lib/images/content-type.mjs";
import { currentCompassPoint, startCompassWatch } from "@/lib/images/compass";
import { readPhotoDirection } from "@/lib/images/exif-direction.mjs";
import { compassPointFromDegrees, describePanoramaImage, fieldPhotoMimeTypes, looksLikeDualFisheye, normalizedImagePoint, panoramaFileExtensions, panoramaUploadSource, photoMarkupToneColors, photoTitleFromDescription } from "@/lib/images/field-image.mjs";
import { compressFieldPhoto, dataSaverEnabled, forceSyncOfflineUploads, preparePanoramaUpload, queueOfflineUpload } from "@/lib/offline/upload-queue";
import { clearFormDraft, formDraftKey, saveFormDraft } from "@/lib/offline/form-drafts";
import { downloadProjectFile, isStorageGatewayConfigured, loadProjectFileObjectUrl, openProjectFile } from "@/lib/storage/gateway";
import {
  createVisualCapture,
  createVisualAnnotationFinding,
  linkVisualAnnotationToFinding,
  type FileRecord,
  type Finding,
  type OperationSnapshot,
  type VisualAnnotation,
  type VisualCapture,
} from "@/lib/supabase/operations";
import type { ProjectParty } from "@/lib/supabase/data";
import { statusText } from "@/lib/status-labels";

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
  /** A photo from the library that was sent here to have a problem marked on it. */
  initialFileId?: string;
  onInitialFileConsumed?: () => void;
  initialFiles?: File[];
  onInitialFilesConsumed?: () => void;
  /** Set when "Upload 360° image" was tapped elsewhere, so the form is already open here. */
  start360Upload?: boolean;
  onStart360UploadConsumed?: () => void;
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
  /** Every building the marked finding belongs to; the first is where it is filed. */
  buildingIds: [] as string[],
};

function degrees(value: number | null) {
  return value === null ? "—" : `${Math.round(value * (180 / Math.PI))}°`;
}

function captureFile(capture: VisualCapture, files: FileRecord[]) {
  return files.find((file) => file.id === capture.file_id) ?? null;
}

function humanFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

export function VisualEvidenceWorkspace({ data, projectId, buildingId, buildingName, buildings, reportId, parties, client, busy, run, initialFindingId, initialFileId = "", onInitialFileConsumed, initialFiles = [], onInitialFilesConsumed, start360Upload = false, onStart360UploadConsumed }: VisualEvidenceWorkspaceProps) {
  const { language, text } = useLanguage();
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
  // A photo tapped in the library opens here, on itself, instead of on whatever picture
  // happened to be first in the list.
  const [pendingSelectionFileId, setPendingSelectionFileId] = useState(initialFileId);
  // The request is used once: coming back to this screen later opens the picture that was
  // last worked on, not the one that was tapped in the library an hour ago.
  useEffect(() => {
    if (initialFileId) onInitialFileConsumed?.();
  }, [initialFileId, onInitialFileConsumed]);
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
  const [markingPhoto, setMarkingPhoto] = useState(false);
  const [photoMarkerCount, setPhotoMarkerCount] = useState(0);
  /**
   * What the chosen 360° file turned out to be. Every readable image is accepted — a full
   * equirectangular export, a wider or narrower one, a small one — so this is what the screen
   * tells the supervisor about the image, never a reason to refuse it.
   */
  const [panoramaImage, setPanoramaImage] = useState<{ width: number; height: number; projection: string; notice: string | null } | null>(null);
  /**
   * One picture, one text box. The client crossed out the title, the category and the room
   * field on the capture screen: "voor nr is 1 invoer voldoende". What is left is the
   * sentence a supervisor would say out loud, plus the things the app can know by itself.
   */
  const [captureForm, setCaptureForm] = useState({
    type: "photo" as VisualCapture["capture_type"],
    description: "",
    locationNodeId: "",
    /** The direction the camera was pointing, read from the photo or from the compass. */
    direction: "",
    /** False once the supervisor has chosen a direction by hand. */
    directionAutomatic: true,
    tourName: "",
    tourOrder: "",
  });
  const [drawingLocation, setDrawingLocation] = useState<DrawingLocation | null>(null);
  const [pickingDrawingLocation, setPickingDrawingLocation] = useState(false);
  const [point, setPoint] = useState<VisualPoint | null>(null);
  const [issue, setIssue] = useState(() => initialFinding ? {
    findingType: initialFinding.finding_type,
    title: initialFinding.title,
    description: initialFinding.description,
    severity: initialFinding.severity,
    responsiblePartyId: initialFinding.responsible_party_id ?? "",
    disposition: (initialFinding.issue_management?.disposition ?? "to_be_corrected") as typeof emptyIssue["disposition"],
    buildingId: initialFinding.building_id,
    buildingIds: initialFinding.building_ids?.length ? initialFinding.building_ids : [initialFinding.building_id],
  } : emptyIssue);
  const [existingFindingId, setExistingFindingId] = useState(initialFinding?.id ?? "");
  /** A marker that creates a formal finding is signed like every other record screen. */
  const [issueSignature, setIssueSignature] = useState<HandwrittenSignature | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(initialAnnotation?.id ?? null);
  /** One photo can show two buildings at once, so the choice is a list, never a single value. */
  const [captureBuildingIds, setCaptureBuildingIds] = useState<string[]>(() => [initialFinding?.building_id ?? resolveDefaultBuildingId(buildings, buildingId)].filter(Boolean));
  const captureBuildingId = captureBuildingIds[0] ?? resolveDefaultBuildingId(buildings, buildingId);
  const captureBuildingName = buildings.find((building) => building.id === captureBuildingId)?.name ?? buildingName;
  const captureDrawings = useMemo(() => pickableDrawings(data.files, captureBuildingId), [data.files, captureBuildingId]);
  const captureLocationNodes = data.locationNodes.filter((node) => node.building_id === captureBuildingId);
  /**
   * Where the photo says it was taken: the spot on the drawing if one was pointed at, then the
   * structured project location, and otherwise simply the building. The client crossed out the
   * field that asked the supervisor to type this himself.
   */
  const captureLocationLabel = (() => {
    if (drawingLocation) return drawingLocationLabel(drawingLocation, text("page", "pagina"));
    const node = data.locationNodes.find((entry) => entry.id === captureForm.locationNodeId);
    if (node) return `${node.code} · ${node.name}`;
    return captureBuildingName;
  })();
  const existingFinding = data.findings.find((finding) => finding.id === existingFindingId) ?? null;
  /** The camera hand-off that was staged, so the same photos are never staged twice. */
  const handledInitialFiles = useRef<File[] | null>(null);
  const [cameraHandoff, setCameraHandoff] = useState(false);

  const stagedImageRef = useRef(0);
  const uploadingRef = useRef(false);
  useEffect(() => () => { stagedImageRef.current += 1; }, []);

  const stageImage = useCallback((chosen: File | null, type: VisualCapture["capture_type"]) => {
    const generation = ++stagedImageRef.current;
    setFileError("");
    setPhotoMarkerCount(0);
    setPanoramaImage(null);
    // A 360° camera does not always hand over a usable type: Insta360 writes `.insp`, and some
    // desktop exports arrive without a type at all. Both are ordinary images, so the file is
    // given the type it really has instead of being turned away at the door.
    const source = chosen && type === "panorama" ? panoramaUploadSource(chosen.name, chosen.type) : null;
    const selected = source && source.mimeType && (source.mimeType !== chosen!.type || source.renamed)
      ? new File([chosen!], source.fileName, { type: source.mimeType, lastModified: chosen!.lastModified })
      : chosen;
    setFile(selected);
    if (!selected) return;
    // Kept on the device until it is saved or discarded; a back press or a dropped tab offers
    // it again when the project opens.
    if (type === "photo") void saveFormDraft(formDraftKey("quick-photo", projectId), [selected]);
    if (source && !source.mimeType) {
      setFileError(text(
        "This file type cannot be shown as a 360° image. Export the image as JPEG, PNG or WebP.",
        "Dit bestandstype kan niet als 360°-beeld worden getoond. Exporteer het beeld als JPEG, PNG of WebP.",
      ));
    }
    if (type === "panorama") {
      // The image itself says how much of the sphere it covers; nothing here decides whether it
      // may be uploaded, only what the screen says about it.
      void imageDimensions(selected)
        .then((dimensions) => {
          if (generation !== stagedImageRef.current) return;
          const description = describePanoramaImage(dimensions.width, dimensions.height);
          if (!description.valid) {
            setFileError(text("The selected file is not a readable image.", "Het gekozen bestand is geen leesbare afbeelding."));
            return;
          }
          setPanoramaImage({ width: dimensions.width, height: dimensions.height, projection: description.projection, notice: description.notice });
        })
        .catch(() => { if (generation === stagedImageRef.current) setFileError(text("The selected file is not a readable image.", "Het gekozen bestand is geen leesbare afbeelding.")); });
    }
    setCaptureForm((current) => ({
      ...current,
      type,
      tourName: type === "photo" ? "" : current.tourName,
      tourOrder: type === "photo" ? "" : current.tourOrder,
    }));
    setShowUpload(true);
    // "Kan dit automatisch?" — the camera writes its own bearing into the picture, and when it
    // did not, the compass of the device still knows which way the phone was held.
    void readPhotoDirection(selected).then((degrees) => {
      if (generation !== stagedImageRef.current) return;
      const measured = compassPointFromDegrees(degrees) || currentCompassPoint();
      if (!measured) return;
      setCaptureForm((current) => current.directionAutomatic ? { ...current, direction: measured } : current);
    });
  }, [projectId, text]);

  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    };
  }, [filePreviewUrl]);

  const emptyCaptureForm = { type: "photo" as VisualCapture["capture_type"], description: "", locationNodeId: "", direction: "", directionAutomatic: true, tourName: "", tourOrder: "" };

  const discardCapture = () => {
    // Thrown away on purpose, so the camera photo's safety copy goes with it.
    void clearFormDraft(formDraftKey("quick-photo", projectId));
    stagedImageRef.current += 1;
    setFile(null);
    setFileError("");
    setPhotoMarkerCount(0);
    setMarkingPhoto(false);
    setPanoramaImage(null);
    setCameraHandoff(false);
    setShowUpload(false);
    setDrawingLocation(null);
    setCaptureForm(emptyCaptureForm);
  };

  // The photo from the camera button. It is only marked as handled once it has actually been
  // staged: marking it first meant that any re-render before the timer ran — the "Photo
  // ready" message causes one — cancelled the timer and silently dropped the photo. A later
  // photo is a new hand-off, so it is staged too instead of being ignored.
  useEffect(() => {
    if (!initialFiles.length || handledInitialFiles.current === initialFiles) return;
    const handoff = window.setTimeout(() => {
      if (handledInitialFiles.current === initialFiles) return;
      handledInitialFiles.current = initialFiles;
      stageImage(initialFiles[0], "photo");
      setCameraHandoff(true);
      onInitialFilesConsumed?.();
    }, 0);
    return () => window.clearTimeout(handoff);
  }, [initialFiles, onInitialFilesConsumed, stageImage]);

  // Tapping "Upload 360° image" in the photo library asked for the 360° form, so the form
  // opens here instead of asking for the same button a second time.
  const handled360Intent = useRef(false);
  useEffect(() => {
    if (handled360Intent.current || !start360Upload) return;
    handled360Intent.current = true;
    setCaptureForm((current) => ({ ...current, type: "panorama" }));
    setFile(null);
    setShowUpload(true);
    onStart360UploadConsumed?.();
  }, [onStart360UploadConsumed, start360Upload]);

  const tour = orderedTour(captures, activeCapture);
  const tourIndex = activeCapture ? tour.findIndex((capture: VisualCapture) => capture.id === activeCapture.id) : -1;

  /**
   * What the chosen 360° image is, said plainly: how large it is, how much of the sphere it
   * covers and what happens to it on the way in. It replaces the old refusal, which sent a
   * supervisor back to his laptop for an export the viewer could have shown all along.
   */
  const panoramaSummary = (() => {
    if (captureForm.type !== "panorama" || !panoramaImage) return null;
    const pixels = `${panoramaImage.width} × ${panoramaImage.height}`;
    const scaling = file && file.size > maxFileSizeBytes
      ? text(
        ` This export is ${humanFileSize(file.size)}, so it is scaled to fit the ${data.settings?.max_file_size_mb ?? 25} MB project limit before uploading.`,
        ` Deze export is ${humanFileSize(file.size)} en wordt vóór het uploaden geschaald naar de projectlimiet van ${data.settings?.max_file_size_mb ?? 25} MB.`,
      )
      : "";
    if (panoramaImage.projection === "partial-vertical") {
      return text(
        `${pixels} pixels · covers the full circle with a reduced height, and is shown on that part of the sphere.${scaling}`,
        `${pixels} pixels · bedekt de volledige cirkel met een beperkte hoogte en wordt op dat deel van de bol getoond.${scaling}`,
      );
    }
    if (panoramaImage.projection === "partial-horizontal") {
      return text(
        `${pixels} pixels · covers part of the circle, and is shown on that part of the sphere.${scaling}`,
        `${pixels} pixels · bedekt een deel van de cirkel en wordt op dat deel van de bol getoond.${scaling}`,
      );
    }
    if (panoramaImage.notice === "resolution") {
      return text(
        `${pixels} pixels · a full 360° image. Zooming in shows less detail than a 3840 × 1920 export or larger.${scaling}`,
        `${pixels} pixels · een volledig 360°-beeld. Inzoomen toont minder detail dan een export van 3840 × 1920 of groter.${scaling}`,
      );
    }
    return text(
      `${pixels} pixels · a full equirectangular 360° image.${scaling}`,
      `${pixels} pixels · een volledig equirectangulair 360°-beeld.${scaling}`,
    );
  })();

  const captureTitle = photoTitleFromDescription(
    captureForm.description,
    captureForm.type === "panorama" ? text("360° camera image", "360°-camerabeeld") : text("Field photo", "Veldfoto"),
  );

  const uploadCapture = async () => {
    if (!file || captureForm.description.trim().length < 3 || uploadingRef.current) return;
    if (!validTourPosition(captureForm.tourName, captureForm.tourOrder)) {
      setFileError(text("Enter a tour position from 1 to 10000.", "Vul een tourpositie van 1 tot 10000 in."));
      return;
    }
    uploadingRef.current = true;
    const generation = stagedImageRef.current;
    try {
    setFileError("");
    // The bytes decide what the image is. Some Android cameras label a JPEG "image/jpg" or
    // leave the type empty; turning those away meant a photo taken on site was never saved.
    let source: File = file;
    try {
      // The only thing that can stop a 360° image here is an image the browser cannot read at
      // all; how much of the sphere it covers is shown on the form, not enforced.
      const detected = imageContentType(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
      if (!detected) throw new Error("invalid-image-type");
      if (detected !== file.type) source = new File([file], file.name, { type: detected, lastModified: file.lastModified });
      const dimensions = await imageDimensions(source);
      if (generation !== stagedImageRef.current) return;
      if (captureForm.type === "panorama" && !describePanoramaImage(dimensions.width, dimensions.height).valid) {
        throw new Error("invalid-image");
      }
    } catch {
      setFileError(text("The selected file is not a readable image.", "Het gekozen bestand is geen leesbare afbeelding."));
      return;
    }
    const folderName = captureForm.type === "panorama" ? text("360° tours", "360°-rondgangen") : text("Daily progress", "Dagvoortgang");
    const prepared = captureForm.type === "photo"
      ? { ...await compressFieldPhoto(source, dataSaverEnabled()), fits: true }
      : await preparePanoramaUpload(source, maxFileSizeBytes);
    if (generation !== stagedImageRef.current) return;
    if (!prepared.fits) {
      setFileError(text(
        `This 360° image is ${humanFileSize(file.size)} and could not be reduced to the project limit of ${data.settings?.max_file_size_mb ?? 25} MB on this device. Export it at a smaller resolution, or raise the limit in project settings.`,
        `Dit 360°-beeld is ${humanFileSize(file.size)} en kon op dit apparaat niet worden teruggebracht tot de projectlimiet van ${data.settings?.max_file_size_mb ?? 25} MB. Exporteer het op een lagere resolutie of verhoog de limiet in de projectinstellingen.`,
      ));
      return;
    }
    // The direction is the one thing the picture cannot show, so it stays in the words that
    // travel with it into the register.
    const description = [
      captureForm.description.trim(),
      captureForm.direction
        ? `${text("Facing", "Kijkrichting")} ${language === "en" ? captureForm.direction : dutchDirectionLabels[captureForm.direction] ?? captureForm.direction}`
        : "",
    ].filter(Boolean).join("\n");
    const okay = await run(async () => {
      // A photo that shows two buildings is filed under both, so neither register misses it.
      // A project with a single building never reaches the button row, so the primary
      // building stands in for an empty choice.
      for (const targetBuildingId of captureBuildingIds.length ? captureBuildingIds : [captureBuildingId]) {
        const existingFolder = data.mediaFolders.find((folder) => (!folder.building_id || folder.building_id === targetBuildingId) && folder.name.toLocaleLowerCase() === folderName.toLocaleLowerCase());
        const queued = await queueOfflineUpload({
          projectId,
          buildingId: targetBuildingId,
          reportId,
          folderId: existingFolder?.id ?? null,
          folderName,
          kind: captureForm.type,
          file: prepared.blob,
          fileName: prepared.fileName,
          mimeType: prepared.mimeType,
          title: captureTitle,
          description,
          locationLabel: captureLocationLabel,
          locationNodeId: targetBuildingId === captureBuildingId ? captureForm.locationNodeId || null : null,
          drawingPin: drawingLocation && targetBuildingId === captureBuildingId ? {
            fileId: drawingLocation.fileId,
            pageNumber: drawingLocation.pageNumber,
            xRatio: drawingLocation.xRatio,
            yRatio: drawingLocation.yRatio,
          } : null,
          tourName: captureForm.tourName || null,
          tourOrder: captureForm.tourName ? Number(captureForm.tourOrder) : null,
          capturedAt: new Date(file.lastModified || Date.now()).toISOString(),
          originalSize: file.size,
          queuedSize: prepared.blob.size,
          compressed: "compressed" in prepared ? prepared.compressed : prepared.resized,
        });
        if (targetBuildingId === captureBuildingId) setPendingSelectionFileId(queued.id);
      }
      // The image is in the device queue from here on. A send that does not go through leaves
      // it there for Send now; it must not keep the form open, because saving again filed the
      // same photo a second time.
      if (navigator.onLine) {
        await forceSyncOfflineUploads(client, projectId, {
          paused: "",
          failed: () => "",
        }).catch(() => undefined);
      }
    }, text("Saved on this device. Sent when you're online.", "Opgeslagen op dit apparaat. Wordt verstuurd zodra je online bent."));
    if (okay) void clearFormDraft(formDraftKey("quick-photo", projectId));
    if (okay && generation === stagedImageRef.current) {
      setCaptureForm(emptyCaptureForm);
      setDrawingLocation(null);
      setFile(null);
      setFileError("");
      setPhotoMarkerCount(0);
      setPanoramaImage(null);
      setShowUpload(false);
    }
    } catch (caught) {
      setFileError(caught instanceof Error ? caught.message : text("Image upload failed. Try again.", "Upload mislukt. Probeer opnieuw."));
    } finally { uploadingRef.current = false; }

  };

  const saveIssue = async () => {
    if (!activeCapture || !point || issue.title.trim().length < 3 || issue.description.trim().length < 3) return;
    let savedCaptureId = activeCapture.id;
    const okay = await run(
      async () => {
        // Historical media-library images are projected into this screen without a data
        // migration. The first marker materialises their capture row before writing the link.
        if (activeCapture.derived_from_file) {
          const materialized = await createVisualCapture(client, {
            projectId,
            buildingId: activeCapture.building_id || captureBuildingId,
            dayReportId: activeCapture.day_report_id,
            fileId: activeCapture.file_id,
            locationNodeId: activeCapture.location_node_id || undefined,
            captureType: "photo",
            title: activeCapture.title,
            description: activeCapture.description || undefined,
            locationLabel: activeCapture.location_label || captureBuildingName,
            capturedAt: activeCapture.captured_at,
          });
          savedCaptureId = materialized.id;
        }
        return existingFinding
        ? linkVisualAnnotationToFinding(client, {
            captureId: savedCaptureId,
            findingId: existingFinding.id,
            coordinateMode: point.mode,
            xRatio: point.mode === "photo" ? point.xRatio : null,
            yRatio: point.mode === "photo" ? point.yRatio : null,
            yaw: point.mode === "spherical" ? point.yaw : null,
            pitch: point.mode === "spherical" ? point.pitch : null,
            description: issue.description,
          })
        : createVisualAnnotationFinding(client, {
            captureId: savedCaptureId,
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
            buildingIds: issue.buildingIds.length ? issue.buildingIds : undefined,
            projectId,
            disposition: issue.disposition,
            signedBy: issueSignature?.name,
            signedAt: issueSignature?.signedAt,
            signatureImage: issueSignature?.image ?? null,
          });
      },
      existingFinding
        ? text(`Marker linked to ${existingFinding.finding_number}.`, `Marker gekoppeld aan ${existingFinding.finding_number}.`)
        : text("Marker and finding created.", "Markering en bevinding aangemaakt."),
    );
    if (okay) {
      setActiveCaptureId(savedCaptureId);
      setPendingSelectionFileId("");
      setPoint(null);
      setIssue(emptyIssue);
      setIssueSignature(null);
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
        <div><span className="record-number">{text("Visual evidence", "Visueel bewijs")}</span></div>
        <div className="visual-toolbar-actions">
          <input ref={cameraInputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { stageImage(event.currentTarget.files?.[0] ?? null, "photo"); event.currentTarget.value = ""; }} />
          {/* The compass is started on the tap that opens the camera: it is the gesture a phone
              needs before it hands out its orientation, and it is the moment the reading matters. */}
          <button className="ui-button ui-button--primary ui-button--md camera-primary-action" type="button" disabled={!isStorageGatewayConfigured} onClick={() => { void startCompassWatch(); cameraInputRef.current?.click(); }}><Camera size={17} /> {text("Take photo", "Maak foto")}</button>
          <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={!isStorageGatewayConfigured} onClick={() => { setCaptureForm({ ...captureForm, type: "panorama" }); setFile(null); setShowUpload(true); }}><ScanLine size={16} /> {text("Upload 360°", "Upload 360°")}</button>
        </div>
      </div>

      {existingFinding ? <div className="operation-alert success visual-finding-link-banner"><CircleDot size={18} /><div><strong>{text(`Selected issue: ${existingFinding.finding_number}`, `Geselecteerd issue: ${existingFinding.finding_number}`)} · {existingFinding.title}</strong><span>{text("Click the exact problem location on the image.", "Klik op de exacte probleemlocatie op de afbeelding.")}</span></div></div> : null}
      {cameraHandoff && showUpload ? <div className="operation-alert success visual-camera-handoff"><Camera size={18} /><div><strong>{text("Step 1 of 2 · confirm and save this photo", "Stap 1 van 2 · bevestig en sla deze foto op")}</strong><span>{text("Click the location on the photo to create or link an Issue or NCR.", "Klik op de locatie op de foto om een Issue of NCR aan te maken of te koppelen.")}</span></div></div> : null}

      {!isStorageGatewayConfigured ? <div className="operation-alert warning"><ShieldCheck size={18} /><div><strong>{text("Private image storage must be connected", "Private beeldopslag moet worden gekoppeld")}</strong><span>{text("Storage is not configured. Ask an administrator.", "Opslag is niet geconfigureerd. Vraag het een beheerder.")}</span></div></div> : null}

      {showUpload ? (
        <div className="operation-form wide visual-upload-form">
          <div className="operation-form-heading"><div><span className="record-number">{text("New visual evidence", "Nieuw visueel bewijs")}</span><h2>{captureForm.type === "panorama" ? text("Upload 360° camera image", "Upload 360°-camerabeeld") : text("Photo ready to save", "Foto klaar om op te slaan")}</h2></div><span className="experimental-badge">{captureForm.type === "panorama" ? text("360° camera source", "360°-camerabron") : text("Point & shoot", "Richten & klaar")}</span></div>
          {captureForm.type === "photo" && filePreviewUrl ? (
            <div className="visual-photo-preview">
              {/* A local blob URL cannot pass through the Next image optimizer. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={filePreviewUrl}
                alt={text("Captured photo preview", "Voorbeeld van gemaakte foto")}
                role="button"
                tabIndex={0}
                onClick={() => setMarkingPhoto(true)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setMarkingPhoto(true); } }}
              />
              {/* Marking before saving keeps the point on the picture even when the photo later
                  travels outside the app, in a report or an e-mail. */}
              <MarkPhotoButton markerCount={photoMarkerCount} onClick={() => setMarkingPhoto(true)} />
            </div>
          ) : null}
          {markingPhoto && file ? (
            <PhotoMarkupPad
              file={file}
              context={{
                buildings: buildings.map((building) => ({ id: building.id, label: building.name })),
                defaultBuildingId: captureBuildingId,
                locations: data.locationNodes.map((node) => ({ id: node.id, label: `${node.code} · ${node.name}`, buildingId: node.building_id })),
                parties: parties.map((party) => ({ id: party.id, label: party.name })),
              }}
              close={() => setMarkingPhoto(false)}
              save={({ file: marked, report, markerCount }) => {
                setFile(marked);
                setPhotoMarkerCount(markerCount);
                if (report) setCaptureForm((current) => ({ ...current, description: appendPhotoDetail(current.description, report) }));
                setMarkingPhoto(false);
              }}
            />
          ) : null}
          {captureForm.type === "panorama"
            ? <label className="form-field"><span>{text("360° image · every 360° camera export · JPEG, PNG, WebP or Insta360 .insp", "360°-beeld · elke 360°-camera-export · JPEG, PNG, WebP of Insta360 .insp")}</span><input type="file" accept={`image/jpeg,image/png,image/webp,${panoramaFileExtensions.join(",")}`} onChange={(event) => stageImage(event.currentTarget.files?.[0] ?? null, "panorama")} /></label>
            : <div className="visual-review-actions"><button className="ui-button ui-button--secondary ui-button--md visual-retake-button" type="button" onClick={() => { void startCompassWatch(); cameraInputRef.current?.click(); }}><Camera size={16} /> {text("Retake photo", "Foto opnieuw maken")}</button><button className="ui-button ui-button--secondary ui-button--md visual-discard-button" type="button" onClick={discardCapture}>{text("Discard photo", "Foto verwijderen")}</button></div>}

          {/* One text box, in the supervisor's own words. Everything else on this form is
              either a tap or something the app fills in by itself. */}
          <label className="form-field">
            <span>{text("Description", "Omschrijving")}</span>
            <textarea
              rows={3}
              value={captureForm.description}
              onChange={(event) => setCaptureForm({ ...captureForm, description: event.target.value })}
            />
            <DictateButton onText={(transcript) => setCaptureForm((current) => ({ ...current, description: appendDictation(current.description, transcript) }))} />
          </label>

          <BuildingChoiceField
            id="capture-building"
            buildings={buildings}
            value={captureBuildingIds}
            onChange={(next) => { setCaptureBuildingIds(next); setCaptureForm((current) => ({ ...current, locationNodeId: "" })); setDrawingLocation(null); }}
          />

          <div className="form-grid-2">
            {/* Only shown when there is something to choose. Without a location tree and
                without a drawing this field could only repeat the building, and repeating
                what the buttons above already say is the noise the client struck through. */}
            {captureLocationNodes.length || captureDrawings.length ? (
              <div className="form-field capture-location-field">
                <span>{text("Where on the project", "Waar op het project")}</span>
                <div className="capture-location-row">
                  {captureLocationNodes.length ? (
                    <select value={captureForm.locationNodeId} onChange={(event) => setCaptureForm({ ...captureForm, locationNodeId: event.target.value })} aria-label={text("Project location", "Projectlocatie")}>
                      <option value="">{text("Building level", "Op gebouwniveau")}</option>
                      {captureLocationNodes.map((node) => <option value={node.id} key={node.id}>{node.code} · {node.name}</option>)}
                    </select>
                  ) : null}
                  {captureDrawings.length ? (
                    <button className="ui-button ui-button--secondary ui-button--md capture-drawing-button" type="button" onClick={() => setPickingDrawingLocation(true)}>
                      <MapPin size={15} /> {drawingLocation ? text("Change drawing or spot", "Tekening of plek wijzigen") : text("Choose drawing & point", "Tekening kiezen & aanwijzen")}
                    </button>
                  ) : null}
                </div>
                <small>{drawingLocation
                  ? text(`Pointed at: ${drawingLocationLabel(drawingLocation, "page")}`, `Aangewezen op: ${drawingLocationLabel(drawingLocation, "pagina")}`)
                  : text(`Saved as: ${captureLocationLabel}`, `Wordt opgeslagen als: ${captureLocationLabel}`)}</small>
              </div>
            ) : null}
          </div>

          {pickingDrawingLocation ? (
            <DrawingLocationPicker
              drawings={captureDrawings}
              buildings={buildings}
              client={client}
              initial={drawingLocation}
              close={() => setPickingDrawingLocation(false)}
              save={(location) => { setDrawingLocation(location); setPickingDrawingLocation(false); }}
            />
          ) : null}
          {captureForm.type === "panorama" ? <div className="form-grid-2"><label className="form-field"><span>{text("Tour name · optional", "Tournaam · optioneel")}</span><input value={captureForm.tourName} onChange={(event) => setCaptureForm({ ...captureForm, tourName: event.target.value })} placeholder={text("Ground floor walkthrough", "Rondgang begane grond")} /></label><label className="form-field"><span>{text("Position in tour", "Volgorde in tour")}</span><input type="number" min="1" max="10000" disabled={!captureForm.tourName} value={captureForm.tourOrder} onChange={(event) => setCaptureForm({ ...captureForm, tourOrder: event.target.value })} /></label></div> : null}
          {captureForm.type === "panorama" ? <div className="operation-alert"><ScanLine size={18} /><div><span>{panoramaSummary ?? text("Larger exports are scaled to the project limit before upload.", "Grotere exports worden vóór het uploaden verkleind tot de projectlimiet.")}</span></div></div> : null}
          {file && captureForm.type === "photo" && file.size > maxFileSizeBytes ? <p className="field-error">{text("This image exceeds the project file limit.", "Deze afbeelding is groter dan de bestandslimiet van het project.")}</p> : null}
          {fileError ? <p className="field-error" role="alert">{fileError}</p> : null}
          {file && captureForm.description.trim().length < 3 ? <p className="form-intro">{text("Write one line about this photo to save it.", "Schrijf één regel over deze foto om hem op te slaan.")}</p> : null}
          <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || !file || (captureForm.type === "photo" && file.size > maxFileSizeBytes) || !fieldPhotoMimeTypes.includes(file.type) || captureForm.description.trim().length < 3 || (captureForm.type === "panorama" && (!panoramaImage || Boolean(fileError) || !validTourPosition(captureForm.tourName, captureForm.tourOrder)))} onClick={() => void uploadCapture()}>{busy ? <Loader2 className="spin" size={15} /> : <Camera size={15} />} {captureForm.type === "panorama" ? text("Secure and sync 360° image", "Beveilig en synchroniseer 360°-beeld") : text("Save photo", "Foto opslaan")}</button>
        </div>
      ) : null}

      {/* While a photo is waiting to be saved the screen shows that photo and nothing else.
          The client crossed out the library, the annotated photo and the marker panel below
          this form: on site they are three more things to read past before saving. */}
      {captures.length && !showUpload ? (
        <div className="visual-workspace-grid">
          <section className="visual-capture-list" aria-label={text("Visual evidence list", "Lijst visueel bewijs")}>
            {captures.map((capture) => {
              const count = data.visualAnnotations.filter((annotation) => annotation.capture_id === capture.id && annotation.status === "active").length;
              return <button type="button" className={activeCapture?.id === capture.id ? "active" : ""} onClick={() => { setPendingSelectionFileId(""); setActiveCaptureId(capture.id); setPoint(null); setSelectedAnnotationId(null); }} key={capture.id}><span className="visual-list-icon">{capture.capture_type === "panorama" ? <ScanLine size={17} /> : <ImageIcon size={17} />}</span><span><strong>{capture.title}</strong><small>{capture.location_label} · {count} {text(count === 1 ? "issue" : "issues", count === 1 ? "probleem" : "problemen")}</small></span>{capture.capture_type === "panorama" ? <em>360°</em> : null}</button>;
            })}
          </section>
          <div className="visual-stage-column">
            {activeCapture && activeFile ? (
              <>
                <div className="visual-stage-header"><div><span className="record-number">{activeCapture.capture_type === "panorama" ? text("Interactive 360° camera image", "Interactief 360°-camerabeeld") : text("Annotated photo", "Geannoteerde foto")}</span><h2>{activeCapture.title}</h2><p><MapPin size={13} /> {activeCapture.location_label}{activeCapture.tour_name ? ` · ${activeCapture.tour_name}` : ""}</p></div>{tour.length > 1 ? <div className="tour-controls"><button type="button" aria-label={text("Previous 360° camera image", "Vorig 360°-camerabeeld")} onClick={() => chooseTourCapture(-1)}><ChevronLeft size={17} /></button><span>{tourIndex + 1} / {tour.length}</span><button type="button" aria-label={text("Next 360° camera image", "Volgend 360°-camerabeeld")} onClick={() => chooseTourCapture(1)}><ChevronRight size={17} /></button></div> : null}</div>
                <VisualViewer key={activeCapture.id} capture={activeCapture} file={activeFile} annotations={activeAnnotations} pendingPoint={point} focusAnnotationId={selectedAnnotationId} client={client} onPoint={(nextPoint) => { setPoint(nextPoint); setSelectedAnnotationId(null); }} onSelectAnnotation={(annotationId) => { setSelectedAnnotationId(annotationId); setPoint(null); }} />
                <div className="visual-stage-help"><CircleDot size={15} /><span>{activeCapture.capture_type === "panorama"
                  ? text("Drag to look around, pinch to zoom, then tap the damaged area to place a marker.", "Sleep om rond te kijken, knijp om te zoomen en tik op het beschadigde gebied om een markering te plaatsen.")
                  : text("Click the damaged area to place a marker.", "Klik op het beschadigde gebied om een markering te plaatsen.")}</span></div>
                {/* Everything the picture itself carries — the same words a normal photo gets
                    — next to the image instead of only in the upload form. */}
                <CaptureDetails capture={activeCapture} file={activeFile} client={client} />
                <VisualMarkerList annotations={activeAnnotations} findings={data.findings} selectedId={selectedAnnotationId} onSelect={(annotationId) => { setSelectedAnnotationId(annotationId); setPoint(null); }} />
              </>
            ) : null}
          </div>
          <div className="visual-issue-panel">
            {point && activeCapture ? <IssueForm point={point} capture={activeCapture} issue={issue} setIssue={setIssue} findings={data.findings} annotations={data.visualAnnotations} existingFindingId={existingFindingId} setExistingFindingId={setExistingFindingId} parties={parties} buildings={buildings} captureBuildingId={captureBuildingId} busy={busy} signature={issueSignature} setSignature={setIssueSignature} save={() => void saveIssue()} cancel={() => { setPoint(null); setIssue(emptyIssue); setIssueSignature(null); setExistingFindingId(""); }} /> : selectedAnnotation && selectedFinding ? <AnnotationDetails annotation={selectedAnnotation} finding={selectedFinding} /> : <div className="visual-panel-empty"><ScanLine size={24} /><strong>{text("Select or place a marker", "Selecteer of plaats een marker")}</strong></div>}
          </div>
        </div>
      ) : showUpload ? null : <div className="empty-list-state visual-empty"><Camera size={24} /><strong>{text("No project photos yet", "Nog geen projectfoto's")}</strong><button className="ui-button ui-button--primary ui-button--md" type="button" onClick={() => cameraInputRef.current?.click()}><Camera size={15} /> {text("Take photo", "Maak foto")}</button></div>}
    </section>
  );
}

function VisualViewer({ capture, file, annotations, pendingPoint, focusAnnotationId, client, onPoint, onSelectAnnotation }: { capture: VisualCapture; file: FileRecord; annotations: VisualAnnotation[]; pendingPoint: VisualPoint | null; focusAnnotationId: string | null; client: SupabaseClient; onPoint: (point: VisualPoint) => void; onSelectAnnotation: (annotationId: string) => void }) {
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
  if (capture.capture_type === "panorama") return <PanoramaViewer imageUrl={imageUrl} annotations={annotations} pendingPoint={pendingPoint?.mode === "spherical" ? pendingPoint : null} focusAnnotationId={focusAnnotationId} onPoint={onPoint} onSelectAnnotation={onSelectAnnotation} />;
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

/** The same colour as the dot on the image, for the dot the compass draws for it. */
function markerToneColor(annotation: VisualAnnotation) {
  if (annotation.disposition && photoMarkupToneColors[annotation.disposition]) return photoMarkupToneColors[annotation.disposition];
  if (annotation.severity === "critical") return photoMarkupToneColors.alternative_solution;
  if (annotation.severity === "low") return photoMarkupToneColors.validated;
  return photoMarkupToneColors.to_be_corrected;
}

/**
 * Whether this 360° file is the raw output of a two-lens camera instead of a stitched sphere.
 * The file is looked at in miniature — a few hundred pixels wide — so a phone never decodes a
 * full 8K export twice, and only the brightness of the corners and middles of both halves is
 * read. Anything that cannot be sampled is treated as an ordinary stitched sphere.
 */
async function detectDualFisheye(imageUrl: string) {
  if (typeof createImageBitmap !== "function") return false;
  let bitmap: ImageBitmap | null = null;
  try {
    const blob = await (await fetch(imageUrl)).blob();
    bitmap = await createImageBitmap(blob, { resizeWidth: 320, resizeQuality: "low" });
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
    if (!context) return false;
    context.drawImage(bitmap, 0, 0);
    const patch = Math.max(4, Math.round(bitmap.width / 32));
    const luminance = (x: number, y: number) => {
      const { data } = context.getImageData(x, y, patch, patch);
      let total = 0;
      for (let index = 0; index < data.length; index += 4) {
        total += (0.2126 * data[index]) + (0.7152 * data[index + 1]) + (0.0722 * data[index + 2]);
      }
      return total / (data.length / 4);
    };
    const half = Math.floor(bitmap.width / 2);
    const right = bitmap.width - patch;
    const bottom = bitmap.height - patch;
    const corners = [
      luminance(0, 0), luminance(half - patch, 0), luminance(0, bottom), luminance(half - patch, bottom),
      luminance(half, 0), luminance(right, 0), luminance(half, bottom), luminance(right, bottom),
    ];
    const centers = [
      luminance(Math.round(half / 2), Math.round(bitmap.height / 2) - patch),
      luminance(half + Math.round(half / 2), Math.round(bitmap.height / 2) - patch),
    ];
    return looksLikeDualFisheye({ ratio: bitmap.width / bitmap.height, corners, centers });
  } catch {
    return false;
  } finally {
    bitmap?.close();
  }
}

/**
 * The interactive 360° image. A supervisor has to be able to do the same things here as with
 * an ordinary photo: come closer, look in a chosen direction, see which markings are already
 * on the image and put a new one exactly on the defect. Everything is a labelled button as
 * well as a gesture, because on site the gesture alone was not discovered.
 */
export function PanoramaViewer({ imageUrl, annotations, pendingPoint, focusAnnotationId, onPoint, onSelectAnnotation }: { imageUrl: string; annotations: VisualAnnotation[]; pendingPoint: Extract<VisualPoint, { mode: "spherical" }> | null; focusAnnotationId: string | null; onPoint: (point: VisualPoint) => void; onSelectAnnotation: (annotationId: string) => void }) {
  const { text } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<import("@photo-sphere-viewer/core").Viewer | null>(null);
  const markersRef = useRef<import("@photo-sphere-viewer/markers-plugin").MarkersPlugin | null>(null);
  const autorotateRef = useRef<import("@photo-sphere-viewer/autorotate-plugin").AutorotatePlugin | null>(null);
  const gyroscopeRef = useRef<import("@photo-sphere-viewer/gyroscope-plugin").GyroscopePlugin | null>(null);
  const onPointRef = useRef(onPoint);
  const onSelectAnnotationRef = useRef(onSelectAnnotation);
  const markerDataRef = useRef({ annotations, pendingPoint });
  const [viewerState, setViewerState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  /** Where the viewer is looking, in whole degrees, so two people can name the same spot. */
  const [heading, setHeading] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(45);
  const [autorotating, setAutorotating] = useState(false);
  const [gyroscope, setGyroscope] = useState<"unavailable" | "off" | "on">("unavailable");

  useEffect(() => {
    onPointRef.current = onPoint;
    onSelectAnnotationRef.current = onSelectAnnotation;
    markerDataRef.current = { annotations, pendingPoint };
  }, [annotations, onPoint, onSelectAnnotation, pendingPoint]);

  useEffect(() => {
    let active = true;
    if (!containerRef.current) return;
    setViewerState("loading");
    setGyroscope("unavailable");
    setAutorotating(false);
    void Promise.all([
      import("@photo-sphere-viewer/core"),
      import("@photo-sphere-viewer/markers-plugin"),
      import("@photo-sphere-viewer/autorotate-plugin"),
      import("@photo-sphere-viewer/compass-plugin"),
      import("@photo-sphere-viewer/gyroscope-plugin"),
      // A raw two-lens original has to be projected differently from a stitched sphere, and
      // the picture itself is what says which of the two this is.
      detectDualFisheye(imageUrl),
    ]).then(([core, markers, autorotate, compass, gyro, dualFisheye]) => {
      if (!active || !containerRef.current) return;
      const viewer = new core.Viewer({
        container: containerRef.current,
        panorama: imageUrl,
        // A stitched export is placed on the sphere by the viewer itself: it believes the
        // camera's own sphere metadata when the file carries it, and otherwise reads the
        // proportions, so a wider strip or a narrower one lands on the part of the sphere it
        // covers. A raw two-lens original carries no such geometry and needs its own adapter.
        adapter: dualFisheye ? core.DualFisheyeAdapter : undefined,
        plugins: [
          [markers.MarkersPlugin, { clickEventOnMarker: true }],
          // A slow turn on its own, so a 360° image can be shown to somebody without
          // anybody having to drag it.
          [autorotate.AutorotatePlugin, { autostartDelay: null, autorotateSpeed: "1rpm" }],
          // The compass says which way the camera is looking and marks where the existing
          // problem markers sit, so a marker behind your back is still findable.
          [compass.CompassPlugin, { size: "88px", position: "top left", navigation: true, hotspots: [] }],
          [gyro.GyroscopePlugin, { touchmove: true, absolutePosition: false }],
        ],
        // The viewer's own bar is switched off: this screen offers the same controls as
        // labelled buttons, and two rows of controls on one image only confused the choice.
        navbar: false,
        mousewheelCtrlKey: false,
        touchmoveTwoFingers: false,
        defaultZoomLvl: 45,
        lang: { loadError: text("The 360° image could not be rendered.", "Het 360°-beeld kon niet worden weergegeven."), fullscreen: text("Fullscreen", "Volledig scherm"), zoom: text("Zoom", "Zoom") },
      });
      const markerPlugin = viewer.getPlugin<import("@photo-sphere-viewer/markers-plugin").MarkersPlugin>(markers.MarkersPlugin);
      const autorotatePlugin = viewer.getPlugin<import("@photo-sphere-viewer/autorotate-plugin").AutorotatePlugin>(autorotate.AutorotatePlugin);
      const gyroscopePlugin = viewer.getPlugin<import("@photo-sphere-viewer/gyroscope-plugin").GyroscopePlugin>(gyro.GyroscopePlugin);
      viewer.addEventListener(core.events.ClickEvent.type, ({ data }) => {
        if (!data.marker) onPointRef.current({ mode: "spherical", yaw: data.yaw, pitch: data.pitch });
      });
      markerPlugin.addEventListener(markers.events.SelectMarkerEvent.type, ({ marker }) => {
        if (!marker.id.startsWith("pending:")) onSelectAnnotationRef.current(marker.id);
      });
      viewer.addEventListener(core.events.PositionUpdatedEvent.type, ({ position }) => {
        if (active) setHeading(Math.round(((position.yaw * (180 / Math.PI)) % 360 + 360) % 360));
      });
      viewer.addEventListener(core.events.ZoomUpdatedEvent.type, ({ zoomLevel: level }) => {
        if (active) setZoomLevel(Math.round(level));
      });
      autorotatePlugin.addEventListener(autorotate.events.AutorotateEvent.type, ({ autorotateEnabled }) => {
        if (active) setAutorotating(autorotateEnabled);
      });
      viewer.addEventListener(core.events.ReadyEvent.type, () => {
        if (active) setViewerState("ready");
      });
      viewer.addEventListener(core.events.PanoramaErrorEvent.type, () => {
        if (active) setViewerState("error");
      });
      viewerRef.current = viewer;
      markersRef.current = markerPlugin;
      autorotateRef.current = autorotatePlugin;
      gyroscopeRef.current = gyroscopePlugin;
      markerPlugin.setMarkers(panoramaMarkers(markerDataRef.current.annotations, markerDataRef.current.pendingPoint));
      // A phone that can be pointed around the room is the closest thing to standing there
      // again; a laptop simply does not offer the button.
      void gyroscopePlugin.isSupported().then((supported) => {
        if (active) setGyroscope(supported ? "off" : "unavailable");
      }).catch(() => undefined);
    }).catch(() => {
      if (active) { viewerRef.current?.destroy(); viewerRef.current = null; setViewerState("error"); }
    });
    return () => {
      active = false;
      markersRef.current = null;
      autorotateRef.current = null;
      gyroscopeRef.current = null;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, [imageUrl, retry, text]);

  useEffect(() => {
    markersRef.current?.setMarkers(panoramaMarkers(annotations, pendingPoint));
  }, [annotations, pendingPoint]);

  // Choosing a marking in the list turns the view towards it, so a marker that is behind you
  // is reachable without hunting for it.
  useEffect(() => {
    if (!focusAnnotationId || viewerState !== "ready") return;
    const annotation = annotations.find((item) => item.id === focusAnnotationId);
    if (!annotation || annotation.yaw === null || annotation.pitch === null) return;
    autorotateRef.current?.stop();
    viewerRef.current?.animate({ yaw: Number(annotation.yaw), pitch: Number(annotation.pitch), speed: "3rpm" });
  }, [annotations, focusAnnotationId, viewerState]);

  const markCenter = () => {
    const position = viewerRef.current?.getPosition();
    if (position) onPoint({ mode: "spherical", yaw: position.yaw, pitch: position.pitch });
  };

  const resetView = () => {
    autorotateRef.current?.stop();
    viewerRef.current?.animate({ yaw: 0, pitch: 0, zoom: 45, speed: "6rpm" });
  };

  const toggleAutorotate = () => {
    const plugin = autorotateRef.current;
    if (!plugin) return;
    if (plugin.isEnabled()) plugin.stop();
    else plugin.start();
  };

  const toggleGyroscope = () => {
    const plugin = gyroscopeRef.current;
    if (!plugin) return;
    if (plugin.isEnabled()) {
      plugin.stop();
      setGyroscope("off");
      return;
    }
    void plugin.start().then(() => setGyroscope("on")).catch(() => setGyroscope("unavailable"));
  };

  return <div className="panorama-stage" data-viewer-state={viewerState}>
    <div className="panorama-viewer" ref={containerRef} />
    {viewerState === "loading" ? <div className="panorama-status"><Loader2 className="spin" size={22} /> {text("Opening interactive 360° image…", "Interactief 360°-beeld openen…")}</div> : null}
    {viewerState === "error" ? <div className="panorama-status error"><AlertTriangle size={22} /><span>{text("The 360° viewer could not start on this device.", "De 360°-viewer kon niet starten op dit apparaat.")}</span><button type="button" onClick={() => setRetry((value) => value + 1)}>{text("Try again", "Probeer opnieuw")}</button></div> : null}
    {viewerState === "ready" ? (
      <>
        <span className="panorama-heading" aria-live="off"><Compass size={13} /> {heading}° · {text("zoom", "zoom")} {zoomLevel}%</span>
        <div className="panorama-controls" role="group" aria-label={text("360° viewer controls", "Bediening 360°-viewer")}>
          <button type="button" onClick={() => viewerRef.current?.zoomOut(10)} aria-label={text("Zoom out", "Uitzoomen")}><ZoomOut size={15} /></button>
          <button type="button" onClick={() => viewerRef.current?.zoomIn(10)} aria-label={text("Zoom in", "Inzoomen")}><ZoomIn size={15} /></button>
          <button type="button" onClick={resetView}><RotateCcw size={14} /> {text("Reset view", "Beginstand")}</button>
          <button className={autorotating ? "active" : ""} type="button" aria-pressed={autorotating} onClick={toggleAutorotate}>{autorotating ? <Pause size={14} /> : <Play size={14} />} {text("Auto turn", "Vanzelf draaien")}</button>
          {gyroscope !== "unavailable" ? <button className={gyroscope === "on" ? "active" : ""} type="button" aria-pressed={gyroscope === "on"} onClick={toggleGyroscope}><Move3d size={14} /> {text("Move phone to look", "Kijken met de telefoon")}</button> : null}
          <button type="button" onClick={() => viewerRef.current?.toggleFullscreen()}><Maximize2 size={14} /> {text("Fullscreen", "Volledig scherm")}</button>
        </div>
      </>
    ) : null}
    {viewerState === "ready" ? <button className="viewer-center-action" type="button" onClick={markCenter}><CircleDot size={15} /> {text("Mark center of current view", "Markeer midden van huidige weergave")}</button> : null}
  </div>;
}

/**
 * What this picture is, in its own words, next to the picture. A regular photo carries a
 * title, a description, a category and a direction; the 360° export carries exactly the same
 * words, and here they are readable without opening the upload form again.
 */
function CaptureDetails({ capture, file, client }: { capture: VisualCapture; file: FileRecord; client: SupabaseClient }) {
  const { locale, text } = useLanguage();
  const [failed, setFailed] = useState("");
  const capturedAt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "America/Paramaribo" }).format(new Date(capture.captured_at));
  const run = (operation: Promise<unknown>) => {
    setFailed("");
    void operation.catch(() => setFailed(text("The secured file could not be opened. Check the connection and try again.", "Het beveiligde bestand kon niet worden geopend. Controleer de verbinding en probeer opnieuw.")));
  };
  return (
    <section className="capture-details" aria-label={text("Details of this image", "Details van dit beeld")}>
      <div className="capture-details-copy">
        <span className="record-number">{capture.capture_type === "panorama" ? text("360° camera export", "360°-camera-export") : text("Field photo", "Veldfoto")}</span>
        <h3>{capture.title}</h3>
        {/* The category and the facing direction were written next to the photo when it was
            saved; they are part of its description and stay readable here. */}
        {capture.description ? <p>{capture.description}</p> : <p className="capture-details-empty">{text("No description was written with this image.", "Bij dit beeld is geen omschrijving geschreven.")}</p>}
        <small><MapPin size={11} /> {capture.location_label}{capture.tour_name ? ` · ${capture.tour_name}${capture.tour_order ? ` (${capture.tour_order})` : ""}` : ""} · {capturedAt}</small>
      </div>
      <div className="capture-details-actions">
        <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => run(openProjectFile(client, file.id, file.original_name))}><ExternalLink size={14} /> {text("Open original", "Origineel openen")}</button>
        <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => run(downloadProjectFile(client, file.id, file.original_name))}><Download size={14} /> {text("Download", "Downloaden")}</button>
      </div>
      {failed ? <p className="field-error" role="alert">{failed}</p> : null}
    </section>
  );
}

/**
 * Every marking on this image, numbered exactly as it is numbered on the picture. A marked
 * photo has this list in the marking pad; the 360° image needs it more, because a marker can
 * sit behind the viewer. Choosing one turns the view towards it.
 */
function VisualMarkerList({ annotations, findings, selectedId, onSelect }: { annotations: VisualAnnotation[]; findings: Finding[]; selectedId: string | null; onSelect: (annotationId: string) => void }) {
  const { text } = useLanguage();
  if (!annotations.length) return null;
  return (
    <ol className="visual-marker-list" aria-label={text("Markings on this image", "Markeringen op dit beeld")}>
      {annotations.map((annotation, index) => {
        const finding = findings.find((item) => item.id === annotation.finding_id) ?? null;
        return (
          <li key={annotation.id}>
            <button className={selectedId === annotation.id ? "active" : ""} type="button" onClick={() => onSelect(annotation.id)}>
              <span className={`visual-marker-number ${markerTone(annotation)}`}>{index + 1}</span>
              <span>
                <strong>{annotation.title}</strong>
                <small>{[finding?.finding_number, annotation.severity, annotation.coordinate_mode === "spherical" ? `${degrees(Number(annotation.yaw))} · ${degrees(Number(annotation.pitch))}` : `X ${Math.round(Number(annotation.x_ratio) * 100)}% · Y ${Math.round(Number(annotation.y_ratio) * 100)}%`].filter(Boolean).join(" · ")}</small>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function panoramaMarkers(annotations: VisualAnnotation[], pendingPoint: Extract<VisualPoint, { mode: "spherical" }> | null): import("@photo-sphere-viewer/markers-plugin").MarkerConfig[] {
  const markers: import("@photo-sphere-viewer/markers-plugin").MarkerConfig[] = annotations.flatMap((annotation, index) => annotation.yaw === null || annotation.pitch === null ? [] : [{
    id: annotation.id,
    position: { yaw: Number(annotation.yaw), pitch: Number(annotation.pitch) },
    html: `<span class="panorama-marker-dot ${markerTone(annotation)}">${index + 1}</span>`,
    size: { width: 34, height: 34 },
    anchor: "center center",
    className: "panorama-marker-shell",
    // The compass draws a dot for every marker that carries this, so a problem behind your
    // back is still visible while you look the other way.
    data: { compass: markerToneColor(annotation) },
  }]);
  if (pendingPoint) markers.push({ id: "pending:new", position: { yaw: pendingPoint.yaw, pitch: pendingPoint.pitch }, html: '<span class="panorama-marker-dot pending">+</span>', size: { width: 34, height: 34 }, anchor: "center center", className: "panorama-marker-shell", data: { compass: "#1667a8" } });
  return markers;
}

function IssueForm({ point, capture, issue, setIssue, findings, annotations, existingFindingId, setExistingFindingId, parties, buildings, captureBuildingId, busy, signature, setSignature, save, cancel }: { point: VisualPoint; capture: VisualCapture; issue: typeof emptyIssue; setIssue: (issue: typeof emptyIssue) => void; findings: Finding[]; annotations: VisualAnnotation[]; existingFindingId: string; setExistingFindingId: (id: string) => void; parties: ProjectParty[]; buildings: BuildingOption[]; captureBuildingId: string; busy: boolean; signature: HandwrittenSignature | null; setSignature: (value: HandwrittenSignature | null) => void; save: () => void; cancel: () => void }) {
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
          buildingIds: finding.building_ids?.length ? finding.building_ids : [finding.building_id],
        } : emptyIssue);
      }}><option value="">{text("Create a new issue", "Maak een nieuw issue")}</option>{availableFindings.map((finding) => <option value={finding.id} key={finding.id}>{finding.finding_number} · {finding.title}</option>)}</select></label>
      {existingFinding ? <div className="operation-alert success"><CircleDot size={18} /><div><strong>{existingFinding.finding_number} · {existingFinding.title}</strong><span>{text("This pointer will be added to the existing formal issue.", "Deze pointer wordt aan het bestaande formele issue toegevoegd.")}</span></div></div> : <>
        <div className="quick-issue-presets" aria-label={text("Choose a common issue", "Kies een veelvoorkomend probleem")}>{issuePresets.map((preset) => <button className={issue.title === preset.title ? "active" : ""} type="button" onClick={() => setIssue({ ...issue, ...preset })} key={preset.title}>{preset.title}</button>)}</div>
        <label className="form-field"><span>{text("Issue type", "Probleemtype")}</span><select value={issue.findingType} onChange={(event) => setIssue({ ...issue, findingType: event.target.value as Finding["finding_type"] })}><option value="observation">{text("Observation", "Observatie")}</option><option value="deficiency">{text("Deficiency", "Tekortkoming")}</option><option value="deviation">{text("Deviation", "Afwijking")}</option><option value="ncr">NCR</option><option value="improvement">{text("Improvement opportunity", "Verbeterkans")}</option></select></label>
        <label className="form-field"><span>{text("Marker classification · color", "Markerclassificatie · kleur")}</span><select value={issue.disposition} onChange={(event) => setIssue({ ...issue, disposition: event.target.value as typeof issue.disposition })}><option value="validated">{text("Validated · green", "Gevalideerd · groen")}</option><option value="to_be_corrected">{text("To be corrected · orange", "Te corrigeren · oranje")}</option><option value="alternative_solution">{text("Alternative solution required · red", "Alternatieve oplossing nodig · rood")}</option></select></label>
        {/* One image can show more than one building, so the finding it creates may name
            more than one too. The first is the building the record is filed under. */}
        <BuildingMultiPicker
          id="marker-buildings"
          buildings={buildings}
          value={issue.buildingIds.length ? issue.buildingIds : [issue.buildingId || captureBuildingId].filter(Boolean)}
          onChange={(next) => setIssue({ ...issue, buildingIds: next, buildingId: next[0] ?? issue.buildingId })}
        />
        <label className="form-field"><span>{text("Severity", "Ernst")}</span><select value={issue.severity} onChange={(event) => setIssue({ ...issue, severity: event.target.value as Finding["severity"] })}><option value="low">{text("Low · 14 days", "Laag · 14 dagen")}</option><option value="medium">{text("Medium · 7 days", "Middel · 7 dagen")}</option><option value="high">{text("High · 3 days", "Hoog · 3 dagen")}</option><option value="critical">{text("Critical · 1 day + escalation", "Kritiek · 1 dag + escalatie")}</option></select></label>
        <label className="form-field"><span>{text("Title", "Titel")}</span><input value={issue.title} onChange={(event) => setIssue({ ...issue, title: event.target.value })} /></label>
        <label className="form-field"><span>{text("Responsible party", "Verantwoordelijke partij")}</span><select value={issue.responsiblePartyId} onChange={(event) => setIssue({ ...issue, responsiblePartyId: event.target.value })}><option value="">{text("Not assigned", "Niet toegewezen")}</option>{parties.map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}</select></label>
      </>}
      <label className="form-field"><span>{existingFinding ? text("What does the pointer indicate?", "Wat wijst de pointer precies aan?") : text("Factual description", "Feitelijke omschrijving")}</span><textarea rows={3} value={issue.description} onChange={(event) => setIssue({ ...issue, description: event.target.value })} /><DictateButton onText={(transcript) => setIssue({ ...issue, description: appendDictation(issue.description, transcript) })} /></label>
      {/* A marker that creates a formal finding is signed here, the way the punchlist and
          HSE screens sign theirs. Linking a pointer to an existing issue is not a new
          record, so it does not ask for one. */}
      {existingFinding ? null : (
        <SignatureField
          label={text("Signature", "Handtekening")}
          declaration={text(
            "I confirm that this finding reflects what I marked on the image.",
            "Ik bevestig dat deze bevinding weergeeft wat ik op het beeld heb gemarkeerd.",
          )}
          hint={text("Optional; the name and moment are stored with the finding.", "Optioneel; de naam en het moment worden bij de bevinding opgeslagen.")}
          value={signature}
          onChange={setSignature}
        />
      )}
      <div className="button-row"><button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={cancel}>{text("Cancel", "Annuleren")}</button><button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || issue.title.trim().length < 3 || issue.description.trim().length < 3} onClick={save}><AlertTriangle size={15} /> {existingFinding ? text("Link pointer to issue", "Koppel pointer aan issue") : text("Create finding", "Bevinding maken")}</button></div>
    </div>
  );
}

function AnnotationDetails({ annotation, finding }: { annotation: VisualAnnotation; finding: Finding }) {
  const { locale, text } = useLanguage();
  return <div className="visual-annotation-details"><span className={`visual-severity-line ${annotation.severity}`} /><span className="record-number">{finding.finding_number} · {annotation.severity}</span><h2>{annotation.title}</h2><p>{annotation.description}</p><dl><div><dt>{text("Finding status", "Status bevinding")}</dt><dd>{statusText(finding.status, text)}</dd></div><div><dt>{text("Exact position", "Exacte positie")}</dt><dd>{annotation.coordinate_mode === "photo" ? `X ${Math.round(Number(annotation.x_ratio) * 100)}% · Y ${Math.round(Number(annotation.y_ratio) * 100)}%` : `${degrees(Number(annotation.yaw))} · ${degrees(Number(annotation.pitch))}`}</dd></div><div><dt>{text("Due", "Deadline")}</dt><dd>{finding.due_at ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "America/Paramaribo" }).format(new Date(finding.due_at)) : "—"}</dd></div></dl><div className="operation-alert"><ShieldCheck size={18} /><div><strong>{text("Traceable link", "Traceerbare koppeling")}</strong></div></div></div>;
}
