/**
 * image-store.ts
 * Handles receipt image storage — uploads to Supabase when online,
 * or saves as a Blob in IndexedDB when offline.
 */

import { v4 as uuidv4 } from 'uuid'
import { storeOfflineImage, getOfflineImage, deleteOfflineImage, type OfflineImage } from './local-db'

export interface StoredImage {
  /** URL if stored in Supabase Storage, null if only local */
  cloudUrl: string | null
  /** Local IndexedDB key if stored offline, null if only cloud */
  localImageId: string | null
  /** Object URL for displaying in <img> — always set */
  displayUrl: string
  fileName: string
  sizeBytes: number
}

/**
 * Store an image file either to Supabase (online) or IndexedDB (offline).
 */
export async function storeReceiptImage(
  file: File,
  isOnline: boolean
): Promise<StoredImage> {
  if (isOnline) {
    // Upload to server (which saves to public/receipts/)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    if (!res.ok) throw new Error('Upload gagal')
    const { url, filename, size } = await res.json()
    return {
      cloudUrl: url,
      localImageId: null,
      displayUrl: url,
      fileName: filename,
      sizeBytes: size,
    }
  } else {
    // Save blob locally in IndexedDB
    const id = uuidv4()
    const blob = new Blob([await file.arrayBuffer()], { type: file.type })
    const image: OfflineImage = {
      id,
      blob,
      mimeType: file.type,
      fileName: file.name,
      sizeBytes: file.size,
      createdAt: new Date().toISOString(),
    }
    await storeOfflineImage(image)
    const displayUrl = URL.createObjectURL(blob)
    return {
      cloudUrl: null,
      localImageId: id,
      displayUrl,
      fileName: file.name,
      sizeBytes: file.size,
    }
  }
}

/**
 * Get a displayable URL for an image, resolving local blobs if needed.
 */
export async function resolveImageUrl(
  cloudUrl: string | null,
  localImageId: string | null
): Promise<string | null> {
  if (cloudUrl) return cloudUrl
  if (localImageId) {
    const img = await getOfflineImage(localImageId)
    if (img) return URL.createObjectURL(img.blob)
  }
  return null
}

/**
 * Upload a pending offline image to the server, returning the cloud URL.
 * Call this during sync when connection is restored.
 */
export async function uploadOfflineImage(localImageId: string): Promise<string> {
  const img = await getOfflineImage(localImageId)
  if (!img) throw new Error(`Offline image ${localImageId} not found`)

  const file = new File([img.blob], img.fileName, { type: img.mimeType })
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  if (!res.ok) throw new Error('Upload gambar offline gagal')
  const { url } = await res.json()

  // Clean up local blob after successful upload
  await deleteOfflineImage(localImageId)
  return url as string
}
