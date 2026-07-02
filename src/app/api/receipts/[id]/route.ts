import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serializeReceipt } from '@/lib/serialize'
import type { ReceiptItem } from '@/types'

// GET /api/receipts/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const receipt = await db.receipt.findUnique({ where: { id } })
  if (!receipt) {
    return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
  }
  return NextResponse.json(serializeReceipt(receipt))
}

// PUT /api/receipts/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const existing = await db.receipt.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
  }
  const updated = await db.receipt.update({
    where: { id },
    data: {
      invoiceNumber: body.invoiceNumber ?? existing.invoiceNumber,
      merchantName: body.merchantName ?? existing.merchantName,
      transactionDate: body.transactionDate ? new Date(body.transactionDate) : existing.transactionDate,
      category: body.category ?? existing.category,
      total: body.total !== undefined ? Number(body.total) : existing.total,
      description: body.description ?? existing.description,
      imageUrl: body.imageUrl ?? existing.imageUrl,
      ocrText: body.ocrText ?? existing.ocrText,
      confidence: body.confidence !== undefined ? Number(body.confidence) : existing.confidence,
      status: body.status ?? existing.status,
      items: body.items !== undefined ? (body.items ? JSON.stringify(body.items as ReceiptItem[]) : null) : existing.items,
    },
  })
  return NextResponse.json(serializeReceipt(updated))
}

// DELETE /api/receipts/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const existing = await db.receipt.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
  }
  await db.receipt.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
