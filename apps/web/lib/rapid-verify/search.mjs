export function normalizeEvidence(value) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
const stopWords = new Set("aan als bij dat de den der die dit een en het hoe in is kan met naar of om op te uit van voor wat welke the a an and are as at be by for from how in is of on or that this to what which with".split(" "));
export function searchTerms(value) {
  return [...new Set(normalizeEvidence(value).split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !stopWords.has(word)))].slice(0, 100);
}
export function excerptAround(source, terms) {
  const compact = source.replace(/\s+/g, " ").trim();
  if (compact.length <= 430) return compact;
  const lower = normalizeEvidence(compact);
  const first = Math.min(...terms.map((term) => lower.indexOf(term)).filter((index) => index >= 0));
  const start = Math.max(0, (Number.isFinite(first) ? first : 0) - 120);
  const end = Math.min(compact.length, start + 430);
  return `${start ? "…" : ""}${compact.slice(start, end)}${end < compact.length ? "…" : ""}`;
}
/** Results always refer to a concrete document ID and a real page. */
export function searchDocuments(documents, query) {
  const terms = searchTerms(query);
  if (!terms.length) return [];
  return documents.flatMap((document) => document.pages.map((page) => {
    const normalized = normalizeEvidence(page.text);
    const matched = terms.filter((term) => normalized.includes(term));
    return { documentId: document.id, document: document.name, page: page.page,
      excerpt: matched.length ? excerptAround(page.text, matched) : "",
      score: matched.reduce((total, term) => total + normalized.split(term).length - 1, 0) };
  })).filter((result) => result.score > 0 && result.excerpt)
    .sort((left, right) => right.score - left.score || left.documentId.localeCompare(right.documentId) || left.page - right.page)
    .slice(0, 4);
}
