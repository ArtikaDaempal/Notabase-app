import { NextRequest, NextResponse } from 'next/server'
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
  // Try reference number patterns common in bank receipts
  const refPatterns = [
    /\bno\.?\s*ref(?:erensi)?\.?\s*:?\s*([A-Z0-9]{8,24})\b/i,
    /\bno\.?\s*transaksi\.?\s*:?\s*([A-Z0-9]{8,24})\b/i,
    /\breference\s*(?:no|number)\.?\s*:?\s*([A-Z0-9]{8,24})\b/i,
    /\b(?:inv|invoice|nota|no)\b[.\s:]*(#?\s*[A-Z0-9\-\/]{4,})/i,
  ]
  for (const p of refPatterns) {
    const m = text.match(p)
    if (m) {
      const candidate = m[1].replace(/^#?\s*/, '').trim()
      if (isValidInvoiceNumber(candidate)) {
        return candidate
      }
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
        continue
      }
    }
  }
  return items
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
  const prompt = `Kamu adalah sistem AI OCR presisi tinggi khusus membaca:
- Struk fisik toko/warung/percetakan
- Nota tulisan tangan
- Faktur/kuitansi/invoice
- Screenshot aplikasi mobile banking: Livin by Mandiri, BCA Mobile, BRImo, BSI Mobile, BNI Mobile
- Screenshot aplikasi e-wallet: DANA, GoPay, OVO, ShopeePay, LinkAja
- Screenshot Bukti Transaksi Bukalapak, Tokopedia, Shopee, Indihome, Telkom, PLN, BPJS

Prioritas Bahasa Utama: ${langDesc}
Ekstraksi Rincian Barang: ${ocrExtractItems ? 'Aktif' : 'Nonaktif'}

Tugas:
1. Analisis apakah dokumen adalah nota/struk/bukti pembayaran yang VALID. Jika TIDAK (foto wajah, pemandangan, KTP, dokumen random), set isReceipt: false.

2. Jika VALID, ekstraksi ke JSON berikut:

{
  "isReceipt": true,
  "namaToko": "WAJIB diisi. Nama merchant/toko/mitra/penyedia jasa. JANGAN isi dengan 'Tidak Terbaca'",
  "alamat": "Alamat toko/merchant jika tercantum, atau null",
  "noTelepon": "Nomor telepon toko/merchant jika ada, atau null",
  "tanggal": "YYYY-MM-DD — WAJIB format ini. Contoh: 15 JUL 2026 -> 2026-07-15",
  "waktu": "Jam transaksi format HH:MM jika ada (contoh: '14:30'), atau null",
  "nominal": "HANYA nominal total akhir pembayaran sebagai INTEGER tanpa titik/koma/Rp. JANGAN masukkan nomor referensi sebagai nominal",
  "diskon": "Nominal diskon dalam Rupiah sebagai INTEGER (0 jika tidak ada)",
  "diskonPersen": "Persentase diskon (0-100) sebagai NUMBER (0 jika tidak ada)",
  "pajak": "Nominal pajak/PPN dalam Rupiah sebagai INTEGER (0 jika tidak ada)",
  "pajakPersen": "Persentase pajak (0-100) sebagai NUMBER (0 jika tidak ada)",
  "biayaTambahan": "Biaya admin/transaksi/layanan tambahan dalam Rupiah sebagai INTEGER (0 jika tidak ada)",
  "metodePembayaran": "Metode pembayaran (misal: 'Tunai', 'Transfer Bank Mandiri', 'GoPay', 'DANA')",
  "sumberDana": "Rekening/kartu/wallet sumber dana jika tercantum, atau null",
  "receiptNumber": "No. Referensi / No. Transaksi / No. Nota yang tertera, atau null",
  "keterangan": "Deskripsi singkat transaksi",
  "items": ${ocrExtractItems ? `[
    {
      "namaBarang": "Nama barang/jasa/layanan yang dibayarkan",
      "qty": 1,
      "harga": 125000,
      "subtotal": 125000,
      "keterangan": "Catatan per-item jika ada, atau null"
    }
  ]` : `[]`},
  "fieldConfidences": {
    "namaToko": 95,
    "tanggal": 90,
    "nominal": 85,
    "items": 80
  },
  "ocrRawText": "SALIN SELURUH teks dari gambar dari atas ke bawah, lengkap tanpa ada yang terlewat."
}

Aturan KRITIS:
- ${itemsInstruction}
- nominal WAJIB integer murni tanpa separator. Salah: "125.000" Benar: 125000
- nominal HANYA total akhir yang dibayar. JANGAN ambil nomor referensi 16-20 digit atau no pelanggan sebagai nominal
- tanggal WAJIB format YYYY-MM-DD
- namaToko WAJIB diisi, JANGAN kosong atau 'Tidak Terbaca'
- fieldConfidences: berikan skor keyakinan 0-100 untuk setiap field utama yang kamu isi
- Untuk screenshot Bukalapak / Tokopedia / Shopee / Livin: namaToko = nama instansi/tujuan transaksi + platform
- Keluarkan HANYA JSON mentah yang valid tanpa pembungkus markdown atau backtick.`

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

    // Tanggal: ambil dari parsed, fallback ke regex parser, fallback ke hari ini
    // Format output: YYYY-MM-DD (04-database-schema.md §2: tanggal adalah DATE)
    let tanggal: string = norm.tanggal || norm.transactiondate || null
    if (tanggal && tanggal.includes('T')) tanggal = tanggal.split('T')[0]  // strip time if ISO
    if (!tanggal) tanggal = parseDate(ocrRawText) ?? new Date().toISOString().split('T')[0]

    let nominal = Number(norm.nominal ?? norm.total) || 0
    // Guard: jangan pakai nomor referensi (>= 10 digit) sebagai nominal
    if (nominal >= 10_000_000_000) nominal = 0
    if (!nominal) nominal = parseTotalSmart(ocrRawText)

    // Extracted receipt number — validate using isValidInvoiceNumber so trash values are discarded
    // If Gemini returns empty string for receiptNumber, accept it (no invoice number)
    const rawNumber: string | null = norm.receiptnumber || norm.invoicenumber || parseInvoice(ocrRawText)
    const receiptNumber = rawNumber && isValidInvoiceNumber(rawNumber) ? rawNumber.trim() : null

    const rawAlamat: string | null = norm.alamat || norm.merchantaddress || extractAddressFromOcr(ocrRawText) || null
    const alamat = rawAlamat && isValidAddress(rawAlamat) ? rawAlamat.trim() : null

    const rawNoTelepon: string | null = norm.notelepon || norm.merchantphone || norm.phone || extractPhoneFromOcr(ocrRawText) || null
    const noTelepon = rawNoTelepon && isValidPhone(rawNoTelepon) ? rawNoTelepon.trim() : null

    const keterangan: string | null = norm.keterangan || norm.description || null
    const metodePembayaran: string | null = norm.metodepembayaran || norm.paymentmethod || null

    // Normalisasi items ke skema baru
    const rawItems = Array.isArray(parsed.items) ? parsed.items : []
    const items: ReceiptItem[] = rawItems.length > 0
      ? rawItems.map((it: any, idx: number) => {
          const harga = Number(it.harga ?? it.price ?? 0)
          const qty = Number(it.qty ?? 1)
          return {
            namaBarang: String(it.namaBarang ?? it.name ?? ''),
            qty,
            harga,
            subtotal: Number(it.subtotal ?? it.total ?? qty * harga),
            urutan: idx,
            // backward compat aliases
            name: String(it.namaBarang ?? it.name ?? ''),
            price: harga,
            total: Number(it.subtotal ?? it.total ?? qty * harga),
          }
        })
      : parseItems(ocrRawText)

    // Confidence heuristic (BR-OCR-03/04/05)
    let confidence = 50
    if (namaToko && namaToko !== 'Tidak Terbaca') confidence += 15
    if (nominal > 0) confidence += 15
    if (tanggal) confidence += 10
    if (receiptNumber) confidence += 5
    if (items.length > 0) confidence += 5
    confidence = Math.min(98, confidence)

    // Extract new fields
    const waktu: string | null = typeof norm.waktu === 'string' && norm.waktu.match(/^\d{1,2}:\d{2}/) ? norm.waktu : null
    const diskon = Number(norm.diskon) || 0
    const diskonPersen = Number(norm.diskonpersen || norm.diskonfloat) || 0
    const pajak = Number(norm.pajak) || 0
    const pajakPersen = Number(norm.pajakpersen || norm.pajakfloat) || 0
    const biayaTambahan = Number(norm.biayaditambahkan || norm.biayaditambah || norm.biayadmin || norm.biayatambahan || norm.fee) || 0
    const sumberDana: string | null = typeof norm.sumberdana === 'string' && norm.sumberdana.trim() ? norm.sumberdana.trim() : null

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
      diskon,
      diskonPersen,
      pajak,
      pajakPersen,
      biayaTambahan,
      metodePembayaran,
      sumberDana,
      receiptNumber,
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
      phone: noTelepon,
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
