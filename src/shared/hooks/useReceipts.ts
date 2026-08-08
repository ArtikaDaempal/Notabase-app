/**
 * shared/hooks/useReceipts.ts
 * React Query Hooks for Receipts CRUD & Offline Sync Queue.
 *
 * Dokumen acuan:
 *   01-architecture.md §3.5 (useReceipts, useExport, useOcrScan hooks)
 *   03-business-rules.md (BR-MAN, BR-OCR, BR-SYNC)
 */

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { receiptService } from '../services/receiptService'
import { syncService } from '../services/syncService'
import { createWorkspaceSupabaseClient } from '../services/supabase'
import { SINGLE_TENANT_WORKSPACE } from '../config/workspace'
import { useReceiptStore } from '../stores/useReceiptStore'
import type { Receipt } from '../types/receipt'

// ─────────────────────────────────────────────────────────────────────────────
// Receipt Query & Mutation Hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch daftar nota berdasarkan filter di `useReceiptStore` untuk workspace aktif.
 *
 * @param workspaceId - UUID workspace (opsional, jika tidak diset maka query disable)
 */
export function useReceipts(workspaceId?: string | null) {
  const queryClient = useQueryClient()
  const {
    searchQuery,
    receiptType,
    statusOcr,
    startDate,
    endDate,
    minNominal,
    maxNominal,
    sortBy,
    page,
    pageSize,
  } = useReceiptStore()

  useEffect(() => {
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
    }
    window.addEventListener('notabase_receipts_changed', handleUpdate)
    window.addEventListener('receipts-updated', handleUpdate)
    window.addEventListener('receipt-saved', handleUpdate)
    window.addEventListener('receipt-deleted', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    window.addEventListener('focus', handleUpdate)

    // Supabase Realtime Subscription for automatic remote deletion / insertion sync
    const client = createWorkspaceSupabaseClient(SINGLE_TENANT_WORKSPACE.id)
    const channel = client
      .channel('public-receipts-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'receipts' },
        () => {
          handleUpdate()
        }
      )
      .subscribe()

    return () => {
      window.removeEventListener('notabase_receipts_changed', handleUpdate)
      window.removeEventListener('receipts-updated', handleUpdate)
      window.removeEventListener('receipt-saved', handleUpdate)
      window.removeEventListener('receipt-deleted', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
      window.removeEventListener('focus', handleUpdate)
      client.removeChannel(channel)
    }
  }, [queryClient])

  return useQuery({
    queryKey: [
      'receipts',
      workspaceId,
      {
        searchQuery,
        receiptType,
        statusOcr,
        startDate,
        endDate,
        minNominal,
        maxNominal,
        sortBy,
        page,
        pageSize,
      },
    ],
    queryFn: async () => {
      if (!workspaceId) throw new Error('workspaceId diperlukan')
      return await receiptService.getReceipts(workspaceId, {
        q: searchQuery,
        receiptType,
        statusOcr,
        startDate,
        endDate,
        minNominal,
        maxNominal,
        sort: sortBy,
        page,
        pageSize,
      })
    },
    enabled: Boolean(workspaceId),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
}

/**
 * Fetch detail 1 nota berdasarkan ID.
 *
 * @param id - UUID nota
 */
export function useReceiptDetail(id: string | null) {
  return useQuery({
    queryKey: ['receipt', id],
    queryFn: async () => {
      if (!id) return null
      return await receiptService.getReceiptById(id)
    },
    enabled: Boolean(id),
  })
}

/**
 * Mutation hook untuk membuat nota baru (manual/scan/gallery).
 * Otomatis meng-invalidate cache query `receipts` & status sync.
 *
 * @param workspaceId - UUID workspace
 */
export function useCreateReceipt(workspaceId?: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Parameters<typeof receiptService.createReceipt>[1]) => {
      if (!workspaceId) throw new Error('workspaceId diperlukan')
      return await receiptService.createReceipt(workspaceId, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['syncQueue'] })
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notabase_receipts_changed'))
      }
    },
  })
}

export function useUpdateReceipt(workspaceId?: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Receipt> }) => {
      return await receiptService.updateReceipt(id, patch)
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['receipt', updated.id] })
      queryClient.invalidateQueries({ queryKey: ['syncQueue'] })
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notabase_receipts_changed'))
      }
    },
  })
}

export function useDeleteReceipt() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      return await receiptService.deleteReceipt(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.refetchQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['syncQueue'] })
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notabase_receipts_changed'))
        window.dispatchEvent(new Event('receipts-updated'))
        window.dispatchEvent(new Event('receipt-deleted'))
      }
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Offline Sync Queue Hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Query hook untuk memantau ringkasan status antrean sync offline (`pending_sync`).
 *
 * @param workspaceId - UUID workspace
 */
export function useSyncQueue(workspaceId?: string | null) {
  return useQuery({
    queryKey: ['syncQueue', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null
      return await syncService.getStatusSummary(workspaceId)
    },
    enabled: Boolean(workspaceId),
    refetchInterval: 5000, // Refetch setiap 5 detik
  })
}

/**
 * Mutation hook untuk pemicu eksekusi antrean pending sync secara manual.
 *
 * @param workspaceId - UUID workspace
 */
export function useTriggerSync(workspaceId?: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error('workspaceId diperlukan')
      return await syncService.processSyncQueue(workspaceId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['syncQueue'] })
    },
  })
}
