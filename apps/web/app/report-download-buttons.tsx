"use client";

import { FileSpreadsheet, FileText, FileType2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export function ReportDownloadButtons({
  onDownloadPdf,
  onDownloadWord,
  onDownloadExcel,
  disabled = false,
  variant = "compact",
  className = "",
}: {
  onDownloadPdf: () => unknown;
  onDownloadWord: () => unknown;
  /** Word 11: Excel where the report is tabular (decision #13). */
  onDownloadExcel?: () => unknown;
  disabled?: boolean;
  variant?: "compact" | "prominent";
  className?: string;
}) {
  const { text } = useLanguage();
  const iconSize = variant === "prominent" ? 15 : 13;
  return (
    <div className={["download-group", variant, className].filter(Boolean).join(" ")} role="group" aria-label={text("Download format", "Downloadformaat")}>
      <button className={`ui-button ${variant === "prominent" ? "ui-button--primary" : "ui-button--secondary"} ui-button--md`} type="button" disabled={disabled} onClick={() => void onDownloadPdf()}>
        <FileText size={iconSize} /> PDF
      </button>
      <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={disabled} onClick={() => void onDownloadWord()}>
        <FileType2 size={iconSize} /> Word
      </button>
      {onDownloadExcel ? (
        <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={disabled} onClick={() => void onDownloadExcel()}>
          <FileSpreadsheet size={iconSize} /> Excel
        </button>
      ) : null}
    </div>
  );
}
