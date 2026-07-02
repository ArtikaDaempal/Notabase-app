import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serializeReceipt } from '@/lib/serialize'
import { startOfDay, startOfWeek, startOfMonth } from '@/lib/utils'

// GET /api/stats — dashboard analytics
export async function GET(_req: NextRequest) {
  const now = new Date()
  const todayStart = startOfDay(now)
  const weekStart = startOfWeek(now)
  const monthStart = startOfMonth(now)

  const [all, todayR, weekR, monthR] = await Promise.all([
    db.receipt.findMany({ orderBy: { transactionDate: 'desc' } }),
    db.receipt.findMany({ where: { transactionDate: { gte: todayStart } } }),
    db.receipt.findMany({ where: { transactionDate: { gte: weekStart } } }),
    db.receipt.findMany({ where: { transactionDate: { gte: monthStart } } }),
  ])

  const sum = (arr: { total: number }[]) => arr.reduce((a, b) => a + b.total, 0)

  // Chart: last 7 days nominal
  const chart: { label: string; value: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    const dayStart = startOfDay(d)
    const dayEnd = new Date(d)
    dayEnd.setDate(d.getDate() + 1)
    const dayTotal = sum(
      all.filter((r) => r.transactionDate >= dayStart && r.transactionDate < dayEnd)
    )
    chart.push({
      label: new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(d),
      value: dayTotal,
    })
  }

  // Top categories
  const catMap = new Map<string, { count: number; total: number }>()
  for (const r of all) {
    const c = r.category || 'Lainnya'
    const cur = catMap.get(c) || { count: 0, total: 0 }
    cur.count++
    cur.total += r.total
    catMap.set(c, cur)
  }
  const topCategories = Array.from(catMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  // Top merchants
  const merchMap = new Map<string, { count: number; total: number }>()
  for (const r of all) {
    const cur = merchMap.get(r.merchantName) || { count: 0, total: 0 }
    cur.count++
    cur.total += r.total
    merchMap.set(r.merchantName, cur)
  }
  const topMerchants = Array.from(merchMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const recent = all.slice(0, 5).map(serializeReceipt)

  return NextResponse.json({
    today: { count: todayR.length, total: sum(todayR) },
    week: { count: weekR.length, total: sum(weekR) },
    month: { count: monthR.length, total: sum(monthR) },
    allTime: { count: all.length, total: sum(all) },
    chart,
    topCategories,
    topMerchants,
    recent,
  })
}
