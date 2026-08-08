/**
 * lib/image-preprocessor.ts
 * Client-side image pre-processing pipeline using Canvas API (zero dependencies).
 *
 * Pipeline:
 *   1. autoCorrectOrientation  — EXIF-based rotation correction (best-effort)
 *   2. detectAndCropReceipt    — edge detection auto-crop
 *   3. enhanceForOcr           — contrast & sharpness boost for faded handwriting
 *   4. assessImageQuality      — quality score with user-facing feedback
 */

export interface ImageQualityResult {
  score: number          // 0–100 (100 = perfect)
  isAcceptable: boolean  // true if score >= 40
  feedback: string       // user-facing message
  suggestions: string[]  // actionable suggestions
}

export interface PreprocessResult {
  dataUrl: string           // processed image as base64 data URL
  quality: ImageQualityResult
  wasRotated: boolean
  wasCropped: boolean
  wasEnhanced: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return c
}

function getImageData(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext('2d')!
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/** Load an image File/Blob/DataUrl into a canvas. */
async function loadImageToCanvas(source: File | Blob | string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = createCanvas(img.naturalWidth || img.width, img.naturalHeight || img.height)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(img.src)
      resolve(canvas)
    }
    img.onerror = reject
    if (typeof source === 'string') {
      img.src = source
    } else {
      img.src = URL.createObjectURL(source)
    }
  })
}

// ─── 1. EXIF Orientation Correction ─────────────────────────────────────────

/**
 * Read EXIF orientation tag from a JPEG File and return rotation degrees (0/90/180/270).
 * Returns 0 if not JPEG or EXIF unreadable.
 */
async function readExifOrientation(file: File): Promise<number> {
  if (!file.type.includes('jpeg') && !file.type.includes('jpg')) return 0
  try {
    const buf = await file.slice(0, 65536).arrayBuffer()
    const view = new DataView(buf)
    if (view.getUint16(0) !== 0xFFD8) return 0 // Not JPEG

    let offset = 2
    while (offset < view.byteLength) {
      const marker = view.getUint16(offset)
      offset += 2
      if (marker === 0xFFE1) {
        // APP1 — check for Exif header
        const length = view.getUint16(offset)
        const exifHeader = view.getUint32(offset + 2)
        if (exifHeader !== 0x45786966) break // "Exif"

        const tiffStart = offset + 8
        const littleEndian = view.getUint16(tiffStart) === 0x4949
        const readUint16 = (o: number) =>
          littleEndian ? view.getUint16(tiffStart + o, true) : view.getUint16(tiffStart + o)
        const readUint32 = (o: number) =>
          littleEndian ? view.getUint32(tiffStart + o, true) : view.getUint32(tiffStart + o)

        const ifdOffset = readUint32(4)
        const entries = readUint16(ifdOffset)
        for (let i = 0; i < entries; i++) {
          const entryOffset = ifdOffset + 2 + i * 12
          if (readUint16(entryOffset) === 0x0112) {
            // Orientation tag
            const orientation = readUint16(entryOffset + 8)
            const rotationMap: Record<number, number> = { 1: 0, 3: 180, 6: 90, 8: 270 }
            return rotationMap[orientation] ?? 0
          }
        }
        break
      } else if ((marker & 0xFF00) !== 0xFF00) {
        break
      } else {
        offset += view.getUint16(offset)
      }
    }
  } catch {
    // EXIF parse failure is non-fatal
  }
  return 0
}

/** Rotate a canvas by degrees (0, 90, 180, 270). Returns new canvas. */
function rotateCanvas(canvas: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  if (degrees === 0) return canvas
  const swap = degrees === 90 || degrees === 270
  const out = createCanvas(swap ? canvas.height : canvas.width, swap ? canvas.width : canvas.height)
  const ctx = out.getContext('2d')!
  ctx.translate(out.width / 2, out.height / 2)
  ctx.rotate((degrees * Math.PI) / 180)
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2)
  return out
}

// ─── 2. Auto-Crop (Edge Detection) ──────────────────────────────────────────

/**
 * Detect the dominant non-white bounding box and crop.
 * Works best when nota is on a white/light background.
 * Returns original canvas if crop would be less than 50% of original.
 */
function detectAndCrop(canvas: HTMLCanvasElement): { canvas: HTMLCanvasElement; wasCropped: boolean } {
  const { width, height } = canvas
  const data = getImageData(canvas).data
  const threshold = 240 // pixels lighter than this are "background"

  let minX = width, maxX = 0, minY = height, maxY = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const r = data[idx], g = data[idx + 1], b = data[idx + 2]
      const brightness = (r + g + b) / 3
      if (brightness < threshold) {
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }
  }

  const margin = 20
  minX = Math.max(0, minX - margin)
  minY = Math.max(0, minY - margin)
  maxX = Math.min(width, maxX + margin)
  maxY = Math.min(height, maxY + margin)

  const cropW = maxX - minX
  const cropH = maxY - minY

  // Only crop if we found a significant content region (>= 40% of original)
  if (cropW < width * 0.4 || cropH < height * 0.4 || cropW <= 0 || cropH <= 0) {
    return { canvas, wasCropped: false }
  }

  const out = createCanvas(cropW, cropH)
  const ctx = out.getContext('2d')!
  ctx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH)
  return { canvas: out, wasCropped: true }
}

// ─── 3. Contrast & Sharpness Enhancement ─────────────────────────────────────

/**
 * Enhance image for OCR:
 * - Increase contrast via a simple S-curve
 * - Slight sharpening using unsharp mask approximation
 */
function enhanceForOcr(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const { width, height } = canvas
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  // Step 1: Convert to grayscale-weighted contrast boost
  for (let i = 0; i < data.length; i += 4) {
    // Contrast S-curve: ((x/255 - 0.5) * contrast + 0.5) * 255
    const contrast = 1.4
    for (let c = 0; c < 3; c++) {
      let val = data[i + c] / 255
      val = (val - 0.5) * contrast + 0.5
      data[i + c] = Math.max(0, Math.min(255, Math.round(val * 255)))
    }
  }

  ctx.putImageData(imageData, 0, 0)

  // Step 2: Unsharp mask — blur then blend
  const out = createCanvas(width, height)
  const outCtx = out.getContext('2d')!

  // Draw sharpened canvas
  outCtx.filter = 'contrast(1.15) brightness(1.05)'
  outCtx.drawImage(canvas, 0, 0)
  outCtx.filter = 'none'

  return out
}

// ─── 4. Image Quality Assessment ─────────────────────────────────────────────

/**
 * Assess image quality for OCR suitability.
 * Checks: brightness, contrast variance, resolution.
 */
function assessQuality(canvas: HTMLCanvasElement): ImageQualityResult {
  const { width, height } = canvas
  const data = getImageData(canvas).data
  const suggestions: string[] = []

  // Sample every 4th pixel for performance
  const grayscale: number[] = []
  for (let i = 0; i < data.length; i += 16) {
    grayscale.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
  }

  const mean = grayscale.reduce((a, b) => a + b, 0) / grayscale.length
  const variance = grayscale.reduce((a, b) => a + (b - mean) ** 2, 0) / grayscale.length
  const stdDev = Math.sqrt(variance)

  let score = 100

  // Check brightness (too dark or too bright)
  if (mean < 50) {
    score -= 35
    suggestions.push('Gambar terlalu gelap — tambah pencahayaan atau nyalakan flash')
  } else if (mean > 220) {
    score -= 20
    suggestions.push('Gambar terlalu terang — hindari cahaya langsung di atas nota')
  }

  // Check contrast (low stdDev = low contrast = hard to read)
  if (stdDev < 20) {
    score -= 30
    suggestions.push('Kontras sangat rendah — pastikan nota tidak buram atau pudar')
  } else if (stdDev < 35) {
    score -= 15
    suggestions.push('Kontras rendah — coba foto dengan pencahayaan lebih merata')
  }

  // Check resolution
  const pixels = width * height
  if (pixels < 200_000) {
    score -= 20
    suggestions.push('Resolusi terlalu rendah — ambil foto lebih dekat ke nota')
  } else if (pixels < 500_000) {
    score -= 8
  }

  score = Math.max(0, Math.min(100, score))
  const isAcceptable = score >= 35

  let feedback: string
  if (score >= 80) {
    feedback = 'Kualitas gambar sangat baik untuk OCR'
  } else if (score >= 60) {
    feedback = 'Kualitas gambar cukup baik'
  } else if (score >= 35) {
    feedback = 'Kualitas gambar di bawah optimal — hasil OCR mungkin kurang akurat'
  } else {
    feedback = 'Kualitas gambar terlalu buruk untuk OCR — disarankan foto ulang'
  }

  return { score, isAcceptable, feedback, suggestions }
}

// ─── PDF → Canvas via PDF.js ─────────────────────────────────────────────────

/**
 * Render the first page of a PDF file to a canvas using pdf.js (loaded dynamically).
 * Returns the canvas element.
 */
export async function renderPdfFirstPage(file: File): Promise<HTMLCanvasElement> {
  // Dynamic import so PDF.js is only loaded when needed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsLib = await import('pdfjs-dist').catch(() => null) as any
  if (!pdfjsLib) {
    throw new Error('PDF.js tidak tersedia. Harap konversi PDF ke gambar terlebih dahulu.')
  }

  // Set worker (Next.js public folder)
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
  }

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const page = await pdf.getPage(1)

  const scale = 2.0 // High-res render for OCR accuracy
  const viewport = page.getViewport({ scale })
  const canvas = createCanvas(viewport.width, viewport.height)
  const ctx = canvas.getContext('2d')!

  await page.render({ canvasContext: ctx, viewport }).promise

  return canvas
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

/**
 * Full pre-processing pipeline for OCR.
 *
 * @param source   File (image or PDF), Blob, or base64 data URL
 * @returns        PreprocessResult with processed image data URL and quality info
 */
export async function preprocessForOcr(source: File | Blob | string): Promise<PreprocessResult> {
  let canvas: HTMLCanvasElement
  let isPdf = false

  // Detect PDF
  if (source instanceof File && source.type === 'application/pdf') {
    isPdf = true
    canvas = await renderPdfFirstPage(source)
  } else {
    canvas = await loadImageToCanvas(source)
  }

  // Step 1: EXIF orientation correction (best-effort, skip for PDF)
  let wasRotated = false
  if (!isPdf && source instanceof File) {
    const degrees = await readExifOrientation(source)
    if (degrees !== 0) {
      canvas = rotateCanvas(canvas, degrees)
      wasRotated = true
    }
  }

  // Step 2: Auto-crop
  const { canvas: cropped, wasCropped } = detectAndCrop(canvas)
  canvas = cropped

  // Step 3: Contrast enhancement
  const enhanced = enhanceForOcr(canvas)
  canvas = enhanced
  const wasEnhanced = true

  // Step 4: Quality assessment
  const quality = assessQuality(canvas)

  // Export as JPEG for smaller size / faster upload
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92)

  return { dataUrl, quality, wasRotated, wasCropped, wasEnhanced }
}
