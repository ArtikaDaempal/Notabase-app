/**
 * shared/services/ocrService.ts
 * Offline OCR Service with OpenCV-Style Image Pre-processing (Deskew, Auto-Crop, Contrast Enhancement)
 * and Text Extraction Engine.
 *
 * Dokumen acuan:
 *   01-architecture.md §3.2 (OpenCV Preprocessing) & §3.3 (ONNX Runtime / WASM OCR)
 *   03-business-rules.md (BR-OCR-01..07)
 */

import { createWorker } from 'tesseract.js'
import {
  calculateOcrConfidence,
  evaluateOcrStatus,
} from './receiptService'
import type { OcrResult, ReceiptItem, StatusOcr } from '../types/receipt'

// ─────────────────────────────────────────────────────────────────────────────
// OpenCV-Style Image Preprocessing (Grayscale, Contrast Boost, Sharpen, Auto-Crop)
// ─────────────────────────────────────────────────────────────────────────────

export interface PreprocessOptions {
  contrast?: number       // Contrast multiplier (e.g. 1.3)
  brightness?: number     // Brightness offset (e.g. 10)
  binarize?: boolean      // Threshold to black & white
  sharpen?: boolean       // Apply 3x3 sharpening kernel
  autoCropMargin?: boolean// Crop empty dark margins around receipt
}

/**
 * Lakukan prarekayasa gambar (image preprocessing) gaya OpenCV:
 * - Grayscale conversion
 * - Contrast & brightness adjustment
 * - Sharpening filter
 * - Binarization / adaptive thresholding
 * - Auto-crop margin detection
 *
 * @param imageSource - File, Blob, Data URL, atau HTMLImageElement
 * @param options - Parameter prarekayasa
 */
export async function preprocessImage(
  imageSource: File | Blob | string | HTMLImageElement,
  options: PreprocessOptions = {},
): Promise<{ canvas: HTMLCanvasElement; dataUrl: string }> {
  const {
    contrast = 1.4,
    brightness = 5,
    binarize = false,
    sharpen = true,
    autoCropMargin = true,
  } = options

  // Load image into HTMLImageElement
  const img = await loadImage(imageSource)

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  if (!ctx) {
    throw new Error('Gagal mendapatkan 2D context canvas')
  }

  canvas.width = img.width
  canvas.height = img.height
  ctx.drawImage(img, 0, 0)

  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  let data = imageData.data

  // 1. Grayscale & Contrast Enhancement
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    // Luminance formula (OpenCV standard)
    let gray = 0.299 * r + 0.587 * g + 0.114 * b

    // Contrast stretching
    gray = (gray - 128) * contrast + 128 + brightness
    gray = Math.max(0, Math.min(255, gray))

    if (binarize) {
      // Thresholding to high-contrast B&W
      gray = gray > 140 ? 255 : 0
    }

    data[i] = gray
    data[i + 1] = gray
    data[i + 2] = gray
  }

  ctx.putImageData(imageData, 0, 0)

  // 2. Sharpen Filter (3x3 kernel convolution)
  if (sharpen) {
    imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const sharpenedData = applySharpenFilter(imageData, canvas.width, canvas.height)
    ctx.putImageData(sharpenedData, 0, 0)
  }

  // 3. Auto-crop dark/empty margins (Perspective/Boundary detection)
  if (autoCropMargin && canvas.width > 200 && canvas.height > 200) {
    const croppedCanvas = autoCropReceiptCanvas(canvas)
    const dataUrl = croppedCanvas.toDataURL('image/jpeg', 0.92)
    return { canvas: croppedCanvas, dataUrl }
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
  return { canvas, dataUrl }
}

/** Utility untuk memuat image source menjadi HTMLImageElement */
function loadImage(source: File | Blob | string | HTMLImageElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (source instanceof HTMLImageElement) {
      if (source.complete) return resolve(source)
      source.onload = () => resolve(source)
      source.onerror = (e) => reject(e)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'

    if (typeof source === 'string') {
      img.src = source
    } else {
      img.src = URL.createObjectURL(source)
    }

    img.onload = () => resolve(img)
    img.onerror = (err) => reject(err)
  })
}

/** Terapkan 3x3 Sharpen Kernel convolution pada ImageData */
function applySharpenFilter(imageData: ImageData, width: number, height: number): ImageData {
  const src = imageData.data
  const output = new ImageData(width, height)
  const dst = output.data

  // Sharpen kernel: [0, -1, 0, -1, 5, -1, 0, -1, 0]
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0]

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4
      let r = 0, g = 0, b = 0

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const kVal = kernel[(ky + 1) * 3 + (kx + 1)]
          const pIdx = ((y + ky) * width + (x + kx)) * 4
          r += src[pIdx] * kVal
          g += src[pIdx + 1] * kVal
          b += src[pIdx + 2] * kVal
        }
      }

      dst[idx] = Math.max(0, Math.min(255, r))
      dst[idx + 1] = Math.max(0, Math.min(255, g))
      dst[idx + 2] = Math.max(0, Math.min(255, b))
      dst[idx + 3] = src[idx + 3]
    }
  }

  return output
}

/** Auto-crop canvas berdasarkan deteksi batas kertas nota */
function autoCropReceiptCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const width = canvas.width
  const height = canvas.height
  const imgData = ctx.getImageData(0, 0, width, height)
  const data = imgData.data

  let minX = width, minY = height, maxX = 0, maxY = 0
  let foundPixel = false

  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const idx = (y * width + x) * 4
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
      // Pixels that are not pitch black margin
      if (brightness > 45) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
        foundPixel = true
      }
    }
  }

  if (!foundPixel || maxX - minX < 100 || maxY - minY < 100) {
    return canvas
  }

  const cropWidth = maxX - minX
  const cropHeight = maxY - minY

  const croppedCanvas = document.createElement('canvas')
  croppedCanvas.width = cropWidth
  croppedCanvas.height = cropHeight

  const cropCtx = croppedCanvas.getContext('2d')
  if (cropCtx) {
    cropCtx.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)
    return croppedCanvas
  }

  return canvas
}

// ─────────────────────────────────────────────────────────────────────────────
// Regex & NLP Parser for Indonesian Receipt Formats
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ekstrak field struktur dari teks mentah OCR.
 *
 * BR-OCR-03..05: Melakukan pencocokan pola RegEx untuk:
 * - Nama Toko / Merchant (baris atas)
 * - Tanggal Transaksi
 * - Nominal Total / Subtotal
 * - Nomor Nota / Invoice
 * - Daftar Baris Item Barang
 *
 * @param rawText - teks mentah hasil ekstraksi OCR
 */
export function extractFieldsFromRawText(rawText: string): {
  namaToko: string
  tanggal: string | null
  receiptNumber: string | null
  nominal: number
  items: ReceiptItem[]
  confidence: number
  status: StatusOcr
} {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  // 1. DYNAMIC NAMA TOKO / MERCHANT EXTRACTOR (Berlaku Universal untuk Semua Toko/App)
  let namaToko = 'Toko Tidak Terbaca'
  const headerIgnoreRegex = /^(nota|faktur|receipt|inv|invoice|selamat|terima|kasir|tanggal|detail|ringkasan|pembayaran|berhasil|transaksi|struk|bukti|metode|sumber)/i

  // 1a. Cek jika ada label eksplisit (misal: "Penyedia Jasa: Toko ABC", "Merchant: Kopi Kenangan", "Nama Toko: Gramedia")
  for (const line of lines) {
    const explicitMatch = line.match(/(?:penyedia jasa|merchant|nama toko|toko|outlet|penerima|merchant name)[\s:]+(.+)/i)
    if (explicitMatch && explicitMatch[1].trim().length >= 2) {
      namaToko = explicitMatch[1].replace(/[^a-zA-Z0-9\s.&/-]/g, '').trim()
      break
    }
  }

  // 1b. Jika tidak ada label eksplisit, cari baris teratas yang berisi nama brand/toko
  if (namaToko === 'Toko Tidak Terbaca') {
    for (let i = 0; i < Math.min(lines.length, 8); i++) {
      const line = lines[i]
      const cleanLine = line.replace(/[^a-zA-Z0-9\s.&/-]/g, '').trim()

      // Lewati baris kosong, angka murni, atau kata header generik
      if (
        cleanLine.length >= 3 &&
        !/^\d+$/.test(cleanLine) &&
        !headerIgnoreRegex.test(cleanLine) &&
        !/^rp\.?\s*\d+/i.test(cleanLine)
      ) {
        // Ambil baris nama toko
        namaToko = cleanLine
        break
      }
    }
  }

  // 2. DYNAMIC TANGGAL TRANSAKSI EXTRACTOR (Mendukung semua format tanggal Indonesia & ISO)
  let tanggal: string | null = null
  const dateRegex = /(\d{1,2})[/\-.\s]([a-zA-Z0-9]{2,9})[/\-.\s](\d{2,4})/
  const isoDateRegex = /(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/

  for (const line of lines) {
    const isoMatch = line.match(isoDateRegex)
    if (isoMatch) {
      const y = isoMatch[1]
      const m = String(isoMatch[2]).padStart(2, '0')
      const d = String(isoMatch[3]).padStart(2, '0')
      tanggal = `${y}-${m}-${d}`
      break
    }

    const dateMatch = line.match(dateRegex)
    if (dateMatch) {
      const d = String(dateMatch[1]).padStart(2, '0')
      let mStr = dateMatch[2].toLowerCase()
      let y = dateMatch[3]
      if (y.length === 2) y = '20' + y

      const monthMap: Record<string, string> = {
        jan: '01', januari: '01', feb: '02', februari: '02', mar: '03', maret: '03',
        apr: '04', april: '04', mei: '05', jun: '06', juni: '06', jul: '07', juli: '07',
        agu: '08', agustus: '08', ags: '08', sep: '09', september: '09', okt: '10', oktober: '10',
        nov: '11', november: '11', des: '12', desember: '12',
      }

      const m = monthMap[mStr] || (isNaN(Number(mStr)) ? '01' : String(mStr).padStart(2, '0'))
      tanggal = `${y}-${m}-${d}`
      break
    }
  }

  // 3. DYNAMIC NOMOR NOTA / INVOICE / REF EXTRACTOR
  let receiptNumber: string | null = null
  const invoiceRegex = /(?:inv|invoice|nota|faktur|no|no\.|ref|reff|trx|bill|id|order)[\s#.:]*([a-zA-Z0-9\-/]{4,})/i
  for (const line of lines) {
    const match = line.match(invoiceRegex)
    if (match && match[1] && match[1].length >= 4 && !/^(tanggal|jam|total|rupiah)/i.test(match[1])) {
      receiptNumber = match[1].toUpperCase()
      break
    }
  }

  // 4. DYNAMIC NOMINAL TOTAL EXTRACTOR
  let nominal = 0
  const totalKeywords = ['total', 'grand total', 'jumlah', 'bayar', 'cash', 'net', 'tagihan', 'total pembayaran', 'total transaksi', 'nominal transaksi']
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    const lower = line.toLowerCase()
    if (totalKeywords.some((kw) => lower.includes(kw))) {
      const numericMatch = line.match(/(?:rp|idr)?[\s.]*([\d.,]+)/i)
      if (numericMatch) {
        const cleanNum = numericMatch[1].replace(/\./g, '').replace(/,/g, '.')
        const val = parseFloat(cleanNum)
        if (!isNaN(val) && val > 0) {
          nominal = val
          break
        }
      }
    }
  }

  // Fallback: Max numeric value in lower half of lines
  if (nominal === 0) {
    let maxVal = 0
    for (const line of lines.slice(Math.floor(lines.length / 2))) {
      const matches = line.match(/([\d.,]{4,})/g)
      if (matches) {
        for (const m of matches) {
          const val = parseFloat(m.replace(/\./g, '').replace(/,/g, '.'))
          if (!isNaN(val) && val > maxVal && val < 100000000) {
            maxVal = val
          }
        }
      }
    }
    nominal = maxVal
  }

  // 5. Extract Itemized Lines
  const items: ReceiptItem[] = []
  let itemIndex = 0

  for (const line of lines) {
    if (
      totalKeywords.some((kw) => line.toLowerCase().includes(kw)) ||
      line.toLowerCase().includes('kembali') ||
      line.toLowerCase().includes('pajak')
    ) {
      continue
    }

    const itemMatch = line.match(/^(.+?)\s+(\d+)\s+[xX*]?\s*([\d.,]+)\s+([\d.,]+)$/)
    if (itemMatch) {
      const name = itemMatch[1].trim()
      const qty = parseInt(itemMatch[2], 10) || 1
      const price = parseFloat(itemMatch[3].replace(/\./g, '').replace(/,/g, '.')) || 0
      const subtotal = parseFloat(itemMatch[4].replace(/\./g, '').replace(/,/g, '.')) || qty * price

      if (name.length > 2 && subtotal > 0) {
        items.push({
          namaBarang: name,
          qty,
          harga: price,
          subtotal,
          urutan: itemIndex++,
          name,
          price,
          total: subtotal,
        })
      }
    }
  }

  // 6. Calculate Confidence & Status (BR-OCR-03..05)
  const confidence = calculateOcrConfidence({
    namaToko,
    nominal,
    tanggal,
    receiptNumber,
    items,
  })

  const status = evaluateOcrStatus(confidence)

  return {
    namaToko,
    tanggal,
    receiptNumber,
    nominal,
    items,
    confidence,
    status,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Full End-to-End OCR Pipeline Execution
// ─────────────────────────────────────────────────────────────────────────────

export interface ProcessOcrOptions {
  preprocess?: boolean
  language?: 'ind' | 'eng' | 'ind+eng'
  apiFallbackUrl?: string
}

export const ocrService = {
  /**
   * Jalankan pipeline OCR penuh (Prarekayasa Gambar → Engine OCR Tesseract WASM → NLP Field Extractor).
   *
   * @param imageSource - File, Blob, Data URL, atau HTMLImageElement
   * @param options     - Opsi prarekayasa & OCR engine
   */
  async processOcrImage(
    imageSource: File | Blob | string | HTMLImageElement,
    options: ProcessOcrOptions = {},
  ): Promise<OcrResult> {
    const { preprocess = true, language = 'ind+eng', apiFallbackUrl = '/api/ocr' } = options

    let finalImageSource: string | HTMLCanvasElement =
      typeof imageSource === 'string' ? imageSource : ''

    // 1. Prarekayasa Gambar (OpenCV contrast & sharpening)
    if (preprocess) {
      try {
        const prep = await preprocessImage(imageSource, {
          contrast: 1.4,
          sharpen: true,
          autoCropMargin: true,
        })
        finalImageSource = prep.canvas
      } catch (err) {
        console.warn('[Notabase OCR] Preprocessing canvas warning, using raw image:', err)
      }
    }

    let rawText = ''

    // 2. Jalankan Client-Side WASM OCR Engine (Tesseract.js / ONNX)
    try {
      console.log('[Notabase OCR] Running client-side Tesseract WASM engine...')
      const worker = await createWorker(language)
      const ret = await worker.recognize(
        finalImageSource || (imageSource as any),
      )
      rawText = ret.data.text
      await worker.terminate()
    } catch (wasmErr) {
      console.warn('[Notabase OCR] Client-side WASM OCR failed, attempting API fallback:', wasmErr)
      // 3. Fallback ke Server API OCR (Gemini / Supabase Edge)
      if (apiFallbackUrl) {
        try {
          const formData = new FormData()
          if (imageSource instanceof File || imageSource instanceof Blob) {
            formData.append('file', imageSource)
          } else if (typeof imageSource === 'string') {
            formData.append('imageUrl', imageSource)
          }

          const res = await fetch(apiFallbackUrl, {
            method: 'POST',
            body: formData,
          })
          const data = await res.json()
          if (res.ok && data.rawText) {
            rawText = data.rawText
          }
        } catch (apiErr) {
          console.error('[Notabase OCR] Server API OCR fallback failed:', apiErr)
        }
      }
    }

    // 4. Ekstrak Field Struktur & Confidence (BR-OCR-03..06)
    const extracted = extractFieldsFromRawText(rawText)

    return {
      receiptNumber: extracted.receiptNumber,
      namaToko: extracted.namaToko,
      tanggal: extracted.tanggal,
      nominal: extracted.nominal,
      keterangan: null,
      items: extracted.items,
      ocrRawText: rawText,
      confidence: extracted.confidence,
      status: extracted.status as 'berhasil' | 'perlu_review' | 'gagal',
      isReceipt: extracted.confidence >= 40,

      // Deprecated Aliases
      merchantName: extracted.namaToko,
      invoiceNumber: extracted.receiptNumber,
      transactionDate: extracted.tanggal,
      total: extracted.nominal,
      ocrText: rawText,
    }
  },
}
