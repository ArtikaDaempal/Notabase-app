/**
 * download-image.ts
 * Helper to download a receipt image to the user's device.
 */

/**
 * Download a receipt image.
 * Works with both remote URLs and local blob URLs.
 *
 * @param imageUrl  The URL of the image (remote or blob:)
 * @param merchantName  Used to build a descriptive filename
 * @param date  ISO date string for the filename
 */
export async function downloadReceiptImage(
  imageUrl: string,
  merchantName: string,
  date: string
): Promise<void> {
  // Build filename: nota_Indomaret_2024-01-15.jpg
  const safeMerchant = merchantName.replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g, '').trim().replace(/\s+/g, '_')
  const dateStr = date ? date.slice(0, 10) : new Date().toISOString().slice(0, 10)
  const filename = `nota_${safeMerchant}_${dateStr}.jpg`

  // Fetch and trigger download
  const res = await fetch(imageUrl)
  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  }, 200)
}

/**
 * Rotate an image blob by a given angle and return a new Blob.
 * Uses the Canvas API — no external dependencies.
 *
 * @param imageUrl  Source URL (remote, blob:, or data:)
 * @param degrees   Rotation angle in degrees (90, 180, 270)
 */
export function rotateImage(imageUrl: string, degrees: 90 | 180 | 270): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const rad = (degrees * Math.PI) / 180
      const swap = degrees === 90 || degrees === 270
      const canvas = document.createElement('canvas')
      canvas.width = swap ? img.height : img.width
      canvas.height = swap ? img.width : img.height

      const ctx = canvas.getContext('2d')!
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate(rad)
      ctx.drawImage(img, -img.width / 2, -img.height / 2)

      resolve(canvas.toDataURL('image/jpeg', 0.92))
    }
    img.onerror = reject
    img.src = imageUrl
  })
}
