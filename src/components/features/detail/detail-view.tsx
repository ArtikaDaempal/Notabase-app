'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Printer,
  Share2,
  Trash2,
  ShoppingBag,
  FileText,
  Calendar,
  Wallet,
  Hash,
  ShieldCheck,
  Info,
  Loader2,
  Bell,
  ArrowLeft,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Pencil,
  Save,
  X,
  Store,
  Tag,
  Phone,
  Calculator,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { SINGLE_TENANT_WORKSPACE } from '@/shared/config/workspace'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { formatRupiah, formatDateID, formatTime, cn, isValidInvoiceNumber, normalizeReceiptItem, reconcileReceiptItems } from '@/lib/utils'
import { downloadReceiptImage } from '@/lib/download-image'
import { ImageLightbox } from '@/components/features/gallery/image-lightbox'
import type { Receipt } from '@/types'

/**
 * Client-side invoice number extractor — mirrors parseInvoice in api/ocr/route.ts.
 * Used to recover invoice numbers from stored ocrRawText for already-saved receipts.
 */
function extractInvoiceFromText(text: string): string | null {
  if (!text) return null

  const clean = (raw: string): string | null => {
    const c = raw.replace(/^[#:\s]+/, '').replace(/\s+/g, '').trim()
    return isValidInvoiceNumber(c) ? c : null
  }

  // Labeled patterns — allow spaces inside captured number for OCR splits
  const labeled: RegExp[] = [
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
  for (const p of labeled) {
    const m = text.match(p)
    if (m && m[1]) {
      const r = clean(m[1].split(/\n/)[0].trim())
      if (r) return r
    }
  }

  // Standalone prefix patterns
  const prefix: RegExp[] = [
    /\b(INV[A-Z0-9]{5,}\s?[A-Z0-9]{0,10})\b/i,
    /\b(TRX[A-Z0-9]{5,}\s?[A-Z0-9]{0,10})\b/i,
    /\b(ORD[A-Z0-9]{5,}\s?[A-Z0-9]{0,10})\b/i,
    /\b(REF[A-Z0-9]{5,}\s?[A-Z0-9]{0,10})\b/i,
  ]
  for (const p of prefix) {
    const m = text.match(p)
    if (m && m[1]) {
      const r = clean(m[1])
      if (r) return r
    }
  }

  return null
}

function getItemsForDisplay(receipt: any): any[] {
  if (!receipt) return []

  let list: any[] = []

  if (receipt.items && Array.isArray(receipt.items) && receipt.items.length > 0) {
    list = reconcileReceiptItems(receipt.items, receipt.total ?? receipt.nominal)
  } else {
    const text = receipt.ocrRawText || receipt.ocrText || ''
    if (text) {
      const lines = text.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean)
      const parsed: any[] = []
      const invalidNames = new Set([
        'BANYAKNYA', 'NAMA BARANG', 'HARGA', 'TOTAL', 'SUBTOTAL', 'GRAND TOTAL',
        'QTY', 'ITEM', 'JUMLAH', 'BAYAR', 'KEMBALI', 'KASIR', 'TANGGAL', 'NOTA',
        'STATUS', 'TERBAYAR', 'INVOICE', 'PEMBAYARAN', 'TAGIHAN', 'KEPADA'
      ])

      for (const line of lines) {
        const upper = line.toUpperCase()
        if (invalidNames.has(upper) || /^(tanda|hormat|terima|total|subtotal|jumlah|bayar|kembali|cash|status|tanggal|invoice|terbayar)/i.test(line)) {
          continue
        }
        const m = line.match(/^(.+?)\s+(?:rp\.?\s*)?([\d.]+)\s*$/i)
        if (m) {
          let name = m[1]
            .replace(/^(?:rp\.?\s*[\d.]*\s*)+/gi, '')  // strip leading Rp prefix
            .replace(/(?:\s*rp\.?\s*[\d.]*)+$/gi, '')  // strip trailing Rp suffix
            .replace(/\b(?:rp|rupiah|jumlah|total|subtotal)\b/gi, '')
            .trim()
          const price = parseFloat(m[2].replace(/\./g, ''))
          if (name && name.length >= 2 && !isNaN(price) && price > 0) {
            parsed.push({ namaBarang: name, qty: 1, harga: price, subtotal: price })
          }
        }
      }

      if (parsed.length > 0) {
        list = reconcileReceiptItems(parsed, receipt.total ?? receipt.nominal)
      }
    }
  }

  // Include Biaya Layanan / Admin as distinct item row if present and not already listed
  const fee = Number(receipt.biayaTambahan ?? 0)
  if (fee > 0) {
    const hasFeeRow = list.some((it) => /biaya\s*(layanan|admin|transaksi)|fee/i.test(it.namaBarang || it.name || ''))
    if (!hasFeeRow) {
      list.push({
        namaBarang: 'Biaya Layanan / Admin',
        qty: 1,
        harga: fee,
        subtotal: fee,
        urutan: list.length,
      })
    }
  }

  return list
}

export function DetailView() {
  const { selectedReceiptId, goBack } = useAppStore()
  // Single-tenant: always use canonical UUID, never null/invalid strings
  const workspaceId = SINGLE_TENANT_WORKSPACE.id
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [loading, setLoading] = useState(true)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Receipt>>({})
  const [showOcr, setShowOcr] = useState(false)
  const [cardZoom, setCardZoom] = useState(1.0)

  const fetchReceiptDetail = () => {
    if (!selectedReceiptId) return
    setLoading(true)
    fetch(`/api/receipts/${selectedReceiptId}`, {
      headers: { 'x-workspace-id': workspaceId },
    })
      .then((r) => {
        if (!r.ok) throw new Error('Nota tidak ditemukan')
        return r.json()
      })
      .then((d) => {
        const rawInv = d.receipt_number || d.receiptNumber || d.invoice_number || d.invoiceNumber || ''
        const rawOcr = d.ocr_raw_text || d.ocrRawText || d.ocrText || ''
        // Fallback: if no invoice stored, try to extract from ocrRawText (for already-saved receipts)
        const storedInv = isValidInvoiceNumber(rawInv) ? rawInv : ''
        const cleanInv = storedInv || extractInvoiceFromText(rawOcr) || ''
        const cleanDate = d.tanggal || d.transactionDate ? String(d.tanggal || d.transactionDate).slice(0, 10) : ''
        const existingItems = Array.isArray(d.items) && d.items.length > 0 ? d.items : (Array.isArray(d.receipt_items) ? d.receipt_items : [])
        const fallbackItems = extractItemsFromOcrText(rawOcr)
        const finalItems = existingItems.length > 0 ? existingItems : fallbackItems

        const cleanedData = {
          ...d,
          merchantName: d.nama_toko || d.namaToko || d.merchantName || '-',
          namaToko: d.nama_toko || d.namaToko || d.merchantName || '-',
          invoiceNumber: cleanInv,
          receiptNumber: cleanInv,
          transactionDate: cleanDate,
          tanggal: cleanDate,
          total: Number(d.nominal ?? d.total ?? 0),
          nominal: Number(d.nominal ?? d.total ?? 0),
          description: d.keterangan || d.description || '',
          keterangan: d.keterangan || d.description || '',
          ocrText: rawOcr,
          items: finalItems,
        }
        setReceipt(cleanedData)
        setEditForm(cleanedData)
      })
      .catch((err) => {
        console.warn('[DetailView] Error loading receipt:', err)
        setReceipt(null)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchReceiptDetail()
  }, [selectedReceiptId, workspaceId])

  const handleDelete = async () => {
    if (!receipt) return
    if (!confirm('Hapus nota ini?')) return
    try {
      const res = await fetch(`/api/receipts/${receipt.id}`, {
        method: 'DELETE',
        headers: { 'x-workspace-id': workspaceId },
      })
      if (!res.ok) throw new Error()
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notabase_receipts_changed'))
        window.dispatchEvent(new Event('receipts-updated'))
        window.dispatchEvent(new Event('receipt-deleted'))
      }
      toast.success('Berhasil terhapus')
      goBack()
    } catch {
      toast.error('Gagal menghapus nota')
    }
  }

  const handleSaveEdit = async () => {
    if (!receipt || !editForm) return
    setSaving(true)
    
    const rawInv = editForm.invoiceNumber || editForm.receiptNumber || ''
    const cleanInv = isValidInvoiceNumber(rawInv) ? rawInv : ''

    // Parse items from the edited OCR table (fallback to existing items)
    const ocrToParse = (editForm.ocrRawText || editForm.ocrText || receipt.ocrRawText || receipt.ocrText || '')
    const parsedItems = extractItemsFromOcrText(ocrToParse)
    let finalItems = parsedItems.length > 0 ? parsedItems : (editForm.items || [])

    // Filter out header-like item names (e.g. "BANYAKNYA", "HARGA")
    finalItems = finalItems.filter((it) => {
      const name = String(it.namaBarang || it.name || '').trim().toUpperCase()
      return name && !['BANYAKNYA', 'NAMA BARANG', 'HARGA', 'SATUAN', 'QTY', 'JUMLAH HARGA', 'SUBTOTAL', 'TOTAL', 'BARANG'].includes(name)
    })

    const dateVal = editForm.transactionDate || editForm.tanggal || new Date().toISOString().slice(0, 10)
    const cleanDate = String(dateVal).slice(0, 10)

    const payload = {
      merchantName: editForm.merchantName || editForm.namaToko || 'Nota Belanja',
      namaToko: editForm.merchantName || editForm.namaToko || 'Nota Belanja',
      transactionDate: cleanDate,
      tanggal: cleanDate,
      total: Number(editForm.total ?? editForm.nominal ?? 0),
      nominal: Number(editForm.total ?? editForm.nominal ?? 0),
      subtotalNominal: Number(editForm.subtotalNominal) || undefined,
      noTelepon: editForm.noTelepon || null,
      biayaTambahan: Number(editForm.biayaTambahan) || 0,
      namaBiayaTambahan: editForm.namaBiayaTambahan || null,
      invoiceNumber: cleanInv,
      receiptNumber: cleanInv,
      description: editForm.description || editForm.keterangan || '',
      keterangan: editForm.description || editForm.keterangan || '',
      items: finalItems,
      ocrText: editForm.ocrText || editForm.ocrRawText || '',
      ocrRawText: editForm.ocrText || editForm.ocrRawText || '',
    }

    try {
      const res = await fetch(`/api/receipts/${receipt.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': workspaceId,
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      const merged = {
        ...updated,
        invoiceNumber: cleanInv,
        receiptNumber: cleanInv,
        transactionDate: cleanDate,
        tanggal: cleanDate,
      }
      setReceipt(merged)
      setEditForm(merged)
      setIsEditing(false)
      toast.success('Berhasil')
    } catch {
      toast.error('Gagal menyimpan perubahan')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditForm(receipt ?? {})
    setIsEditing(false)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleShare = async () => {
    if (!receipt) return
    const text = `📋 Nota dari ${receipt.merchantName}\n📅 ${formatDateID(receipt.transactionDate)}\n💰 ${formatRupiah(receipt.total)}`
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: `Nota ${receipt.merchantName}`, text })
      } catch {
        // user cancelled share
      }
    } else {
      await navigator.clipboard.writeText(text)
      toast.success('Detail nota disalin ke clipboard')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFF]">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!receipt) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F8FAFF]">
        <p className="text-sm text-slate-500">Nota tidak ditemukan</p>
        <Button onClick={goBack}>Kembali</Button>
      </div>
    )
  }

  const rawInv = receipt.receiptNumber || receipt.invoiceNumber
  const validInvoice = isValidInvoiceNumber(rawInv) ? rawInv : null

  return (
    <div className="min-h-screen bg-[#F8FAFF] pb-32">
      {receipt.imageUrl && (
        <>
          <div className="hidden print-only-container">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={receipt.imageUrl}
              alt="Print nota"
              className="print-only-image"
            />
          </div>
          <style>{`
            .print-only-container {
              display: none;
            }
            @media print {
              main, header {
                display: none !important;
              }
              .print-only-container {
                display: block !important;
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                z-index: 99999 !important;
                background: white !important;
              }
              .print-only-image {
                width: 100% !important;
                height: 100% !important;
                object-fit: contain !important;
              }
              @page {
                margin: 0;
              }
            }
          `}</style>
        </>
      )}
      {/* Custom header */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-lg print:hidden">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={isEditing ? handleCancelEdit : goBack}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className="text-lg font-bold text-blue-600">Notabase</span>
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleCancelEdit}
                    className="flex h-8 items-center gap-1.5 rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                    Batal
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="flex h-8 items-center gap-1.5 rounded-full bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Simpan
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex h-8 items-center gap-1.5 rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex h-8 items-center gap-1.5 rounded-full bg-red-500 px-3 text-xs font-semibold text-white hover:bg-red-600 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 py-6 space-y-4 sm:px-6 sm:max-w-2xl lg:max-w-5xl">
        {/* Page title */}
        <div className="space-y-0.5">
          <h1 className="text-xl font-bold text-slate-900">Detail Nota</h1>
          <p className="text-xs text-slate-500">
            Informasi transaksi
            {(() => {
              const dateVal = receipt.tanggal || receipt.transactionDate
              if (!dateVal) return ''
              const str = String(dateVal)
              // Only show time if the string explicitly contains a non-zero time part
              if (str.includes('T') && !str.includes('T00:00:00') && !str.includes('T08:00:00')) {
                const time = formatTime(dateVal)
                if (time && time !== '00.00' && time !== '08.00') return ` · ${time}`
              }
              return ''
            })()}
          </p>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          {/* Left: Receipt document card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full lg:w-2/5 lg:sticky lg:top-24"
          >
            <Card className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm transition-all duration-200">
              <div
                className="overflow-auto max-h-[78vh] transition-transform duration-200 origin-top"
                onWheel={(e) => {
                  if (e.ctrlKey || e.metaKey) {
                    e.preventDefault()
                    if (e.deltaY < 0) setCardZoom((z) => Math.min(+(z + 0.25).toFixed(2), 2.5))
                    else setCardZoom((z) => Math.max(+(z - 0.25).toFixed(2), 0.5))
                  }
                }}
              >
                <div style={{ transform: `scale(${cardZoom})`, transformOrigin: 'top center', transition: 'transform 0.2s ease-out' }}>
                  {/* Receipt header */}
                  <div className="bg-white px-5 pt-5 pb-4 text-center border-b border-dashed border-slate-200">
                    <div className="relative">
                      {receipt.imageUrl ? (
                        <>
                          <button
                            onClick={() => setLightboxOpen(true)}
                            className="group relative mx-auto block h-auto max-h-52 w-full overflow-hidden rounded-xl"
                            aria-label="Perbesar gambar nota"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              id="printable-receipt-image"
                              src={receipt.imageUrl}
                              alt={receipt.merchantName}
                              className="h-full w-full object-contain transition-opacity group-hover:opacity-80"
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50">
                                <ZoomIn className="h-5 w-5 text-white" />
                              </div>
                            </div>
                          </button>
                          {/* Image toolbar */}
                          <div className="mt-2 flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setLightboxOpen(true)}
                              className="flex h-7 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                              <ZoomIn className="h-3 w-3" /> Perbesar
                            </button>
                            <button
                              onClick={() => {
                                if (receipt.imageUrl) {
                                  const name = receipt.namaToko || receipt.merchantName || 'Nota'
                                  const date = receipt.tanggal || receipt.transactionDate || new Date().toISOString()
                                  downloadReceiptImage(receipt.imageUrl, name, date)
                                    .catch(() => toast.error('Gagal mengunduh gambar'))
                                }
                              }}
                              className="flex h-7 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                              <Download className="h-3 w-3" /> Unduh
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex h-32 w-full items-center justify-center rounded-xl bg-slate-100">
                          <ShoppingBag className="h-10 w-10 text-slate-300" />
                        </div>
                      )}
                    </div>
                    <h2 className="mt-3 text-base font-bold uppercase tracking-wide text-slate-900">
                      {receipt.merchantName}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {formatDateID(receipt.transactionDate)}
                    </p>
                  </div>

              {/* Line items section (Editable in Edit Mode, static in View Mode) */}
              {isEditing ? (
                <div className="border-t border-slate-100 px-4 py-3 space-y-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-700">Daftar Barang</span>
                    <button
                      type="button"
                      onClick={() => {
                        const currentItems = editForm.items || []
                        const updatedItems = [...currentItems, { namaBarang: '', qty: 1, harga: 0, subtotal: 0, urutan: currentItems.length, name: '', price: 0, total: 0 }]
                        setEditForm((f) => ({ ...f, items: updatedItems }))
                      }}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                    >
                      + Tambah Item
                    </button>
                  </div>
                  <div className="overflow-x-auto max-h-64 overflow-y-auto pr-1">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400 font-semibold border-b border-slate-100 text-[10px] uppercase">
                          <th className="text-left py-2 font-bold">Nama Barang</th>
                          <th className="text-center py-2 font-bold w-12">Qty</th>
                          <th className="text-right py-2 font-bold w-20">Harga</th>
                          <th className="text-right py-2 font-bold w-20">Total</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(editForm.items || []).map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-1.5 text-left">
                              <Input
                                value={item.name}
                                onChange={(e) => {
                                  const newItems = [...(editForm.items || [])]
                                  newItems[idx] = { ...item, name: e.target.value }
                                  setEditForm((f) => ({ ...f, items: newItems }))
                                }}
                                placeholder="Nama barang"
                                className="rounded-lg h-8 px-2 bg-white text-[11px] w-full border-slate-200"
                              />
                            </td>
                            <td className="py-1.5 text-center px-1">
                              <Input
                                type="number"
                                value={item.qty ?? ''}
                                onChange={(e) => {
                                  const qty = Number(e.target.value) || 0
                                  const price = item.price || 0
                                  const newItems = [...(editForm.items || [])]
                                  newItems[idx] = { ...item, qty, total: qty * price }
                                  const newTotal = newItems.reduce((acc, it) => acc + ((it.qty || 0) * (it.price || 0)), 0)
                                  setEditForm((f) => ({ ...f, items: newItems, total: newTotal }))
                                }}
                                placeholder="Qty"
                                className="rounded-lg h-8 px-1 bg-white text-[11px] w-12 text-center border-slate-200"
                              />
                            </td>
                            <td className="py-1.5 text-right px-1">
                              <Input
                                type="number"
                                value={item.price ?? ''}
                                onChange={(e) => {
                                  const price = Number(e.target.value) || 0
                                  const qty = item.qty || 0
                                  const newItems = [...(editForm.items || [])]
                                  newItems[idx] = { ...item, price, total: qty * price }
                                  const newTotal = newItems.reduce((acc, it) => acc + ((it.qty || 0) * (it.price || 0)), 0)
                                  setEditForm((f) => ({ ...f, items: newItems, total: newTotal }))
                                }}
                                placeholder="Harga"
                                className="rounded-lg h-8 px-1 bg-white text-[11px] w-20 text-right border-slate-200"
                              />
                            </td>
                            <td className="py-1.5 text-right font-semibold text-slate-800 px-1">
                              {formatRupiah((item.qty || 0) * (item.price || 0))}
                            </td>
                            <td className="py-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  const newItems = (editForm.items || []).filter((_, i) => i !== idx)
                                  const newTotal = newItems.reduce((acc, it) => acc + ((it.qty || 0) * (it.price || 0)), 0)
                                  setEditForm((f) => ({ ...f, items: newItems, total: newTotal }))
                                }}
                                className="text-red-500 hover:text-red-700 p-1"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(editForm.items || []).length === 0 && (
                      <p className="text-[11px] text-slate-400 text-center py-4">Belum ada item barang</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto border-t border-slate-100 px-3 py-3">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 font-semibold border-b border-slate-100 text-[10px] uppercase">
                        <th className="text-left py-2 font-bold pr-2">Nama Barang</th>
                        <th className="text-center py-2 font-bold w-10 px-1">Qty</th>
                        <th className="text-right py-2 font-bold whitespace-nowrap px-1.5">Harga</th>
                        <th className="text-right py-2 font-bold whitespace-nowrap pl-1.5">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-slate-700">
                      {getItemsForDisplay(receipt).map((norm: any, idx: number) => {
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2 text-left font-medium text-[11px] sm:text-xs pr-2 break-words">{norm.namaBarang}</td>
                            <td className="py-2 text-center text-slate-500 text-[11px] sm:text-xs px-1">{norm.qty}</td>
                            <td className="py-2 text-right text-slate-500 text-[10px] sm:text-[11px] whitespace-nowrap px-1.5">{formatRupiah(norm.harga)}</td>
                            <td className="py-2 text-right font-semibold text-slate-800 text-[11px] sm:text-xs whitespace-nowrap pl-1.5">{formatRupiah(norm.subtotal)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Total */}
              <div className="flex items-center justify-between border-t-2 border-dashed border-slate-200 px-5 py-4">
                <span className="text-sm font-bold text-slate-900 uppercase">TOTAL</span>
                <span className="text-xl font-extrabold text-blue-600">{formatRupiah(receipt.total)}</span>
              </div>

              {/* Barcode — always use receipt.id to avoid OCR misread values */}
              <div className="flex flex-col items-center gap-1 border-t border-dashed border-slate-200 px-5 py-4">
                <Barcode value={receipt.id} />
                <span className="font-mono text-[10px] tracking-widest text-slate-400">
                  {receipt.id.toUpperCase().slice(0, 16)}
                </span>
              </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Right: Info */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="w-full space-y-3 lg:flex-1"
          >
            {/* Info card */}
            <Card className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-white px-4 py-3">
                <Info className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-bold text-slate-900">Informasi Nota</h3>
              </div>

              {isEditing ? (
                /* ── Edit Mode ── */
                <div className="space-y-4 px-4 py-4">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <Store className="h-3.5 w-3.5" /> Nama Toko
                    </Label>
                    <Input
                      value={editForm.merchantName ?? editForm.namaToko ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, merchantName: e.target.value, namaToko: e.target.value }))}
                      className="rounded-xl h-10 border-slate-200 bg-slate-50 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <Calendar className="h-3.5 w-3.5" /> Tanggal
                    </Label>
                    <Input
                      type="date"
                      value={(() => {
                        const raw = editForm.transactionDate || editForm.tanggal || ''
                        const m = String(raw).trim().match(/^(\d{4}-\d{2}-\d{2})/)
                        return m ? m[1] : ''
                      })()}
                      onChange={(e) => setEditForm((f) => ({ ...f, transactionDate: e.target.value, tanggal: e.target.value }))}
                      className="rounded-xl h-10 border-slate-200 bg-slate-50 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <Wallet className="h-3.5 w-3.5" /> Nominal (IDR)
                    </Label>
                    <Input
                      type="number"
                      value={editForm.total ?? editForm.nominal ?? 0}
                      onChange={(e) => setEditForm((f) => ({ ...f, total: Number(e.target.value), nominal: Number(e.target.value) }))}
                      className="rounded-xl h-10 border-slate-200 bg-slate-50 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <Hash className="h-3.5 w-3.5" /> No. Nota <span className="ml-auto text-[10px] font-normal text-slate-400">Opsional</span>
                    </Label>
                    <Input
                      value={isValidInvoiceNumber(editForm.invoiceNumber || editForm.receiptNumber) ? (editForm.invoiceNumber || editForm.receiptNumber || '') : ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, invoiceNumber: e.target.value, receiptNumber: e.target.value }))}
                      placeholder="Nomor nota (opsional)"
                      className="rounded-xl h-10 border-slate-200 bg-slate-50 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <Phone className="h-3.5 w-3.5" /> No. Telepon Toko
                    </Label>
                    <Input
                      value={editForm.noTelepon ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, noTelepon: e.target.value }))}
                      placeholder="Nomor telepon toko (opsional)"
                      className="rounded-xl h-10 border-slate-200 bg-slate-50 text-sm"
                    />
                  </div>
                   <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <FileText className="h-3.5 w-3.5" /> Keterangan
                    </Label>
                    <Textarea
                      value={editForm.description ?? editForm.keterangan ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value, keterangan: e.target.value }))}
                      className="rounded-xl border-slate-200 bg-slate-50 min-h-[72px] resize-none text-sm"
                      placeholder="Keterangan (opsional)"
                    />
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <FileText className="h-3.5 w-3.5" /> Teks OCR (Edit Tabel/Baris)
                    </Label>
                    <OcrTableEditor
                      text={editForm.ocrText || editForm.ocrRawText || ''}
                      isEditing={true}
                      onChange={(newText) => setEditForm((f) => ({ ...f, ocrText: newText, ocrRawText: newText }))}
                    />
                  </div>
                </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" onClick={handleCancelEdit} className="flex-1 rounded-xl h-10 text-sm">
                      Batal
                    </Button>
                    <Button onClick={handleSaveEdit} disabled={saving} className="flex-1 rounded-xl h-10 bg-blue-600 hover:bg-blue-700 text-white text-sm">
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Simpan
                    </Button>
                  </div>
                </div>
              ) : (
                /* ── View Mode ── */
                <div className="space-y-0 divide-y divide-slate-100 px-4">
                  {/* Nama Toko / Layanan — always first */}
                  <div className="flex items-center justify-between py-3">
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                      <Store className="h-3.5 w-3.5 text-blue-500" />
                      Nama Toko / Merchant
                    </span>
                    <span className="text-xs font-bold text-slate-900">{receipt.merchantName || receipt.namaToko || '-'}</span>
                  </div>

                  {/* No. Nota / Invoice */}
                  <div className="flex items-center justify-between py-3">
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                      <Hash className="h-3.5 w-3.5 text-blue-500" />
                      No. Invoice / Nota
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-900">
                      {receipt.receiptNumber && isValidInvoiceNumber(receipt.receiptNumber) ? receipt.receiptNumber : (receipt.invoiceNumber && isValidInvoiceNumber(receipt.invoiceNumber) ? receipt.invoiceNumber : '-')}
                    </span>
                  </div>

                  {/* Tanggal */}
                  <div className="flex items-center justify-between py-3">
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                      <Calendar className="h-3.5 w-3.5 text-blue-500" />
                      Tanggal Transaksi
                    </span>
                    <span className="text-xs font-semibold text-slate-800">{formatDateID(receipt.transactionDate)}</span>
                  </div>

                  {/* No Telepon Toko */}
                  {receipt.noTelepon && (
                    <div className="flex items-center justify-between py-3">
                      <span className="flex items-center gap-2 text-xs text-slate-500">
                        <Phone className="h-3.5 w-3.5 text-blue-500" />
                        No. Telepon Toko
                      </span>
                      <span className="text-xs font-semibold text-slate-800">{receipt.noTelepon}</span>
                    </div>
                  )}

                  {/* Subtotal */}
                  {Boolean(receipt.subtotalNominal && receipt.subtotalNominal > 0) && (
                    <div className="flex items-center justify-between py-3">
                      <span className="flex items-center gap-2 text-xs text-slate-500">
                        <Calculator className="h-3.5 w-3.5 text-blue-500" />
                        Subtotal
                      </span>
                      <span className="text-xs font-semibold text-slate-800">
                        {formatRupiah(receipt.subtotalNominal ?? 0)}
                      </span>
                    </div>
                  )}

                  {/* Total Nominal */}
                  <div className="flex items-center justify-between py-3">
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                      <Wallet className="h-3.5 w-3.5 text-blue-500" />
                      Total Pembayaran
                    </span>
                    <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400">
                      {formatRupiah(receipt.total ?? receipt.nominal ?? 0)}
                    </span>
                  </div>

                  {/* Biaya Layanan / Admin (jika ada) */}
                  {Boolean(receipt.biayaTambahan && receipt.biayaTambahan > 0) && (
                    <div className="flex items-center justify-between py-3">
                      <span className="flex items-center gap-2 text-xs text-slate-500">
                        <Tag className="h-3.5 w-3.5 text-blue-500" />
                        {receipt.namaBiayaTambahan || 'Biaya Layanan / Admin'}
                      </span>
                      <span className="text-xs font-bold text-amber-600">
                        {formatRupiah(receipt.biayaTambahan ?? 0)}
                      </span>
                    </div>
                  )}


                  {/* Keterangan Singkat */}
                  {receipt.description && (
                    <div className="py-3">
                      <p className="text-[11px] font-medium text-slate-400 mb-1">Keterangan Transaksi</p>
                      <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-medium">
                        {receipt.description}
                      </p>
                    </div>
                  )}

                    <div className="py-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <ShoppingBag className="h-3.5 w-3.5 text-blue-500" />
                          Rincian Barang / Tagihan ({getItemsForDisplay(receipt).length})
                        </span>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 divide-y divide-slate-100 p-2.5 text-xs">
                        {getItemsForDisplay(receipt).map((norm: any, idx: number) => {
                          return (
                            <div key={idx} className="py-1.5 flex items-center justify-between text-xs">
                              <div className="min-w-0 pr-2">
                                <span className="font-semibold text-slate-800 block truncate">
                                  {norm.namaBarang}
                                </span>
                                <span className="text-[10.5px] text-slate-400">
                                  {norm.qty} × {formatRupiah(norm.harga)}
                                </span>
                              </div>
                              <span className="font-bold text-slate-900 shrink-0 font-mono">
                                {formatRupiah(norm.subtotal)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                  {/* Teks OCR Mentah — Collapsible Accordion (default closed) */}
                  {receipt.ocrText && (
                    <div className="py-3">
                      <button
                        onClick={() => setShowOcr((v) => !v)}
                        className="flex w-full items-center justify-between text-xs text-slate-500 hover:text-slate-800 transition-colors p-2 rounded-xl bg-slate-50 border border-slate-100"
                      >
                        <span className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-medium text-slate-600">Teks OCR Mentah</span>
                        </span>
                        <span className="text-[10px] font-semibold text-blue-600">
                          {showOcr ? 'Sembunyikan ▲' : 'Lihat Detail Teks OCR ▼'}
                        </span>
                      </button>
                      
                      {showOcr && (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-[11px] font-semibold text-slate-500">Struktur Tabel OCR</span>
                            <button
                              type="button"
                              onClick={() => setIsEditing((v) => !v)}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100"
                            >
                              <Pencil className="h-3 w-3" /> {isEditing ? 'Selesai Edit' : 'Edit & Hapus Baris OCR'}
                            </button>
                          </div>
                          <OcrTableEditor
                            text={receipt.ocrText || receipt.ocrRawText || ''}
                            isEditing={isEditing}
                            onChange={(updatedText) => {
                              if (receipt) {
                                setReceipt({ ...receipt, ocrText: updatedText, ocrRawText: updatedText })
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 py-3 text-[11px] text-slate-400">
                    <Info className="h-3 w-3 text-blue-400 shrink-0" />
                    Data transaksi tersinkronisasi dan aman
                  </div>
                </div>
              )}
            </Card>

            {/* Action buttons */}
            {!isEditing && (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl h-11 border-slate-200"
                  onClick={handlePrint}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Cetak
                </Button>
                <Button
                  className="flex-1 rounded-xl h-11 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleShare}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Bagikan
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDelete}
                  className="h-11 w-11 rounded-xl border-red-200 text-red-500 hover:bg-red-50 flex-none"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </motion.div>
        </div>
      </main>

      {/* Lightbox */}
      {lightboxOpen && receipt?.imageUrl && (
        <ImageLightbox
          receipts={[receipt]}
          initialIndex={0}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  )
}

function Barcode({ value }: { value: string }) {
  let currentX = 0
  const bars = value.split('').flatMap((ch, i) => {
    const code = ch.charCodeAt(0)
    return [
      { w: (code % 3) + 1, black: true },
      { w: ((code >> 2) % 2) + 1, black: false },
    ].map((b, j) => {
      const rx = currentX
      currentX += b.w
      return { ...b, key: `${i}-${j}`, rx }
    })
  })
  return (
    <svg width="220" height="40" viewBox="0 0 220 40" className="h-10 w-56" preserveAspectRatio="none">
      {bars.map((b) => (
        <rect key={b.key} x={b.rx} y={0} width={b.w} height={40} fill={b.black ? '#1e3a5f' : 'transparent'} />
      ))}
    </svg>
  )
}

const TABLE_COL_KEYWORDS = ['banyaknya', 'qty', 'jumlah', 'harga', 'nama barang', 'nama', 'barang', 'keterangan', 'uraian', 'satuan', 'item', 'no.']

function parseHeaderCols(line: string): string[] {
  const trimmed = line.trim()
  let cols: string[] = []

  if (trimmed.includes('|')) {
    cols = trimmed.split('|').map((s) => s.trim()).filter(Boolean)
  } else {
    const upper = trimmed.toUpperCase()
    if (/BANYAKNYA|QTY/.test(upper) && /NAMA\s+BARANG|BARANG|ITEM/.test(upper) && /HARGA|JUMLAH/.test(upper)) {
      const qtyMatch = trimmed.match(/(BANYAKNYA|QTY\.?)/i)
      const nameMatch = trimmed.match(/(NAMA\s+BARANG|BARANG|ITEM)/i)
      const priceMatch = trimmed.match(/(HARGA|JUMLAH)/i)
      if (qtyMatch && nameMatch && priceMatch) {
        return [qtyMatch[0].toUpperCase(), nameMatch[0].toUpperCase(), priceMatch[0].toUpperCase()]
      }
    }

    const byMultiSpace = trimmed.split(/\s{2,}/)
    if (byMultiSpace.length >= 2) {
      cols = byMultiSpace
    } else {
      let normalized = trimmed
      normalized = normalized.replace(/nama\s+barang/i, 'NAMA_BARANG')
      normalized = normalized.replace(/harga\s+satuan/i, 'HARGA_SATUAN')
      normalized = normalized.replace(/jumlah\s+harga/i, 'JUMLAH_HARGA')
      normalized = normalized.replace(/nama\s+item/i, 'NAMA_ITEM')
      normalized = normalized.replace(/no\s+urut/i, 'NO_URUT')

      const parts = normalized.split(/\s+/)
      cols = parts.map((p) => p.replace(/_/g, ' '))
    }
  }

  cols = cols
    .map((col) => col.trim())
    .filter((col) => col.length > 0 && !/^(subtotal|total)$/i.test(col))

  if (cols.length === 0) {
    return ['BANYAKNYA', 'NAMA BARANG', 'HARGA']
  }

  const hasQty = cols.some((c) => /qty|banyaknya|jumlah/i.test(c))
  const hasName = cols.some((c) => /nama|barang|item|keterangan|desc/i.test(c))
  const hasPrice = cols.some((c) => /harga|total|nominal|subtotal/i.test(c))

  if (hasQty && hasName && !hasPrice) {
    cols.push('HARGA')
  } else if (!hasQty && hasName && hasPrice) {
    cols.unshift('BANYAKNYA')
  } else if (cols.length < 3) {
    cols = ['BANYAKNYA', 'NAMA BARANG', 'HARGA']
  }

  return cols.slice(0, 3)
}

function parseTotalLine(line: string): { label: string; amount: string; extraText?: string } | null {
  const trimmed = line.trim()
  if (!/^(jumlah|total|subtotal|grand total|bayar|kembalian)/i.test(trimmed)) return null

  // Ignore disclaimer notes (e.g. "Total dengan struk merupakan biaya...", "Total pembayaran sudah termasuk...")
  if (/^total\s+(dengan|termasuk|merupakan|adalah|dapat|sesuai|tidak|apabila)\b/i.test(trimmed) && !/\d/.test(trimmed)) {
    return null
  }

  // A genuine total line MUST contain numbers or currency
  if (!/\d/.test(trimmed) && !/rp\.?|idr/i.test(trimmed)) {
    return null
  }

  const cleanAmountStr = (rawStr: string): string => {
    let clean = rawStr.trim()
    const digitsOnly = clean.replace(/[^\d]/g, '')
    if (digitsOnly) {
      const parsedNum = parseInt(digitsOnly, 10)
      if (!isNaN(parsedNum) && parsedNum > 0) {
        return formatRupiah(parsedNum)
      }
    }
    return clean
  }

  // Pattern A: "Total Rp. 225.000 Cash Credit Penerima," or "TOTAL Rp. 000000064491"
  const matchWithCurrency = trimmed.match(/^(jumlah|total|subtotal|grand total|bayar|kembalian)\s*(:\s*)?(Rp\.?\s*[\d.,]+)(.*)$/i)
  if (matchWithCurrency) {
    const label = matchWithCurrency[1].trim()
    const amount = cleanAmountStr(matchWithCurrency[3].trim())
    const extra = matchWithCurrency[4]?.trim()
    return { label, amount, extraText: extra || undefined }
  }

  // Pattern B: "Total 225.000 Extra..."
  const matchNumber = trimmed.match(/^(jumlah|total|subtotal|grand total|bayar|kembalian)\s*(:\s*)?([\d.,]+)(.*)$/i)
  if (matchNumber) {
    const label = matchNumber[1].trim()
    const amount = cleanAmountStr(matchNumber[3].trim())
    const extra = matchNumber[4]?.trim()
    return { label, amount, extraText: extra || undefined }
  }

  return null
}

function isSeparatorLine(line: string): boolean {
  return /^[.\-=\s*]{4,}$/.test(line.trim())
}

function isTotalLine(line: string): boolean {
  return /^(jumlah|total|subtotal|grand\s*total|bayar|kembalian|diskon|pajak|ppn)/i.test(line.trim())
}

function isTableHeaderLine(line: string): boolean {
  const lower = line.toLowerCase().trim()

  // Exclude metadata key-value labels like "NAMA BALAI P.P.K.I MANADO", "NAMA TOKO", "NAMA PELANGGAN"
  if (/^nama\s+(balai|toko|pelanggan|pemilik|penerima|mitra|perusahaan|instansi|pembeli|user|kasir)\b/i.test(lower)) return false
  if (/^(jumlah|total|subtotal|grand\s*total|bayar|kembalian|diskon|pajak|ppn)/i.test(lower)) return false
  if (/[\d.,]{3,}\s*$/.test(lower)) return false

  // A genuine table header MUST contain explicit table column keywords
  const explicitHeaderKeywords = [
    'harga', 'qty', 'banyaknya', 'subtotal', 'satuan', 'nama barang', 'nama item', 'nama jasa', 'uraian', 'deskripsi', 'jumlah harga', 'harga satuan'
  ]
  const matchCount = explicitHeaderKeywords.filter((kw) => lower.includes(kw)).length
  if (matchCount < 1) return false

  const cols = parseHeaderCols(line)
  return cols.length >= 2 && cols.length <= 4
}

function parseDataRow(line: string, headerCols: string[]): string[] {
  let trimmed = line.trim()
  
  // Clean leftover header words at the beginning of data row
  trimmed = trimmed.replace(/^(harga|jumlah|total|subtotal|satuan|nama|barang|qty|banyaknya)\s+/gi, '').trim()
  trimmed = trimmed.replace(/^(harga|jumlah|total|subtotal|satuan|nama|barang|qty|banyaknya)\s+/gi, '').trim()

  if (!trimmed) return ['', '', '']

  if (trimmed.includes('|')) {
    const parts = trimmed.split('|').map((s) => s.trim()).filter((s, idx, arr) => {
      if (s === '' && idx === arr.length - 1) return false
      return true
    })
    while (parts.length < headerCols.length) parts.push('')
    return parts.slice(0, headerCols.length)
  }

  // Extract Price from the end (e.g. 225.000 or 1.280.000)
  let priceStr = ''
  const priceMatch = trimmed.match(/([\d.,]{3,}\s*)$/)
  if (priceMatch && headerCols.length >= 3) {
    priceStr = priceMatch[1].trim()
    trimmed = trimmed.slice(0, trimmed.length - priceMatch[0].length).trim()
  }

  // Extract optional unit price before total price (e.g. 40.000 in "32 paket Nasi kotak 40.000")
  let unitPriceStr = ''
  const unitPriceMatch = trimmed.match(/\b([\d.]{3,})\s*$/)
  if (unitPriceMatch) {
    unitPriceStr = unitPriceMatch[1].trim()
    trimmed = trimmed.slice(0, trimmed.length - unitPriceMatch[0].length).trim()
  }

  // Extract Quantity from the beginning: ONLY match numeric or numeric + standard measurement unit
  let qtyStr = '1'
  let nameStr = trimmed

  // Match leading number, optionally followed by standard unit (pcs, pack, kg, gr, btl, bks, porsi, ltr, box, x)
  const qtyMatch = trimmed.match(/^(\d+(?:\s*(?:[xX*]|pcs|pack|kg|gr|btl|bks|porsi|ltr|box|stk|lsn))\b)\s*(.+)$/i)
  if (qtyMatch && qtyMatch[1]) {
    qtyStr = qtyMatch[1].trim()
    nameStr = qtyMatch[2].trim()
  } else {
    // Check if line simply starts with a number followed by space (e.g. "4 Nasi Paket ayam")
    const simpleNumMatch = trimmed.match(/^(\d+)\s+(.+)$/)
    if (simpleNumMatch) {
      qtyStr = simpleNumMatch[1].trim()
      nameStr = simpleNumMatch[2].trim()
    } else if (/^\d+$/.test(trimmed)) {
      qtyStr = trimmed
      nameStr = ''
    }
  }

  // Clean item name from currency and price tokens (e.g. "Rp10.000 Biaya Layanan Rp" -> "Biaya Layanan")
  nameStr = nameStr
    .replace(/^(?:rp\.?\s*[\d.]*\s*)+/gi, '')
    .replace(/(?:\s*rp\.?\s*[\d.]*)+$/gi, '')
    .replace(/\b(?:rp|rupiah|jumlah|total|subtotal)\b/gi, '')
    .trim()

  return [qtyStr, nameStr, priceStr || unitPriceStr]
}

interface TableBlock {
  kind: 'table'
  headers: string[]
  rows: string[][]
}

type OcrBlock =
  | { kind: 'text'; line: string }
  | { kind: 'separator' }
  | { kind: 'total'; label: string; amount: string }
  | { kind: 'heading'; line: string }
  | TableBlock

function serializeBlocks(blocks: OcrBlock[]): string {
  return blocks.map((block) => {
    if (block.kind === 'separator') {
      return '----------------------------------------'
    }
    if (block.kind === 'heading') {
      return block.line
    }
    if (block.kind === 'text') {
      return block.line
    }
    if (block.kind === 'total') {
      return `${block.label} ${block.amount}`
    }
    if (block.kind === 'table') {
      const headerLine = block.headers.join(' | ')
      const rowLines = block.rows.map((row) => row.join(' | '))
      return [headerLine, ...rowLines].join('\n')
    }
    return ''
  }).join('\n')
}

function formatOcrRawTextToStructuredLines(text: string): string[] {
  if (!text) return []

  let normalized = String(text || '').replace(/\\n/g, '\n').replace(/\r/g, '').trim()

  // Split lines that have multiple items joined together on one line (e.g. "160.000 4 Air mineral 180.000")
  normalized = normalized.replace(/([\d.,]{3,})\s+(\d+\s+[A-Za-z])/g, '$1\n$2')

  let rawLines = normalized.split('\n').map((l) => l.trim()).filter(Boolean)

  if (rawLines.length === 1 && rawLines[0].includes(' | ')) {
    rawLines = rawLines[0].split(' | ').map((l) => l.trim()).filter(Boolean)
  }

  // Break apart lines if they contain landmark anchors (Date, Kepada Yth, Nota No, Table Headers, Total, Telp/WA)
  let single = rawLines.join('\n')
  const breakAnchors = [
    /(?:^|\s+)(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
    /(?:^|\s+)(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Ags|Sep|Okt|Nov|Des)[a-z]*\s+\d{4})/gi,
    /(?:^|\s+)(Kepada\s+Yth\.?|Tuan\s*\/?|Toko\s+)/gi,
    /(?:^|\s+)(NOTA\s+NO\.?|FAKTUR\s+NO\.?|KWITANSI\s+NO\.?|NO\.?\s*REF)/gi,
    /(?:^|\s+)(BANYAKNYA|NAMA\s+BARANG|HARGA|SATUAN|QTY|JUMLAH\s+HARGA)/gi,
    /(?:^|\s+)(TOTAL|SUBTOTAL|GRAND\s+TOTAL|BAYAR|KEMBALIAN)/gi,
    /(?:^|\s+)(Tanda\s+Terima|Hormat\s+Kami|Terima\s+Kasih)/gi,
    /(?:^|\s+)(Kel\.?|Kec\.?|Jl\.?|Jalan|Kota|Prov\.?)/gi,
    /(?:^|\s+)(Telp\.?|WA\s*:?|HP\s*:?|Phone|No\.?\s*Hp)/gi,
  ]

  breakAnchors.forEach((pat) => {
    single = single.replace(pat, '\n$1')
  })

  rawLines = single.split('\n').map((l) => l.trim()).filter(Boolean)

  // Merge consecutive single-word header lines (e.g. Qty. \n Nama Barang \n Harga)
  const combined: string[] = []
  let i = 0
  while (i < rawLines.length) {
    const line = rawLines[i]
    const lower = line.toLowerCase().trim()
    const isSingleHeader = TABLE_COL_KEYWORDS.some((kw) => lower === kw || lower === kw + '.' || lower === kw + ':') && !/\d/.test(line)

    if (isSingleHeader && i + 1 < rawLines.length) {
      const nextLower = rawLines[i + 1].toLowerCase().trim()
      const nextIsHeader = TABLE_COL_KEYWORDS.some((kw) => nextLower.includes(kw)) && !/\d/.test(rawLines[i + 1])
      if (nextIsHeader) {
        const merged: string[] = [line]
        i++
        while (i < rawLines.length) {
          const lLower = rawLines[i].toLowerCase().trim()
          if (TABLE_COL_KEYWORDS.some((kw) => lLower.includes(kw)) && !/\d/.test(rawLines[i])) {
            merged.push(rawLines[i])
            i++
          } else {
            break
          }
        }
        combined.push(merged.join(' | '))
        continue
      }
    }

    combined.push(line)
    i++
  }

  return combined
}

export function OcrTableEditor({
  text,
  onChange,
  isEditing,
}: {
  text: string
  onChange: (text: string) => void
  isEditing: boolean
}) {
  const [blocks, setBlocks] = useState<OcrBlock[]>([])

  useEffect(() => {
    const rawLines = formatOcrRawTextToStructuredLines(text)

    const parsedBlocks: OcrBlock[] = []
    let i = 0

    while (i < rawLines.length) {
      const line = rawLines[i]
      const trimmed = line.trim()

      if (!trimmed) {
        parsedBlocks.push({ kind: 'text', line: '' })
        i++
        continue
      }

      if (isSeparatorLine(trimmed)) {
        parsedBlocks.push({ kind: 'separator' })
        i++
        continue
      }

      const totalParsed = parseTotalLine(trimmed)
      if (totalParsed) {
        parsedBlocks.push({ kind: 'total', label: totalParsed.label, amount: totalParsed.amount })
        if (totalParsed.extraText) {
          parsedBlocks.push({ kind: 'text', line: totalParsed.extraText })
        }
        i++
        continue
      }

      if (isTableHeaderLine(trimmed)) {
        const headers = parseHeaderCols(trimmed)
        const rows: string[][] = []
        i++
        while (i < rawLines.length) {
          let dataLine = rawLines[i].trim()
          if (!dataLine || isSeparatorLine(dataLine) || isTableHeaderLine(dataLine) || parseTotalLine(dataLine) || /^(tanda|hormat)/i.test(dataLine)) break

          while (i + 1 < rawLines.length) {
            const nextLine = rawLines[i + 1].trim()
            if (!nextLine || isTableHeaderLine(nextLine) || parseTotalLine(nextLine) || /^(tanda|hormat)/i.test(nextLine)) break

            const currentHasPrice = /[\d.,]{3,}\s*$/.test(dataLine)
            if (!currentHasPrice) {
              dataLine = `${dataLine} ${nextLine}`
              i++
            } else {
              break
            }
          }

          const parsedRow = parseDataRow(dataLine, headers)
          if (parsedRow.some((cell) => cell.length > 0)) {
            rows.push(parsedRow)
          }
          i++
        }
        parsedBlocks.push({ kind: 'table', headers, rows })
        continue
      }

      if (trimmed.length <= 45 && (trimmed === trimmed.toUpperCase() || /^(nota|faktur|kwitansi|toko|teras|minimarket|supermarket|restoran|warung|kasir|pembayaran|tanda)/i.test(trimmed)) && /[A-Za-z]/.test(trimmed) && !/\d{3}[.,]\d{3}/.test(trimmed)) {
        parsedBlocks.push({ kind: 'heading', line: trimmed })
        i++
        continue
      }

      parsedBlocks.push({ kind: 'text', line: trimmed })
      i++
    }

    // Deduplicate consecutive table blocks & drop duplicate total blocks
    const cleanedBlocks: OcrBlock[] = []
    const seenTotals = new Set<string>()

    for (const b of parsedBlocks) {
      if (b.kind === 'table') {
        const last = cleanedBlocks[cleanedBlocks.length - 1]
        if (last && last.kind === 'table') {
          last.rows.push(...b.rows)
          continue
        }
        if (b.rows.length === 0 && parsedBlocks.length > 1) {
          continue
        }
      }

      if (b.kind === 'total') {
        const totalKey = `${b.amount.replace(/[^\d]/g, '')}`
        if (seenTotals.has(totalKey) && totalKey.length > 0) {
          continue
        }
        seenTotals.add(totalKey)
      }

      cleanedBlocks.push(b)
    }

    setBlocks(cleanedBlocks.length > 0 ? cleanedBlocks : parsedBlocks)
  }, [text])

  const updateBlock = (idx: number, updated: OcrBlock) => {
    const nextBlocks = [...blocks]
    nextBlocks[idx] = updated
    setBlocks(nextBlocks)
    onChange(serializeBlocks(nextBlocks))
  }

  const deleteBlock = (idx: number) => {
    const nextBlocks = blocks.filter((_, i) => i !== idx)
    setBlocks(nextBlocks)
    onChange(serializeBlocks(nextBlocks))
  }

  if (!isEditing) {
    return (
      <div className="rounded-[20px] border border-slate-100 bg-white overflow-hidden shadow-sm divide-y divide-slate-100/80 text-[12px] max-h-[550px] overflow-y-auto">
        {blocks.map((block, bi) => {
          if (block.kind === 'separator') {
            return <div key={bi} className="py-1 bg-slate-50/40 border-b border-dashed border-slate-200" />
          }

          if (block.kind === 'heading') {
            return (
              <div key={bi} className="px-5 py-3.5 bg-slate-50/60 text-center font-bold text-slate-800 text-[13px] tracking-wide uppercase">
                {block.line}
              </div>
            )
          }

          if (block.kind === 'total') {
            return (
              <div key={bi} className="px-5 py-3.5 bg-blue-50/80 border-y border-blue-100/60 flex items-center justify-between">
                <span className="font-bold text-slate-800 text-[13px]">{block.label}</span>
                <span className="font-bold text-blue-600 text-[14px]">{block.amount}</span>
              </div>
            )
          }

          if (block.kind === 'table') {
            const isTextCol = (h: string, idx: number) => idx === 1 || /nama|barang|item|keterangan|desc/i.test(h)
            const isPriceCol = (h: string, idx: number) => idx === 2 || /harga|total|jumlah|subtotal/i.test(h)
            
            const getAlignmentClass = (h: string, idx: number) => {
              if (idx === 0) return 'text-left'
              if (idx === 1 || isTextCol(h, idx)) return 'text-center'
              if (idx === 2 || isPriceCol(h, idx)) return 'text-right'
              return 'text-left'
            }
            
            const getWidthClass = (h: string, idx: number) => {
              if (idx === 0) return 'w-[25%]'
              if (idx === 1 || isTextCol(h, idx)) return 'w-[50%]'
              if (idx === 2 || isPriceCol(h, idx)) return 'w-[25%]'
              return 'w-[33%]'
            }

            return (
              <div key={bi} className="overflow-x-auto bg-white">
                <table className="w-full text-[12px] table-fixed">
                  <thead>
                    <tr className="bg-white border-b border-slate-100 text-slate-400 font-bold text-[10.5px] uppercase tracking-wider">
                      {block.headers.map((h, hi) => (
                        <th
                          key={hi}
                          className={cn(
                            "py-3 px-5",
                            getWidthClass(h, hi),
                            getAlignmentClass(h, hi)
                          )}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {block.rows.map((row, ri) => (
                      <tr key={ri} className="hover:bg-slate-50/50 transition-colors">
                        {block.headers.map((h, ci) => (
                          <td
                            key={ci}
                            className={cn(
                              "py-3 px-5 text-slate-700 font-medium break-words",
                              getAlignmentClass(h, ci)
                            )}
                          >
                            {row[ci] || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }

          // Clean text line formatting
          const lineText = block.line.trim()
          const keyValMatch = lineText.match(/^([A-Za-z0-9.\s/]{3,25})\s*:\s*(.+)$/) || lineText.match(/^(NO\.?\s*[A-Za-z0-9.\s/]{2,20})\s+([A-Za-z0-9./-]+)$/i)
          
          if (keyValMatch) {
            return (
              <div key={bi} className="px-4 py-2 flex items-center justify-between text-xs bg-white border-b border-slate-100">
                <span className="text-slate-500 font-medium">{keyValMatch[1].trim()}</span>
                <span className="text-slate-800 font-semibold font-mono">{keyValMatch[2].trim()}</span>
              </div>
            )
          }

          return (
            <div key={bi} className="px-4 py-2 text-xs text-slate-700 font-medium leading-relaxed break-words bg-white border-b border-slate-100/60">
              {block.line}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto border border-slate-200 bg-slate-50 rounded-xl p-3">
      {blocks.map((block, bi) => {
        if (block.kind === 'separator') {
          return (
            <div key={bi} className="flex items-center py-1">
              <div className="flex-1 border-t border-dashed border-slate-300" />
            </div>
          )
        }

        if (block.kind === 'heading') {
          return (
            <div key={bi} className="flex items-center">
              <Input
                value={block.line}
                onChange={(e) => updateBlock(bi, { ...block, line: e.target.value })}
                className="h-8 text-xs font-bold text-center bg-white border-slate-200 rounded-lg flex-1"
              />
            </div>
          )
        }

        if (block.kind === 'total') {
          return (
            <div key={bi} className="flex items-center gap-2 bg-blue-50/50 p-1.5 rounded-lg border border-blue-100">
              <Input
                value={block.label}
                onChange={(e) => updateBlock(bi, { ...block, label: e.target.value })}
                className="h-8 text-xs font-bold text-slate-700 bg-white border-slate-200 rounded-lg flex-1"
              />
              <Input
                value={block.amount}
                onChange={(e) => updateBlock(bi, { ...block, amount: e.target.value })}
                className="h-8 text-xs font-bold text-blue-600 bg-white border-slate-200 rounded-lg w-28 text-right font-mono"
              />
            </div>
          )
        }

        if (block.kind === 'table') {
          const isTextCol = (h: string) => /nama|barang|item|keterangan|desc/i.test(h)
          const getColAlignmentClass = (h: string) => {
            if (isTextCol(h)) return 'text-center'
            if (/harga|jumlah|total|nominal|subtotal/i.test(h)) return 'text-right'
            return 'text-center'
          }
          return (
            <div key={bi} className="overflow-x-auto bg-white rounded-xl border border-slate-200 p-2 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 px-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tabel Barang (OCR)</span>
                <div className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => {
                      const newRows = [...block.rows, Array(block.headers.length).fill('')]
                      updateBlock(bi, { ...block, rows: newRows })
                    }}
                    className="text-[10px] font-semibold text-blue-600 hover:text-blue-700"
                  >
                    + Tambah Baris
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteBlock(bi)}
                    className="text-[10px] font-semibold text-rose-600 hover:text-rose-700 ml-2"
                  >
                    <Trash2 className="h-3 w-3 inline mr-0.5" /> Hapus Tabel
                  </button>
                </div>
              </div>
              <table className="w-full text-xs table-fixed">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {block.headers.map((h, hi) => (
                      <th key={hi} className={cn("py-1 px-1", hi === 1 || isTextCol(h) ? "w-[45%]" : hi === 2 ? "w-[25%]" : "w-[20%]")}>
                        <Input
                          value={h}
                          onChange={(e) => {
                            const nextHeaders = [...block.headers]
                            nextHeaders[hi] = e.target.value
                            updateBlock(bi, { ...block, headers: nextHeaders })
                          }}
                          style={{ fontSize: h.length > 12 ? '9px' : h.length > 8 ? '10px' : '11px' }}
                          className={cn("h-7 font-bold bg-white border-slate-200 rounded-md w-full px-1.5", getColAlignmentClass(h))}
                        />
                      </th>
                    ))}
                    <th className="w-8 py-1 px-1"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {block.rows.map((row, ri) => (
                    <tr key={ri}>
                      {block.headers.map((h, ci) => {
                        const cellValue = row[ci] || ''
                        return (
                          <td key={ci} className={cn("py-1 px-1", ci === 1 || isTextCol(h) ? "w-[45%]" : ci === 2 ? "w-[25%]" : "w-[20%]")}>
                            <Input
                              value={cellValue}
                              onChange={(e) => {
                                const nextRow = Array.from({ length: block.headers.length }, (_, colIdx) => row[colIdx] || '')
                                nextRow[ci] = e.target.value
                                const nextRows = block.rows.map((r, rIdx) =>
                                  rIdx === ri ? nextRow : r
                                )
                                updateBlock(bi, { ...block, rows: nextRows })
                              }}
                              style={{ fontSize: cellValue.length > 12 ? '9px' : cellValue.length > 8 ? '10px' : '11px' }}
                              className={cn("h-7 bg-white border-slate-200 rounded-md w-full px-1.5 font-mono", getColAlignmentClass(h))}
                            />
                          </td>
                        )
                      })}
                      <td className="py-1 px-1 w-8 text-center">
                        <button
                          type="button"
                          title="Hapus Baris Ini"
                          onClick={() => {
                            const nextRows = block.rows.filter((_, idx) => idx !== ri)
                            updateBlock(bi, { ...block, rows: nextRows })
                          }}
                          className="h-7 w-7 inline-flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        return (
          <div key={bi} className="flex items-center">
            <Input
              value={block.line}
              onChange={(e) => updateBlock(bi, { ...block, line: e.target.value })}
              className="h-8 text-xs font-mono bg-white border-slate-200 rounded-lg flex-1"
            />
          </div>
        )
      })}
      <button
        type="button"
        onClick={() => {
          const nextBlocks = [...blocks, { kind: 'text' as const, line: '' }]
          setBlocks(nextBlocks)
          onChange(serializeBlocks(nextBlocks))
        }}
        className="w-full text-center text-xs font-semibold text-blue-600 hover:text-blue-700 py-1.5 bg-white border border-slate-200 border-dashed rounded-xl"
      >
        + Tambah Baris Baru
      </button>
    </div>
  )
}

function extractItemsFromOcrText(ocrText: string): any[] {
  if (!ocrText) return []

  // Ensure lines concatenated on a single line are formatted
  const formattedLines = formatOcrRawTextToStructuredLines(ocrText)
  const items: any[] = []
  
  const invalidNames = new Set([
    'BANYAKNYA', 'NAMA BARANG', 'HARGA', 'TOTAL', 'SUBTOTAL', 'GRAND TOTAL',
    'QTY', 'ITEM', 'JUMLAH', 'BAYAR', 'KEMBALI', 'KASIR', 'TANGGAL', 'NOTA',
    'TANDA TERIMA', 'HORMAT KAMI', 'TERIMA KASIH'
  ])

  let i = 0
  while (i < formattedLines.length) {
    const line = formattedLines[i].trim()
    if (isTableHeaderLine(line)) {
      const headers = parseHeaderCols(line)
      i++
      
      const qtyIdx = headers.findIndex((h) => /banyaknya|qty|jumlah/i.test(h))
      const nameIdx = headers.findIndex((h) => /nama|barang|item|keterangan|desc/i.test(h))
      const priceIdx = headers.findIndex((h) => /harga|satuan/i.test(h))
      const totalIdx = headers.findIndex((h) => /jumlah|total|nominal|subtotal/i.test(h) && h !== headers[qtyIdx])
      
      while (i < formattedLines.length) {
        let dataLine = formattedLines[i].trim()
        if (!dataLine || isSeparatorLine(dataLine) || isTableHeaderLine(dataLine) || isTotalLine(dataLine) || /^(tanda|hormat)/i.test(dataLine)) break

        while (i + 1 < formattedLines.length) {
          const nextLine = formattedLines[i + 1].trim()
          if (!nextLine || isTableHeaderLine(nextLine) || isTotalLine(nextLine) || /^(tanda|hormat)/i.test(nextLine)) break

          const currentHasPrice = /[\d.,]{3,}\s*$/.test(dataLine)
          if (!currentHasPrice) {
            dataLine = `${dataLine} ${nextLine}`
            i++
          } else {
            break
          }
        }

        if (/\d/.test(dataLine) || dataLine.includes('|')) {
          const parsedRow = parseDataRow(dataLine, headers)
          
          const qtyStr = qtyIdx !== -1 ? parsedRow[qtyIdx] || '' : '1'
          const nameStr = nameIdx !== -1 ? parsedRow[nameIdx] || '' : ''
          const priceStr = priceIdx !== -1 ? parsedRow[priceIdx] || '' : ''
          const totalStr = totalIdx !== -1 ? parsedRow[totalIdx] || '' : ''
          
          const qty = parseInt(qtyStr.replace(/[^\d]/g, ''), 10) || 1
          let priceVal = parseFloat(priceStr.replace(/[^\d.-]/g, '').replace(/[^0-9-]/g, '')) || 0
          let totalVal = parseFloat(totalStr.replace(/[^\d.-]/g, '').replace(/[^0-9-]/g, '')) || 0
          
          if (totalVal > 0 && priceVal === 0) {
            priceVal = totalVal / qty
          }
          if (priceVal > 0 && totalVal === 0) {
            totalVal = qty * priceVal
          }
          
          // Clean item name from Rp prefix/suffix (e.g. "Rp10.000 Biaya Layanan Rp" -> "Biaya Layanan")
          const cleanedName = nameStr
            .replace(/^(?:rp\.?\s*[\d.]*\s*)+/gi, '')
            .replace(/(?:\s*rp\.?\s*[\d.]*)+$/gi, '')
            .replace(/\b(?:rp|rupiah|jumlah|total|subtotal)\b/gi, '')
            .trim()
          if (cleanedName && cleanedName.length >= 2 && !invalidNames.has(cleanedName.toUpperCase())) {
            items.push({
              namaBarang: cleanedName,
              name: cleanedName,
              qty: qty,
              harga: priceVal,
              price: priceVal,
              subtotal: totalVal,
              total: totalVal,
            })
          }
          i++
        } else {
          break
        }
      }
      if (items.length > 0) {
        return items
      }
    }
    i++
  }

  // Fallback: line-by-line item extraction if no explicit table header found
  const lines = formattedLines.map((l) => l.trim()).filter(Boolean)
  let urutan = 0
  for (const line of lines) {
    if (invalidNames.has(line.toUpperCase()) || /^(tanda|hormat|terima|total|subtotal|jumlah|bayar|kembali)/i.test(line)) {
      continue
    }

    // Line pattern: "4 Nasi Paket ayam 40.000 160.000" or "4 Air mineral 180.000"
    const m = line.match(/^(\d+)\s+(.+?)\s+([\d.]+)(?:\s+([\d.]+))?$/)
    if (m) {
      const qty = parseInt(m[1], 10)
      const rawName = m[2].trim()
      // Clean item name from Rp prefix/suffix
      const namaBarang = rawName
        .replace(/^(?:rp\.?\s*[\d.]*\s*)+/gi, '')
        .replace(/(?:\s*rp\.?\s*[\d.]*)+$/gi, '')
        .replace(/\b(?:rp|rupiah|jumlah|total|subtotal)\b/gi, '')
        .trim()
      const val1 = parseFloat(m[3].replace(/\./g, ''))
      const val2 = m[4] ? parseFloat(m[4].replace(/\./g, '')) : null

      if (namaBarang && namaBarang.length >= 2 && !invalidNames.has(namaBarang.toUpperCase()) && !isNaN(val1) && val1 > 0) {
        const subtotal = val2 !== null ? val2 : val1
        const harga = val2 !== null ? val1 : Math.round(subtotal / qty)
        items.push({
          namaBarang,
          name: namaBarang,
          qty,
          harga,
          price: harga,
          subtotal,
          total: subtotal,
          urutan: urutan++,
        })
      }
    }
  }

  return items
}
