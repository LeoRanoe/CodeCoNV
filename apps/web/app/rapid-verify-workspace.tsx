"use client";

import { SectionNav } from "@/app/section-nav";
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  Copy,
  FileSearch,
  FileText,
  Loader2,
  Plus,
  Search,
  ShieldQuestion,
  Upload,
  X,
} from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { copyText } from "@/lib/browser/clipboard";
import { extractPdfPages } from "@/lib/rapid-verify/pdf-pages.mjs";
import { compareSpecificationValues } from "@/lib/rapid-verify/compare-values.mjs";
import { normalizeEvidence, searchDocuments, searchTerms } from "@/lib/rapid-verify/search.mjs";
import { appendDictation, DictateButton } from "@/app/dictate-button";
import { useProjectPermissions } from "@/lib/permissions/project-permissions";
import { useLanguage } from "@/lib/i18n";
import { loadProjectFileBlob } from "@/lib/storage/gateway";
import type { FileRecord } from "@/lib/supabase/operations";

type IndexedPage = {
  page: number;
  text: string;
};

type IndexedDocument = {
  id: string;
  name: string;
  kind: "pdf" | "text";
  pages: IndexedPage[];
};

type VerifyResult = {
  documentId: string;
  document: string;
  page: number;
  excerpt: string;
  score: number;
};

async function indexFile(file: File, signal: AbortSignal, onProgress: (page: number, total: number) => void): Promise<IndexedDocument> {
  if (!file.size || file.size > 25 * 1024 * 1024) throw new Error("Choose a non-empty document up to 25 MB.");
  const data = await file.arrayBuffer();
  signal.throwIfAborted();
  const bytes = new Uint8Array(data);
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const id = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  if (!isPdf) {
    if (!/\.(txt|md)$/i.test(file.name) && !file.type.startsWith("text/")) throw new Error("Only PDF or plain text sources are supported.");
    if (bytes.includes(0)) throw new Error("This file contains binary data, not plain text.");
    const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!content.trim() || content.length > 2_000_000) throw new Error("Text source is empty or too large. Split it first.");
    return { id, name: file.name, kind: "text", pages: [{ page: 1, text: content }] };
  }
  if (!new TextDecoder().decode(bytes.slice(0, 1024)).includes("%PDF-")) throw new Error("This file is not a PDF document.");
  const pdfjs = await import("pdfjs-dist");
  signal.throwIfAborted();
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({ data: bytes });
  const pages = await extractPdfPages(task, { signal, onProgress });
  return { id, name: file.name, kind: "pdf", pages };
}

export function RapidVerifyWorkspace({
  projectName,
  projectFiles = [],
  client,
}: {
  projectName: string;
  projectFiles?: FileRecord[];
  client?: SupabaseClient;
}) {
  const { text } = useLanguage();
  const canAddSources = useProjectPermissions().can("files.manage");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"question" | "compare">("question");
  const [documents, setDocuments] = useState<IndexedDocument[]>([]);
  const [question, setQuestion] = useState("");
  const [comparison, setComparison] = useState("");
  const [storedResults, setResults] = useState<VerifyResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingProjectFileId, setLoadingProjectFileId] = useState("");
  const [error, setError] = useState("");
  const [verifiedInput, setVerifiedInput] = useState<{ documents: IndexedDocument[]; query: string; mode: typeof mode } | null>(null);
  const searched = verifiedInput?.documents === documents && verifiedInput.query === (mode === "question" ? question : comparison) && verifiedInput.mode === mode;
  const results = useMemo(() => searched ? storedResults : [], [searched, storedResults]);
  const [progress, setProgress] = useState("");
  const [projectSourceIds, setProjectSourceIds] = useState<Record<string, string>>({});
  const indexingRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; indexingRef.current?.abort(); };
  }, []);

  const indexedPages = useMemo(
    () => documents.flatMap((document) => document.pages.map((page) => ({ document, page }))),
    [documents],
  );

  const indexSources = async (sources: Array<{ file?: File; record?: FileRecord }>) => {
    if (indexingRef.current || !sources.length) return;
    const controller = new AbortController();
    indexingRef.current = controller;
    setBusy(true);
    setError("");
    const failures: string[] = [];
    try {
      for (const [position, source] of sources.slice(0, 25).entries()) {
        controller.signal.throwIfAborted();
        const name = source.file?.name ?? source.record!.original_name;
        setProgress(`${position + 1} / ${Math.min(25, sources.length)} · ${name}`);
        try {
          const blob = source.file ?? await loadProjectFileBlob(client!, source.record!.id);
          controller.signal.throwIfAborted();
          const file = source.file ?? new File([blob], name, { type: source.record!.mime_type });
          const indexed = await indexFile(file, controller.signal, (page, total) => {
            if (mountedRef.current && !controller.signal.aborted) setProgress(`${name} · ${page} / ${total}`);
          });
          controller.signal.throwIfAborted();
          if (!mountedRef.current) return;
          setDocuments((current) => {
            const merged = new Map(current.map((document) => [document.id, document]));
            merged.set(indexed.id, indexed);
            return [...merged.values()];
          });
          if (source.record) setProjectSourceIds((current) => ({ ...current, [source.record!.id]: indexed.id }));
        } catch (caught) {
          if (controller.signal.aborted) return;
          failures.push(`${name}: ${caught instanceof Error ? caught.message : "Indexing failed"}`);
        }
      }
      if (sources.length > 25) failures.push("Only the first 25 sources were processed. Add the remaining sources separately.");
      if (mountedRef.current) setError(failures.join(" · "));
    } finally {
      if (indexingRef.current === controller) indexingRef.current = null;
      if (mountedRef.current) { setBusy(false); setLoadingProjectFileId(""); setProgress(""); }
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  const receiveFiles = (files: FileList | null) => indexSources(files ? [...files].map((file) => ({ file })) : []);
  const addProjectFile = async (file: FileRecord) => {
    if (!client || indexingRef.current) return;
    setLoadingProjectFileId(file.id);
    await indexSources([{ record: file }]);
  };

  const availableProjectFiles = projectFiles.filter((file) =>
    file.status === "available"
    && (file.mime_type === "application/pdf" || file.mime_type.startsWith("text/") || /\.(pdf|txt|md)$/i.test(file.original_name)),
  );
  const indexExistingSources = async () => {
    if (!client) return;
    await indexSources(availableProjectFiles.filter((file) => !projectSourceIds[file.id] || !documents.some((document) => document.id === projectSourceIds[file.id])).map((record) => ({ record })));
  };

  const verify = () => {
    setVerifiedInput({ documents, query: mode === "question" ? question : comparison, mode });
    setResults(searchDocuments(documents, mode === "question" ? question : comparison));
  };

  const coverage = useMemo(() => {
    if (mode !== "compare" || !comparison.trim() || !results.length) return 0;
    const terms = searchTerms(comparison);
    if (!terms.length) return 0;
    const evidence = results.map((result) => normalizeEvidence(result.excerpt)).join(" ");
    return Math.round((terms.filter((term) => evidence.includes(term)).length / terms.length) * 100);
  }, [comparison, mode, results]);

  /** Figures with a unit and colour words, compared one by one against the whole pages that matched. */
  const valueChecks = useMemo(() => {
    if (mode !== "compare" || !comparison.trim() || !results.length) return [];
    const pages = results.map((result) => documents.find((document) => document.id === result.documentId)?.pages.find((page) => page.page === result.page)?.text ?? result.excerpt);
    return compareSpecificationValues(comparison, pages.join(" "));
  }, [comparison, documents, mode, results]);
  const differing = valueChecks.filter((check) => check.status === "differs");

  const conclusion = mode === "compare" && differing.length
    ? { tone: "error", title: text("Submitted values differ from the specification", "Aangeleverde waarden wijken af van de specificatie"), copy: text(`${differing.length} value${differing.length === 1 ? "" : "s"} below do not match the project sources. Human technical verification remains required.`, `${differing.length} waarde${differing.length === 1 ? "" : "n"} hieronder komt niet overeen met de projectbronnen. Menselijke technische verificatie blijft vereist.`) }
    : mode === "compare"
    ? coverage >= 60
      ? { tone: "success", title: text("Relevant requirements found", "Relevante eisen gevonden"), copy: text(`${coverage}% of the submitted specification terms occur in the selected project sources. Human technical verification remains required.`, `${coverage}% van de termen uit de aangeleverde specificatie komt terug in de geselecteerde projectbronnen. Menselijke technische verificatie blijft vereist.`) }
      : results.length
        ? { tone: "warning", title: text("Partial evidence", "Gedeeltelijk bewijs"), copy: text(`Only ${coverage}% source coverage was found. Treat this as insufficient until a supervisor checks the full documents.`, `Er is slechts ${coverage}% brondekking gevonden. Behandel dit als onvoldoende totdat een supervisor de volledige documenten heeft gecontroleerd.`) }
        : { tone: "error", title: text("Insufficient evidence", "Onvoldoende bewijs"), copy: text("No supporting project passage was found.", "Er is geen ondersteunende projectpassage gevonden.") }
    : results.length
      ? { tone: "success", title: text("Source passages found", "Bronpassages gevonden"), copy: text("Rapid Verify found the most relevant passages. Read the cited pages before making a technical decision.", "Rapid Verify heeft de relevantste passages gevonden. Lees de genoemde pagina's voordat een technisch besluit wordt genomen.") }
      : { tone: "error", title: text("Insufficient evidence", "Onvoldoende bewijs"), copy: text("No matching passage was found in the indexed project documents.", "Er is geen overeenkomende passage gevonden in de geindexeerde projectdocumenten.") };

  return (
    <>
      <header className="secondary-header rapid-verify-header ui-page-header">
        <div>
          <h1>Rapid Verify</h1>
          <span className="ui-page-header__code">{projectName}</span>
        </div>
        {canAddSources ? <button className="ui-button ui-button--primary ui-button--md" type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="spin" size={16} /> : <Upload size={16} />}
          {text("Add sources", "Bronnen toevoegen")}
        </button> : null}
        <input ref={fileInputRef} className="visually-hidden" aria-hidden="true" tabIndex={-1} type="file" accept=".pdf,.txt,.md,text/plain,application/pdf" multiple onChange={(event) => void receiveFiles(event.currentTarget.files)} />
      </header>

      <p className="rapid-safety-note">{text("Indexed sources stay in this tab. Add them again after a refresh.", "Geïndexeerde bronnen blijven in dit tabblad. Voeg ze na verversen opnieuw toe.")}</p>
      {progress ? <p role="status">{progress}</p> : null}
      {error ? <div className="operation-alert error"><AlertTriangle size={17} /> {error}</div> : null}

      <section className="rapid-verify-layout">
        <div className="rapid-source-panel">
          <div className="rapid-panel-heading">
            <span><BookOpenCheck size={19} /></span>
            <div><strong>{text("Project sources", "Projectbronnen")}</strong><small>{indexedPages.length} {text("indexed pages", "geindexeerde pagina's")}</small></div>
          </div>
          {canAddSources ? <button className="rapid-upload-zone" type="button" disabled={busy} onClick={() => fileInputRef.current?.click()}>
            <Upload size={20} />
            <strong>{text("Upload PDF or text", "Upload PDF of tekst")}</strong>
            <small>{text("Drawings · tech specs · contract", "Tekeningen · tech specs · contract")}</small>
          </button> : null}
          {availableProjectFiles.length ? (
            <div className="rapid-project-library">
              <span>{text("Available in Project Docs", "Beschikbaar in Project Docs")}</span>
              <button className="rapid-index-all" type="button" disabled={busy || availableProjectFiles.every((file) => documents.some((document) => document.id === projectSourceIds[file.id]))} onClick={() => void indexExistingSources()}><BookOpenCheck size={14} /><span><strong>{text("Use existing sources", "Gebruik bestaande bronnen")}</strong><small>{text("Index approved PDFs and text files", "Indexeer goedgekeurde pdf's en tekstbestanden")}</small></span></button>
              {availableProjectFiles.slice(0, 8).map((file) => {
                const indexed = documents.some((document) => document.id === projectSourceIds[file.id]);
                return <button className={indexed ? "indexed" : ""} type="button" disabled={indexed || busy} onClick={() => void addProjectFile(file)} key={file.id}><FileText size={14} /><span><strong>{file.original_name}</strong><small>{indexed ? text("Indexed", "Geïndexeerd") : text("Use as source", "Gebruik als bron")}</small></span>{loadingProjectFileId === file.id ? <Loader2 className="spin" size={13} /> : indexed ? <CheckCircle2 size={13} /> : <Plus size={13} />}</button>;
              })}
            </div>
          ) : null}
          <div className="rapid-source-list">
            {documents.length === 0 ? <p>{text("No documents indexed.", "Geen documenten geïndexeerd.")}</p> : null}
            {documents.map((document) => (
              <article key={document.id}>
                <span><FileText size={16} /></span>
                <div><strong>{document.name}</strong><small>{document.pages.length} {document.pages.length === 1 ? text("page", "pagina") : text("pages", "pagina's")}</small></div>
                <button type="button" aria-label={text(`Remove ${document.name}`, `Verwijder ${document.name}`)} onClick={() => setDocuments((current) => current.filter((item) => item.id !== document.id))}><X size={14} /></button>
              </article>
            ))}
          </div>
        </div>

        <div className="rapid-query-panel">
          <SectionNav
            className="rapid-mode-tabs"
            label={text("Verification mode", "Verificatiemodus")}
            items={[
              { id: "question", label: text("Ask project documents", "Vraag projectdocumenten"), icon: <ShieldQuestion size={18} />, selected: mode === "question", onSelect: () => { setMode("question"); setResults([]); setVerifiedInput(null); } },
              { id: "compare", label: text("Compare specification", "Vergelijk specificatie"), icon: <FileSearch size={18} />, selected: mode === "compare", onSelect: () => { setMode("compare"); setResults([]); setVerifiedInput(null); } },
            ]}
          />

          {mode === "question" ? (
            <label className="rapid-query-field">
              <span>{text("Question", "Vraag")}</span>
              <textarea rows={5} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={text("Example: Which concrete strength is prescribed for the ground-floor shear wall?", "Voorbeeld: Welke betonsterkte is voorgeschreven voor de shear wall op de begane grond?")} />
              <DictateButton onText={(transcript) => setQuestion((current) => appendDictation(current, transcript))} />
            </label>
          ) : (
            <label className="rapid-query-field">
              <span>{text("Specification to verify", "Te verifieren specificatie")}</span>
              <textarea rows={7} value={comparison} onChange={(event) => setComparison(event.target.value)} />
              <DictateButton onText={(transcript) => setComparison((current) => appendDictation(current, transcript))} />
            </label>
          )}

          <button className="ui-button ui-button--primary ui-button--md rapid-run-button" type="button" disabled={busy || !documents.length || !(mode === "question" ? question.trim() : comparison.trim())} onClick={verify}>
            <Search size={16} /> {mode === "question" ? text("Find answer in sources", "Vind antwoord in bronnen") : text("Verify against sources", "Toets aan bronnen")}
          </button>

          {searched ? (
            <section className={`rapid-conclusion ${conclusion.tone}`}>
              {conclusion.tone === "success" ? <CheckCircle2 size={21} /> : <AlertTriangle size={21} />}
              <div><strong>{conclusion.title}</strong><p>{conclusion.copy}</p></div>
            </section>
          ) : null}

          {searched && valueChecks.length ? (
            <section className="rapid-value-checks" aria-label={text("Values compared", "Vergeleken waarden")}>
              <h2>{text("Values compared", "Vergeleken waarden")}</h2>
              <ul>
                {valueChecks.map((check) => (
                  <li key={`${check.kind}:${check.submitted}`} data-status={check.status}>
                    <strong>{check.submitted}</strong>
                    <span>{check.status === "matches"
                      ? text("matches the sources", "komt overeen met de bronnen")
                      : check.status === "differs"
                        ? text(`differs: the sources give ${check.prescribed.join(", ")}`, `wijkt af: de bronnen noemen ${check.prescribed.join(", ")}`)
                        : text("not found in the matched pages", "niet gevonden op de gevonden pagina's")}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="rapid-results">
            {results.map((result) => (
              <article key={`${result.documentId}:${result.page}`}>
                <header><span>{result.document} · {text("page", "pagina")} {result.page}</span><button type="button" onClick={() => { void copyText(result.excerpt).catch(() => setError(text("Copy failed. Select the passage and copy manually.", "Kopiëren mislukt. Selecteer de passage en kopieer handmatig."))); }} aria-label={text("Copy passage", "Kopieer passage")}><Copy size={14} /></button></header>
                <p>{result.excerpt}</p>
              </article>
            ))}
          </div>
          <p className="rapid-safety-note"><AlertTriangle size={14} /> {text("Rapid Verify retrieves evidence; it does not replace approval by the responsible engineer or supervisor.", "Rapid Verify zoekt bewijs; het vervangt geen goedkeuring door de verantwoordelijke engineer of supervisor.")}</p>
        </div>
      </section>
    </>
  );
}
