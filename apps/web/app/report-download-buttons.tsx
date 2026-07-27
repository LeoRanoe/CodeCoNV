"use client";

import { FileText, FileType2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export function ReportDownloadButtons({
  onDownloadPdf,
  onDownloadWord,
  disabled = false,
  variant = "compact",
  className = "",
}: {
  onDownloadPdf: () => unknown;
  onDownloadWord: () => unknown;
  disabled?: boolean;
  variant?: "compact" | "prominent";
  className?: string;
}) {
  const { text } = useLanguage();
  const iconSize = variant === "prominent" ? 15 : 13;
  return (
    <div className={["download-group", variant, className].filter(Boolean).join(" ")} role="group" aria-label={text("Download format", "Downloadformaat")}>
      <button type="button" disabled={disabled} onClick={() => void onDownloadPdf()}>
        <FileText size={iconSize} /> PDF
      </button>
      <button type="button" disabled={disabled} onClick={() => void onDownloadWord()}>
        <FileType2 size={iconSize} /> Word
      </button>
    </div>
  );
}
