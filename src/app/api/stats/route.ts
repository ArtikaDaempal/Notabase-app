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

  const all = [...mappedDbRows, ...filteredCache].map((r: any) => {
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

  const sum = (arr: { nominal: number }[]) => arr.reduce((a, b) => a + (b.nominal || 0), 0)

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
    today: { count: todayR.length, total: sum(todayR) },
    week: { count: weekR.length, total: sum(weekR) },
    month: { count: monthR.length, total: sum(monthR) },
    allTime: { count: all.length, total: sum(all) },
    chart: chartMonthly,
    chartMonthly,
    topMerchants,
    recent,
  })
}
