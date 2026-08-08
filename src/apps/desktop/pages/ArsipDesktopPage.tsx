/**
 * apps/desktop/pages/ArsipDesktopPage.tsx
 * Main Desktop Page Layout combining Sidebar, TopBar, Quick Filter Bar, and ArsipTable.
 *
 * Dokumen acuan:
 *   01-architecture.md §4 (Layout Desktop Windows — Sidebar, TopBar, ArsipTable.tsx)
 *   02-design-system.md §4 (Komponen terpisah desktop)
 */

import React, { useState, useEffect } from 'react'
import {
  Search,
  SlidersHorizontal,
  Plus,
  Download,
  RotateCcw,
  Calendar,
  Tag,
  ShieldCheck,
  ArrowUpDown,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Sidebar } from '../layout/Sidebar'
import { TopBar } from '../layout/TopBar'
import { ArsipTable } from '../components/ArsipTable'
import { useReceiptStore } from '@/shared/stores/useReceiptStore'
import {
  useReceipts,
  useDeleteReceipt,
  useSyncQueue,
  useTriggerSync,
} from '@/shared/hooks/useReceipts'
import { DEFAULT_WORKSPACE_ID } from '@/lib/constants'
import type { NavTab } from '@/types'

import { getReportFilename } from '@/lib/utils'

export interface ArsipDesktopPageProps {
  workspaceId?: string
  workspaceName?: string
  workspaceCode?: string
  onNavigateTab?: (tab: NavTab) => void
  onOpenDetail?: (id: string) => void
  onAddNewReceipt?: () => void
}

export function ArsipDesktopPage({
  workspaceId = DEFAULT_WORKSPACE_ID,
  workspaceName = 'BPSDMP Kominfo Manado',
  workspaceCode = 'BPSDMP-MANADO',
  onNavigateTab,
  onOpenDetail,
  onAddNewReceipt,
}: ArsipDesktopPageProps) {
  // Sidebar State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<NavTab>('history')

  // Filter Store State
  const {
    searchQuery,
    statusOcr,
    startDate,
    endDate,
    sortBy,
    page,
    pageSize,
    setSearchQuery,
    setStatusOcr,
    setDateRange,
    setSortBy,
    setPage,
    setPageSize,
    resetFilters,
  } = useReceiptStore()

  // Query & Mutation Hooks
  const { data: receiptResponse, isLoading, refetch } = useReceipts(workspaceId)
  const { mutate: deleteReceipt } = useDeleteReceipt()
  const { data: syncSummary } = useSyncQueue(workspaceId)
  const { mutate: triggerSync } = useTriggerSync(workspaceId)

  useEffect(() => {
    refetch()
    const handleUpdate = () => refetch()
    window.addEventListener('notabase_receipts_changed', handleUpdate)
    window.addEventListener('receipts-updated', handleUpdate)
    window.addEventListener('receipt-saved', handleUpdate)
    window.addEventListener('receipt-deleted', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    window.addEventListener('focus', handleUpdate)
    return () => {
      window.removeEventListener('notabase_receipts_changed', handleUpdate)
      window.removeEventListener('receipts-updated', handleUpdate)
      window.removeEventListener('receipt-saved', handleUpdate)
      window.removeEventListener('receipt-deleted', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
      window.removeEventListener('focus', handleUpdate)
    }
  }, [refetch])

  const handleTabChange = (tab: NavTab) => {
    setActiveTab(tab)
    if (onNavigateTab) onNavigateTab(tab)
  }

  const handleDelete = (id: string) => {
    if (confirm('Hapus nota ini?')) {
      deleteReceipt(id, {
        onSuccess: () => {
          window.dispatchEvent(new CustomEvent('notabase_receipts_changed'))
          window.dispatchEvent(new Event('receipts-updated'))
          window.dispatchEvent(new Event('receipt-deleted'))
          toast.success('Nota berhasil dihapus')
          refetch()
        },
        onError: () => toast.error('Gagal menghapus nota'),
      })
    }
  }

  const handleExportExcel = async () => {
    try {
      toast.loading('Mempersiapkan laporan Excel...')
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': workspaceId,
        },
        body: JSON.stringify({ startDate, endDate }),
      })
      if (!res.ok) throw new Error('Gagal mengekspor laporan')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = getReportFilename({ startDate, endDate })
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.dismiss()
      toast.success('Laporan Excel berhasil diunduh!')
    } catch {
      toast.dismiss()
      toast.error('Gagal mendownload Excel')
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100">
      {/* ── Sidebar Navigation ── */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        workspaceName={workspaceName}
        workspaceCode={workspaceCode}
      />

      {/* ── Main Content Area ── */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top Header Bar */}
        <TopBar
          title="Arsip Nota & Tabel Data"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isOnline={syncSummary?.isOnline ?? true}
          pendingSyncCount={syncSummary?.pendingCount ?? 0}
          onSyncClick={() => triggerSync()}
          workspaceName={workspaceName}
        />

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Header & Quick Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Kelola Nota Transaksi
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Daftar nota terverifikasi dalam sistem NotaBase
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleExportExcel}
                className="rounded-xl h-11 px-4 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 shadow-xs"
              >
                <Download className="h-4 w-4 mr-2 text-emerald-600" />
                Export Excel
              </Button>
              {onAddNewReceipt && (
                <Button
                  onClick={onAddNewReceipt}
                  className="rounded-xl h-11 px-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-200 dark:shadow-none gap-2"
                >
                  <Plus className="h-5 w-5" />
                  Tambah Nota Baru
                </Button>
              )}
            </div>
          </div>

          {/* Quick Filter Bar Card */}
          <Card className="p-4 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                <SlidersHorizontal className="h-4 w-4 text-blue-600" />
                <span>Filter &amp; Pencarian Cepat</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-8 text-xs text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Reset Filter
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Search input (mobile/tablet fallback) */}
              <div className="relative md:hidden">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari toko / no. nota..."
                  className="h-10 rounded-xl border-slate-200 dark:border-slate-700 pl-9 text-xs"
                />
              </div>



              {/* Status OCR Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-blue-500" /> Status OCR
                </label>
                <Select
                  value={statusOcr || 'ALL'}
                  onValueChange={(val) => setStatusOcr(val === 'ALL' ? null : (val as any))}
                >
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 dark:border-slate-700 text-xs bg-slate-50/50 dark:bg-slate-800/50">
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Status</SelectItem>
                    <SelectItem value="berhasil">Berhasil (≥80%)</SelectItem>
                    <SelectItem value="perlu_review">Perlu Review (50-79%)</SelectItem>
                    <SelectItem value="gagal">Gagal (&lt;50%)</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Start Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-blue-500" /> Dari Tanggal
                </label>
                <Input
                  type="date"
                  value={startDate || ''}
                  onChange={(e) => setDateRange(e.target.value || null, endDate)}
                  className="h-10 rounded-xl border-slate-200 dark:border-slate-700 text-xs bg-slate-50/50 dark:bg-slate-800/50"
                />
              </div>

              {/* Sort By Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                  <ArrowUpDown className="h-3 w-3 text-blue-500" /> Urutkan
                </label>
                <Select value={sortBy} onValueChange={(val) => setSortBy(val as any)}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 dark:border-slate-700 text-xs bg-slate-50/50 dark:bg-slate-800/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date-desc">Tanggal Terbaru</SelectItem>
                    <SelectItem value="date-asc">Tanggal Terlama</SelectItem>
                    <SelectItem value="amount-desc">Nominal Tertinggi</SelectItem>
                    <SelectItem value="amount-asc">Nominal Terendah</SelectItem>
                    <SelectItem value="merchant-asc">Nama Toko (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Desktop Data Table */}
          <ArsipTable
            receipts={receiptResponse?.data || []}
            isLoading={isLoading}
            totalCount={receiptResponse?.total || 0}
            currentPage={page}
            pageSize={pageSize}
            totalPages={receiptResponse?.totalPages || 1}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            onViewDetail={(id) => onOpenDetail ? onOpenDetail(id) : undefined}
            onDeleteReceipt={handleDelete}
          />
        </main>
      </div>
    </div>
  )
}
