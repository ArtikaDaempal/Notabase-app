'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  SlidersHorizontal,
  ShoppingBag,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Pencil,
  Trash2,
  Share2,
  Eye,
  FileWarning,
  Clock,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { AppHeader } from '@/components/layout/app-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { formatRupiah, formatDateShort, timeAgo, cn } from '@/lib/utils'
import type { Receipt } from '@/types'

interface ReceiptListResponse {
  data: Receipt[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export function HistoryView() {
  const { openReceipt, navigate } = useAppStore()
  const [data, setData] = useState<ReceiptListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('date-desc')
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)

  // Categories for filter
  const [categories, setCategories] = useState<string[]>([])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350)
    return () => clearTimeout(t)
  }, [query])

  // Reset page on filter change
  useEffect(() => {
    setPage(1)
  }, [debouncedQuery, category, status, sort])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '10',
        sort,
      })
      if (debouncedQuery) params.set('q', debouncedQuery)
      if (category !== 'all') params.set('category', category)
      if (status !== 'all') params.set('status', status)
      const res = await fetch(`/api/receipts?${params}`)
      const json = await res.json()
      setData(json)
    } catch {
      toast.error('Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [page, sort, debouncedQuery, category, status])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Load categories once
  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((cats) => setCategories(['all', ...cats.map((c: { name: string }) => c.name)]))
      .catch(() => {})
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus nota ini? Tindakan tidak dapat dibatalkan.')) return
    try {
      const res = await fetch(`/api/receipts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Nota dihapus')
      fetchData()
    } catch {
      toast.error('Gagal menghapus')
    }
  }

  const activeFilterCount =
    (category !== 'all' ? 1 : 0) + (status !== 'all' ? 1 : 0)

  return (
    <div className="min-h-screen pb-24">
      <AppHeader title="History" subtitle="Riwayat nota digital tersimpan" />

      <main className="mx-auto w-full max-w-7xl px-4 py-4 space-y-4 sm:px-6 sm:py-6 lg:px-8">
        {/* Search bar */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari merchant, no. nota, deskripsi..."
            className="h-11 rounded-xl border-primary/20 bg-primary/5 pl-10 pr-10 focus-visible:bg-card"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter controls */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-9 flex-1 rounded-xl bg-card text-xs">
              <span className="text-muted-foreground">Urutkan:</span>
              <SelectValue className="font-medium" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Terbaru</SelectItem>
              <SelectItem value="date-asc">Terlama</SelectItem>
              <SelectItem value="amount-desc">Nominal Tertinggi</SelectItem>
              <SelectItem value="amount-asc">Nominal Terendah</SelectItem>
              <SelectItem value="merchant-asc">Merchant A-Z</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl"
            onClick={() => setShowFilters(true)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter
            {activeFilterCount > 0 && (
              <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {/* Results count */}
        <p className="text-xs text-muted-foreground">
          {loading
            ? 'Memuat...'
            : `${data?.total ?? 0} nota ditemukan`}
        </p>

        {/* Receipt cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="p-3">
                  <div className="flex gap-3">
                    <Skeleton className="h-16 w-16 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </div>
                </Card>
              ))
            : data?.data.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card className="overflow-hidden">
                    <div className="flex gap-3 p-3">
                      {/* Thumbnail */}
                      <button
                        onClick={() => openReceipt(r.id)}
                        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted"
                      >
                        {r.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.imageUrl}
                            alt={r.merchantName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
                            <ShoppingBag className="h-6 w-6" />
                          </div>
                        )}
                        {/* Verified badge */}
                        {r.status === 'verified' && (
                          <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                              <path d="M1.5 4L3 5.5L6.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        )}
                      </button>

                      {/* Info */}
                      <div className="flex flex-1 flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[11px] font-medium text-muted-foreground">
                                {r.invoiceNumber || 'No invoice'}
                              </p>
                              <p className="text-sm font-bold text-foreground">
                                {formatRupiah(r.total)}
                              </p>
                            </div>
                            {r.status === 'verified' ? (
                              <Badge variant="secondary" className="bg-emerald-50 text-[10px] font-semibold text-emerald-600">
                                Verified
                              </Badge>
                            ) : r.status === 'pending' ? (
                              <Badge variant="secondary" className="bg-amber-50 text-[10px] font-semibold text-amber-600">
                                <Clock className="mr-1 h-2.5 w-2.5" /> Pending
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-red-50 text-[10px] font-semibold text-red-600">
                                <FileWarning className="mr-1 h-2.5 w-2.5" /> Failed
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {r.merchantName} · {r.category}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatDateShort(r.transactionDate)} · {timeAgo(r.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 border-t border-border/60 bg-muted/30 px-3 py-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 flex-1 text-xs"
                        onClick={() => openReceipt(r.id)}
                      >
                        <Eye className="mr-1 h-3 w-3" /> Detail
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 flex-1 text-xs"
                        onClick={() => toast.info('Fitur edit akan tersedia')}
                      >
                        <Pencil className="mr-1 h-3 w-3" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 flex-1 text-xs text-destructive hover:text-destructive"
                        onClick={() => handleDelete(r.id)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" /> Hapus
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground"
                        onClick={() => toast.info('Nota dibagikan')}
                      >
                        <Share2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
        </div>

        {/* Empty state */}
        {!loading && data?.data.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Search className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-semibold text-foreground">
              Tidak ada nota ditemukan
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Coba ubah kata kunci atau filter pencarian
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => navigate('scan')}
            >
              Scan Nota Baru
            </Button>
          </div>
        )}

        {/* Pagination */}
        {!loading && data && data.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              Hal {page} / {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </main>

      {/* Filter sheet */}
      <Sheet open={showFilters} onOpenChange={setShowFilters}>
        <SheetContent className="w-[85vw] max-w-sm">
          <SheetHeader>
            <SheetTitle>Filter Nota</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Kategori</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c === 'all' ? 'Semua Kategori' : c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status OCR</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setCategory('all')
                  setStatus('all')
                }}
              >
                Reset
              </Button>
              <Button className="flex-1" onClick={() => setShowFilters(false)}>
                Terapkan
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
