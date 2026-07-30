'use client'

/**
 * components/ui/sync-indicator.tsx
 * Indikator status sinkronisasi — tampil permanen di header & bottom-nav.
 * Sesuai 02-design-system.md §3.8 & 03-business-rules.md BR-SYNC-02.
 *
 * Menampilkan:
 * - 🟢 dot hijau = online, semua tersync
 * - 🟡 badge kuning + angka = ada pending sync
 * - 🔴 dot merah = offline
 */

import { useEffect, useState } from 'react'
import { Cloud, CloudOff, CloudUpload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { watchOnlineStatus, watchPendingCount, isOnline, getPendingCount } from '@/lib/sync-service'

interface SyncIndicatorProps {
  variant?: 'header' | 'nav'  // header = full pill, nav = icon saja
  className?: string
}

export function SyncIndicator({ variant = 'header', className }: SyncIndicatorProps) {
  const [online, setOnline] = useState(isOnline())
  const [pending, setPending] = useState(getPendingCount())

  useEffect(() => {
    const unsubOnline = watchOnlineStatus(setOnline)
    const unsubPending = watchPendingCount(setPending)
    return () => {
      unsubOnline()
      unsubPending()
    }
  }, [])

  // Hitung state gabungan
  const state: 'offline' | 'pending' | 'synced' = !online
    ? 'offline'
    : pending > 0
    ? 'pending'
    : 'synced'

  if (variant === 'nav') {
    return (
      <span
        className={cn(
          'absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white',
          state === 'synced' ? 'bg-emerald-500' :
          state === 'pending' ? 'bg-amber-400' :
          'bg-red-500',
          className
        )}
        title={
          state === 'synced' ? 'Semua data tersync' :
          state === 'pending' ? `${pending} nota menunggu sinkronisasi` :
          'Tidak ada koneksi'
        }
      />
    )
  }

  // variant === 'header'
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all',
        state === 'synced'
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : state === 'pending'
          ? 'bg-amber-50 text-amber-700 border border-amber-200'
          : 'bg-red-50 text-red-600 border border-red-200',
        className
      )}
      title={
        state === 'synced' ? 'Semua data tersinkronisasi' :
        state === 'pending' ? `${pending} nota menunggu sinkronisasi` :
        'Tidak ada koneksi internet'
      }
    >
      {state === 'synced' && <Cloud className="h-3 w-3" />}
      {state === 'pending' && <CloudUpload className="h-3 w-3 animate-pulse" />}
      {state === 'offline' && <CloudOff className="h-3 w-3" />}

      <span>
        {state === 'synced' && 'Tersync'}
        {state === 'pending' && `${pending} pending`}
        {state === 'offline' && 'Offline'}
      </span>
    </div>
  )
}
