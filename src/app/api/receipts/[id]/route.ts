import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceDb } from '@/lib/db'
import { serializeReceipt } from '@/lib/serialize'
import { receiptCache } from '@/lib/receipt-cache'

/**
 * GET /api/receipts/[id]
 * Fetch satu nota beserta item-nya.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const rawWorkspaceId = req.headers.get('x-workspace-id') || '00000000-0000-4000-a000-000000000000'
  const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
  const workspaceId = isUuid(rawWorkspaceId) ? rawWorkspaceId : '00000000-0000-4000-a000-000000000000'
  const client = getWorkspaceDb(workspaceId)

  try {
    const { data: receipt, error } = await client
      .from('receipts')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single()

    if (receipt && !error) {
      const { data: dbItems } = await client
        .from('receipt_items')
        .select('*')
        .eq('receipt_id', id)
        .order('urutan', { ascending: true })

      const items = (dbItems || []).map((item) => ({
        namaBarang: item.nama_barang,
        qty: item.qty,
        harga: item.harga,
        subtotal: item.subtotal,
        urutan: item.urutan,
        name: item.nama_barang,
        price: item.harga,
        total: item.subtotal,
      }))

      const result = {
        ...serializeReceipt(receipt, items),
        merchantName: receipt.nama_toko,
        invoiceNumber: receipt.receipt_number,
        transactionDate: receipt.tanggal,
        total: receipt.nominal,
        status: receipt.status_ocr,
        description: receipt.keterangan,
        ocrText: receipt.ocr_raw_text,
        confidence: receipt.ocr_confidence,
      }

      receiptCache.addReceipt(result)
      return NextResponse.json(result)
    }
  } catch (err) {
    console.warn(`[API /api/receipts/${id} GET] Supabase query warning:`, err)
  }

  // Fallback to shared in-memory receiptCache
  const cached = receiptCache.getReceipt(id)
  if (cached) {
    return NextResponse.json(cached)
  }

  return NextResponse.json({ error: 'Nota tidak ditemukan' }, { status: 404 })
}

/**
 * PUT /api/receipts/[id]
 * Update nota.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const rawWsId83 = req.headers.get('x-workspace-id') || '00000000-0000-4000-a000-000000000000'
  const isUuid83 = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  const workspaceId = isUuid83(rawWsId83) ? rawWsId83 : '00000000-0000-4000-a000-000000000000'
  const client = getWorkspaceDb(workspaceId)
  const body = await req.json()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (body.receiptNumber !== undefined) updateData.receipt_number = body.receiptNumber
  if (body.namaToko !== undefined) updateData.nama_toko = body.namaToko
  if (body.tanggal !== undefined) updateData.tanggal = body.tanggal
  if (body.nominal !== undefined) updateData.nominal = Number(body.nominal)
  if (body.diskon !== undefined) updateData.diskon = Number(body.diskon)
  if (body.pajak !== undefined) updateData.pajak = Number(body.pajak)
  if (body.kategori !== undefined) updateData.kategori = body.kategori
  if (body.metodePembayaran !== undefined) updateData.metode_pembayaran = body.metodePembayaran
  if (body.keterangan !== undefined) updateData.keterangan = body.keterangan
  if (body.imageUrl !== undefined) updateData.image_url = body.imageUrl
  if (body.ocrRawText !== undefined) updateData.ocr_raw_text = body.ocrRawText
  if (body.ocrConfidence !== undefined) updateData.ocr_confidence = Number(body.ocrConfidence)
  if (body.statusOcr !== undefined) updateData.status_ocr = body.statusOcr
  if (body.receiptTemplate !== undefined) updateData.receipt_template = body.receiptTemplate

  // Aliases
  if (body.invoiceNumber !== undefined && updateData.receipt_number === undefined) updateData.receipt_number = body.invoiceNumber
  if (body.merchantName !== undefined && updateData.nama_toko === undefined) updateData.nama_toko = body.merchantName
  if (body.transactionDate !== undefined && updateData.tanggal === undefined) updateData.tanggal = body.transactionDate?.split('T')[0]
  if (body.total !== undefined && updateData.nominal === undefined) updateData.nominal = Number(body.total)
  if (body.description !== undefined && updateData.keterangan === undefined) updateData.keterangan = body.description
  if (body.ocrText !== undefined && updateData.ocr_raw_text === undefined) updateData.ocr_raw_text = body.ocrText
  if (body.confidence !== undefined && updateData.ocr_confidence === undefined) updateData.ocr_confidence = Number(body.confidence)
  if (body.status !== undefined && updateData.status_ocr === undefined) updateData.status_ocr = body.status

  try {
    const { data: updated } = await client
      .from('receipts')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(updateData as any)
      .eq('id', id)
      .select()
      .single()

    if (updated) {
      if (body.items !== undefined && Array.isArray(body.items)) {
        await client.from('receipt_items').delete().eq('receipt_id', id)
        if (body.items.length > 0) {
          const itemsToInsert = body.items.map((item: any, idx: number) => ({
            receipt_id: id,
            nama_barang: item.namaBarang ?? item.name ?? '',
            qty: item.qty ?? 1,
            harga: item.harga ?? item.price ?? 0,
            urutan: item.urutan ?? idx,
          }))
          await client.from('receipt_items').insert(itemsToInsert)
        }
      }
    }
  } catch (updateErr) {
    console.warn(`[API /api/receipts/${id} PUT] Supabase update warning:`, updateErr)
  }

  // Always update in shared cache
  const updatedCache = receiptCache.updateReceipt(id, {
    ...body,
    items: body.items,
  })

  return NextResponse.json(updatedCache || { success: true, id })
}

/**
 * DELETE /api/receipts/[id]
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const rawWsId162 = req.headers.get('x-workspace-id') || '00000000-0000-4000-a000-000000000000'
  const isUuid162 = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  const workspaceId = isUuid162(rawWsId162) ? rawWsId162 : '00000000-0000-4000-a000-000000000000'
  const client = getWorkspaceDb(workspaceId)

  try {
    // Delete receipt_items matching receipt_id or receipt_number
    await client.from('receipt_items').delete().or(`receipt_id.eq.${id}`)
    
    // Mark as deleted & delete row by id and receipt_number
    if (isUuid162(id)) {
      await client.from('receipts').update({ is_deleted: true, deleted_at: new Date().toISOString() } as any).eq('id', id)
      await client.from('receipts').delete().eq('id', id)
    } else {
      await client.from('receipts').update({ is_deleted: true, deleted_at: new Date().toISOString() } as any).or(`id.eq.${id},receipt_number.eq.${id}`)
      await client.from('receipts').delete().or(`id.eq.${id},receipt_number.eq.${id}`)
    }
  } catch (delErr) {
    console.warn(`[API /api/receipts/${id} DELETE] Supabase delete warning:`, delErr)
  }

  receiptCache.deleteReceipt(id)
  return NextResponse.json({ success: true })
}

// PATCH alias for PUT
export const PATCH = PUT

