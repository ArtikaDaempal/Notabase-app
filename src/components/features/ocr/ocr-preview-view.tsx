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
  Sparkles,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { AppHeader } from '@/components/layout/app-header'
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
import type { OcrResult } from '@/types'

const CATEGORIES = [
  'Makanan & Minuman',
  'Transportasi',
  'Alat Tulis Kantor',
  'Belanja',
  'Kesehatan',
  'Elektronik',
  'Lainnya',
]

export function OcrPreviewView() {
  const { pendingOcr, navigate, clearOcr } = useAppStore()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<OcrResult | null>(pendingOcr?.result ?? null)

  useEffect(() => {
    if (pendingOcr?.result) setForm(pendingOcr.result)
  }, [pendingOcr])

  if (!pendingOcr || !form) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Tidak ada data OCR</p>
          <Button className="mt-3" onClick={() => navigate('scan')}>
            Kembali ke Scan
          </Button>
        </div>
      </div>
    )
  }

  const confidence = form.confidence
  const confidenceTone =
    confidence >= 85
      ? 'text-emerald-600 bg-emerald-50'
      : confidence >= 65
      ? 'text-amber-600 bg-amber-50'
      : 'text-red-600 bg-red-50'

  const update = <K extends keyof OcrResult>(key: K, value: OcrResult[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f))

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    try {
      const dateStr = form.transactionDate
        ? new Date(form.transactionDate).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)

      const res = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber: form.invoiceNumber,
          merchantName: form.merchantName,
          transactionDate: dateStr,
          category: form.category,
          total: form.total,
          description: form.description,
          imageUrl: pendingOcr.imageUrl,
          ocrText: form.ocrText,
          confidence: form.confidence,
          status: 'verified',
          items: form.items,
        }),
      })
      if (!res.ok) throw new Error('Gagal menyimpan')
      toast.success('Nota berhasil disimpan ke database!')
      clearOcr()
      navigate('history')
    } catch (err) {
      console.error(err)
      toast.error('Gagal menyimpan nota')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen pb-24">
      <AppHeader
        title="Preview & OCR"
        subtitle="Review extracted information before saving"
        showBack
        showLogo={false}
      />

      <main className="mx-auto w-full max-w-7xl px-4 py-4 space-y-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-5">
          {/* Image preview - left column on large */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 lg:sticky lg:top-20 lg:self-start"
          >
            <Card className="overflow-hidden">
              <div className="relative aspect-[4/3] w-full bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pendingOcr.imageUrl}
                  alt="Receipt preview"
                  className="h-full w-full object-cover"
                />
              </div>
            </Card>

            {/* OCR results header - below image on large */}
            <div className="mt-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">Hasil OCR</h2>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold',
                  confidenceTone
                )}
              >
                {confidence >= 85 ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5" />
                )}
                Tingkat Akurasi: {Math.round(confidence)}%
              </span>
            </div>

            {confidence < 65 && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Akurasi OCR rendah. Periksa kembali semua field sebelum
                  menyimpan, atau lakukan scan ulang dengan pencahayaan yang lebih
                  baik.
                </span>
              </div>
            )}

            {/* Info note */}
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-primary/5 p-3 text-xs text-muted-foreground">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>
                Pastikan semua data telah sesuai dengan gambar asli sebelum
                menyimpannya. Sistem akan otomatis menyimpan data ke Notabase.
              </span>
            </div>
          </motion.div>

          {/* Form fields - right column on large */}
          <Card className="space-y-4 p-4 sm:p-5 lg:col-span-3">
          {/* Tanggal */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Tanggal
            </Label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                value={
                  form.transactionDate
                    ? new Date(form.transactionDate).toISOString().slice(0, 10)
                    : ''
                }
                onChange={(e) =>
                  update('transactionDate', e.target.value ? new Date(e.target.value).toISOString() : null)
                }
                className="pl-9 pr-9"
              />
              <Pencil className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            </div>
          </div>

          {/* Nama Toko */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Nama Toko
            </Label>
            <div className="relative">
              <Store className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={form.merchantName}
                onChange={(e) => update('merchantName', e.target.value)}
                className="pl-9 pr-9"
                placeholder="Nama merchant"
              />
              <Pencil className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            </div>
          </div>

          {/* Total */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Total (IDR)
            </Label>
            <div className="relative">
              <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                value={formatRupiah(form.total)}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^\d]/g, '')
                  update('total', cleaned ? parseInt(cleaned, 10) : 0)
                }}
                className="pl-9 pr-9 font-semibold"
                placeholder="Rp 0"
              />
              <Pencil className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            </div>
          </div>

          {/* Kategori */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Kategori
            </Label>
            <div className="relative">
              <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
              <Select
                value={form.category || 'Lainnya'}
                onValueChange={(v) => update('category', v)}
              >
                <SelectTrigger className="pl-9 pr-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Keterangan */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Keterangan
            </Label>
            <div className="relative">
              <FileText className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Textarea
                value={form.description || ''}
                onChange={(e) => update('description', e.target.value)}
                className="pl-9 min-h-[80px] resize-none"
                placeholder="Deskripsi pembelian"
              />
            </div>
          </div>

          {/* Invoice Number */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              No. Invoice
            </Label>
            <div className="relative">
              <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={form.invoiceNumber || ''}
                onChange={(e) => update('invoiceNumber', e.target.value)}
                className="pl-9"
                placeholder="Nomor invoice (opsional)"
              />
            </div>
          </div>
        </Card>
        </div>

        {/* Save button */}
        <div className="sticky bottom-20 z-20 mx-auto w-full max-w-md">
          <Button
            size="lg"
            className="w-full shadow-lg shadow-primary/30"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Simpan ke Database
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  )
}
