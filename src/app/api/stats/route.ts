import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serializeReceipt } from '@/lib/serialize'
import { receiptCache } from '@/lib/receipt-cache'
import { startOfDay, startOfWeek, startOfMonth, isValidInvoiceNumber } from '@/lib/utils'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function parseDateRobust(dateStr: string | null | undefined): Date {
  if (!dateStr) return new Date()
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/')
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10) - 1
      const year = parseInt(parts[2], 10)
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day)
      }
    }
  }
  const parsed = new Date(dateStr)
  return isNaN(parsed.getTime()) ? new Date() : parsed
}

// GET /api/stats — dashboard analytics
export async function GET(req: NextRequest) {
  const rawWorkspaceId = req.headers.get('x-workspace-id') || '00000000-0000-4000-a000-000000000000'
  const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
  const workspaceId = isUuid(rawWorkspaceId) ? rawWorkspaceId : '00000000-0000-4000-a000-000000000000'

  const now = new Date()
  const currentYear = now.getFullYear()
  const todayStart = startOfDay(now)
  const weekStart = startOfWeek(now)
  const monthStart = startOfMonth(now)

  let mappedDbRows: any[] = []
  try {
    let query = db
      .from('receipts')
      .select('*')
      .eq('is_deleted', false)
      .order('tanggal', { ascending: false })

    if (workspaceId) {
      // Only use valid UUID values in Supabase query (avoid 22P02 error with non-UUID strings)
      query = query.or(`workspace_id.eq.${workspaceId},workspace_id.eq.00000000-0000-4000-a000-000000000000`)
    }

    const { data: allData } = await query
    mappedDbRows = (allData || []).map((r: any) => ({
      ...serializeReceipt(r),
      id: r.id,
      merchantName: r.nama_toko,
      namaToko: r.nama_toko,
      invoiceNumber: r.receipt_number,
      receiptNumber: r.receipt_number,
      transactionDate: r.tanggal,
      tanggal: r.tanggal,
      nominal: r.nominal,
      total: r.nominal,
      status: r.status_ocr,
    }))
  } catch (dbErr) {
    console.warn('[API /api/stats] DB fetch warning:', dbErr)
  }

  // Filter cache: exclude any IDs already in DB results AND exclude deleted receipts
  const cached = receiptCache.getAllReceipts(workspaceId)
  const dbIds = new Set(mappedDbRows.map((r: any) => r.id))
  const filteredCache = cached.filter((r) => !dbIds.has(r.id) && !r.is_deleted && !r.isDeleted && !r.pendingDelete)

  const rawList = [...mappedDbRows, ...filteredCache]
  const seenKeys = new Set<string>()
  const deduplicatedList: any[] = []

  for (const r of rawList) {
    const inv = (r.invoiceNumber || r.receiptNumber || '').trim()
    const merchant = (r.namaToko || r.merchantName || '').trim()
    const nom = Number(r.nominal ?? r.total ?? 0)
    const date = (r.tanggal || r.transactionDate || '').split('T')[0]
    const key = inv ? `inv:${inv}` : `m:${merchant}_n:${nom}_d:${date}`

    if (r.id && seenKeys.has(r.id)) continue
    if (key && seenKeys.has(key)) continue

    if (r.id) seenKeys.add(r.id)
    if (key) seenKeys.add(key)
    deduplicatedList.push(r)
  }

  const all = deduplicatedList.map((r: any) => {
    const rawDate = r.tanggal || r.transactionDate
    const dt = parseDateRobust(rawDate)
    const rawInv = r.invoiceNumber || r.receiptNumber
    const invDisplay = isValidInvoiceNumber(rawInv) ? rawInv.trim() : ''
    return {
      id: r.id,
      merchantName: r.merchantName || r.namaToko || 'Lainnya',
      namaToko: r.namaToko || r.merchantName || 'Lainnya',
      invoiceNumber: invDisplay,
      receiptNumber: invDisplay,
      transactionDate: dt.toISOString(),
      tanggal: dt.toISOString(),
      dateObj: dt,
      nominal: Number(r.nominal ?? r.total ?? 0),
      total: Number(r.nominal ?? r.total ?? 0),
      status: r.statusOcr || r.status || 'berhasil',
    }
  })

  const todayR = all.filter((r) => r.dateObj >= todayStart)
  const weekR = all.filter((r) => r.dateObj >= weekStart)
  const monthR = all.filter((r) => r.dateObj >= monthStart)

  // Real percentage growth calculations
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)
  const yesterdayR = all.filter((r) => r.dateObj >= yesterdayStart && r.dateObj < todayStart)
  const todayChange = yesterdayR.length > 0
    ? Math.round(((todayR.length - yesterdayR.length) / yesterdayR.length) * 100)
    : (todayR.length > 0 ? 100 : 0)

  const lastWeekStart = new Date(weekStart.getTime() - 7 * 86400000)
  const lastWeekR = all.filter((r) => r.dateObj >= lastWeekStart && r.dateObj < weekStart)
  const weekChange = lastWeekR.length > 0
    ? Math.round(((weekR.length - lastWeekR.length) / lastWeekR.length) * 100)
    : (weekR.length > 0 ? 100 : 0)

  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthR = all.filter((r) => r.dateObj >= lastMonthStart && r.dateObj < monthStart)
  const monthChange = lastMonthR.length > 0
    ? Math.round(((monthR.length - lastMonthR.length) / lastMonthR.length) * 100)
    : (monthR.length > 0 ? 100 : 0)

  const sum = (arr: { nominal: number }[]) => arr.reduce((a, b) => a + (b.nominal || 0), 0)

  // Real 30-Day Chart Points (Grouped by date over the last 30 days)
  const chart30Days: { name: string; dateStr: string; value: number }[] = []
  const thirtyDaysAgo = new Date(todayStart.getTime() - 29 * 86400000)

  // Build daily buckets for the last 30 days
  const dateMap = new Map<string, number>()
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo.getTime() + i * 86400000)
    const dayLabel = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(d)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    dateMap.set(key, 0)
  }

  // Populate actual nominal sum for receipts on each date
  for (const r of all) {
    if (r.dateObj >= thirtyDaysAgo) {
      const key = `${r.dateObj.getFullYear()}-${String(r.dateObj.getMonth() + 1).padStart(2, '0')}-${String(r.dateObj.getDate()).padStart(2, '0')}`
      if (dateMap.has(key)) {
        dateMap.set(key, (dateMap.get(key) || 0) + (r.nominal || 0))
      }
    }
  }

  // Filter or step ticks to keep chart clean (e.g. 7-10 points over 30 days)
  const allKeys = Array.from(dateMap.keys())
  const step = Math.max(1, Math.floor(allKeys.length / 8))
  for (let i = 0; i < allKeys.length; i += step) {
    const key = allKeys[i]
    const parts = key.split('-')
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
    const label = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(d)
    chart30Days.push({
      name: label,
      dateStr: key,
      value: dateMap.get(key) || 0,
    })
  }

  // 12-Month Chart Sums for current year
  const chartMonthly = MONTH_NAMES.map((monthName, monthIdx) => {
    const monthTotal = sum(
      all.filter((r) => r.dateObj.getFullYear() === currentYear && r.dateObj.getMonth() === monthIdx)
    )
    return {
      name: monthName,
      month: monthName,
      label: monthName,
      value: monthTotal,
    }
  })

  // Top merchants
  const merchMap = new Map<string, { count: number; total: number }>()
  for (const r of all) {
    const name = r.namaToko || r.merchantName || 'Lainnya'
    const cur = merchMap.get(name) || { count: 0, total: 0 }
    cur.count++
    cur.total += r.nominal || 0
    merchMap.set(name, cur)
  }
  const topMerchants = Array.from(merchMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const recent = all.slice(0, 5)

  return NextResponse.json({
    today: {
      count: todayR.length,
      total: sum(todayR),
      changePercent: todayChange,
      subtext: todayChange > 0 ? `+${todayChange}%` : `${todayChange}%`,
    },
    week: {
      count: weekR.length,
      total: sum(weekR),
      changePercent: weekChange,
      subtext: weekChange > 0 ? `+${weekChange}%` : `${weekChange}%`,
    },
    month: {
      count: monthR.length,
      total: sum(monthR),
      changePercent: monthChange,
      subtext: monthChange > 0 ? `+${monthChange}%` : `${monthChange}%`,
    },
    allTime: {
      count: all.length,
      total: sum(all),
    },
    chart: chart30Days,
    chart30Days,
    chartMonthly,
    topMerchants,
    recent,
  })
}
