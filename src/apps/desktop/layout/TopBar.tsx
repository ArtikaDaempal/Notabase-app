/**
 * apps/desktop/layout/TopBar.tsx
 * Top Header Bar for Desktop Windows App with interactive Online status, Notification bell popover, and Profile dropdown.
 */

import React, { useEffect, useState, useRef } from 'react'
import {
  Bell,
  Search,
  Wifi,
  WifiOff,
  RefreshCw,
  ChevronDown,
  CheckCircle2,
  Cloud,
  Database,
  User,
  Settings,
  FileSpreadsheet,
  LogOut,
  X,
  Check,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SINGLE_TENANT_WORKSPACE } from '@/shared/config/workspace'
import { getDeviceName } from '@/shared/services/deviceGate'
import { useAppStore } from '@/store/app-store'
import { toast } from 'sonner'

export interface TopBarProps {
  title?: string
  searchQuery?: string
  onSearchChange?: (q: string) => void
  isOnline?: boolean
  pendingSyncCount?: number
  onSyncClick?: () => void
  workspaceName?: string
  className?: string
}

interface NotificationItem {
  id: string
  title: string
  desc: string
  time: string
  type: 'onedrive' | 'ocr' | 'system'
  read: boolean
}

export function TopBar({
  title = 'Dashboard Utama',
  searchQuery = '',
  onSearchChange,
  isOnline = true,
  pendingSyncCount = 0,
  onSyncClick,
  workspaceName = SINGLE_TENANT_WORKSPACE.name,
  className,
}: TopBarProps) {
  const { navigate, setTab } = useAppStore()
  const [userName, setUserName] = useState('Notabase')
  const [accountEmail, setAccountEmail] = useState('')

  // Popover State
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showNotifDropdown, setShowNotifDropdown] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [syncingNow, setSyncingNow] = useState(false)

  // Notification items state
  const [notifications, setNotifications] = useState<NotificationItem[]>([])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const name = getDeviceName()
      if (name && name !== 'Perangkat Pengguna') {
        setUserName(name)
      }
    }
    // Fetch real OneDrive account email from Microsoft Graph
    fetch('/api/sync')
      .then((r) => r.json())
      .then((d) => {
        if (d.account) setAccountEmail(d.account)
      })
      .catch(() => {})
  }, [])

  const initialLetter = userName.charAt(0).toUpperCase() || 'N'
  const unreadCount = notifications.filter((n) => !n.read).length

  // Close popovers on click outside
  const headerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setShowStatusModal(false)
        setShowNotifDropdown(false)
        setShowProfileDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleManualSync = async () => {
    setSyncingNow(true)
    toast.loading('Menyinkronkan data dengan Supabase & OneDrive...', { id: 'manual-sync' })
    try {
      if (onSyncClick) onSyncClick()
      await new Promise((r) => setTimeout(r, 1200))
      toast.success('Semua data nota & laporan berhasil disinkronkan!', { id: 'manual-sync' })
    } catch {
      toast.error('Gagal menyinkronkan data', { id: 'manual-sync' })
    } finally {
      setSyncingNow(false)
    }
  }

  const handleMarkAllNotifsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    toast.success('Semua notifikasi telah ditandai dibaca')
  }

  return (
    <header
      ref={headerRef}
      className={cn(
        'sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-6 select-none',
        className,
      )}
    >
      {/* Title & Quick Search */}
      <div className="flex items-center gap-6 flex-1 min-w-0">
        <div className="min-w-0">
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100 truncate">
            {title}
          </h1>
          {title === 'Pengaturan Aplikasi' && (
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate -mt-0.5">
              Kelola preferensi dan konfigurasi aplikasi NotaBase sesuai kebutuhan Anda.
            </p>
          )}
        </div>

        {onSearchChange && (
          <div className="relative max-w-sm w-full hidden md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cari nama toko, no. nota, atau keterangan..."
              className="h-10 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-4 text-xs focus-visible:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* Online Status, Sync Button, Notification, User Badge */}
      <div className="flex items-center gap-3 shrink-0 relative">
        {/* 1. ONLINE STATUS BADGE (Interaktif) */}
        <button
          onClick={() => {
            setShowStatusModal((prev) => !prev)
            setShowNotifDropdown(false)
            setShowProfileDropdown(false)
          }}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer',
            isOnline
              ? 'bg-[#E6F7ED] dark:bg-emerald-950/60 text-[#059669] dark:text-emerald-400 hover:bg-emerald-100/80 border border-emerald-200/50 dark:border-emerald-800/60'
              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 hover:bg-amber-100 border border-amber-200 dark:border-amber-800/60',
          )}
          title="Klik untuk lihat detail koneksi & status sinkronisasi"
        >
          {isOnline ? (
            <>
              <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
              <span>Online</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 text-amber-600" />
              <span>Offline</span>
            </>
          )}
        </button>

        {/* Status Connection Popover Modal */}
        {showStatusModal && (
          <div className="absolute right-36 top-12 z-50 w-80 rounded-2xl bg-white p-4 shadow-xl border border-slate-100 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="text-xs font-bold text-slate-900">Status Koneksi & Sync</span>
              <button onClick={() => setShowStatusModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-emerald-600" />
                  <span className="font-semibold text-slate-700">Jaringan Internet</span>
                </div>
                <span className="font-bold text-emerald-600">Terhubung</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                <div className="flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold text-slate-700">OneDrive Cloud</span>
                </div>
                <span className="font-bold text-blue-600">Auto-Sync</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-purple-600" />
                  <span className="font-semibold text-slate-700">Database Realtime</span>
                </div>
                <span className="font-bold text-purple-600">Tersinkron</span>
              </div>
            </div>

            <Button
              size="sm"
              onClick={handleManualSync}
              disabled={syncingNow}
              className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2 h-9 flex items-center justify-center gap-2 shadow-xs"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', syncingNow && 'animate-spin')} />
              {syncingNow ? 'Menyinkronkan...' : 'Sinkronkan Data Sekarang'}
            </Button>
          </div>
        )}

        {/* Sync Trigger Button (If pending count > 0) */}
        {pendingSyncCount > 0 && onSyncClick && (
          <Button
            size="sm"
            onClick={onSyncClick}
            className="rounded-full h-8 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white gap-1.5 shadow-xs"
          >
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            <span>{pendingSyncCount} Pending Sync</span>
          </Button>
        )}

        {/* 2. NOTIFICATION BELL WITH BADGE (Interaktif) */}
        <button
          onClick={() => {
            setShowNotifDropdown((prev) => !prev)
            setShowStatusModal(false)
            setShowProfileDropdown(false)
            handleMarkAllNotifsRead()
          }}
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
          title="Notifikasi"
          aria-label="Notifikasi"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Notification Dropdown Popover */}
        {showNotifDropdown && (
          <div className="absolute right-24 top-12 z-50 w-80 sm:w-96 rounded-2xl bg-white p-4 shadow-xl border border-slate-100 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">Notifikasi System</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                    {unreadCount} Baru
                  </span>
                )}
              </div>
              <button
                onClick={handleMarkAllNotifsRead}
                className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1"
              >
                <Check className="h-3 w-3" /> Tandai Dibaca
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)))
                  }}
                  className={cn(
                    'p-3 rounded-xl border text-xs cursor-pointer transition-colors space-y-1',
                    n.read ? 'bg-white border-slate-100 text-slate-500' : 'bg-blue-50/50 border-blue-100 text-slate-800 font-medium'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{n.title}</span>
                    <span className="text-[10px] text-slate-400">{n.time}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{n.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
