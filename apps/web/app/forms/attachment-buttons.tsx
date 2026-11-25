"use client";

import { Camera, Paperclip } from "lucide-react";
import type { ReactNode } from "react";
import { useLanguage } from "@/lib/i18n";

/**
 * The two buttons of every photo / attachment field (developer specification v5.0, START HERE
 * "Photos & attachments"): "Take a picture" opens the device camera directly, "Add a file" opens
 * the file picker (photos from the gallery, documents). Both add to the same list, which the
 * caller renders as the thumbnails in `children`.
 */
export function AttachmentButtons({
  onFiles,
  cameraAccept,
  fileAccept,
  disabled = false,
  multiple = true,
  children,
  hint,
}: {
  onFiles: (files: FileList) => void;
  /** Types the camera button takes; photos only. */
  cameraAccept: string;
  /** Types the file picker takes. */
  fileAccept: string;
  disabled?: boolean;
  multiple?: boolean;
  /** The thumbnails already added. */
  children?: ReactNode;
  hint?: string;
}) {
  const { text } = useLanguage();
  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.currentTarget.files;
    if (files?.length) onFiles(files);
    event.currentTarget.value = "";
  };
  return (
    <div className="attachment-buttons" data-attachment-buttons>
      {children ? <div className="attachment-buttons-thumbs">{children}</div> : null}
      <div className="attachment-buttons-actions">
        <label className={`attachment-button${disabled ? " is-disabled" : ""}`}>
          <Camera size={18} aria-hidden="true" />
          <span>{text("Take a picture", "Maak een foto")}</span>
          <input type="file" accept={cameraAccept} capture="environment" multiple={multiple} disabled={disabled} onChange={pick} />
        </label>
        <label className={`attachment-button${disabled ? " is-disabled" : ""}`}>
          <Paperclip size={18} aria-hidden="true" />
          <span>{text("Add a file", "Voeg een bestand toe")}</span>
          <input type="file" accept={fileAccept} multiple={multiple} disabled={disabled} onChange={pick} />
        </label>
      </div>
      {hint ? <small className="attachment-buttons-hint">{hint}</small> : null}
    </div>
  );
}
