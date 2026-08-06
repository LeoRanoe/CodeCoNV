"use client";

import { Camera, Download, ExternalLink, FileText, Folder, FolderPlus, Grid3X3, HardDrive, Image as ImageIcon, Link2, List, Loader2, Maximize2, Pencil, RefreshCw, ScanLine, Trash2, Upload } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BuildingPicker, resolveDefaultBuildingId, type BuildingOption } from "@/app/building-picker";
import { appendDictation, DictateButton } from "@/app/dictate-button";
import { photoFiles, photoTitle, photoUploadDescription, PhotoEvidenceList, toPhotoEvidence, type PhotoEvidence } from "@/app/photo-evidence";
import { useLanguage } from "@/lib/i18n";
import { normalizeRecordCode } from "@/lib/records/record-directory.mjs";
import {
  dayGroupLabel,
  filesInFolder,
  groupFilesByDay,
  groupPhotoStacks,
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
import { createMediaFolder, createVisualCapture, linkFileToRecord, updateMediaFolder, updateProjectFile, updateVisualCaptureDetails, updateVisualCaptureStack, type FileRecord, type MediaFolder, type OperationSnapshot } from "@/lib/supabase/operations";

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
  mode = "photos",
  organizationId = "",
  openRecord,
  focusRecordId = "",
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
  mode?: "photos" | "assets";
  organizationId?: string;
  openRecord?: (tab: string, recordId: string, kind: string) => void;
  /**
   * The photo, document or folder the workspace search asked for. Tapping a result used to
   * open this tab and leave the person to find the file again themselves.
   */
  focusRecordId?: string;
}) {
  const assetsMode = mode === "assets";
  const { language, locale, text } = useLanguage();
  const queryClient = useQueryClient();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoImportRef = useRef<HTMLInputElement>(null);
  const drawingImportRef = useRef<HTMLInputElement>(null);
  const assetImportRef = useRef<HTMLInputElement>(null);
  const [folderId, setFolderId] = useState("all");
  const [newFolder, setNewFolder] = useState("");
  const [parentFolderId, setParentFolderId] = useState("");
  const [kind, setKind] = useState<"photo" | "drawing" | "document">("photo");
  const [queue, setQueue] = useState<OfflineUpload[]>([]);
  const [savingData, setSavingData] = useState(() => typeof window === "undefined" ? true : dataSaverEnabled());
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [photoDescription, setPhotoDescription] = useState("");
  const [stackTitle, setStackTitle] = useState("");
  const [pendingCapture, setPendingCapture] = useState<PhotoEvidence[]>([]);
  const [libraryBuildingId, setLibraryBuildingId] = useState(() => resolveDefaultBuildingId(buildings, buildingId));
  const libraryBuildingName = buildings.find((building) => building.id === libraryBuildingId)?.name ?? buildingName;
  const [originFilter, setOriginFilter] = useState<"all" | FileOriginKind>("all");
  const [assetQuery, setAssetQuery] = useState("");
  const [assetKind, setAssetKind] = useState("");
  const [assetDateFrom, setAssetDateFrom] = useState("");
  const [assetDateTo, setAssetDateTo] = useState("");
  const [assetStatus, setAssetStatus] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkFolderId, setBulkFolderId] = useState("");
  const [recordTarget, setRecordTarget] = useState("");
  /** The photo whose own screen is open: what it shows, where it belongs and what to do. */
  const [openFileId, setOpenFileId] = useState("");
  const [openStackIds, setOpenStackIds] = useState<string[]>([]);
  const openFile = data.files.find((file) => file.id === openFileId) ?? null;
  const openStackFiles = openStackIds.map((id) => data.files.find((file) => file.id === id)).filter((file): file is FileRecord => Boolean(file));
  const originResolver = useMemo(() => createFileOriginResolver(data), [data]);
  // One rule for the whole screen: what a folder counts is exactly what the gallery shows
  // inside it. The counts used to come from the whole project while the gallery showed one
  // building, so photos looked lost that were simply filed under another building.
  const buildingFiles = useMemo<FileRecord[]>(() => (assetsMode
    ? data.files.filter((file) => file.status !== "deleted" && (!file.building_id || !libraryBuildingId || file.building_id === libraryBuildingId))
    : (visibleLibraryFiles(data.files, libraryBuildingId) as FileRecord[]).filter((file) => file.mime_type.startsWith("image/"))), [assetsMode, data.files, libraryBuildingId]);
  const folderFiles = useMemo<FileRecord[]>(() => assetsMode ? filesInFolder(buildingFiles, folderId) : buildingFiles, [assetsMode, buildingFiles, folderId]);
  const files = useMemo(() => folderFiles.filter((file) => {
    const normalizedQuery = normalizeRecordCode(assetQuery);
    const queryMatches = !assetQuery.trim() || `${file.document_code ?? ""} ${file.original_name}`.toLocaleLowerCase(locale).includes(assetQuery.trim().toLocaleLowerCase(locale)) || normalizeRecordCode(file.document_code).includes(normalizedQuery);
    const kindMatches = !assetKind || file.category === assetKind || (assetKind === "photo" && file.mime_type.startsWith("image/"));
    const date = file.created_at.slice(0, 10);
    if (assetsMode && (!queryMatches || !kindMatches || (assetStatus && file.status !== assetStatus) || (assetDateFrom && date < assetDateFrom) || (assetDateTo && date > assetDateTo))) return false;
    if (originFilter === "all") return true;
    const origins = originResolver.origins(file.id);
    if (originFilter === "unlinked") return origins.length === 0;
    return origins.some((origin) => origin.kind === originFilter);
  }).sort((left, right) => {
    const searchedCode = normalizeRecordCode(assetQuery);
    const leftExact = searchedCode && normalizeRecordCode(left.document_code) === searchedCode ? 0 : 1;
    const rightExact = searchedCode && normalizeRecordCode(right.document_code) === searchedCode ? 0 : 1;
    return leftExact - rightExact || right.created_at.localeCompare(left.created_at);
  }), [assetDateFrom, assetDateTo, assetKind, assetQuery, assetStatus, assetsMode, folderFiles, locale, originFilter, originResolver]);
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

  /**
   * A result tapped in the workspace search is a photo, a document or a folder. It arrives
   * here as the id the search index knows it by — a capture id, a file id, or the
   * "file:<id>" of a picture that predates visual_captures — so all three are resolved back
   * to the file itself, and the library is put on the building and folder that show it.
   */
  const focusHandled = useRef("");
  useEffect(() => {
    if (!focusRecordId || focusHandled.current === focusRecordId) return;
    // The request is answered on the next tick, after the library has rendered its own
    // state once: the same handover the camera hand-off below uses.
    const focusTimer = window.setTimeout(() => {
      const folder = data.mediaFolders.find((item) => item.id === focusRecordId);
      if (folder) {
        focusHandled.current = focusRecordId;
        if (folder.building_id) setLibraryBuildingId(folder.building_id);
        setFolderId(folder.id);
        return;
      }
      const capture = data.visualCaptures.find((item) => item.id === focusRecordId);
      const fileId = focusRecordId.startsWith("file:") ? focusRecordId.slice(5) : capture?.file_id ?? focusRecordId;
      const file = data.files.find((item) => item.id === fileId);
      if (!file) return;
      focusHandled.current = focusRecordId;
      if (file.building_id) setLibraryBuildingId(file.building_id);
      setFolderId("all");
      setOpenFileId(file.id);
      const stackId = data.visualCaptures.find((item) => item.file_id === file.id)?.stack_id ?? null;
      setOpenStackIds(stackId
        ? data.visualCaptures.filter((item) => item.stack_id === stackId).map((item) => item.file_id)
        : [file.id]);
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [data.files, data.mediaFolders, data.visualCaptures, focusRecordId]);

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
    uploadKind: "photo" | "drawing" | "document" = kind,
    evidenceGroupId?: string | null,
  ) => {
    if (!selected?.length) return;
    setFieldError("");
    try {
      let targetFolder = folders.some((folder) => folder.id === folderId) ? folderId : null;
      const automaticFolderName = preferredFolderName ?? (uploadKind === "photo" ? text("Daily progress", "Dagvoortgang") : uploadKind === "drawing" ? text("Approved drawings", "Goedgekeurde tekeningen") : text("Project documents", "Projectdocumenten"));
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
              folderType: uploadKind === "photo" ? "images" : uploadKind === "drawing" ? "drawings" : "mixed",
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
        : uploadKind === "drawing"
          ? ["application/pdf", "image/jpeg", "image/png", "image/webp", "application/dwg", "application/acad", "application/x-acad", "image/vnd.dwg", "application/octet-stream"].includes(file.type || "application/octet-stream") || file.name.toLocaleLowerCase().endsWith(".dwg")
          : ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv", "text/plain"].includes(file.type));
      if (!valid.length) throw new Error(text("Choose a supported photo, drawing or document.", "Kies een ondersteunde foto, tekening of document."));
      if (valid.length !== candidates.length) {
        setFieldError(text("Unsupported files were skipped.", "Niet-ondersteunde bestanden zijn overgeslagen."));
      }
      const capturedAt = new Date(valid[0]?.lastModified || Date.now()).toISOString();
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
          capturedAt,
          originalSize: file.size,
          queuedSize: prepared.blob.size,
          compressed: prepared.compressed,
          evidenceGroupId: uploadKind === "photo" ? evidenceGroupId || null : null,
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
    const evidenceGroupId = pendingCapture.length > 1 ? crypto.randomUUID() : null;
    const sharedTitle = stackTitle.trim() || (pendingCapture.length > 1 ? photoTitle(pendingCapture[0]!) || automaticTitle(pendingCapture[0]!.original.name) : "");
    const sharedDescription = photoDescription.trim() || (pendingCapture.length > 1 ? pendingCapture.find((photo) => photo.details.description.trim())?.details.description.trim() ?? "" : "");
    await addFiles(
      photoFiles(pendingCapture),
      `${text("Daily progress", "Dagvoortgang")} · ${dayKey}`,
      photoDescription,
      (file) => {
        const photo = pendingCapture.find((entry) => entry.file === file);
        if (!photo) return undefined;
        return {
          title: sharedTitle || photoTitle(photo),
          description: pendingCapture.length > 1 ? sharedDescription : photoUploadDescription(photo, photoDescription, language),
          locationNodeId: photo.details.locationNodeId || null,
        };
      },
      "photo",
      evidenceGroupId,
    );
    setPendingCapture([]);
    setPhotoDescription("");
    setStackTitle("");
  }, [addFiles, language, pendingCapture, photoDescription, stackTitle, text]);

  const addFolder = async (name: string) => {
    let createdFolderId = "";
    const okay = await run(
      async () => {
        const existing = folders.find((folder) => folder.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase());
        const folder = existing ?? await createMediaFolder(client, { projectId, buildingId: libraryBuildingId, parentId: parentFolderId || null, name: name.trim(), folderType: kind === "photo" ? "images" : kind === "drawing" ? "drawings" : "mixed" });
        createdFolderId = folder.id;
      },
      text("Folder created.", "Map aangemaakt."),
    );
    if (okay) {
      setNewFolder("");
      setParentFolderId("");
      setFolderId(createdFolderId);
    }
  };

  const selectedFiles = data.files.filter((file) => selectedIds.includes(file.id));
  const recordTargets = [
    ...data.findings.map((record) => ({ value: `finding:${record.id}`, type: "finding" as const, id: record.id, label: `${record.finding_number} · ${record.title}` })),
    ...data.inspections.map((record) => ({ value: `inspection:${record.id}`, type: "inspection" as const, id: record.id, label: `${record.inspection_number} · ${record.title}` })),
    ...data.hseEvents.map((record) => ({ value: `hse:${record.id}`, type: "hse" as const, id: record.id, label: `${record.event_number} · ${record.title}` })),
    ...data.registerEntries.map((record) => ({ value: `register_entry:${record.id}`, type: "register_entry" as const, id: record.id, label: `${record.entry_number} · ${record.title}` })),
  ];
  const assetRecords = useMemo(() => {
    const records = [
      ...data.inspections.map((record) => ({ id: record.id, tab: "inspections", kind: "form", code: record.inspection_number, title: record.title, status: record.status, date: record.completed_at ?? record.started_at ?? record.planned_at ?? "", buildingIds: record.building_ids ?? [record.building_id], signed: Boolean(record.signed_at) })),
      ...data.findings.map((record) => ({ id: record.id, tab: record.finding_type === "ncr" ? "ncr" : "findings", kind: "form", code: record.finding_number, title: record.title, status: record.status, date: record.created_at, buildingIds: record.building_ids ?? [record.building_id], signed: Boolean(record.issue_management?.signed_at) })),
      ...data.hseEvents.map((record) => ({ id: record.id, tab: "hse", kind: "form", code: record.event_number, title: record.title, status: record.status, date: record.occurred_at, buildingIds: record.building_ids ?? [record.building_id], signed: Boolean(record.signed_at) })),
      ...data.registerEntries.map((record) => ({ id: record.id, tab: "registers", kind: "form", code: record.entry_number, title: record.title, status: record.status, date: record.occurred_at, buildingIds: record.building_ids ?? [record.building_id], signed: Boolean(record.signed_at) })),
      ...(data.dayReports ?? []).map((record) => ({ id: record.id, tab: "documents", kind: "report", code: record.report_number, title: record.report_date, status: record.status, date: record.report_date, buildingIds: [] as string[], signed: record.status === "signed" })),
    ];
    const normalizedQuery = normalizeRecordCode(assetQuery);
    return records.filter((record) => {
      const words = `${record.code} ${record.title}`.toLocaleLowerCase(locale);
      return (!assetQuery.trim() || words.includes(assetQuery.trim().toLocaleLowerCase(locale)) || normalizeRecordCode(record.code).includes(normalizedQuery))
        && (!assetKind || assetKind === record.kind)
        && (!assetStatus || record.status === assetStatus)
        && (!assetDateFrom || record.date.slice(0, 10) >= assetDateFrom)
        && (!assetDateTo || record.date.slice(0, 10) <= assetDateTo)
        && (!libraryBuildingId || !record.buildingIds.length || record.buildingIds.includes(libraryBuildingId));
    }).sort((left, right) => {
      const leftExact = normalizedQuery && normalizeRecordCode(left.code) === normalizedQuery ? 0 : 1;
      const rightExact = normalizedQuery && normalizeRecordCode(right.code) === normalizedQuery ? 0 : 1;
      return leftExact - rightExact || right.date.localeCompare(left.date);
    }).slice(0, 250);
  }, [assetDateFrom, assetDateTo, assetKind, assetQuery, assetStatus, data.dayReports, data.findings, data.hseEvents, data.inspections, data.registerEntries, libraryBuildingId, locale]);

  const renameFile = async (file: FileRecord) => {
    const name = window.prompt(text("New file name", "Nieuwe bestandsnaam"), file.original_name)?.trim();
    if (!name || name === file.original_name) return;
    await run(() => updateProjectFile(client, file.id, { name }), text("Asset renamed.", "Middel hernoemd."));
  };

  const softDeleteFiles = async (targets: FileRecord[]) => {
    if (!targets.length || !window.confirm(text(`Move ${targets.length} asset(s) out of the active library?`, `${targets.length} middel(en) uit de actieve bibliotheek halen?`))) return;
    const okay = await run(() => Promise.all(targets.map((file) => updateProjectFile(client, file.id, { status: "deleted" }))), text("Assets withdrawn from the library.", "Middelen uit de bibliotheek ingetrokken."));
    if (okay) setSelectedIds([]);
  };

  const describeFiles = async (targets: FileRecord[]) => {
    if (!targets.length) return;
    const firstCapture = data.visualCaptures.find((capture) => capture.file_id === targets[0]?.id);
    const title = window.prompt(text("Shared title", "Gedeelde titel"), firstCapture?.title ?? automaticTitle(targets[0]?.original_name ?? ""))?.trim();
    if (!title) return;
    const description = window.prompt(text("Shared description", "Gedeelde omschrijving"), firstCapture?.description ?? "") ?? "";
    await run(() => Promise.all(targets.map(async (file) => {
      const capture = data.visualCaptures.find((item) => item.file_id === file.id);
      if (capture && !capture.derived_from_file) return updateVisualCaptureDetails(client, capture.id, { title, description });
      await createVisualCapture(client, {
        projectId,
        buildingId: file.building_id || libraryBuildingId,
        fileId: file.id,
        captureType: "photo",
        title,
        description,
        locationLabel: libraryBuildingName,
        capturedAt: file.created_at,
        stackId: firstCapture?.stack_id || null,
      });
    })), text("Photo description saved for the complete stack.", "Foto-omschrijving voor de volledige stapel opgeslagen."));
  };

  const stackSelectedPhotos = async () => {
    const targets = selectedFiles.filter((file) => file.mime_type.startsWith("image/"));
    if (targets.length < 2) return;
    const first = targets[0]!;
    const firstCapture = data.visualCaptures.find((capture) => capture.file_id === first.id);
    const title = window.prompt(text("Shared stack title", "Gedeelde stapeltitel"), firstCapture?.title ?? automaticTitle(first.original_name))?.trim();
    if (!title) return;
    const description = window.prompt(text("Shared stack description", "Gedeelde stapelomschrijving"), firstCapture?.description ?? "") ?? "";
    const stackId = crypto.randomUUID();
    const capturedAt = firstCapture?.captured_at ?? first.created_at;
    const okay = await run(() => Promise.all(targets.map(async (file) => {
      const capture = data.visualCaptures.find((item) => item.file_id === file.id);
      await updateProjectFile(client, file.id, { buildingId: libraryBuildingId, folderId: first.folder_id });
      if (capture && !capture.derived_from_file) {
        await updateVisualCaptureStack(client, capture.id, { stackId, buildingId: libraryBuildingId, title, description, capturedAt });
        return;
      }
      await createVisualCapture(client, {
        projectId,
        buildingId: libraryBuildingId,
        fileId: file.id,
        captureType: "photo",
        title,
        description,
        locationLabel: libraryBuildingName,
        capturedAt,
        stackId,
      });
    })), text("Selected photos now form one shared stack.", "De geselecteerde foto's vormen nu één gedeelde stapel."));
    if (okay) setSelectedIds([]);
  };

  const moveSelected = async () => {
    if (!selectedFiles.length) return;
    const okay = await run(() => Promise.all(selectedFiles.map((file) => updateProjectFile(client, file.id, { folderId: bulkFolderId || null, buildingId: libraryBuildingId }))), text("Assets moved together.", "Middelen samen verplaatst."));
    if (okay) setSelectedIds([]);
  };

  const linkSelected = async () => {
    const target = recordTargets.find((record) => record.value === recordTarget);
    if (!target || !selectedFiles.length || !organizationId) return;
    const okay = await run(() => Promise.all(selectedFiles.map((file) => linkFileToRecord(client, {
      organizationId,
      projectId,
      fileId: file.id,
      recordType: target.type,
      recordId: target.id,
      relationship: "attachment",
    }))), text("Assets linked to the selected record.", "Middelen aan de gekozen registratie gekoppeld."));
    if (okay) setSelectedIds([]);
  };

  const renameFolder = async (folder: MediaFolder) => {
    const name = window.prompt(text("New folder name", "Nieuwe mapnaam"), folder.name)?.trim();
    if (!name || name === folder.name) return;
    await run(() => updateMediaFolder(client, folder.id, { name }), text("Folder renamed.", "Map hernoemd."));
  };

  const archiveFolder = async (folder: MediaFolder) => {
    if (!window.confirm(text(`Archive folder ${folder.name}? Its files stay available under All.`, `Map ${folder.name} archiveren? De bestanden blijven onder Alles beschikbaar.`))) return;
    const okay = await run(() => updateMediaFolder(client, folder.id, { status: "archived" }), text("Folder archived; no file was deleted.", "Map gearchiveerd; er is geen bestand verwijderd."));
    if (okay && folderId === folder.id) setFolderId("all");
  };

  return (
    <section className="media-library">
      <div className="media-library-toolbar">
        <div>
          <span className={`connectivity-pill ${online ? "online" : "offline"}`}>{online ? text("Online", "Online") : text("Offline · stored on device", "Offline · opgeslagen op apparaat")}</span>
          <h2>{assetsMode ? text("Project assets", "Projectmiddelen") : text("Project photos", "Projectfoto's")}</h2>
          <p>{assetsMode
            ? text("Photos, documents, drawings, reports and signed files in one managed folder library.", "Foto's, documenten, tekeningen, rapporten en ondertekende bestanden in één beheerde mappenbibliotheek.")
            : text("Take, upload, describe, stack, view or delete project photos. Filing stays automatic.", "Maak, upload, omschrijf, stapel, bekijk of verwijder projectfoto's. Archivering blijft automatisch.")}</p>
        </div>
        <label className="data-saver-toggle"><input type="checkbox" checked={savingData} onChange={(event) => { setSavingData(event.target.checked); setDataSaverEnabled(event.target.checked); }} /><span><strong>{text("Save mobile data", "Mobiele data besparen")}</strong><small>{text("Compress regular photos; never alter 360° images or drawings.", "Comprimeert gewone foto’s; wijzigt nooit 360°-beelden of tekeningen.")}</small></span></label>
      </div>

      {/* Tapping Photos in the workspace lands here, on the photos themselves, and the
          choice of what to add is made afterwards — instead of a camera that opens before
          anybody has said what the picture is for. */}
      <div className="media-choice-bar" role="group" aria-label={assetsMode ? text("Add a project asset", "Voeg een projectmiddel toe") : text("Add photos", "Voeg foto's toe")}>
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
        {assetsMode ? <button className="media-choice" type="button" onClick={() => { setKind("drawing"); drawingImportRef.current?.click(); }}>
          <span><HardDrive size={19} /></span>
          <span><strong>{text("Upload drawing", "Tekening uploaden")}</strong><small>{text("PDF, DWG or an image of a plan", "PDF, DWG of een afbeelding van een plan")}</small></span>
        </button> : null}
        {assetsMode ? <button className="media-choice" type="button" onClick={() => { setKind("document"); assetImportRef.current?.click(); }}>
          <span><FileText size={19} /></span>
          <span><strong>{text("Upload documents", "Documenten uploaden")}</strong><small>{text("PDF, Word, Excel, CSV or text", "PDF, Word, Excel, CSV of tekst")}</small></span>
        </button> : null}
      </div>

      {assetsMode ? <div className="media-folder-bar asset-folder-bar">
        <button className={folderId === "all" ? "active" : ""} type="button" onClick={() => setFolderId("all")}><Folder size={16} /> {text("All", "Alles")} <b>{filesInFolder(buildingFiles, "all").length}</b></button>
        <button className={folderId === "unfiled" ? "active" : ""} type="button" onClick={() => setFolderId("unfiled")}><Folder size={16} /> {text("Unfiled", "Zonder map")} <b>{filesInFolder(buildingFiles, "unfiled").length}</b></button>
        {folders.map((folder) => <span className="asset-folder-control" key={folder.id}><button className={folderId === folder.id ? "active" : ""} type="button" onClick={() => setFolderId(folder.id)}><Folder size={16} /> {folder.name} <b>{filesInFolder(buildingFiles, folder.id).length}</b></button><button type="button" onClick={() => void renameFolder(folder)} aria-label={text(`Rename ${folder.name}`, `${folder.name} hernoemen`)}><Pencil size={13} /></button><button type="button" onClick={() => void archiveFolder(folder)} aria-label={text(`Archive ${folder.name}`, `${folder.name} archiveren`)}><Trash2 size={13} /></button></span>)}
      </div> : null}

      <div className="media-actions-panel">
        <BuildingPicker id="media-library-building" buildings={buildings} value={libraryBuildingId} onChange={(next) => { setLibraryBuildingId(next); setFolderId("all"); }} />
        {assetsMode ? <div className="media-kind-toggle">
          <button className={kind === "photo" ? "active" : ""} type="button" onClick={() => setKind("photo")}><ImageIcon size={16} /> {text("Photo", "Foto")}</button>
          <button className={kind === "drawing" ? "active" : ""} type="button" onClick={() => setKind("drawing")}><HardDrive size={16} /> {text("Drawing", "Tekening")}</button>
          <button className={kind === "document" ? "active" : ""} type="button" onClick={() => setKind("document")}><FileText size={16} /> {text("Document", "Document")}</button>
        </div> : null}
        {assetsMode ? <div className="quick-issue-presets media-folder-presets" aria-label={text("Choose an asset folder", "Kies een middelenmap")}>{standardFolderNames.map((name) => { const folder = folders.find((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase()); return <button className={Boolean(folder && folderId === folder.id) ? "active" : ""} type="button" disabled={busy} onClick={() => folder ? setFolderId(folder.id) : void addFolder(name)} key={name}><Folder size={13} /> {name}</button>; })}</div> : null}
        <input ref={cameraInputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { const captured = Array.from(event.target.files ?? []).map((file) => toPhotoEvidence(file)); setPendingCapture((current) => [...current, ...captured]); event.target.value = ""; }} />
        <input
          ref={photoImportRef}
          hidden
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const imported = Array.from(event.target.files ?? []).map((file) => toPhotoEvidence(file));
            setPendingCapture((current) => [...current, ...imported]);
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
        <input ref={assetImportRef} hidden type="file" multiple accept="application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" onChange={(event) => { void addFiles(Array.from(event.target.files ?? []), undefined, undefined, undefined, "document"); event.target.value = ""; }} />
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
              allowMarkup={false}
              markupContext={{
                // The library building is shared by the complete stack; it is never
                // overridden frame by frame.
                buildings: [],
                defaultBuildingId: libraryBuildingId,
                locations: data.locationNodes.map((node) => ({ id: node.id, label: `${node.code} · ${node.name}`, buildingId: node.building_id })),
              }}
            />
            {pendingCapture.length > 1 ? <label className="form-field"><span>{text("Stack title · shared by every photo", "Stapeltitel · gedeeld door elke foto")}</span><input value={stackTitle} onChange={(event) => setStackTitle(event.target.value)} placeholder={text("One situation, several frames", "Eén situatie, meerdere beelden")} /></label> : null}
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
              <button className="secondary-button" type="button" onClick={() => { setPendingCapture([]); setPhotoDescription(""); setStackTitle(""); }}>{text("Discard", "Verwijderen")}</button>
              <button className="primary-button" type="button" disabled={busy} onClick={() => void savePendingCapture()}><Upload size={15} /> {pendingCapture.length > 1 ? text("Save photo stack", "Fotostapel opslaan") : text("Save with date", "Opslaan met datum")}</button>
            </div>
          </div>
        ) : null}
        {assetsMode ? <details className="optional-text-entry media-folder-create">
          <summary>{text("Custom folder", "Eigen map")}</summary>
          <span><input value={newFolder} onChange={(event) => setNewFolder(event.target.value)} placeholder={text("Folder name", "Mapnaam")} /><select value={parentFolderId} onChange={(event) => setParentFolderId(event.target.value)} aria-label={text("Parent folder", "Bovenliggende map")}><option value="">{text("At the top level", "Op hoofdniveau")}</option>{folders.map((folder) => <option value={folder.id} key={folder.id}>{folder.name}</option>)}</select><button className="secondary-button" type="button" disabled={busy || newFolder.trim().length < 2} onClick={() => void addFolder(newFolder)}><FolderPlus size={15} /> {text("Create", "Maken")}</button></span>
        </details> : null}
      </div>
      {assetsMode ? <div className="asset-library-controls">
        <div className="asset-library-filters">
          <label><span>{text("Search code or name", "Zoek code of naam")}</span><input type="search" value={assetQuery} onChange={(event) => setAssetQuery(event.target.value)} placeholder="DOC-2026" /></label>
          <label><span>{text("Kind", "Soort")}</span><select value={assetKind} onChange={(event) => setAssetKind(event.target.value)}><option value="">{text("All kinds", "Alle soorten")}</option><option value="photo">{text("Photos", "Foto's")}</option><option value="document">{text("Documents", "Documenten")}</option><option value="drawing">{text("Drawings", "Tekeningen")}</option><option value="report">{text("Reports", "Rapporten")}</option><option value="form">{text("Forms and signed records", "Formulieren en ondertekende registraties")}</option></select></label>
          <label><span>{text("Status", "Status")}</span><select value={assetStatus} onChange={(event) => setAssetStatus(event.target.value)}><option value="">{text("All statuses", "Alle statussen")}</option><option value="available">{text("Available", "Beschikbaar")}</option><option value="pending">{text("Pending", "In afwachting")}</option><option value="open">Open</option><option value="signed">{text("Signed", "Ondertekend")}</option><option value="approved">{text("Approved", "Goedgekeurd")}</option><option value="closed">{text("Closed", "Gesloten")}</option></select></label>
          <label><span>{text("From", "Vanaf")}</span><input type="date" value={assetDateFrom} onChange={(event) => setAssetDateFrom(event.target.value)} /></label>
          <label><span>{text("To", "Tot")}</span><input type="date" value={assetDateTo} onChange={(event) => setAssetDateTo(event.target.value)} /></label>
          <span className="asset-view-toggle"><button className={viewMode === "grid" ? "active" : ""} type="button" onClick={() => setViewMode("grid")} aria-label={text("Grid view", "Rasterweergave")}><Grid3X3 size={16} /></button><button className={viewMode === "list" ? "active" : ""} type="button" onClick={() => setViewMode("list")} aria-label={text("List view", "Lijstweergave")}><List size={16} /></button></span>
        </div>
        {selectedFiles.length ? <div className="asset-bulk-actions">
          <strong>{selectedFiles.length} {text("selected", "geselecteerd")}</strong>
          <label><span>{text("Move to folder", "Verplaats naar map")}</span><select value={bulkFolderId} onChange={(event) => setBulkFolderId(event.target.value)}><option value="">{text("Unfiled", "Zonder map")}</option>{folders.map((folder) => <option value={folder.id} key={folder.id}>{folder.name}</option>)}</select></label>
          <button className="secondary-button" type="button" onClick={() => void moveSelected()}><Folder size={15} /> {text("Move", "Verplaatsen")}</button>
          <label><span>{text("Link to record", "Koppel aan registratie")}</span><select value={recordTarget} onChange={(event) => setRecordTarget(event.target.value)}><option value="">{text("Choose a record", "Kies een registratie")}</option>{recordTargets.map((target) => <option value={target.value} key={target.value}>{target.label}</option>)}</select></label>
          <button className="secondary-button" type="button" disabled={!recordTarget || !organizationId} onClick={() => void linkSelected()}><Link2 size={15} /> {text("Link", "Koppelen")}</button>
          <button className="secondary-button" type="button" onClick={() => selectedFiles.forEach((file) => void downloadProjectFile(client, file.id, file.original_name))}><Download size={15} /> {text("Download", "Downloaden")}</button>
          <button className="ghost-button" type="button" onClick={() => void softDeleteFiles(selectedFiles)}><Trash2 size={15} /> {text("Withdraw", "Intrekken")}</button>
        </div> : null}
      </div> : null}
      {!assetsMode && selectedFiles.length ? <div className="photo-stack-actions"><strong>{selectedFiles.length} {text("photos selected", "foto's geselecteerd")}</strong><button className="primary-button" type="button" disabled={selectedFiles.length < 2} onClick={() => void stackSelectedPhotos()}><ImageIcon size={15} /> {text("Make one stack", "Maak één stapel")}</button><button className="secondary-button" type="button" onClick={() => void softDeleteFiles(selectedFiles)}><Trash2 size={15} /> {text("Delete", "Verwijderen")}</button><button className="ghost-button" type="button" onClick={() => setSelectedIds([])}>{text("Cancel selection", "Selectie stoppen")}</button></div> : null}
      {fieldError ? <div className="operation-alert error" role="alert"><HardDrive size={17} /> {fieldError}</div> : null}

      {queue.length ? <div className="offline-queue"><div><strong>{queue.length} {text("upload(s) waiting", "upload(s) wachten")}</strong><span>{!online ? text("They synchronize automatically when the connection returns.", "Ze synchroniseren automatisch zodra de verbinding terug is.") : savingData && connectionIsMetered() ? text("Automatic sync is paused on this metered connection.", "Automatische synchronisatie is gepauzeerd op deze databundel.") : text("Automatic synchronization is active.", "Automatische synchronisatie is actief.")}</span></div><button className="secondary-button" type="button" disabled={!online || syncing} onClick={() => void run(() => synchronize(true, true), text("Offline uploads synchronized.", "Offline uploads gesynchroniseerd."))}>{syncing ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />} {text("Sync now", "Nu synchroniseren")}</button><div className="offline-queue-list">{queue.map((upload) => <span className={upload.lastError ? "failed" : ""} key={upload.id}><ImageIcon size={14} /><b>{upload.fileName}</b><small title={upload.lastError ?? undefined}>{upload.lastError ? text("Sync failed · tap Sync now", "Sync mislukt · tik op Nu synchroniseren") : humanSize(upload.queuedSize)}{!upload.lastError && upload.compressed ? ` · ${Math.round((1 - upload.queuedSize / upload.originalSize) * 100)}% bespaard` : ""}</small><button type="button" aria-label={text("Remove queued upload", "Verwijder wachtende upload")} onClick={() => { if (window.confirm(text("Remove this unsynchronized field file from this device?", "Dit niet-gesynchroniseerde veldbestand van dit apparaat verwijderen?"))) void removeOfflineUpload(upload.id).then(reloadQueue); }}><Trash2 size={14} /></button></span>)}</div></div> : null}

      <div className="media-origin-bar" role="group" aria-label={text("Filter photos by what they belong to", "Filter foto's op waar ze bij horen")}>
        {originFilters.map((filter) => (
          <button className={originFilter === filter.id ? "active" : ""} type="button" onClick={() => setOriginFilter(filter.id)} key={filter.id}>
            {filter.label} <b>{originCount(filter.id)}</b>
          </button>
        ))}
      </div>

      {assetsMode && assetRecords.length ? <section className="asset-record-library" aria-label={text("Project reports and forms", "Projectrapporten en formulieren")}>
        <header><div><strong>{text("Reports and registered forms", "Rapporten en geregistreerde formulieren")}</strong><small>{text("Open the source record to preview, edit or export it without copying its identity.", "Open de bronregistratie om deze zonder kopie te bekijken, bewerken of exporteren.")}</small></div><b>{assetRecords.length}</b></header>
        <div className="asset-record-grid">{assetRecords.map((record) => <button type="button" onClick={() => openRecord?.(record.tab, record.id, record.kind)} key={`${record.tab}:${record.id}`}><span className="media-code-chip">{record.code}</span><strong>{record.title}</strong><small>{record.status.replaceAll("_", " ")} · {record.date.slice(0, 10)}</small>{record.signed ? <em>{text("Signed", "Ondertekend")}</em> : null}</button>)}</div>
      </section> : null}

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
      <div className={`media-gallery${assetsMode && viewMode === "list" ? " asset-list-view" : ""}`}>
        {(assetsMode ? group.files.map((file) => ({ key: `file:${file.id}`, files: [file] })) : groupPhotoStacks(group.files, data.visualCaptures) as Array<{ key: string; files: FileRecord[] }>).map((stack) => {
          const file = stack.files[0];
          if (!file) return null;
          const folder = data.mediaFolders.find((item) => item.id === file.folder_id);
          const capture = data.visualCaptures.find((item) => item.file_id === file.id);
          const origins = originResolver.origins(file.id);
          return <article className={`media-card${stack.files.length > 1 ? " media-stack-card" : ""}`} key={stack.key}>
            <label className="asset-select"><input type="checkbox" checked={stack.files.every((frame) => selectedIds.includes(frame.id))} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...new Set([...current, ...stack.files.map((frame) => frame.id)])] : current.filter((id) => !stack.files.some((frame) => frame.id === id)))} /><span className="sr-only">{text(`Select ${file.original_name}`, `Selecteer ${file.original_name}`)}</span></label>
            <button className="media-card-open" type="button" onClick={() => { setOpenFileId(file.id); setOpenStackIds(stack.files.map((frame) => frame.id)); }} aria-label={text(`Open the details of ${file.original_name}`, `Open de details van ${file.original_name}`)}>
              {file.mime_type.startsWith("image/") ? <span className="media-stack-thumbnails">{stack.files.slice(0, 4).map((frame) => <SecureImage client={client} file={frame} key={frame.id} />)}{stack.files.length > 1 ? <em>{stack.files.length} {text("photos", "foto's")}</em> : null}</span> : <span className="media-file-icon"><HardDrive size={28} /></span>}
              <span className="media-card-open-hint"><Maximize2 size={14} /> {text("Open", "Openen")}</span>
            </button><div>{file.document_code ? <span className="media-code-chip">{file.document_code}</span> : null}<strong title={file.original_name}>{readableFileLabel(file, {
              title: capture?.title ?? "",
              kindLabel: capture?.capture_type === "panorama" ? "360°" : file.mime_type.startsWith("image/") ? text("Photo", "Foto") : text("File", "Bestand"),
              formatDate: (value: string) => value ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "America/Paramaribo" }).format(new Date(value)) : "",
            })}</strong><span>{[capture?.location_label || libraryBuildingName, assetsMode ? folder?.name ?? text("Unfiled", "Zonder map") : "", stack.files.length > 1 ? text(`${stack.files.length} frames`, `${stack.files.length} beelden`) : humanSize(file.size_bytes)].filter(Boolean).join(" · ")}</span><span className="media-origin-chips">{origins.length ? origins.map((origin) => <em className={`media-origin-chip tone-${origin.kind}`} title={origin.title} key={`${origin.kind}:${origin.recordId}`}>{origin.number || origin.kind}</em>) : <em className="media-origin-chip tone-unlinked">{text("Not linked to a record yet", "Nog niet aan een record gekoppeld")}</em>}</span></div><span className="media-file-actions"><button type="button" onClick={() => void openProjectFile(client, file.id, file.original_name)} aria-label={text("Open file", "Bestand openen")}><ExternalLink size={15} /></button><button type="button" onClick={() => void downloadProjectFile(client, file.id, file.original_name)} aria-label={text("Download file", "Bestand downloaden")}><Download size={15} /></button>{assetsMode ? <button type="button" onClick={() => void renameFile(file)} aria-label={text("Rename file", "Bestand hernoemen")}><Pencil size={15} /></button> : null}<button type="button" onClick={() => void softDeleteFiles(stack.files)} aria-label={text("Delete", "Verwijderen")}><Trash2 size={15} /></button></span></article>;
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
          close={() => { setOpenFileId(""); setOpenStackIds([]); }}
          openMarking={assetsMode ? markPhotoIssue : undefined}
          stackFiles={openStackFiles.length ? openStackFiles : [openFile]}
          onDelete={(targets) => { setOpenFileId(""); setOpenStackIds([]); void softDeleteFiles(targets); }}
          onDescribe={(targets) => void describeFiles(targets)}
        />
      ) : null}
    </section>
  );
}
