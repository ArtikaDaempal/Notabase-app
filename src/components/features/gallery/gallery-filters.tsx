'use client'

/**
 * gallery-filters.tsx
 * Filter and sort controls for the image gallery.
 */

import { X, SlidersHorizontal } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface GalleryFilterState {
  receiptType: 'all' | 'scan' | 'gallery' | 'manual'
  sort: 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'merchant-asc'
  dateRange: 'all' | 'today' | 'week' | 'month'
}

interface GalleryFiltersProps {
  filters: GalleryFilterState
  onChange: (filters: GalleryFilterState) => void
  total: number
  loading: boolean
}

const DEFAULTS: GalleryFilterState = {
  receiptType: 'all',
  sort: 'date-desc',
  dateRange: 'all',
}

function isDefaultFilters(f: GalleryFilterState) {
  return f.receiptType === 'all' && f.sort === 'date-desc' && f.dateRange === 'all'
}

export function GalleryFilters({ filters, onChange, total, loading }: GalleryFiltersProps) {
  const set = (partial: Partial<GalleryFilterState>) => onChange({ ...filters, ...partial })
  const reset = () => onChange(DEFAULTS)
  const isDirty = !isDefaultFilters(filters)

  return (
    <div className="space-y-3">
      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filter
        </div>

        {/* Source filter */}
        <Select
          value={filters.receiptType}
          onValueChange={(v) => set({ receiptType: v as GalleryFilterState['receiptType'] })}
        >
          <SelectTrigger className="h-9 w-auto min-w-[120px] rounded-xl border-slate-200 bg-white text-xs shadow-sm">
            <SelectValue placeholder="Sumber" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Sumber</SelectItem>
            <SelectItem value="scan">📷 Scan Kamera</SelectItem>
            <SelectItem value="gallery">🖼 Dari Galeri</SelectItem>
            <SelectItem value="manual">📄 Nota Manual</SelectItem>
          </SelectContent>
        </Select>

        {/* Date range filter */}
        <Select
          value={filters.dateRange}
          onValueChange={(v) => set({ dateRange: v as GalleryFilterState['dateRange'] })}
        >
          <SelectTrigger className="h-9 w-auto min-w-[120px] rounded-xl border-slate-200 bg-white text-xs shadow-sm">
            <SelectValue placeholder="Periode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Waktu</SelectItem>
            <SelectItem value="today">Hari Ini</SelectItem>
            <SelectItem value="week">Minggu Ini</SelectItem>
            <SelectItem value="month">Bulan Ini</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select
          value={filters.sort}
          onValueChange={(v) => set({ sort: v as GalleryFilterState['sort'] })}
        >
          <SelectTrigger className="h-9 w-auto min-w-[110px] rounded-xl border-slate-200 bg-white text-xs shadow-sm">
            <SelectValue placeholder="Urutkan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date-desc">Terbaru</SelectItem>
            <SelectItem value="date-asc">Terlama</SelectItem>
            <SelectItem value="amount-desc">Nominal ↓</SelectItem>
            <SelectItem value="amount-asc">Nominal ↑</SelectItem>
            <SelectItem value="merchant-asc">Merchant A-Z</SelectItem>
          </SelectContent>
        </Select>

        {/* Reset */}
        {isDirty && (
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            className="h-9 gap-1 rounded-xl text-xs text-slate-500 hover:text-red-500"
          >
            <X className="h-3.5 w-3.5" />
            Reset
          </Button>
        )}

        <span className={cn('ml-auto text-xs text-slate-400', loading && 'opacity-0')}>
          {total} gambar
        </span>
      </div>

      {/* Active filter chips */}
      {isDirty && (
        <div className="flex flex-wrap gap-1.5">
          {filters.receiptType !== 'all' && (
            <FilterChip
              label={filters.receiptType === 'scan' ? '📷 Scan' : filters.receiptType === 'gallery' ? '🖼 Galeri' : '📄 Manual'}
              onRemove={() => set({ receiptType: 'all' })}
            />
          )}
          {filters.dateRange !== 'all' && (
            <FilterChip
              label={filters.dateRange === 'today' ? 'Hari Ini' : filters.dateRange === 'week' ? 'Minggu Ini' : 'Bulan Ini'}
              onRemove={() => set({ dateRange: 'all' })}
            />
          )}
          {filters.sort !== 'date-desc' && (
            <FilterChip
              label={{ 'date-asc': 'Terlama', 'amount-desc': 'Nominal ↓', 'amount-asc': 'Nominal ↑', 'merchant-asc': 'A-Z' }[filters.sort] || ''}
              onRemove={() => set({ sort: 'date-desc' })}
            />
          )}
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
      {label}
      <button onClick={onRemove} className="ml-0.5 text-blue-400 hover:text-blue-700">
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}
