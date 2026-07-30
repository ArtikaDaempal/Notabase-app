'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Bell,
  ArrowLeft,
  SlidersHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileBadge,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { formatRupiah, formatDateShort, cn } from '@/lib/utils'
import type { Receipt } from '@/types'

interface ReceiptListResponse {
  data: Receipt[]
  total: number
  totalPages: number
}

export function SearchView() {
  const { goBack, navigate } = useAppStore()

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [status, setStatus] = useState('Semua Status')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [results, setResults] = useState<ReceiptListResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 400)
    return () => clearTimeout(t)
  }, [query])

  const doSearch = useCallback(async (pg = 1) => {
    setLoading(true)
    setSearched(true)
    try {
      const params = new URLSearchParams({ page: String(pg), pageSize: '10', sort: 'date-desc' })
      if (debouncedQuery) params.set('q', debouncedQuery)
      if (status !== 'Semua Status') params.set('status', status === 'Berhasil' ? 'verified' : status === 'Pending' ? 'pending' : 'failed')
      if (dateFrom) params.set('startDate', new Date(dateFrom).toISOString())
      if (dateTo) params.set('endDate', new Date(dateTo + 'T23:59:59').toISOString())
      const res = await fetch(`/api/receipts?${params}`)
      const json = await res.json()
      setResults(json)
      setPage(pg)
    } catch {
      toast.error('Gagal mencari nota')
    } finally {
      setLoading(false)
    }
  }, [debouncedQuery, status, dateFrom, dateTo])

  const activeFilters: { label: string; onRemove: () => void }[] = []
  if (dateFrom && dateTo) activeFilters.push({ label: `${dateFrom} - ${dateTo}`, onRemove: () => { setDateFrom(''); setDateTo('') } })
  else if (dateFrom) activeFilters.push({ label: `Dari: ${dateFrom}`, onRemove: () => setDateFrom('') })
  if (status !== 'Semua Status') activeFilters.push({ label: `Status OCR: ${status}`, onRemove: () => setStatus('Semua Status') })

  const resetAll = () => {
    setStatus('Semua Status')
    setDateFrom('')
    setDateTo('')
    setQuery('')
    setResults(null)
    setSearched(false)
  }

  const totalAmount = (results && Array.isArray(results.data)) ? results.data.reduce((acc, r) => acc + (r.nominal ?? r.total ?? 0), 0) : 0

  const handleExport = async (format: 'excel' | 'pdf') => {
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
      })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Hasil_Filter_${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'xlsx' : 'pdf'}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Berhasil diekspor ke ${format === 'excel' ? 'Excel' : 'PDF'}!`)
    } catch {
      toast.error('Gagal mengekspor')
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFF] pb-28">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur-lg">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={goBack}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h1 className="text-base font-bold text-slate-900">Pencarian &amp; Filter</h1>
                <p className="text-[10px] text-slate-400">Temukan nota spesifik berdasarkan kriteria</p>
              </div>
            </div>
            <button className="relative flex h-9 w-9 items-center justify-center rounded-full text-blue-600 hover:bg-slate-100 transition-colors">
              <Bell className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 py-6 space-y-4 sm:px-6 sm:max-w-2xl lg:max-w-5xl">
        {/* Search input */}
        <Card className="rounded-2xl border-slate-100 bg-white p-4 shadow-sm space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doSearch(1)}
              placeholder="Cari nama toko atau kata kunci..."
              className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-10 pr-4 focus-visible:border-blue-400 focus-visible:ring-blue-100"
            />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters((p) => !p)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <SlidersHorizontal className="h-4 w-4 text-slate-400" />
            Filter
          </button>

          {/* Filter panel */}
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 border-t border-slate-100 pt-3"
            >
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500">Dari Tanggal</label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500">Sampai Tanggal</label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500">Status OCR</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Semua Status">Semua Status</SelectItem>
                    <SelectItem value="Berhasil">Berhasil</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Gagal">Gagal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </motion.div>
          )}

          {/* Search button */}
          <button
            onClick={() => doSearch(1)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-md shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all"
          >
            <Search className="h-4 w-4" />
            Cari Nota
          </button>
        </Card>

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500">Filter aktif:</span>
            {activeFilters.map((f) => (
              <span
                key={f.label}
                className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700"
              >
                {f.label}
                <button onClick={f.onRemove} className="ml-0.5 text-blue-400 hover:text-blue-700">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button onClick={resetAll} className="text-[11px] font-medium text-red-500 hover:underline ml-1">
              Reset Semua
            </button>
          </div>
        )}

        {/* Results table */}
        {searched && (
          <>
            <Card className="overflow-hidden rounded-2xl border-slate-100 shadow-sm">
              {loading ? (
                <div className="space-y-0 divide-y divide-slate-100">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-3">
                      <Skeleton className="h-4 w-6" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  ))}
                </div>
              ) : results && Array.isArray(results.data) && results.data.length > 0 ? (
                <>
                  {/* Table header */}
                  <div className="grid grid-cols-[2rem_1fr_1fr_auto] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                    <span className="text-[11px] font-bold text-slate-500">NO.</span>
                    <span className="text-[11px] font-bold text-slate-500">TANGGAL</span>
                    <span className="text-[11px] font-bold text-slate-500">NAMA TOKO</span>
                    <span className="text-right text-[11px] font-bold text-slate-500">TOTAL</span>
                  </div>

                  {/* Table rows */}
                  <div className="divide-y divide-slate-50">
                    {(results.data || []).map((r, idx) => (
                      <motion.button
                        key={r.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.03 }}
                        onClick={() => useAppStore.getState().openReceipt(r.id)}
                        className="grid w-full grid-cols-[2rem_1fr_1fr_auto] gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                      >
                        <span className="text-xs font-semibold text-slate-400">{(page - 1) * 10 + idx + 1}</span>
                        <span className="text-xs text-slate-600">{formatDateShort(r.tanggal || r.transactionDate)}</span>
                        <span className="text-xs font-semibold text-slate-800 truncate">{r.namaToko || r.merchantName || 'Lainnya'}</span>
                        <span className="text-right text-xs font-bold text-blue-600">{formatRupiah(r.nominal ?? r.total)}</span>
                      </motion.button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <Search className="h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-600">Tidak ada hasil ditemukan</p>
                  <p className="mt-1 text-xs text-slate-400">Coba ubah kata kunci atau filter pencarian</p>
                </div>
              )}
            </Card>

            {/* Pagination */}
            {results && results.totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-400">
                  Menampilkan {(page - 1) * 10 + 1}–{Math.min(page * 10, results.total)} dari {results.total} nota
                </p>
                <div className="flex items-center gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => doSearch(page - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(results.totalPages, 5) }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => doSearch(p)}
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
                  {results.totalPages > 5 && (
                    <span className="flex h-8 items-center px-1 text-xs text-slate-400">... {results.totalPages}</span>
                  )}
                  <button
                    disabled={page >= results.totalPages}
                    onClick={() => doSearch(page + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Total result card */}
            {results && Array.isArray(results.data) && results.data.length > 0 && (
              <div className="rounded-2xl bg-blue-600 p-5 shadow-md shadow-blue-200">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">TOTAL HASIL PENCARIAN</p>
                <p className="mt-1 text-3xl font-extrabold text-white">{formatRupiah(totalAmount)}</p>
                <p className="mt-0.5 text-[11px] text-blue-300">Berdasarkan filter aktif saat ini</p>
              </div>
            )}

            {/* Export card */}
            {results && Array.isArray(results.data) && results.data.length > 0 && (
              <Card className="rounded-2xl border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-sm font-bold text-slate-900">Ekspor Hasil Filter</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Unduh data yang sudah difilter ke dalam format laporan.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleExport('excel')}
                    className="flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 py-3 text-sm font-semibold text-green-700 hover:bg-green-100 transition-colors"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors"
                  >
                    <FileBadge className="h-4 w-4" />
                    PDF
                  </button>
                </div>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  )
}
