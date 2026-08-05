"use client";

import { Camera, Download, ExternalLink, Folder, FolderPlus, HardDrive, Image as ImageIcon, Loader2, Maximize2, RefreshCw, ScanLine, Trash2, Upload } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BuildingPicker, resolveDefaultBuildingId, type BuildingOption } from "@/app/building-picker";
import { appendDictation, DictateButton } from "@/app/dictate-button";
import { photoFiles, photoTitle, photoUploadDescription, PhotoEvidenceList, toPhotoEvidence, type PhotoEvidence } from "@/app/photo-evidence";
import { useLanguage } from "@/lib/i18n";
import {
  dayGroupLabel,
  filesInFolder,
  groupFilesByDay,
  libraryDayKey,
  orderMediaFolders,
  readableFileLabel,
  visibleLibraryFiles,
} from "@/lib/media/photo-library.mjs";
import {
  compressFieldPhoto,
  connectionIsMetered,
  dataSaverEnabled,
  forceSyncOfflineUploads,
  listOfflineUploads,
  queueOfflineUpload,
  removeOfflineUpload,
  setDataSaverEnabled,
  syncOfflineUploads,
  type OfflineUpload,
} from "@/lib/offline/upload-queue";
import { syncOfflineRecords } from "@/lib/offline/record-queue";
import { downloadProjectFile, loadProjectFileObjectUrl, openProjectFile } from "@/lib/storage/gateway";
import { createFileOriginResolver, type FileOriginKind } from "@/lib/supabase/file-origins";
import { StoredPhotoDetail } from "@/app/stored-photo-detail";
import { createMediaFolder, type FileRecord, type MediaFolder, type OperationSnapshot } from "@/lib/supabase/operations";

function automaticTitle(filename: string) {
  const title = filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return title.length >= 3 ? title.slice(0, 160) : `Opname ${new Intl.DateTimeFormat("nl-SR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Paramaribo" }).format(new Date())}`;
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SecureImage({ client, file, large = false }: { client: SupabaseClient; file: FileRecord; large?: boolean }) {
  const { text } = useLanguage();
  const [source, setSource] = useState("");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    void loadProjectFileObjectUrl(client, file.id).then((url) => {
      objectUrl = url;
      if (active) setSource(url);
      else URL.revokeObjectURL(url);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attempt, client, file.id]);
  if (failed) {
    return <span className="media-preview-error"><ImageIcon size={20} /><small>{text("Image unavailable", "Beeld niet beschikbaar")}</small><button type="button" onClick={() => { setFailed(false); setSource(""); setAttempt((value) => value + 1); }}><RefreshCw size={14} /> {text("Retry", "Opnieuw")}</button></span>;
  }
  // Private object URLs cannot use the Next image optimizer without exposing a public URL.
  // eslint-disable-next-line @next/next/no-img-element
  return source ? <img className={large ? "media-detail-image" : undefined} src={source} alt={file.original_name} loading="lazy" onError={() => setFailed(true)} /> : <span className="media-preview-loading"><Loader2 className="spin" size={20} /></span>;
}

export function MediaLibraryWorkspace({
  data,
  projectId,
  buildingId,
  buildingName,
  buildings,
  reportId,
  client,
  busy,
  run,
  initialFiles = [],
  onInitialFilesConsumed,
  open360Upload,
  markPhotoIssue,
}: {
  data: OperationSnapshot;
  projectId: string;
  buildingId: string;
  buildingName: string;
  buildings: BuildingOption[];
  reportId: string | null;
  client: SupabaseClient;
  busy: boolean;
  run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>;
  initialFiles?: File[];
  onInitialFilesConsumed?: () => void;
  open360Upload: () => void;
  /** Opens the picture where problems are marked on it, on the photo that was tapped. */
  markPhotoIssue?: (fileId: string) => void;
}) {
  const { language, locale, text } = useLanguage();
  const queryClient = useQueryClient();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoImportRef = useRef<HTMLInputElement>(null);
  const drawingImportRef = useRef<HTMLInputElement>(null);
  const [folderId, setFolderId] = useState("all");
  const [newFolder, setNewFolder] = useState("");
  const [kind, setKind] = useState<"photo" | "drawing">("photo");
  const [queue, setQueue] = useState<OfflineUpload[]>([]);
  const [savingData, setSavingData] = useState(() => typeof window === "undefined" ? true : dataSaverEnabled());
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [photoDescription, setPhotoDescription] = useState("");
  const [pendingCapture, setPendingCapture] = useState<PhotoEvidence[]>([]);
  const [libraryBuildingId, setLibraryBuildingId] = useState(() => resolveDefaultBuildingId(buildings, buildingId));
  const libraryBuildingName = buildings.find((building) => building.id === libraryBuildingId)?.name ?? buildingName;
  const [originFilter, setOriginFilter] = useState<"all" | FileOriginKind>("all");
  /** The photo whose own screen is open: what it shows, where it belongs and what to do. */
  const [openFileId, setOpenFileId] = useState("");
  const openFile = data.files.find((file) => file.id === openFileId) ?? null;
  const originResolver = useMemo(() => createFileOriginResolver(data), [data]);
  // One rule for the whole screen: what a folder counts is exactly what the gallery shows
  // inside it. The counts used to come from the whole project while the gallery showed one
  // building, so photos looked lost that were simply filed under another building.
  const buildingFiles = useMemo<FileRecord[]>(() => visibleLibraryFiles(data.files, libraryBuildingId), [data.files, libraryBuildingId]);
  const folderFiles = useMemo<FileRecord[]>(() => filesInFolder(buildingFiles, folderId), [buildingFiles, folderId]);
  const files = useMemo(() => folderFiles.filter((file) => {
    if (originFilter === "all") return true;
    const origins = originResolver.origins(file.id);
    if (originFilter === "unlinked") return origins.length === 0;
    return origins.some((origin) => origin.kind === originFilter);
  }), [folderFiles, originFilter, originResolver]);
  const originFilters: Array<{ id: "all" | FileOriginKind; label: string }> = [
    { id: "all", label: text("All", "Alles") },
    { id: "finding", label: text("Issue / NCR", "Issue / NCR") },
    { id: "inspection", label: text("Inspections", "Inspecties") },
    { id: "hse", label: "HSE" },
    { id: "register", label: text("Registers", "Registers") },
    { id: "visual", label: text("Visual evidence", "Visueel bewijs") },
    { id: "unlinked", label: text("Not linked yet", "Nog niet gekoppeld") },
  ];
  const originCount = (id: "all" | FileOriginKind) => folderFiles.filter((file) => {
    if (id === "all") return true;
    const origins = originResolver.origins(file.id);
    if (id === "unlinked") return origins.length === 0;
    return origins.some((origin) => origin.kind === id);
  }).length;
  const standardFolderNames = useMemo(() => kind === "photo"
    ? [text("Daily progress", "Dagvoortgang"), text("Inspections", "Inspecties"), text("Findings", "Bevindingen"), "HSE", text("Deliveries", "Leveringen"), text("360° tours", "360°-rondgangen")]
    : [text("Approved drawings", "Goedgekeurde tekeningen"), text("Revisions", "Revisies"), text("As-built", "As-built")], [kind, text]);
  // The folders of the daily routine first, in the order the client works in; folders made
  // by hand follow alphabetically instead of in whatever order they were created.
  const folders = useMemo<MediaFolder[]>(
    () => orderMediaFolders(data.mediaFolders.filter((folder) => !folder.building_id || folder.building_id === libraryBuildingId), standardFolderNames),
    [data.mediaFolders, libraryBuildingId, standardFolderNames],
  );
  // Which day is "today" is read once per mount: a heading that recalculates on every
  // render would be an impure read of the clock during rendering.
  const [todayKey] = useState(() => libraryDayKey(new Date().toISOString()));
  const [yesterdayKey] = useState(() => libraryDayKey(new Date(new Date().getTime() - 86_400_000).toISOString()));

  const reloadQueue = useCallback(async () => setQueue(await listOfflineUploads(projectId)), [projectId]);

  const synchronize = useCallback(async (force = false, requireComplete = false) => {
    setSyncing(true);
    try {
      // The registrations go first: a photo that belongs to one can only be linked once
      // that record has a real number.
      await syncOfflineRecords(client, projectId).catch(() => undefined);
      const result = requireComplete
        ? await forceSyncOfflineUploads(client, projectId, {
          paused: text(
            "The connection changed before central confirmation. Your files remain safe on this device. Keep this page open, check the connection and tap Sync now again.",
            "De verbinding veranderde vóór de centrale bevestiging. Je bestanden blijven veilig op dit apparaat. Houd deze pagina open, controleer de verbinding en tik opnieuw op Nu synchroniseren.",
          ),
          failed: (pendingCount) => text(
            `${pendingCount} file upload(s) could not be confirmed centrally. They remain safe on this device. Check the connection and tap Sync now again.`,
            `${pendingCount} bestandsupload(s) konden niet centraal worden bevestigd. Ze blijven veilig op dit apparaat. Controleer de verbinding en tik opnieuw op Nu synchroniseren.`,
          ),
        })
        : await syncOfflineUploads(client, projectId, { force });
      if (result.synced > 0) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["project-operations", projectId] }),
          queryClient.invalidateQueries({ queryKey: ["workspace"] }),
        ]);
      }
      return result;
    } finally {
      await reloadQueue().catch(() => undefined);
      setSyncing(false);
    }
  }, [client, projectId, queryClient, reloadQueue, text]);

  useEffect(() => {
    const initialSync = window.setTimeout(() => {
      void reloadQueue();
      if (navigator.onLine && !(dataSaverEnabled() && connectionIsMetered())) void synchronize(false);
    }, 0);
    const connected = () => {
      setOnline(true);
      if (!(dataSaverEnabled() && connectionIsMetered())) void synchronize(false);
    };
    const disconnected = () => setOnline(false);
    window.addEventListener("online", connected);
    window.addEventListener("offline", disconnected);
    return () => {
      window.clearTimeout(initialSync);
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", disconnected);
    };
  }, [reloadQueue, synchronize]);

  const addFiles = useCallback(async (
    selected: FileList | File[] | null,
    preferredFolderName?: string,
    descriptionOverride?: string,
    /** The words a photo carries of its own, when it was described before being filed. */
    detailsFor?: (file: File) => { title?: string; description?: string; locationNodeId?: string | null } | undefined,
    /** What is being uploaded. A choice says it itself instead of relying on the toggle. */
    uploadKind: "photo" | "drawing" = kind,
  ) => {
    if (!selected?.length) return;
    setFieldError("");
    try {
      let targetFolder = folders.some((folder) => folder.id === folderId) ? folderId : null;
      const automaticFolderName = preferredFolderName ?? (uploadKind === "photo" ? text("Daily progress", "Dagvoortgang") : text("Approved drawings", "Goedgekeurde tekeningen"));
      if (!targetFolder && navigator.onLine) {
        const existing = folders.find((folder) => folder.name.toLocaleLowerCase() === automaticFolderName.toLocaleLowerCase());
        if (existing) {
          targetFolder = existing.id;
        } else {
          try {
            const created = await createMediaFolder(client, {
              projectId,
              buildingId: libraryBuildingId,
              name: automaticFolderName,
              folderType: uploadKind === "photo" ? "images" : "drawings",
            });
            targetFolder = created.id;
            setFolderId(created.id);
          } catch {
            // A flaky connection must never prevent the local evidence copy.
            targetFolder = null;
          }
        }
      }
      const candidates = Array.from(selected);
      const valid = candidates.filter((file) => uploadKind === "photo"
        ? ["image/jpeg", "image/png", "image/webp"].includes(file.type)
        : ["application/pdf", "image/jpeg", "image/png", "image/webp", "application/dwg", "application/acad", "application/x-acad", "image/vnd.dwg", "application/octet-stream"].includes(file.type || "application/octet-stream")
          || file.name.toLocaleLowerCase().endsWith(".dwg"));
      if (!valid.length) throw new Error(text("Choose a supported photo or drawing.", "Kies een ondersteunde foto of tekening."));
      if (valid.length !== candidates.length) {
        setFieldError(text("Unsupported files were skipped.", "Niet-ondersteunde bestanden zijn overgeslagen."));
      }
      for (const file of valid) {
        const prepared = uploadKind === "photo" ? await compressFieldPhoto(file, savingData) : { blob: file as Blob, fileName: file.name, mimeType: file.type || "application/octet-stream", compressed: false };
        await queueOfflineUpload({
          projectId,
          buildingId: libraryBuildingId,
          reportId,
          folderId: targetFolder,
          folderName: automaticFolderName,
          kind: uploadKind,
          file: prepared.blob,
          fileName: prepared.fileName,
          mimeType: prepared.mimeType,
          title: detailsFor?.(file)?.title?.trim() || automaticTitle(file.name),
          description: detailsFor?.(file)?.description?.trim() || descriptionOverride?.trim() || photoDescription.trim() || undefined,
          locationLabel: libraryBuildingName,
          locationNodeId: detailsFor?.(file)?.locationNodeId ?? null,
          capturedAt: new Date(file.lastModified || Date.now()).toISOString(),
          originalSize: file.size,
          queuedSize: prepared.blob.size,
          compressed: prepared.compressed,
        });
      }
      await reloadQueue();
      if (navigator.onLine && !(savingData && connectionIsMetered())) {
        const synchronized = await run(
          () => synchronize(true, true),
          text("Files uploaded and linked automatically.", "Bestanden geüpload en automatisch gekoppeld."),
        );
        if (!synchronized) {
          setFieldError(text(
            "Central upload is still waiting. Your files remain safe below. Check the connection and tap Sync now.",
            "De centrale upload wacht nog. Je bestanden blijven hieronder veilig staan. Controleer de verbinding en tik op Nu synchroniseren.",
          ));
        }
      }
    } catch (error) {
      setFieldError(error instanceof Error ? error.message : text(
        "The field file could not be stored on this device.",
        "Het veldbestand kon niet op dit apparaat worden opgeslagen.",
      ));
      await reloadQueue().catch(() => undefined);
    }
  }, [libraryBuildingId, libraryBuildingName, client, folderId, folders, kind, photoDescription, projectId, reloadQueue, reportId, run, savingData, synchronize, text]);

  useEffect(() => {
    if (!initialFiles.length) return;
    const captured = [...initialFiles];
    const captureTimer = window.setTimeout(() => {
      onInitialFilesConsumed?.();
      setPendingCapture(captured.map((file) => toPhotoEvidence(file)));
    }, 0);
    return () => window.clearTimeout(captureTimer);
  }, [initialFiles, onInitialFilesConsumed]);

  const savePendingCapture = useCallback(async () => {
    if (!pendingCapture.length) return;
    const dayKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Paramaribo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    await addFiles(
      photoFiles(pendingCapture),
      `${text("Daily progress", "Dagvoortgang")} · ${dayKey}`,
      photoDescription,
      (file) => {
        const photo = pendingCapture.find((entry) => entry.file === file);
        if (!photo) return undefined;
        return {
          title: photoTitle(photo),
          description: photoUploadDescription(photo, photoDescription, language),
          locationNodeId: photo.details.locationNodeId || null,
        };
      },
    );
    setPendingCapture([]);
    setPhotoDescription("");
  }, [addFiles, language, pendingCapture, photoDescription, text]);

  const addFolder = async (name: string) => {
    let createdFolderId = "";
    const okay = await run(
      async () => {
        const existing = folders.find((folder) => folder.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase());
        const folder = existing ?? await createMediaFolder(client, { projectId, buildingId: libraryBuildingId, name: name.trim(), folderType: kind === "photo" ? "images" : "drawings" });
        createdFolderId = folder.id;
      },
      text("Folder created.", "Map aangemaakt."),
    );
    if (okay) {
      setNewFolder("");
      setFolderId(createdFolderId);
    }
  };

  return (
    <section className="media-library">
      <div className="media-library-toolbar">
        <div>
          <span className={`connectivity-pill ${online ? "online" : "offline"}`}>{online ? text("Online", "Online") : text("Offline · stored on device", "Offline · opgeslagen op apparaat")}</span>
          <h2>{text("Project photos", "Projectfoto's")}</h2>
          <p>{text("The photos of this project, and the four ways to add one. Every photo gets project, building, date, time and a folder automatically.", "De foto's van dit project, en de vier manieren om er een toe te voegen. Elke foto krijgt automatisch project, gebouw, datum, tijd en een map.")}</p>
        </div>
        <label className="data-saver-toggle"><input type="checkbox" checked={savingData} onChange={(event) => { setSavingData(event.target.checked); setDataSaverEnabled(event.target.checked); }} /><span><strong>{text("Save mobile data", "Mobiele data besparen")}</strong><small>{text("Compress regular photos; never alter 360° images or drawings.", "Comprimeert gewone foto’s; wijzigt nooit 360°-beelden of tekeningen.")}</small></span></label>
      </div>

      {/* Tapping Photos in the workspace lands here, on the photos themselves, and the
          choice of what to add is made afterwards — instead of a camera that opens before
          anybody has said what the picture is for. */}
      <div className="media-choice-bar" role="group" aria-label={text("Add a photo, an image or a drawing", "Voeg een foto, beeld of tekening toe")}>
        <button className="media-choice primary" type="button" onClick={() => { setKind("photo"); cameraInputRef.current?.click(); }}>
          <span><Camera size={20} /></span>
          <span><strong>{text("Take photo", "Maak foto")}</strong><small>{text("Camera, with today's folder", "Camera, met de map van vandaag")}</small></span>
        </button>
        <button className="media-choice" type="button" onClick={() => { setKind("photo"); photoImportRef.current?.click(); }}>
          <span><Upload size={19} /></span>
          <span><strong>{text("Upload photos", "Foto's uploaden")}</strong><small>{text("From this device's gallery", "Uit de galerij van dit toestel")}</small></span>
        </button>
        <button className="media-choice" type="button" onClick={open360Upload}>
          <span><ScanLine size={19} /></span>
          <span><strong>{text("Upload 360°", "360° uploaden")}</strong><small>{text("Stitched export of a 360° camera", "Gestitchte export van een 360°-camera")}</small></span>
        </button>
        <button className="media-choice" type="button" onClick={() => { setKind("drawing"); drawingImportRef.current?.click(); }}>
          <span><HardDrive size={19} /></span>
          <span><strong>{text("Upload drawing", "Tekening uploaden")}</strong><small>{text("PDF, DWG or an image of a plan", "PDF, DWG of een afbeelding van een plan")}</small></span>
        </button>
      </div>

      <div className="media-folder-bar">
        <button className={folderId === "all" ? "active" : ""} type="button" onClick={() => setFolderId("all")}><Folder size={16} /> {text("All", "Alles")} <b>{filesInFolder(buildingFiles, "all").length}</b></button>
        <button className={folderId === "unfiled" ? "active" : ""} type="button" onClick={() => setFolderId("unfiled")}><Folder size={16} /> {text("Unfiled", "Zonder map")} <b>{filesInFolder(buildingFiles, "unfiled").length}</b></button>
        {folders.map((folder) => <button className={folderId === folder.id ? "active" : ""} type="button" onClick={() => setFolderId(folder.id)} key={folder.id}><Folder size={16} /> {folder.name} <b>{filesInFolder(buildingFiles, folder.id).length}</b></button>)}
      </div>

      <div className="media-actions-panel">
        <BuildingPicker id="media-library-building" buildings={buildings} value={libraryBuildingId} onChange={(next) => { setLibraryBuildingId(next); setFolderId("all"); }} />
        <div className="media-kind-toggle">
          <button className={kind === "photo" ? "active" : ""} type="button" onClick={() => setKind("photo")}><ImageIcon size={16} /> {text("Photo", "Foto")}</button>
          <button className={kind === "drawing" ? "active" : ""} type="button" onClick={() => setKind("drawing")}><HardDrive size={16} /> {text("Drawing", "Tekening")}</button>
        </div>
        <div className="quick-issue-presets media-folder-presets" aria-label={text("Choose a photo folder", "Kies een fotomap")}>{standardFolderNames.map((name) => { const folder = folders.find((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase()); return <button className={Boolean(folder && folderId === folder.id) ? "active" : ""} type="button" disabled={busy} onClick={() => folder ? setFolderId(folder.id) : void addFolder(name)} key={name}><Folder size={13} /> {name}</button>; })}</div>
        <input ref={cameraInputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { setPendingCapture(Array.from(event.target.files ?? []).map((file) => toPhotoEvidence(file))); event.target.value = ""; }} />
        <input
          ref={photoImportRef}
          hidden
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            setPendingCapture(Array.from(event.target.files ?? []).map((file) => toPhotoEvidence(file)));
            event.target.value = "";
          }}
        />
        <input
          ref={drawingImportRef}
          hidden
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,image/webp,.dwg"
          onChange={(event) => {
            void addFiles(Array.from(event.target.files ?? []), undefined, undefined, undefined, "drawing");
            event.target.value = "";
          }}
        />
        {kind === "photo" && pendingCapture.length ? (
          <div className="media-capture-review">
            <div className="media-capture-review-heading">
              <span><Camera size={18} /></span>
              <div>
                <strong>{pendingCapture.length === 1 ? pendingCapture[0]?.original.name : `${pendingCapture.length} ${text("photos", "foto's")}`}</strong>
                <small>{text("Describe each photo before saving. Each one is filed under today's date with its own words.", "Beschrijf elke foto vóór het opslaan. Elke foto wordt met haar eigen tekst onder de datum van vandaag bewaard.")}</small>
              </div>
            </div>
            {/* Marking and describing happen before the photo leaves the device, so what is
                stored centrally already says what it is and where it belongs. */}
            <PhotoEvidenceList
              photos={pendingCapture}
              setPhotos={setPendingCapture}
              markupContext={{
                buildings: buildings.map((building) => ({ id: building.id, label: building.name })),
                defaultBuildingId: libraryBuildingId,
                locations: data.locationNodes.map((node) => ({ id: node.id, label: `${node.code} · ${node.name}`, buildingId: node.building_id })),
              }}
            />
            {/* Applies to every photo that was not given its own words above. */}
            <label className="form-field">
              <span>{text("Description for all of them together · optional", "Omschrijving voor alle foto's samen · optioneel")}</span>
              <textarea
                value={photoDescription}
                onChange={(event) => setPhotoDescription(event.target.value)}
                placeholder={text("What is visible, where was it taken and why does it matter?", "Wat is zichtbaar, waar is de foto gemaakt en waarom is dit belangrijk?")}
                rows={3}
              />
              <DictateButton onText={(transcript) => setPhotoDescription((current) => appendDictation(current, transcript))} />
            </label>
            <div className="media-capture-review-actions">
              <button className="secondary-button" type="button" onClick={() => { setPendingCapture([]); setPhotoDescription(""); }}>{text("Discard", "Verwijderen")}</button>
              <button className="primary-button" type="button" disabled={busy} onClick={() => void savePendingCapture()}><Upload size={15} /> {text("Save with date", "Opslaan met datum")}</button>
            </div>
          </div>
        ) : null}
        <details className="optional-text-entry media-folder-create">
          <summary>{text("Custom folder", "Eigen map")}</summary>
          <span><input value={newFolder} onChange={(event) => setNewFolder(event.target.value)} placeholder={text("Folder name", "Mapnaam")} /><button className="secondary-button" type="button" disabled={busy || newFolder.trim().length < 2} onClick={() => void addFolder(newFolder)}><FolderPlus size={15} /> {text("Create", "Maken")}</button></span>
        </details>
      </div>
      {fieldError ? <div className="operation-alert error" role="alert"><HardDrive size={17} /> {fieldError}</div> : null}

      {queue.length ? <div className="offline-queue"><div><strong>{queue.length} {text("upload(s) waiting", "upload(s) wachten")}</strong><span>{!online ? text("They synchronize automatically when the connection returns.", "Ze synchroniseren automatisch zodra de verbinding terug is.") : savingData && connectionIsMetered() ? text("Automatic sync is paused on this metered connection.", "Automatische synchronisatie is gepauzeerd op deze databundel.") : text("Automatic synchronization is active.", "Automatische synchronisatie is actief.")}</span></div><button className="secondary-button" type="button" disabled={!online || syncing} onClick={() => void run(() => synchronize(true, true), text("Offline uploads synchronized.", "Offline uploads gesynchroniseerd."))}>{syncing ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />} {text("Sync now", "Nu synchroniseren")}</button><div className="offline-queue-list">{queue.map((upload) => <span className={upload.lastError ? "failed" : ""} key={upload.id}><ImageIcon size={14} /><b>{upload.fileName}</b><small title={upload.lastError ?? undefined}>{upload.lastError ? text("Sync failed · tap Sync now", "Sync mislukt · tik op Nu synchroniseren") : humanSize(upload.queuedSize)}{!upload.lastError && upload.compressed ? ` · ${Math.round((1 - upload.queuedSize / upload.originalSize) * 100)}% bespaard` : ""}</small><button type="button" aria-label={text("Remove queued upload", "Verwijder wachtende upload")} onClick={() => { if (window.confirm(text("Remove this unsynchronized field file from this device?", "Dit niet-gesynchroniseerde veldbestand van dit apparaat verwijderen?"))) void removeOfflineUpload(upload.id).then(reloadQueue); }}><Trash2 size={14} /></button></span>)}</div></div> : null}

      <div className="media-origin-bar" role="group" aria-label={text("Filter photos by what they belong to", "Filter foto's op waar ze bij horen")}>
        {originFilters.map((filter) => (
          <button className={originFilter === filter.id ? "active" : ""} type="button" onClick={() => setOriginFilter(filter.id)} key={filter.id}>
            {filter.label} <b>{originCount(filter.id)}</b>
          </button>
        ))}
      </div>

      {/* The pictures stand under the day they were taken, newest day first: that is the
          order a supervisor remembers them in, and the order the day report reads in. */}
      {(groupFilesByDay(files) as Array<{ key: string; files: FileRecord[] }>).map((group) => (
        <section className="media-day-group" key={group.key || "undated"}>
          <header className="media-day-heading">
            <strong>{dayGroupLabel(group.key, {
              todayKey,
              yesterdayKey,
              today: text("Today", "Vandaag"),
              yesterday: text("Yesterday", "Gisteren"),
              undated: text("Without a date", "Zonder datum"),
              formatDate: (key: string) => new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "America/Paramaribo" }).format(new Date(`${key}T12:00:00-03:00`)),
            })}</strong>
            <small>{group.files.length} {text(group.files.length === 1 ? "file" : "files", group.files.length === 1 ? "bestand" : "bestanden")}</small>
          </header>
      <div className="media-gallery">
        {group.files.map((file) => {
          const folder = data.mediaFolders.find((item) => item.id === file.folder_id);
          const capture = data.visualCaptures.find((item) => item.file_id === file.id);
          const origins = originResolver.origins(file.id);
          return <article className="media-card" key={file.id}>{/* The picture itself opens: a photo you can only reach through a small icon beside it reads as a photo you cannot do anything with. */}
            <button className="media-card-open" type="button" onClick={() => setOpenFileId(file.id)} aria-label={text(`Open the details of ${file.original_name}`, `Open de details van ${file.original_name}`)}>
              {file.mime_type.startsWith("image/") ? <SecureImage client={client} file={file} /> : <span className="media-file-icon"><HardDrive size={28} /></span>}
              <span className="media-card-open-hint"><Maximize2 size={14} /> {text("Open", "Openen")}</span>
            </button><div>{file.document_code ? <span className="media-code-chip">{file.document_code}</span> : null}<strong title={file.original_name}>{readableFileLabel(file, {
              title: capture?.title ?? "",
              kindLabel: capture?.capture_type === "panorama" ? "360°" : file.mime_type.startsWith("image/") ? text("Photo", "Foto") : text("File", "Bestand"),
              formatDate: (value: string) => value ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "America/Paramaribo" }).format(new Date(value)) : "",
            })}</strong><span>{[capture?.location_label || libraryBuildingName, folder?.name ?? text("Unfiled", "Zonder map"), humanSize(file.size_bytes)].filter(Boolean).join(" · ")}</span><span className="media-origin-chips">{origins.length ? origins.map((origin) => <em className={`media-origin-chip tone-${origin.kind}`} title={origin.title} key={`${origin.kind}:${origin.recordId}`}>{origin.number || origin.kind}</em>) : <em className="media-origin-chip tone-unlinked">{text("Not linked to a record yet", "Nog niet aan een record gekoppeld")}</em>}</span></div><span className="media-file-actions"><button type="button" onClick={() => void openProjectFile(client, file.id, file.original_name)} aria-label={text("Open file", "Bestand openen")}><ExternalLink size={15} /></button><button type="button" onClick={() => void downloadProjectFile(client, file.id, file.original_name)} aria-label={text("Download file", "Bestand downloaden")}><Download size={15} /></button></span></article>;
        })}
      </div>
        </section>
      ))}
      {!files.length ? <div className="empty-list-state"><Folder size={24} /><strong>{originFilter === "all" ? text("This folder is empty", "Deze map is leeg") : text("No photo matches this filter", "Geen foto voldoet aan dit filter")}</strong><span>{originFilter === "all" ? text("Take a photo or select files; they can also be queued offline.", "Maak een foto of kies bestanden; dit kan ook volledig offline.") : text("Choose another link filter to see the rest of this folder.", "Kies een ander koppelfilter om de rest van deze map te zien.")}</span></div> : null}
      {openFile ? (
        <StoredPhotoDetail
          data={data}
          buildings={buildings}
          file={openFile}
          client={client}
          busy={busy}
          run={run}
          projectId={projectId}
          close={() => setOpenFileId("")}
          openMarking={markPhotoIssue}
        />
      ) : null}
    </section>
  );
}
