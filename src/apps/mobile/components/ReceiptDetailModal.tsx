/**
 * apps/mobile/components/ReceiptDetailModal.tsx
 * Mobile Bottom Sheet / Modal Component for Viewing & Editing Receipt Details.
 *
 * Dokumen acuan:
 *   02-design-system.md §3.4 & §3.5
 *   03-business-rules.md (BR-MAN-01..04)
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Store,
  Calendar,
  Wallet,
  Hash,
  Tag,
  CreditCard,
  FileText,
  ShieldCheck,
  ZoomIn,
  Download,
  Trash2,
  Share2,
  Pencil,
  Save,
  Loader2,
  ShoppingBag,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { OCRBadge } from '@/shared/ui/OCRBadge'
import { ReceiptForm } from '@/shared/ui/ReceiptForm'
import { formatRupiah, formatDateID, cn, isValidInvoiceNumber } from '@/lib/utils'
import { downloadReceiptImage } from '@/lib/download-image'
import { toast } from 'sonner'
import type { Receipt } from '@/shared/types/receipt'

export interface ReceiptDetailModalProps {
  receipt: Receipt | null
  isOpen: boolean
  onClose: () => void
  onUpdate?: (id: string, patch: Partial<Receipt>) => Promise<void> | void
  onDelete?: (id: string) => Promise<void> | void
  onOpenLightbox?: () => void
}

export function ReceiptDetailModal({
  receipt,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  onOpenLightbox,
}: ReceiptDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  if (!isOpen || !receipt) return null

  const merchantName = receipt.namaToko || receipt.merchantName || 'Nota'
  const dateStr = receipt.tanggal || receipt.transactionDate
  const totalAmount = receipt.nominal ?? receipt.total ?? 0
  const rawInv = receipt.receiptNumber || receipt.invoiceNumber
  const receiptNumber = isValidInvoiceNumber(rawInv) ? rawInv : ''

  const handleSaveForm = async (patch: Partial<Receipt>) => {
    if (!onUpdate) return
    setIsSaving(true)
    try {
      await onUpdate(receipt.id, patch)
      setIsEditing(false)
      toast.success('Nota berhasil diperbarui!')
    } catch {
      toast.error('Gagal memperbarui nota')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    if (confirm('Hapus nota ini?')) {
      try {
        await onDelete(receipt.id)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('notabase_receipts_changed'))
          window.dispatchEvent(new Event('receipts-updated'))
          window.dispatchEvent(new Event('receipt-deleted'))
        }
        toast.success('Berhasil terhapus')
        onClose()
      } catch {
        toast.error('Gagal menghapus nota')
      }
    }
  }

  const handleShare = async () => {
    const text = `📋 Nota dari ${merchantName}\n📅 ${formatDateID(dateStr)}\n💰 ${formatRupiah(totalAmount)}`
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: `Nota ${merchantName}`, text })
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(text)
      toast.success('Detail nota disalin ke clipboard')
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs sm:items-center">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        {/* Modal / Bottom Sheet Panel */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-2xl z-10 border border-slate-100 dark:border-slate-800"
        >
          {/* Header */}
          <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-5 py-3.5">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-900 dark:text-white">
                {isEditing ? 'Edit Nota' : 'Detail Nota'}
              </span>
              {!isEditing && (
                <OCRBadge
                  status={receipt.statusOcr || receipt.status}
                  confidence={receipt.ocrConfidence}
                  size="sm"
                />
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isEditing && onUpdate && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex h-8 items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              )}
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-5 space-y-4">
            {isEditing ? (
              <ReceiptForm
                initialData={receipt}
                onSubmit={handleSaveForm}
                onCancel={() => setIsEditing(false)}
                isSaving={isSaving}
              />
            ) : (
              <>
                {/* Image Preview & Controls */}
                {receipt.imageUrl ? (
                  <div className="relative overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 group max-h-56">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={receipt.imageUrl}
                      alt={merchantName}
                      className="h-full w-full object-contain max-h-56"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all opacity-0 group-hover:opacity-100 gap-2">
                      {onOpenLightbox && (
                        <button
                          onClick={onOpenLightbox}
                          className="flex h-9 items-center gap-1.5 rounded-xl bg-white/90 px-3 text-xs font-bold text-slate-800 shadow-md"
                        >
                          <ZoomIn className="h-4 w-4" /> Perbesar
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (receipt.imageUrl) {
                            downloadReceiptImage(receipt.imageUrl, merchantName, dateStr || '')
                              .then(() => toast.success('Gambar berhasil diunduh'))
                              .catch(() => toast.error('Gagal mengunduh gambar'))
                          }
                        }}
                        className="flex h-9 items-center gap-1.5 rounded-xl bg-white/90 px-3 text-xs font-bold text-slate-800 shadow-md"
                      >
                        <Download className="h-4 w-4" /> Unduh
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-28 items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <ShoppingBag className="h-5 w-5" />
                      <span>Nota Manual — Tidak Ada Gambar</span>
                    </div>
                  </div>
                )}

                {/* Receipt Details Card */}
                <Card className="p-4 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                        {merchantName}
                      </h3>
                      {receiptNumber ? <p className="text-xs font-mono text-slate-400">{receiptNumber}</p> : null}
                    </div>
                    <span className="text-lg font-extrabold text-blue-600 dark:text-blue-400">
                      {formatRupiah(totalAmount)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <Calendar className="h-3.5 w-3.5 text-blue-500" />
                      <span>{formatDateID(dateStr)}</span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <CreditCard className="h-3.5 w-3.5 text-blue-500" />
                      <span>{receipt.metodePembayaran || 'Tunai'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
                      <span>Tipe: {receipt.receiptType || 'scan'}</span>
                    </div>
                  </div>

                  {receipt.keterangan && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-[11px] font-semibold text-slate-400">Keterangan:</p>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {receipt.keterangan}
                      </p>
                    </div>
                  )}
                </Card>

                {/* Items Table */}
                {receipt.items && receipt.items.length > 0 && (
                  <Card className="p-4 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-xs space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Rincian Barang ({receipt.items.length})
                    </h4>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {receipt.items.map((it, idx) => (
                        <div key={idx} className="py-2 flex items-center justify-between">
                          <div>
                            <span className="font-medium text-slate-800 dark:text-slate-200 block">
                              {it.namaBarang || it.name}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {it.qty} × {formatRupiah(it.harga || it.price || 0)}
                            </span>
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {formatRupiah(it.subtotal || (it.qty || 1) * (it.harga || 0))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Bottom Actions */}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={handleShare}
                    className="flex-1 rounded-xl h-11 border-slate-200 dark:border-slate-800 text-xs font-semibold"
                  >
                    <Share2 className="h-4 w-4 mr-1.5 text-blue-600" /> Bagikan
                  </Button>
                  {onDelete && (
                    <Button
                      variant="outline"
                      onClick={handleDelete}
                      className="rounded-xl h-11 px-4 border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                      title="Hapus Nota"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
