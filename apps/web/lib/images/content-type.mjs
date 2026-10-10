/** A filename or browser-supplied MIME is a hint; actual bytes determine image type. */
export function imageContentType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return "";
}

export function validTourPosition(name, order) {
  if (!name.trim()) return !String(order).trim();
  const number = Number(order);
  return Number.isInteger(number) && number >= 1 && number <= 10000;
}

export function orderedTour(captures, current) {
  if (!current?.tour_name || current.capture_type !== "panorama") return [];
  return captures.filter((capture) => capture.capture_type === "panorama" && capture.status === "active"
    && capture.tour_name === current.tour_name && capture.building_id === current.building_id)
    .sort((left, right) => (left.tour_order ?? 0) - (right.tour_order ?? 0) || left.id.localeCompare(right.id));
}
