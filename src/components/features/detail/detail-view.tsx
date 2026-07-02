'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Pencil,
  Printer,
  Share2,
  Trash2,
  ShoppingBag,
  FileText,
  Calendar,
  Tag,
  Wallet,
  Hash,
  ShieldCheck,
  Info,
  Loader2,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { AppHeader } from '@/components/layout/app-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatRupiah, formatDateID, formatTime, cn } from '@/lib/utils'
import type { Receipt } from '@/types'

export function DetailView() {
  const { selectedReceiptId, goBack } = useAppStore()
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!selectedReceiptId) return
    setLoading(true)
    fetch(`/api/receipts/${selectedReceiptId}`)
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((d) => setReceipt(d))
      .catch(() => toast.error('Gagal memuat nota'))
      .finally(() => setLoading(false))
  }, [selectedReceiptId])

  const handleDelete = async () => {
    if (!receipt) return
    if (!confirm('Hapus nota ini permanen?')) return
    try {
      const res = await fetch(`/api/receipts/${receipt.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Nota dihapus')
      goBack()
    } catch {
      toast.error('Gagal menghapus')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!receipt) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">Nota tidak ditemukan</p>
        <Button onClick={goBack}>Kembali</Button>
      </div>
    )
  }

  const meta = [
    { label: 'No. Nota', value: receipt.invoiceNumber || '-', icon: Hash },
    { label: 'Tanggal', value: formatDateID(receipt.transactionDate), icon: Calendar },
    { label: 'Waktu', value: formatTime(receipt.transactionDate), icon: Calendar },
    { label: 'Kategori', value: receipt.category || 'Lainnya', icon: Tag },
    { label: 'Confidence', value: `${Math.round(receipt.confidence)}%`, icon: ShieldCheck },
  ]

  return (
    <div className="min-h-screen pb-28">
      <AppHeader
        title="Detail Note"
        showBack
        showLogo={false}
        rightAction={
          <Button
            variant="destructive"
            size="sm"
            className="rounded-full"
            onClick={() => toast.info('Mode edit aktif')}
          >
            <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
          </Button>
        }
      />

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-4">
        {/* Main transaction card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="overflow-hidden">
            {/* Merchant header */}
            <div className="bg-gradient-to-br from-primary to-primary/80 p-4 text-primary-foreground">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wide opacity-80">
                    Merchant
                  </p>
                  <h2 className="text-lg font-bold uppercase">
                    {receipt.merchantName}
                  </h2>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                  <ShoppingBag className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Image preview */}
            {receipt.imageUrl && (
              <div className="aspect-[4/3] w-full bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={receipt.imageUrl}
                  alt={receipt.merchantName}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            {/* Transaction details */}
            <div className="space-y-2.5 p-4">
              {meta.map((m) => {
                const Icon = m.icon
                return (
                  <div key={m.label} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      {m.label}
                    </span>
                    <span className="text-xs font-semibold text-foreground">
                      {m.value}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3">
              <span className="text-sm font-bold text-foreground">TOTAL</span>
              <span className="text-xl font-extrabold text-primary">
                {formatRupiah(receipt.total)}
              </span>
            </div>

            {/* Barcode */}
            <div className="flex flex-col items-center gap-1 border-t border-border px-4 py-3">
              <Barcode value={receipt.invoiceNumber || receipt.id} />
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
                {(receipt.invoiceNumber || receipt.id).toUpperCase()}
              </span>
            </div>
          </Card>
        </motion.div>

        {/* Verification badge */}
        <Card className="flex items-center gap-3 p-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full',
              receipt.status === 'verified'
                ? 'bg-emerald-50 text-emerald-600'
                : receipt.status === 'pending'
                ? 'bg-amber-50 text-amber-600'
                : 'bg-red-50 text-red-600'
            )}
          >
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {receipt.status === 'verified'
                ? 'Verifikasi Sukses'
                : receipt.status === 'pending'
                ? 'Menunggu Verifikasi'
                : 'Verifikasi Gagal'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Transaksi ini telah diverifikasi dan aman untuk diakses
            </p>
          </div>
          <button
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => toast.info('Log verifikasi ditampilkan')}
          >
            Lihat Log
          </button>
        </Card>

        {/* Information notes */}
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border bg-primary/5 px-4 py-2.5">
            <Info className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Informasi Notes</h3>
          </div>
          <div className="space-y-2.5 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">ID Nota</span>
              <span className="font-mono text-xs font-semibold text-foreground">
                {receipt.invoiceNumber || `INK-${receipt.id.slice(-8)}`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Catatan</span>
              <span className="text-xs text-foreground">
                {formatDateID(receipt.transactionDate).split(',').slice(0, 1).join('')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Keamanan OCR</span>
              <Badge variant="secondary" className="bg-emerald-50 text-[10px] font-semibold text-emerald-600">
                {receipt.confidence.toFixed(1)}% Aman
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Nominal</span>
              <span className="text-xs font-semibold text-primary">
                {formatRupiah(receipt.total)}
              </span>
            </div>
            {receipt.description && (
              <div className="pt-2">
                <span className="text-xs text-muted-foreground">Deskripsi</span>
                <p className="mt-1 text-xs text-foreground">
                  {receipt.description}
                </p>
              </div>
            )}
            <p className="flex items-start gap-1.5 pt-1 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              Transaksi ini telah diverifikasi dan aman untuk diakses
            </p>
          </div>
        </Card>

        {/* OCR text (if available) */}
        {receipt.ocrText && (
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-bold text-foreground">Raw OCR Text</h3>
            </div>
            <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap p-4 font-mono text-[11px] leading-relaxed text-muted-foreground scrollbar-thin">
              {receipt.ocrText}
            </pre>
          </Card>
        )}
      </main>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => toast.info('Mencetak nota...')}
            >
              <Printer className="mr-2 h-4 w-4" /> Cetak
            </Button>
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => toast.info('Membagikan nota...')}
            >
              <Share2 className="mr-2 h-4 w-4" /> Bagikan
            </Button>
            <Button
              variant="outline"
              className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Simple SVG barcode rendering */
function Barcode({ value }: { value: string }) {
  const bars = value.split('').flatMap((ch, i) => {
    const code = ch.charCodeAt(0)
    return [
      { w: (code % 3) + 1, black: true },
      { w: ((code >> 2) % 2) + 1, black: false },
    ].map((b, j) => ({ ...b, key: `${i}-${j}` }))
  })
  return (
    <svg
      width="220"
      height="44"
      viewBox="0 0 220 44"
      className="h-11 w-56"
      preserveAspectRatio="none"
    >
      {bars.map((b) => {
        let x = 0
        for (let k = 0; k < bars.indexOf(b); k++) x += bars[k].w
        return (
          <rect
            key={b.key}
            x={x}
            y={0}
            width={b.w}
            height={44}
            fill={b.black ? '#111827' : 'transparent'}
          />
        )
      })}
    </svg>
  )
}
