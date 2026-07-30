/**
 * shared/stores/useReceiptStore.ts
 * Zustand Store for Receipt State, Search Filters, and Selected Receipt.
 *
 * Dokumen acuan:
 *   02-design-system.md (Filter & Dashboard UI State)
 *   03-business-rules.md §5 (BR-SRCH-01..03)
 */

import { create } from 'zustand'
import type { ReceiptType, StatusOcr } from '../types/receipt'

export type SortOption =
  | 'date-desc'
  | 'date-asc'
  | 'amount-desc'
  | 'amount-asc'
  | 'merchant-asc'

export interface ReceiptState {
  // ── Filter State ──
  searchQuery: string
  kategori: string | null
  receiptType: ReceiptType | null
  statusOcr: StatusOcr | null
  startDate: string | null           // "YYYY-MM-DD"
  endDate: string | null             // "YYYY-MM-DD"
  minNominal: number | null
  maxNominal: number | null
  sortBy: SortOption
  page: number
  pageSize: number

  // ── UI Modal / Selection State ──
  selectedReceiptId: string | null
  isFilterOpen: boolean

  // ── Actions ──
  setSearchQuery: (query: string) => void
  setKategori: (kategori: string | null) => void
  setReceiptType: (receiptType: ReceiptType | null) => void
  setStatusOcr: (statusOcr: StatusOcr | null) => void
  setDateRange: (startDate: string | null, endDate: string | null) => void
  setNominalRange: (minNominal: number | null, maxNominal: number | null) => void
  setSortBy: (sortBy: SortOption) => void
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  setSelectedReceiptId: (id: string | null) => void
  setIsFilterOpen: (open: boolean) => void
  toggleFilterOpen: () => void
  resetFilters: () => void
}

const initialFilterState = {
  searchQuery: '',
  kategori: null,
  receiptType: null,
  statusOcr: null,
  startDate: null,
  endDate: null,
  minNominal: null,
  maxNominal: null,
  sortBy: 'date-desc' as SortOption,
  page: 1,
  pageSize: 12,
}

export const useReceiptStore = create<ReceiptState>((set) => ({
  ...initialFilterState,
  selectedReceiptId: null,
  isFilterOpen: false,

  setSearchQuery: (searchQuery) => set({ searchQuery, page: 1 }),
  setKategori: () => {},
  setReceiptType: (receiptType) => set({ receiptType, page: 1 }),
  setStatusOcr: (statusOcr) => set({ statusOcr, page: 1 }),
  setDateRange: (startDate, endDate) => set({ startDate, endDate, page: 1 }),
  setNominalRange: (minNominal, maxNominal) => set({ minNominal, maxNominal, page: 1 }),
  setSortBy: (sortBy) => set({ sortBy, page: 1 }),
  setPage: (page) => set({ page }),
  setPageSize: (pageSize) => set({ pageSize, page: 1 }),

  setSelectedReceiptId: (selectedReceiptId) => set({ selectedReceiptId }),
  setIsFilterOpen: (isFilterOpen) => set({ isFilterOpen }),
  toggleFilterOpen: () => set((state) => ({ isFilterOpen: !state.isFilterOpen })),

  resetFilters: () => set({ ...initialFilterState, page: 1 }),
}))
