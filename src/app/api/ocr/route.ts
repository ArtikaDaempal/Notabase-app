import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { readFile } from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db'
import type { OcrResult, ReceiptItem } from '@/types'
import { getOcrStatus } from '@/lib/rules/ocr-rules'
import { isValidInvoiceNumber, isValidAddress, isValidPhone, extractPhoneFromOcr, extractAddressFromOcr } from '@/lib/utils'

// Global cache to speed up subsequent requests by reusing the working model
let cachedWorkingModel: string | null = null

/** Returns YYYY-MM-DD date string or null */
function parseDate(text: string): string | null {
  const patterns = [
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/,
    /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/,
    /(\d{1,2})\s+(jan|feb|mar|apr|mei|jun|jul|agu|ags|sep|okt|nov|des)[a-z]*\s+(\d{4})/i,
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m) {
      try {
        let d: Date
        if (m[0].match(/^\d{4}/)) {
          d = new Date(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`)
        } else if (m[0].match(/^[a-z]{3}/i)) {
          const monthMap: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, jun: 5, jul: 6, agu: 7, ags: 7, sep: 8, okt: 9, nov: 10, des: 11 }
          const mon = monthMap[m[2].toLowerCase().slice(0, 3)]
          if (mon === undefined) continue
          d = new Date(Number(m[3]), mon, Number(m[1]))
        } else {
          const day = Number(m[1])
          const mon = Number(m[2]) - 1
          const year = Number(m[3])
          d = new Date(year, mon, day)
        }
        // Return YYYY-MM-DD (04-database-schema.md §2: kolom tanggal adalah DATE)
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
      } catch {
        // ignore parse errors
      }
    }
  }
  return null
}

function parseTotal(text: string): number {
  const totalLineMatch = text.match(/total[^0-9]{0,10}(rp\.?\s*)?([\d.]+(?:,\d{2})?)/i)
  const candidates: number[] = []
  if (totalLineMatch) {
    const num = parseFloat(totalLineMatch[2].replace(/\./g, '').replace(',', '.'))
    if (!isNaN(num)) candidates.push(num)
  }
  const allMatches = text.matchAll(/(?:rp\.?\s*)?(\d{1,3}(?:[.\s]\d{3})+(?:,\d{2})?)/gi)
  for (const m of allMatches) {
    const raw = m[1].replace(/\./g, '').replace(/\s/g, '').replace(',', '.')
    const num = parseFloat(raw)
    if (!isNaN(num) && num > 100) candidates.push(num)
  }
  if (candidates.length) return Math.max(...candidates)
  return 0
}

/**
 * Smart total parser that avoids picking up phone numbers or reference numbers as total.
 * Prefers amounts in range 1,000 - 999,999,999 (typical Indonesian payment amounts).
 */
function parseTotalSmart(text: string): number {
  const candidates: number[] = []

  // Priority 1: Look for explicit total/jumlah/dibayar labels
  const priorityPatterns = [
    /(?:total\s*(?:pembayaran|transaksi|bayar)?|jumlah\s*(?:dibayar|transaksi|bayar|tagihan)?|dibayar|tagihan|yang\s*dibayar|nominal|amount)[^\d]{0,15}rp\.?\s*([\d.]+(?:,\d{2})?)/gi,
    /rp\.?\s*([\d.]+(?:,\d{2})?)\s*(?:total|dibayar|tagihan)/gi,
  ]

  for (const pattern of priorityPatterns) {
    const matches = [...text.matchAll(pattern)]
    for (const m of matches) {
      const raw = (m[1] || '').replace(/\./g, '').replace(',', '.')
      const num = parseFloat(raw)
      // Valid payment range: Rp 1.000 - Rp 999.999.999
      if (!isNaN(num) && num >= 1000 && num < 1_000_000_000) {
        candidates.push(num)
      }
    }
  }

  if (candidates.length > 0) {
    // Return the maximum of priority candidates (most likely total)
    return Math.max(...candidates)
  }

  // Priority 2: All Rp amounts in typical payment range
  const allRp = [...text.matchAll(/rp\.?\s*([\d.]+(?:,\d{2})?)/gi)]
  for (const m of allRp) {
    const raw = m[1].replace(/\./g, '').replace(',', '.')
    const num = parseFloat(raw)
    if (!isNaN(num) && num >= 1000 && num < 1_000_000_000) {
      candidates.push(num)
    }
  }

  if (candidates.length > 0) return Math.max(...candidates)
  return 0
}

/**
 * Detect bank/payment app name from OCR text as fallback when Gemini fails to extract it.
 * IMPORTANT: Only used when Gemini's extracted namaToko is empty/invalid.
 * Patterns are ordered from most specific to least specific.
 * DANA requires strong context (app-specific phrases) to avoid false positives
 * since "dana" is a common Indonesian word meaning "funds".
 */
function detectBankOrPaymentProvider(text: string): string | null {
  if (!text) return null

  // 1. First priority: Extract specific institution / payee name from Livin Mandiri or Bank receipt details
  const namaInstansiMatch = text.match(/nama\s+([A-Z0-9\s()./-]{3,50}?)(?:\s+no\.|\s+tagihan|\s+periode|\s+admin|\s+transaksi|\s+sumber|\s+bank|$)/i)
  if (namaInstansiMatch && namaInstansiMatch[1]?.trim()) {
    const candidate = namaInstansiMatch[1].trim()
    const invalidList = ['bank', 'mandiri', 'ref', 'referensi', 'transaksi', 'pembayaran', 'berhasil', 'sumber', 'dana', 'bca', 'bri', 'bni', 'bsi']
    if (!invalidList.includes(candidate.toLowerCase())) {
      if (/telkom/i.test(text) && !candidate.toLowerCase().includes('telkom')) {
        return `Telkom - ${candidate}`
      }
      return candidate
    }
  }

  const penyediaMatch = text.match(/penyedia\s+jasa[\s\S]{0,50}?([A-Z][a-zA-Z0-9\s()./-]{2,35})/i)
  if (penyediaMatch && penyediaMatch[1]?.trim()) {
    return penyediaMatch[1].trim()
  }

  // High-specificity patterns first (multi-word bank/app names)
  const providers: [RegExp, string][] = [
    [/\blivin\s*by\s*mandiri\b/i, 'Livin by Mandiri'],
    [/\bmandiri\s*livin\b/i, 'Livin by Mandiri'],
    [/\bbank\s*mandiri\b/i, 'Bank Mandiri'],
    [/\bbca\s*mobile\b|\bbank\s*central\s*asia\b/i, 'BCA Mobile'],
    [/\bbrimo\b|\bbank\s*rakyat\s*indonesia\b/i, 'BRImo - BRI'],
    [/\bbsi\s*mobile\b|\bbank\s*syariah\s*indonesia\b/i, 'BSI Mobile'],
    [/\bbni\s*mobile\b|\bbank\s*negara\s*indonesia\b/i, 'BNI Mobile'],
    [/\bgopay\b|\bgojek\b/i, 'GoPay'],
    [/\bshopeepay\b|\bshopee\s*pay\b/i, 'ShopeePay'],
    [/\blinkaja\b/i, 'LinkAja'],
    [/\bindihome\b|\btelkomsel\b/i, 'Telkom/Indihome'],
    [/\btokopedia\b/i, 'Tokopedia'],
    [/\bshopee\b/i, 'Shopee'],
    [/\bbukalapak\b/i, 'Bukalapak'],
    [/\bindomaret\b/i, 'Indomaret'],
    [/\balfamart\b/i, 'Alfamart'],
    [/\bovo\b/i, 'OVO'],
    [/\bpln\b/i, 'PLN'],
    [/\bbpjs\b/i, 'BPJS'],
  ]

  for (const [pattern, name] of providers) {
    if (pattern.test(text)) return name
  }

  // DANA requires app-specific context to avoid false positives.
  if (/\bdana\s*(id|premium|kaget|pay|digital|wallet|saldo|top[\s-]?up)\b/i.test(text) ||
      /\b(top[\s-]?up|saldo|isi\s*ulang|transfer\s*(ke|dari))\s*dana\b/i.test(text) ||
      /\b(aplikasi|app|via|melalui|dari|ke)\s*dana\b/i.test(text)) {
    return 'DANA'
  }

  return null
}

function parseInvoice(text: string): string | null {
  if (!text) return null

  // Helper: given a raw matched string, strip spaces and validate
  const clean = (raw: string): string | null => {
    // Remove leading/trailing junk, collapse internal spaces (OCR splits like "INV7380... 89")
    const c = raw.replace(/^[#:\s]+/, '').replace(/\s+/g, '').trim()
    return isValidInvoiceNumber(c) ? c : null
  }

  // Labeled patterns — allow optional spaces inside the captured number for OCR splits
  const labeledPatterns: RegExp[] = [
    /\bno\.?\s*invoice\s*[:\s]\s*([A-Z0-9][A-Z0-9\s\-\/]{4,50})/i,
    /\binvoice\s*(?:no|number|num|nomor)\.?\s*[:\s]\s*([A-Z0-9][A-Z0-9\s\-\/]{4,50})/i,
    /\bnomor\s*(?:invoice|nota|faktur|kwitansi|transaksi)\.?\s*[:\s]\s*([A-Z0-9][A-Z0-9\s\-\/]{4,50})/i,
    /\bno\.?\s*nota\s*[:\s]\s*([A-Z0-9][A-Z0-9\s\-\/]{4,50})/i,
    /\bno\.?\s*faktur\s*[:\s]\s*([A-Z0-9][A-Z0-9\s\-\/]{4,50})/i,
    /\bno\.?\s*kwitansi\s*[:\s]\s*([A-Z0-9][A-Z0-9\s\-\/]{4,50})/i,
    /\bno\.?\s*ref(?:erensi)?\.?\s*[:\s]\s*([A-Z0-9][A-Z0-9\s\-\/]{5,50})/i,
    /\bno\.?\s*transaksi\.?\s*[:\s]\s*([A-Z0-9][A-Z0-9\s\-\/]{5,50})/i,
    /\breference\s*(?:no|number|num)?\.?\s*[:\s]\s*([A-Z0-9][A-Z0-9\s\-\/]{5,50})/i,
    /\btrx\s*(?:id|no|ref)?\.?\s*[:\s]\s*([A-Z0-9][A-Z0-9\s\-\/]{5,50})/i,
    /\border\s*(?:id|no|ref)?\.?\s*[:\s]\s*([A-Z0-9][A-Z0-9\s\-\/]{5,50})/i,
  ]

  // Try labeled patterns first (most reliable)
  for (const p of labeledPatterns) {
    const m = text.match(p)
    if (m && m[1]) {
      // Only take the first "word token" group (stop at newline or long whitespace)
      // OCR splits like "INV7380965045259999 89" — grab until non-invoice char
      const rawCapture = m[1].split(/\n/)[0].trim()
      // Allow up to one internal space (OCR split of a single long number)
      const result = clean(rawCapture)
      if (result) return result
    }
  }

  // Standalone prefix patterns — catch "INV738096..." anywhere in text
  const prefixPatterns: RegExp[] = [
    /\b(INV[A-Z0-9]{5,}\s?[A-Z0-9]{0,10})\b/i,
    /\b(TRX[A-Z0-9]{5,}\s?[A-Z0-9]{0,10})\b/i,
    /\b(ORD[A-Z0-9]{5,}\s?[A-Z0-9]{0,10})\b/i,
    /\b(REF[A-Z0-9]{5,}\s?[A-Z0-9]{0,10})\b/i,
    /\b(NTB[A-Z0-9]{5,}\s?[A-Z0-9]{0,10})\b/i,
  ]
  for (const p of prefixPatterns) {
    const m = text.match(p)
    if (m && m[1]) {
      const result = clean(m[1])
      if (result) return result
    }
  }

  return null
}

function parseItems(text: string): ReceiptItem[] {
  const items: ReceiptItem[] = []
  if (!text) return items

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  let urutan = 0

  const invalidNames = new Set([
    'BANYAKNYA', 'NAMA BARANG', 'HARGA', 'TOTAL', 'SUBTOTAL', 'GRAND TOTAL',
    'QTY', 'ITEM', 'JUMLAH', 'BAYAR', 'KEMBALI', 'KASIR', 'TANGGAL', 'NOTA',
    'TANDA TERIMA', 'HORMAT KAMI', 'TERIMA KASIH'
  ])

  for (const line of lines) {
    const upper = line.toUpperCase()
    if (invalidNames.has(upper) || /^(tanda|hormat|terima|total|subtotal|jumlah|bayar|kembali|cash|change)/i.test(line)) {
      continue
    }

    // Pattern 1: Qty ItemName UnitPrice Subtotal (e.g. "4 Nasi Paket ayam 40.000 160.000" or "4 Nasi 10.000 40.000")
    let m = line.match(/^(\d+)\s+(.+?)\s+([\d.]+)\s+([\d.]+)$/)
    if (m) {
      const qty = parseInt(m[1], 10)
      const namaBarang = m[2].trim()
      const harga = parseFloat(m[3].replace(/\./g, ''))
      const subtotal = parseFloat(m[4].replace(/\./g, ''))
      if (namaBarang && !invalidNames.has(namaBarang.toUpperCase()) && !isNaN(harga)) {
        items.push({
          namaBarang,
          qty,
          harga,
          subtotal: isNaN(subtotal) || subtotal === 0 ? qty * harga : subtotal,
          urutan: urutan++,
          name: namaBarang,
          price: harga,
          total: isNaN(subtotal) || subtotal === 0 ? qty * harga : subtotal,
        })
        continue
      }
    }

    // Pattern 2: ItemName Qty x UnitPrice Subtotal (e.g. "Nasi Paket Ayam 4 x 40.000 160.000")
    m = line.match(/^(.+?)\s+(\d+)\s*[xX@]\s*([\d.]+)(?:\s+([\d.]+))?$/)
    if (m) {
      const namaBarang = m[1].trim()
      const qty = parseInt(m[2], 10)
      const harga = parseFloat(m[3].replace(/\./g, ''))
      const subtotal = m[4] ? parseFloat(m[4].replace(/\./g, '')) : qty * harga
      if (namaBarang && !invalidNames.has(namaBarang.toUpperCase()) && !isNaN(harga)) {
        items.push({
          namaBarang,
          qty,
          harga,
          subtotal,
          urutan: urutan++,
          name: namaBarang,
          price: harga,
          total: subtotal,
        })
        continue
      }
    }

    // Pattern 3: Qty ItemName TotalPrice (e.g. "4 Air mineral 180.000" or "1 Paket Ayam 40.000")
    m = line.match(/^(\d+)\s+(.+?)\s+([\d.]{3,})$/)
    if (m) {
      const qty = parseInt(m[1], 10)
      const namaBarang = m[2].trim()
      const subtotal = parseFloat(m[3].replace(/\./g, ''))
      if (namaBarang && !invalidNames.has(namaBarang.toUpperCase()) && !isNaN(subtotal) && subtotal >= 100) {
        const harga = Math.round(subtotal / qty)
        items.push({
          namaBarang,
          qty,
          harga,
          subtotal,
          urutan: urutan++,
          name: namaBarang,
          price: harga,
          total: subtotal,
        })
        continue
      }
    }

    // Pattern 4: ItemName TotalPrice (Qty implied 1) (e.g. "Air mineral 180.000")
    m = line.match(/^([A-Za-z0-9\s/.-]{2,50})\s+([\d.]{3,})$/)
    if (m) {
      const namaBarang = m[1].trim()
      const subtotal = parseFloat(m[2].replace(/\./g, ''))
      if (namaBarang && !invalidNames.has(namaBarang.toUpperCase()) && !isNaN(subtotal) && subtotal >= 500 && !/^(total|subtotal|jumlah|bayar|kembali|cash|dp|pajak|diskon)/i.test(namaBarang)) {
        items.push({
          namaBarang,
          qty: 1,
          harga: subtotal,
          subtotal,
          urutan: urutan++,
          name: namaBarang,
          price: subtotal,
          total: subtotal,
        })
      }
    }
  }
  return items
}

function sanitizeItems(rawItems: any[], totalNominal: number): ReceiptItem[] {
  const invalidNames = new Set([
    'BANYAKNYA', 'NAMA BARANG', 'HARGA', 'TOTAL', 'SUBTOTAL', 'GRAND TOTAL',
    'QTY', 'ITEM', 'JUMLAH', 'BAYAR', 'KEMBALI', 'KASIR', 'TANGGAL', 'NOTA',
    'TANDA TERIMA', 'HORMAT KAMI', 'TERIMA KASIH', 'STAMP', 'CAP', 'PEMBELIAN'
  ])

  const sanitized: ReceiptItem[] = []

  rawItems.forEach((it: any, idx: number) => {
    let name = String(it.namaBarang ?? it.name ?? '').trim()

    // 1. Clean item name of price tokens, currency prefixes/suffixes (e.g. "Rp10.000 Biaya Layanan Rp" -> "Biaya Layanan")
    name = name
      .replace(/^(?:rp\.?\s*[\d.]*\s*)+/gi, '')
      .replace(/(?:\s*rp\.?\s*[\d.]*)+$/gi, '')
      .replace(/\s+\d+[\d.\s]*\s*(?:jumlah|rp|total|subtotal)?$/i, '')
      .replace(/\s+(?:jumlah|rp|total|subtotal)\.?$/i, '')
      .replace(/\b(?:rp|rupiah)\b/gi, '')
      .trim()

    // Skip bogus or header items
    const upperName = name.toUpperCase()
    if (!name || name.length < 2 || invalidNames.has(upperName) || /^(tanda|hormat|terima|total|subtotal|jumlah\s*rp|bayar|kembali|cash|stamp)$/i.test(name)) {
      return
    }

    let qty = Math.max(1, Math.round(Number(it.qty ?? 1)))
    let harga = Number(it.harga ?? it.price ?? 0)
    let subtotal = Number(it.subtotal ?? it.total ?? 0)

    // 2. Resolve Column Confusion:
    // If AI confused column 4 (JUMLAH line total e.g. 160000) with column 3 (HARGA unit price e.g. 40000)
    if (qty > 1) {
      if (harga > 0 && (harga === subtotal || Math.abs(harga * qty - subtotal) > subtotal * 0.5)) {
        if (harga === subtotal) {
          // harga was actually line total (e.g. 160000). Real unit price is 160000 / 4 = 40000!
          harga = Math.round(subtotal / qty)
        } else if (subtotal === qty * harga && totalNominal > 0 && subtotal > totalNominal) {
          // subtotal (640000) was inflated because harga was set to line total (160000)!
          subtotal = harga
          harga = Math.round(subtotal / qty)
        } else if (subtotal > 0 && Math.abs(harga * qty - subtotal) > 10) {
          harga = Math.round(subtotal / qty)
        }
      }
    }

    // Default calculations if 0
    if (subtotal === 0 && harga > 0) {
      subtotal = qty * harga
    } else if (harga === 0 && subtotal > 0) {
      harga = Math.round(subtotal / qty)
    }

    sanitized.push({
      namaBarang: name,
      qty,
      harga,
      subtotal,
      urutan: idx,
      name,
      price: harga,
      total: subtotal,
    })
  })

  return sanitized
}

// POST /api/ocr — analyze a receipt image using Gemini API directly
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { imageUrl, filename } = body as { imageUrl?: string; filename?: string }

  if (!imageUrl) {
    return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 })
  }

  // Load workspace settings from database
  const workspaceId = req.headers.get('x-workspace-id')
  let ocrLanguage = 'id'
  let ocrExtractItems = true

  if (workspaceId) {
    try {
      const { data: settingsData } = await db
        .from('app_settings')
        .select('key, value')
        .eq('workspace_id', workspaceId)

      if (settingsData) {
        settingsData.forEach((row) => {
          if (row.key === 'ocr_language') ocrLanguage = String(row.value)
          if (row.key === 'ocr_extract_items') ocrExtractItems = String(row.value) === 'true' || row.value === true
        })
      }
    } catch {}
  }

  const langDesc = ocrLanguage === 'en' ? 'Bahasa Inggris' : ocrLanguage === 'both' ? 'Bahasa Indonesia dan Bahasa Inggris (bilingual)' : 'Bahasa Indonesia'
  const itemsInstruction = ocrExtractItems
    ? 'Rincikan seluruh item barang/jasa, kuantitas, harga, dan subtotal ke dalam array "items".'
    : 'Set array "items" menjadi array kosong [] karena ekstraksi item dinonaktifkan.'

  // Read Gemini API Key from environment variables
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'API Key Google Gemini belum dikonfigurasi. Silakan tambahkan GEMINI_API_KEY="key_anda" di file .env Anda.' },
      { status: 400 }
    )
  }

  // Resolve the image to a base64 data URL
  let dataUrl = ''
  if (imageUrl.startsWith('data:')) {
    dataUrl = imageUrl
  } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    try {
      const res = await fetch(imageUrl)
      if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`)
      const buf = await res.arrayBuffer()
      const ext = imageUrl.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg'
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
      dataUrl = `data:${mime};base64,${Buffer.from(buf).toString('base64')}`
    } catch (err: any) {
      console.error('Fetch image error:', err)
      return NextResponse.json({ error: `Could not read remote image file: ${err.message}` }, { status: 404 })
    }
  } else {
    const localPath = imageUrl.replace(/^\/receipts\//, '')
    const filePath = path.join(process.cwd(), 'public', 'receipts', filename || localPath)
    try {
      const buf = await readFile(filePath)
      const ext = (filename || localPath).split('.').pop()?.toLowerCase() || 'jpg'
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
      dataUrl = `data:${mime};base64,${buf.toString('base64')}`
    } catch {
      return NextResponse.json({ error: 'Could not read image file' }, { status: 404 })
    }
  }

  // Prompt Gemini — field names sesuai skema Notabase v2 (04-database-schema.md)
  const prompt = `Kamu adalah sistem AI OCR presisi dan akurasi tinggi khusus membaca nota transaksi Indonesia. Kamu harus mampu memproses:
- Nota tulisan tangan di kertas polos / bergaris (kolom Banyaknya, Nama Barang, Harga, Jumlah)
- Struk kasir thermal minimarket (Indomaret, Alfamart) — header besar, barcode, kode produk, nama barang, harga
- Struk supermarket dengan banyak item
- Nota restoran — item, modifier, service charge, pajak restoran
- Struk toko kelontong, warung, percetakan, toko umum
- Struk kasir thermal yang pudar / kontras rendah
- Nota dengan cap/stempel toko yang menimpa sebagian tulisan
- Faktur, kuitansi, invoice resmi
- Screenshot e-wallet & mobile banking (BCA, Mandiri, BRI, BNI, GoPay, DANA, OVO, ShopeePay, Bukalapak, Tokopedia)
- Nota dengan 1 barang maupun 50+ barang
- Nota dengan atau tanpa alamat toko
- Nota dengan atau tanpa nomor telepon
- Nota dengan atau tanpa pajak
- Nota dengan atau tanpa diskon
- Nota dengan atau tanpa biaya tambahan

Prioritas Bahasa Utama: ${langDesc}
Ekstraksi Rincian Barang: ${ocrExtractItems ? 'Aktif' : 'Nonaktif'}

========================================
ATURAN IDENTIFIKASI FIELD NOTA
========================================

1. NAMA TOKO:
   - Biasanya ada di bagian ATAS nota (header)
   - Bisa berupa logo yang tertulis atau teks besar di baris pertama
   - JANGAN ambil nama kasir, alamat, slogan, atau nomor telepon sebagai nama toko
   - Jika tidak ada nama toko yang jelas, set null

2. ALAMAT TOKO:
   - Biasanya di bawah nama toko, berupa jalan/kelurahan/kota
   - Contoh: "Jl. Merdeka No. 10, Jakarta"
   - Jika tidak ada, set null — JANGAN MENGARANG

3. NOMOR TELEPON TOKO (noTelepon):
   - Cari label: "Telp.", "Tel.", "Telepon:", "Phone:", "HP:", "No. HP"
   - Format: 08xxxx, +628xxxx, (0xx) xxxx
   - PENTING: JANGAN gunakan nomor nota/referensi/order sebagai nomor telepon
   - PENTING: Nomor telepon biasanya 10-13 digit diawali 0 atau +62
   - Jika tidak ada, set null — JANGAN MENGARANG

4. NOMOR NOTA (receiptNumber):
   - Cari label: "No. Nota", "No. Invoice", "No. Faktur", "No. Ref", "No. Transaksi", "Invoice No.", "Order ID", "Receipt No", "Bill No"
   - JANGAN ambil nomor telepon sebagai nomor nota
   - Jika tidak ada label tersebut, set null

5. TANGGAL:
   - Format bervariasi: 15/08/2026, 15-08-2026, 15.08.2026, 15 AUG 2026, 15 AGU 2026
   - Normalisasi ke format YYYY-MM-DD
   - JIKA TIDAK DITEMUKAN, set null — JANGAN MENGGUNAKAN TANGGAL HARI INI

6. WAKTU:
   - Format: HH:MM atau HH:MM:SS
   - Jika tidak ada, set null

========================================
ATURAN DAFTAR BARANG
========================================

Format nota bervariasi, tangani semua format berikut:

Format A (Minimarket/Supermarket): Nama+Kode | Harga
  INDOMIE GRG AYAM    Rp  3.500
  → qty: 1, harga: 3500, subtotal: 3500

Format B (Qty x Harga = Subtotal):
  INDOMIE GORENG   2 x 3.500   7.000
  → qty: 2, harga: 3500, subtotal: 7000

Format C (Nota tulisan tangan 4 kolom: Qty | Nama Barang | Harga Satuan | Jumlah):
  4 | Nasi Paket ayam | 40.000 | 160.000
  → qty: 4, harga: 40000, subtotal: 160000

Format D (Qty + Nama + Total tanpa harga satuan):
  2 Aqua Botol     4.000
  → qty: 2, subtotal: 4000, harga: 2000 (dihitung)

Format E (Item + Total saja, qty = 1):
  Roti Tawar       8.000
  → qty: 1, harga: 8000, subtotal: 8000

ATURAN WAJIB DAFTAR BARANG:
1. "harga" = HARGA SATUAN per 1 item (bukan total baris)
2. "subtotal" = qty × harga (jumlah per baris)
3. "namaBarang" = nama barang SAJA, jangan campur dengan harga, kode produk, atau angka dari kolom lain
4. Nama barang multi-kata HARUS dipertahankan utuh: "INDOMIE GORENG SPECIAL" bukan "INDOMIE" saja
5. JANGAN batasi jumlah barang — ekstrak SEMUA barang yang ada
6. JANGAN masukkan baris TOTAL, SUBTOTAL, GRAND TOTAL, TANDA TERIMA, HORMAT KAMI, TERIMA KASIH sebagai barang
7. Jika qty tidak tercantum eksplisit, gunakan qty = 1

========================================
ATURAN RINGKASAN TRANSAKSI
========================================

1. SUBTOTAL (subtotalNominal):
   - Nilai sebelum diskon, pajak, dan biaya tambahan
   - Label: "Subtotal", "Sub Total", "Jumlah"
   - Jika tidak ada label subtotal terpisah, bisa dihitung dari sum(item.subtotal)
   - Jika tidak jelas, set null

2. DISKON:
   - Label: "Diskon", "Discount", "Potongan"
   - Bisa berupa nominal (Rp) atau persentase (%)
   - Jika tidak ada, set 0 (JANGAN mengarang diskon)

3. PAJAK:
   - Label: "PPN", "Pajak", "Tax"
   - Bisa berupa nominal atau persentase
   - Jika tidak ada, set 0 (JANGAN mengarang pajak)

4. BIAYA TAMBAHAN (biayaTambahan):
   - Label: "Service Charge", "Biaya Layanan", "Biaya Admin", "Admin Fee", "Payment Fee"
   - Simpan juga NAMA biaya tambahan tersebut di field "namaBiayaTambahan"
   - Jika tidak ada, set 0 dan namaBiayaTambahan: null

5. TOTAL / NOMINAL:
   - Label: "TOTAL", "GRAND TOTAL", "Total Pembayaran", "Jumlah Bayar"
   - Ini adalah nilai AKHIR yang dibayar pelanggan
   - JANGAN salah ambil harga barang sebagai total

6. METODE PEMBAYARAN:
   - Label: "Tunai", "Cash", "Kartu", "Debit", "Kredit", "QRIS", "Transfer"
   - Jika tidak ada, set null

========================================
KETERANGAN TAMBAHAN
========================================
- Informasi kasir, nama kasir, promosi, kode member dll → simpan di field "keterangan"
- JANGAN masukkan informasi yang tidak berhubungan dengan transaksi

========================================
CONTOH OUTPUT YANG BENAR
========================================

Input nota:
  TOKO ABC
  Jl. Merdeka No. 10
  Telp. 08123456789
  No: 00125
  Tanggal: 15/08/2026  15:30
  INDOMIE GORENG   2 x 3.500   7.000
  AQUA 600ML       1 x 4.000   4.000
  ROTI             1 x 8.000   8.000
  Subtotal: 19.000
  Diskon:    2.000
  Pajak:     1.870
  Service:   1.000
  TOTAL:    19.870
  Tunai

Output JSON:
{
  "isReceipt": true,
  "namaToko": "TOKO ABC",
  "alamat": "Jl. Merdeka No. 10",
  "noTelepon": "08123456789",
  "receiptNumber": "00125",
  "tanggal": "2026-08-15",
  "waktu": "15:30",
  "subtotalNominal": 19000,
  "diskon": 2000,
  "pajak": 1870,
  "biayaTambahan": 1000,
  "namaBiayaTambahan": "Service",
  "nominal": 19870,
  "metodePembayaran": "Tunai",
  "keterangan": null,
  "items": [
    { "namaBarang": "INDOMIE GORENG", "qty": 2, "harga": 3500, "subtotal": 7000 },
    { "namaBarang": "AQUA 600ML", "qty": 1, "harga": 4000, "subtotal": 4000 },
    { "namaBarang": "ROTI", "qty": 1, "harga": 8000, "subtotal": 8000 }
  ],
  "ocrRawText": "..."
}

========================================
TUGAS
========================================
1. Analisis apakah dokumen adalah nota/struk/bukti pembayaran yang VALID. Jika TIDAK, set isReceipt: false.
2. Ekstraksi SELURUH data ke JSON sesuai struktur di bawah ini tanpa pembungkus markdown.
3. JANGAN mengarang data yang tidak ada. Gunakan null untuk field yang tidak ditemukan.

Struktur JSON WAJIB:
{
  "isReceipt": true/false,
  "namaToko": "string atau null",
  "alamat": "string atau null",
  "noTelepon": "string atau null",
  "receiptNumber": "string atau null",
  "tanggal": "YYYY-MM-DD atau null — JANGAN ISI DENGAN TANGGAL HARI INI JIKA TIDAK ADA",
  "waktu": "HH:MM atau null",
  "subtotalNominal": angka_atau_null,
  "diskon": angka_atau_0,
  "diskonPersen": angka_persen_atau_0,
  "pajak": angka_atau_0,
  "pajakPersen": angka_persen_atau_0,
  "biayaTambahan": angka_atau_0,
  "namaBiayaTambahan": "string atau null",
  "nominal": angka_total_akhir,
  "metodePembayaran": "string atau null",
  "keterangan": "string atau null",
  "items": [
    { "namaBarang": "nama lengkap barang", "qty": angka, "harga": angka_satuan, "subtotal": angka_total_baris, "keterangan": null }
  ],
  "ocrRawText": "Seluruh teks OCR mentah dari dokumen"
}`

  try {
    // Parse mimeType and base64 from dataUrl
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) {
      throw new Error('Format gambar tidak valid')
    }
    const mimeType = match[1]
    const base64Data = match[2]

    const requestBody = JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64Data } },
          ],
        },
      ],
      generationConfig: { response_mime_type: 'application/json' },
    })

    // Try the cached model first to avoid discovery overhead (saves ~1-2s)
    let apiRes: Response | null = null
    let usedModel = ''
    let lastError = ''

    if (cachedWorkingModel) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${cachedWorkingModel}:generateContent?key=${apiKey}`
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
        })
        if (res.ok) {
          apiRes = res
          usedModel = cachedWorkingModel
        } else {
          console.warn(`Cached model ${cachedWorkingModel} failed. Clearing cache.`)
          cachedWorkingModel = null
        }
      } catch (err) {
        console.warn(`Cached model ${cachedWorkingModel} error. Clearing cache.`, err)
        cachedWorkingModel = null
      }
    }

    // If no cached model worked, perform model discovery and loop candidates
    if (!apiRes) {
      let modelCandidates: string[] = []
      try {
        const modelsRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=50`
        )
        if (modelsRes.ok) {
          const modelsData = await modelsRes.json()
          modelCandidates = (modelsData.models ?? [])
            .filter((m: any) =>
              Array.isArray(m.supportedGenerationMethods) &&
              m.supportedGenerationMethods.includes('generateContent') &&
              /gemini.*(flash|pro)/i.test(m.name)
            )
            .map((m: any) => m.name.replace('models/', ''))
            .sort((a: string, b: string) => {
              const aFlash = a.includes('flash') ? 0 : 1
              const bFlash = b.includes('flash') ? 0 : 1
              return aFlash - bFlash
            })
        }
      } catch {
        // ignore
      }

      if (modelCandidates.length === 0) {
        modelCandidates = [
          'gemini-1.5-flash',
          'gemini-2.0-flash',
          'gemini-2.0-flash-lite',
          'gemini-1.5-flash-8b',
          'gemini-1.5-pro',
        ]
      }

      for (const model of modelCandidates) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
        })
        if (res.ok) {
          apiRes = res
          usedModel = model
          cachedWorkingModel = model // Cache successful model
          break
        }
        const errText = await res.text().catch(() => '')
        lastError = `[${model}] ${res.status}: ${errText.slice(0, 150)}`
        if (res.status === 401 || res.status === 403) break
      }
    }

    if (!apiRes) {
      // modelCandidates mungkin kosong jika tidak ada loop, pakai placeholder
      throw new Error(`Tidak ada model yang tersedia. Error: ${lastError}`)
    }

    console.log(`OCR berhasil menggunakan model: ${usedModel}`)
    const apiData = await apiRes.json()
    const content: string = apiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    // Parse JSON dari respons Gemini
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: Record<string, any> = {}
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    } catch {
      parsed = {}
    }

    // Normalize ALL keys to lowercase without underscores so "NAMATOKO", "namaToko",
    // "nama_toko" all resolve to the same key "namatoko".
    const rawKeys = Object.keys(parsed)
    const norm: Record<string, any> = {}
    for (const k of rawKeys) {
      const normKey = k.toLowerCase().replace(/_/g, '')
      // Also clean string values: trim whitespace, collapse internal spaces
      let val = parsed[k]
      if (typeof val === 'string') {
        val = val.replace(/\s+/g, ' ').trim()
      }
      norm[normKey] = val
    }

    const isReceipt = norm.isreceipt !== undefined ? Boolean(norm.isreceipt) : true
    const ocrRawText: string = norm.ocrrawtext || norm.ocrtext || content

    // ── namaToko extraction ──────────────────────────────────────────────────
    // Priority: Gemini's extracted namaToko > detectBankOrPaymentProvider > 'Tidak Terbaca'
    // Clean the Gemini value: reject if it's just whitespace, 'Tidak Terbaca', or a common OCR artifact
    let namaToko: string | null = null
    const geminiNamaToko = (norm.namatoko || norm.merchantname || '').trim()
    const invalidNames = ['tidak terbaca', 'unknown', 'n/a', '-', '']
    if (geminiNamaToko && !invalidNames.includes(geminiNamaToko.toLowerCase())) {
      namaToko = geminiNamaToko
    }

    // Only fall back to detectBankOrPaymentProvider if Gemini truly failed
    const detectedNamaToko = namaToko || detectBankOrPaymentProvider(ocrRawText) || 'Tidak Terbaca'
    console.log(`[OCR] Gemini namaToko: "${geminiNamaToko}" → final: "${detectedNamaToko}"`)

    // Tanggal: ambil dari parsed, fallback ke regex parser, fallback ke null (JANGAN pakai tanggal hari ini)
    // Format output: YYYY-MM-DD (04-database-schema.md §2: tanggal adalah DATE)
    let tanggal: string | null = norm.tanggal || norm.transactiondate || null
    if (tanggal && tanggal.includes('T')) tanggal = tanggal.split('T')[0]  // strip time if ISO
    if (!tanggal) tanggal = parseDate(ocrRawText) ?? null  // null jika tidak ditemukan, bukan tanggal hari ini

    let nominal = Number(norm.nominal ?? norm.total) || 0
    // Guard: jangan pakai nomor referensi (>= 10 digit) sebagai nominal
    if (nominal >= 10_000_000_000) nominal = 0
    if (!nominal) nominal = parseTotalSmart(ocrRawText)

    // Extracted receipt number — prioritize Gemini's answer, fall back to regex parseInvoice
    // If Gemini returns empty/null for receiptNumber, also try regex on the raw OCR text
    const geminiReceiptNum: string = (norm.receiptnumber || norm.invoicenumber || norm.ordernumber || norm.orderid || norm.trxid || '').trim()
    const regexReceiptNum = parseInvoice(ocrRawText)
    const rawNumber = (geminiReceiptNum && isValidInvoiceNumber(geminiReceiptNum))
      ? geminiReceiptNum
      : (regexReceiptNum && isValidInvoiceNumber(regexReceiptNum) ? regexReceiptNum : null)
    const receiptNumber = rawNumber ? rawNumber.trim() : null

    const rawAlamat: string | null = norm.alamat || norm.merchantaddress || null
    const alamat = rawAlamat && isValidAddress(rawAlamat) ? rawAlamat.trim() : null

    // No. Telepon toko — cari dari field khusus atau dari teks OCR jika ada label Telp/Phone
    const rawNoTelepon: string | null = norm.notelepon || norm.telepon || norm.phone || norm.merchantphone || null
    const noTelepon = rawNoTelepon && isValidPhone(rawNoTelepon)
      ? rawNoTelepon.trim()
      : (extractPhoneFromOcr(ocrRawText) || null)

    const keterangan: string | null = norm.keterangan || norm.description || null

    // Normalisasi items & pembersihan kesalahan pemetaan kolom AI
    const rawItems = Array.isArray(parsed.items) ? parsed.items : []
    const items: ReceiptItem[] = rawItems.length > 0
      ? sanitizeItems(rawItems, nominal)
      : parseItems(ocrRawText)

    // Confidence heuristic (BR-OCR-03/04/05)
    let confidence = 50
    if (namaToko && namaToko !== 'Tidak Terbaca') confidence += 15
    if (nominal > 0) confidence += 15
    if (tanggal) confidence += 10
    if (receiptNumber) confidence += 5
    if (items.length > 0) confidence += 5
    confidence = Math.min(98, confidence)

    // Extract all fields
    const waktu: string | null = typeof norm.waktu === 'string' && norm.waktu.match(/^\d{1,2}:\d{2}/) ? norm.waktu : null
    const diskon = Number(norm.diskon) || 0
    const diskonPersen = Number(norm.diskonpersen || norm.diskonfloat) || 0
    const pajak = Number(norm.pajak) || 0
    const pajakPersen = Number(norm.pajakpersen || norm.pajakfloat) || 0
    const biayaTambahan = Number(
      norm.biayaditambahkan || norm.biayaditambah || norm.biayatambahan ||
      norm.biayadmin || norm.biayalayanan || norm.biayaadmin ||
      norm.paymentfee || norm.servicefee || norm.adminfee ||
      norm.fee || norm.layanan || 0
    ) || 0
    const namaBiayaTambahan: string | null = typeof (norm.namabiayatambahan || norm.servicecharge || norm.feelabel) === 'string'
      ? (norm.namabiayatambahan || norm.servicecharge || norm.feelabel).trim() || null
      : null
    // Subtotal sebelum diskon/pajak/biaya
    const subtotalNominal: number | undefined = norm.subtotalnominal != null
      ? Number(norm.subtotalnominal) || undefined
      : (items.length > 0
        ? items.reduce((s, it) => s + (Number(it.subtotal) || 0), 0) || undefined
        : undefined)

    // Field-level confidences from Gemini (or default heuristics)
    const rawFc = norm.fieldconfidences || norm.field_confidences || {}
    const fieldConfidences: Record<string, number> = {}
    if (rawFc && typeof rawFc === 'object') {
      for (const [k, v] of Object.entries(rawFc)) {
        fieldConfidences[k.toLowerCase().replace(/_/g, '')] = Number(v) || 0
      }
    }
    // Fill in heuristic defaults for fields not returned by Gemini
    if (!fieldConfidences.namatoko) fieldConfidences.namatoko = namaToko !== 'Tidak Terbaca' ? 80 : 30
    if (!fieldConfidences.tanggal) fieldConfidences.tanggal = tanggal ? 80 : 20
    if (!fieldConfidences.nominal) fieldConfidences.nominal = nominal > 0 ? 75 : 20

    const result: OcrResult = {
      isReceipt,
      namaToko: detectedNamaToko,
      alamat,
      noTelepon,
      tanggal,
      waktu,
      nominal,
      subtotalNominal,
      diskon,
      diskonPersen,
      pajak,
      pajakPersen,
      biayaTambahan,
      namaBiayaTambahan,
      receiptNumber,
      metodePembayaran: norm.metodepembayaran || norm.paymentmethod || null,
      keterangan,
      items,
      ocrRawText,
      confidence,
      fieldConfidences,
      status: getOcrStatus(confidence),
      // backward compat aliases
      merchantName: detectedNamaToko,
      merchantAddress: alamat,
      merchantPhone: noTelepon,
      transactionDate: tanggal,
      total: nominal,
      invoiceNumber: receiptNumber,
      description: keterangan,
      ocrText: ocrRawText,
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('OCR error:', err)
    return NextResponse.json({
      error: 'Gagal memproses OCR: ' + (err.message || 'Error tidak dikenal')
    }, { status: 500 })
  }
}
