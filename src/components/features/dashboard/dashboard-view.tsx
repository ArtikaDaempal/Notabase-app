'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Bell,
  Plus,
  FileText,
  Menu,
} from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useAppStore } from '@/store/app-store'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SyncIndicator } from '@/components/ui/sync-indicator'
import { localDb } from '@/lib/local-db'
import { formatRupiah, cn } from '@/lib/utils'
import { SINGLE_TENANT_WORKSPACE } from '@/shared/config/workspace'
import { getDeviceName } from '@/shared/services/deviceGate'

const DUMMY_CHART_DATA = [
  { name: '27 Jun', value: 950000 },
  { name: '1 Jul', value: 1200000 },
  { name: '5 Jul', value: 1050000 },
  { name: '9 Jul', value: 1100000 },
  { name: '13 Jul', value: 4100000 },
  { name: '17 Jul', value: 2300000 },
  { name: '21 Jul', value: 1150000 },
  { name: '25 Jul', value: 1200000 },
  { name: '27 Jul', value: 1350000 },
]

const DUMMY_RECENT_RECEIPTS = [
  {
    id: 'd1',
    namaToko: 'Creative Cafe Manado',
    kategori: 'Makanan & Minuman',
    badgeColor: 'bg-blue-50 text-blue-600 border-blue-100',
    tanggal: '27 Jul 2025',
    nominal: 128500,
  },
  {
    id: 'd2',
    namaToko: 'Toko Sinar Jaya',
    kategori: 'Belanja',
    badgeColor: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    tanggal: '27 Jul 2025',
    nominal: 89900,
  },
  {
    id: 'd3',
    namaToko: 'Indomaret Bahu',
    kategori: 'Kebutuhan Harian',
    badgeColor: 'bg-purple-50 text-purple-600 border-purple-100',
    tanggal: '26 Jul 2025',
    nominal: 67450,
  },
  {
    id: 'd4',
    namaToko: 'Toko Buku Gramedia',
    kategori: 'Pendidikan',
    badgeColor: 'bg-amber-50 text-amber-600 border-amber-100',
    tanggal: '26 Jul 2025',
    nominal: 125000,
  },
  {
    id: 'd5',
    namaToko: 'Warung Kopi Kita',
    kategori: 'Makanan & Minuman',
    badgeColor: 'bg-blue-50 text-blue-600 border-blue-100',
    tanggal: '25 Jul 2025',
    nominal: 42500,
  },
]

export function DashboardView() {
  const { openReceipt, setTab } = useAppStore()
  const workspaceId = SINGLE_TENANT_WORKSPACE.id

  const [userName, setUserName] = useState('Notabase')
  const [loading, setLoading] = useState(true)
  const [statsData, setStatsData] = useState<any>(null)
  const [recentReceipts, setRecentReceipts] = useState(DUMMY_RECENT_RECEIPTS)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const name = getDeviceName()
      if (name && name !== 'Perangkat Pengguna') {
        setUserName(name)
      }
    }
  }, [])

  const fetchStats = async () => {
    try {
      const r = await fetch('/api/stats', {
        headers: { 'x-workspace-id': workspaceId },
      })
      const d = await r.json()

      let localItems: any[] = []
      try {
        if (typeof window !== 'undefined' && localDb?.receipts) {
          const allLocal = await localDb.receipts.toArray().catch(() => [])
          localItems = allLocal.filter((r) => !r.isDeleted)
        }
      } catch {}

      if (d && d.allTime && d.allTime.count > 0) {
        setStatsData(d)
        if (d.recent && d.recent.length > 0) {
          setRecentReceipts(
            d.recent.slice(0, 5).map((r: any, idx: number) => ({
              id: r.id,
              namaToko: r.namaToko || r.merchantName || 'Lainnya',
              kategori: r.kategori || DUMMY_RECENT_RECEIPTS[idx % 5].kategori,
              badgeColor: DUMMY_RECENT_RECEIPTS[idx % 5].badgeColor,
              tanggal: new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(
                new Date(r.tanggal || r.transactionDate || Date.now())
              ),
              nominal: r.nominal ?? r.total ?? 0,
            }))
          )
        }
      } else if (localItems.length > 0) {
        const sumArr = (arr: any[]) => arr.reduce((a, b) => a + (Number(b.nominal) || 0), 0)
        setStatsData({
          todayCount: localItems.length,
          todayTotal: sumArr(localItems),
          allTimeCount: localItems.length,
          allTimeTotal: sumArr(localItems),
        })
        setRecentReceipts(
          localItems.slice(0, 5).map((r: any, idx: number) => ({
            id: r.id,
            namaToko: r.namaToko || 'Lainnya',
            kategori: r.kategori || DUMMY_RECENT_RECEIPTS[idx % 5].kategori,
            badgeColor: DUMMY_RECENT_RECEIPTS[idx % 5].badgeColor,
            tanggal: new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(
              new Date(r.tanggal || r.createdAt || Date.now())
            ),
            nominal: Number(r.nominal || 0),
          }))
        )
      } else {
        setStatsData(d)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 4000)
    const handleDataChange = () => fetchStats()
    window.addEventListener('notabase_receipts_changed', handleDataChange)
    return () => {
      clearInterval(interval)
      window.removeEventListener('notabase_receipts_changed', handleDataChange)
    }
  }, [workspaceId])

  const statCards = [
    {
      title: 'Nota Hari Ini',
      count: statsData?.today?.count ?? statsData?.todayCount ?? 12,
      subtext: '+20%',
      subLabel: 'dari kemarin',
      iconSvg: (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
      ),
    },
    {
      title: 'Nota Minggu Ini',
      count: statsData?.week?.count ?? 48,
      subtext: '+15%',
      subLabel: 'dari minggu lalu',
      iconSvg: (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      ),
    },
    {
      title: 'Nota Bulan Ini',
      count: statsData?.month?.count ?? 156,
      subtext: '+10%',
      subLabel: 'dari bulan lalu',
      iconSvg: (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
      ),
    },
    {
      title: 'Total Nota',
      count: statsData?.allTime?.count ?? statsData?.allTimeCount ?? 1256,
      subtext: '',
      subLabel: 'Semua waktu',
      iconSvg: (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      ),
    },
  ]

  const formattedChartTotal = statsData?.allTime?.total
    ? formatRupiah(statsData.allTime.total)
    : 'Rp 1.760.432'

  return (
    <div className="w-full space-y-5 pb-16">
      {/* Mobile Header (Matching Right Phone Header in Mockup) */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur-md md:hidden -mx-4 -mt-5 px-4 mb-4">
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex h-14 items-center justify-between">
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100">
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-base font-bold text-slate-900">Dashboard</h1>
            <div className="flex items-center gap-2">
              <SyncIndicator variant="header" />
              <button className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100">
                <Bell className="h-5 w-5" />
                <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white">
                  3
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-5">
        {/* Welcome Section Banner (Matching Mockup Illustration & Text) */}
        <Card className="relative overflow-hidden border border-slate-100/80 dark:border-slate-800 bg-gradient-to-r from-[#EEF4FF] via-[#F2F6FE] to-[#EBF3FE] dark:from-slate-900 dark:via-blue-950/40 dark:to-slate-900 p-6 sm:p-7 shadow-2xs rounded-3xl">
          <div className="flex flex-row items-center justify-between gap-4">
            <div className="space-y-1 z-10 max-w-md">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                Selamat datang kembali, {userName}! 👏
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                Kelola nota Anda dengan mudah dan efisien.
              </p>
            </div>

            {/* Folder 3D Illustration Graphic (Matching Mockup) */}
            <div className="shrink-0 relative h-20 w-24 sm:h-24 sm:w-32 flex items-center justify-center">
              <svg className="w-full h-full text-blue-500 drop-shadow-md" viewBox="0 0 160 120" fill="none">
                <rect x="20" y="25" width="120" height="85" rx="14" fill="#2563EB" />
                <rect x="35" y="10" width="70" height="50" rx="8" fill="#EFF6FF" transform="rotate(-6 35 10)" />
                <rect x="45" y="18" width="70" height="50" rx="8" fill="#FFFFFF" transform="rotate(3 45 18)" />
                <path d="M20 45 C20 40, 30 35, 45 35 L70 35 C80 35, 85 42, 95 42 L130 42 C137 42, 140 45, 140 50 L140 100 C140 105, 135 110, 130 110 L30 110 C25 110, 20 105, 20 100 Z" fill="#3B82F6" />
                <circle cx="120" cy="90" r="10" fill="#60A5FA" opacity="0.6" />
                <path d="M116 90 L124 90" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </Card>

        {/* 4 Metric Stat Cards Grid */}
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="p-4 border-none shadow-2xs bg-white dark:bg-slate-900 rounded-2xl">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="mt-3 h-8 w-16" />
                </Card>
              ))
            : statCards.map((card, i) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card className="p-4 border border-slate-100/80 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900 rounded-2xl flex flex-col justify-between h-full space-y-3">
                    <div className="flex items-center justify-between">
                      {card.iconSvg}
                    </div>
                    <div>
                      <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {card.title}
                      </span>
                      <span className="block text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight mt-0.5">
                        {typeof card.count === 'number' ? card.count.toLocaleString('id-ID') : card.count}
                      </span>
                      <div className="mt-1 flex items-center gap-1 text-[11px]">
                        {card.subtext && (
                          <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{card.subtext}</span>
                        )}
                        <span className="text-slate-400 dark:text-slate-500 font-normal">{card.subLabel}</span>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
        </div>

        {/* Total Transaksi Chart Card (Matching Mockup) */}
        <Card className="p-5 sm:p-6 border border-slate-100/80 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900 rounded-3xl">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Total Transaksi <span className="text-xs font-normal text-slate-400 dark:text-slate-500">(30 Hari Terakhir)</span>
              </h3>
            </div>
            <div className="text-right">
              <span className="block text-lg sm:text-xl font-extrabold text-blue-600 dark:text-blue-400">
                {formattedChartTotal}
              </span>
              <span className="block text-[11px] font-medium text-slate-400 dark:text-slate-500">
                Total Pendapatan
              </span>
            </div>
          </div>

          <div className="h-48 w-full pt-2">
            {loading ? (
              <Skeleton className="h-full w-full rounded-2xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={DUMMY_CHART_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="blueSmoothGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <Tooltip
                    formatter={(val: any) => [formatRupiah(Number(val)), 'Total']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid rgba(148,163,184,0.2)', boxShadow: '0 8px 20px -4px rgba(0,0,0,0.3)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                    fillOpacity={1}
                    fill="url(#blueSmoothGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Recent Receipts List ("Arsip Nota Terbaru") */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-slate-900">Arsip Nota Terbaru</h3>
            <button
              onClick={() => setTab('history')}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Lihat semua
            </button>
          </div>

          <Card className="divide-y divide-slate-100 border border-slate-100/80 shadow-2xs bg-white rounded-2xl overflow-hidden">
            {recentReceipts.map((r) => (
              <div
                key={r.id}
                onClick={() => {
                  if (!r.id.startsWith('d')) openReceipt(r.id)
                  else setTab('history')
                }}
                className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        Nota dari {r.namaToko}
                      </p>
                      {r.kategori && (
                        <span className={cn('rounded-full px-2 py-0.5 text-[9.5px] font-bold border', r.badgeColor)}>
                          {r.kategori}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {r.tanggal}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-extrabold text-slate-900 shrink-0 ml-2">
                  {formatRupiah(r.nominal)}
                </span>
              </div>
            ))}
          </Card>
        </div>
      </div>

      {/* Floating Action Button (FAB) (+) Bottom Right */}
      <button
        onClick={() => setTab('scan')}
        className="fixed bottom-20 right-6 z-30 flex h-13 w-13 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/35 transition-transform hover:scale-105 active:scale-95"
        aria-label="Scan Baru"
      >
        <Plus className="h-7 w-7 stroke-[2.5]" />
      </button>
    </div>
  )
}
