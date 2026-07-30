'use client'

/**
 * use-sync-engine.ts
 * Handles syncing locally-created/modified receipts to Supabase
 * whenever the app comes back online.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { useNetworkStatus } from './use-network-status'
import {
  getPendingSyncOps,
  getPendingQueueCount,
  dequeueSync,
  localDb,
  type SyncQueueEntry,
} from '@/lib/local-db'
import { uploadOfflineImage } from '@/lib/image-store'

export interface SyncState {
  isSyncing: boolean
  pendingCount: number
  lastSyncAt: Date | null
  lastError: string | null
}

export function useSyncEngine(): SyncState {
  const { isOnline } = useNetworkStatus()
  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const syncingRef = useRef(false)

  // Refresh pending count
  const refreshCount = useCallback(async () => {
    const count = await getPendingQueueCount()
    setPendingCount(count)
  }, [])

  // Process one sync queue entry
  const processEntry = useCallback(async (entry: SyncQueueEntry): Promise<boolean> => {
    try {
      if (entry.operation === 'delete') {
        // Delete from Supabase
        const res = await fetch(`/api/receipts/${entry.payload.supabaseId || entry.localId}`, {
          method: 'DELETE',
        })
        if (!res.ok && res.status !== 404) throw new Error(`Delete failed: ${res.status}`)

        // Also remove the local record
        await localDb.receipts.delete(entry.localId)

      } else if (entry.operation === 'create') {
        const payload = { ...entry.payload } as Record<string, unknown>

        // If there's a pending offline image, upload it first
        if (payload.localImageId && typeof payload.localImageId === 'string') {
          try {
            const cloudUrl = await uploadOfflineImage(payload.localImageId as string)
            payload.imageUrl = cloudUrl
            payload.localImageId = null
          } catch {
            // Image upload failed, keep localImageId and retry next time
            throw new Error('Image upload pending')
          }
        }

        const res = await fetch('/api/receipts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error(`Create failed: ${res.status}`)
        const created = await res.json()

        // Update local record with the real Supabase ID and cloud URL
        await localDb.receipts.update(entry.localId, {
          synced: true,
          supabaseId: created.id,
          imageUrl: created.imageUrl || payload.imageUrl as string | null,
          localImageId: null,
        })

      } else if (entry.operation === 'update') {
        const supabaseId = entry.payload.supabaseId || entry.localId
        const res = await fetch(`/api/receipts/${supabaseId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry.payload),
        })
        if (!res.ok) throw new Error(`Update failed: ${res.status}`)
        await localDb.receipts.update(entry.localId, { synced: true })
      }

      return true
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      // Increment retry count
      if (entry.id !== undefined) {
        await localDb.syncQueue.update(entry.id, {
          retries: (entry.retries || 0) + 1,
          lastError: message,
        })
      }
      return false
    }
  }, [])

  // Main sync routine
  const runSync = useCallback(async () => {
    if (syncingRef.current) return
    const ops = await getPendingSyncOps()
    if (ops.length === 0) return

    syncingRef.current = true
    setIsSyncing(true)
    setLastError(null)
    let allSucceeded = true

    for (const entry of ops) {
      // Skip entries that have failed too many times (max 5 retries)
      if (entry.retries >= 5) continue

      const ok = await processEntry(entry)
      if (ok && entry.id !== undefined) {
        await dequeueSync(entry.id)
      } else {
        allSucceeded = false
      }
    }

    setLastSyncAt(new Date())
    if (!allSucceeded) setLastError('Beberapa item gagal disinkronisasi')
    syncingRef.current = false
    setIsSyncing(false)
    await refreshCount()
  }, [processEntry, refreshCount])

  // Trigger sync whenever we come back online
  useEffect(() => {
    if (isOnline) {
      runSync()
    }
  }, [isOnline, runSync])

  // Refresh count on mount
  useEffect(() => {
    refreshCount()
  }, [refreshCount])

  return { isSyncing, pendingCount, lastSyncAt, lastError }
}
