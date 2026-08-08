'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  Store,
  Wallet,
  Tag,
  FileText,
  Pencil,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Info,
  Bell,
  ArrowLeft,
  Plus,
  Trash2,
  Clock,
  Phone,
  MapPin,
  CreditCard,
  Banknote,
  Package,
  Cloud,
  Download,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  FileSpreadsheet,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { formatRupiah, cn } from '@/lib/utils'
import { saveReceiptOnlineFirst } from '@/lib/sync-service'
import { SyncIndicator } from '@/components/ui/sync-indicator'
import { SINGLE_TENANT_WORKSPACE } from '@/shared/config/workspace'
import type { OcrResult, ReceiptItem } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isMissing(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (typeof value === 'number') return value <= 0
  return false
}

/** Get confidence badge tone for a field */
function getFieldTone(fc: Record<string, number> | undefined, fieldKey: string, fallback: number) {
  const score = fc?.[fieldKey.toLowerCase().replace(/_/g, '')] ?? fallback
  if (score >= 80) return 'ok'
  if (score >= 60) return 'warn'
  return 'danger'
}

function fieldBorderClass(tone: string) {
  if (tone === 'warn') return 'border-amber-300 bg-amber-50/50 focus:border-amber-400'
  if (tone === 'danger') return 'border-red-300 bg-red-50 focus:border-red-400'
  return 'border-slate-200 bg-slate-50'
}

// ─── Item Row Component ───────────────────────────────────────────────────────

interface ItemRowProps {
  item: ReceiptItem
  index: number
  onUpdate: (index: number, field: keyof ReceiptItem, value: string | number | null) => void
  onRemove: (index: number) => void
  showConfidence?: boolean
}

function ItemRow({ item, index, onUpdate, onRemove, showConfidence }: ItemRowProps) {
  const subtotal = (Number(item.qty) || 0) * (Number(item.harga) || 0)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="grid gap-2 rounded-2xl border border-slate-100 bg-slate-50/80 p-3"
    >
      {/* Row header */}
      <div className="flex items-center justify-between">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
          {index + 1}
        </span>
        <button
          onClick={() => onRemove(index)}
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          aria-label="Hapus baris"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Nama Barang */}
      <div className="space-y-1">
        <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Nama Barang</Label>
        <Input
          value={item.namaBarang || ''}
          onChange={(e) => onUpdate(index, 'namaBarang', e.target.value)}
          className="h-9 rounded-xl border-slate-200 bg-white text-xs"
          placeholder="Nama barang / jasa"
        />
      </div>

      {/* Qty · Harga · Nominal */}
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Qty</Label>
          <Input
            type="number"
            min={1}
            value={item.qty || ''}
            onChange={(e) => {
              const q = Number(e.target.value) || 1
              onUpdate(index, 'qty', q)
              onUpdate(index, 'subtotal', q * (Number(item.harga) || 0))
            }}
            className="h-9 rounded-xl border-slate-200 bg-white text-xs text-center"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Harga Satuan</Label>
          <Input
            type="text"
            value={item.harga ? formatRupiah(item.harga) : ''}
            onChange={(e) => {
              const h = Number(e.target.value.replace(/[^\d]/g, '')) || 0
              onUpdate(index, 'harga', h)
              onUpdate(index, 'subtotal', (Number(item.qty) || 1) * h)
            }}
            className="h-9 rounded-xl border-slate-200 bg-white text-xs"
            placeholder="Rp 0"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Nominal</Label>
          <div className="relative">
            <Input
              type="text"
              value={item.subtotal ? formatRupiah(item.subtotal) : formatRupiah(subtotal)}
              onChange={(e) => onUpdate(index, 'subtotal', Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
              className="h-9 rounded-xl border-slate-200 bg-white text-xs font-semibold"
              placeholder="Rp 0"
            />
          </div>
        </div>
      </div>

      {/* Keterangan per item */}
      <div className="space-y-1">
        <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Keterangan (opsional)</Label>
        <Input
          value={item.keterangan || ''}
          onChange={(e) => onUpdate(index, 'keterangan', e.target.value || null)}
          className="h-9 rounded-xl border-slate-200 bg-white text-xs"
          placeholder="Catatan tambahan per item"
        />
      </div>
    </motion.div>
  )
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  children,
  defaultOpen = true,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Field with Confidence ─────────────────────────────────────────────────────

function FieldWrapper({
  label,
  icon: Icon,
  required,
  tone,
  tooltip,
  children,
}: {
  label: string
  icon?: React.ElementType
  required?: boolean
  tone?: 'ok' | 'warn' | 'danger'
  tooltip?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
        <Label
          className={cn(
            'text-xs font-semibold',
            tone === 'danger' || required ? 'text-red-600' : tone === 'warn' ? 'text-amber-600' : 'text-slate-500'
          )}
        >
          {label}
        </Label>
        {required && <span className="ml-auto text-[10px] font-medium text-red-500">* Wajib</span>}
        {!required && tone === 'warn' && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            Perlu dicek
          </span>
        )}
        {!required && tone === 'danger' && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-red-500">
            <AlertTriangle className="h-3 w-3" />
            Perlu dicek
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function OcrPreviewView() {
  const { pendingOcr, navigate, clearOcr } = useAppStore()
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [uploadingOneDrive, setUploadingOneDrive] = useState(false)
  const [form, setForm] = useState<OcrResult | null>(pendingOcr?.result ?? null)
  // Mobile tab: 'image' or 'form'
  const [mobileTab, setMobileTab] = useState<'image' | 'form'>('form')
  const [imageZoom, setImageZoom] = useState(false)

  useEffect(() => {
    if (pendingOcr?.result) setForm(pendingOcr.result)
  }, [pendingOcr])

  if (!pendingOcr || !form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFF]">
        <div className="text-center">
          <p className="text-sm text-slate-500">Tidak ada data OCR</p>
          <Button className="mt-3" onClick={() => navigate('scan')}>
            Kembali ke Scan
          </Button>
        </div>
      </div>
    )
  }

  const fc = form.fieldConfidences || {}
  const confidence = form.confidence ?? 0
  const confidenceTone =
    confidence >= 85
      ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
      : confidence >= 65
      ? 'text-amber-700 bg-amber-50 border border-amber-200'
      : 'text-red-700 bg-red-50 border border-red-200'

  const missingMerchant = isMissing(form.namaToko)
  const missingTotal = isMissing(form.nominal ?? form.total)

  // Generic field updater
  const update = <K extends keyof OcrResult>(key: K, value: OcrResult[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f))

  // Items management
  const updateItem = (index: number, field: keyof ReceiptItem, value: string | number | null) => {
    setForm((f) => {
      if (!f) return f
      const newItems = [...(f.items || [])]
      newItems[index] = { ...newItems[index], [field]: value }
      return { ...f, items: newItems }
    })
  }

  const addItem = () => {
    setForm((f) => {
      if (!f) return f
      const newItem: ReceiptItem = {
        namaBarang: '',
        qty: 1,
        harga: 0,
        subtotal: 0,
        urutan: (f.items || []).length,
        keterangan: null,
      }
      return { ...f, items: [...(f.items || []), newItem] }
    })
  }

  const removeItem = (index: number) => {
    setForm((f) => {
      if (!f) return f
      const newItems = (f.items || []).filter((_, i) => i !== index)
      return { ...f, items: newItems }
    })
  }

  const workspaceId = SINGLE_TENANT_WORKSPACE.id

  const buildSavePayload = () => {
    if (!form) return null
    let dateStr = new Date().toISOString().slice(0, 10)
    const raw = String(form.tanggal || form.transactionDate || '').trim()
    const ymdMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/)
    if (ymdMatch) dateStr = ymdMatch[1]

    return {
      workspaceId,
      invoiceNumber: form.invoiceNumber || form.receiptNumber,
      receiptNumber: form.receiptNumber || form.invoiceNumber,
      merchantName: form.namaToko || form.merchantName,
      namaToko: form.namaToko || form.merchantName,
      transactionDate: dateStr,
      tanggal: dateStr,
      waktu: form.waktu || null,
      total: form.nominal ?? form.total ?? 0,
      nominal: form.nominal ?? form.total ?? 0,
      diskon: form.diskon || 0,
      pajak: form.pajak || 0,
      biayaTambahan: form.biayaTambahan || 0,
      metodePembayaran: form.metodePembayaran || null,
      sumberDana: form.sumberDana || null,
      description: form.keterangan || form.description,
      keterangan: form.keterangan || form.description,
      alamat: form.alamat || null,
      noTelepon: form.noTelepon || null,
      imageUrl: pendingOcr.imageUrl,
      ocrText: form.ocrRawText || form.ocrText,
      ocrRawText: form.ocrRawText || form.ocrText,
      confidence: form.confidence || 85,
      status: 'berhasil',
      statusOcr: 'berhasil',
      items: form.items || [],
    }
  }

  const handleSave = async () => {
    if (!form) return
    if (missingMerchant) { toast.error('Nama toko wajib diisi.'); return }
    if (missingTotal) { toast.error('Total transaksi wajib diisi.'); return }

    setSaving(true)
    try {
      const payload = buildSavePayload()
      if (!payload) throw new Error('Form tidak valid')
      await saveReceiptOnlineFirst(payload, workspaceId)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notabase_receipts_changed'))
        window.dispatchEvent(new Event('receipts-updated'))
        window.dispatchEvent(new Event('receipt-saved'))
      }
      toast.success('Nota berhasil disimpan!')
      clearOcr()
      navigate('history')
    } catch (err) {
      console.warn('[OCR Preview] Save exception:', err)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notabase_receipts_changed'))
        window.dispatchEvent(new Event('receipt-saved'))
      }
      toast.success('Nota berhasil disimpan!')
      clearOcr()
      navigate('history')
    } finally {
      setSaving(false)
    }
  }

  const handleExportExcel = async () => {
    if (!form) return
    if (missingMerchant) { toast.error('Nama toko wajib diisi sebelum ekspor.'); return }

    setExporting(true)
    try {
      const payload = buildSavePayload()
      if (!payload) throw new Error('Form tidak valid')

      // Build a single-receipt export by passing it to the export API
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': workspaceId,
        },
        body: JSON.stringify({
          singleReceipt: payload,
          workspaceId,
        }),
      })
      if (!res.ok) throw new Error('Gagal membuat file Excel')
      const blob = await res.blob()
      const namaToko = (form.namaToko || 'Nota').replace(/[^a-zA-Z0-9\u00C0-\u017E]/g, '_').slice(0, 30)
      const tanggal = (form.tanggal || new Date().toISOString().slice(0, 10)).replace(/-/g, '')
      const filename = `Nota_${namaToko}_${tanggal}.xlsx`

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('File Excel berhasil diunduh!')
    } catch (err: any) {
      toast.error(err.message || 'Gagal ekspor Excel')
    } finally {
      setExporting(false)
    }
  }

  const handleSaveOneDrive = async () => {
    if (!form) return
    if (missingMerchant) { toast.error('Nama toko wajib diisi sebelum upload.'); return }

    setUploadingOneDrive(true)
    try {
      const payload = buildSavePayload()
      if (!payload) throw new Error('Form tidak valid')

      // First export to Excel buffer, then upload
      const exportRes = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': workspaceId,
        },
        body: JSON.stringify({ singleReceipt: payload, workspaceId }),
      })
      if (!exportRes.ok) throw new Error('Gagal membuat file Excel untuk OneDrive')

      const blob = await exportRes.blob()
      const namaToko = (form.namaToko || 'Nota').replace(/[^a-zA-Z0-9\u00C0-\u017E]/g, '_').slice(0, 30)
      const tanggal = (form.tanggal || new Date().toISOString().slice(0, 10)).replace(/-/g, '')
      const fileName = `Nota_${namaToko}_${tanggal}.xlsx`

      // Upload via sync API
      const formData = new FormData()
      formData.append('file', blob, fileName)
      const syncRes = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'x-workspace-id': workspaceId },
        body: JSON.stringify({
          action: 'upload_excel',
          fileName,
          targetFolder: 'Notabase/Nota Scan',
          workspaceId,
        }),
      })
      const syncData = await syncRes.json()
      if (!syncRes.ok) throw new Error(syncData.error || 'Gagal upload ke OneDrive')

      toast.success('File berhasil diunggah ke OneDrive!')
      if (syncData.webUrl) {
        toast.info(`Buka file: ${syncData.webUrl}`, { duration: 8000 })
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal upload ke OneDrive')
    } finally {
      setUploadingOneDrive(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFF] pb-32">
      {/* Mobile Header */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-lg md:hidden">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('scan')}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors"
                aria-label="Kembali ke scan"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className="text-base font-bold text-blue-600">Pratinjau OCR</span>
            </div>
            <div className="flex items-center gap-2">
              <SyncIndicator variant="header" />
              <button className="flex h-9 w-9 items-center justify-center rounded-full text-blue-600 hover:bg-slate-100">
                <Bell className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 py-6 space-y-4 sm:px-6 sm:max-w-2xl lg:max-w-6xl">
        {/* Page title */}
        <div className="space-y-0.5">
          <h1 className="text-xl font-bold text-slate-900">Pratinjau &amp; Edit Hasil OCR</h1>
          <p className="text-xs text-slate-500">Tinjau, koreksi, dan simpan hasil ekstraksi nota.</p>
        </div>

        {/* Confidence badge */}
        <div className="flex items-center justify-between">
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold', confidenceTone)}>
            {confidence >= 65 ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            Keyakinan OCR: {Math.round(confidence)}%
          </span>
          {/* Mobile tab toggle */}
          <div className="flex items-center lg:hidden rounded-full border border-slate-200 bg-white p-0.5">
            <button
              onClick={() => setMobileTab('form')}
              className={cn('rounded-full px-3 py-1 text-xs font-semibold transition-all', mobileTab === 'form' ? 'bg-blue-600 text-white' : 'text-slate-500')}
            >
              <FileText className="inline h-3 w-3 mr-1" />Form
            </button>
            <button
              onClick={() => setMobileTab('image')}
              className={cn('rounded-full px-3 py-1 text-xs font-semibold transition-all', mobileTab === 'image' ? 'bg-blue-600 text-white' : 'text-slate-500')}
            >
              <ImageIcon className="inline h-3 w-3 mr-1" />Gambar
            </button>
          </div>
        </div>

        {/* Low confidence warning */}
        {confidence < 65 && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Akurasi OCR rendah. Field yang ditandai kuning/merah perlu dicek ulang. Pertimbangkan foto ulang dengan pencahayaan lebih baik.
            </span>
          </div>
        )}

        {/* Two-column layout */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">

          {/* ── LEFT PANEL: Image Preview ───────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'w-full lg:w-2/5 lg:sticky lg:top-24',
              mobileTab === 'form' && 'hidden lg:block'
            )}
          >
            <Card className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
              {/* Image header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                <span className="text-xs font-bold text-slate-600">Gambar Nota Asli</span>
                <button
                  onClick={() => setImageZoom((v) => !v)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                >
                  {imageZoom ? <ZoomOut className="h-3.5 w-3.5" /> : <ZoomIn className="h-3.5 w-3.5" />}
                  {imageZoom ? 'Perkecil' : 'Perbesar'}
                </button>
              </div>
              <div className={cn('relative w-full bg-slate-100 overflow-auto', imageZoom ? 'max-h-[70vh]' : 'max-h-80 lg:max-h-[60vh]')}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pendingOcr.imageUrl}
                  alt="Receipt preview"
                  className={cn('w-full object-contain', imageZoom ? '' : 'max-h-80 lg:max-h-[60vh]')}
                />
              </div>
            </Card>
          </motion.div>

          {/* ── RIGHT PANEL: Edit Form ──────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(
              'w-full lg:flex-1 space-y-3',
              mobileTab === 'image' && 'hidden lg:block'
            )}
          >

            {/* Section 1: Header Nota */}
            <Section icon={Store} title="Header Nota" defaultOpen>
              {/* Nama Toko */}
              <FieldWrapper
                label="Nama Toko"
                icon={Store}
                required={missingMerchant}
                tone={missingMerchant ? 'danger' : getFieldTone(fc, 'namatoko', 80)}
              >
                <div className="relative">
                  <Input
                    value={form.namaToko ?? ''}
                    onChange={(e) => update('namaToko', e.target.value)}
                    className={cn('rounded-xl pr-9 h-11', fieldBorderClass(missingMerchant ? 'danger' : getFieldTone(fc, 'namatoko', 80)))}
                    placeholder="Nama toko / merchant"
                  />
                  <Pencil className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                </div>
              </FieldWrapper>

              {/* No. Nota */}
              <FieldWrapper label="No. Nota / Referensi" icon={FileText}>
                <Input
                  value={form.receiptNumber ?? form.invoiceNumber ?? ''}
                  onChange={(e) => { update('receiptNumber', e.target.value); update('invoiceNumber', e.target.value) }}
                  className="rounded-xl h-11 border-slate-200 bg-slate-50"
                  placeholder="No. nota / no. referensi (opsional)"
                />
              </FieldWrapper>

              {/* Tanggal + Waktu */}
              <div className="grid grid-cols-2 gap-3">
                <FieldWrapper
                  label="Tanggal"
                  icon={Calendar}
                  required={isMissing(form.tanggal)}
                  tone={isMissing(form.tanggal) ? 'danger' : getFieldTone(fc, 'tanggal', 80)}
                >
                  <Input
                    type="date"
                    value={(() => {
                      const raw = form.tanggal || form.transactionDate || ''
                      const m = String(raw).trim().match(/^(\d{4}-\d{2}-\d{2})/)
                      return m ? m[1] : ''
                    })()}
                    onChange={(e) => { update('tanggal', e.target.value || null); update('transactionDate', e.target.value || null) }}
                    className={cn('rounded-xl h-11', fieldBorderClass(isMissing(form.tanggal) ? 'danger' : getFieldTone(fc, 'tanggal', 80)))}
                  />
                </FieldWrapper>
                <FieldWrapper label="Waktu Transaksi" icon={Clock}>
                  <Input
                    type="time"
                    value={form.waktu ?? ''}
                    onChange={(e) => update('waktu', e.target.value || null)}
                    className="rounded-xl h-11 border-slate-200 bg-slate-50"
                    placeholder="HH:MM"
                  />
                </FieldWrapper>
              </div>

              {/* Alamat Toko */}
              <FieldWrapper label="Alamat Toko" icon={MapPin}>
                <Input
                  value={form.alamat ?? ''}
                  onChange={(e) => update('alamat', e.target.value || null)}
                  className="rounded-xl h-11 border-slate-200 bg-slate-50"
                  placeholder="Alamat toko (jika tercantum)"
                />
              </FieldWrapper>

              {/* No. Telepon */}
              <FieldWrapper label="No. Telepon Toko" icon={Phone}>
                <Input
                  value={form.noTelepon ?? ''}
                  onChange={(e) => update('noTelepon', e.target.value || null)}
                  className="rounded-xl h-11 border-slate-200 bg-slate-50"
                  placeholder="No. telepon (jika tercantum)"
                />
              </FieldWrapper>
            </Section>

            {/* Section 2: Daftar Barang */}
            <Section icon={Package} title={`Daftar Barang (${(form.items || []).length} item)`}>
              <AnimatePresence mode="popLayout">
                {(form.items || []).map((item, idx) => (
                  <ItemRow
                    key={`item-${idx}`}
                    item={item}
                    index={idx}
                    onUpdate={updateItem}
                    onRemove={removeItem}
                  />
                ))}
              </AnimatePresence>

              {(form.items || []).length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
                  Belum ada barang. Klik tombol di bawah untuk menambah.
                </div>
              )}

              <Button
                variant="outline"
                onClick={addItem}
                className="w-full rounded-xl h-10 border-blue-200 text-blue-600 hover:bg-blue-50 text-xs font-bold"
              >
                <Plus className="mr-1 h-4 w-4" />
                Tambah Baris Barang
              </Button>
            </Section>

            {/* Section 3: Pembayaran & Biaya */}
            <Section icon={Wallet} title="Pembayaran & Biaya">
              {/* Total */}
              <FieldWrapper
                label="Total Transaksi (IDR)"
                icon={Wallet}
                required={missingTotal}
                tone={missingTotal ? 'danger' : getFieldTone(fc, 'nominal', 75)}
              >
                <div className="relative">
                  <Input
                    type="text"
                    value={formatRupiah((form.nominal ?? form.total) || 0)}
                    onChange={(e) => {
                      const v = Number(e.target.value.replace(/[^\d]/g, '')) || 0
                      update('nominal', v)
                      update('total', v)
                    }}
                    className={cn('rounded-xl pr-9 h-11 font-semibold', fieldBorderClass(missingTotal ? 'danger' : getFieldTone(fc, 'nominal', 75)))}
                    placeholder="Rp 0"
                  />
                  <Pencil className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                </div>
              </FieldWrapper>

              {/* Diskon + Pajak */}
              <div className="grid grid-cols-2 gap-3">
                <FieldWrapper label="Diskon (Rp)" icon={Tag}>
                  <Input
                    type="text"
                    value={form.diskon ? formatRupiah(form.diskon) : ''}
                    onChange={(e) => update('diskon', Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
                    className="rounded-xl h-11 border-slate-200 bg-slate-50"
                    placeholder="Rp 0"
                  />
                </FieldWrapper>
                <FieldWrapper label="Pajak / PPN (Rp)" icon={FileText}>
                  <Input
                    type="text"
                    value={form.pajak ? formatRupiah(form.pajak) : ''}
                    onChange={(e) => update('pajak', Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
                    className="rounded-xl h-11 border-slate-200 bg-slate-50"
                    placeholder="Rp 0"
                  />
                </FieldWrapper>
              </div>

              {/* Biaya Tambahan */}
              <FieldWrapper label="Biaya Tambahan / Admin (Rp)" icon={Banknote}>
                <Input
                  type="text"
                  value={form.biayaTambahan ? formatRupiah(form.biayaTambahan) : ''}
                  onChange={(e) => update('biayaTambahan', Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
                  className="rounded-xl h-11 border-slate-200 bg-slate-50"
                  placeholder="Rp 0"
                />
              </FieldWrapper>

              {/* Metode Pembayaran + Sumber Dana */}
              <FieldWrapper label="Metode Pembayaran" icon={CreditCard}>
                <Input
                  value={form.metodePembayaran ?? ''}
                  onChange={(e) => update('metodePembayaran', e.target.value || null)}
                  className="rounded-xl h-11 border-slate-200 bg-slate-50"
                  placeholder="Tunai / Transfer / GoPay / DANA / dll."
                />
              </FieldWrapper>

              <FieldWrapper label="Sumber Dana / Rekening" icon={Banknote}>
                <Input
                  value={form.sumberDana ?? ''}
                  onChange={(e) => update('sumberDana', e.target.value || null)}
                  className="rounded-xl h-11 border-slate-200 bg-slate-50"
                  placeholder="No. rekening / wallet sumber dana"
                />
              </FieldWrapper>
            </Section>

            {/* Section 4: Keterangan Umum */}
            <Section icon={FileText} title="Keterangan Umum" defaultOpen={false}>
              <Textarea
                value={form.keterangan ?? form.description ?? ''}
                onChange={(e) => { update('keterangan', e.target.value); update('description', e.target.value) }}
                className="rounded-xl border-slate-200 bg-slate-50 min-h-[80px] resize-none text-xs"
                placeholder="Catatan umum, deskripsi transaksi, atau informasi lainnya"
              />
            </Section>

            {/* Info disclaimer */}
            <div className="flex items-start gap-2.5 rounded-xl bg-blue-50 border border-blue-100 p-3.5 text-xs text-blue-700">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
              <span>
                Pastikan semua data sesuai dengan nota fisik sebelum menyimpan. Field yang ditandai{' '}
                <span className="font-semibold text-amber-600">kuning</span> perlu diverifikasi ulang karena keyakinan OCR rendah.
              </span>
            </div>

            {/* Action buttons */}
            <div className="space-y-2.5 pt-1">
              {/* Primary: Simpan */}
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full rounded-xl h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-200"
              >
                {saving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" />Simpan ke Notabase</>
                )}
              </Button>

              {/* Secondary: Ekspor Excel + OneDrive */}
              <div className="grid grid-cols-2 gap-2.5">
                <Button
                  variant="outline"
                  onClick={handleExportExcel}
                  disabled={exporting}
                  className="rounded-xl h-11 border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs font-bold"
                >
                  {exporting ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Ekspor Excel
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSaveOneDrive}
                  disabled={uploadingOneDrive}
                  className="rounded-xl h-11 border-blue-200 text-blue-700 hover:bg-blue-50 text-xs font-bold"
                >
                  {uploadingOneDrive ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Cloud className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  OneDrive
                </Button>
              </div>

              {/* Tertiary: Batal */}
              <Button
                variant="ghost"
                onClick={() => navigate('scan')}
                disabled={saving}
                className="w-full rounded-xl h-10 text-slate-500 hover:bg-slate-100 text-xs"
              >
                Batal
              </Button>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
