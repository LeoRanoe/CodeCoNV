"use client";

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
import { useMemo, useRef, useState } from "react";
import { appendDictation, DictateButton } from "@/app/dictate-button";
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
  document: string;
  page: number;
  excerpt: string;
  score: number;
};

const stopWords = new Set([
  "aan", "als", "bij", "dat", "de", "den", "der", "die", "dit", "een", "en", "het", "hoe",
  "in", "is", "kan", "met", "naar", "of", "om", "op", "te", "uit", "van", "voor", "wat", "welke",
  "the", "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "in", "is", "of",
  "on", "or", "that", "the", "this", "to", "what", "which", "with",
]);

function searchTerms(value: string) {
  return [...new Set(
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length > 2 && !stopWords.has(term)),
  )];
}

function excerptAround(text: string, terms: string[]) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= 430) return compact;
  const lower = compact.toLowerCase();
  const firstIndex = terms
    .map((term) => lower.indexOf(term))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0] ?? 0;
  const start = Math.max(0, firstIndex - 120);
  const end = Math.min(compact.length, start + 430);
  return `${start > 0 ? "…" : ""}${compact.slice(start, end)}${end < compact.length ? "…" : ""}`;
}

async function indexFile(file: File): Promise<IndexedDocument> {
  const id = `${file.name}:${file.size}:${file.lastModified}`;
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    const text = await file.text();
    return { id, name: file.name, kind: "text", pages: [{ page: 1, text }] };
  }

  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await task.promise;
  const pages: IndexedPage[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push({ page: pageNumber, text });
  }
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"question" | "compare">("question");
  const [documents, setDocuments] = useState<IndexedDocument[]>([]);
  const [question, setQuestion] = useState("");
  const [comparison, setComparison] = useState("");
  const [results, setResults] = useState<VerifyResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingProjectFileId, setLoadingProjectFileId] = useState("");
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const indexedPages = useMemo(
    () => documents.flatMap((document) => document.pages.map((page) => ({ document, page }))),
    [documents],
  );

  const receiveFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    try {
      const indexed = await Promise.all([...files].map(indexFile));
      setDocuments((current) => {
        const merged = new Map(current.map((document) => [document.id, document]));
        indexed.forEach((document) => merged.set(document.id, document));
        return [...merged.values()];
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text("The document could not be indexed.", "Het document kon niet worden geindexeerd."));
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const addProjectFile = async (file: FileRecord) => {
    if (!client) return;
    setLoadingProjectFileId(file.id);
    setError("");
    try {
      const blob = await loadProjectFileBlob(client, file.id);
      const indexed = await indexFile(new File([blob], file.original_name, { type: file.mime_type }));
      setDocuments((current) => {
        const merged = new Map(current.map((document) => [document.id, document]));
        merged.set(indexed.id, indexed);
        return [...merged.values()];
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text("The project document could not be indexed.", "Het projectdocument kon niet worden geïndexeerd."));
    } finally {
      setLoadingProjectFileId("");
    }
  };

  const availableProjectFiles = projectFiles.filter((file) =>
    file.status === "available"
    && (file.mime_type === "application/pdf" || file.mime_type.startsWith("text/") || /\.(pdf|txt|md)$/i.test(file.original_name)),
  );
  const indexExistingSources = async () => {
    if (!client || !availableProjectFiles.length) return;
    setBusy(true);
    setError("");
    try {
      for (const projectFile of availableProjectFiles.filter((candidate) => !documents.some((document) => document.name === candidate.original_name)).slice(0, 25)) {
        const blob = await loadProjectFileBlob(client, projectFile.id);
        const indexed = await indexFile(new File([blob], projectFile.original_name, { type: projectFile.mime_type }));
        setDocuments((current) => {
          const merged = new Map(current.map((document) => [document.id, document]));
          merged.set(indexed.id, indexed);
          return [...merged.values()];
        });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text("Existing project sources could not all be indexed.", "Niet alle bestaande projectbronnen konden worden geïndexeerd."));
    } finally {
      setBusy(false);
    }
  };

  const verify = () => {
    const sourceText = mode === "question" ? question : comparison;
    const terms = searchTerms(sourceText);
    setSearched(true);
    if (!terms.length || !indexedPages.length) {
      setResults([]);
      return;
    }
    const ranked = indexedPages
      .map(({ document, page }) => {
        const lower = page.text.toLowerCase();
        const matched = terms.filter((term) => lower.includes(term));
        const score = matched.reduce((total, term) => total + lower.split(term).length - 1, 0);
        return {
          document: document.name,
          page: page.page,
          excerpt: excerptAround(page.text, matched.length ? matched : terms),
          score,
        };
      })
      .filter((result) => result.score > 0 && result.excerpt)
      .sort((left, right) => right.score - left.score)
      .slice(0, 4);
    setResults(ranked);
  };

  const coverage = useMemo(() => {
    if (mode !== "compare" || !comparison.trim() || !results.length) return 0;
    const terms = searchTerms(comparison);
    if (!terms.length) return 0;
    const evidence = results.map((result) => result.excerpt.toLowerCase()).join(" ");
    return Math.round((terms.filter((term) => evidence.includes(term)).length / terms.length) * 100);
  }, [comparison, mode, results]);

  const conclusion = mode === "compare"
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
      <header className="secondary-header rapid-verify-header">
        <div>
          <p className="eyebrow">{projectName}</p>
          <h1>Rapid Verify</h1>
        </div>
        <button className="primary-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="spin" size={16} /> : <Upload size={16} />}
          {text("Add sources", "Bronnen toevoegen")}
        </button>
        <input ref={fileInputRef} className="visually-hidden" aria-hidden="true" tabIndex={-1} type="file" accept=".pdf,.txt,.md,text/plain,application/pdf" multiple onChange={(event) => void receiveFiles(event.currentTarget.files)} />
      </header>

      {error ? <div className="operation-alert error"><AlertTriangle size={17} /> {error}</div> : null}

      <section className="rapid-verify-layout">
        <aside className="rapid-source-panel">
          <div className="rapid-panel-heading">
            <span><BookOpenCheck size={19} /></span>
            <div><strong>{text("Project sources", "Projectbronnen")}</strong><small>{indexedPages.length} {text("indexed pages", "geindexeerde pagina's")}</small></div>
          </div>
          <button className="rapid-upload-zone" type="button" onClick={() => fileInputRef.current?.click()}>
            <Upload size={20} />
            <strong>{text("Upload PDF or text", "Upload PDF of tekst")}</strong>
            <small>{text("Drawings · tech specs · contract", "Tekeningen · tech specs · contract")}</small>
          </button>
          {availableProjectFiles.length ? (
            <div className="rapid-project-library">
              <span>{text("Available in Project Docs", "Beschikbaar in Project Docs")}</span>
              <button className="rapid-index-all" type="button" disabled={busy || availableProjectFiles.every((file) => documents.some((document) => document.name === file.original_name))} onClick={() => void indexExistingSources()}><BookOpenCheck size={14} /><span><strong>{text("Use existing sources", "Gebruik bestaande bronnen")}</strong><small>{text("Index approved PDFs and text files", "Indexeer goedgekeurde pdf's en tekstbestanden")}</small></span></button>
              {availableProjectFiles.slice(0, 8).map((file) => {
                const indexed = documents.some((document) => document.name === file.original_name);
                return <button className={indexed ? "indexed" : ""} type="button" disabled={indexed || Boolean(loadingProjectFileId)} onClick={() => void addProjectFile(file)} key={file.id}><FileText size={14} /><span><strong>{file.original_name}</strong><small>{indexed ? text("Indexed", "Geïndexeerd") : text("Use as source", "Gebruik als bron")}</small></span>{loadingProjectFileId === file.id ? <Loader2 className="spin" size={13} /> : indexed ? <CheckCircle2 size={13} /> : <Plus size={13} />}</button>;
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
        </aside>

        <div className="rapid-query-panel">
          <div className="rapid-mode-tabs" role="tablist" aria-label={text("Verification mode", "Verificatiemodus")}>
            <button className={mode === "question" ? "active" : ""} type="button" role="tab" aria-selected={mode === "question"} onClick={() => { setMode("question"); setResults([]); setSearched(false); }}><ShieldQuestion size={17} /> {text("Ask project documents", "Vraag projectdocumenten")}</button>
            <button className={mode === "compare" ? "active" : ""} type="button" role="tab" aria-selected={mode === "compare"} onClick={() => { setMode("compare"); setResults([]); setSearched(false); }}><FileSearch size={17} /> {text("Compare specification", "Vergelijk specificatie")}</button>
          </div>

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

          <button className="primary-button rapid-run-button" type="button" disabled={!documents.length || !(mode === "question" ? question.trim() : comparison.trim())} onClick={verify}>
            <Search size={16} /> {mode === "question" ? text("Find answer in sources", "Vind antwoord in bronnen") : text("Verify against sources", "Toets aan bronnen")}
          </button>

          {searched ? (
            <section className={`rapid-conclusion ${conclusion.tone}`}>
              {conclusion.tone === "success" ? <CheckCircle2 size={21} /> : <AlertTriangle size={21} />}
              <div><strong>{conclusion.title}</strong><p>{conclusion.copy}</p></div>
            </section>
          ) : null}

          <div className="rapid-results">
            {results.map((result) => (
              <article key={`${result.document}:${result.page}`}>
                <header><span>{result.document} · {text("page", "pagina")} {result.page}</span><button type="button" onClick={() => void navigator.clipboard.writeText(result.excerpt)} aria-label={text("Copy passage", "Kopieer passage")}><Copy size={14} /></button></header>
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
