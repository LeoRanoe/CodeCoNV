import type { FileLinkRecordType, OperationSnapshot } from "@/lib/supabase/operations";

export type FileOriginKind = "finding" | "inspection" | "hse" | "action" | "register" | "visual" | "unlinked";

export type FileOrigin = {
  kind: FileOriginKind;
  /** Formal record number, e.g. NCR-004 or INS-012. Empty for unlinked files. */
  number: string;
  title: string;
  recordId: string;
};

const recordTypeToKind: Partial<Record<FileLinkRecordType, FileOriginKind>> = {
  finding: "finding",
  finding_update: "finding",
  inspection: "inspection",
  inspection_response: "inspection",
  hse: "hse",
  action: "action",
  register_entry: "register",
  document: "register",
};

/**
 * Lookup tables for one snapshot. Building these once turns origin resolution from
 * a scan of every link and annotation per file into a handful of map reads.
 */
export type FileOriginResolver = {
  origins: (fileId: string) => FileOrigin[];
  /** File ids per `${kind}:${recordId}`. */
  filesByRecord: Map<string, string[]>;
};

export function createFileOriginResolver(data: OperationSnapshot): FileOriginResolver {
  const findingById = new Map(data.findings.map((item) => [item.id, item]));
  const inspectionById = new Map(data.inspections.map((item) => [item.id, item]));
  const hseById = new Map(data.hseEvents.map((item) => [item.id, item]));
  const registerById = new Map(data.registerEntries.map((item) => [item.id, item]));

  const linksByFile = new Map<string, Array<{ record_type: FileLinkRecordType; record_id: string }>>();
  for (const link of data.fileLinks ?? []) {
    const existing = linksByFile.get(link.file_id);
    if (existing) existing.push(link);
    else linksByFile.set(link.file_id, [link]);
  }

  const captureByFile = new Map(data.visualCaptures.filter((capture) => capture.status === "active").map((capture) => [capture.file_id, capture]));
  const annotationsByCapture = new Map<string, typeof data.visualAnnotations>();
  for (const annotation of data.visualAnnotations) {
    if (annotation.status !== "active") continue;
    const existing = annotationsByCapture.get(annotation.capture_id);
    if (existing) existing.push(annotation);
    else annotationsByCapture.set(annotation.capture_id, [annotation]);
  }

  const cache = new Map<string, FileOrigin[]>();

  const origins = (fileId: string): FileOrigin[] => {
    const cached = cache.get(fileId);
    if (cached) return cached;

    const result: FileOrigin[] = [];
    const seen = new Set<string>();
    const add = (origin: FileOrigin) => {
      const key = `${origin.kind}:${origin.recordId}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.push(origin);
    };

    for (const link of linksByFile.get(fileId) ?? []) {
      const kind = recordTypeToKind[link.record_type];
      if (!kind) continue;
      if (kind === "finding") {
        const finding = findingById.get(link.record_id);
        if (finding) add({ kind, number: finding.finding_number, title: finding.title, recordId: finding.id });
        continue;
      }
      if (kind === "inspection") {
        const inspection = inspectionById.get(link.record_id);
        if (inspection) add({ kind, number: inspection.inspection_number, title: inspection.title, recordId: inspection.id });
        continue;
      }
      if (kind === "hse") {
        const event = hseById.get(link.record_id);
        if (event) add({ kind, number: event.event_number, title: event.title, recordId: event.id });
        continue;
      }
      if (kind === "register") {
        const entry = registerById.get(link.record_id);
        if (entry) add({ kind, number: entry.entry_number, title: entry.title, recordId: entry.id });
        continue;
      }
      add({ kind, number: "", title: "", recordId: link.record_id });
    }

    const capture = captureByFile.get(fileId);
    if (capture) {
      for (const annotation of annotationsByCapture.get(capture.id) ?? []) {
        const finding = findingById.get(annotation.finding_id);
        if (finding) add({ kind: "finding", number: finding.finding_number, title: finding.title, recordId: finding.id });
      }
      add({ kind: "visual", number: capture.capture_type === "panorama" ? "360°" : "FOTO", title: capture.title, recordId: capture.id });
    }

    cache.set(fileId, result);
    return result;
  };

  const filesByRecord = new Map<string, string[]>();
  for (const file of data.files) {
    if (file.status !== "available") continue;
    for (const origin of origins(file.id)) {
      const key = `${origin.kind}:${origin.recordId}`;
      const existing = filesByRecord.get(key);
      if (existing) existing.push(file.id);
      else filesByRecord.set(key, [file.id]);
    }
  }

  return { origins, filesByRecord };
}

/** All active files that belong to one record, in snapshot order (newest first). */
export function filesForRecord(data: OperationSnapshot, kind: FileOriginKind, recordId: string, resolver: FileOriginResolver) {
  const fileIds = new Set(resolver.filesByRecord.get(`${kind}:${recordId}`) ?? []);
  return fileIds.size ? data.files.filter((file) => fileIds.has(file.id)) : [];
}
