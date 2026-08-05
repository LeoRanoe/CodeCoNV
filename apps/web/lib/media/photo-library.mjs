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

/** "Today", "Yesterday" or the date itself, so a day heading reads like a day. */
export function dayGroupLabel(key, { todayKey, yesterdayKey, today, yesterday, undated, formatDate }) {
  if (!key) return undated;
  if (key === todayKey) return today;
  if (key === yesterdayKey) return yesterday;
  return formatDate(key);
}
