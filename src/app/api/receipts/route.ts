import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceDb } from '@/lib/db'
import { serializeReceipt } from '@/lib/serialize'
import { receiptCache } from '@/lib/receipt-cache'
import { isValidInvoiceNumber } from '@/lib/utils'
import type { ReceiptType, StatusOcr } from '@/types/database.types'

/**
 * GET /api/receipts — list receipts with search/filter/sort/pagination.
 * Dokumen acuan: 03-business-rules.md §5 (BR-SRCH-01/02/03)
 * workspace_id dibaca dari header x-workspace-id.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const rawWorkspaceId = req.headers.get('x-workspace-id') || '00000000-0000-4000-a000-000000000000'
  const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
  const workspaceId = isUuid(rawWorkspaceId) ? rawWorkspaceId : '00000000-0000-4000-a000-000000000000'

  const q = searchParams.get('q')?.trim().toLowerCase() || ''
  const statusOcr = searchParams.get('statusOcr') || searchParams.get('status') || ''
  const sort = searchParams.get('sort') || 'date-desc'
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const minAmount = searchParams.get('minAmount')
  const maxAmount = searchParams.get('maxAmount')
  const hasImage = searchParams.get('hasImage') === 'true'
  const receiptType = searchParams.get('receiptType') || ''
  const kategori = searchParams.get('kategori') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = Math.max(1, Math.min(10000, parseInt(searchParams.get('pageSize') || '12', 10)))

  const client = getWorkspaceDb(workspaceId)
  let dbRows: any[] = []
  let count = 0

  try {
    let query = client
      .from('receipts')
      .select('*, receipt_items(*)', { count: 'exact' })
      .eq('is_deleted', false)

    if (workspaceId && workspaceId !== 'all') {
      // Only use valid UUIDs to avoid Supabase 22P02 error
      query = query.or(`workspace_id.eq.${workspaceId},workspace_id.eq.00000000-0000-4000-a000-000000000000`)
    }

    if (q) {
      query = query.or(`nama_toko.ilike.%${q}%,receipt_number.ilike.%${q}%,keterangan.ilike.%${q}%`)
    }

    if (statusOcr) query = query.eq('status_ocr', statusOcr as StatusOcr)
    if (receiptType) query = query.eq('receipt_type', receiptType as ReceiptType)
    if (hasImage) query = query.not('image_url', 'is', null)
    if (startDate) query = query.gte('tanggal', startDate.slice(0, 10))
    if (endDate) query = query.lte('tanggal', endDate.slice(0, 10))
    if (minAmount) query = query.gte('nominal', parseFloat(minAmount))
    if (maxAmount) query = query.lte('nominal', parseFloat(maxAmount))

    switch (sort) {
      case 'date-asc':     query = query.order('tanggal', { ascending: true }); break
      case 'amount-desc':  query = query.order('nominal', { ascending: false }); break
      case 'amount-asc':   query = query.order('nominal', { ascending: true }); break
      case 'merchant-asc': query = query.order('nama_toko', { ascending: true }); break
      default:             query = query.order('tanggal', { ascending: false })
    }

    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)

    const res = await query
    if (res.data) dbRows = res.data
    if (res.count) count = res.count
  } catch (err) {
    console.warn('[API /api/receipts GET] Supabase query failed:', err)
  }

  const mappedDbRows = dbRows.map((r: any) => {
    const items = r.receipt_items
      ? r.receipt_items.map((it: any) => ({
          namaBarang: it.nama_barang,
          qty: it.qty,
          harga: it.harga,
          subtotal: it.subtotal,
          urutan: it.urutan ?? 0,
          name: it.nama_barang,
          price: it.harga,
          total: it.subtotal,
        }))
      : undefined
    const obj = {
      ...serializeReceipt(r, items),
      merchantName: r.nama_toko,
      invoiceNumber: r.receipt_number,
      transactionDate: r.tanggal,
      total: r.nominal,
      status: r.status_ocr,
      description: r.keterangan,
      ocrText: r.ocr_raw_text,
      confidence: r.ocr_confidence,
      alamat: (r as any).alamat || null,
      merchantAddress: (r as any).alamat || null,
      noTelepon: (r as any).no_telepon || null,
      merchantPhone: (r as any).no_telepon || null,
    }
    receiptCache.addReceipt(obj)
    return obj
  })

  const cachedReceipts = receiptCache.getAllReceipts(workspaceId)
  const existingIds = new Set(mappedDbRows.map((r: any) => r.id))

  const cacheFiltered = cachedReceipts.filter((r) => {
    if (existingIds.has(r.id)) return false

    // Search query filter (q)
    if (q && !r.merchantName?.toLowerCase().includes(q) && !r.namaToko?.toLowerCase().includes(q) && !r.invoiceNumber?.toLowerCase().includes(q) && !r.receiptNumber?.toLowerCase().includes(q) && !r.keterangan?.toLowerCase().includes(q)) {
      return false
    }

    // Status OCR filter
    if (statusOcr && r.statusOcr !== statusOcr && r.status !== statusOcr) {
      return false
    }

    // Receipt Type filter
    if (receiptType && r.receiptType !== receiptType) {
      return false
    }

    // Amount range filter
    const amount = Number(r.nominal ?? r.total ?? 0)
    if (minAmount && amount < parseFloat(minAmount)) return false
    if (maxAmount && amount > parseFloat(maxAmount)) return false

    // Has image filter
    if (hasImage && !r.imageUrl) return false

    // Date range filter (startDate & endDate)
    const rawDate = r.tanggal || r.transactionDate || ''
    let rDateStr = rawDate.split('T')[0]
    if (rawDate.includes('/')) {
      const parts = rawDate.split('/')
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0')
        const month = parts[1].padStart(2, '0')
        const year = parts[2]
        rDateStr = `${year}-${month}-${day}`
      }
    }

    if (startDate) {
      const startStr = startDate.split('T')[0]
      if (rDateStr && rDateStr < startStr) return false
    }
    if (endDate) {
      const endStr = endDate.split('T')[0]
      if (rDateStr && rDateStr > endStr) return false
    }

    return true
  })

  const mergedRows = [...mappedDbRows, ...cacheFiltered]
  const total = Math.max(mergedRows.length, (count ?? 0) + cacheFiltered.length)

  return NextResponse.json({
    data: mergedRows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
}

function normalizeStatusOcr(status?: string): StatusOcr {
  if (!status) return 'berhasil'
  const s = status.toLowerCase()
  if (s === 'berhasil' || s === 'verified' || s === 'completed' || s === 'success') return 'berhasil'
  if (s === 'perlu_review' || s === 'review' || s === 'pending') return 'perlu_review'
  if (s === 'gagal' || s === 'failed' || s === 'error') return 'gagal'
  return 'manual'
}

/**
 * POST /api/receipts — create a new receipt.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // Always use canonical single-tenant workspace UUID for BLSDM KOMDIGI MANADO
    const workspaceId = '00000000-0000-4000-a000-000000000000'

    const client = getWorkspaceDb(workspaceId)
    const receiptId = body.id || crypto.randomUUID()
    
    const rawNumber = body.receiptNumber || body.invoiceNumber || ''
    const userInvNumber = isValidInvoiceNumber(rawNumber) ? rawNumber.trim() : ''
    const tanggal = body.tanggal || body.transactionDate?.split('T')[0] || new Date().toISOString().split('T')[0]
    const dbReceiptNumber = userInvNumber || `INV-${tanggal.replace(/-/g, '')}-${receiptId.slice(-4).toUpperCase()}`

    const namaToko = body.namaToko || body.merchantName || 'Nota Belanja'
    const nominal = Number(body.nominal ?? body.total) || 0
    const statusOcr = normalizeStatusOcr(body.statusOcr || body.status)

    let supabaseSuccess = false
    try {
      // Ensure workspace row exists in Supabase so foreign key constraint passes
      await client.from('workspaces').upsert({
        id: workspaceId,
        code: 'BLSDM-MND-9842X',
        nama: 'BLSDM KOMDIGI MANADO',
      })

      const { data: created, error: createError } = await client
        .from('receipts')
        .insert({
          id: receiptId,
          workspace_id: workspaceId,
          device_id: body.deviceId || null,
          receipt_number: dbReceiptNumber,
          nama_toko: namaToko,
          tanggal,
          nominal,
          diskon: Number(body.diskon) || 0,
          pajak: Number(body.pajak) || 0,
          keterangan: body.keterangan || body.description || null,
          kategori: body.kategori || 'Lainnya',
          metode_pembayaran: body.metodePembayaran || null,
          image_url: body.imageUrl || null,
          ocr_raw_text: body.ocrRawText || body.ocrText || null,
          ocr_confidence: Number(body.ocrConfidence ?? body.confidence) || 85,
          status_ocr: statusOcr,
          receipt_type: (body.receiptType || 'scan') as ReceiptType,
          receipt_template: body.receiptTemplate || null,
          is_deleted: false,
        })
        .select()
        .single()

      if (createError) {
        console.warn('[API /api/receipts POST] Supabase insert warning/error:', createError.message)
      } else if (created?.id) {
        supabaseSuccess = true
        if (body.items && Array.isArray(body.items) && body.items.length > 0) {
          const itemsToInsert = body.items.map((item: any, idx: number) => ({
            receipt_id: created.id,
            nama_barang: item.namaBarang || item.name || 'Item',
            qty: Number(item.qty) || 1,
            harga: Number(item.harga ?? item.price ?? 0),
            subtotal: Number(item.subtotal ?? item.total ?? (Number(item.qty || 1) * Number(item.harga || 0))),
            urutan: item.urutan ?? idx,
          }))

          await client.from('receipt_items').insert(itemsToInsert as any)
        }
      }
    } catch (insertErr) {
      console.warn('[API /api/receipts POST] Supabase insert exception:', insertErr)
    }

    const receiptObj = {
      id: receiptId,
      workspaceId,
      receiptNumber: userInvNumber,
      invoiceNumber: userInvNumber,
      namaToko,
      merchantName: namaToko,
      tanggal,
      transactionDate: tanggal,
      nominal,
      total: nominal,
      diskon: Number(body.diskon) || 0,
      pajak: Number(body.pajak) || 0,
      keterangan: body.keterangan || body.description || null,
      description: body.keterangan || body.description || null,
      kategori: body.kategori || 'Lainnya',
      metodePembayaran: body.metodePembayaran || null,
      imageUrl: body.imageUrl || null,
      ocrRawText: body.ocrRawText || body.ocrText || null,
      ocrText: body.ocrRawText || body.ocrText || null,
      ocrConfidence: Number(body.ocrConfidence ?? body.confidence) || 85,
      confidence: Number(body.ocrConfidence ?? body.confidence) || 85,
      statusOcr,
      status: statusOcr,
      receiptType: body.receiptType || 'scan',
      items: body.items || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Real sync status to database
      synced: supabaseSuccess,
      pendingSync: !supabaseSuccess,
    }

    const saved = receiptCache.addReceipt(receiptObj)
    return NextResponse.json(saved || receiptObj)
  } catch (err: any) {
    console.error('[API Receipts POST Exception]:', err)
    const fallbackId = crypto.randomUUID()
    const fallbackObj = {
      id: fallbackId,
      workspaceId: req.headers.get('x-workspace-id') || '00000000-0000-4000-a000-000000000000',
      receiptNumber: `INV-${new Date().getFullYear()}-000001`,
      namaToko: 'Nota Belanja',
      tanggal: new Date().toISOString().split('T')[0],
      nominal: 0,
      statusOcr: 'berhasil',
      status: 'berhasil',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    receiptCache.addReceipt(fallbackObj)
    return NextResponse.json(fallbackObj)
  }
}

/**
 * DELETE /api/receipts?id=xxx — delete a receipt completely from cache & Supabase soft delete.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const rawWorkspaceId = req.headers.get('x-workspace-id') || '00000000-0000-4000-a000-000000000000'
    const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
    const workspaceId = isUuid(rawWorkspaceId) ? rawWorkspaceId : '00000000-0000-4000-a000-000000000000'

    if (id) {
      // 1. Hapus dari cache & disk store
      receiptCache.deleteReceipt(id)

      // 2. Hapus langsung dari Supabase
      try {
        const client = getWorkspaceDb(workspaceId)
        await client.from('receipt_items').delete().or(`receipt_id.eq.${id}`)

        if (isUuid(id)) {
          await client.from('receipts').update({ is_deleted: true, deleted_at: new Date().toISOString() } as any).eq('id', id)
          await client.from('receipts').delete().eq('id', id)
        } else {
          await client.from('receipts').update({ is_deleted: true, deleted_at: new Date().toISOString() } as any).or(`id.eq.${id},receipt_number.eq.${id}`)
          await client.from('receipts').delete().or(`id.eq.${id},receipt_number.eq.${id}`)
        }
      } catch (err) {
        console.warn('[API /api/receipts DELETE] Supabase delete warning:', err)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Delete error' }, { status: 500 })
  }
}

