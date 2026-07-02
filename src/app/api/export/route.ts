import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { db } from '@/lib/db'
import { formatRupiah } from '@/lib/utils'

// POST /api/export — generate an Excel report
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const {
    periodLabel = 'Semua Periode',
    startDate,
    endDate,
  } = body as { periodLabel?: string; startDate?: string; endDate?: string }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (startDate || endDate) {
    where.transactionDate = {}
    if (startDate) where.transactionDate.gte = new Date(startDate)
    if (endDate) where.transactionDate.lte = new Date(endDate)
  }

  const receipts = await db.receipt.findMany({
    where,
    orderBy: { transactionDate: 'asc' },
  })

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Notabase'
  wb.created = new Date()

  // ---------- Sheet 1: Summary ----------
  const summary = wb.addWorksheet('Ringkasan', {
    properties: { tabColor: { argb: 'FF2563EB' } },
  })
  summary.columns = [
    { width: 4 }, { width: 28 }, { width: 24 }, { width: 24 },
  ]

  // Title block
  summary.mergeCells('B2:D2')
  const titleCell = summary.getCell('B2')
  titleCell.value = 'NOTABASE — LAPORAN NOTA DIGITAL'
  titleCell.font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  summary.getRow(2).height = 34

  summary.mergeCells('B3:D3')
  const subCell = summary.getCell('B3')
  subCell.value = `Periode: ${periodLabel}  |  Dicetak: ${new Date().toLocaleString('id-ID')}`
  subCell.font = { size: 11, italic: true, color: { argb: 'FF6B7280' } }
  subCell.alignment = { horizontal: 'center' }

  // Stats
  const totalNominal = receipts.reduce((a, b) => a + b.total, 0)
  const avg = receipts.length ? totalNominal / receipts.length : 0
  const verified = receipts.filter((r) => r.status === 'verified').length

  const statsRow = (label: string, value: string, row: number) => {
    const c = summary.getCell(`B${row}`)
    c.value = label
    c.font = { size: 11, color: { argb: 'FF6B7280' } }
    const v = summary.getCell(`C${row}`)
    v.value = value
    v.font = { size: 12, bold: true, color: { argb: 'FF111827' } }
  }
  statsRow('Total Nota', String(receipts.length), 5)
  statsRow('Total Nominal', formatRupiah(totalNominal), 6)
  statsRow('Rata-rata per Nota', formatRupiah(Math.round(avg)), 7)
  statsRow('Nota Terverifikasi', String(verified), 8)

  for (let r = 5; r <= 8; r++) {
    summary.getRow(r).height = 22
    summary.getCell(`B${r}`).border = {
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    }
  }

  // ---------- Sheet 2: Detail ----------
  const detail = wb.addWorksheet('Detail Nota', {
    properties: { tabColor: { argb: 'FF10B981' } },
  })

  const headers = ['No', 'No. Invoice', 'Merchant', 'Tanggal', 'Kategori', 'Total (Rp)', 'Status', 'Confidence', 'Deskripsi']
  detail.columns = [
    { width: 6 }, { width: 20 }, { width: 26 }, { width: 14 },
    { width: 18 }, { width: 18 }, { width: 12 }, { width: 12 }, { width: 40 },
  ]

  // Header row
  const headerRow = detail.addRow(headers)
  headerRow.height = 28
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    }
  })

  // Data rows
  receipts.forEach((r, idx) => {
    const row = detail.addRow([
      idx + 1,
      r.invoiceNumber || '-',
      r.merchantName,
      new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(r.transactionDate),
      r.category || 'Lainnya',
      r.total,
      r.status,
      `${Math.round(r.confidence)}%`,
      r.description || '-',
    ])
    row.height = 20
    row.eachCell((cell, colNumber) => {
      cell.alignment = { vertical: 'middle' }
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFF3F4F6' } },
      }
      if (colNumber === 6) {
        // Total column: number format Rupiah
        cell.numFmt = '#,##0'
        cell.alignment = { vertical: 'middle', horizontal: 'right' }
        cell.font = { bold: true }
      }
      if (colNumber === 7) {
        const statusColors: Record<string, string> = {
          verified: 'FF10B981',
          pending: 'FFF59E0B',
          failed: 'FFEF4444',
        }
        const color = statusColors[r.status] || 'FF6B7280'
        cell.font = { bold: true, color: { argb: color } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      }
      if (colNumber === 1) cell.alignment = { horizontal: 'center', vertical: 'middle' }
    })
  })

  // Total row
  if (receipts.length) {
    const totalRow = detail.addRow(['', '', '', '', 'TOTAL', totalNominal, '', '', ''])
    totalRow.height = 26
    totalRow.eachCell((cell, colNumber) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }
      cell.font = { bold: true, size: 12, color: { argb: 'FF2563EB' } }
      cell.border = { top: { style: 'medium', color: { argb: 'FF2563EB' } } }
      if (colNumber === 6) {
        cell.numFmt = '#,##0'
        cell.alignment = { horizontal: 'right', vertical: 'middle' }
      }
    })
  }

  // Freeze header
  detail.views = [{ state: 'frozen', ySplit: 1 }]

  // Generate buffer
  const buffer = await wb.xlsx.writeBuffer()

  const filename = `Report_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}.xlsx`
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
