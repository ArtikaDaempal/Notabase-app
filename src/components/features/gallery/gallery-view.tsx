'use client'

/**
 * gallery-view.tsx
 * Main gallery page showing all scanned receipt images in a grid or list layout.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Images,
  LayoutGrid,
  List,
  Bell,
  ArrowLeft,
  Search,
  X,
  ScanLine,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ReceiptImageCard } from './receipt-image-card'
import { ImageLightbox } from './image-lightbox'
import { GalleryFilters, type GalleryFilterState } from './gallery-filters'
import { formatDateShort, formatRupiah } from '@/lib/utils'
import type { Receipt } from '@/types'
import { cn } from '@/lib/utils'

type ViewMode = 'grid' | 'list'

const DEFAULT_FILTERS: GalleryFilterState = {
  receiptType: 'all',
  sort: 'date-desc',
  dateRange: 'all',
}

const PAGE_SIZE = 24

function buildQuery(
  q: string,
  filters: GalleryFilterState,
  page: number
): string {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
    sort: filters.sort,
  })
  if (q) params.set('q', q)
  if (filters.receiptType !== 'all') params.set('receiptType', filters.receiptType)
  if (filters.dateRange !== 'all') {
    const now = new Date()
    if (filters.dateRange === 'today') {
      params.set('startDate', now.toISOString().slice(0, 10))
      params.set('endDate', now.toISOString().slice(0, 10))
    } else if (filters.dateRange === 'week') {
      const start = new Date(now); start.setDate(now.getDate() - 6)
      params.set('startDate', start.toISOString().slice(0, 10))
    } else if (filters.dateRange === 'month') {
      params.set('startDate', `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`)
    }
  }
  return `/api/receipts?${params}`
}

export function GalleryView() {
  const { goBack, navigate, openReceipt } = useAppStore()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [filters, setFilters] = useState<GalleryFilterState>(DEFAULT_FILTERS)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350)
    return () => clearTimeout(t)
  }, [query])

  // Reset page on filter/search change
  useEffect(() => { setPage(1) }, [debouncedQuery, filters])

  const fetchReceipts = useCallback(async () => {
    setLoading(true)
    try {
      const url = buildQuery(debouncedQuery, filters, page)
      const res = await fetch(url)
      const json = await res.json()
      setReceipts(Array.isArray(json.data) ? json.data : [])
      setTotal(json.total ?? 0)
      setTotalPages(json.totalPages ?? 1)
    } catch {
      setReceipts([])
    } finally {
      setLoading(false)
    }
  }, [debouncedQuery, filters, page])

  useEffect(() => { fetchReceipts() }, [fetchReceipts])

  const openLightbox = (index: number) => setLightboxIndex(index)
  const closeLightbox = () => setLightboxIndex(null)

  return (
    <div className="min-h-screen bg-[#F8FAFF] pb-28">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-lg">
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
              {/* Grid / List toggle */}
              <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-lg transition-all',
                    viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'
                  )}
                  aria-label="Grid view"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-lg transition-all',
                    viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'
                  )}
                  aria-label="List view"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
              <button className="relative flex h-9 w-9 items-center justify-center rounded-full text-blue-600 hover:bg-slate-100 transition-colors">
                <Bell className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Title */}
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100">
            <Images className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Arsip Gambar</h1>
            <p className="text-sm text-slate-500">Semua gambar nota yang pernah di-scan</p>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama merchant, nomor nota..."
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

        {/* Filters */}
        <div className="mb-5">
          <GalleryFilters
            filters={filters}
            onChange={setFilters}
            total={total}
            loading={loading}
          />
        </div>

        {/* ── GRID MODE ── */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {loading
              ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="aspect-[3/4] w-full rounded-2xl" />
                    <Skeleton className="h-3 w-3/4 rounded" />
                    <Skeleton className="h-3 w-1/2 rounded" />
                  </div>
                ))
              : receipts.map((r, i) => (
                  <ReceiptImageCard
                    key={r.id}
                    receipt={r}
                    index={i}
                    onClick={() => openLightbox(i)}
                  />
                ))}
          </div>
        )}

        {/* ── LIST MODE ── */}
        {viewMode === 'list' && (
          <div className="space-y-2">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
                    <Skeleton className="h-16 w-16 shrink-0 rounded-xl" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-40" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))
              : receipts.map((r, i) => (
                  <motion.button
                    key={r.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => openLightbox(i)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100 hover:ring-blue-200 hover:shadow-md transition-all text-left"
                  >
                    {/* Thumbnail */}
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {r.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.imageUrl} alt={r.merchantName} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-blue-50 text-blue-300">
                          <Images className="h-6 w-6" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{r.merchantName}</p>
                      <p className="text-sm font-semibold text-blue-600">{formatRupiah(r.total)}</p>
                      <p className="text-xs text-slate-400">{formatDateShort(r.transactionDate)}</p>
                    </div>

                    {/* Action badge */}
                    <span className="shrink-0 rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase text-slate-500">
                      {r.receiptType ?? 'scan'}
                    </span>
                  </motion.button>
                ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && receipts.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50">
              <Images className="h-10 w-10 text-blue-300" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Belum ada gambar</h2>
            <p className="mt-1 max-w-xs text-sm text-slate-500">
              Scan nota pertama Anda untuk memulai arsip gambar digital.
            </p>
            <button
              onClick={() => navigate('scan')}
              className="mt-6 flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition-colors"
            >
              <ScanLine className="h-4 w-4" />
              Scan Nota Sekarang
            </button>
          </motion.div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              ‹
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl text-xs font-semibold transition-colors',
                  p === page
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                )}
              >
                {p}
              </button>
            ))}
            {totalPages > 7 && <span className="text-xs text-slate-400">... {totalPages}</span>}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              ›
            </button>
          </div>
        )}
      </main>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <ImageLightbox
          receipts={receipts}
          initialIndex={lightboxIndex}
          onClose={closeLightbox}
        />
      )}
    </div>
  )
}
