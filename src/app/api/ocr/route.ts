import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import ZAI from 'z-ai-web-dev-sdk'
import type { OcrResult, ReceiptItem } from '@/types'

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Alat Tulis Kantor': ['toko', 'atk', 'alat tulis', 'kantor', 'kertas', 'pulpen', 'buku'],
  'Makanan & Minuman': ['resto', 'restaurant', 'warung', 'kopi', 'cafe', 'makan', 'minum', 'martabak', 'bakso', 'ayam', 'pizza', 'kfc', 'mcd', 'indomaret', 'alfamart'],
  'Transportasi': ['bbm', 'pertamina', 'shell', 'parkir', 'tol', 'transport', 'gojek', 'grab', 'taxi', 'bensin'],
  'Belanja': ['mall', 'market', 'supermarket', 'swalayan', 'grosir', 'shop', 'store'],
  'Kesehatan': ['apotek', 'klinik', 'rs', 'rumah sakit', 'dokter', 'farmasi', 'pharmacy'],
  'Elektronik': ['elektronik', 'gadget', 'hp', 'laptop', 'computer', 'tokopedia'],
  'Lainnya': [],
}

function guessCategory(merchant: string, text: string): string {
  const combined = `${merchant} ${text}`.toLowerCase()
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => combined.includes(k))) return cat
  }
  return 'Lainnya'
}

function parseDate(text: string): string | null {
  // Indonesian / common date formats: 02/07/2025, 2-07-2025, 02 Jul 2025, 2025-07-02
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
        if (!isNaN(d.getTime())) return d.toISOString()
      } catch {
        // ignore parse errors
      }
    }
  }
  return null
}

function parseTotal(text: string): number {
  // Look for "TOTAL" label then a number, or the largest rupiah-looking number
  const totalLineMatch = text.match(/total[^0-9]{0,10}(rp\.?\s*)?([\d.]+(?:,\d{2})?)/i)
  const candidates: number[] = []
  if (totalLineMatch) {
    const num = parseFloat(totalLineMatch[2].replace(/\./g, '').replace(',', '.'))
    if (!isNaN(num)) candidates.push(num)
  }
  // Fallback: all rupiah-like numbers
  const allMatches = text.matchAll(/(?:rp\.?\s*)?(\d{1,3}(?:[.\s]\d{3})+(?:,\d{2})?)/gi)
  for (const m of allMatches) {
    const raw = m[1].replace(/\./g, '').replace(/\s/g, '').replace(',', '.')
    const num = parseFloat(raw)
    if (!isNaN(num) && num > 100) candidates.push(num)
  }
  // Return the max candidate (total is usually the largest)
  if (candidates.length) return Math.max(...candidates)
  return 0
}

function parseInvoice(text: string): string | null {
  const m = text.match(/(?:inv|invoice|nota|no)[\.\s:]*(#?\s*[A-Z0-9\-\/]{4,})/i)
  return m ? m[1].replace(/^#?\s*/, '').trim() : null
}

function parseItems(text: string): ReceiptItem[] {
  const items: ReceiptItem[] = []
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  for (const line of lines) {
    // Match "item name  ...  qty x price  total"
    const m = line.match(/^(.+?)\s+(\d+)\s*[xX]\s*([\d.]+)\s+([\d.]+)$/)
    if (m) {
      items.push({
        name: m[1].trim(),
        qty: parseInt(m[2], 10),
        price: parseFloat(m[3].replace(/\./g, '')),
        total: parseFloat(m[4].replace(/\./g, '')),
      })
    }
  }
  return items
}

// POST /api/ocr — analyze a receipt image
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { imageUrl, filename } = body as { imageUrl?: string; filename?: string }

  if (!imageUrl) {
    return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 })
  }

  // Resolve the image to a base64 data URL
  let dataUrl = ''
  if (imageUrl.startsWith('data:')) {
    dataUrl = imageUrl
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

  // Use VLM to extract structured receipt data
  const prompt = `Anda adalah sistem OCR untuk nota/receipt Indonesia. Analisa gambar nota ini dan ekstrak informasi dalam format JSON yang valid (hanya JSON, tanpa markdown).

Ekstrak field berikut:
{
  "merchantName": "nama toko/merchant",
  "transactionDate": "tanggal transaksi dalam format YYYY-MM-DD (jika ada)",
  "total": <angka total nominal tanpa "Rp" dan tanpa pemisah ribuh>,
  "invoiceNumber": "nomor invoice/nota (jika ada, atau null)",
  "description": "ringkasan singkat pembelian dalam bahasa Indonesia (1 kalimat)",
  "items": [{"name": "nama item", "qty": <number>, "price": <number per item>, "total": <subtotal>}],
  "ocrText": "salin seluruh teks yang terbaca pada nota, pertahankan layout"
}

Aturan:
- total adalah angka murni (contoh: 125000 bukan "Rp 125.000")
- Jika field tidak terbaca, gunakan null (untuk string) atau 0 (untuk angka)
- Jika tidak ada item terbaca, kembalikan array kosong []
- Pertahankan akurasi tinggi. Jika ragu, beri null.`

  try {
    const zai = await ZAI.create()
    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    })

    const content = response.choices[0]?.message?.content || ''

    // Try to parse JSON from the response
    let parsed: Record<string, unknown> = {}
    try {
      // Extract JSON from possible markdown fences
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    } catch {
      parsed = {}
    }

    const ocrText = (parsed.ocrText as string) || content
    const merchantName = (parsed.merchantName as string) || 'Tidak Terbaca'
    let transactionDate = (parsed.transactionDate as string) || null
    if (transactionDate && !transactionDate.includes('T')) {
      const d = new Date(transactionDate)
      transactionDate = isNaN(d.getTime()) ? null : d.toISOString()
    }
    if (!transactionDate) transactionDate = parseDate(ocrText)
    if (!transactionDate) transactionDate = new Date().toISOString()

    let total = Number(parsed.total) || 0
    if (!total) total = parseTotal(ocrText)

    const invoiceNumber = (parsed.invoiceNumber as string) || parseInvoice(ocrText)
    const description = (parsed.description as string) || null
    const items = Array.isArray(parsed.items) ? (parsed.items as ReceiptItem[]) : parseItems(ocrText)
    const category = guessCategory(merchantName, ocrText)

    // Confidence heuristic: based on whether key fields were extracted
    let confidence = 50
    if (merchantName && merchantName !== 'Tidak Terbaca') confidence += 15
    if (total > 0) confidence += 15
    if (transactionDate) confidence += 10
    if (invoiceNumber) confidence += 5
    if (items.length > 0) confidence += 5
    confidence = Math.min(98, confidence)

    const result: OcrResult = {
      merchantName,
      transactionDate,
      total,
      invoiceNumber,
      description,
      items,
      ocrText,
      confidence,
      category,
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('OCR error:', err)
    return NextResponse.json(
      { error: 'OCR processing failed', detail: String(err) },
      { status: 500 }
    )
  }
}
