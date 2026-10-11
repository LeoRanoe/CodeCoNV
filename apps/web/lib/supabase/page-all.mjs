/**
 * The API answers at most `max_rows` (1000) rows per request, whatever `.limit()` says, and a
 * fixed `.limit(100)` simply drops the rest. A project with 124 issues therefore showed 100 on
 * the workspace tile and lost its oldest records — an open NCR among them — from every list,
 * the action centre and the reports, with nothing on screen saying that rows were missing.
 *
 * `pageAll` reads a query page by page until a short page says there is nothing left. The
 * caller passes a function that builds the query for one `range`, ordered by something stable
 * (add `.order("id")` as the last tiebreaker) so no row is read twice or skipped.
 */
export const pageSize = 1000;

/**
 * @typedef {{ data: unknown[] | null, error: import("@supabase/supabase-js").PostgrestError | null }} Page
 * @typedef {(from: number, to: number) => PromiseLike<Page>} PageQuery
 */

/**
 * @param {PageQuery} query
 * @param {number} [ceiling]
 * @param {number} [size] must not exceed the API's max_rows
 * @returns {Promise<{ data: any[] | null, error: import("@supabase/supabase-js").PostgrestError | null, truncated: boolean }>}
 */
export async function pageAll(query, ceiling = 20_000, size = pageSize) {
  /** @type {any[]} */
  const rows = [];
  for (let from = 0; from < ceiling; from += size) {
    const to = Math.min(from + size, ceiling) - 1;
    const page = await query(from, to);
    if (page.error) return { data: null, error: page.error, truncated: false };
    const received = page.data ?? [];
    rows.push(...received);
    if (received.length < to - from + 1) return { data: rows, error: null, truncated: false };
  }
  // The ceiling was reached with a full last page: there may be more. Say so instead of
  // pretending the list is complete.
  return { data: rows, error: null, truncated: true };
}
