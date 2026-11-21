"use client";

import { Download, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { downloadBlob } from "@/lib/browser/download";
import { useLanguage } from "@/lib/i18n";

export function RegisterExportButtons({ getReport, filename, disabled = false }: {
  getReport: () => { title: string; metadata: string[]; headers: string[]; rows: (string | number | null | undefined)[][] };
  filename: string;
  disabled?: boolean;
}) {
  const { text } = useLanguage();
  const [busy, setBusy] = useState<"xlsx" | "pdf" | null>(null);
  const [failed, setFailed] = useState(false);

  async function download(format: "xlsx" | "pdf") {
    setBusy(format);
    setFailed(false);
    try {
      const report = getReport();
      const blob = format === "xlsx"
        ? await (await import("@/lib/reports/register-xlsx.mjs")).registerWorkbook(report)
        : await (await import("@/lib/reports/register-pdf")).registerPdf(report);
      downloadBlob(blob, `${filename}.${format}`);
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  return <>
    <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={disabled || !!busy} onClick={() => void download("xlsx")}><FileSpreadsheet size={15} /> {busy === "xlsx" ? text("Preparing Excel…", "Excel voorbereiden…") : "Excel (XLSX)"}</button>
    <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={disabled || !!busy} onClick={() => void download("pdf")}><Download size={15} /> {busy === "pdf" ? text("Preparing PDF…", "PDF voorbereiden…") : "PDF"}</button>
    {failed ? <span className="field-error" role="alert">{text("Export failed. Try again.", "Export mislukt. Probeer het opnieuw.")}</span> : null}
  </>;
}
