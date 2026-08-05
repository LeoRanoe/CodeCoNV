"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Download, ExternalLink, HardDrive, Loader2, RefreshCw, ScanLine, Image as ImageIcon, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { readableFileLabel } from "@/lib/media/photo-library.mjs";
import { downloadProjectFile, loadProjectFileObjectUrl, openProjectFile } from "@/lib/storage/gateway";
import { createFileOriginResolver } from "@/lib/supabase/file-origins";
import { createVisualCapture, type FileRecord, type OperationSnapshot } from "@/lib/supabase/operations";
import type { BuildingOption } from "@/app/building-picker";

/**
 * One stored photo on a screen of its own.
 *
 * A photo is shown in more than one place — the library, the strip under a finding, a
 * report screen — and it has to behave the same everywhere: tapping it says what the app
 * knows about the picture and offers what can be done with it. One component, so the
 * places cannot drift apart.
 */
function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StoredImage({ client, file }: { client: SupabaseClient; file: FileRecord }) {
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
    return <span className="media-preview-error">
      <ImageIcon size={20} />
      <small>{text("Image unavailable", "Beeld niet beschikbaar")}</small>
      <button type="button" onClick={() => { setFailed(false); setSource(""); setAttempt((value) => value + 1); }}><RefreshCw size={14} /> {text("Retry", "Opnieuw")}</button>
    </span>;
  }
  if (!source) return <span className="media-preview-loading"><Loader2 className="spin" size={20} /></span>;
  // A private object URL cannot pass through the Next image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="media-detail-image" src={source} alt={file.original_name} />;
}

export function StoredPhotoDetail({ data, buildings, file, client, busy, run, close, openMarking, projectId }: {
  data: OperationSnapshot;
  buildings: BuildingOption[];
  file: FileRecord;
  client: SupabaseClient;
  busy: boolean;
  run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>;
  close: () => void;
  /** Where the marking screen lives; without it the photo simply has no marking button. */
  openMarking?: (fileId: string) => void;
  projectId: string;
}) {
  const { locale, text } = useLanguage();
  const isImage = file.mime_type.startsWith("image/");
  const capture = data.visualCaptures.find((item) => item.file_id === file.id) ?? null;
  const markers = capture
    ? data.visualAnnotations.filter((annotation) => annotation.capture_id === capture.id && annotation.status === "active")
    : [];
  const folderName = data.mediaFolders.find((item) => item.id === file.folder_id)?.name ?? text("Unfiled", "Zonder map");
  const buildingName = buildings.find((building) => building.id === file.building_id)?.name ?? "—";
  const origins = useMemo(() => createFileOriginResolver(data).origins(file.id), [data, file.id]);
  const moment = (value: string | null | undefined) => value
    ? new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short", timeZone: "America/Paramaribo" }).format(new Date(value))
    : "—";

  /**
   * Marking a problem happens on a capture: the app's word for a picture that can carry
   * markers. A photo that arrived through the library or through a record does not have
   * one until it is asked for; the first mark makes it, on the file that is already there.
   */
  const markProblem = async () => {
    if (!openMarking) return;
    if (capture) {
      close();
      openMarking(file.id);
      return;
    }
    const okay = await run(
      () => createVisualCapture(client, {
        projectId,
        buildingId: file.building_id || buildings[0]?.id || "",
        fileId: file.id,
        captureType: "photo",
        title: readableFileLabel(file, {
          kindLabel: text("Photo", "Foto"),
          formatDate: (value) => value ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "America/Paramaribo" }).format(new Date(value)) : "",
        }),
        locationLabel: buildingName,
        capturedAt: file.created_at,
      }).then(() => undefined),
      text("This photo can now carry marked problems.", "Op deze foto kunnen nu problemen worden gemarkeerd."),
    );
    if (!okay) return;
    close();
    openMarking(file.id);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal media-detail-modal" role="dialog" aria-modal="true" aria-labelledby="stored-photo-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">{capture?.capture_type === "panorama" ? "360°" : isImage ? text("Photo", "Foto") : text("File", "Bestand")}</p>
            <h2 id="stored-photo-title">{capture?.title?.trim() || readableFileLabel(file, {
              kindLabel: isImage ? text("Photo", "Foto") : text("File", "Bestand"),
              formatDate: (value) => value ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "America/Paramaribo" }).format(new Date(value)) : "",
            })}</h2>
            <p>{capture?.description?.trim() || text(
              "Everything this photo carries: where it was taken, in which folder it sits and which records point at it.",
              "Alles wat deze foto met zich meedraagt: waar hij is gemaakt, in welke map hij staat en welke registraties ernaar verwijzen.",
            )}</p>
          </div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>

        <div className="modal-body media-detail-body">
          {isImage ? <StoredImage client={client} file={file} /> : <span className="media-file-icon"><HardDrive size={28} /></span>}
          <dl className="media-detail-facts">
            <div><dt>{text("Building", "Gebouw")}</dt><dd>{buildingName}</dd></div>
            <div><dt>{text("Location", "Locatie")}</dt><dd>{capture?.location_label || "—"}</dd></div>
            <div><dt>{text("Taken", "Gemaakt")}</dt><dd>{moment(capture?.captured_at ?? file.created_at)}</dd></div>
            <div><dt>{text("Folder", "Map")}</dt><dd>{folderName}</dd></div>
            <div><dt>{text("File", "Bestand")}</dt><dd title={file.original_name}>{file.original_name}</dd></div>
            <div><dt>{text("Size", "Grootte")}</dt><dd>{humanSize(file.size_bytes)}</dd></div>
            {file.document_code ? <div><dt>{text("Document code", "Documentcode")}</dt><dd>{file.document_code}</dd></div> : null}
            <div><dt>{text("Marked problems", "Gemarkeerde problemen")}</dt><dd>{markers.length}</dd></div>
          </dl>
          {markers.length ? (
            <div className="media-detail-links">
              <strong>{text("Marked on this photo", "Op deze foto gemarkeerd")}</strong>
              <ul className="media-detail-markers">
                {markers.slice(0, 6).map((marker) => (
                  <li key={marker.id}><b className={`marker-dot tone-${marker.severity ?? "medium"}`} />{marker.title || text("Marked problem", "Gemarkeerd probleem")}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="media-detail-links">
            <strong>{text("Linked records", "Gekoppelde registraties")}</strong>
            <span className="media-origin-chips">{origins.length
              ? origins.map((origin) => <em className={`media-origin-chip tone-${origin.kind}`} title={origin.title} key={`${origin.kind}:${origin.recordId}`}>{origin.number || origin.kind}</em>)
              : <em className="media-origin-chip tone-unlinked">{text("Not linked to a record yet", "Nog niet aan een record gekoppeld")}</em>}</span>
          </div>
        </div>

        <footer className="modal-actions media-detail-actions">
          <button className="ghost-button" type="button" onClick={() => void downloadProjectFile(client, file.id, file.original_name)}><Download size={15} /> {text("Download", "Downloaden")}</button>
          <button className="ghost-button" type="button" onClick={() => void openProjectFile(client, file.id, file.original_name)}><ExternalLink size={15} /> {text("Open the file", "Bestand openen")}</button>
          {isImage && openMarking ? (
            <button className="primary-button" type="button" disabled={busy} onClick={() => void markProblem()}>
              <ScanLine size={15} /> {markers.length ? text("Mark another problem", "Nog een probleem markeren") : text("Mark a problem on this photo", "Probleem op deze foto markeren")}
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  );
}
