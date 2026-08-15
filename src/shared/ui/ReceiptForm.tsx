/**
 * shared/ui/ReceiptForm.tsx
 * Reusable Form Component for Creating & Editing Receipts.
 *
 * Dokumen acuan:
 *   02-design-system.md §3.6 (Form Input, Label, Icon) & §3.7 (Tombol)
 *   03-business-rules.md (BR-MAN-01..04: Penomoran otomatis, validasi minimum, kalkulasi subtotal/diskon/pajak)
 */

import React, { useState, useEffect } from 'react'
import {
  Store,
  Calendar,
  Wallet,
  Hash,
  Tag,
  CreditCard,
  FileText,
  Plus,
  Trash2,
  Save,
  X,
  Loader2,
  LayoutTemplate,
  Phone,
} from 'lucide-react'
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
import { formatRupiah, cn } from '@/lib/utils'
import { calculateReceiptTotals } from '../services/receiptService'
import type { Receipt, ReceiptItem } from '../types/receipt'

export const METODE_PEMBAYARAN_OPTIONS = [
  { value: 'Tunai', label: 'Tunai / Cash' },
  { value: 'Debit', label: 'Kartu Debit' },
  { value: 'Kredit', label: 'Kartu Kredit' },
  { value: 'QRIS', label: 'QRIS / E-Wallet' },
  { value: 'Transfer', label: 'Transfer Bank' },
]

export interface ReceiptFormProps {
  initialData?: Partial<Receipt>
  onSubmit: (data: Partial<Receipt>) => Promise<void> | void
  onCancel?: () => void
  isSaving?: boolean
  className?: string
}

export function ReceiptForm({
  initialData,
  onSubmit,
  onCancel,
  isSaving = false,
  className,
}: ReceiptFormProps) {
  const [namaToko, setNamaToko] = useState(initialData?.namaToko || initialData?.merchantName || '')
  const [tanggal, setTanggal] = useState(
    initialData?.tanggal || initialData?.transactionDate?.split('T')[0] || new Date().toISOString().slice(0, 10),
  )
  const [receiptNumber, setReceiptNumber] = useState(
    initialData?.receiptNumber || initialData?.invoiceNumber || '',
  )
  const [receiptTemplate, setReceiptTemplate] = useState(initialData?.receiptTemplate || '80mm')
  const [keterangan, setKeterangan] = useState(
    initialData?.keterangan || initialData?.description || '',
  )

  const [noTelepon, setNoTelepon] = useState(initialData?.noTelepon || '')
  const [diskon, setDiskon] = useState<number>(initialData?.diskon ?? 0)
  const [pajak, setPajak] = useState<number>(initialData?.pajak ?? 0)
  const [biayaTambahan, setBiayaTambahan] = useState<number>(initialData?.biayaTambahan ?? 0)
  const [namaBiayaTambahan, setNamaBiayaTambahan] = useState(initialData?.namaBiayaTambahan || '')

  // Items state
  const [items, setItems] = useState<ReceiptItem[]>(() => {
    if (initialData?.items && initialData.items.length > 0) {
      return initialData.items.map((it, idx) => ({
        id: it.id,
        namaBarang: it.namaBarang || it.name || '',
        qty: it.qty || 1,
        harga: it.harga || it.price || 0,
        subtotal: (it.qty || 1) * (it.harga || it.price || 0),
        urutan: it.urutan ?? idx,
      }))
    }
    return []
  })

  // Errors state
  const [errors, setErrors] = useState<{ namaToko?: string; tanggal?: string }>({})

  // Calculated totals (BR-MAN-03 & BR-MAN-04)
  const { itemsWithSubtotal, totalNominal } = calculateReceiptTotals(items, diskon, pajak)
  const rawSubtotalSum = itemsWithSubtotal.reduce((sum, item) => sum + item.subtotal, 0)

  // Update item field
  const handleItemChange = (index: number, field: keyof ReceiptItem, val: any) => {
    const updated = [...items]
    const current = { ...updated[index], [field]: val }

    if (field === 'qty' || field === 'harga') {
      const q = Math.max(1, Number(current.qty) || 1)
      const h = Math.max(0, Number(current.harga) || 0)
      current.qty = q
      current.harga = h
      current.subtotal = q * h
    }

    updated[index] = current
    setItems(updated)
  }

  // Add item
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        namaBarang: '',
        qty: 1,
        harga: 0,
        subtotal: 0,
        urutan: prev.length,
      },
    ])
  }

  // Remove item
  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  // Form submit handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // BR-MAN-02: Validasi minimum
    const newErrors: { namaToko?: string; tanggal?: string } = {}
    if (!namaToko.trim()) {
      newErrors.namaToko = 'Nama toko wajib diisi'
    }
    if (!tanggal) {
      newErrors.tanggal = 'Tanggal transaksi wajib diisi'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})

    const computedTotal = items.length > 0
      ? (rawSubtotalSum - Number(diskon || 0) + Number(pajak || 0) + Number(biayaTambahan || 0))
      : Number(initialData?.nominal ?? totalNominal)

    const payload: Partial<Receipt> = {
      ...initialData,
      namaToko: namaToko.trim(),
      tanggal,
      noTelepon: noTelepon.trim() || undefined,
      receiptNumber: receiptNumber.trim() || undefined,
      receiptTemplate,
      keterangan: keterangan.trim() || undefined,
      subtotalNominal: rawSubtotalSum || undefined,
      diskon: Number(diskon) || 0,
      pajak: Number(pajak) || 0,
      biayaTambahan: Number(biayaTambahan) || 0,
      namaBiayaTambahan: namaBiayaTambahan.trim() || undefined,
      nominal: computedTotal,
      items: itemsWithSubtotal,

      // Deprecated aliases
      merchantName: namaToko.trim(),
      transactionDate: tanggal,
      invoiceNumber: receiptNumber.trim() || undefined,
      total: computedTotal,
      description: keterangan.trim() || undefined,
    }

    onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-6', className)}>
      <Card className="p-5 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-xs space-y-5">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Store className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Informasi Utama Nota
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Nama Toko */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <Store className="h-3.5 w-3.5 text-blue-500" />
              Nama Toko / Merchant <span className="text-red-500">*</span>
            </Label>
            <Input
              value={namaToko}
              onChange={(e) => setNamaToko(e.target.value)}
              placeholder="Contoh: Toko Buku Gramedia"
              className={cn(
                'rounded-xl h-11 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm',
                errors.namaToko && 'border-red-500 focus-visible:ring-red-200',
              )}
            />
            {errors.namaToko && (
              <p className="text-xs text-red-500 font-medium">{errors.namaToko}</p>
            )}
          </div>

          {/* Tanggal */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <Calendar className="h-3.5 w-3.5 text-blue-500" />
              Tanggal Transaksi <span className="text-red-500">*</span>
            </Label>
            <Input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className={cn(
                'rounded-xl h-11 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm',
                errors.tanggal && 'border-red-500 focus-visible:ring-red-200',
              )}
            />
            {errors.tanggal && (
              <p className="text-xs text-red-500 font-medium">{errors.tanggal}</p>
            )}
          </div>

          {/* Nomor Nota */}
          <div className="space-y-1.5">
            <Label className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 text-blue-500" /> No. Nota / Invoice
              </span>
              <span className="text-[10px] text-slate-400 font-normal">(Opsional)</span>
            </Label>
            <Input
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              placeholder="Nomor invoice / nota"
              className="rounded-xl h-11 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-mono"
            />
          </div>

          {/* No Telepon Toko */}
          <div className="space-y-1.5">
            <Label className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-blue-500" /> No. Telepon Toko
              </span>
              <span className="text-[10px] text-slate-400 font-normal">(Opsional)</span>
            </Label>
            <Input
              value={noTelepon}
              onChange={(e) => setNoTelepon(e.target.value)}
              placeholder="Nomor telepon toko"
              type="tel"
              className="rounded-xl h-11 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm"
            />
          </div>




          {/* Template Nota */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <LayoutTemplate className="h-3.5 w-3.5 text-blue-500" /> Template Format Nota
            </Label>
            <Select value={receiptTemplate} onValueChange={setReceiptTemplate}>
              <SelectTrigger className="rounded-xl h-11 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm">
                <SelectValue placeholder="Pilih format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="58mm">Struk Thermal 58mm</SelectItem>
                <SelectItem value="80mm">Struk Thermal 80mm</SelectItem>
                <SelectItem value="A4">Faktur / Invoice A4</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Rincian Item Barang (Dynamic Table - BR-MAN-03) */}
      <Card className="p-5 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Rincian Item Barang
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddItem}
            className="rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Tambah Item
          </Button>
        </div>

        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold text-left">
                  <th className="py-2.5 px-2">Nama Barang</th>
                  <th className="py-2.5 px-2 text-center w-20">Qty</th>
                  <th className="py-2.5 px-2 text-right w-28">Harga (Rp)</th>
                  <th className="py-2.5 px-2 text-right w-28">Subtotal (Rp)</th>
                  <th className="py-2.5 px-2 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-1">
                      <Input
                        value={item.namaBarang}
                        onChange={(e) => handleItemChange(idx, 'namaBarang', e.target.value)}
                        placeholder="Nama barang / jasa"
                        className="rounded-lg h-9 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      />
                    </td>
                    <td className="py-2 px-1 text-center">
                      <Input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                        className="rounded-lg h-9 text-xs text-center bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      />
                    </td>
                    <td className="py-2 px-1 text-right">
                      <Input
                        type="number"
                        min="0"
                        value={item.harga}
                        onChange={(e) => handleItemChange(idx, 'harga', e.target.value)}
                        className="rounded-lg h-9 text-xs text-right bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      />
                    </td>
                    <td className="py-2 px-2 text-right font-semibold text-slate-800 dark:text-slate-200">
                      {formatRupiah(item.subtotal)}
                    </td>
                    <td className="py-2 px-1 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(idx)}
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg"
                        title="Hapus Item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">Belum ada item rincian barang</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              className="rounded-xl text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Tambah Item Pertama
            </Button>
          </div>
        )}

        {/* Diskon, Pajak, Biaya Tambahan & Ringkasan Total (BR-MAN-04) */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Diskon (Rp)</Label>
              <Input
                type="number"
                min="0"
                value={diskon}
                onChange={(e) => setDiskon(Number(e.target.value) || 0)}
                className="rounded-xl h-10 text-xs border-slate-200 dark:border-slate-700"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Pajak (Rp)</Label>
              <Input
                type="number"
                min="0"
                value={pajak}
                onChange={(e) => setPajak(Number(e.target.value) || 0)}
                className="rounded-xl h-10 text-xs border-slate-200 dark:border-slate-700"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Nama Biaya Tambahan</Label>
              <Input
                type="text"
                value={namaBiayaTambahan}
                onChange={(e) => setNamaBiayaTambahan(e.target.value)}
                className="rounded-xl h-10 text-xs border-slate-200 dark:border-slate-700"
                placeholder="Service Charge"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Nominal Biaya (Rp)</Label>
              <Input
                type="number"
                min="0"
                value={biayaTambahan}
                onChange={(e) => setBiayaTambahan(Number(e.target.value) || 0)}
                className="rounded-xl h-10 text-xs border-slate-200 dark:border-slate-700"
                placeholder="0"
              />
            </div>
          </div>

          <div className="bg-blue-50/60 dark:bg-blue-950/30 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50 space-y-1.5 text-right">
            {items.length > 0 && (
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Subtotal Item:</span>
                <span>{formatRupiah(rawSubtotalSum)}</span>
              </div>
            )}
            {diskon > 0 && (
              <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                <span>Diskon (-):</span>
                <span>-{formatRupiah(diskon)}</span>
              </div>
            )}
            {pajak > 0 && (
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Pajak (+):</span>
                <span>+{formatRupiah(pajak)}</span>
              </div>
            )}
            {biayaTambahan > 0 && (
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>{namaBiayaTambahan || 'Biaya Tambahan'} (+):</span>
                <span>+{formatRupiah(biayaTambahan)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-extrabold text-blue-700 dark:text-blue-400 pt-1 border-t border-blue-200/50 dark:border-blue-900">
              <span>TOTAL NOMINAL:</span>
              <span>{formatRupiah(computedTotal)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Keterangan Tambahan */}
      <Card className="p-5 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-xs space-y-2">
        <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
          <FileText className="h-3.5 w-3.5 text-blue-500" /> Keterangan / Catatan Transaksi
        </Label>
        <Textarea
          value={keterangan}
          onChange={(e) => setKeterangan(e.target.value)}
          placeholder="Catatan tambahan (misal: keperluan kegiatan BPSDMP, garansi barang, dll)"
          className="rounded-xl border-slate-200 dark:border-slate-700 min-h-[80px] text-xs resize-none"
        />
      </Card>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-xl h-11 px-5 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
          >
            <X className="h-4 w-4 mr-1.5" /> Batal
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSaving}
          className="rounded-xl h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-200 dark:shadow-none"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Menyimpan...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" /> Simpan Nota
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
