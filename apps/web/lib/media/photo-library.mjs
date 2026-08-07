/**
 * How the photo library is ordered.
 *
 * The library grew into one long strip of pictures with a folder bar whose counts came
 * from the whole project while the strip itself showed one building. On site that reads
 * as photos that are missing. Ordering here is therefore one rule everywhere: the folder
 * bar counts exactly what the gallery shows, the folders a supervisor uses every day come
 * first, and the pictures stand under the day they were taken, newest day on top.
 */

/** The photos and drawings the library is showing, before any folder is chosen. */
export function visibleLibraryFiles(files, buildingId) {
  return (files ?? []).filter((file) => file.status === "available"
    && (!file.building_id || !buildingId || file.building_id === buildingId));
}

/** What one folder button counts: the same files the gallery would show inside it. */
export function filesInFolder(files, folderId) {
  if (folderId === "all") return files ?? [];
  if (folderId === "unfiled") return (files ?? []).filter((file) => !file.folder_id);
  return (files ?? []).filter((file) => file.folder_id === folderId);
}

/**
 * The folders a supervisor reaches for first — the standard ones, in the order the client
 * works in — and after them everything that was created by hand, alphabetically.
 */
export function orderMediaFolders(folders, preferredNames = []) {
  const rank = new Map(preferredNames.map((name, index) => [name.toLocaleLowerCase(), index]));
  return [...(folders ?? [])].sort((left, right) => {
    const leftRank = rank.get(left.name?.toLocaleLowerCase() ?? "") ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rank.get(right.name?.toLocaleLowerCase() ?? "") ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return (left.name ?? "").localeCompare(right.name ?? "");
  });
}

/**
 * Folders as a tree, flattened for a list: a parent is followed by its children, each
 * carrying how deep it sits and the path a person reads it by. The bar showed a flat row
 * of names, so a folder inside another was indistinguishable from one beside it.
 */
export function nestMediaFolders(folders, preferredNames = []) {
  const all = orderMediaFolders(folders, preferredNames);
  const byParent = new Map();
  const known = new Set(all.map((folder) => folder.id));
  for (const folder of all) {
    // A folder whose parent is archived or filtered away is shown at the top level
    // rather than disappearing with it.
    const parent = folder.parent_id && known.has(folder.parent_id) ? folder.parent_id : null;
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push(folder);
  }
  const flattened = [];
  const walk = (parent, depth, trail) => {
    for (const folder of byParent.get(parent) ?? []) {
      // A cycle would otherwise loop forever; depth is the cheapest guard that also
      // keeps the list readable.
      if (depth > 6 || flattened.some((item) => item.id === folder.id)) continue;
      const path = [...trail, folder.name];
      flattened.push({ ...folder, depth, path: path.join(" › ") });
      walk(folder.id, depth + 1, path);
    }
  };
  walk(null, 0, []);
  return flattened;
}

/** Which folders a folder may be moved into: anything but itself and its own descendants. */
export function folderMoveTargets(folders, folderId) {
  const children = new Map();
  for (const folder of folders ?? []) {
    if (!children.has(folder.parent_id)) children.set(folder.parent_id, []);
    children.get(folder.parent_id).push(folder.id);
  }
  const blocked = new Set([folderId]);
  const walk = (id) => {
    for (const child of children.get(id) ?? []) {
      if (blocked.has(child)) continue;
      blocked.add(child);
      walk(child);
    }
  };
  walk(folderId);
  return (folders ?? []).filter((folder) => !blocked.has(folder.id));
}

/** The day a photo belongs to, in the project's own timezone. */
export function libraryDayKey(value, timeZone = "America/Paramaribo") {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/**
 * The gallery in the order a day on site happens: the newest day first, and inside a day
 * the newest picture first. A photo without a usable date keeps its place at the end
 * instead of disappearing.
 */
export function groupFilesByDay(files, { timeZone = "America/Paramaribo", dateOf = (file) => file.created_at } = {}) {
  const days = new Map();
  for (const file of files ?? []) {
    const stamp = dateOf(file);
    const key = libraryDayKey(stamp, timeZone);
    if (!days.has(key)) days.set(key, []);
    days.get(key).push({ file, stamp });
  }
  return [...days.entries()]
    .sort(([left], [right]) => (left ? 0 : 1) - (right ? 0 : 1) || right.localeCompare(left))
    .map(([key, entries]) => ({
      key,
      files: entries
        .sort((left, right) => String(right.stamp ?? "").localeCompare(String(left.stamp ?? "")))
        .map((entry) => entry.file),
    }));
}

/**
 * A photo stack is persisted on visual_captures.stack_id. Historical and ordinary photos
 * have no key and therefore remain valid stacks of one. The order of the incoming file list
 * is preserved so a stack never jumps around after synchronization or reload.
 */
export function groupPhotoStacks(files, captures = []) {
  const captureByFile = new Map((captures ?? []).map((capture) => [capture.file_id, capture]));
  const groups = new Map();
  for (const file of files ?? []) {
    const capture = captureByFile.get(file.id);
    const key = capture?.stack_id ? `stack:${capture.stack_id}` : `file:${file.id}`;
    if (!groups.has(key)) groups.set(key, { key, files: [], capture });
    groups.get(key).files.push(file);
  }
  return [...groups.values()];
}

/** "Today", "Yesterday" or the date itself, so a day heading reads like a day. */
export function dayGroupLabel(key, { todayKey, yesterdayKey, today, yesterday, undated, formatDate }) {
  if (!key) return undated;
  if (key === todayKey) return today;
  if (key === yesterdayKey) return yesterday;
  return formatDate(key);
}

/**
 * A phone names a photo after the millisecond it was taken, and a camera names it after
 * its own counter. On a card those names read as noise: "1785783668026208549797..." says
 * nothing about the picture, and pushes what does say something off the screen.
 *
 * So the card shows, in this order: the words that were written about the picture, the
 * controlled document code, the file name a person actually chose, and — when the name is
 * a machine's — what the file is, on the day it arrived.
 */
/**
 * @param {{ original_name?: string, document_code?: string | null, created_at?: string }} file
 * @param {{ title?: string, documentCode?: string, kindLabel?: string, formatDate?: (value: string) => string }} [options]
 */
export function readableFileLabel(file, options = {}) {
  const { title = "", documentCode = "", kindLabel = "File", formatDate = () => "" } = options;
  const written = String(title ?? "").trim();
  if (written) return written;
  const code = String(documentCode ?? file?.document_code ?? "").trim();
  if (code) return code;
  const name = String(file?.original_name ?? "").trim();
  const base = name.replace(/\.[a-z0-9]{1,5}$/i, "").trim();
  if (base && !machineNamed(base)) return base;
  const day = formatDate(file?.created_at ?? "");
  return day ? `${kindLabel} · ${day}` : kindLabel;
}

/** A name a person typed has words in it; a name a device made is a run of characters. */
export function machineNamed(base) {
  const cleaned = base.replace(/[\s._-]+/g, "");
  // What a camera roll or a screenshot calls a picture, whatever its length.
  if (/^(img|dsc|pxl|photo|image|screenshot|whatsapp|foto|scan)[0-9]*$/i.test(cleaned)) return true;
  if (cleaned.length < 10) return false;
  // A timestamp, a uuid or a hash: digits, hexadecimals, or simply far too long a run of
  // characters to be something a person typed as a title.
  if (/^[0-9]+$/.test(cleaned)) return true;
  if (/^[0-9a-f]{12,}$/i.test(cleaned)) return true;
  if (cleaned.length > 28 && !/[aeiou][a-z]{2}/i.test(cleaned)) return true;
  return false;
}
