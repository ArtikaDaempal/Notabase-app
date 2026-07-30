'use client'

/**
 * network-status-bar.tsx
 * A slim banner at the top of the screen showing online/offline/syncing state.
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react'
import { useNetworkStatus } from '@/hooks/use-network-status'
import { useSyncEngine } from '@/hooks/use-sync-engine'
import { cn } from '@/lib/utils'

export function NetworkStatusBar() {
  const { isOnline, wasOffline } = useNetworkStatus()
  const { isSyncing, pendingCount } = useSyncEngine()
  const [visible, setVisible] = useState(false)

  // Show bar whenever offline, syncing, or just came back online
  useEffect(() => {
    if (!isOnline || isSyncing || wasOffline) {
      setVisible(true)
    } else {
      // Hide after short delay when back online and synced
      const t = setTimeout(() => setVisible(false), 3000)
      return () => clearTimeout(t)
    }
  }, [isOnline, isSyncing, wasOffline])

  const mode: 'offline' | 'syncing' | 'online' =
    !isOnline ? 'offline' : isSyncing ? 'syncing' : 'online'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="network-bar"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden"
        >
          <div
            className={cn(
              'flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-semibold',
              mode === 'offline' && 'bg-red-500 text-white',
              mode === 'syncing' && 'bg-amber-500 text-white',
              mode === 'online'  && 'bg-emerald-500 text-white'
            )}
          >
            {mode === 'offline' && (
              <>
                <WifiOff className="h-3.5 w-3.5 shrink-0" />
                <span>Mode Offline — data disimpan lokal, akan disinkronisasi saat online</span>
              </>
            )}
            {mode === 'syncing' && (
              <>
                <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
                <span>
                  Menyinkronisasi{pendingCount > 0 ? ` ${pendingCount} nota` : ''}...
                </span>
              </>
            )}
            {mode === 'online' && (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>Kembali online — semua data tersinkronisasi</span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Compact offline badge for use inside cards / scan view.
 */
export function OfflineBadge({ className }: { className?: string }) {
  const { isOnline } = useNetworkStatus()
  if (isOnline) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600',
        className
      )}
    >
      <WifiOff className="h-3 w-3" />
      Offline
    </span>
  )
}

/**
 * Small "Lokal" badge for receipts not yet synced to cloud.
 */
export function LocalBadge({ synced, className }: { synced: boolean; className?: string }) {
  if (synced) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700',
        className
      )}
    >
      <Wifi className="h-3 w-3" />
      Lokal
    </span>
  )
}
