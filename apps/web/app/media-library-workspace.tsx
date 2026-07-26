"use client";

import { Camera, Download, Folder, FolderPlus, HardDrive, Image as ImageIcon, Loader2, RefreshCw, ScanLine, Trash2, Upload } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n";
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
import { downloadProjectFile, loadProjectFileObjectUrl } from "@/lib/storage/gateway";
import { createMediaFolder, type FileRecord, type OperationSnapshot } from "@/lib/supabase/operations";

function automaticTitle(filename: string) {
  const title = filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return title.length >= 3 ? title.slice(0, 160) : `Opname ${new Intl.DateTimeFormat("nl-SR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Paramaribo" }).format(new Date())}`;
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SecureImage({ client, file }: { client: SupabaseClient; file: FileRecord }) {
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
  return source ? <img src={source} alt={file.original_name} loading="lazy" onError={() => setFailed(true)} /> : <span className="media-preview-loading"><Loader2 className="spin" size={20} /></span>;
}

export function MediaLibraryWorkspace({
  data,
  projectId,
  buildingId,
  buildingName,
  reportId,
  client,
  busy,
  run,
  initialFiles = [],
  onInitialFilesConsumed,
  open360Upload,
}: {
  data: OperationSnapshot;
  projectId: string;
  buildingId: string;
  buildingName: string;
  reportId: string | null;
  client: SupabaseClient;
  busy: boolean;
  run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>;
  initialFiles?: File[];
  onInitialFilesConsumed?: () => void;
  open360Upload: () => void;
}) {
  const { text } = useLanguage();
  const queryClient = useQueryClient();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [folderId, setFolderId] = useState("all");
  const [newFolder, setNewFolder] = useState("");
  const [kind, setKind] = useState<"photo" | "drawing">("photo");
  const [queue, setQueue] = useState<OfflineUpload[]>([]);
  const [savingData, setSavingData] = useState(() => typeof window === "undefined" ? true : dataSaverEnabled());
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const folders = useMemo(() => data.mediaFolders.filter((folder) => !folder.building_id || folder.building_id === buildingId), [buildingId, data.mediaFolders]);
  const files = useMemo(() => data.files.filter((file) => file.status === "available" && (!file.building_id || file.building_id === buildingId) && (folderId === "all" || (folderId === "unfiled" ? !file.folder_id : file.folder_id === folderId))), [buildingId, data.files, folderId]);
  const standardFolderNames = kind === "photo"
    ? [text("Daily progress", "Dagvoortgang"), text("Inspections", "Inspecties"), text("Findings", "Bevindingen"), "HSE", text("Deliveries", "Leveringen"), text("360° tours", "360°-rondgangen")]
    : [text("Approved drawings", "Goedgekeurde tekeningen"), text("Revisions", "Revisies"), text("As-built", "As-built")];

  const reloadQueue = useCallback(async () => setQueue(await listOfflineUploads(projectId)), [projectId]);

  const synchronize = useCallback(async (force = false, requireComplete = false) => {
    setSyncing(true);
    try {
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

  const addFiles = useCallback(async (selected: FileList | File[] | null, preferredFolderName?: string) => {
    if (!selected?.length) return;
    setFieldError("");
    try {
      let targetFolder = folders.some((folder) => folder.id === folderId) ? folderId : null;
      const automaticFolderName = preferredFolderName ?? (kind === "photo" ? text("Daily progress", "Dagvoortgang") : text("Approved drawings", "Goedgekeurde tekeningen"));
      if (!targetFolder && navigator.onLine) {
        const existing = folders.find((folder) => folder.name.toLocaleLowerCase() === automaticFolderName.toLocaleLowerCase());
        if (existing) {
          targetFolder = existing.id;
        } else {
          try {
            const created = await createMediaFolder(client, {
              projectId,
              buildingId,
              name: automaticFolderName,
              folderType: kind === "photo" ? "images" : "drawings",
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
      const valid = candidates.filter((file) => kind === "photo"
        ? ["image/jpeg", "image/png", "image/webp"].includes(file.type)
        : ["application/pdf", "image/jpeg", "image/png", "image/webp", "application/dwg", "application/acad", "application/x-acad", "image/vnd.dwg", "application/octet-stream"].includes(file.type || "application/octet-stream")
          || file.name.toLocaleLowerCase().endsWith(".dwg"));
      if (!valid.length) throw new Error(text("Choose a supported photo or drawing.", "Kies een ondersteunde foto of tekening."));
      if (valid.length !== candidates.length) {
        setFieldError(text("Unsupported files were skipped.", "Niet-ondersteunde bestanden zijn overgeslagen."));
      }
      for (const file of valid) {
        const prepared = kind === "photo" ? await compressFieldPhoto(file, savingData) : { blob: file as Blob, fileName: file.name, mimeType: file.type || "application/octet-stream", compressed: false };
        await queueOfflineUpload({
          projectId,
          buildingId,
          reportId,
          folderId: targetFolder,
          folderName: automaticFolderName,
          kind,
          file: prepared.blob,
          fileName: prepared.fileName,
          mimeType: prepared.mimeType,
          title: automaticTitle(file.name),
          locationLabel: buildingName,
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
  }, [buildingId, buildingName, client, folderId, folders, kind, projectId, reloadQueue, reportId, run, savingData, synchronize, text]);

  useEffect(() => {
    if (!initialFiles.length) return;
    const captured = [...initialFiles];
    const uploadTimer = window.setTimeout(() => {
      onInitialFilesConsumed?.();
      void addFiles(captured, text("Daily progress", "Dagvoortgang"));
    }, 0);
    return () => window.clearTimeout(uploadTimer);
  }, [addFiles, initialFiles, onInitialFilesConsumed, text]);

  const addFolder = async (name: string) => {
    let createdFolderId = "";
    const okay = await run(
      async () => {
        const existing = folders.find((folder) => folder.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase());
        const folder = existing ?? await createMediaFolder(client, { projectId, buildingId, name: name.trim(), folderType: kind === "photo" ? "images" : "drawings" });
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
          <h2>{text("Point, shoot, done", "Richten, foto, klaar")}</h2>
          <p>{text("Every photo gets project, building, date, time and a folder automatically.", "Elke foto krijgt automatisch project, gebouw, datum, tijd en een map.")}</p>
        </div>
        <label className="data-saver-toggle"><input type="checkbox" checked={savingData} onChange={(event) => { setSavingData(event.target.checked); setDataSaverEnabled(event.target.checked); }} /><span><strong>{text("Save mobile data", "Mobiele data besparen")}</strong><small>{text("Compress regular photos; never alter 360° images or drawings.", "Comprimeert gewone foto’s; wijzigt nooit 360°-beelden of tekeningen.")}</small></span></label>
      </div>

      <div className="media-folder-bar">
        <button className={folderId === "all" ? "active" : ""} type="button" onClick={() => setFolderId("all")}><Folder size={16} /> {text("All", "Alles")} <b>{data.files.length}</b></button>
        <button className={folderId === "unfiled" ? "active" : ""} type="button" onClick={() => setFolderId("unfiled")}><Folder size={16} /> {text("Unfiled", "Zonder map")} <b>{data.files.filter((file) => !file.folder_id).length}</b></button>
        {folders.map((folder) => <button className={folderId === folder.id ? "active" : ""} type="button" onClick={() => setFolderId(folder.id)} key={folder.id}><Folder size={16} /> {folder.name} <b>{data.files.filter((file) => file.folder_id === folder.id).length}</b></button>)}
      </div>

      <div className="media-actions-panel">
        <div className="media-kind-toggle">
          <button className={kind === "photo" ? "active" : ""} type="button" onClick={() => setKind("photo")}><ImageIcon size={16} /> {text("Photo", "Foto")}</button>
          <button className={kind === "drawing" ? "active" : ""} type="button" onClick={() => setKind("drawing")}><HardDrive size={16} /> {text("Drawing", "Tekening")}</button>
        </div>
        <div className="quick-issue-presets media-folder-presets" aria-label={text("Choose a photo folder", "Kies een fotomap")}>{standardFolderNames.map((name) => { const folder = folders.find((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase()); return <button className={Boolean(folder && folderId === folder.id) ? "active" : ""} type="button" disabled={busy} onClick={() => folder ? setFolderId(folder.id) : void addFolder(name)} key={name}><Folder size={13} /> {name}</button>; })}</div>
        <input ref={cameraInputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { void addFiles(event.target.files); event.target.value = ""; }} />
        <input ref={importInputRef} hidden type="file" multiple accept={kind === "photo" ? "image/jpeg,image/png,image/webp" : "application/pdf,image/jpeg,image/png,image/webp,.dwg"} onChange={(event) => { void addFiles(event.target.files); event.target.value = ""; }} />
        <div className="media-capture-actions">
          {kind === "photo" ? <button className="primary-button camera-primary-action" type="button" onClick={() => cameraInputRef.current?.click()}><Camera size={18} /> {text("Take photo", "Maak foto")}</button> : <button className="primary-button" type="button" onClick={() => importInputRef.current?.click()}><Upload size={15} /> {text("Choose drawing", "Kies tekening")}</button>}
          {kind === "photo" ? <button className="secondary-button" type="button" onClick={() => importInputRef.current?.click()}><Upload size={15} /> {text("Import existing photos", "Bestaande foto’s importeren")}</button> : null}
          {kind === "photo" ? <button className="secondary-button" type="button" onClick={open360Upload}><ScanLine size={15} /> {text("Upload 360° image", "Upload 360°-beeld")}</button> : null}
        </div>
        <details className="optional-text-entry media-folder-create">
          <summary>{text("Custom folder", "Eigen map")}</summary>
          <span><input value={newFolder} onChange={(event) => setNewFolder(event.target.value)} placeholder={text("Folder name", "Mapnaam")} /><button className="secondary-button" type="button" disabled={busy || newFolder.trim().length < 2} onClick={() => void addFolder(newFolder)}><FolderPlus size={15} /> {text("Create", "Maken")}</button></span>
        </details>
      </div>
      {fieldError ? <div className="operation-alert error" role="alert"><HardDrive size={17} /> {fieldError}</div> : null}

      {queue.length ? <div className="offline-queue"><div><strong>{queue.length} {text("upload(s) waiting", "upload(s) wachten")}</strong><span>{!online ? text("They synchronize automatically when the connection returns.", "Ze synchroniseren automatisch zodra de verbinding terug is.") : savingData && connectionIsMetered() ? text("Automatic sync is paused on this metered connection.", "Automatische synchronisatie is gepauzeerd op deze databundel.") : text("Automatic synchronization is active.", "Automatische synchronisatie is actief.")}</span></div><button className="secondary-button" type="button" disabled={!online || syncing} onClick={() => void run(() => synchronize(true, true), text("Offline uploads synchronized.", "Offline uploads gesynchroniseerd."))}>{syncing ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />} {text("Sync now", "Nu synchroniseren")}</button><div className="offline-queue-list">{queue.map((upload) => <span className={upload.lastError ? "failed" : ""} key={upload.id}><ImageIcon size={14} /><b>{upload.fileName}</b><small title={upload.lastError ?? undefined}>{upload.lastError ? text("Sync failed · tap Sync now", "Sync mislukt · tik op Nu synchroniseren") : humanSize(upload.queuedSize)}{!upload.lastError && upload.compressed ? ` · ${Math.round((1 - upload.queuedSize / upload.originalSize) * 100)}% bespaard` : ""}</small><button type="button" aria-label={text("Remove queued upload", "Verwijder wachtende upload")} onClick={() => { if (window.confirm(text("Remove this unsynchronized field file from this device?", "Dit niet-gesynchroniseerde veldbestand van dit apparaat verwijderen?"))) void removeOfflineUpload(upload.id).then(reloadQueue); }}><Trash2 size={14} /></button></span>)}</div></div> : null}

      <div className="media-gallery">
        {files.map((file) => <article className="media-card" key={file.id}>{file.mime_type.startsWith("image/") ? <SecureImage client={client} file={file} /> : <span className="media-file-icon"><HardDrive size={28} /></span>}<div><strong>{file.original_name}</strong><span>{file.category} · {humanSize(file.size_bytes)}</span></div><button type="button" onClick={() => void downloadProjectFile(client, file.id, file.original_name)} aria-label={text("Download file", "Bestand downloaden")}><Download size={15} /></button></article>)}
        {!files.length ? <div className="empty-list-state"><Folder size={24} /><strong>{text("This folder is empty", "Deze map is leeg")}</strong><span>{text("Take a photo or select files; they can also be queued offline.", "Maak een foto of kies bestanden; dit kan ook volledig offline.")}</span></div> : null}
      </div>
    </section>
  );
}
