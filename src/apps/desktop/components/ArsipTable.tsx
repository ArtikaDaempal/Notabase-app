/**
 * apps/desktop/components/ArsipTable.tsx
 * Desktop Data Table Component for Receipt Archive (02-design-system.md §4).
 *
 * Displays full tabular columns: No, No. Nota, Tanggal, Nama Toko, Kategori, Nominal, Status OCR, Sumber, Aksi.
 * Includes Pagination Controls & Skeleton Loaders.
 */

import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Camera,
  ImagePlus,
  WifiOff,
} from 'lucide-react'
import { OCRBadge } from '@/shared/ui/OCRBadge'
import { formatRupiah, formatDateShort, cn, isValidInvoiceNumber } from '@/lib/utils'
import type { Receipt, ReceiptType } from '@/shared/types/receipt'

export interface ArsipTableProps {
  receipts: Receipt[]
  isLoading?: boolean
  totalCount: number
  currentPage: number
  pageSize: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onViewDetail: (id: string) => void
  onDeleteReceipt?: (id: string) => void
  className?: string
}

const SOURCE_BADGE: Record<
  ReceiptType | 'scan' | 'gallery' | 'manual',
  { label: string; icon: typeof Camera; color: string }
> = {
  scan: { label: 'Scan', icon: Camera, color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
  gallery: { label: 'Galeri', icon: ImagePlus, color: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' },
  manual: { label: 'Manual', icon: FileText, color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' },
}

const KATEGORI_TAG_COLOR: Record<string, string> = {
  ATK: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  Konsumsi: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
  Operasional: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
  Transportasi: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  Utilitas: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
  Referensi: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300',
  Lainnya: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
}

export function ArsipTable({
  receipts,
  isLoading = false,
  totalCount,
  currentPage,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  onViewDetail,
  onDeleteReceipt,
  className,
}: ArsipTableProps) {
  const fromIndex = totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0
  const toIndex = Math.min(currentPage * pageSize, totalCount)

  return (
    <div className={cn('space-y-4', className)}>
      {/* ── Main Data Table ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
              <TableRow>
                <TableHead className="w-12 text-center text-xs font-bold text-slate-600 dark:text-slate-300">
                  NO.
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-600 dark:text-slate-300 w-36">
                  NO. NOTA
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-600 dark:text-slate-300 w-28">
                  TANGGAL
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-600 dark:text-slate-300 min-w-[160px]">
                  NAMA TOKO / MERCHANT
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-600 dark:text-slate-300 w-36">
                  NOMINAL (RP)
                </TableHead>
                <TableHead className="text-center text-xs font-bold text-slate-600 dark:text-slate-300 w-36">
                  STATUS OCR
                </TableHead>
                <TableHead className="text-center text-xs font-bold text-slate-600 dark:text-slate-300 w-28">
                  SUMBER
                </TableHead>
                <TableHead className="text-center text-xs font-bold text-slate-600 dark:text-slate-300 w-24">
                  AKSI
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {isLoading ? (
                Array.from({ length: pageSize > 10 ? 10 : pageSize }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-center"><Skeleton className="h-4 w-6 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 mx-auto rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 mx-auto rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16 mx-auto rounded-lg" /></TableCell>
                  </TableRow>
                ))
              ) : receipts.length > 0 ? (
                receipts.map((r, idx) => {
                  const merchantName = r.namaToko || r.merchantName || 'Nota'
                  const rawInv = r.receiptNumber || r.invoiceNumber
                  const receiptNumber = isValidInvoiceNumber(rawInv) ? rawInv : '-'
                  const dateStr = r.tanggal || r.transactionDate
                  const nominal = r.nominal ?? r.total ?? 0
                  const kategori = r.kategori || 'Lainnya'

                  const sourceKey = (r.receiptType ?? 'scan') as keyof typeof SOURCE_BADGE
                  const source = SOURCE_BADGE[sourceKey] ?? SOURCE_BADGE.scan
                  const SourceIcon = source.icon

                  const tagStyle = KATEGORI_TAG_COLOR[kategori] || KATEGORI_TAG_COLOR.Lainnya

                  return (
                    <TableRow
                      key={r.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* No */}
                      <TableCell className="text-center font-medium text-slate-500">
                        {fromIndex + idx}
                      </TableCell>

                      {/* No. Nota */}
                      <TableCell className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {receiptNumber}
                      </TableCell>

                      {/* Tanggal */}
                      <TableCell className="text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDateShort(dateStr)}
                      </TableCell>

                      {/* Nama Toko */}
                      <TableCell className="font-bold text-slate-900 dark:text-slate-100 max-w-[200px] truncate" title={merchantName}>
                        {merchantName}
                      </TableCell>

                      {/* Nominal */}
                      <TableCell className="text-right font-extrabold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {formatRupiah(nominal)}
                      </TableCell>

                      {/* Status OCR */}
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <OCRBadge status={r.statusOcr || r.status} confidence={r.ocrConfidence} size="sm" />
                        </div>
                      </TableCell>

                      {/* Sumber */}
                      <TableCell className="text-center">
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold', source.color)}>
                          <SourceIcon className="h-3 w-3" />
                          {source.label}
                        </span>
                      </TableCell>

                      {/* Aksi */}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onViewDetail(r.id)}
                            className="h-8 w-8 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg"
                            title="Lihat Detail Nota"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {onDeleteReceipt && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onDeleteReceipt(r.id)}
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg"
                              title="Hapus Nota"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <FileText className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Tidak ada nota ditemukan</p>
                      <p className="text-xs text-slate-400">Coba atur ulang kata kunci atau filter pencarian Anda</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Pagination Controls ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Menampilkan <strong className="text-slate-800 dark:text-slate-200">{fromIndex}–{toIndex}</strong> dari <strong className="text-slate-800 dark:text-slate-200">{totalCount}</strong> nota
          </span>
          <span className="hidden sm:inline">·</span>
          <div className="flex items-center gap-1.5">
            <span>Baris per halaman:</span>
            <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger className="h-8 w-16 rounded-lg text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1 || isLoading}
            onClick={() => onPageChange(currentPage - 1)}
            className="h-8 rounded-lg px-2.5 text-xs border-slate-200 dark:border-slate-700"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Sebelumnya
          </Button>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = i + 1
              return (
                <Button
                  key={p}
                  size="sm"
                  variant={p === currentPage ? 'default' : 'outline'}
                  onClick={() => onPageChange(p)}
                  className={cn(
                    'h-8 w-8 p-0 text-xs rounded-lg font-semibold',
                    p === currentPage
                      ? 'bg-blue-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300',
                  )}
                >
                  {p}
                </Button>
              )
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages || isLoading}
            onClick={() => onPageChange(currentPage + 1)}
            className="h-8 rounded-lg px-2.5 text-xs border-slate-200 dark:border-slate-700"
          >
            Berikutnya
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}
