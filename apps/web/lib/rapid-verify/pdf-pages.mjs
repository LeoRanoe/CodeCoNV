/** Bounded page extraction with cleanup on success, cancellation and parse failures.
 * @param {any} task
 * @param {{ signal?: AbortSignal, onProgress?: (page: number, total: number) => void, maxPages?: number, maxCharacters?: number }} [options]
 */
export async function extractPdfPages(task, { signal, onProgress = (page, total) => { void page; void total; }, maxPages = 500, maxCharacters = 5_000_000 } = {}) {
  const abort = () => { void task.destroy().catch(() => undefined); };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    signal?.throwIfAborted();
    const pdf = await task.promise;
    if (pdf.numPages > maxPages) throw new Error(`PDF contains more than ${maxPages} pages. Split the document first.`);
    const pages = [];
    let characters = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      signal?.throwIfAborted();
      const page = await pdf.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        signal?.throwIfAborted();
        const text = content.items.map((item) => "str" in item ? item.str : "").join(" ").replace(/\s+/g, " ").trim();
        characters += text.length;
        if (characters > maxCharacters) throw new Error("Document text is too large. Split the document first.");
        pages.push({ page: pageNumber, text });
        onProgress(pageNumber, pdf.numPages);
      } finally { page.cleanup(); }
      // Let input, cancellation and progress paint between pages.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (!pages.some((page) => page.text)) throw new Error("This PDF has no searchable text. Add a text or OCR export.");
    return pages;
  } finally {
    signal?.removeEventListener("abort", abort);
    await task.destroy().catch(() => undefined);
  }
}
