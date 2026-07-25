"use client";

import { Download, Folder, FolderPlus, HardDrive, Image as ImageIcon, Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import {
  compressFieldPhoto,
  connectionIsMetered,
  dataSaverEnabled,
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
  const [source, setSource] = useState("");
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    void loadProjectFileObjectUrl(client, file.id).then((url) => {
      objectUrl = url;
      if (active) setSource(url);
      else URL.revokeObjectURL(url);
    }).catch(() => undefined);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [client, file.id]);
  // Private object URLs cannot use the Next image optimizer without exposing a public URL.
  // eslint-disable-next-line @next/next/no-img-element
  return source ? <img src={source} alt={file.original_name} loading="lazy" /> : <span className="media-preview-loading"><Loader2 className="spin" size={20} /></span>;
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
}: {
  data: OperationSnapshot;
  projectId: string;
  buildingId: string;
  buildingName: string;
  reportId: string | null;
  client: SupabaseClient;
  busy: boolean;
  run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>;
}) {
  const { text } = useLanguage();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [folderId, setFolderId] = useState("all");
  const [newFolder, setNewFolder] = useState("");
  const [kind, setKind] = useState<"photo" | "drawing">("photo");
  const [queue, setQueue] = useState<OfflineUpload[]>([]);
  const [savingData, setSavingData] = useState(() => typeof window === "undefined" ? true : dataSaverEnabled());
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const folders = useMemo(() => data.mediaFolders.filter((folder) => !folder.building_id || folder.building_id === buildingId), [buildingId, data.mediaFolders]);
  const files = useMemo(() => data.files.filter((file) => file.status === "available" && (!file.building_id || file.building_id === buildingId) && (folderId === "all" || (folderId === "unfiled" ? !file.folder_id : file.folder_id === folderId))), [buildingId, data.files, folderId]);
  const folderSuggestions = (kind === "photo"
    ? [text("Daily progress", "Dagvoortgang"), text("Inspections", "Inspecties"), text("Findings", "Bevindingen"), text("Deliveries", "Leveringen"), text("360° tours", "360°-rondgangen")]
    : [text("Approved drawings", "Goedgekeurde tekeningen"), text("Revisions", "Revisies"), text("As-built", "As-built")]
  ).filter((name) => !folders.some((folder) => folder.name.toLocaleLowerCase() === name.toLocaleLowerCase()));

  const reloadQueue = useCallback(async () => setQueue(await listOfflineUploads(projectId)), [projectId]);

  const synchronize = useCallback(async (force = false) => {
    setSyncing(true);
    try {
      const result = await syncOfflineUploads(client, projectId, { force });
      await reloadQueue();
      if (result.synced > 0) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["project-operations", projectId] }),
          queryClient.invalidateQueries({ queryKey: ["workspace"] }),
        ]);
      }
      return result;
    } finally {
      setSyncing(false);
    }
  }, [client, projectId, queryClient, reloadQueue]);

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

  const addFiles = async (selected: FileList | null) => {
    if (!selected?.length) return;
    const targetFolder = folders.some((folder) => folder.id === folderId) ? folderId : null;
    for (const file of Array.from(selected)) {
      const prepared = kind === "photo" ? await compressFieldPhoto(file, savingData) : { blob: file as Blob, fileName: file.name, mimeType: file.type || "application/octet-stream", compressed: false };
      await queueOfflineUpload({
        projectId,
        buildingId,
        reportId,
        folderId: targetFolder,
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
      await run(() => synchronize(false), text("Files uploaded and linked automatically.", "Bestanden geupload en automatisch gekoppeld."));
    }
  };
  const addFolder = async (name: string) => {
    const okay = await run(
      () => createMediaFolder(client, { projectId, buildingId, name: name.trim(), folderType: kind === "photo" ? "images" : "drawings" }),
      text("Folder created.", "Map aangemaakt."),
    );
    if (okay) setNewFolder("");
  };

  return (
    <section className="media-library">
      <div className="media-library-toolbar">
        <div>
          <span className={`connectivity-pill ${online ? "online" : "offline"}`}>{online ? text("Online", "Online") : text("Offline · stored on device", "Offline · opgeslagen op apparaat")}</span>
          <h2>{text("Photos, drawings and folders", "Foto’s, tekeningen en mappen")}</h2>
          <p>{text("Project, building, date, time and filename are filled automatically.", "Project, gebouw, datum, tijd en bestandsnaam worden automatisch ingevuld.")}</p>
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
        {folderSuggestions.length ? <div className="quick-issue-presets media-folder-presets" aria-label={text("Create a standard folder", "Maak een standaardmap")}>{folderSuggestions.map((name) => <button type="button" disabled={busy} onClick={() => void addFolder(name)} key={name}><FolderPlus size={13} /> {name}</button>)}</div> : null}
        <input ref={inputRef} hidden type="file" multiple={kind === "photo"} accept={kind === "photo" ? "image/jpeg,image/png,image/webp" : "application/pdf,image/jpeg,image/png,image/webp,.dwg"} capture={kind === "photo" ? "environment" : undefined} onChange={(event) => { void addFiles(event.target.files); event.target.value = ""; }} />
        <button className="primary-button" type="button" onClick={() => inputRef.current?.click()}><Upload size={15} /> {kind === "photo" ? text("Take or choose photos", "Maak of kies foto’s") : text("Choose drawing", "Kies tekening")}</button>
        <span className="media-folder-create"><input value={newFolder} onChange={(event) => setNewFolder(event.target.value)} placeholder={text("Only for a custom folder", "Alleen voor een eigen map")} /><button className="secondary-button" type="button" disabled={busy || newFolder.trim().length < 2} onClick={() => void addFolder(newFolder)}><FolderPlus size={15} /> {text("Create custom folder", "Eigen map maken")}</button></span>
      </div>

      {queue.length ? <div className="offline-queue"><div><strong>{queue.length} {text("upload(s) waiting", "upload(s) wachten")}</strong><span>{!online ? text("They synchronize automatically when the connection returns.", "Ze synchroniseren automatisch zodra de verbinding terug is.") : savingData && connectionIsMetered() ? text("Automatic sync is paused on this metered connection.", "Automatische synchronisatie is gepauzeerd op deze databundel.") : text("Automatic synchronization is active.", "Automatische synchronisatie is actief.")}</span></div><button className="secondary-button" type="button" disabled={!online || syncing} onClick={() => void run(() => synchronize(true), text("Offline uploads synchronized.", "Offline uploads gesynchroniseerd."))}>{syncing ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />} {text("Sync now", "Nu synchroniseren")}</button><div className="offline-queue-list">{queue.map((upload) => <span key={upload.id}><ImageIcon size={14} /><b>{upload.fileName}</b><small>{humanSize(upload.queuedSize)}{upload.compressed ? ` · ${Math.round((1 - upload.queuedSize / upload.originalSize) * 100)}% bespaard` : ""}</small><button type="button" aria-label={text("Remove queued upload", "Verwijder wachtende upload")} onClick={() => void removeOfflineUpload(upload.id).then(reloadQueue)}><Trash2 size={14} /></button></span>)}</div></div> : null}

      <div className="media-gallery">
        {files.map((file) => <article className="media-card" key={file.id}>{file.mime_type.startsWith("image/") ? <SecureImage client={client} file={file} /> : <span className="media-file-icon"><HardDrive size={28} /></span>}<div><strong>{file.original_name}</strong><span>{file.category} · {humanSize(file.size_bytes)}</span></div><button type="button" onClick={() => void downloadProjectFile(client, file.id, file.original_name)} aria-label={text("Download file", "Bestand downloaden")}><Download size={15} /></button></article>)}
        {!files.length ? <div className="empty-list-state"><Folder size={24} /><strong>{text("This folder is empty", "Deze map is leeg")}</strong><span>{text("Take a photo or select files; they can also be queued offline.", "Maak een foto of kies bestanden; dit kan ook volledig offline.")}</span></div> : null}
      </div>
    </section>
  );
}
