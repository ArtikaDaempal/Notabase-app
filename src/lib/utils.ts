import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a number as Indonesian Rupiah currency */
export function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/** Compact rupiah for cards (e.g. Rp 1,2 jt) */
export function formatRupiahCompact(value: number): string {
  if (value >= 1_000_000) {
    const jt = value / 1_000_000
    return `Rp ${jt.toFixed(jt % 1 === 0 ? 0 : 1)} jt`
  }
  if (value >= 1_000) {
    const rb = value / 1_000
    return `Rp ${rb.toFixed(rb % 1 === 0 ? 0 : 1)} rb`
  }
  return `Rp ${value}`
}

/** Format a date string to Indonesian long date */
export function formatDateID(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d)
}

/** Format a date string to Indonesian short date */
export function formatDateShort(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso
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
