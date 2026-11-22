/** A filename or browser-supplied MIME is a hint; actual bytes determine image type. */
export function imageContentType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(String.fromCharCode(...bytes.slice(0, 6)))) return "image/gif";
  return "";
}

/** HEIC, HEIF or AVIF: an ISO base media file whose "ftyp" box names an image brand. */
export function heifContentType(bytes) {
  if (bytes.length < 16 || String.fromCharCode(...bytes.slice(4, 8)) !== "ftyp") return "";
  const boxSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  const brands = [String.fromCharCode(...bytes.slice(8, 12))];
  for (let offset = 16; offset + 4 <= Math.min(boxSize, bytes.length); offset += 4) {
    brands.push(String.fromCharCode(...bytes.slice(offset, offset + 4)));
  }
  if (brands.some((brand) => ["avif", "avis"].includes(brand))) return "image/avif";
  if (brands.some((brand) => ["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs"].includes(brand))) return "image/heic";
  if (brands.some((brand) => ["mif1", "msf1"].includes(brand))) return "image/heif";
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
