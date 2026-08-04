import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { db } from '@/lib/db'
import { serializeReceipt } from '@/lib/serialize'
import { receiptCache } from '@/lib/receipt-cache'
import { isValidInvoiceNumber, extractPhoneFromOcr, extractAddressFromOcr, isValidAddress, isValidPhone, getReportFilename } from '@/lib/utils'

// POST /api/export — generate an Excel report (03-business-rules.md §6 BR-EXP-01)
export async function POST(req: NextRequest) {
  const rawWorkspaceId = req.headers.get('x-workspace-id') || '00000000-0000-4000-a000-000000000000'
  const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
  const workspaceId = isUuid(rawWorkspaceId) ? rawWorkspaceId : '00000000-0000-4000-a000-000000000000'

  const body = await req.json().catch(() => ({}))
  const {
    period,
    year,
    month,
    startDate,
    endDate,
  } = body as { period?: string; year?: number; month?: number; startDate?: string; endDate?: string }

  const startStr = startDate ? startDate.split('T')[0] : ''
  const endStr = endDate ? endDate.split('T')[0] : ''

  let mappedDbRows: any[] = []
  try {
    let query = db
      .from('receipts')
      .select('*, receipt_items(*)')
      .eq('is_deleted', false)

    if (workspaceId) {
      // Only use valid UUIDs in Supabase query
      query = query.or(`workspace_id.eq.${workspaceId},workspace_id.eq.00000000-0000-4000-a000-000000000000`)
    }

    if (startStr) {
      query = query.gte('tanggal', startStr)
    }
    if (endStr) {
      query = query.lte('tanggal', endStr)
    }

    query = query.order('tanggal', { ascending: true })

    const { data } = await query
    mappedDbRows = (data || []).map((r: any) => {
      const items = r.receipt_items
        ? r.receipt_items.map((it: any) => ({
            namaBarang: it.nama_barang,
            qty: it.qty,
            harga: it.harga,
            subtotal: it.subtotal,
            name: it.nama_barang,
            price: it.harga,
            total: it.subtotal,
          }))
        : undefined
      const serialized = serializeReceipt(r, items)
      return { ...serialized, items }
    })
  } catch (dbErr) {
    console.warn('[API /api/export] Supabase fetch warning:', dbErr)
  }

  // Fetch cached receipts for offline resilience
  const cached = receiptCache.getAllReceipts(workspaceId)
  const dbIds = new Set(mappedDbRows.map((r: any) => r.id))
  const filteredCache = cached.filter((r) => {
    if (dbIds.has(r.id)) return false
    const rDate = (r.tanggal || r.transactionDate || '').split('T')[0]
    if (startStr && rDate && rDate < startStr) return false
    if (endStr && rDate && rDate > endStr) return false
    return true
  })

  const merged = [...mappedDbRows, ...filteredCache]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const receipts = merged.map((r: any) => {
    const rawInv = r.receiptNumber || r.invoiceNumber
    const validInv = isValidInvoiceNumber(rawInv) ? String(rawInv).trim() : ''
    const txDate = new Date(r.tanggal || r.transactionDate || Date.now())
    const ocrText = r.ocrRawText || r.ocrText || ''

    let address = ''
    if (isValidAddress(r.alamat)) address = r.alamat
    else if (isValidAddress(r.merchantAddress)) address = r.merchantAddress
    else address = extractAddressFromOcr(ocrText)

    let phone = ''
    if (isValidPhone(r.noTelepon)) phone = r.noTelepon
    else if (isValidPhone(r.merchantPhone)) phone = r.merchantPhone
    else if (isValidPhone(r.phone)) phone = r.phone
    else phone = extractPhoneFromOcr(ocrText)

    return {
      ...r,
      nominal: r.nominal ?? r.total ?? 0,
      namaToko: r.namaToko || r.merchantName || 'Lainnya',
      alamat: address,
      noTelepon: phone,
      receiptNumber: validInv,
      keterangan: r.keterangan || r.description || '',
      txDate: isNaN(txDate.getTime()) ? new Date() : txDate,
    }
  })

  // Fetch workspace settings
  let includeKomdigiHeader = true
  try {
    const { data: settingsData } = await db
      .from('app_settings')
      .select('key, value')
      .eq('workspace_id', workspaceId)

    if (settingsData) {
      settingsData.forEach((row) => {
        if (row.key === 'excel_include_logo') {
          includeKomdigiHeader = row.value === 'true' || row.value === true
        }
      })
    }
  } catch {}

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Notabase System - Komdigi'
  wb.created = new Date()

  // ---------- Sheet: Detail Nota ----------
  const detail = wb.addWorksheet('Laporan Nota', {
    properties: { tabColor: { argb: 'FF2563EB' } },
  })

  detail.columns = [
    { width: 6 },  // 1. No
    { width: 18 }, // 2. No. Nota
    { width: 24 }, // 3. Nama Toko
    { width: 28 }, // 4. Alamat Toko
    { width: 20 }, // 5. No. Telepon
    { width: 14 }, // 6. Tanggal
    { width: 26 }, // 7. Nama Barang
    { width: 12 }, // 8. Banyaknya
    { width: 18 }, // 9. Harga Satuan (Rp)
    { width: 18 }, // 10. Nominal (Rp)
    { width: 35 }, // 11. Keterangan
  ]

  const MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ]

  // Group receipts by YYYY-MM
  const groups: Record<string, typeof receipts> = {}
  receipts.forEach((r) => {
    const d = r.txDate
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!groups[key]) groups[key] = []
    groups[key].push(r)
  })

  // Sort keys ascending (earlier months first)
  const sortedKeys = Object.keys(groups).sort()

  const headers = [
    'No',
    'No. Nota',
    'Nama Toko',
    'Alamat Toko',
    'No. Telepon',
    'Tanggal',
    'Nama Barang',
    'Banyaknya',
    'Harga Satuan (Rp)',
    'Nominal (Rp)',
    'Keterangan',
  ]

  // Insert Komdigi Official Header Block if enabled
  if (includeKomdigiHeader) {
    const h1 = detail.addRow(['KEMENTERIAN KOMUNIKASI DAN DIGITAL REPUBLIK INDONESIA (KOMDIGI)'])
    detail.mergeCells(h1.number, 1, h1.number, 11)
    h1.height = 24
    h1.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    h1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1E48' } }
    h1.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }

    const h2 = detail.addRow(['BPPKI MANADO — NOTABASE DIGITAL RECEIPT MANAGEMENT SYSTEM'])
    detail.mergeCells(h2.number, 1, h2.number, 11)
    h2.height = 20
    h2.getCell(1).font = { bold: true, color: { argb: 'FF93C5FD' }, size: 10 }
    h2.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }
    h2.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }

    detail.addRow([]) // Spacer row
  }

  sortedKeys.forEach((key, blockIdx) => {
    const groupReceipts = groups[key]
    const [yr, mo] = key.split('-')
    const monthName = MONTHS[Number(mo) - 1] || 'Bulan'

    // 1. Add Title Banner Row
    const titleRow = detail.addRow([`Rekap Laporan Nota — ${monthName} ${yr}`])
    detail.mergeCells(titleRow.number, 1, titleRow.number, 11)
    titleRow.height = 28
    const cell = titleRow.getCell(1)
    cell.font = { bold: true, color: { argb: 'FF1E3A8A' }, size: 12 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }

    // 2. Add Header Row
    const headerRow = detail.addRow(headers)
    headerRow.height = 24
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      }
    })

    // 3. Add Data Rows
    let rowCounter = 1
    groupReceipts.forEach((r) => {
      const formattedDate = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(r.txDate)
      const items = r.items && Array.isArray(r.items) && r.items.length > 0 ? r.items : null

      if (items) {
        items.forEach((item: any) => {
          const itemName = item.namaBarang || item.name || 'Item'
          const itemQty = Number(item.qty) || 1
          const itemPrice = Number(item.harga ?? item.price ?? 0)
          const itemTotal = Number(item.subtotal ?? item.total ?? (itemQty * itemPrice))

          const row = detail.addRow([
            rowCounter++,
            r.receiptNumber,
            r.namaToko,
            r.alamat || '',
            r.noTelepon || '',
            formattedDate,
            itemName,
            itemQty,
            itemPrice,
            itemTotal,
            r.keterangan,
          ])
          row.height = 20
          row.eachCell((cell, colNumber) => {
            cell.alignment = { vertical: 'middle' }
            cell.border = {
              bottom: { style: 'thin', color: { argb: 'FFF3F4F6' } },
            }
            if (colNumber === 8) {
              cell.numFmt = '#,##0'
              cell.alignment = { vertical: 'middle', horizontal: 'center' }
            }
            if (colNumber === 9 || colNumber === 10) {
              cell.numFmt = '#,##0'
              cell.alignment = { vertical: 'middle', horizontal: 'right' }
            }
            if (colNumber === 10) {
              cell.font = { bold: true }
            }
            if (colNumber === 1) cell.alignment = { horizontal: 'center', vertical: 'middle' }
          })
        })
      } else {
        const fallbackItemName = r.keterangan || r.description || r.namaToko || 'Item'
        const row = detail.addRow([
          rowCounter++,
          r.receiptNumber || '',
          r.namaToko,
          r.alamat || '',
          r.noTelepon || '',
          formattedDate,
          fallbackItemName,
          1,
          r.nominal,
          r.nominal,
          r.keterangan || '',
        ])
        row.height = 20
        row.eachCell((cell, colNumber) => {
          cell.alignment = { vertical: 'middle' }
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'FFF3F4F6' } },
          }
          if (colNumber === 8) {
            cell.numFmt = '#,##0'
            cell.alignment = { vertical: 'middle', horizontal: 'center' }
          }
          if (colNumber === 9 || colNumber === 10) {
            cell.numFmt = '#,##0'
            cell.alignment = { vertical: 'middle', horizontal: 'right' }
          }
          if (colNumber === 10) {
            cell.font = { bold: true }
          }
          if (colNumber === 1) cell.alignment = { horizontal: 'center', vertical: 'middle' }
        })
      }
    })

    // 4. Add TOTAL row
    const groupTotal = groupReceipts.reduce((a, b) => a + (b.nominal || 0), 0)
    const totalRow = detail.addRow(['', '', '', '', '', '', '', '', 'TOTAL', groupTotal, ''])
    totalRow.height = 24
    totalRow.eachCell((cell, colNumber) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }
      cell.font = { bold: true, size: 11, color: { argb: 'FF2563EB' } }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } }
      }
      if (colNumber === 10) {
        cell.numFmt = '#,##0'
        cell.alignment = { horizontal: 'right', vertical: 'middle' }
      }
    })

    // Add empty rows space if not the last block
    if (blockIdx < sortedKeys.length - 1) {
      detail.addRow([])
      detail.addRow([])
    }
  })

  // Freeze header row (of the first block)
  detail.views = [{ state: 'frozen', ySplit: 2 }]

  // Generate buffer
  const buffer = await wb.xlsx.writeBuffer()

  const filename = getReportFilename({ period, startDate, endDate, month, year })

  // Log export history if workspaceId is present
  if (workspaceId) {
    const totalNominal = receipts.reduce((sum, r) => sum + (r.nominal || 0), 0)
    try {
      const { data: setRes } = await db.from('app_settings').select('value').eq('workspace_id', workspaceId).eq('key', 'onedrive_account').maybeSingle()
      const accEmail = setRes?.value ? String(setRes.value) : ''

      await db.from('export_history').insert({
        workspace_id: workspaceId,
        file_name: filename,
        period_start: startDate || null,
        period_end: endDate || null,
        total_baris: receipts.length,
        total_nominal: totalNominal,
        status: 'sukses',
        uploaded_onedrive: true,
        onedrive_path: `${accEmail ? accEmail + '|' : ''}Notabase/Ekspor Bulanan/${filename}`,
      })
    } catch (e) {
      console.warn('Failed to log export_history:', e)
    }
  }

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
