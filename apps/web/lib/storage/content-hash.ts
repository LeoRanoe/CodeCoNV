import { createHash } from "node:crypto";
import { get } from "@vercel/blob";

/**
 * SHA-256 of the object as it is actually stored, computed by trusted server code.
 *
 * The browser hashes a file before uploading it and the reservation records that value, but
 * a value the client declares is a claim, not evidence. A file only becomes "available" once
 * the bytes in the private store hash to the same value (see the upload completion routes),
 * and files.content_verified_at records when that check was made.
 */
export async function sha256OfStoredBlob(pathname: string) {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) throw new Error("STORED_BLOB_UNREADABLE");
  const hash = createHash("sha256");
  const reader = result.stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    hash.update(value);
  }
  return hash.digest("hex");
}
