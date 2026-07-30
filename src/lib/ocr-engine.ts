/**
 * ocr-engine.ts
 * Hybrid OCR abstraction: uses Gemini API when online, Tesseract.js when offline.
 */

import type { OcrResult } from '@/types'
import { runTesseractOcr, type TesseractProgressCallback } from './tesseract-worker'

export type OcrMode = 'gemini' | 'tesseract'

export interface OcrEngineResult extends OcrResult {
  mode: OcrMode
}

/**
 * Run OCR on an image data URL.
 * Automatically chooses Gemini (online) or Tesseract (offline).
 *
 * @param imageDataUrl  Base64 data URL of the image
 * @param isOnline      Whether the device has network connectivity
 * @param onProgress    Optional callback for Tesseract progress (0-100)
 */
export async function runOcr(
  imageDataUrl: string,
  isOnline: boolean,
  onProgress?: TesseractProgressCallback
): Promise<OcrEngineResult> {
  if (isOnline) {
    return runGeminiOcr(imageDataUrl)
  } else {
    const result = await runTesseractOcr(imageDataUrl, onProgress)
    return { ...result, mode: 'tesseract' }
  }
}

/**
 * Call the server-side Gemini OCR route.
 * Requires internet connection.
 */
async function runGeminiOcr(imageDataUrl: string): Promise<OcrEngineResult> {
  const res = await fetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl: imageDataUrl }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Gagal memproses OCR')
  }

  const result: OcrResult = await res.json()
  return { ...result, mode: 'gemini' }
}

/**
 * Convert a File or Blob to a base64 data URL for OCR processing.
 */
export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
