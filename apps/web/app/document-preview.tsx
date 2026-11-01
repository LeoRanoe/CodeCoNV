"use client";

import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n";

/**
 * Shows a stored document inside the app on every device. A PDF in an <iframe> stays blank on
 * Android Chrome (it has no built-in PDF viewer) and shows only part of the first page on an
 * iPad, so PDF pages are drawn with pdf.js, images are shown as images, and anything else gets
 * an Open button instead of an empty frame.
 */
export function DocumentPreview({ url, mimeType, title }: { url: string; mimeType: string; title: string }) {
  const { text } = useLanguage();
  const pagesRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [pageCount, setPageCount] = useState(0);
  const isPdf = mimeType === "application/pdf" || title.toLocaleLowerCase().endsWith(".pdf");
  const isImage = mimeType.startsWith("image/");

  useEffect(() => {
    if (!isPdf) return;
    const container = pagesRef.current;
    if (!container) return;
    let cancelled = false;
    container.replaceChildren();
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
        const pdf = await pdfjs.getDocument({ data: bytes }).promise;
        if (cancelled) return;
        setPageCount(pdf.numPages);
        const width = Math.max(320, container.clientWidth || 800);
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        // The first 40 pages; a longer file is opened in full with the Open button.
        for (let number = 1; number <= Math.min(pdf.numPages, 40); number += 1) {
          const page = await pdf.getPage(number);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * ratio });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.setAttribute("aria-label", `${text("Page", "Pagina")} ${number}`);
          canvas.setAttribute("role", "img");
          container.append(canvas);
          await page.render({ canvas, viewport }).promise;
          if (number === 1 && !cancelled) setState("ready");
        }
        if (!cancelled) setState("ready");
      } catch {
        if (!cancelled) setState("failed");
      }
    })();
    return () => { cancelled = true; };
  }, [isPdf, text, url]);

  const openButton = (
    <a className="ui-button ui-button--secondary ui-button--md" href={url} target="_blank" rel="noreferrer">
      <ExternalLink size={15} /> {text("Open in a new tab", "Openen in nieuw tabblad")}
    </a>
  );

  // A private blob: URL, which next/image cannot optimise or fetch.
  // eslint-disable-next-line @next/next/no-img-element
  if (isImage) return <div className="document-preview-image"><img src={url} alt={title} /></div>;
  if (isPdf) {
    return (
      <div className="document-preview-pdf">
        {state === "loading" ? <p className="document-preview-state"><Loader2 className="spin" size={16} /> {text("Loading pages…", "Pagina's laden…")}</p> : null}
        {state === "failed" ? <p className="document-preview-state">{text("This PDF cannot be shown here.", "Deze pdf kan hier niet worden getoond.")} {openButton}</p> : null}
        <div className="document-preview-pages" ref={pagesRef} />
        {pageCount > 40 ? <p className="document-preview-state">{text(`First 40 of ${pageCount} pages.`, `Eerste 40 van ${pageCount} pagina's.`)} {openButton}</p> : null}
      </div>
    );
  }
  return (
    <div className="document-preview-other">
      <FileText size={28} />
      <p>{text("This file type is not shown inside the app.", "Dit bestandstype wordt niet in de app getoond.")}</p>
      {openButton}
    </div>
  );
}
