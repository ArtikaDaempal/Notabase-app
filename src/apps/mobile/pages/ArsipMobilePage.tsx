/**
 * apps/mobile/pages/ArsipMobilePage.tsx
 * Main Mobile Page Layout combining Header, Filter Bar, ArsipList, FAB Camera Scan, and BottomNav.
 *
 * Dokumen acuan:
 *   01-architecture.md §4 (Layout Mobile Android — ArsipList.tsx)
 *   02-design-system.md §3.7 (Floating Action Button / FAB)
 */

import React, { useState, useEffect } from 'react'
import {
  Search,
  SlidersHorizontal,
  Camera,
  RotateCcw,
  Bell,
  Building2,
  Plus,
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
import { BottomNav } from '../layout/BottomNav'
import { ArsipList } from '../components/ArsipList'
import { ReceiptDetailModal } from '../components/ReceiptDetailModal'
import { useReceiptStore } from '@/shared/stores/useReceiptStore'
import {
  useReceipts,
  useReceiptDetail,
  useUpdateReceipt,
  useDeleteReceipt,
} from '@/shared/hooks/useReceipts'
import { KATEGORI_OPTIONS } from '@/shared/ui/ReceiptForm'
import { SINGLE_TENANT_WORKSPACE } from '@/shared/config/workspace'
import { cn } from '@/lib/utils'
import type { NavTab } from '@/types'

export interface ArsipMobilePageProps {
  workspaceId?: string
  workspaceName?: string
  onNavigateTab?: (tab: NavTab) => void
  onScanClick?: () => void
}

export function ArsipMobilePage({
  workspaceId = SINGLE_TENANT_WORKSPACE.id,
  workspaceName = 'BPSDMP Kominfo Manado',
  onNavigateTab,
  onScanClick,
}: ArsipMobilePageProps) {
  const [activeTab, setActiveTab] = useState<NavTab>('history')
  const [showFilters, setShowFilters] = useState(false)

  // Store & Query Hooks
  const {
    searchQuery,
    kategori,
    statusOcr,
    startDate,
    endDate,
    selectedReceiptId,
    setSearchQuery,
    setKategori,
    setStatusOcr,
    setDateRange,
    setSelectedReceiptId,
    resetFilters,
  } = useReceiptStore()

  const { data: receiptResponse, isLoading, refetch } = useReceipts(workspaceId)
  const { data: selectedReceipt } = useReceiptDetail(selectedReceiptId)
  const { mutateAsync: updateReceipt } = useUpdateReceipt(workspaceId)
  const { mutateAsync: deleteReceipt } = useDeleteReceipt()

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

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 pb-24">
      {/* ── Mobile Header ── */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white font-extrabold text-sm shadow-xs">
              N
            </div>
            <div>
              <span className="block text-sm font-extrabold tracking-tight leading-none text-slate-900 dark:text-white">
                Notabase
              </span>
              <span className="block text-[10px] text-slate-400 font-medium leading-none mt-0.5 truncate max-w-[140px]">
                {workspaceName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="relative flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Notifikasi"
            >
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Mobile Content ── */}
      <main className="mx-auto w-full max-w-md p-4 space-y-4 flex-1">
        {/* Search Bar & Filter Toggle */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama toko, no. nota..."
              className="h-11 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-10 text-xs shadow-xs focus-visible:ring-blue-500"
            />
            <button
              onClick={() => setShowFilters((p) => !p)}
              className={cn(
                'absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-xl text-slate-400 transition-colors',
                (kategori || statusOcr || startDate) && 'text-blue-600 bg-blue-50 dark:bg-blue-950',
              )}
              title="Toggle Filter"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>

          {/* Filter Panel (Collapsible) */}
          {showFilters && (
            <Card className="p-3.5 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Filter Spesifik</span>
                <button
                  onClick={resetFilters}
                  className="text-[11px] font-semibold text-red-500 hover:underline flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500">Kategori</label>
                  <Select
                    value={kategori || 'ALL'}
                    onValueChange={(val) => setKategori(val === 'ALL' ? null : val)}
                  >
                    <SelectTrigger className="h-9 rounded-xl text-xs border-slate-200 dark:border-slate-800">
                      <SelectValue placeholder="Semua" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Semua Kategori</SelectItem>
                      {KATEGORI_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500">Status OCR</label>
                  <Select
                    value={statusOcr || 'ALL'}
                    onValueChange={(val) => setStatusOcr(val === 'ALL' ? null : (val as any))}
                  >
                    <SelectTrigger className="h-9 rounded-xl text-xs border-slate-200 dark:border-slate-800">
                      <SelectValue placeholder="Semua" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Semua Status</SelectItem>
                      <SelectItem value="berhasil">Berhasil</SelectItem>
                      <SelectItem value="perlu_review">Perlu Review</SelectItem>
                      <SelectItem value="gagal">Gagal</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Receipt List & Grid */}
        <ArsipList
          receipts={receiptResponse?.data || []}
          isLoading={isLoading}
          onSelectReceipt={(id) => setSelectedReceiptId(id)}
          onDeleteReceipt={(id) => deleteReceipt(id)}
          onScanClick={onScanClick}
        />
      </main>

      {/* ── Floating Action Button (FAB) Kamera Scan (02-design-system.md §3.7) ── */}
      <button
        onClick={onScanClick || (() => handleTabChange('scan'))}
        className="fixed bottom-20 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
        title="Scan Nota Baru"
        aria-label="Scan Nota Baru"
      >
        <Camera className="h-6 w-6" />
      </button>

      {/* ── Mobile Bottom Navigation ── */}
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />

      {/* ── Detail & Edit Modal ── */}
      <ReceiptDetailModal
        receipt={selectedReceipt || null}
        isOpen={Boolean(selectedReceiptId)}
        onClose={() => setSelectedReceiptId(null)}
        onUpdate={async (id, patch) => {
          await updateReceipt({ id, patch })
        }}
        onDelete={async (id) => {
          await deleteReceipt(id)
        }}
      />
    </div>
  )
}
