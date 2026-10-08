// ─────────────────────────────────────────────────────────────────
// SHRINK A PHONE PHOTO BEFORE IT GOES UP
//
// A site photo off a phone is 3–12 MB. On a 4G connection at a tower
// that is a minute of waiting, and the team stops bothering. Drawn
// into a canvas at 1600px and re-encoded, the same picture is about
// 180 KB and still perfectly readable for evidence.
//
// PDFs pass straight through — compressing a document would damage it.
// ─────────────────────────────────────────────────────────────────

const MAX_EDGE = 1600
const QUALITY  = 0.82

export function isImage(file) {
  return file && file.type && file.type.startsWith('image/')
}

export async function compressImage(file) {
  if (!isImage(file)) return { file, originalBytes: file.size, storedBytes: file.size }
  // HEIC off an iPhone can't be drawn into a canvas in every browser.
  // Leave it alone rather than produce a blank image.
  if (/heic|heif/i.test(file.type)) {
    return { file, originalBytes: file.size, storedBytes: file.size }
  }

  try {
    const bitmap = await loadBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, w, h)
    if (bitmap.close) bitmap.close()

    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', QUALITY))
    if (!blob || blob.size >= file.size) {
      // Already small, or the re-encode made it bigger. Keep the original.
      return { file, originalBytes: file.size, storedBytes: file.size }
    }

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    const out = new File([blob], name, { type: 'image/jpeg' })
    return { file: out, originalBytes: file.size, storedBytes: out.size }
  } catch {
    // Anything goes wrong, send the original. Never lose the photo.
    return { file, originalBytes: file.size, storedBytes: file.size }
  }
}

function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file)
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')) }
    img.src = url
  })
}

export function kb(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
