"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AlertTriangle,
  Cloud,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
  FileText,
  FileUp,
  Hand,
  Image as ImageIcon,
  Link2,
  Loader2,
  MapPin,
  MousePointer2,
  Plus,
  ShieldCheck,
  Trash2,
  Type,
  ArrowUpRight,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BuildingMultiPicker, BuildingPicker, resolveDefaultBuildingId, type BuildingOption } from "@/app/building-picker";
import { SignatureField, type HandwrittenSignature } from "@/app/signature-pad";
import {
  arrowHeadPoints,
  arrowLineEnd,
  cloudPath,
  polylinePoints,
  textBoxSize,
  toPagePoint,
} from "@/lib/drawings/markup-geometry.mjs";
import {
  drawingPointFromClient,
  panDrawingViewport,
  pinDragMoved,
  pointerLiftPlacesPin,
  resetDrawingViewport,
  tapSlopPixels,
  zoomDrawingViewport,
} from "@/lib/drawings/viewport.mjs";
import { useLanguage } from "@/lib/i18n";
import { readableFileLabel } from "@/lib/media/photo-library.mjs";
import {
  listDrawingPinMutations,
  saveDrawingPinOnlineOrQueue,
  syncDrawingPinMutations,
  type DrawingPinMutation,
} from "@/lib/offline/drawing-pin-queue";
import { loadProjectFilePreviewObjectUrl, uploadProjectFile } from "@/lib/storage/gateway";
import {
  createDrawingMarkup,
  createFinding,
  type DrawingMarkup,
  type DrawingPin,
  type FileRecord,
  type NormalizedPoint,
  type OperationSnapshot,
} from "@/lib/supabase/operations";
import { typeText } from "@/lib/status-labels";

function humanFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type DrawingWorkspaceProps = {
  data: OperationSnapshot;
  projectId: string;
  buildingId: string;
  buildings: BuildingOption[];
  client: SupabaseClient;
  busy: boolean;
  run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>;
  /** Preselects "observation" plus this finding, so an issue can be pinned straight from its card. */
  initialFindingId?: string;
  /** The same for a checklist that is being filled in: "locatie pinnen" on the drawing. */
  initialInspectionId?: string;
  /**
   * The field record that is still open on the record screen. Tapping the drawing places
   * that record: the client does not want to choose from a list of everything in the
   * project — "daar ik de pin moet kiezen, daar hoeft geen freehand drawing", and
   * "dit kan voor nu weg" beside the list of link types.
   */
  pendingRecord?: { label: string; title: string; point: PinPoint & { drawingId: string; pageNumber: number } | null } | null;
  onPlaceRecordPin?: (point: { drawingId: string; pageNumber: number; xRatio: number; yRatio: number }) => void;
  onOpenLinkedRecord: (recordType: DrawingPin["linked_record_type"], recordId: string) => void;
};

type PinPoint = { xRatio: number; yRatio: number };
type DrawingTool = "pan" | "pin" | DrawingMarkup["markup_type"];
type DrawingViewport = { scale: number; offset: { x: number; y: number }; page: number };

const supportedDrawingMimeTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const dwgMimeTypes = ["application/octet-stream", "application/acad", "application/dwg", "application/x-acad", "image/vnd.dwg"];

function isDwgFile(file: { name?: string; original_name?: string; type?: string; mime_type?: string }) {
  const name = file.name ?? file.original_name ?? "";
  const mimeType = file.type ?? file.mime_type ?? "";
  return name.toLowerCase().endsWith(".dwg") && (dwgMimeTypes.includes(mimeType) || !mimeType);
}

/** What each pin colour stands for, so the drawing can be read without opening a pin. */
const linkTypeLabels: Record<DrawingPin["linked_record_type"], { en: string; nl: string }> = {
  rfi: { en: "RFI", nl: "RFI" },
  submittal: { en: "Submittal", nl: "Submittal" },
  document: { en: "Document", nl: "Document" },
  observation: { en: "Issue / NCR", nl: "Issue / NCR" },
  inspection: { en: "Inspection", nl: "Inspectie" },
  visual: { en: "Photo / 360°", nl: "Foto / 360°" },
  registration: { en: "Daily works", nl: "Dagwerk" },
};

export function DrawingWorkspace({ data, projectId, buildingId, buildings, client, busy, run, initialFindingId = "", initialInspectionId = "", pendingRecord = null, onPlaceRecordPin, onOpenLinkedRecord }: DrawingWorkspaceProps) {
  const { language, locale, text } = useLanguage();
  const maxFileSizeBytes = (data.settings?.max_file_size_mb ?? 25) * 1024 * 1024;
  const drawings = data.files.filter((file) => file.category === "drawing" && file.status === "available" && supportedDrawingMimeTypes.includes(file.mime_type));
  const dwgSources = data.files.filter((file) => file.category === "drawing" && file.status === "available" && isDwgFile(file));
  const [activeDrawingId, setActiveDrawingId] = useState(drawings[0]?.id ?? "");
  const activeDrawing = drawings.find((file) => file.id === activeDrawingId) ?? drawings[0] ?? null;
  const [viewport, setViewport] = useState<DrawingViewport>(() => resetDrawingViewport(1));
  const pageNumber = viewport.page;
  /** A drawing is known by its sheet name, not by the code a phone gave the file. */
  const drawingLabel = (drawing: FileRecord) => readableFileLabel(drawing, {
    kindLabel: drawing.mime_type === "application/pdf" ? "PDF" : text("Drawing", "Tekening"),
    formatDate: (value) => value
      ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "America/Paramaribo" }).format(new Date(value))
      : "",
  });
  const [pageCount, setPageCount] = useState(1);
  const [point, setPoint] = useState<PinPoint | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [pinOverrides, setPinOverrides] = useState<Record<string, PinPoint>>({});
  const [hiddenPinIds, setHiddenPinIds] = useState<string[]>([]);
  const [localPins, setLocalPins] = useState<DrawingPin[]>([]);
  const [queueError, setQueueError] = useState("");
  const [queuedMutations, setQueuedMutations] = useState<DrawingPinMutation[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [tool, setTool] = useState<DrawingTool>(pendingRecord || initialFindingId || initialInspectionId ? "pin" : "pan");
  const [markupColor, setMarkupColor] = useState("#D92D20");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [markupText, setMarkupText] = useState("");
  const [uploadBuildingId, setUploadBuildingId] = useState(() => resolveDefaultBuildingId(buildings, buildingId));
  const [uploadError, setUploadError] = useState("");
  /**
   * What a tapped spot becomes when the supervisor did not arrive here from a record.
   * "link" hangs an existing record on it, "issue" writes a new one on the spot. Before
   * this, tapping the drawing on its own screen led to a panel that only said no.
   */
  const [spotMode, setSpotMode] = useState<"link" | "issue">("issue");
  const [spotRecord, setSpotRecord] = useState("");
  const [spotIssue, setSpotIssue] = useState({ title: "", description: "", severity: "medium" });
  /** The buildings the issue written on this spot covers, and the signature under it. */
  const [spotBuildingIds, setSpotBuildingIds] = useState<string[]>([]);
  const [spotSignature, setSpotSignature] = useState<HandwrittenSignature | null>(null);
  /** Sheet names read out of the PDF itself, so a page is known by its own label. */
  const [pageLabels, setPageLabels] = useState<string[]>([]);
  const [documentTitle, setDocumentTitle] = useState("");

  const restoredPins: DrawingPin[] = queuedMutations.flatMap((mutation) => {
    if (mutation.kind !== "create") return [];
    const input = mutation.input;
    const finding = data.findings.find((record) => record.id === input.linkedRecordId);
    const inspection = data.inspections.find((record) => record.id === input.linkedRecordId);
    const entry = data.registerEntries.find((record) => record.id === input.linkedRecordId);
    return [{ id: `pending:${mutation.id}`, drawing_file_id: input.drawingFileId, page_number: input.pageNumber,
      x_ratio: input.xRatio, y_ratio: input.yRatio, linked_record_type: input.linkedRecordType, linked_record_id: input.linkedRecordId,
      linked_record_number: finding?.finding_number ?? inspection?.inspection_number ?? entry?.entry_number ?? "Pending",
      linked_record_title: finding?.title ?? inspection?.title ?? entry?.title ?? input.linkedRecordId,
      note: null, status: "active", created_at: mutation.createdAt }];
  });
  const restoredMoves = Object.fromEntries(queuedMutations.flatMap((mutation) => mutation.kind === "move" ? [[mutation.input.pinId, { xRatio: mutation.input.xRatio, yRatio: mutation.input.yRatio }]] : []));
  const restoredHidden = queuedMutations.flatMap((mutation) => mutation.kind === "void" ? [mutation.input.pinId] : []);
  const savedPins = data.drawingPins.map((pin) => restoredMoves[pin.id] ? { ...pin, x_ratio: restoredMoves[pin.id].xRatio, y_ratio: restoredMoves[pin.id].yRatio } : pin).filter((pin) => !restoredHidden.includes(pin.id));
  const pendingPins = [...localPins, ...restoredPins.filter((pin) => !localPins.some((local) => local.id === pin.id))];
  const allPins = [...savedPins, ...pendingPins.filter((local) => !data.drawingPins.some((pin) => pin.linked_record_type === local.linked_record_type && pin.linked_record_id === local.linked_record_id && pin.drawing_file_id === local.drawing_file_id))];
  const activePins = activeDrawing
    ? allPins
      .filter((pin) => pin.drawing_file_id === activeDrawing.id && pin.page_number === pageNumber && pin.status === "active" && !hiddenPinIds.includes(pin.id))
      .map((pin) => pinOverrides[pin.id] ? { ...pin, x_ratio: pinOverrides[pin.id].xRatio, y_ratio: pinOverrides[pin.id].yRatio } : pin)
    : [];
  const selectedPinSource = allPins.find((pin) => pin.id === selectedPinId && !hiddenPinIds.includes(pin.id)) ?? null;
  const selectedPin = selectedPinSource && pinOverrides[selectedPinSource.id]
    ? { ...selectedPinSource, x_ratio: pinOverrides[selectedPinSource.id].xRatio, y_ratio: pinOverrides[selectedPinSource.id].yRatio }
    : selectedPinSource;
  const activeMarkups = activeDrawing
    ? data.drawingMarkups.filter((markup) => markup.drawing_file_id === activeDrawing.id && markup.page_number === pageNumber && markup.status === "active")
    : [];

  const incomingFinding = initialFindingId ? data.findings.find((finding) => finding.id === initialFindingId) ?? null : null;
  const incomingInspection = initialInspectionId ? data.inspections.find((inspection) => inspection.id === initialInspectionId) ?? null : null;
  const incomingPin = incomingFinding
    ? data.drawingPins.find((pin) => pin.linked_record_type === "observation" && pin.linked_record_id === incomingFinding.id && pin.status === "active") ?? null
    : null;

  // Jump straight to the drawing and page that already carries this issue.
  const incomingPinHandled = useRef("");
  useEffect(() => {
    if (!incomingPin || incomingPinHandled.current === incomingPin.id) return;
    incomingPinHandled.current = incomingPin.id;
    setActiveDrawingId(incomingPin.drawing_file_id);
    setViewport(resetDrawingViewport(incomingPin.page_number));
    setSelectedPinId(incomingPin.id);
    setPoint(null);
  }, [incomingPin]);

  // On a narrow screen the form sits far below the drawing; bring it into view when a spot or a
  // pin is chosen, moving no further than needed so a form that is already visible stays put.
  const linkPanelRef = useRef<HTMLDivElement>(null);
  // Every tap on a pin or a spot counts, also on the one that is already chosen: the page may have
  // been scrolled away from its card since.
  const [panelNudge, setPanelNudge] = useState(0);
  const panelKey = point ? `spot:${point.xRatio}:${point.yRatio}` : selectedPinId ? `pin:${selectedPinId}` : "";
  useEffect(() => {
    if (!panelKey) return;
    // The card inside the panel, not the whole panel: a panel taller than the window is already
    // "partly visible" and would never move, with the button the person needs below the fold.
    // After the next frame, when the card for this pin or spot is on the page.
    const frame = requestAnimationFrame(() => (linkPanelRef.current?.firstElementChild ?? linkPanelRef.current)?.scrollIntoView({ block: "nearest" }));
    return () => cancelAnimationFrame(frame);
  }, [panelKey, panelNudge]);

  const changePage = useCallback((page: number) => {
    setViewport(resetDrawingViewport(page));
    setPoint(null);
    setSelectedPinId(null);
  }, []);

  const handlePageCount = useCallback((count: number) => {
    setPageCount(count);
    setViewport((current) => current.page <= count ? current : resetDrawingViewport(count));
  }, []);

  const handleDocumentDetails = useCallback((details: { labels: string[]; title: string }) => {
    setPageLabels(details.labels);
    setDocumentTitle(details.title);
  }, []);

  /** What this page is called: its own sheet label when the drawing carries one. */
  const pageLabel = (page: number) => pageLabels[page - 1]?.trim() || String(page);

  useEffect(() => {
    let active = true;
    const reloadQueue = async () => {
      const queued = await listDrawingPinMutations(projectId);
      if (active) { setQueuedMutations(queued); setQueueError(""); }
      return queued;
    };
    const synchronize = () => {
      void reloadQueue().then(async (queued) => {
        if (!active || !queued.length || !navigator.onLine) return;
        await run(async () => {
          const result = await syncDrawingPinMutations(client, projectId);
          if (result.failed || result.paused) throw new Error(text("Some pin changes are still waiting. Reconnect or correct the failed change and retry.", "Er wachten nog pinwijzigingen. Verbind opnieuw of corrigeer de mislukte wijziging en probeer opnieuw."));
          return result;
        }, text("Waiting pin changes sent.", "Wachtende pinwijzigingen verzonden."));
        await reloadQueue();
      }).catch(() => { if (active) setQueueError(text("Waiting pin changes could not be read. Check device storage and retry.", "Wachtende pinwijzigingen konden niet worden gelezen. Controleer apparaatopslag en probeer opnieuw.")); });
    };
    window.addEventListener("online", synchronize);
    synchronize();
    return () => { active = false; window.removeEventListener("online", synchronize); };
  }, [client, projectId, run, text]);

  const selectDrawing = (drawingId: string) => {
    setActiveDrawingId(drawingId);
    setViewport(resetDrawingViewport(1));
    setPageCount(1);
    setPageLabels([]);
    setDocumentTitle("");
    setPoint(null);
    setSelectedPinId(null);
  };

  /**
   * Why an upload cannot go through, in the words of the thing that is wrong with it,
   * instead of a button that is disabled and says nothing.
   */
  const uploadRefusal = (file: File | null) => {
    if (!file) return "";
    if (file.size > maxFileSizeBytes) {
      return text(
        `This drawing is ${humanFileSize(file.size)}; the project limit is ${data.settings?.max_file_size_mb ?? 25} MB.`,
        `Deze tekening is ${humanFileSize(file.size)}; de projectlimiet is ${data.settings?.max_file_size_mb ?? 25} MB.`,
      );
    }
    if (!supportedDrawingMimeTypes.includes(file.type) && !isDwgFile(file)) {
      return text(
        "Choose a PDF, JPEG, PNG, WebP or a DWG source file.",
        "Kies een PDF, JPEG, PNG, WebP of een DWG-bronbestand.",
      );
    }
    return "";
  };

  const uploadDrawing = async () => {
    const refusal = uploadRefusal(uploadFile);
    if (!uploadFile || refusal) {
      setUploadError(refusal);
      return;
    }
    setUploadError("");
    const dwgSource = isDwgFile(uploadFile);
    const okay = await run(
      () => uploadProjectFile(client, { projectId, buildingId: uploadBuildingId, category: "drawing", file: uploadFile, onProgress: setUploadProgress }),
      dwgSource
        ? text("DWG source stored. Upload its PDF export beside it to place pins.", "DWG-bron opgeslagen. Upload de PDF-export ernaast om pins te plaatsen.")
        : text("Drawing uploaded.", "Tekening geüpload."),
    );
    if (okay) {
      setUploadFile(null);
      setUploadProgress(0);
    } else {
      setUploadError(text(
        "The drawing did not reach central storage. Check the connection and try again; the file on this device is untouched.",
        "De tekening heeft de centrale opslag niet bereikt. Controleer de verbinding en probeer opnieuw; het bestand op dit toestel blijft ongewijzigd.",
      ));
    }
  };

  /**
   * The pin is placed for the record the supervisor came here with. There is no list to
   * choose from any more: an issue arrives from its own card, a field record arrives from
   * the record screen, and the pin takes that record's number, name and date by itself.
   */
  const placePin = async (nextPoint: PinPoint) => {
    if (!activeDrawing) return;
    if (pendingRecord) {
      onPlaceRecordPin?.({ drawingId: activeDrawing.id, pageNumber, xRatio: nextPoint.xRatio, yRatio: nextPoint.yRatio });
      setPoint(null);
      return;
    }
    if (!incomingFinding && !incomingInspection) return;
    const mutationId = `drawing-pin:${crypto.randomUUID()}`;
    let saved: Awaited<ReturnType<typeof saveDrawingPinOnlineOrQueue>> | null = null;
    const okay = await run(
      async () => {
        saved = await saveDrawingPinOnlineOrQueue(client, {
          id: mutationId,
          projectId,
          kind: "create",
          input: {
            drawingFileId: activeDrawing.id,
            pageNumber,
            xRatio: nextPoint.xRatio,
            yRatio: nextPoint.yRatio,
            linkedRecordType: incomingFinding ? "observation" : "inspection",
            linkedRecordId: incomingFinding ? incomingFinding.id : incomingInspection!.id,
            idempotencyKey: `offline-drawing-pin:${mutationId}`,
          },
        });
        return saved;
      },
      text("Pin saved.", "Pin opgeslagen."),
    );
    const wasQueued = (saved as Awaited<ReturnType<typeof saveDrawingPinOnlineOrQueue>> | null)?.queued ?? false;
    if (okay && wasQueued) {
      const linked = incomingFinding ?? incomingInspection!;
      setLocalPins((current) => [...current, {
        id: `pending:${mutationId}`,
        drawing_file_id: activeDrawing.id,
        page_number: pageNumber,
        x_ratio: nextPoint.xRatio,
        y_ratio: nextPoint.yRatio,
        linked_record_type: incomingFinding ? "observation" : "inspection",
        linked_record_id: linked.id,
        linked_record_number: incomingFinding ? incomingFinding.finding_number : incomingInspection!.inspection_number,
        linked_record_title: linked.title,
        note: null,
        status: "active",
        created_at: new Date().toISOString(),
      }]);
    }
    if (okay) setPoint(null);
  };

  /**
   * Everything in the project that a pin may point at, newest first. This is what makes a
   * spot on the drawing usable on its own: the supervisor no longer has to leave, open a
   * record and come back to place it.
   */
  /* Deliberately plain: the pin list is derived from arrays that are rebuilt each render,
     so a memo here could not be preserved and bought nothing. */
  const pinnableRecords = (() => {
    const pinned = new Set(allPins.filter((pin) => pin.status === "active").map((pin) => `${pin.linked_record_type}:${pin.linked_record_id}`));
    const rows = [
      ...data.findings.map((record) => ({ value: `observation:${record.id}`, type: "observation" as const, id: record.id, code: record.finding_number, title: record.title, date: record.created_at, buildingId: record.building_id })),
      ...data.inspections.map((record) => ({ value: `inspection:${record.id}`, type: "inspection" as const, id: record.id, code: record.inspection_number, title: record.title, date: record.started_at ?? record.planned_at ?? "", buildingId: record.building_id })),
      ...data.registerEntries.filter((entry) => ["rfi", "submittal", "document"].includes(entry.register_type))
        .map((record) => ({ value: `${record.register_type}:${record.id}`, type: record.register_type as "rfi" | "submittal" | "document", id: record.id, code: record.entry_number, title: record.title, date: record.occurred_at, buildingId: record.building_id })),
      ...data.visualCaptures.filter((capture) => capture.status === "active" && !capture.derived_from_file)
        .map((record) => ({ value: `visual:${record.id}`, type: "visual" as const, id: record.id, code: record.capture_type === "panorama" ? "360" : "PHOTO", title: record.title, date: record.captured_at, buildingId: record.building_id })),
    ];
    return rows
      .map((row) => ({ ...row, placed: pinned.has(`${row.type}:${row.id}`) }))
      .sort((left, right) => Number(left.placed) - Number(right.placed) || String(right.date).localeCompare(String(left.date)));
  })();

  /** The records of this drawing's building that still have no spot on any drawing. */
  const unplacedRecords = pinnableRecords
    .filter((record) => !record.placed && (!activeDrawing?.building_id || !record.buildingId || record.buildingId === activeDrawing.building_id))
    .slice(0, 12);

  const savePinFor = async (
    nextPoint: PinPoint,
    linkedRecordType: DrawingPin["linked_record_type"],
    linkedRecordId: string,
    known: { number: string; title: string },
  ) => {
    if (!activeDrawing) return false;
    const mutationId = `drawing-pin:${crypto.randomUUID()}`;
    let saved: Awaited<ReturnType<typeof saveDrawingPinOnlineOrQueue>> | null = null;
    const okay = await run(async () => {
      saved = await saveDrawingPinOnlineOrQueue(client, {
        id: mutationId,
        projectId,
        kind: "create",
        input: {
          drawingFileId: activeDrawing.id,
          pageNumber,
          xRatio: nextPoint.xRatio,
          yRatio: nextPoint.yRatio,
          linkedRecordType,
          linkedRecordId,
          idempotencyKey: `offline-drawing-pin:${mutationId}`,
        },
      });
      return saved;
    }, text("Pin saved.", "Pin opgeslagen."));
    if (okay && ((saved as Awaited<ReturnType<typeof saveDrawingPinOnlineOrQueue>> | null)?.queued ?? false)) {
      setLocalPins((current) => [...current, {
        id: `pending:${mutationId}`,
        drawing_file_id: activeDrawing.id,
        page_number: pageNumber,
        x_ratio: nextPoint.xRatio,
        y_ratio: nextPoint.yRatio,
        linked_record_type: linkedRecordType,
        linked_record_id: linkedRecordId,
        linked_record_number: known.number,
        linked_record_title: known.title,
        note: null,
        status: "active",
        created_at: new Date().toISOString(),
      }]);
    }
    return okay;
  };

  /** Hang an existing record on the tapped spot. */
  const linkRecordToPoint = async (nextPoint: PinPoint) => {
    const target = pinnableRecords.find((record) => record.value === spotRecord);
    if (!target) return;
    const okay = await savePinFor(nextPoint, target.type, target.id, { number: target.code, title: target.title });
    if (okay) {
      setPoint(null);
      setSpotRecord("");
    }
  };

  /**
   * Write the issue on the spot and pin it in the same action. The record is created first
   * because a pin cannot exist without one; if the pin then fails, the issue is still
   * safely recorded and says so.
   */
  const createIssueAtPoint = async (nextPoint: PinPoint) => {
    if (!activeDrawing || spotIssue.title.trim().length < 3) return;
    const chosenBuildings = spotBuildingIds.length
      ? spotBuildingIds
      : [activeDrawing.building_id || resolveDefaultBuildingId(buildings, buildingId)].filter(Boolean);
    const pinBuildingId = chosenBuildings[0] ?? activeDrawing.building_id ?? resolveDefaultBuildingId(buildings, buildingId);
    let created: Awaited<ReturnType<typeof createFinding>> | null = null;
    const recorded = await run(async () => {
      created = await createFinding(client, {
        projectId,
        buildingId: pinBuildingId,
        buildingIds: chosenBuildings,
        type: "deficiency",
        title: spotIssue.title.trim(),
        description: spotIssue.description.trim() || spotIssue.title.trim(),
        severity: spotIssue.severity,
        locationLabel: `${drawingLabel(activeDrawing)} · ${text("page", "pagina")} ${pageNumber}`,
        signedBy: spotSignature?.name,
        signedAt: spotSignature?.signedAt,
        signatureImage: spotSignature?.image ?? null,
      });
      return created;
    }, text("Issue recorded from the drawing.", "Issue vanaf de tekening vastgelegd."));
    const finding = created as Awaited<ReturnType<typeof createFinding>> | null;
    if (!recorded || !finding) return;
    const okay = await savePinFor(nextPoint, "observation", finding.id, { number: finding.finding_number, title: finding.title });
    if (okay) {
      setPoint(null);
      setSpotIssue({ title: "", description: "", severity: "medium" });
      setSpotBuildingIds([]);
      setSpotSignature(null);
    }
  };

  const movePin = async (pin: DrawingPin, nextPoint: PinPoint) => {
    if (pin.id.startsWith("pending:")) return false;
    const previous = pinOverrides[pin.id] ?? { xRatio: Number(pin.x_ratio), yRatio: Number(pin.y_ratio) };
    setPinOverrides((current) => ({ ...current, [pin.id]: nextPoint }));
    const okay = await run(
      () => saveDrawingPinOnlineOrQueue(client, {
        id: `drawing-pin-move:${pin.id}:${crypto.randomUUID()}`,
        projectId,
        kind: "move",
        input: { pinId: pin.id, xRatio: nextPoint.xRatio, yRatio: nextPoint.yRatio },
      }),
      text("Pin moved.", "Pin verplaatst."),
    );
    if (!okay) setPinOverrides((current) => ({ ...current, [pin.id]: previous }));
    return okay;
  };

  const deletePin = async (pin: DrawingPin) => {
    if (pin.id.startsWith("pending:")) return;
    setHiddenPinIds((current) => [...current, pin.id]);
    setSelectedPinId(null);
    const okay = await run(
      () => saveDrawingPinOnlineOrQueue(client, {
        id: `drawing-pin-void:${pin.id}`,
        projectId,
        kind: "void",
        input: { pinId: pin.id, reason: text("Removed from drawing by supervisor", "Door toezichthouder van tekening verwijderd") },
      }),
      text("Pin removed.", "Pin verwijderd."),
    );
    if (!okay) {
      setHiddenPinIds((current) => current.filter((id) => id !== pin.id));
      setSelectedPinId(pin.id);
    }
  };

  const saveMarkup = async (geometry: DrawingMarkup["geometry"]) => {
    if (!activeDrawing || tool === "pin" || tool === "pan") return false;
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
      {queueError ? <p className="operation-alert error" role="alert">{queueError}</p> : null}
      <div className="visual-toolbar">
        <div>
          <h2>{text("Pins that open the exact project record", "Pins die het juiste projectrecord openen")}</h2>
          <p>{text("Drawings workspace", "Tekeningenwerkruimte")}</p>
        </div>
      </div>

      {/* The record that is still open says so here, and says what tapping does. */}
      {pendingRecord ? (
        <div className="operation-alert success drawing-finding-handoff">
          <MapPin size={18} />
          <div>
            <strong>{text(`Place ${pendingRecord.label} on a drawing`, `Plaats ${pendingRecord.label} op een tekening`)}</strong>
            <span>{pendingRecord.point
              ? text("Spot chosen. Go back to the record and save it.", "Punt gekozen. Ga terug naar de registratie en sla op.")
              : text("Choose the drawing and page, then tap the exact spot.", "Kies de tekening en pagina en tik op het exacte punt.")}</span>
          </div>
        </div>
      ) : null}

      {incomingInspection && !incomingFinding ? (
        <div className="operation-alert success drawing-finding-handoff">
          <MapPin size={18} />
          <div>
            <strong>{text(`Place ${incomingInspection.inspection_number} on a drawing`, `Plaats ${incomingInspection.inspection_number} op een tekening`)}</strong>
          </div>
        </div>
      ) : null}

      {incomingFinding ? (
        <div className="operation-alert success drawing-finding-handoff">
          <MapPin size={18} />
          <div>
            <strong>{incomingPin
              ? text(`${incomingFinding.finding_number} is already on a drawing`, `${incomingFinding.finding_number} staat al op een tekening`)
              : text(`Place ${incomingFinding.finding_number} on a drawing`, `Plaats ${incomingFinding.finding_number} op een tekening`)}</strong>
          </div>
        </div>
      ) : null}

      <div className="drawing-upload-strip">
        <BuildingPicker id="drawing-upload-building" buildings={buildings} value={uploadBuildingId} onChange={setUploadBuildingId} />
        {/* The browser's own "Choose File · no file selected" was the one control on this
            screen that did not look like the application it stands in. */}
        <label className="finding-photo-capture drawing-file-picker">
          <FileUp size={20} />
          <span>
            <strong>{uploadFile ? uploadFile.name : text("Choose a drawing", "Kies een tekening")}</strong>
            <small>{uploadFile
              ? humanFileSize(uploadFile.size)
              : text(`DWG source, PDF, JPEG, PNG or WebP · max. ${data.settings?.max_file_size_mb ?? 25} MB`, `DWG-bron, PDF, JPEG, PNG of WebP · max. ${data.settings?.max_file_size_mb ?? 25} MB`)}</small>
          </span>
          <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp,.dwg,.pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => { setUploadFile(event.target.files?.[0] ?? null); setUploadError(uploadRefusal(event.target.files?.[0] ?? null)); }} />
        </label>
        <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || !uploadFile || uploadFile.size > maxFileSizeBytes || (!supportedDrawingMimeTypes.includes(uploadFile.type) && !isDwgFile(uploadFile))} onClick={() => void uploadDrawing()}>
          {busy ? <Loader2 className="spin" size={15} /> : <FileUp size={15} />} {text("Upload drawing", "Tekening uploaden")}
        </button>
        {uploadError ? <p className="field-error" role="alert">{uploadError}</p> : null}
        {uploadProgress > 0 ? <div className="upload-progress" aria-label={`${text("Upload", "Upload")} ${uploadProgress}%`}><span style={{ width: `${uploadProgress}%` }} /><small>{uploadProgress}%</small></div> : null}
      </div>

      {dwgSources.length ? <div className="operation-alert"><FileText size={18} /><div><strong>{text(`${dwgSources.length} native DWG source file(s) retained`, `${dwgSources.length} native DWG-bronbestand(en) bewaard`)}</strong><span>{text("Upload a PDF export to mark up or pin on this drawing.", "Upload een PDF-export om te markeren of pins te plaatsen.")}</span></div></div> : null}

      {drawings.length && activeDrawing ? (
        <div className="drawing-workspace-grid">
          <section className="drawing-file-list" aria-label={text("Drawing list", "Tekeningenlijst") }>
            {drawings.map((drawing) => {
              const pinCount = data.drawingPins.filter((pin) => pin.drawing_file_id === drawing.id && pin.status === "active").length;
              return (
                <button type="button" className={drawing.id === activeDrawing.id ? "active" : ""} onClick={() => selectDrawing(drawing.id)} key={drawing.id}>
                  <span className="visual-list-icon">{drawing.mime_type === "application/pdf" ? <FileText size={17} /> : <ImageIcon size={17} />}</span>
                  <span><strong title={drawing.original_name}>{drawingLabel(drawing)}</strong><small>{pinCount} {text(pinCount === 1 ? "linked pin" : "linked pins", pinCount === 1 ? "gekoppelde pin" : "gekoppelde pins")}</small></span>
                </button>
              );
            })}
          </section>

          <div className="drawing-stage-column">
            <div className="drawing-stage-header">
              {/* The drawing's own title wins over the name the file happened to get. */}
              <div><span className="record-number">{activeDrawing.mime_type === "application/pdf" ? "PDF" : text("Drawing image", "Tekeningsafbeelding")}</span><h2 title={activeDrawing.original_name}>{documentTitle || drawingLabel(activeDrawing)}</h2>{documentTitle ? <small className="drawing-sheet-source">{drawingLabel(activeDrawing)}</small> : null}</div>
              <div className="tour-controls">
                <button type="button" aria-label={text("Previous page", "Vorige pagina")} disabled={pageNumber <= 1} onClick={() => changePage(Math.max(1, pageNumber - 1))}><ChevronLeft size={17} /></button>
                {/* Jumping straight to a sheet, by the name the sheet carries itself. */}
                {pageCount > 1 ? (
                  <select className="drawing-page-select" value={pageNumber} onChange={(event) => changePage(Number(event.target.value))} aria-label={text("Drawing page", "Tekeningspagina")}>
                    {Array.from({ length: pageCount }, (_, index) => <option value={index + 1} key={index}>{text(`Sheet ${pageLabel(index + 1)}`, `Blad ${pageLabel(index + 1)}`)}</option>)}
                  </select>
                ) : <span>{pageLabel(pageNumber)} / {pageCount}</span>}
                <button type="button" aria-label={text("Next page", "Volgende pagina")} disabled={pageNumber >= pageCount} onClick={() => changePage(Math.min(pageCount, pageNumber + 1))}><ChevronRight size={17} /></button>
                <button type="button" aria-label={text("Zoom out", "Uitzoomen")} disabled={viewport.scale <= 1} onClick={() => setViewport((current) => zoomDrawingViewport(current, current.scale / 1.25, { x: 0, y: 0 }))}><ZoomOut size={17} /></button>
                <span>{Math.round(viewport.scale * 100)}%</span>
                <button type="button" aria-label={text("Zoom in", "Inzoomen")} disabled={viewport.scale >= 6} onClick={() => setViewport((current) => zoomDrawingViewport(current, current.scale * 1.25, { x: 0, y: 0 }))}><ZoomIn size={17} /></button>
              </div>
            </div>
            <div className="drawing-markup-toolbar" role="toolbar" aria-label={text("Drawing and linking tools", "Teken- en koppelingstools")}>
              {/* Freehand is gone: placing a pin is the job here, and a hand-drawn line over
                  a contract drawing was the one tool the client crossed out. */}
              {([
                ["pan", Hand, text("Pan", "Verschuif")],
                ["pin", MapPin, text("Link pin", "Koppelpin")],
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
            <div className="drawing-pin-legend" aria-label={text("Pin record types", "Pintypen registraties")}>
              {(Object.keys(linkTypeLabels) as Array<DrawingPin["linked_record_type"]>).map((type) => (
                <span key={type}>{linkTypeLabels[type][language]}</span>
              ))}
            </div>
            <DrawingCanvas
              key={activeDrawing.id}
              file={activeDrawing}
              viewport={viewport}
              pins={activePins}
              markups={activeMarkups}
              pendingPoint={point}
              tool={tool}
              color={markupColor}
              strokeWidth={strokeWidth}
              textContent={markupText}
              client={client}
              onPageCount={handlePageCount}
              onDocumentDetails={handleDocumentDetails}
              onViewportChange={setViewport}
              onPoint={(nextPoint) => { setPoint(nextPoint); setSelectedPinId(null); setPanelNudge((count) => count + 1); }}
              onSelectPin={(pinId) => { setSelectedPinId(pinId); setPoint(null); setPanelNudge((count) => count + 1); }}
              onMovePin={movePin}
              onCreateMarkup={saveMarkup}
            />
            <div className="visual-stage-help">{tool === "pin" ? <MapPin size={15} /> : <MousePointer2 size={15} />}<span>{tool === "pin" ? text("Click the exact location, then choose the record to link.", "Klik op de exacte locatie en kies de registratie om te koppelen.") : text("Draw over the drawing. The original is not changed.", "Teken over de tekening. Het origineel blijft ongewijzigd.")}</span></div>
          </div>

          <div className="drawing-link-panel" ref={linkPanelRef}>
            {point && (pendingRecord || incomingFinding || incomingInspection) ? (
              <div className="drawing-link-form">
                <div>
                  <span className="record-number">{text("Location ready", "Locatie gereed")}</span>
                  <h2>{pendingRecord ? pendingRecord.label : incomingFinding?.finding_number ?? incomingInspection?.inspection_number}</h2>
                  <p>X {Math.round(point.xRatio * 100)}% · Y {Math.round(point.yRatio * 100)}% · {text("page", "pagina")} {pageNumber}</p>
                </div>
                <div className="operation-alert success">
                  <MapPin size={18} />
                  <div>
                    <strong>{pendingRecord
                      ? text("The pin is placed when you save the record", "De pin wordt geplaatst zodra je de registratie opslaat")
                      : text("Confirm this exact location", "Bevestig deze exacte locatie")}</strong>
                    <span>{pendingRecord
                      ? text("Tap another spot to move the pin.", "Tik op een ander punt om de pin te verplaatsen.")
                      : text("Nothing is saved until you confirm.", "Er wordt niets opgeslagen tot je bevestigt.")}</span>
                  </div>
                </div>
                <div className="button-row"><button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy} onClick={() => void placePin(point)}><MapPin size={15} /> {text("Confirm pin", "Pin bevestigen")}</button><button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => setPoint(null)}>{text("Cancel", "Annuleren")}</button></div>
              </div>
            ) : point ? (
              /* A spot on the drawing is usable on its own: write the issue here, or hang
                 an existing record on it. Leaving the screen to fetch a record first was
                 the dead end the client ran into. */
              <div className="drawing-link-form drawing-spot-form">
                <div><span className="record-number">{text("This spot", "Deze plek")}</span><h2>{text("What belongs here?", "Wat hoort hier?")}</h2><p>X {Math.round(point.xRatio * 100)}% · Y {Math.round(point.yRatio * 100)}% · {text("page", "pagina")} {pageNumber}</p></div>
                <div className="drawing-spot-modes" role="group" aria-label={text("What to place", "Wat te plaatsen")}>
                  <button className={spotMode === "issue" ? "active" : ""} type="button" onClick={() => setSpotMode("issue")}><Plus size={14} /> {text("New issue here", "Nieuw issue hier")}</button>
                  <button className={spotMode === "link" ? "active" : ""} type="button" onClick={() => setSpotMode("link")}><Link2 size={14} /> {text("Existing record", "Bestaande registratie")}</button>
                </div>
                {spotMode === "issue" ? (
                  <>
                    <label className="form-field"><span>{text("What is wrong here?", "Wat is hier mis?")}</span><input value={spotIssue.title} onChange={(event) => setSpotIssue({ ...spotIssue, title: event.target.value })} placeholder={text("Short subject", "Kort onderwerp")} /></label>
                    <label className="form-field"><span>{text("Description", "Omschrijving")}</span><textarea rows={3} value={spotIssue.description} onChange={(event) => setSpotIssue({ ...spotIssue, description: event.target.value })} /></label>
                    <label className="form-field"><span>{text("Severity", "Ernst")}</span><select value={spotIssue.severity} onChange={(event) => setSpotIssue({ ...spotIssue, severity: event.target.value })}><option value="low">{text("Low", "Laag")}</option><option value="medium">{text("Medium", "Middel")}</option><option value="high">{text("High", "Hoog")}</option><option value="critical">{text("Critical", "Kritiek")}</option></select></label>
                    <BuildingMultiPicker
                      id="drawing-spot-buildings"
                      buildings={buildings}
                      value={spotBuildingIds.length ? spotBuildingIds : [activeDrawing?.building_id ?? ""].filter(Boolean)}
                      onChange={setSpotBuildingIds}
                    />
                    <SignatureField
                      label={text("Signature", "Handtekening")}
                      declaration={text("I confirm that this issue reflects what I marked on the drawing.", "Ik bevestig dat dit issue weergeeft wat ik op de tekening heb gemarkeerd.")}
                      hint={text("Optional; the name and moment are stored with the issue.", "Optioneel; de naam en het moment worden bij het issue opgeslagen.")}
                      value={spotSignature}
                      onChange={setSpotSignature}
                    />
                    <div className="button-row">
                      <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || spotIssue.title.trim().length < 3} onClick={() => void createIssueAtPoint(point)}><MapPin size={15} /> {text("Record and pin it", "Vastleggen en pinnen")}</button>
                      <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => setPoint(null)}>{text("Cancel", "Annuleren")}</button>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="form-field">
                      <span>{text("Record to place here", "Registratie voor deze plek")}</span>
                      <select value={spotRecord} onChange={(event) => setSpotRecord(event.target.value)}>
                        <option value="">{text("Choose a record", "Kies een registratie")}</option>
                        {pinnableRecords.map((record) => <option value={record.value} key={record.value}>{record.placed ? "• " : ""}{record.code} · {record.title}</option>)}
                      </select>
                    </label>
                    <div className="button-row">
                      <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || !spotRecord} onClick={() => void linkRecordToPoint(point)}><MapPin size={15} /> {text("Place pin", "Pin plaatsen")}</button>
                      <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => setPoint(null)}>{text("Cancel", "Annuleren")}</button>
                    </div>
                  </>
                )}
              </div>
            ) : selectedPin ? <DrawingPinDetails pin={selectedPin} onOpen={() => onOpenLinkedRecord(selectedPin.linked_record_type, selectedPin.linked_record_id)} onDelete={() => void deletePin(selectedPin)} /> : (
              <div className="drawing-unplaced-panel">
                <div className="visual-panel-empty"><MapPin size={24} /><strong>{text("Place or select a drawing pin", "Plaats of selecteer een tekeningspin")}</strong><span>{text("Choose the pin tool and tap the drawing.", "Kies de pin-tool en tik op de tekening.")}</span></div>
                {/* Everything in this building that has no spot yet, so placing the backlog
                    is a tap on a name rather than a hunt through the modules. */}
                {unplacedRecords.length ? <section className="drawing-unplaced-list" aria-label={text("Records without a spot", "Registraties zonder plek")}>
                  <header><FileQuestion size={15} /> <strong>{text("Not on a drawing yet", "Nog niet op een tekening")}</strong> <b>{unplacedRecords.length}</b></header>
                  {unplacedRecords.map((record) => (
                    <button type="button" onClick={() => { setTool("pin"); setSpotMode("link"); setSpotRecord(record.value); }} key={record.value}>
                      <span className="drawing-unplaced-dot"><MapPin size={12} /></span>
                      <span><strong>{record.code}</strong><small>{record.title}</small></span>
                      <ArrowUpRight size={14} />
                    </button>
                  ))}
                </section> : null}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="empty-list-state visual-empty"><FileUp size={24} /><strong>{text("No previewable drawing yet", "Nog geen bekijkbare tekening")}</strong></div>
      )}

      {activeDrawing ? <div className="operation-alert"><ShieldCheck size={18} /><div><strong>{text("Original drawing remains unchanged", "Originele tekening blijft ongewijzigd")}</strong></div></div> : null}
    </section>
  );
}

function DrawingCanvas({ file, viewport, pins, markups, pendingPoint, tool, color, strokeWidth, textContent, client, onPageCount, onDocumentDetails, onViewportChange, onPoint, onSelectPin, onMovePin, onCreateMarkup }: {
  file: FileRecord;
  viewport: DrawingViewport;
  pins: DrawingPin[];
  markups: DrawingMarkup[];
  pendingPoint: PinPoint | null;
  tool: DrawingTool;
  color: string;
  strokeWidth: number;
  textContent: string;
  client: SupabaseClient;
  onPageCount: (count: number) => void;
  /** Sheet labels and the title the drawing carries itself. */
  onDocumentDetails: (details: { labels: string[]; title: string }) => void;
  onViewportChange: React.Dispatch<React.SetStateAction<DrawingViewport>>;
  onPoint: (point: PinPoint) => void;
  onSelectPin: (pinId: string) => void;
  onMovePin: (pin: DrawingPin, point: PinPoint) => Promise<boolean>;
  onCreateMarkup: (geometry: DrawingMarkup["geometry"]) => Promise<boolean>;
}) {
  const { text } = useLanguage();
  const pageNumber = viewport.page;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [loading, setLoading] = useState(true);
  const [renderedSource, setRenderedSource] = useState("");
  const [error, setError] = useState("");
  const [aspectRatio, setAspectRatio] = useState("4 / 3");
  const [renderWidth, setRenderWidth] = useState(900);
  const expectedSource = `${file.id}:${previewUrl}:${pageNumber}:${mimeType === "application/pdf" ? renderWidth : 0}`;
  const interactionReady = !loading && renderedSource === expectedSource;
  /** The rendered page in its own pixels: the overlay draws in exactly this space. */
  const [pageSize, setPageSize] = useState({ width: 900, height: 675 });
  const [draftPoints, setDraftPoints] = useState<NormalizedPoint[]>([]);
  const drawingRef = useRef(false);
  const draftPointsRef = useRef<NormalizedPoint[]>([]);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const singleGestureRef = useRef<{ start: { x: number; y: number }; last: { x: number; y: number }; moved: boolean; multiTouch: boolean } | null>(null);
  const pinchRef = useRef<{ distance: number; center: { x: number; y: number }; viewport: DrawingViewport } | null>(null);
  const [draggedPin, setDraggedPin] = useState<{ id: string; point: PinPoint } | null>(null);

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
    const surface = surfaceRef.current;
    if (!surface) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = Math.max(1, Math.round(entry.contentRect.width));
      const height = Math.max(1, Math.round(entry.contentRect.height));
      setRenderWidth(width);
      setPageSize({ width, height });
    });
    observer.observe(surface);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!previewUrl || mimeType !== "application/pdf" || !canvasRef.current) return;
    let cancelled = false;
    let loadingTask: { destroy: () => Promise<void> } | null = null;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;
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
      // The drawing knows its own sheet names and its own title. Reading them here means a
      // page is chosen by what the drawing calls it, not by a number the app invented.
      void Promise.all([
        pdf.getPageLabels().catch(() => null),
        pdf.getMetadata().catch(() => null),
      ]).then(([labels, metadata]) => {
        if (cancelled) return;
        const info = metadata?.info as { Title?: unknown } | undefined;
        onDocumentDetails({
          labels: Array.isArray(labels) ? labels.map((label) => String(label ?? "")) : [],
          title: typeof info?.Title === "string" ? info.Title.trim() : "",
        });
      });
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const naturalViewport = page.getViewport({ scale: 1 });
      const pdfViewport = page.getViewport({ scale: renderWidth / naturalViewport.width });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(pdfViewport.width * pixelRatio);
      canvas.height = Math.floor(pdfViewport.height * pixelRatio);
      canvas.style.aspectRatio = `${pdfViewport.width} / ${pdfViewport.height}`;
      setAspectRatio(`${pdfViewport.width} / ${pdfViewport.height}`);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Drawing canvas is unavailable.");
      renderTask = page.render({ canvas, canvasContext: context, viewport: pdfViewport, transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0] });
      await renderTask.promise;
      if (!cancelled) { setRenderedSource(`${file.id}:${previewUrl}:${pageNumber}:${renderWidth}`); setLoading(false); }
    }).catch((caught: unknown) => {
      if (!cancelled) {
        setLoading(false);
        setError(caught instanceof Error ? caught.message : text("PDF page could not be rendered.", "PDF-pagina kon niet worden weergegeven."));
      }
    });
    return () => {
      cancelled = true;
      renderTask?.cancel();
      void loadingTask?.destroy().catch(() => undefined);
    };
  }, [file.id, mimeType, onDocumentDetails, onPageCount, pageNumber, previewUrl, renderWidth, text]);

  const normalizedPoint = (clientX: number, clientY: number): NormalizedPoint => {
    const surface = surfaceRef.current;
    if (!surface) return { x: 0.5, y: 0.5 };
    return drawingPointFromClient({ x: clientX, y: clientY }, surface.getBoundingClientRect(), viewport);
  };

  const beginMarkup = (event: React.PointerEvent<HTMLDivElement>) => {
    if (tool === "pin" || tool === "pan") return;
    event.preventDefault();
    const start = normalizedPoint(event.clientX, event.clientY);
    if (tool === "text") {
      if (textContent.trim()) void onCreateMarkup({ position: start });
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    updateDraftPoints([start]);
  };

  const continueMarkup = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current || tool === "pin" || tool === "pan" || tool === "text") return;
    const point = normalizedPoint(event.clientX, event.clientY);
    const points = draftPointsRef.current;
    updateDraftPoints(tool === "arrow" ? [points[0], point] : [...points, point]);
  };

  const finishMarkup = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current || tool === "pin" || tool === "pan" || tool === "text") return;
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    drawingRef.current = false;
    const finalPoint = normalizedPoint(event.clientX, event.clientY);
    const currentPoints = draftPointsRef.current;
    const points = tool === "arrow" ? [currentPoints[0], finalPoint].filter(Boolean) : [...currentPoints, finalPoint];
    updateDraftPoints([]);
    if (points.length < 2) return;
    void onCreateMarkup(tool === "arrow" ? { start: points[0], end: points[points.length - 1] } : { points });
  };

  const beginPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!interactionReady || error || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 2) {
      drawingRef.current = false;
      updateDraftPoints([]);
      // The gesture that started as one finger is a pinch from here on. Marking it stops the
      // final lift of that pinch from being read as a tap that places a pin.
      if (singleGestureRef.current) singleGestureRef.current.multiTouch = true;
      const [left, right] = [...pointersRef.current.values()];
      const bounds = event.currentTarget.getBoundingClientRect();
      pinchRef.current = {
        distance: Math.hypot(right.x - left.x, right.y - left.y),
        center: { x: (left.x + right.x) / 2 - bounds.left, y: (left.y + right.y) / 2 - bounds.top },
        viewport,
      };
      return;
    }
    singleGestureRef.current = {
      start: { x: event.clientX, y: event.clientY },
      last: { x: event.clientX, y: event.clientY },
      moved: false,
      multiTouch: false,
    };
    beginMarkup(event);
  };

  const movePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const [left, right] = [...pointersRef.current.values()];
      const bounds = event.currentTarget.getBoundingClientRect();
      const distance = Math.max(1, Math.hypot(right.x - left.x, right.y - left.y));
      const center = { x: (left.x + right.x) / 2 - bounds.left, y: (left.y + right.y) / 2 - bounds.top };
      const zoomed = zoomDrawingViewport(pinchRef.current.viewport, pinchRef.current.viewport.scale * distance / Math.max(1, pinchRef.current.distance), pinchRef.current.center);
      onViewportChange(panDrawingViewport(zoomed, { x: center.x - pinchRef.current.center.x, y: center.y - pinchRef.current.center.y }));
      return;
    }
    const gesture = singleGestureRef.current;
    if ((tool === "pan" || tool === "pin") && gesture) {
      const totalDistance = Math.hypot(event.clientX - gesture.start.x, event.clientY - gesture.start.y);
      if (totalDistance > tapSlopPixels) gesture.moved = true;
      if (gesture.moved) {
        onViewportChange((current) => panDrawingViewport(current, { x: event.clientX - gesture.last.x, y: event.clientY - gesture.last.y }));
        gesture.last = { x: event.clientX, y: event.clientY };
      }
      return;
    }
    continueMarkup(event);
  };

  const finishPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!interactionReady || error || !pointersRef.current.has(event.pointerId)) { cancelPointers(); return; }
    if (pointerLiftPlacesPin({ tool, activePointerCount: pointersRef.current.size, gesture: singleGestureRef.current })) {
      const point = normalizedPoint(event.clientX, event.clientY);
      onPoint({ xRatio: point.x, yRatio: point.y });
    } else {
      finishMarkup(event);
    }
    pointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (!pointersRef.current.size) singleGestureRef.current = null;
  };

  const cancelPointers = () => {
    pointersRef.current.clear();
    pinchRef.current = null;
    singleGestureRef.current = null;
    drawingRef.current = false;
    updateDraftPoints([]);
  };

  useEffect(() => {
    pointersRef.current.clear();
    pinchRef.current = null;
    singleGestureRef.current = null;
    drawingRef.current = false;
    draftPointsRef.current = [];
    const reset = requestAnimationFrame(() => { setDraftPoints([]); setDraggedPin(null); });
    return () => cancelAnimationFrame(reset);
  }, [pageNumber, tool, previewUrl]);

  const beginPinDrag = (event: React.PointerEvent<HTMLButtonElement>, pin: DrawingPin) => {
    event.stopPropagation();
    if (!interactionReady || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelectPin(pin.id);
    setDraggedPin({ id: pin.id, point: { xRatio: Number(pin.x_ratio), yRatio: Number(pin.y_ratio) } });
  };

  const movePinDrag = (event: React.PointerEvent<HTMLButtonElement>, pin: DrawingPin) => {
    if (!interactionReady || draggedPin?.id !== pin.id) return;
    event.preventDefault();
    event.stopPropagation();
    const point = normalizedPoint(event.clientX, event.clientY);
    setDraggedPin({ id: pin.id, point: { xRatio: point.x, yRatio: point.y } });
  };

  const finishPinDrag = (event: React.PointerEvent<HTMLButtonElement>, pin: DrawingPin) => {
    if (!interactionReady || draggedPin?.id !== pin.id) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const point = draggedPin.point;
    setDraggedPin(null);
    // Tapping a pin selects it. Only a pin that actually travelled is written back, so
    // selecting one no longer costs a request and a "position saved" confirmation.
    if (pinDragMoved({ xRatio: Number(pin.x_ratio), yRatio: Number(pin.y_ratio) }, point)) void onMovePin(pin, point);
  };

  return (
    <div className="drawing-canvas-frame">
      {error ? <div className="visual-load-state error"><AlertTriangle size={21} /> {error}</div> : null}
      {!error ? (
        <div
          className={`drawing-canvas-surface ${tool === "pan" ? "is-panning" : tool === "pin" ? "is-placing-pin" : "is-marking"}`}
          ref={surfaceRef}
          style={{ aspectRatio }}
          role="application"
          tabIndex={0}
          data-page={pageNumber}
          data-scale={viewport.scale.toFixed(3)}
          aria-label={text("Interactive drawing. Pan, zoom or place a linked pin.", "Interactieve tekening. Verschuif, zoom of plaats een gekoppelde pin.")}
          onKeyDown={(event) => { if (interactionReady && tool === "pin" && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onPoint({ xRatio: 0.5, yRatio: 0.5 }); } }}
          onPointerDown={beginPointer}
          onPointerMove={movePointer}
          onPointerUp={finishPointer}
          onPointerCancel={cancelPointers}
        >
          <div className="drawing-viewport-content" style={{ transform: `translate(${viewport.offset.x}px, ${viewport.offset.y}px) scale(${viewport.scale})` }}>
            {mimeType === "application/pdf" ? <canvas ref={canvasRef} /> : previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={`${file.id}:${previewUrl}`} src={previewUrl} alt={file.original_name} onLoad={(event) => { setAspectRatio(`${event.currentTarget.naturalWidth} / ${event.currentTarget.naturalHeight}`); setRenderedSource(expectedSource); setLoading(false); onPageCount(1); }} onError={() => { setLoading(false); setError(text("Drawing image could not be displayed.", "De tekeningafbeelding kon niet worden weergegeven.")); }} />
          ) : null}
          {/* The overlay works in the page's own pixels, so nothing in it is stretched. */}
          <svg className="drawing-markup-layer" viewBox={`0 0 ${pageSize.width} ${pageSize.height}`} aria-hidden="true">
            {markups.map((markup) => <MarkupShape markup={markup} size={pageSize} key={markup.id} />)}
            {draftPoints.length > 1 ? <DraftShape points={draftPoints} tool={tool} color={color} strokeWidth={strokeWidth} size={pageSize} /> : null}
          </svg>
          {/* The pin itself carries the colour of its record type; the chip under it
              carries the code, so a drawing can be read without opening anything. */}
          {pins.map((pin, index) => {
            const shownPoint = draggedPin?.id === pin.id ? draggedPin.point : { xRatio: Number(pin.x_ratio), yRatio: Number(pin.y_ratio) };
            return (
            <span className="drawing-pin-anchor" style={{ left: `${shownPoint.xRatio * 100}%`, top: `${shownPoint.yRatio * 100}%`, transform: `scale(${1 / viewport.scale})`, transformOrigin: "0 0" }} key={pin.id}>
              <button className="drawing-pin" type="button" aria-label={`${pin.linked_record_number} · ${pin.linked_record_title}`} onPointerDown={(event) => beginPinDrag(event, pin)} onPointerMove={(event) => movePinDrag(event, pin)} onPointerUp={(event) => finishPinDrag(event, pin)} onPointerCancel={(event) => { event.stopPropagation(); setDraggedPin(null); }}><span>{index + 1}</span></button>
              <em className="drawing-pin-code">{pin.linked_record_number}</em>
            </span>
            );
          })}
          {pendingPoint ? <span className="drawing-pin pending drawing-pin-scaled" style={{ left: `${pendingPoint.xRatio * 100}%`, top: `${pendingPoint.yRatio * 100}%`, "--pin-inverse-scale": 1 / viewport.scale } as React.CSSProperties}><Plus size={13} /></span> : null}
          </div>
          {loading ? <div className="drawing-loading"><Loader2 className="spin" size={22} /> {text("Rendering secured drawing…", "Beveiligde tekening wordt weergegeven…")}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

function MarkupShape({ markup, size }: { markup: DrawingMarkup; size: { width: number; height: number } }) {
  const width = Math.max(1, Number(markup.stroke_width) || 3);
  const points = (markup.geometry.points ?? []).map((point) => toPagePoint(point, size));

  if (markup.markup_type === "freehand" && points.length > 1) {
    return <polyline points={polylinePoints(markup.geometry.points ?? [], size)} fill="none" stroke={markup.color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />;
  }
  if (markup.markup_type === "cloud" && points.length > 1) {
    return <path d={cloudPath(points)} fill="none" stroke={markup.color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />;
  }
  if (markup.markup_type === "arrow" && markup.geometry.start && markup.geometry.end) {
    const start = toPagePoint(markup.geometry.start, size);
    const end = toPagePoint(markup.geometry.end, size);
    const stop = arrowLineEnd(start, end, width);
    return (
      <g>
        <line x1={start.x} y1={start.y} x2={stop.x} y2={stop.y} stroke={markup.color} strokeWidth={width} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <polygon points={arrowHeadPoints(start, end, width)} fill={markup.color} />
      </g>
    );
  }
  if (markup.markup_type === "text" && markup.geometry.position && markup.text_content) {
    const at = toPagePoint(markup.geometry.position, size);
    const box = textBoxSize(markup.text_content);
    return (
      <g transform={`translate(${at.x} ${at.y})`}>
        <rect x="0" y={-box.height} width={box.width} height={box.height} rx="5" fill="#fff" fillOpacity=".93" stroke={markup.color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <text x="8" y={-box.height / 3} fill={markup.color} fontSize="15" fontWeight="700">{markup.text_content}</text>
      </g>
    );
  }
  return null;
}

/** What is under the finger right now, drawn the same way the saved shape will be. */
function DraftShape({ points, tool, color, strokeWidth, size }: {
  points: NormalizedPoint[];
  tool: DrawingTool;
  color: string;
  strokeWidth: number;
  size: { width: number; height: number };
}) {
  const pagePoints = points.map((point) => toPagePoint(point, size));
  if (tool === "arrow") {
    const start = pagePoints[0];
    const end = pagePoints[pagePoints.length - 1];
    const stop = arrowLineEnd(start, end, strokeWidth);
    return (
      <g>
        <line x1={start.x} y1={start.y} x2={stop.x} y2={stop.y} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <polygon points={arrowHeadPoints(start, end, strokeWidth)} fill={color} />
      </g>
    );
  }
  if (tool === "cloud") {
    return <path d={cloudPath(pagePoints)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />;
  }
  return <polyline points={polylinePoints(points, size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />;
}

function DrawingPinDetails({ pin, onOpen, onDelete }: { pin: DrawingPin; onOpen: () => void; onDelete: () => void }) {
  const { text } = useLanguage();
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  return (
    <div className="visual-annotation-details">
      <span className="visual-severity-line" />
      <span className="record-number">{pin.linked_record_number} · {typeText(pin.linked_record_type, text)}</span>
      <h2>{pin.linked_record_title}</h2>
      {pin.note ? <p>{pin.note}</p> : null}
      <dl>
        <div><dt>{text("Drawing page", "Tekeningspagina")}</dt><dd>{pin.page_number}</dd></div>
        <div><dt>{text("Exact position", "Exacte positie")}</dt><dd>X {Math.round(Number(pin.x_ratio) * 100)}% · Y {Math.round(Number(pin.y_ratio) * 100)}%</dd></div>
      </dl>
      <button className="ui-button ui-button--primary ui-button--md" type="button" onClick={onOpen}><ArrowUpRight size={15} /> {text("Open linked project record", "Open gekoppeld projectrecord")}</button>
      {confirmingRemoval ? (
        <div className="operation-alert" role="alertdialog" aria-label={text("Remove this pin?", "Deze pin verwijderen?")}>
          <Trash2 size={18} />
          <div>
            <strong>{text("Remove this pin from the drawing?", "Deze pin van de tekening verwijderen?")}</strong>
            <span>{text("The audit trail is retained.", "Het auditspoor blijft behouden.")}</span>
            <div className="button-row">
              <button className="ui-button ui-button--secondary ui-button--md ui-button--danger" type="button" onClick={() => { setConfirmingRemoval(false); onDelete(); }}>{text("Remove pin", "Pin verwijderen")}</button>
              <button className="ui-button ui-button--secondary ui-button--md" type="button" autoFocus onClick={() => setConfirmingRemoval(false)}>{text("Keep pin", "Pin behouden")}</button>
            </div>
          </div>
        </div>
      ) : (
        <button className="ui-button ui-button--secondary ui-button--md ui-button--danger" type="button" disabled={pin.id.startsWith("pending:")} onClick={() => setConfirmingRemoval(true)}><Trash2 size={15} /> {text("Remove pin", "Pin verwijderen")}</button>
      )}
      <div className="operation-alert"><Link2 size={18} /><div><strong>{text("Traceable project link", "Traceerbare projectkoppeling")}</strong></div></div>
    </div>
  );
}
