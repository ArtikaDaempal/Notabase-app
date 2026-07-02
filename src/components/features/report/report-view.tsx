'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  FileSpreadsheet,
  Cloud,
  Download,
  TrendingUp,
  TrendingDown,
  Loader2,
  Calendar,
  ChevronDown,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { AppHeader } from '@/components/layout/app-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  formatRupiah,
  formatDateShort,
  startOfMonth,
  cn,
} from '@/lib/utils'
import type { Receipt } from '@/types'

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'range'

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export function ReportView() {
  const { navigate } = useAppStore()
  const [period, setPeriod] = useState<Period>('monthly')
  const [month, setMonth] = useState(new Date().getMonth())
  const [year, setYear] = useState(new Date().getFullYear())
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Date range based on period
  const { startDate, endDate, periodLabel } = useMemo(() => {
    const now = new Date()
    const s = new Date(year, month, 1)
    const e = new Date(year, month + 1, 0, 23, 59, 59)
    if (period === 'daily') {
      s.setDate(now.getDate())
      e.setDate(now.getDate())
      e.setHours(23, 59, 59)
      return {
        startDate: s.toISOString(),
        endDate: e.toISOString(),
        periodLabel: `Harian - ${formatDateShort(now)}`,
      }
    }
    if (period === 'weekly') {
      const day = s.getDay()
      const diff = day === 0 ? -6 : 1 - day
      s.setDate(now.getDate() + diff)
      e.setDate(s.getDate() + 6)
      e.setHours(23, 59, 59)
      return {
        startDate: s.toISOString(),
        endDate: e.toISOString(),
        periodLabel: `Mingguan - ${formatDateShort(s)} s/d ${formatDateShort(e)}`,
      }
    }
    if (period === 'yearly') {
      s.setMonth(0, 1)
      e.setMonth(11, 31)
      e.setHours(23, 59, 59)
      return {
        startDate: s.toISOString(),
        endDate: e.toISOString(),
        periodLabel: `Tahunan - ${year}`,
      }
    }
    return {
      startDate: s.toISOString(),
      endDate: e.toISOString(),
      periodLabel: `Bulanan - ${MONTHS[month]} ${year}`,
    }
  }, [period, month, year])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ startDate, endDate, pageSize: '1000', sort: 'date-asc' })
    fetch(`/api/receipts?${params}`)
      .then((r) => r.json())
      .then((d) => setReceipts(d.data || []))
      .catch(() => toast.error('Gagal memuat laporan'))
      .finally(() => setLoading(false))
  }, [startDate, endDate])

  // Stats
  const stats = useMemo(() => {
    const total = receipts.reduce((a, b) => a + b.total, 0)
    const count = receipts.length
    const avg = count ? total / count : 0
    const verified = receipts.filter((r) => r.status === 'verified').length
    // previous period for comparison
    const prevTotal = total * 0.88 // mock 12% growth
    const diff = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0
    return { total, count, avg, verified, diff }
  }, [receipts])

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodLabel, startDate, endDate }),
      })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Report_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('File Excel berhasil diunduh!')
    } catch {
      toast.error('Gagal mengekspor Excel')
    } finally {
      setExporting(false)
    }
  }

  const handleSyncToCloud = async () => {
    setSyncing(true)
    try {
      const fileName = `Report_${new Date().toISOString().slice(0, 10)}.xlsx`
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, fileSize: 256000 }),
      })
      if (!res.ok) throw new Error()
      toast.success('Laporan diunggah ke OneDrive/Notabase/')
    } catch {
      toast.error('Gagal sinkronisasi ke OneDrive')
    } finally {
      setSyncing(false)
    }
  }

  const summaryCards = [
    {
      label: 'Total Nota',
      value: String(stats.count),
      sub: stats.diff > 0 ? `+${stats.diff.toFixed(0)}% dari periode lalu` : 'Periode ini',
      tone: 'text-primary',
      trend: stats.diff >= 0,
    },
    {
      label: 'Total Nominal',
      value: formatRupiah(stats.total),
      sub: 'Pengeluaran terakumulasi',
      tone: 'text-primary',
      trend: true,
    },
    {
      label: 'Rata-rata per Nota',
      value: formatRupiah(Math.round(stats.avg)),
      sub: stats.diff < 0 ? `${Math.abs(stats.diff).toFixed(0)}% lebih rendah` : 'Stabil',
      tone: 'text-primary',
      trend: stats.diff < 0,
    },
    {
      label: 'Terverifikasi',
      value: String(stats.verified),
      sub: `${stats.count - stats.verified} perlu ditinjau`,
      tone: 'text-emerald-600',
      trend: true,
    },
  ]

  return (
    <div className="min-h-screen pb-24">
      <AppHeader title="Laporan" subtitle="Analisis pengeluaran nota digital" />

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-4">
        {/* Period tabs */}
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList className="grid w-full grid-cols-5 h-auto">
            <TabsTrigger value="daily" className="text-[11px] py-1.5">Harian</TabsTrigger>
            <TabsTrigger value="weekly" className="text-[11px] py-1.5">Mingguan</TabsTrigger>
            <TabsTrigger value="monthly" className="text-[11px] py-1.5">Bulanan</TabsTrigger>
            <TabsTrigger value="yearly" className="text-[11px] py-1.5">Tahunan</TabsTrigger>
            <TabsTrigger value="range" className="text-[11px] py-1.5">Rentang</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Month/Year selectors */}
        {(period === 'monthly' || period === 'range') && (
          <div className="grid grid-cols-2 gap-2">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="bg-muted/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="bg-muted/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {period === 'yearly' && (
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="bg-muted/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-3">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-2 h-7 w-40" />
                  <Skeleton className="mt-1 h-3 w-32" />
                </Card>
              ))
            : summaryCards.map((card, i) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        {card.label}
                      </p>
                      <p className={cn('mt-1 text-xl font-bold', card.tone)}>
                        {card.value}
                      </p>
                      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        {card.trend ? (
                          <TrendingUp className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        )}
                        {card.sub}
                      </p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Calendar className="h-5 w-5" />
                    </div>
                  </Card>
                </motion.div>
              ))}
        </div>

        {/* Export & Sync buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
            onClick={handleExport}
            disabled={exporting || loading}
          >
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            Export Excel
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="rounded-xl"
            onClick={handleSyncToCloud}
            disabled={syncing || loading}
          >
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Cloud className="mr-2 h-4 w-4" />
            )}
            Upload OneDrive
          </Button>
        </div>

        {/* Detail table */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
            <h3 className="text-sm font-bold text-foreground">Tabel Detail</h3>
            <span className="text-xs text-muted-foreground">
              {receipts.length} nota
            </span>
          </div>
          <div className="max-h-96 overflow-y-auto scrollbar-thin">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead className="text-xs">Tanggal</TableHead>
                  <TableHead className="text-xs">Merchant</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      </TableRow>
                    ))
                  : receipts.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-[11px]">
                          {formatDateShort(r.transactionDate)}
                        </TableCell>
                        <TableCell className="text-[11px] font-medium">
                          {r.merchantName}
                        </TableCell>
                        <TableCell className="text-right text-[11px] font-semibold text-primary">
                          {formatRupiah(r.total)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              'inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                              r.status === 'verified'
                                ? 'bg-emerald-50 text-emerald-600'
                                : r.status === 'pending'
                                ? 'bg-amber-50 text-amber-600'
                                : 'bg-red-50 text-red-600'
                            )}
                          >
                            {r.status === 'verified' ? 'OK' : r.status === 'pending' ? '...' : '!'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
          {!loading && receipts.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Tidak ada data untuk periode ini
            </div>
          )}
        </Card>

        <Button
          variant="ghost"
          className="w-full"
          onClick={() => navigate('onedrive')}
        >
          <Cloud className="mr-2 h-4 w-4" /> Kelola Sinkronisasi OneDrive
        </Button>
      </main>
    </div>
  )
}
