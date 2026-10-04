/*
 * Reads the capture time and GPS position from a photo's EXIF metadata.
 *
 * In production the Go worker extracts EXIF after upload (doc 7.1, step 4);
 * the mock backend uses this browser-side reader in its place, so the
 * prototype shows real metadata from the owner's own files. It covers the
 * two formats Increment 1 accepts: JPEG (APP1 "Exif" segment) and PNG
 * (eXIf chunk), in both byte orders.
 */

export interface PhotoMetadata {
  /** Decimal degrees, or null when the file has no usable GPS. */
  lat: number | null
  lng: number | null
  /** Wall-clock capture time, "YYYY-MM-DDTHH:MM:SS". */
  captureLocal: string | null
  /** Offset recorded by the camera, e.g. "+02:00". */
  captureOffset: string | null
}

export type ImageKind = 'jpeg' | 'png'

const EMPTY: PhotoMetadata = { lat: null, lng: null, captureLocal: null, captureOffset: null }

const TAG_EXIF_IFD = 0x8769
const TAG_GPS_IFD = 0x8825
const TAG_DATETIME_ORIGINAL = 0x9003
const TAG_DATETIME_DIGITIZED = 0x9004
const TAG_OFFSET_TIME_ORIGINAL = 0x9011
const GPS_LAT_REF = 1
const GPS_LAT = 2
const GPS_LNG_REF = 3
const GPS_LNG = 4

/** Bytes per value for each TIFF field type. */
const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }

/** Identifies the file by its signature, not its name or the browser's guess. */
export function sniffImageKind(head: Uint8Array): ImageKind | null {
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg'
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (png.every((b, i) => head[i] === b)) return 'png'
  return null
}

interface Entry {
  type: number
  count: number
  /** Absolute offset of the value bytes in the view. */
  at: number
}

function parseTiff(view: DataView, start: number): PhotoMetadata {
  const order = view.getUint16(start)
  if (order !== 0x4949 && order !== 0x4d4d) return EMPTY
  const little = order === 0x4949
  const u16 = (at: number) => view.getUint16(at, little)
  const u32 = (at: number) => view.getUint32(at, little)
  if (u16(start + 2) !== 42) return EMPTY

  function readIfd(offset: number): Map<number, Entry> {
    const entries = new Map<number, Entry>()
    const base = start + offset
    const n = u16(base)
    for (let i = 0; i < n; i++) {
      const e = base + 2 + i * 12
      const type = u16(e + 2)
      const count = u32(e + 4)
      const size = (TYPE_SIZE[type] ?? 1) * count
      entries.set(u16(e), { type, count, at: size <= 4 ? e + 8 : start + u32(e + 8) })
    }
    return entries
  }

  function ascii(entry: Entry | undefined): string | null {
    if (!entry || entry.type !== 2) return null
    let text = ''
    for (let i = 0; i < entry.count; i++) {
      const c = view.getUint8(entry.at + i)
      if (c === 0) break
      text += String.fromCharCode(c)
    }
    return text.trim() || null
  }

  function rationals(entry: Entry | undefined): number[] | null {
    if (!entry || (entry.type !== 5 && entry.type !== 10)) return null
    const values: number[] = []
    for (let i = 0; i < entry.count; i++) {
      const at = entry.at + i * 8
      const num = entry.type === 5 ? u32(at) : view.getInt32(at, little)
      const den = entry.type === 5 ? u32(at + 4) : view.getInt32(at + 4, little)
      if (den === 0) return null
      values.push(num / den)
    }
    return values
  }

  function pointer(ifd: Map<number, Entry>, tag: number): number | null {
    const e = ifd.get(tag)
    return e ? u32(e.at) : null
  }

  const ifd0 = readIfd(u32(start + 4))
  const result: PhotoMetadata = { ...EMPTY }

  const exifAt = pointer(ifd0, TAG_EXIF_IFD)
  if (exifAt !== null) {
    const exif = readIfd(exifAt)
    result.captureLocal = parseExifDate(ascii(exif.get(TAG_DATETIME_ORIGINAL)) ?? ascii(exif.get(TAG_DATETIME_DIGITIZED)))
    const offset = ascii(exif.get(TAG_OFFSET_TIME_ORIGINAL))
    result.captureOffset = offset && /^[+-]\d{2}:\d{2}$/.test(offset) ? offset : null
  }

  const gpsAt = pointer(ifd0, TAG_GPS_IFD)
  if (gpsAt !== null) {
    const gps = readIfd(gpsAt)
    const lat = toDegrees(rationals(gps.get(GPS_LAT)), ascii(gps.get(GPS_LAT_REF)), 'S')
    const lng = toDegrees(rationals(gps.get(GPS_LNG)), ascii(gps.get(GPS_LNG_REF)), 'W')
    // 0,0 is what many apps write when they had no fix, so it is not a usable position.
    const usable = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)
    if (usable) {
      result.lat = Math.round(lat * 1e6) / 1e6
      result.lng = Math.round(lng * 1e6) / 1e6
    }
  }
  return result
}

/** Degrees, minutes, seconds plus a hemisphere letter to signed decimal degrees. */
function toDegrees(dms: number[] | null, ref: string | null, negative: 'S' | 'W'): number | null {
  if (!dms || dms.length === 0 || dms.some((v) => !Number.isFinite(v))) return null
  const [d, m = 0, s = 0] = dms
  const value = d + m / 60 + s / 3600
  return ref?.toUpperCase() === negative ? -value : value
}

/** "2026:06:01 09:12:00" to "2026-06-01T09:12:00"; blank or zeroed dates are null. */
function parseExifDate(raw: string | null): string | null {
  const m = raw?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
  if (!m || m[1] === '0000') return null
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`
}

function findJpegTiff(view: DataView): number | null {
  let at = 2
  while (at + 4 <= view.byteLength) {
    if (view.getUint8(at) !== 0xff) return null
    const marker = view.getUint8(at + 1)
    // Start of scan: image data follows and no metadata segment comes after it.
    if (marker === 0xda) return null
    const length = view.getUint16(at + 2)
    // APP1 starting with "Exif\0\0".
    if (marker === 0xe1 && view.getUint32(at + 4) === 0x45786966 && view.getUint16(at + 8) === 0) return at + 10
    at += 2 + length
  }
  return null
}

function findPngTiff(view: DataView): number | null {
  let at = 8
  while (at + 8 <= view.byteLength) {
    const length = view.getUint32(at)
    const type = view.getUint32(at + 4)
    if (type === 0x65584966) return at + 8 // "eXIf"
    if (type === 0x49454e44) return null // "IEND"
    at += 12 + length
  }
  return null
}

/**
 * Reads a file's metadata. Never throws: a damaged or metadata-free file
 * simply yields nulls, and the photo goes to the review queue.
 */
export async function readPhotoMetadata(file: Blob, kind: ImageKind): Promise<PhotoMetadata> {
  try {
    // JPEG metadata sits in the first segments; PNG may place eXIf anywhere before IEND.
    const bytes = await (kind === 'jpeg' ? file.slice(0, 512 * 1024) : file).arrayBuffer()
    const view = new DataView(bytes)
    const tiff = kind === 'jpeg' ? findJpegTiff(view) : findPngTiff(view)
    return tiff === null ? EMPTY : parseTiff(view, tiff)
  } catch {
    return EMPTY
  }
}
