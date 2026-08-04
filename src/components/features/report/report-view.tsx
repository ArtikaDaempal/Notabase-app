'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  FileSpreadsheet,
  Cloud,
  Loader2,
  Bell,
  Menu,
  FileText,
  DollarSign,
  TrendingUp,
  ChevronDown,
  Calendar,
  ShieldCheck,
  FolderOpen,
  ExternalLink,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { SINGLE_TENANT_WORKSPACE } from '@/shared/config/workspace'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
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
import { toast } from 'sonner'
import { localDb } from '@/lib/local-db'
import { formatRupiah, formatDateShort, cn, isValidInvoiceNumber, getReportFilename } from '@/lib/utils'
import type { Receipt } from '@/types'

type Period = 'weekly' | 'monthly' | 'yearly'

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const PERIOD_TABS: { value: Period; label: string }[] = [
  { value: 'weekly', label: 'Mingguan' },
  { value: 'monthly', label: 'Bulanan' },
  { value: 'yearly', label: 'Tahunan' },
]

export function ReportView() {
  const { setTab } = useAppStore()
  const [period, setPeriod] = useState<Period>('monthly')
  const [month, setMonth] = useState(new Date().getMonth())
  const [year, setYear] = useState(new Date().getFullYear())
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  // hasLoaded: distinguishes initial-load skeleton vs truly-empty filter results
  const [hasLoaded, setHasLoaded] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Weekly: week number (1-based) within a month; derives Mon–Sun range
  const [weekNum, setWeekNum] = useState(() => {
    const now = new Date()
    return Math.ceil(now.getDate() / 7)
  })

  const { startDate, endDate } = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const mStr = pad(month + 1)

    if (period === 'weekly') {
      const startDay = (weekNum - 1) * 7 + 1
      const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
      const endDay = Math.min(weekNum * 7, lastDayOfMonth)
      return {
        startDate: `${year}-${mStr}-${pad(startDay)}`,
        endDate: `${year}-${mStr}-${pad(endDay)}`,
      }
    }
    if (period === 'yearly') {
      return { startDate: `${year}-01-01`, endDate: `${year}-12-31` }
    }
    // Monthly (default)
    const lastDay = new Date(year, month + 1, 0).getDate()
    return { startDate: `${year}-${mStr}-01`, endDate: `${year}-${mStr}-${pad(lastDay)}` }
  }, [period, month, year, weekNum])

  const workspaceId = SINGLE_TENANT_WORKSPACE.id
  const [excelAutoUpload, setExcelAutoUpload] = useState(false)
  const [accountEmail, setAccountEmail] = useState('')

  useEffect(() => {
    fetch('/api/sync', {
      headers: { 'x-workspace-id': workspaceId },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.account) setAccountEmail(d.account)
      })
      .catch(() => { })
  }, [workspaceId])

  const loadData = async () => {
    setLoading(true)
    const params = new URLSearchParams({ startDate, endDate, pageSize: '10000', sort: 'date-asc' })
    try {
      const r = await fetch(`/api/receipts?${params}`, {
        headers: { 'x-workspace-id': workspaceId },
      })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const d = await r.json()
      setReceipts(d.data || [])
      setHasLoaded(true)
    } catch (err) {
      console.warn('[ReportView] API fetch failed, loading from local DB fallback:', err)
      try {
        if (typeof window !== 'undefined' && localDb?.receipts) {
          const allLocal = await localDb.receipts.toArray().catch(() => [])
          const valid = allLocal.filter((item) => !item.isDeleted)
          setReceipts(valid as any)
          setHasLoaded(true)
        }
      } catch { }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    // Fetch workspace settings for auto upload
    fetch('/api/settings', {
      headers: { 'x-workspace-id': workspaceId },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.excel_auto_upload !== undefined) {
          setExcelAutoUpload(d.excel_auto_upload === 'true' || d.excel_auto_upload === true)
        }
      })
      .catch(() => { })

    const handleUpdate = () => loadData()
    window.addEventListener('receipts-updated', handleUpdate)
    window.addEventListener('receipt-saved', handleUpdate)
    window.addEventListener('receipt-deleted', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    window.addEventListener('focus', handleUpdate)

    return () => {
      window.removeEventListener('receipts-updated', handleUpdate)
      window.removeEventListener('receipt-saved', handleUpdate)
      window.removeEventListener('receipt-deleted', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
      window.removeEventListener('focus', handleUpdate)
    }
  }, [startDate, endDate, workspaceId])

  const previewRows = useMemo(() => {
    // No dummy fallback — always show real data so filters work correctly
    return receipts.map((r) => {
      const items = r.items || []
      const totalQty = items.length > 0 ? items.reduce((sum, item) => sum + (item.qty || 0), 0) : 1
      const qty = totalQty > 0 ? totalQty : 1
      const total = r.nominal ?? r.total ?? 0
      const unitPrice = total / qty
      const txDate = r.tanggal || r.transactionDate

      return {
        id: r.id,
        key: r.id,
        date: txDate ? new Date(txDate) : new Date(),
        invoiceNumber: r.receiptNumber || r.invoiceNumber,
        merchantName: r.namaToko || r.merchantName || 'Lainnya',
        qty,
        price: unitPrice,
        total,
        description: r.keterangan || r.description || '-',
      }
    })
  }, [receipts])

  const stats = useMemo(() => {
    const total = receipts.reduce((a, b) => a + (b.nominal ?? b.total ?? 0), 0)
    const count = receipts.length
    const average = count > 0 ? total / count : 0
    return { total, count, average }
  }, [receipts])

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': workspaceId,
        },
        body: JSON.stringify({
          period,
          year,
          month: month + 1,
          startDate,
          endDate,
          workspaceId,
        }),
      })

      if (!res.ok) throw new Error('Gagal membuat file Excel')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = getReportFilename({ period, startDate, endDate, month: month + 1, year })
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Laporan berhasil diunduh ke komputer Anda!')

      // If Auto Upload to OneDrive is enabled in settings, trigger auto-upload
      if (excelAutoUpload) {
        toast.info('Auto Upload OneDrive aktif: Mengunggah file laporan ke OneDrive...')
        await handleUpload()
      }
    } catch {
      toast.error('Gagal mengekspor Excel')
    } finally {
      setExporting(false)
    }
  }

  const handleUpload = async () => {
    setSyncing(true)
    try {
      const isYearly = period === 'yearly'
      const isWeekly = period === 'weekly'
      const folderName = isYearly
        ? 'Notabase/Ekspor Tahunan'
        : isWeekly
          ? 'Notabase/Ekspor Mingguan'
          : 'Notabase/Ekspor Bulanan'
      const uploadFileName = isYearly
        ? `Laporan_Notabase_Tahunan_${year}.xlsx`
        : isWeekly
          ? `Laporan_Notabase_Mingguan_${year}_M${weekNum}.xlsx`
          : `Laporan_Notabase_Bulanan_${year}_${String(month + 1).padStart(2, '0')}.xlsx`

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': workspaceId,
        },
        body: JSON.stringify({
          fileName: uploadFileName,
          periodType: period,
          year,
          month: month + 1,
          startDate,
          endDate,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Gagal sinkronisasi ke OneDrive')
      }

      toast.success('Berhasil diunggah ke OneDrive!')
    } catch (err: any) {
      toast.error(err.message || 'Gagal sinkronisasi ke OneDrive')
    } finally {
      setSyncing(false)
    }
  }

  const handleViewOneDrive = async () => {
    const isYearly = period === 'yearly'
    const isWeekly = period === 'weekly'
    const subFolder = isYearly ? 'Ekspor Tahunan' : isWeekly ? 'Ekspor Mingguan' : 'Ekspor Bulanan'
    const folderPath = `Notabase/${subFolder}`

    const tid = toast.loading(`Mempersiapkan folder ${subFolder} di OneDrive...`)

    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': workspaceId,
        },
        body: JSON.stringify({ action: 'create_folder', folderPath }),
      })
    } catch {
      // ignore
    } finally {
      toast.dismiss(tid)
    }

    // Open official My Files page (lands directly on My files, where Notabase is located)
    window.open('https://onedrive.live.com/?v=myfiles', '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="w-full space-y-5 pb-16">
      {/* Mobile Custom Header (Matching Mockup) */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur-md md:hidden -mx-4 -mt-5 px-4 mb-4">
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setTab('dashboard')}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="text-base font-extrabold text-slate-900 tracking-tight">Laporan & Export</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 transition-colors">
                <Bell className="h-5 w-5" />
                <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white">
                  3
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-5">
        {/* Welcome Banner Card (3D Graphic Matching Mockup) */}
        <Card className="relative overflow-hidden border border-slate-100/80 dark:border-slate-800 bg-gradient-to-r from-[#EEF4FF] via-[#F4F8FF] to-[#EBF3FE] dark:from-slate-900 dark:via-blue-950/40 dark:to-slate-900 p-6 sm:p-7 shadow-2xs rounded-3xl">
          <div className="flex flex-row items-center justify-between gap-4">
            <div className="space-y-1.5 z-10 max-w-md">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                Laporan & Ekspor Data
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Pantau ringkasan data nota dan ekspor laporan dengan mudah.
              </p>
            </div>

            {/* 3D Report Chart Illustration Graphic (Matching Mockup) */}
            <div className="shrink-0 relative h-20 w-24 sm:h-24 sm:w-32 flex items-center justify-center">
              <svg className="w-full h-full drop-shadow-lg" viewBox="0 0 160 120" fill="none">
                {/* 3D Card Base */}
                <rect x="20" y="22" width="120" height="80" rx="16" fill="#FFFFFF" opacity="0.95" />

                {/* 3D Bar Chart Columns */}
                <rect x="38" y="52" width="18" height="40" rx="5" fill="#60A5FA" />
                <rect x="62" y="36" width="18" height="56" rx="5" fill="#2563EB" />
                <rect x="86" y="62" width="18" height="30" rx="5" fill="#93C5FD" />

                {/* 3D Donut Chart Element */}
                <circle cx="122" cy="42" r="16" fill="#C084FC" opacity="0.9" />
                <path d="M122 42 L134 42 A12 12 0 0 0 122 30 Z" fill="#9333EA" />
                <circle cx="122" cy="42" r="7" fill="#FFFFFF" />

                {/* Floating Spheres */}
                <circle cx="26" cy="30" r="5" fill="#3B82F6" opacity="0.6" />
                <circle cx="140" cy="85" r="7" fill="#818CF8" opacity="0.7" />
              </svg>
            </div>
          </div>
        </Card>

        {/* Period Filter Pill Tabs & Dropdowns (Matching Mockup) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-100 shadow-2xs">
          {/* Filter Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            {PERIOD_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setPeriod(tab.value)}
                className={cn(
                  'shrink-0 rounded-full px-4 py-2 text-xs transition-all',
                  period === tab.value
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20'
                    : 'bg-white border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Month/Year Selectors + Calendar Icon Button */}
          <div className="flex items-center gap-2 flex-wrap">
            {period === 'weekly' ? (
              /* Weekly: month + week-number selector + year */
              <>
                <Select value={String(month)} onValueChange={(v) => { setMonth(Number(v)); setWeekNum(1) }}>
                  <SelectTrigger className="w-28 sm:w-32 rounded-xl border-slate-200 bg-slate-50 text-xs h-9 font-semibold text-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(weekNum)} onValueChange={(v) => setWeekNum(Number(v))}>
                  <SelectTrigger className="w-24 rounded-xl border-slate-200 bg-slate-50 text-xs h-9 font-semibold text-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: Math.ceil(new Date(year, month + 1, 0).getDate() / 7) }, (_, i) => {
                      const pad = (n: number) => String(n).padStart(2, '0')
                      const mStr = pad(month + 1)
                      const startDay = i * 7 + 1
                      const endDay = Math.min((i + 1) * 7, new Date(year, month + 1, 0).getDate())
                      return (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          Minggu {i + 1} &nbsp;({pad(startDay)}–{pad(endDay)} {MONTHS[month].slice(0, 3)})
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger className="w-20 rounded-xl border-slate-200 bg-slate-50 text-xs h-9 font-semibold text-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : (
              <>
                {period === 'monthly' && (
                  <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                    <SelectTrigger className="w-28 sm:w-32 rounded-xl border-slate-200 bg-slate-50 text-xs h-9 font-semibold text-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={m} value={String(i)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {(period === 'monthly' || period === 'yearly') && (
                  <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                    <SelectTrigger className="w-24 sm:w-28 rounded-xl border-slate-200 bg-slate-50 text-xs h-9 font-semibold text-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                  title="Pilih Tanggal"
                >
                  <Calendar className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* 2 Summary Stat Cards (Total Nota & Total Nominal - Icon beside text) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Card 1: Total Nota */}
          <div className="p-5 border border-slate-100/80 shadow-2xs bg-[#EEF4FF] rounded-2xl flex flex-row items-center justify-between">
            <div className="space-y-1">
              <span className="block text-xs font-semibold text-blue-600">Total Nota</span>
              <span className="block text-3xl font-extrabold text-slate-900 tracking-tight">
                {loading ? <Skeleton className="h-8 w-16" /> : stats.count}
              </span>
              <div className="flex items-center gap-1 text-[11px] text-blue-600 font-bold">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>{stats.count} Nota Terdaftar</span>
              </div>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100/80 text-blue-600 ml-4">
              <FileText className="h-6 w-6" />
            </div>
          </div>

          {/* Card 2: Total Nominal */}
          <div className="p-5 border border-slate-100/80 shadow-2xs bg-[#EDF9F1] rounded-2xl flex flex-row items-center justify-between">
            <div className="space-y-1">
              <span className="block text-xs font-semibold text-emerald-700">Total Nominal</span>
              <span className="block text-3xl font-extrabold text-slate-900 tracking-tight">
                {loading ? <Skeleton className="h-8 w-36" /> : formatRupiah(stats.total)}
              </span>
              <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Pengeluaran terakumulasi</span>
              </div>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100/80 text-emerald-600 ml-4">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Pratinjau Data Table Card (Responsive for Desktop & Mobile) */}
        <Card className="overflow-hidden rounded-3xl border border-slate-100/80 shadow-2xs bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Pratinjau Data</h3>
              <p className="text-[11px] text-slate-400">Menampilkan {Math.min(previewRows.length, 5)} dari {receipts.length} baris</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            {/* Desktop Full Table */}
            <Table className="hidden md:table">
              <TableHeader className="bg-slate-50/70">
                <TableRow>
                  <TableHead className="text-xs font-bold text-slate-700">Tanggal</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700">No. Nota</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700">Nama Toko</TableHead>
                  <TableHead className="text-center text-xs font-bold text-slate-700">Banyaknya</TableHead>
                  <TableHead className="text-right text-xs font-bold text-slate-700">Harga Satuan</TableHead>
                  <TableHead className="text-right text-xs font-bold text-slate-700">Nominal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    </TableRow>
                  ))
                  : previewRows.slice(0, 5).map((row) => (
                    <TableRow key={row.key} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                          <span>{formatDateShort(row.date)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-700">
                        {isValidInvoiceNumber(row.invoiceNumber) ? row.invoiceNumber : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-800 font-semibold">
                        {row.merchantName}
                      </TableCell>
                      <TableCell className="text-center text-xs text-slate-600 font-medium">
                        {row.qty}
                      </TableCell>
                      <TableCell className="text-right text-xs text-slate-600">
                        {formatRupiah(row.price)}
                      </TableCell>
                      <TableCell className="text-right font-extrabold text-slate-900 text-xs">
                        {formatRupiah(row.total)}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>

            {/* Mobile Compact Table (Matching Mobile Mockup) */}
            <Table className="table md:hidden">
              <TableHeader className="bg-slate-50/70">
                <TableRow>
                  <TableHead className="text-xs font-bold text-slate-700">Tanggal</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700">Nama Toko</TableHead>
                  <TableHead className="text-right text-xs font-bold text-slate-700">Nominal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    </TableRow>
                  ))
                  : previewRows.slice(0, 5).map((row) => (
                    <TableRow key={row.key} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="text-[11px] text-slate-600 whitespace-nowrap py-3">
                        {formatDateShort(row.date)}
                      </TableCell>
                      <TableCell className="text-[11px] text-slate-800 font-semibold py-3 max-w-[160px] truncate">
                        {row.merchantName}
                      </TableCell>
                      <TableCell className="text-right font-extrabold text-slate-900 text-[11px] py-3 whitespace-nowrap">
                        {formatRupiah(row.total)}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>

            {!loading && hasLoaded && receipts.length === 0 && (
              <div className="py-10 text-center space-y-1">
                <p className="text-sm font-semibold text-slate-500">Tidak ada nota ditemukan</p>
                <p className="text-xs text-slate-400">
                  Periode: {startDate} s/d {endDate}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleExport}
            disabled={exporting || loading}
            className="flex items-center justify-center gap-2 rounded-2xl bg-[#107C41] hover:bg-[#0E6C38] py-3.5 px-4 text-xs sm:text-sm font-bold text-white shadow-md shadow-emerald-600/20 active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
          >
            {exporting ? <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 sm:h-5 sm:w-5" />}
            <span className="truncate">Export ke Excel</span>
          </button>

          <button
            onClick={handleUpload}
            disabled={syncing || loading}
            className="flex items-center justify-center gap-2 rounded-2xl bg-[#0078D4] hover:bg-[#106EBE] py-3.5 px-4 text-xs sm:text-sm font-bold text-white shadow-md shadow-blue-600/20 active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
          >
            {syncing ? <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> : <Cloud className="h-4 w-4 sm:h-5 sm:w-5" />}
            <span className="truncate">Upload ke OneDrive</span>
          </button>

          <button
            onClick={handleViewOneDrive}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white hover:bg-slate-50 border-2 border-[#0078D4] py-3.5 px-4 text-xs sm:text-sm font-bold text-[#0078D4] shadow-md shadow-blue-200/40 active:scale-95 transition-all cursor-pointer"
          >
            <FolderOpen className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="truncate">Lihat File di OneDrive</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-70" />
          </button>
        </div>
      </div>
    </div>
  )
}
