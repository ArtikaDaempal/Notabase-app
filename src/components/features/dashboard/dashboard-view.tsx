'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CalendarDays,
  CalendarRange,
  CalendarClock,
  Wallet,
  ScanLine,
  ImagePlus,
  FileSpreadsheet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBag,
  Tag,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { AppHeader } from '@/components/layout/app-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  formatRupiah,
  formatRupiahCompact,
  timeAgo,
  cn,
} from '@/lib/utils'
import type { DashboardStats } from '@/types'

export function DashboardView() {
  const { navigate, openReceipt, setTab } = useAppStore()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch('/api/stats')
      .then((r) => r.json())
      .then((d) => {
        if (active) {
          setStats(d)
          setLoading(false)
        }
      })
      .catch(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const maxChart = stats ? Math.max(...stats.chart.map((c) => c.value), 1) : 1

  const quickActions = [
    { label: 'Scan', icon: ScanLine, action: () => setTab('scan'), color: 'bg-primary' },
    { label: 'Import', icon: ImagePlus, action: () => setTab('scan'), color: 'bg-emerald-500' },
    { label: 'Export', icon: FileSpreadsheet, action: () => navigate('report'), color: 'bg-violet-500' },
  ]

  const statCards = stats
    ? [
        {
          label: 'Hari Ini',
          icon: CalendarDays,
          count: stats.today.count,
          total: stats.today.total,
          tint: 'from-blue-500 to-primary',
        },
        {
          label: 'Minggu Ini',
          icon: CalendarRange,
          count: stats.week.count,
          total: stats.week.total,
          tint: 'from-emerald-500 to-teal-600',
        },
        {
          label: 'Bulan Ini',
          icon: CalendarClock,
          count: stats.month.count,
          total: stats.month.total,
          tint: 'from-violet-500 to-purple-600',
        },
        {
          label: 'Total',
          icon: Wallet,
          count: stats.allTime.count,
          total: stats.allTime.total,
          tint: 'from-amber-500 to-orange-600',
        },
      ]
    : []

  return (
    <div className="min-h-screen pb-24">
      <AppHeader
        title="Dashboard"
        subtitle="Ringkasan aktivitas nota digital Anda"
      />

      <main className="mx-auto w-full max-w-7xl px-4 py-4 space-y-5 sm:px-6 sm:py-6 lg:px-8">
        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {quickActions.map((qa) => {
            const Icon = qa.icon
            return (
              <button
                key={qa.label}
                onClick={qa.action}
                className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3 transition-all hover:shadow-md hover:-translate-y-0.5"
              >
                <div
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm transition-transform group-hover:scale-105',
                    qa.color
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold text-foreground">
                  {qa.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:gap-5">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="mt-3 h-3 w-16" />
                  <Skeleton className="mt-2 h-6 w-24" />
                  <Skeleton className="mt-1 h-3 w-20" />
                </Card>
              ))
            : statCards.map((card, i) => {
                const Icon = card.icon
                return (
                  <motion.div
                    key={card.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="relative overflow-hidden p-4">
                      <div
                        className={cn(
                          'mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm',
                          card.tint
                        )}
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <p className="text-xs font-medium text-muted-foreground">
                        {card.label}
                      </p>
                      <p className="mt-1 text-lg font-bold text-foreground">
                        {formatRupiah(card.total)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {card.count} nota
                      </p>
                    </Card>
                  </motion.div>
                )
              })}
        </div>

        {/* Chart card */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Grafik Nominal
                </h3>
                <p className="text-[11px] text-muted-foreground">7 hari terakhir</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-primary"
              onClick={() => navigate('report')}
            >
              Laporan <ArrowUpRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
          <div className="mt-4 flex h-36 items-end justify-between gap-2">
            {loading
              ? Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex-1">
                    <Skeleton className="h-full w-full rounded-t-md" />
                  </div>
                ))
              : stats?.chart.map((c, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="relative flex w-full flex-1 items-end">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${(c.value / maxChart) * 100}%` }}
                        transition={{ delay: i * 0.06, duration: 0.5, ease: 'easeOut' }}
                        className="w-full rounded-t-md bg-gradient-to-t from-primary/70 to-primary"
                        style={{ minHeight: c.value > 0 ? 6 : 2 }}
                      >
                        {c.value > 0 && (
                          <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-muted-foreground">
                            {formatRupiahCompact(c.value)}
                          </span>
                        )}
                      </motion.div>
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {c.label}
                    </span>
                  </div>
                ))}
          </div>
        </Card>

        {/* Responsive two-column section: chart alongside categories on large screens */}
        {stats && stats.topCategories.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4 sm:p-5 lg:col-span-1">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Tag className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Kategori Terbanyak</h3>
                  <p className="text-[11px] text-muted-foreground">Top {stats.topCategories.length}</p>
                </div>
              </div>
              <div className="space-y-2.5">
                {stats.topCategories.map((cat, i) => {
                  const maxTotal = stats.topCategories[0].total || 1
                  return (
                    <div key={cat.name} className="flex items-center gap-3">
                      <span className="w-5 text-xs font-bold text-muted-foreground">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-foreground">{cat.name}</span>
                          <span className="text-xs font-semibold text-primary">{formatRupiah(cat.total)}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(cat.total / maxTotal) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
            <Card className="p-4 sm:p-5 lg:col-span-1">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Merchant Terbanyak</h3>
                  <p className="text-[11px] text-muted-foreground">Berdasarkan jumlah nota</p>
                </div>
              </div>
              <div className="space-y-2.5">
                {stats.topMerchants.map((m, i) => {
                  const maxCount = stats.topMerchants[0].count || 1
                  return (
                    <div key={m.name} className="flex items-center gap-3">
                      <span className="w-5 text-xs font-bold text-muted-foreground">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-foreground">{m.name}</span>
                          <span className="text-xs font-semibold text-foreground">{m.count} nota</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(m.count / maxCount) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        )}

        {/* Recent activity */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Aktivitas Terbaru</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-primary"
              onClick={() => setTab('history')}
            >
              Lihat semua <ArrowUpRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="p-3">
                    <div className="flex gap-3">
                      <Skeleton className="h-14 w-14 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  </Card>
                ))
              : stats?.recent.map((r) => (
                  <Card
                    key={r.id}
                    className="cursor-pointer p-3 transition-all hover:shadow-md"
                    onClick={() => openReceipt(r.id)}
                  >
                    <div className="flex gap-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {r.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.imageUrl}
                            alt={r.merchantName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
                            <ShoppingBag className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-foreground">
                              {r.merchantName}
                            </span>
                            <span className="shrink-0 text-sm font-bold text-primary">
                              {formatRupiah(r.total)}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {r.category} · {timeAgo(r.transactionDate)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {r.status === 'verified' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                              <ArrowDownRight className="h-2.5 w-2.5" /> Verified
                            </span>
                          ) : r.status === 'pending' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                              Pending
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                              Failed
                            </span>
                          )}
                          {r.confidence > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              {Math.round(r.confidence)}% akurasi
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
          </div>
        </div>
      </main>
    </div>
  )
}
