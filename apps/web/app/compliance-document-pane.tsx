"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { DocumentPreview } from "@/app/document-preview";
import { useLanguage } from "@/lib/i18n";
import { loadProjectFileBlob } from "@/lib/storage/gateway";
import type { FileRecord } from "@/lib/supabase/operations";

/**
 * One side of the side-by-side viewer of the Rapid Verify compliance check (Word 10.1): the submittal on one side and
 * the bestek on the other, so a requirement is read next to what was delivered. A PDF opens on the page of the row being
 * checked (the PDF is drawn from its first page; the row's page is named in the caption); an image is shown as it is.
 */
export function ComplianceDocumentPane({ client, file, label, page }: { client: SupabaseClient; file: FileRecord; label: string; page?: number }) {
  const { text } = useLanguage();
  const [source, setSource] = useState<{ fileId: string; url: string; image: boolean } | null>(null);
  const [failed, setFailed] = useState("");

  useEffect(() => {
    let alive = true;
    let created = "";
    void loadProjectFileBlob(client, file.id).then((blob) => {
      if (!alive) return;
      created = URL.createObjectURL(blob);
      setSource({ fileId: file.id, url: created, image: blob.type.startsWith("image/") });
      setFailed("");
    }).catch(() => { if (alive) setFailed(file.id); });
    return () => { alive = false; if (created) URL.revokeObjectURL(created); };
  }, [client, file.id]);

  const ready = source?.fileId === file.id ? source : null;
  const pdf = ready && !ready.image;
  return (
    <figure className="compliance-pane" data-compliance-pane>
      <figcaption><strong>{label}</strong><span>{file.original_name}{page && pdf ? ` · ${text("page", "pagina")} ${page}` : ""}</span></figcaption>
      {failed === file.id ? <p className="compliance-pane-note" role="alert">{text("This document could not be opened here.", "Dit document kon hier niet worden geopend.")}</p>
        : !ready ? <p className="compliance-pane-note" role="status">{text("Opening the document…", "Document wordt geopend…")}</p>
          // pdf.js draws the pages (an <iframe> PDF stays blank on Android Chrome and is blocked by the CSP's object-src 'none').
          : <div className="compliance-pane-scroll"><DocumentPreview url={ready.url} mimeType={ready.image ? (file.mime_type || "image/png") : "application/pdf"} title={file.original_name} /></div>}
    </figure>
  );
}
