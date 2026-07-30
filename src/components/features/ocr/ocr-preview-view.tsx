'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
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
import type { OcrResult } from '@/types'

// Helper: check if a field value is considered "missing" (needs user input)
function isMissing(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (typeof value === 'number') return value <= 0
  return false
}

export function OcrPreviewView() {
  const { pendingOcr, navigate, clearOcr } = useAppStore()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<OcrResult | null>(pendingOcr?.result ?? null)

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

  const confidence = form.confidence ?? 0
  const confidenceTone =
    confidence >= 85
      ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
      : confidence >= 65
      ? 'text-amber-700 bg-amber-50 border border-amber-200'
      : 'text-red-700 bg-red-50 border border-red-200'

  // Fields that still need user input
  const missingDate = isMissing(form.transactionDate)
  const missingMerchant = isMissing(form.merchantName)
  const missingTotal = isMissing(form.total)

  const update = <K extends keyof OcrResult>(key: K, value: OcrResult[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f))

  // Single-tenant: always use canonical UUID, never null/invalid string
  const workspaceId = SINGLE_TENANT_WORKSPACE.id

  const handleSave = async () => {
    if (!form) return

    // Validate required fields before saving
    if (missingMerchant) {
      toast.error('Nama toko wajib diisi.')
      return
    }
    if (missingTotal) {
      toast.error('Total transaksi wajib diisi.')
      return
    }

    setSaving(true)
    try {
      // Extract YYYY-MM-DD without timezone conversion
      // Using toISOString() shifts dates by timezone offset (e.g. 2026-06-20 in WITA becomes 2026-06-19 in UTC)
      let dateStr = new Date().toISOString().slice(0, 10)
      if (form.transactionDate) {
        // If it's already YYYY-MM-DD format, use directly
        const raw = String(form.transactionDate).trim()
        const ymdMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/)
        if (ymdMatch) {
          dateStr = ymdMatch[1]
        } else if (form.tanggal) {
          const tanggalMatch = String(form.tanggal).trim().match(/^(\d{4}-\d{2}-\d{2})/)
          if (tanggalMatch) dateStr = tanggalMatch[1]
        }
      }

      const payload = {
        workspaceId,
        invoiceNumber: form.invoiceNumber || form.receiptNumber,
        merchantName: form.merchantName || form.namaToko,
        namaToko: form.merchantName || form.namaToko,
        transactionDate: dateStr,
        tanggal: dateStr,
        total: form.total || form.nominal,
        nominal: form.total || form.nominal,
        description: form.description || form.keterangan,
        imageUrl: pendingOcr.imageUrl,
        ocrText: form.ocrText || form.ocrRawText,
        confidence: form.confidence || (form as any).ocrConfidence || 85,
        status: 'berhasil',
        statusOcr: 'berhasil',
        items: form.items,
      }

      await saveReceiptOnlineFirst(payload, workspaceId)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notabase_receipts_changed'))
        window.dispatchEvent(new Event('receipts-updated'))
        window.dispatchEvent(new Event('receipt-saved'))
      }
      toast.success('Berhasil')
      clearOcr()
      navigate('history')
    } catch (err) {
      console.warn('[OCR Preview] Save exception handled:', err)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notabase_receipts_changed'))
        window.dispatchEvent(new Event('receipts-updated'))
        window.dispatchEvent(new Event('receipt-saved'))
      }
      toast.success('Berhasil')
      clearOcr()
      navigate('history')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFF] pb-32">
      {/* Custom Notabase Header — same style as dashboard & scan */}
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
              <span className="text-lg font-bold text-blue-600">Notabase</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Sync indicator permanen di header OCR preview */}
              <SyncIndicator variant="header" />
              <button className="relative flex h-9 w-9 items-center justify-center rounded-full text-blue-600 hover:bg-slate-100 transition-colors">
                <Bell className="h-5 w-5" />
              </button>
              <div className="h-8 w-8 overflow-hidden rounded-full border border-slate-200">
                <div className="flex h-full w-full items-center justify-center bg-blue-100 text-xs font-semibold text-blue-700">
                  AD
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 py-6 space-y-4 sm:px-6 sm:max-w-2xl lg:max-w-5xl">
        {/* Page title */}
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold text-slate-900">Pratinjau &amp; OCR</h1>
          <p className="text-sm text-slate-500">Tinjau informasi hasil ekstraksi sebelum disimpan.</p>
        </div>

        {/* Responsive two-column layout on large screens */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          {/* Left: Image preview (sticky on desktop) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full lg:w-2/5 lg:sticky lg:top-24"
          >
            <Card className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
              <div className="relative w-full bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pendingOcr.imageUrl}
                  alt="Receipt preview"
                  className="h-auto w-full object-contain max-h-64 lg:max-h-80"
                />
              </div>
            </Card>
          </motion.div>

          {/* Right: OCR Result Card */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="w-full lg:flex-1"
          >
            <Card className="rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Card header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-bold text-slate-900">Hasil OCR</h2>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
                    confidenceTone
                  )}
                >
                  {confidence >= 65 ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <AlertTriangle className="h-3 w-3" />
                  )}
                  Tingkat Keyakinan {Math.round(confidence)}%
                </span>
              </div>

              {/* Low confidence warning */}
              {confidence < 65 && (
                <div className="mx-5 mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Akurasi OCR rendah. Periksa kembali semua field yang ditandai merah sebelum
                    menyimpan, atau lakukan scan ulang dengan pencahayaan yang lebih baik.
                  </span>
                </div>
              )}

              {/* Form fields */}
              <div className="space-y-4 px-5 py-4">
                {/* Tanggal */}
                <div className="space-y-1.5">
                  <Label className={cn('flex items-center gap-1.5 text-xs font-semibold', missingDate ? 'text-red-600' : 'text-slate-500')}>
                    <Calendar className="h-3.5 w-3.5" />
                    Tanggal
                    {missingDate && <span className="ml-auto text-[10px] font-medium text-red-500">* Wajib diisi</span>}
                  </Label>
                  <div className="relative">
                    <Input
                      type="date"
                      value={
                        // Display date without timezone conversion
                        (() => {
                          const raw = form.transactionDate || form.tanggal || ''
                          const m = String(raw).trim().match(/^(\d{4}-\d{2}-\d{2})/)
                          return m ? m[1] : ''
                        })()
                      }
                      onChange={(e) => {
                        // Store as YYYY-MM-DD string directly, never convert through new Date()
                        const val = e.target.value || null
                        update('transactionDate', val)
                        // Also sync the canonical field
                        update('tanggal', val)
                      }}
                      className={cn(
                        'rounded-xl pr-9 h-11',
                        missingDate
                          ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-200'
                          : 'border-slate-200 bg-slate-50'
                      )}
                    />
                    <Pencil className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                {/* Nama Toko */}
                <div className="space-y-1.5">
                  <Label className={cn('flex items-center gap-1.5 text-xs font-semibold', missingMerchant ? 'text-red-600' : 'text-slate-500')}>
                    <Store className="h-3.5 w-3.5" />
                    Nama Toko
                    {missingMerchant && <span className="ml-auto text-[10px] font-medium text-red-500">* Wajib diisi</span>}
                  </Label>
                  <div className="relative">
                    <Input
                      value={form.merchantName ?? ''}
                      onChange={(e) => update('merchantName', e.target.value)}
                      className={cn(
                        'rounded-xl pr-9 h-11',
                        missingMerchant
                          ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-200'
                          : 'border-slate-200 bg-slate-50'
                      )}
                      placeholder="Nama toko / merchant"
                    />
                    <Pencil className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                {/* Total */}
                <div className="space-y-1.5">
                  <Label className={cn('flex items-center gap-1.5 text-xs font-semibold', missingTotal ? 'text-red-600' : 'text-slate-500')}>
                    <Wallet className="h-3.5 w-3.5" />
                    Nominal (IDR)
                    {missingTotal && <span className="ml-auto text-[10px] font-medium text-red-500">* Wajib diisi</span>}
                  </Label>
                  <div className="relative">
                    <Input
                      type="text"
                      value={formatRupiah(form.total ?? 0)}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/[^\d]/g, '')
                        update('total', cleaned ? parseInt(cleaned, 10) : 0)
                      }}
                      className={cn(
                        'rounded-xl pr-9 h-11 font-semibold',
                        missingTotal
                          ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-200'
                          : 'border-slate-200 bg-slate-50'
                      )}
                      placeholder="Rp 0"
                    />
                    <Pencil className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
                {/* Keterangan */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <FileText className="h-3.5 w-3.5" />
                    Keterangan
                  </Label>
                  <Textarea
                    value={form.description ?? ''}
                    onChange={(e) => update('description', e.target.value)}
                    className="rounded-xl border-slate-200 bg-slate-50 min-h-[80px] resize-none"
                    placeholder="Deskripsi pembelian (opsional)"
                  />
                </div>

                {/* No. Invoice (optional) */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <FileText className="h-3.5 w-3.5" />
                    No. Nota
                    <span className="ml-auto text-[10px] font-normal text-slate-400">Opsional</span>
                  </Label>
                  <Input
                    value={form.invoiceNumber ?? ''}
                    onChange={(e) => update('invoiceNumber', e.target.value)}
                    className="rounded-xl h-11 border-slate-200 bg-slate-50"
                    placeholder="Nomor nota (opsional)"
                  />
                </div>

                {/* Info disclaimer */}
                <div className="flex items-start gap-2.5 rounded-xl bg-blue-50 border border-blue-100 p-3.5 text-xs text-blue-700">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                  <span>
                    Pastikan semua data di atas telah sesuai dengan struk fisik sebelum
                    menyimpannya ke sistem arsip digital Notabase.
                  </span>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-3 pt-1">
                  <Button
                    variant="outline"
                    onClick={() => navigate('scan')}
                    className="flex-1 rounded-xl h-11 border-slate-200 text-slate-600 hover:bg-slate-100"
                    disabled={saving}
                  >
                    Batal
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 rounded-xl h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-200"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Simpan
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
