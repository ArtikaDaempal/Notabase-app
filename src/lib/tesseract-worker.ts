/**
 * tesseract-worker.ts
 * Lazy-loads Tesseract.js WASM for offline OCR.
 * Only initializes when first called to avoid bundle bloat on initial load.
 *
 * Dokumen acuan:
 *   03-business-rules.md §2 (BR-OCR-03/04/05 — confidence thresholds)
 *   lib/rules/ocr-rules.ts (getOcrStatus)
 */

import type { OcrResult } from '@/types'
import { getOcrStatus } from '@/lib/rules/ocr-rules'

let workerReady = false
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tesseractWorker: any = null

export type TesseractProgressCallback = (progress: number, status: string) => void

async function getWorker(onProgress?: TesseractProgressCallback) {
  if (workerReady && tesseractWorker) return tesseractWorker

  // Dynamic import — WASM is loaded only on first use
  const { createWorker } = await import('tesseract.js')

  tesseractWorker = await createWorker(['ind', 'eng'], 1, {
    logger: (m: { status: string; progress: number }) => {
      if (onProgress && m.status === 'recognizing text') {
        onProgress(Math.round(m.progress * 100), m.status)
      }
    },
  })

  workerReady = true
  return tesseractWorker
}

/**
 * Run offline OCR using Tesseract.js.
 * Returns a partial OcrResult (items are empty, confidence is lower).
 */
export async function runTesseractOcr(
  imageDataUrl: string,
  onProgress?: TesseractProgressCallback
): Promise<OcrResult> {
  onProgress?.(0, 'Memuat mesin OCR offline...')
  const worker = await getWorker(onProgress)

  onProgress?.(10, 'Memproses gambar...')
  const { data } = await worker.recognize(imageDataUrl)
  const text: string = data.text || ''
  const rawConfidence: number = data.confidence || 0
  const confidence = Math.min(Math.round(rawConfidence * 0.9), 85) // cap offline confidence

  // Basic field extraction from raw text
  const namaToko = extractMerchantName(text)
  const nominal = extractTotal(text)
  const tanggal = extractDate(text)
  const receiptNumber = extractInvoice(text)

  onProgress?.(100, 'Selesai')

  return {
    isReceipt: true, // Tesseract cannot validate receipt type, assume true
    namaToko: namaToko || 'Tidak Terbaca',
    tanggal: tanggal || new Date().toISOString().split('T')[0],
    nominal,
    receiptNumber,
    keterangan: 'Diproses secara offline (Tesseract OCR)',
    items: [],
    ocrRawText: text,
    confidence,
    status: getOcrStatus(confidence),
  }
}

/** Terminate worker to free memory (call on unmount if needed) */
export async function terminateTesseractWorker(): Promise<void> {
  if (tesseractWorker && workerReady) {
    await tesseractWorker.terminate()
    tesseractWorker = null
    workerReady = false
  }
}

// ─────────────────────────────────────────────
// Simple text parsers (same logic as server-side route.ts)
// ─────────────────────────────────────────────

function extractMerchantName(text: string): string | null {
  // First: check for known bank/payment apps in the full text
  const providers: [RegExp, string][] = [
    [/livin\s*by\s*mandiri/i, 'Livin by Mandiri'],
    [/mandiri\s*livin/i, 'Livin by Mandiri'],
    [/bank\s*mandiri/i, 'Bank Mandiri'],
    [/bca\s*mobile|bank\s*central\s*asia/i, 'BCA Mobile'],
    [/brimo|bank\s*rakyat\s*indonesia/i, 'BRImo - BRI'],
    [/bsi\s*mobile|bank\s*syariah\s*indonesia/i, 'BSI Mobile'],
    [/dana(?:\s+digital|\.id)?/i, 'DANA'],
    [/gopay|gojek/i, 'GoPay'],
    [/ovo(?:\s+prime)?/i, 'OVO'],
    [/shopeepay|shopee\s*pay/i, 'ShopeePay'],
    [/linkaja/i, 'LinkAja'],
    [/indihome|tele?kom/i, 'Telkom/Indihome'],
    [/pln\s*(?:mobile|token)?/i, 'PLN'],
    [/bpjs/i, 'BPJS'],
    [/indomaret/i, 'Indomaret'],
    [/alfamart/i, 'Alfamart'],
  ]
  for (const [pattern, name] of providers) {
    if (pattern.test(text)) return name
  }

  // Extract 'Penyedia Jasa' from Mandiri Livin format
  const penyediaMatch = text.match(/penyedia\s+jasa[\s\S]{0,50}?([A-Z][a-zA-Z\s]{2,30})/i)
  if (penyediaMatch?.[1]?.trim()) return penyediaMatch[1].trim()

  // Fallback: first non-empty, non-numeric line
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const firstMeaningfulLine = lines.find((l) => l.length >= 3 && !/^\d+$/.test(l))
  return firstMeaningfulLine || null
}

function extractTotal(text: string): number {
  const candidates: number[] = []

  // Priority: labels like total/jumlah/dibayar/tagihan
  const priorityPatterns = [
    /(?:total|jumlah|dibayar|tagihan|nominal|amount)[^\d]{0,15}rp\.?\s*([\d.]+(?:,\d{2})?)/gi,
    /rp\.?\s*([\d.]+(?:,\d{2})?)\s*(?:total|dibayar|tagihan)/gi,
  ]
  for (const pattern of priorityPatterns) {
    for (const m of text.matchAll(pattern)) {
      const num = parseFloat((m[1] || '').replace(/\./g, '').replace(',', '.'))
      if (!isNaN(num) && num >= 1000 && num < 1_000_000_000) candidates.push(num)
    }
  }
  if (candidates.length) return Math.max(...candidates)

  // Fallback: all Rp amounts in valid range
  for (const m of text.matchAll(/rp\.?\s*([\d.]+(?:,\d{2})?)/gi)) {
    const num = parseFloat((m[1] || '').replace(/\./g, '').replace(',', '.'))
    if (!isNaN(num) && num >= 1000 && num < 1_000_000_000) candidates.push(num)
  }
  if (candidates.length) return Math.max(...candidates)
  return 0
}

function extractDate(text: string): string | null {
  const patterns = [
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/,
    /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/,
    /(\d{1,2})\s+(jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des)[a-z]*\s+(\d{4})/i,
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m) {
      try {
        const d = new Date(m[0].replace(/(\d{2})\.(\d{2})\.(\d{4})/, '$3-$2-$1'))
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0] // return "YYYY-MM-DD"
      } catch { /* continue */ }
    }
  }
  return null
}

function extractInvoice(text: string): string | null {
  const refPatterns = [
    /no\.?\s*ref(?:erensi)?\.?\s*:?\s*([A-Z0-9]{8,24})/i,
    /no\.?\s*transaksi\.?\s*:?\s*([A-Z0-9]{8,24})/i,
    /(?:inv|invoice|nota|no)[.\s:]*(#?\s*[A-Z0-9\-\/]{4,})/i,
  ]
  for (const p of refPatterns) {
    const m = text.match(p)
    if (m) return m[1].replace(/^#?\s*/, '').trim()
  }
  return null
}
