import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serializeReceipt } from '@/lib/serialize'
import type { ReceiptItem } from '@/types'

// GET /api/receipts — list with search/filter/sort/pagination
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() || ''
  const category = searchParams.get('category') || ''
  const status = searchParams.get('status') || ''
  const sort = searchParams.get('sort') || 'date-desc'
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const minAmount = searchParams.get('minAmount')
  const maxAmount = searchParams.get('maxAmount')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get('pageSize') || '12', 10)))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { AND: [] }

  if (q) {
    where.AND.push({
      OR: [
        { merchantName: { contains: q } },
        { invoiceNumber: { contains: q } },
        { description: { contains: q } },
      ],
    })
  }
  if (category) where.AND.push({ category })
  if (status) where.AND.push({ status })

  if (startDate || endDate) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const range: any = {}
    if (startDate) range.gte = new Date(startDate)
    if (endDate) range.lte = new Date(endDate)
    where.AND.push({ transactionDate: range })
  }
  if (minAmount || maxAmount) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const range: any = {}
    if (minAmount) range.gte = parseFloat(minAmount)
    if (maxAmount) range.lte = parseFloat(maxAmount)
    where.AND.push({ total: range })
  }

  if (where.AND.length === 0) delete where.AND

  // sort
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderBy: any = {}
  switch (sort) {
    case 'date-asc': orderBy.transactionDate = 'asc'; break
    case 'amount-desc': orderBy.total = 'desc'; break
    case 'amount-asc': orderBy.total = 'asc'; break
    case 'merchant-asc': orderBy.merchantName = 'asc'; break
    case 'date-desc':
    default: orderBy.transactionDate = 'desc'
  }

  const [total, rows] = await Promise.all([
    db.receipt.count({ where }),
    db.receipt.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return NextResponse.json({
    data: rows.map(serializeReceipt),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  })
}

// POST /api/receipts — create a new receipt
export async function POST(req: NextRequest) {
  const body = await req.json()
  const created = await db.receipt.create({
    data: {
      invoiceNumber: body.invoiceNumber || null,
      merchantName: body.merchantName,
      transactionDate: body.transactionDate ? new Date(body.transactionDate) : new Date(),
      category: body.category || null,
      total: Number(body.total) || 0,
      description: body.description || null,
      imageUrl: body.imageUrl || null,
      ocrText: body.ocrText || null,
      confidence: Number(body.confidence) || 0,
      status: body.status || 'verified',
      items: body.items ? JSON.stringify(body.items as ReceiptItem[]) : null,
    },
  })

  // Log the upload
  await db.uploadLog.create({
    data: {
      receiptId: created.id,
      status: 'success',
      provider: 'local',
      fileName: body.imageUrl ? body.imageUrl.split('/').pop() : null,
      message: 'Receipt saved to local database',
    },
  })

  return NextResponse.json(serializeReceipt(created), { status: 201 })
}
