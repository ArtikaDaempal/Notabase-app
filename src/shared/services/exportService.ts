/**
 * shared/services/exportService.ts
 * Export Service for Excel/CSV Report Generation and OneDrive Sync Integration.
 *
 * Dokumen acuan:
 *   01-architecture.md §3.5 (Export Service & OneDrive Integration)
 *   03-business-rules.md §6 (BR-EXP-01..06)
 */

import ExcelJS from 'exceljs'
import { receiptService } from './receiptService'
import { createWorkspaceSupabaseClient } from './supabase'
import { formatRupiah, formatDateID, isValidInvoiceNumber } from '@/lib/utils'
import type { Receipt, PeriodType, ExportStatus } from '../types'

export interface ExportOptions {
  periodType?: PeriodType | 'kustom'
  startDate?: string | null  // "YYYY-MM-DD"
  endDate?: string | null    // "YYYY-MM-DD"
  workspaceName?: string
  workspaceCode?: string
  includeItems?: boolean
}

export interface ExportResult {
  blob: Blob
  fileName: string
  rowCount: number
  totalNominal: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Export Service Implementation
// ─────────────────────────────────────────────────────────────────────────────

export const exportService = {
  /**
   * Hasilkan workbook Excel (.xlsx) untuk data nota sesuai filter periode.
   * Format acuan: 03-business-rules.md §6 (BR-EXP-01..04)
   *
   * @param workspaceId - UUID workspace
   * @param options     - Filter periode & nama workspace
   */
  async generateExcelReport(
    workspaceId: string,
    options: ExportOptions = {},
  ): Promise<ExportResult> {
    const {
      periodType = 'bulanan',
      startDate,
      endDate,
      workspaceName = 'BPSDMP Kominfo Manado',
      workspaceCode = 'BPSDMP-MANADO',
      includeItems = true,
    } = options

    // 1. Fetch filtered receipts from receiptService
    const { data: receipts } = await receiptService.getReceipts(workspaceId, {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      pageSize: 5000, // Fetch up to 5000 records for report
    })

    // 2. Initialize ExcelJS Workbook
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Notabase System'
    workbook.created = new Date()

    // ── Sheet 1: Ringkasan Laporan ──
    const summarySheet = workbook.addWorksheet('Ringkasan Laporan')
    summarySheet.columns = [
      { header: 'Parameter', key: 'param', width: 25 },
      { header: 'Nilai / Keterangan', key: 'value', width: 45 },
    ]

    const totalNominalSum = receipts.reduce((sum, r) => sum + (r.nominal ?? r.total ?? 0), 0)

    summarySheet.addRows([
      { param: 'Nama Workspace', value: workspaceName },
      { param: 'Kode Workspace', value: workspaceCode },
      { param: 'Tipe Periode', value: periodType.toUpperCase() },
      { param: 'Rentang Tanggal', value: `${startDate || 'Semua'} s/d ${endDate || 'Semua'}` },
      { param: 'Total Nota', value: receipts.length },
      { param: 'Total Nominal Keseluruhan', value: formatRupiah(totalNominalSum) },
      { param: 'Tanggal Cetak', value: new Date().toLocaleString('id-ID') },
    ])

    // Format Summary Header
    summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1D4ED8' }, // Brand Primary Blue
    }

    // ── Sheet 2: Daftar Nota Transaksi (Detail) ──
    const detailSheet = workbook.addWorksheet('Daftar Nota')
    detailSheet.columns = [
      { header: 'No.', key: 'no', width: 6 },
      { header: 'No. Nota / Invoice', key: 'receiptNumber', width: 22 },
      { header: 'Tanggal', key: 'tanggal', width: 14 },
      { header: 'Nama Toko / Merchant', key: 'namaToko', width: 28 },
      { header: 'Metode Pembayaran', key: 'metodePembayaran', width: 18 },
      { header: 'Nominal (Rp)', key: 'nominal', width: 20 },
      { header: 'Status OCR', key: 'statusOcr', width: 15 },
      { header: 'Confidence (%)', key: 'confidence', width: 15 },
      { header: 'Keterangan', key: 'keterangan', width: 30 },
    ]

    // Style Detail Header
    const headerRow = detailSheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1D4ED8' },
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

    // Add Data Rows
    receipts.forEach((r, idx) => {
      const rawInv = r.receiptNumber || r.invoiceNumber
      const invDisplay = isValidInvoiceNumber(rawInv) ? rawInv : '-'
      const row = detailSheet.addRow({
        no: idx + 1,
        receiptNumber: invDisplay,
        tanggal: r.tanggal || r.transactionDate?.slice(0, 10),
        namaToko: r.namaToko || r.merchantName || '-',
        metodePembayaran: r.metodePembayaran || 'Tunai',
        nominal: r.nominal ?? r.total ?? 0,
        statusOcr: (r.statusOcr || r.status || 'berhasil').toUpperCase(),
        confidence: r.ocrConfidence ? `${Math.round(r.ocrConfidence)}%` : '-',
        keterangan: r.keterangan || r.description || '',
      })

      // Number formatting for Nominal column
      const cellNominal = row.getCell('nominal')
      cellNominal.numFmt = 'Rp #,##0'
      cellNominal.alignment = { horizontal: 'right' }
    })

    // Totals Row at Bottom of Sheet 2
    if (receipts.length > 0) {
      const totalRow = detailSheet.addRow({
        no: '',
        receiptNumber: 'TOTAL KESELURUHAN',
        nominal: totalNominalSum,
      })
      totalRow.font = { bold: true }
      const totalCell = totalRow.getCell('nominal')
      totalCell.numFmt = 'Rp #,##0'
      totalCell.alignment = { horizontal: 'right' }
    }

    // ── Sheet 3: Rincian Item Barang (Optional) ──
    if (includeItems) {
      const itemSheet = workbook.addWorksheet('Rincian Item Barang')
      itemSheet.columns = [
        { header: 'No. Nota', key: 'receiptNumber', width: 20 },
        { header: 'Nama Toko', key: 'namaToko', width: 25 },
        { header: 'Nama Barang / Jasa', key: 'namaBarang', width: 30 },
        { header: 'Qty', key: 'qty', width: 10 },
        { header: 'Harga Satuan (Rp)', key: 'harga', width: 18 },
        { header: 'Subtotal (Rp)', key: 'subtotal', width: 20 },
      ]

      itemSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      itemSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF15803D' }, // Secondary Action Green
      }

      receipts.forEach((r) => {
        if (r.items && r.items.length > 0) {
          const rawInv = r.receiptNumber || r.invoiceNumber
          const invDisplay = isValidInvoiceNumber(rawInv) ? rawInv : '-'
          r.items.forEach((it) => {
            const row = itemSheet.addRow({
              receiptNumber: invDisplay,
              namaToko: r.namaToko || r.merchantName,
              namaBarang: it.namaBarang || it.name,
              qty: it.qty,
              harga: it.harga || it.price || 0,
              subtotal: it.subtotal || (it.qty * (it.harga || 0)),
            })
            row.getCell('harga').numFmt = 'Rp #,##0'
            row.getCell('subtotal').numFmt = 'Rp #,##0'
          })
        }
      })
    }

    // 3. Generate Buffer & Blob
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    // 4. Construct Filename per BR-EXP-02: Laporan_Nota_{Workspace}_{Periode}_{YYYY-MM-DD}.xlsx
    const dateStamp = new Date().toISOString().slice(0, 10)
    const cleanWsCode = workspaceCode.replace(/[^a-zA-Z0-9_-]/g, '_')
    const fileName = `Laporan_Nota_${cleanWsCode}_${periodType.toLowerCase()}_${dateStamp}.xlsx`

    return {
      blob,
      fileName,
      rowCount: receipts.length,
      totalNominal: totalNominalSum,
    }
  },

  /**
   * Hasilkan file CSV untuk data nota.
   *
   * @param workspaceId - UUID workspace
   */
  async generateCsvReport(workspaceId: string): Promise<ExportResult> {
    const { data: receipts } = await receiptService.getReceipts(workspaceId, { pageSize: 5000 })

    const headers = [
      'No',
      'No Nota',
      'Tanggal',
      'Nama Toko',
      'Metode Pembayaran',
      'Nominal',
      'Status OCR',
      'Keterangan',
    ]

    const rows = receipts.map((r, i) => [
      i + 1,
      `"${(r.receiptNumber || r.invoiceNumber || '').replace(/"/g, '""')}"`,
      r.tanggal || r.transactionDate?.slice(0, 10) || '',
      `"${(r.namaToko || r.merchantName || '').replace(/"/g, '""')}"`,
      `"${r.metodePembayaran || 'Tunai'}"`,
      r.nominal ?? r.total ?? 0,
      r.statusOcr || r.status || 'berhasil',
      `"${(r.keterangan || r.description || '').replace(/"/g, '""')}"`,
    ])

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })

    const dateStamp = new Date().toISOString().slice(0, 10)
    const fileName = `Laporan_Nota_${dateStamp}.csv`
    const totalNominal = receipts.reduce((sum, r) => sum + (r.nominal ?? r.total ?? 0), 0)

    return {
      blob,
      fileName,
      rowCount: receipts.length,
      totalNominal,
    }
  },

  /**
   * Upload file laporan yang sudah diekspor ke OneDrive (BR-EXP-05 & BR-SYNC-04).
   *
   * @param workspaceId - UUID workspace
   * @param blob        - File Blob hasil generateExcelReport
   * @param fileName    - Nama file laporan
   */
  async uploadExportToOneDrive(
    workspaceId: string,
    blob: Blob,
    fileName: string,
    periodType: PeriodType | string = 'bulanan',
  ): Promise<{ success: boolean; onedriveUrl?: string; error?: string }> {
    try {
      const formData = new FormData()
      formData.append('file', blob, fileName)
      formData.append('periodType', periodType)

      const res = await fetch('/api/sync/onedrive', {
        method: 'POST',
        headers: {
          'x-workspace-id': workspaceId,
        },
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal mengunggah ke OneDrive')

      // Record export history to Supabase (BR-EXP-06)
      await this.recordExportHistory(workspaceId, {
        fileName,
        periodType,
        rowCount: data.rowCount || 0,
        status: 'sukses',
        onedriveUrl: data.webUrl,
      })

      return {
        success: true,
        onedriveUrl: data.webUrl,
      }
    } catch (err: any) {
      console.error('[Notabase Export] Gagal upload ke OneDrive:', err)

      await this.recordExportHistory(workspaceId, {
        fileName,
        periodType,
        rowCount: 0,
        status: 'gagal',
        errorMessage: err.message,
      })

      return {
        success: false,
        error: err.message || 'Gagal mengunggah laporan ke OneDrive',
      }
    }
  },

  /**
   * Simpan riwayat ekspor ke tabel `export_history` (BR-EXP-06).
   */
  async recordExportHistory(
    workspaceId: string,
    payload: {
      fileName: string
      periodType: PeriodType | string
      rowCount: number
      status: ExportStatus | string
      onedriveUrl?: string
      errorMessage?: string
    },
  ): Promise<void> {
    try {
      const client = createWorkspaceSupabaseClient(workspaceId)
      await client.from('export_history').insert({
        workspace_id: workspaceId,
        file_name: payload.fileName,
        period_type: payload.periodType,
        total_records: payload.rowCount,
        status: payload.status,
        onedrive_file_url: payload.onedriveUrl,
        error_message: payload.errorMessage,
        created_at: new Date().toISOString(),
      } as any)
    } catch (err) {
      console.warn('[Notabase Export] Gagal mencatat riwayat ekspor:', err)
    }
  },
}
