// @ts-check

/**
 * Which way the camera was pointing, straight out of the photo itself.
 *
 * The client asked whether the facing direction can be filled in automatically. A phone camera
 * writes that number into the picture (EXIF `GPSImgDirection`) whenever the compass was
 * available, so the supervisor does not have to remember it on site. This reads only that one
 * number: no library, no upload, and nothing that leaves the device.
 */

const JPEG_START = 0xffd8;
const APP1_MARKER = 0xffe1;
const GPS_IFD_POINTER = 0x8825;
const GPS_IMG_DIRECTION = 0x0011;
const RATIONAL = 5;
const TIFF_LITTLE_ENDIAN = 0x4949;
const TIFF_BIG_ENDIAN = 0x4d4d;

/**
 * The APP1 segment that carries the EXIF block, or null when the file has none. Other
 * segments (thumbnails, colour profiles, comments) are stepped over rather than parsed.
 *
 * @param {DataView} view
 */
function exifSegmentOffset(view) {
  if (view.byteLength < 4 || view.getUint16(0) !== JPEG_START) return null;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    // Padding bytes between segments are legal and are simply walked past.
    if (marker === 0xffff) { offset += 1; continue; }
    if ((marker & 0xff00) !== 0xff00) return null;
    const length = view.getUint16(offset + 2);
    if (length < 2) return null;
    if (marker === APP1_MARKER) {
      const header = offset + 4;
      if (header + 6 > view.byteLength) return null;
      const isExif = view.getUint32(header) === 0x45786966 && view.getUint16(header + 4) === 0;
      if (isExif) return header + 6;
    }
    offset += 2 + length;
  }
  return null;
}

/**
 * One directory entry, resolved to its value. Only the shapes this reader needs are handled;
 * anything else returns null so an unusual camera can never throw on the field screen.
 *
 * @param {DataView} view
 * @param {number} tiffStart
 * @param {number} entryOffset
 * @param {boolean} littleEndian
 */
function entryValue(view, tiffStart, entryOffset, littleEndian) {
  const type = view.getUint16(entryOffset + 2, littleEndian);
  const valueOffset = entryOffset + 8;
  if (type === RATIONAL) {
    const target = tiffStart + view.getUint32(valueOffset, littleEndian);
    if (target + 8 > view.byteLength) return null;
    const numerator = view.getUint32(target, littleEndian);
    const denominator = view.getUint32(target + 4, littleEndian);
    if (!denominator) return null;
    return numerator / denominator;
  }
  // LONG and SHORT sit inside the entry itself and are used for the GPS directory pointer.
  if (type === 4) return view.getUint32(valueOffset, littleEndian);
  if (type === 3) return view.getUint16(valueOffset, littleEndian);
  return null;
}

/**
 * @param {DataView} view
 * @param {number} tiffStart
 * @param {number} directoryOffset
 * @param {boolean} littleEndian
 * @param {number} tag
 */
function readTag(view, tiffStart, directoryOffset, littleEndian, tag) {
  if (directoryOffset + 2 > view.byteLength) return null;
  const count = view.getUint16(directoryOffset, littleEndian);
  for (let index = 0; index < count; index += 1) {
    const entryOffset = directoryOffset + 2 + (index * 12);
    if (entryOffset + 12 > view.byteLength) return null;
    if (view.getUint16(entryOffset, littleEndian) === tag) {
      return entryValue(view, tiffStart, entryOffset, littleEndian);
    }
  }
  return null;
}

/**
 * The compass bearing the photo was taken at, in degrees, or null when the camera did not
 * record one. A photo without a bearing is normal — indoors a phone often has no fix — so the
 * caller falls back to the live compass or to the supervisor's own choice.
 *
 * @param {ArrayBuffer | ArrayBufferView} data
 * @returns {number | null}
 */
export function exifImageDirection(data) {
  try {
    const buffer = ArrayBuffer.isView(data)
      ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      : data;
    const view = new DataView(buffer);
    const tiffStart = exifSegmentOffset(view);
    if (tiffStart === null || tiffStart + 8 > view.byteLength) return null;

    const byteOrder = view.getUint16(tiffStart);
    if (byteOrder !== TIFF_LITTLE_ENDIAN && byteOrder !== TIFF_BIG_ENDIAN) return null;
    const littleEndian = byteOrder === TIFF_LITTLE_ENDIAN;
    if (view.getUint16(tiffStart + 2, littleEndian) !== 0x002a) return null;

    const ifdZero = tiffStart + view.getUint32(tiffStart + 4, littleEndian);
    const gpsPointer = readTag(view, tiffStart, ifdZero, littleEndian, GPS_IFD_POINTER);
    if (gpsPointer === null) return null;

    const direction = readTag(view, tiffStart, tiffStart + gpsPointer, littleEndian, GPS_IMG_DIRECTION);
    if (direction === null || !Number.isFinite(direction)) return null;
    return ((direction % 360) + 360) % 360;
  } catch {
    // A photo that cannot be read is not an error on site: the field simply stays open.
    return null;
  }
}

/**
 * The same reading, straight from the file the camera handed over. Only the head of the file
 * is read: EXIF sits at the front, and a full site photo is far too large to hold twice.
 *
 * @param {Blob} file
 */
export async function readPhotoDirection(file) {
  if (!file || typeof file.slice !== "function") return null;
  try {
    const head = await file.slice(0, 256 * 1024).arrayBuffer();
    return exifImageDirection(head);
  } catch {
    return null;
  }
}
