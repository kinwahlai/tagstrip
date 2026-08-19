import type { NormalizedRect } from './geometry'

// Crops a normalized (0-1) region out of a page image, at the image's native
// resolution, for handing to an OCR engine.
export async function cropPageRegion(
  pageImage: Blob,
  rect: NormalizedRect,
  pageWidth: number,
  pageHeight: number,
): Promise<Blob> {
  const bitmap = await createImageBitmap(pageImage)
  try {
    const sx = rect.x * pageWidth
    const sy = rect.y * pageHeight
    const sw = rect.width * pageWidth
    const sh = rect.height * pageHeight

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(sw))
    canvas.height = Math.max(1, Math.round(sh))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not acquire 2D canvas context.')
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Failed to encode cropped region as an image.')
    return blob
  } finally {
    bitmap.close()
  }
}
