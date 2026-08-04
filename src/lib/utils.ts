import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a number as Indonesian Rupiah currency */
export function formatRupiah(value: number | null | undefined): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value ?? 0)
}

/** Compact rupiah for cards (e.g. Rp 1,2 jt) */
export function formatRupiahCompact(value: number | null | undefined): string {
  const v = value ?? 0
  if (v >= 1_000_000) {
    const jt = v / 1_000_000
    return `Rp ${jt.toFixed(jt % 1 === 0 ? 0 : 1)} jt`
  }
  if (v >= 1_000) {
    const rb = v / 1_000
    return `Rp ${rb.toFixed(rb % 1 === 0 ? 0 : 1)} rb`
  }
  return `Rp ${v}`
}

/** Format a date string to Indonesian long date */
export function formatDateID(iso: string | Date | null | undefined): string {
  if (!iso) return '—'
  const d = typeof iso === "string" ? parseLocalDate(iso) : iso
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d)
}

/** Format a date string to Indonesian short date */
export function formatDateShort(iso: string | Date | null | undefined): string {
  if (!iso) return '—'
  const d = typeof iso === "string" ? parseLocalDate(iso) : iso
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d)
}

/** Format time */
export function formatTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

/** Relative time (e.g. "2 jam lalu") */
export function timeAgo(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso
  const diff = Date.now() - d.getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return "baru saja"
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} menit lalu`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} jam lalu`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} hari lalu`
  return formatDateShort(d)
}

/** Generate an invoice number */
export function generateInvoiceNumber(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `INV-${y}${m}-${rand}`
}

/** Parse a rupiah string into a number */
export function parseRupiah(s: string): number {
  const cleaned = s.replace(/[^\d]/g, "")
  return cleaned ? parseInt(cleaned, 10) : 0
}

/** Parses date strings locally (ignoring UTC conversion timezone shifts) */
export function parseLocalDate(dateStr: string | Date): Date {
  if (dateStr instanceof Date) return dateStr
  let clean = String(dateStr).trim()
  if (clean.includes('T')) {
    clean = clean.split('T')[0]
  }
  
  // Format: YYYY-MM-DD
  const parts = clean.split(/[-/]/)
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10) - 1
    const d = parseInt(parts[2], 10)
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d)
    }
  }
  
  // Format: DD-MM-YYYY
  const partsRev = clean.split(/[-/]/)
  if (partsRev.length === 3 && partsRev[2].length === 4) {
    const d = parseInt(partsRev[0], 10)
    const m = parseInt(partsRev[1], 10) - 1
    const y = parseInt(partsRev[2], 10)
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d)
    }
  }

  const parsed = new Date(dateStr)
  return isNaN(parsed.getTime()) ? new Date() : parsed
}

/** Get start of today */
export function startOfDay(d: Date = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Get start of week (Monday) */
export function startOfWeek(d: Date = new Date()): Date {
  const x = startOfDay(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day // Monday as first day
  x.setDate(x.getDate() + diff)
  return x
}

/** Get start of month */
export function startOfMonth(d: Date = new Date()): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), 1)
  return x
}

/** Validate if an invoice number string is genuine (not an OCR header artifact like BANYAKNYA or fake generated ID) */
export function isValidInvoiceNumber(num?: string | null): boolean {
  if (!num) return false
  const s = String(num).trim().toUpperCase()
  if (
    !s ||
    s === '-' ||
    s === 'NULL' ||
    s === 'UNDEFINED' ||
    s.startsWith('TEMP-') ||
    s.startsWith('INV-TEMP-') ||
    s.startsWith('TEMP-INV-')
  ) {
    return false
  }

  // Reject auto-generated fake fallback IDs (e.g. INV-20260620-2266, INV-139bb414-4dc4-..., etc.)
  if (/^INV-\d{8}-[A-F0-9]{4,6}$/i.test(s) || /^INV-[A-F0-9]{8,12}$/i.test(s) || /^INV-[A-F0-9-]{16,}$/i.test(s)) {
    return false
  }

  const invalidKeywords = [
    'BANYAKNYA', 'TOTAL', 'NOTA', 'FAKTUR', 'JUMLAH', 'ITEM', 'TANGGAL', 'HARGA',
    'KASIR', 'NAMA', 'SATUAN', 'SUBTOTAL', 'BAYAR', 'KEMBALI', 'TERIMA', 'KASIH',
    'NOMINAL', 'MINAL', 'BANYAK', 'QTY', 'NO', 'NAMA_BARANG', 'HARGA_SATUAN', 'JUMLAH_HARGA',
    'NO_URUT', 'NAMA_ITEM', 'BARANG', 'KETERANGAN', 'URAIAN', 'DISKON', 'PAJAK', 'PPN'
  ]
  if (invalidKeywords.some((kw) => s === kw || s.startsWith(kw + ' ') || s.endsWith(' ' + kw) || s.startsWith(kw + ':') || s.startsWith(kw + '.'))) {
    return false
  }

  // Real invoice number should have at least one digit
  if (!/\d/.test(s)) {
    return false
  }

  return true
}

/** Validate if a string is a valid address (not a table item row or customer name) */
export function isValidAddress(addr?: string | null): boolean {
  if (!addr) return false
  const s = String(addr).trim()
  if (!s || s === '-' || s === 'NULL' || s === 'UNDEFINED') return false

  // Reject strings containing item table syntax, prices, customer names, or numbers formatted like prices
  if (/\||paket|banyaknya|harga|subtotal|total|rp\.?\s*\d|\b\d{1,3}(?:\.\d{3})+\b|pelanggan|balai|bppki/i.test(s)) {
    return false
  }

  // Reject if it's just pure numbers or too short
  if (/^\d+$/.test(s) || s.length < 4) return false

  return true
}

/** Validate if a string is a valid phone number line */
export function isValidPhone(phone?: string | null): boolean {
  if (!phone) return false
  const s = String(phone).trim()
  if (!s || s === '-' || s === 'NULL') return false
  if (/\||paket|banyaknya|harga|subtotal|total|rp/i.test(s)) return false
  return /(?:telp|phone|hp|wa|tlp|call|contact|\b08\d{8,11}\b|\b\+?62\d{8,11}\b)/i.test(s)
}

/** Extract phone number from OCR raw text if available */
export function extractPhoneFromOcr(ocrText?: string | null): string {
  if (!ocrText) return ''
  const lines = String(ocrText).split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (isValidPhone(trimmed)) {
      return trimmed
    }
  }
  return ''
}

/** Extract merchant address from OCR raw text if available */
export function extractAddressFromOcr(ocrText?: string | null): string {
  if (!ocrText) return ''
  const lines = String(ocrText).split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (isValidAddress(trimmed)) {
      if (/(?:jl\.|jalan|kel\.|kec\.|kota|kab\.|desa|blok|rt\.|rw\.|pos\s*\d{5}|tidore|manado|jakarta|surabaya|bandung|medan|indonesia)/i.test(trimmed)) {
        return trimmed
      }
    }
  }
  return ''
}

/** Generate a clean, human-readable Indonesian filename for Excel exports */
export function getReportFilename(options?: {
  period?: 'weekly' | 'monthly' | 'yearly' | string | null
  startDate?: string | null
  endDate?: string | null
  month?: number | null
  year?: number | null
}): string {
  const INDO_MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ]

  const now = new Date()
  let y = options?.year || (options?.startDate ? new Date(options.startDate).getFullYear() : now.getFullYear())
  if (isNaN(y) || y < 2000) y = now.getFullYear()

  let mIdx = now.getMonth()
  if (typeof options?.month === 'number') {
    mIdx = options.month >= 1 && options.month <= 12 ? options.month - 1 : options.month
  } else if (options?.startDate) {
    const parsed = new Date(options.startDate)
    if (!isNaN(parsed.getTime())) mIdx = parsed.getMonth()
  }

  const monthName = INDO_MONTHS[mIdx] || 'Juli'
  const p = options?.period

  // 1. Tahunan (Yearly)
  if (p === 'yearly' || (options?.startDate && options?.endDate && isFullYearRange(options.startDate, options.endDate))) {
    return `Laporan Nota Tahun ${y}.xlsx`
  }

  // 2. Mingguan (Weekly)
  if (p === 'weekly' || (options?.startDate && options?.endDate && isWeeklyRange(options.startDate, options.endDate))) {
    const sDate = options?.startDate ? new Date(options.startDate) : now
    const day = isNaN(sDate.getTime()) ? 1 : sDate.getDate()
    const weekNum = Math.min(5, Math.max(1, Math.ceil(day / 7)))
    const mName = isNaN(sDate.getTime()) ? monthName : (INDO_MONTHS[sDate.getMonth()] || monthName)
    const yNum = isNaN(sDate.getTime()) ? y : sDate.getFullYear()

    return `Laporan Nota Minggu ke-${weekNum} Bulan ${mName} ${yNum}.xlsx`
  }

  // 3. Bulanan (Monthly) / Default
  if (p === 'monthly' || !options?.startDate || !options?.endDate || isSameMonth(options.startDate, options.endDate)) {
    return `Laporan Nota Bulan ${monthName} ${y}.xlsx`
  }

  // 4. Custom range fallback
  const startD = new Date(options.startDate)
  const endD = new Date(options.endDate)
  if (!isNaN(startD.getTime()) && !isNaN(endD.getTime())) {
    const startM = INDO_MONTHS[startD.getMonth()]
    const endM = INDO_MONTHS[endD.getMonth()]
    const startY = startD.getFullYear()
    const endY = endD.getFullYear()

    if (startY === endY) {
      if (startM === endM) return `Laporan Nota Bulan ${startM} ${startY}.xlsx`
      return `Laporan Nota Bulan ${startM} - ${endM} ${startY}.xlsx`
    }
    return `Laporan Nota ${startM} ${startY} - ${endM} ${endY}.xlsx`
  }

  return `Laporan Nota Bulan ${monthName} ${y}.xlsx`
}

function isFullYearRange(start: string, end: string): boolean {
  const s = new Date(start)
  const e = new Date(end)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return false
  return s.getMonth() === 0 && s.getDate() === 1 && e.getMonth() === 11 && e.getDate() >= 28
}

function isWeeklyRange(start: string, end: string): boolean {
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  if (isNaN(s) || isNaN(e)) return false
  const diffDays = Math.round(Math.abs(e - s) / (1000 * 60 * 60 * 24))
  return diffDays >= 4 && diffDays <= 8
}

function isSameMonth(start: string, end: string): boolean {
  const s = new Date(start)
  const e = new Date(end)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return false
  return s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()
}
