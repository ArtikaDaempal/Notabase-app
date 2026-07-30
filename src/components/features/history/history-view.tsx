'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  X,
  Trash2,
  Eye,
  FileWarning,
  Clock,
  Bell,
  ScanLine,
  Filter,
  ChevronLeft,
  ChevronRight,
  ScanText,
  Cloud,
  FileSpreadsheet,
  ImagePlus,
  ArrowLeft,
  Images,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { useWorkspaceStore } from '@/store/workspace-store'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { SyncIndicator } from '@/components/ui/sync-indicator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { formatRupiah, formatDateShort, timeAgo, cn, isValidInvoiceNumber } from '@/lib/utils'
import { DEFAULT_WORKSPACE_ID } from '@/lib/constants'
import type { Receipt } from '@/types'

interface ReceiptListResponse {
  data: Receipt[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export function HistoryView() {
  const { openReceipt, navigate, goBack } = useAppStore()
  const [data, setData] = useState<ReceiptListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [sort, setSort] = useState('date-desc')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    setPage(1)
  }, [debouncedQuery, status, sort])

  const workspaceId = useWorkspaceStore((s) => s.workspaceId) || DEFAULT_WORKSPACE_ID

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '10', sort })
      if (debouncedQuery) params.set('q', debouncedQuery)
      if (status !== 'all') params.set('status', status)
      const res = await fetch(`/api/receipts?${params}`, {
        headers: { 'x-workspace-id': workspaceId },
      })
      const json = await res.json()
      setData(json)
    } catch {
      toast.error('Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [page, sort, debouncedQuery, status, workspaceId])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus nota ini? Tindakan tidak dapat dibatalkan.')) return
    try {
      const res = await fetch(`/api/receipts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notabase_receipts_changed'))
        window.dispatchEvent(new Event('receipts-updated'))
        window.dispatchEvent(new Event('receipt-deleted'))
      }
      toast.success('Berhasil terhapus')
      fetchData()
    } catch {
      toast.error('Gagal menghapus')
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFF] pb-28">
      {/* Custom header */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-lg md:hidden">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={goBack}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors"
                aria-label="Kembali"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className="text-lg font-bold text-blue-600">Notabase</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Sync status pill — permanen di header Arsip (BR-SYNC-02) */}
              <SyncIndicator variant="header" />
              <button
                onClick={() => navigate('search')}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-blue-600 hover:bg-slate-50 transition-colors shadow-sm"
                aria-label="Pencarian & Filter"
              >
                <Filter className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigate('gallery')}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-violet-600 hover:bg-slate-50 transition-colors shadow-sm"
                aria-label="Arsip Gambar"
                title="Arsip Gambar"
              >
                <Images className="h-4 w-4" />
              </button>
              <button className="relative flex h-9 w-9 items-center justify-center rounded-full text-blue-600 hover:bg-slate-100 transition-colors">
                <Bell className="h-5 w-5" />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
              </button>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 border border-slate-200">
                AD
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Page title */}
        <div className="mb-5 space-y-0.5">
          <h1 className="text-2xl font-bold text-slate-900">Arsip Nota</h1>
          <p className="text-sm text-slate-500">Temukan dan kelola semua nota digital Anda</p>
        </div>

        {/* Scan CTA button */}
        <button
          onClick={() => navigate('scan')}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-200 hover:bg-blue-700 active:scale-[0.99] transition-all"
        >
          <ScanLine className="h-4 w-4" />
          Scan Nota Baru
        </button>

        {/* Search bar */}
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nota, merchant, deskripsi..."
            className="h-11 rounded-2xl border-slate-200 bg-white pl-10 pr-10 shadow-sm focus-visible:border-blue-400 focus-visible:ring-blue-100"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter row */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-9 w-[145px] rounded-xl border-slate-200 bg-white text-xs shadow-sm shrink-0">
              <SelectValue placeholder="Urutkan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Terbaru</SelectItem>
              <SelectItem value="date-asc">Terlama</SelectItem>
              <SelectItem value="amount-desc">Nominal ↓</SelectItem>
              <SelectItem value="amount-asc">Nominal ↑</SelectItem>
              <SelectItem value="merchant-asc">Merchant A-Z</SelectItem>
            </SelectContent>
          </Select>

          <button
            onClick={() => { setSort('date-desc'); setQuery('') }}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-500 shadow-sm hover:bg-slate-50 transition-colors shrink-0"
          >
            <Filter className="h-3.5 w-3.5" />
            Reset Filter
          </button>

          <span className="ml-auto text-xs text-slate-400">
            {loading ? '...' : `${data?.total ?? 0} nota`}
          </span>
        </div>

        {/* Receipt list (vertical card stack like mockup) */}
        <div className="space-y-3 sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="flex items-start gap-3 rounded-2xl border-slate-100 bg-white p-3 shadow-sm">
                  <Skeleton className="h-20 w-24 shrink-0 rounded-xl" />
                  <div className="flex-1 space-y-2 pt-1">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-7 w-20 rounded-lg" />
                  </div>
                </Card>
              ))
            : (data?.data && Array.isArray(data.data) ? data.data : []).map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card className="overflow-hidden rounded-2xl border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3 p-3">
                      {/* Thumbnail */}
                      <button
                        onClick={() => openReceipt(r.id)}
                        className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100"
                      >
                        {r.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.imageUrl} alt={r.merchantName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-blue-50 text-blue-400">
                            <FileWarning className="h-7 w-7" />
                          </div>
                        )}
                        {/* Status badge on image */}
                        <span className={cn(
                          'absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                          (r.status === 'verified' || r.status === 'berhasil' || r.status === 'manual' || r.statusOcr === 'berhasil' || r.statusOcr === 'manual') ? 'bg-emerald-500 text-white' :
                          (r.status === 'pending' || r.status === 'perlu_review' || r.statusOcr === 'perlu_review') ? 'bg-amber-400 text-white' : 'bg-red-500 text-white'
                        )}>
                          {(r.status === 'verified' || r.status === 'berhasil' || r.status === 'manual' || r.statusOcr === 'berhasil' || r.statusOcr === 'manual') ? 'Berhasil' : (r.status === 'pending' || r.status === 'perlu_review' || r.statusOcr === 'perlu_review') ? 'Pending' : 'Gagal'}
                        </span>
                      </button>

                      {/* Info */}
                      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                        {isValidInvoiceNumber(r.invoiceNumber) ? (
                          <p className="text-[11px] font-medium text-slate-400 truncate">{r.invoiceNumber}</p>
                        ) : null}
                        <div className="flex items-center gap-1.5">
                          <p className="text-base font-bold text-blue-600">{formatRupiah(r.total)}</p>
                          {/* Badge Menunggu Sync — BR-SYNC-02: tampil jika nota belum tersync */}
                          {r.synced === false && (
                            <span className="flex items-center gap-0.5 rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600">
                              <Cloud className="h-2.5 w-2.5" />
                              Pending
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 truncate">{r.merchantName}</p>
                        <p className="text-[10px] text-slate-400">{formatDateShort(r.transactionDate)}</p>

                        {/* Action buttons */}
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <button
                            onClick={() => openReceipt(r.id)}
                            className="flex h-7 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            <Eye className="h-3 w-3" />
                            Lihat Detail
                          </button>
                          <button
                            onClick={() => handleDelete(r.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-red-400 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
        </div>

        {/* Empty state - rich illustrated state matching mockup */}
        {!loading && data?.data.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-8 text-center"
          >
            {/* 3D box illustration */}
            <div className="relative mb-6 flex h-40 w-40 items-center justify-center">
              <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
                {/* Box body */}
                <path d="M80 40L128 64V104L80 128L32 104V64L80 40Z" fill="#EEF2FF" stroke="#C7D2FE" strokeWidth="2"/>
                {/* Top face */}
                <path d="M80 40L128 64L80 88L32 64L80 40Z" fill="#E0E7FF" stroke="#A5B4FC" strokeWidth="2"/>
                {/* Left face */}
                <path d="M32 64L80 88V128L32 104V64Z" fill="#C7D2FE" stroke="#818CF8" strokeWidth="2"/>
                {/* Right face */}
                <path d="M80 88L128 64V104L80 128V88Z" fill="#A5B4FC" stroke="#6366F1" strokeWidth="2"/>
                {/* Lid top highlight */}
                <path d="M80 36L130 62" stroke="#818CF8" strokeWidth="1.5" strokeDasharray="4 3"/>
                {/* Dollar sign */}
                <circle cx="54" cy="100" r="10" fill="#DBEAFE" stroke="#60A5FA" strokeWidth="1.5"/>
                <text x="54" y="104" textAnchor="middle" fontSize="11" fill="#2563EB" fontWeight="bold">$</text>
                {/* Receipt icon top right */}
                <rect x="108" y="30" width="20" height="26" rx="3" fill="white" stroke="#93C5FD" strokeWidth="1.5"/>
                <line x1="112" y1="38" x2="124" y2="38" stroke="#93C5FD" strokeWidth="1.5"/>
                <line x1="112" y1="43" x2="124" y2="43" stroke="#93C5FD" strokeWidth="1.5"/>
                <line x1="112" y1="48" x2="119" y2="48" stroke="#93C5FD" strokeWidth="1.5"/>
              </svg>
            </div>

            <h2 className="text-xl font-bold text-slate-900">Belum ada nota yang<br />tersimpan</h2>
            <p className="mt-2 max-w-xs text-sm text-slate-500">
              Mulai scan atau import nota pertama Anda untuk mulai mengelola pengeluaran digital secara otomatis.
            </p>

            {/* CTA buttons */}
            <div className="mt-6 flex w-full max-w-xs flex-col gap-2.5">
              <button
                onClick={() => navigate('scan')}
                className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-sm font-semibold text-white shadow-md shadow-blue-200 hover:bg-blue-700 active:scale-[0.99] transition-all"
              >
                <ScanLine className="h-4 w-4" />
                Scan Nota Sekarang
              </button>
              <button
                className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 active:scale-[0.99] transition-all"
              >
                <ImagePlus className="h-4 w-4" />
                Import dari Galeri
              </button>
            </div>

            {/* Feature highlights */}
            <div className="mt-8 w-full max-w-xs space-y-2">
              {[
                { icon: ScanText, label: 'OCR Otomatis', desc: 'Deteksi teks receipt instan.' },
                { icon: Cloud, label: 'Cloud Backup', desc: 'Sinkron ke OneDrive aman.' },
                { icon: FileSpreadsheet, label: 'Laporan Excel', desc: 'Export data satu klik.' },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-3 rounded-2xl bg-white border border-slate-100 px-4 py-3 shadow-sm text-left">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                    <f.icon className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{f.label}</p>
                    <p className="text-[11px] text-slate-400">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Pagination */}
        {!loading && data && data.totalPages > 1 && (
          <div className="mt-5 flex items-center justify-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(data.totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition-colors',
                  p === page
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                )}
              >
                {p}
              </button>
            ))}
            {data.totalPages > 5 && <span className="text-xs text-slate-400">... {data.totalPages}</span>}
            <button
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
