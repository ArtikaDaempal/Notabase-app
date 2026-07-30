'use client'

/**
 * layout/bottom-nav.tsx
 * Bottom navigation bar — 5 tab tetap sesuai 02-design-system.md §3.1.
 * Tab: Dashboard · Scan · History · Report · Settings
 * Sync status indicator permanen sesuai BR-SYNC-02.
 */

import { useEffect } from 'react'
import { Home, Folder, Plus, BarChart2, Settings } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import type { NavTab } from '@/types'
import { cn } from '@/lib/utils'
import { initOnlineWatcher } from '@/lib/sync-service'
import { SyncIndicator } from '@/components/ui/sync-indicator'

const tabs: { id: NavTab; label: string; icon: typeof Home; isCenter?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'history',   label: 'Arsip',     icon: Folder },
  { id: 'scan',      label: '',          icon: Plus, isCenter: true },
  { id: 'report',    label: 'Laporan',   icon: BarChart2 },
  { id: 'settings',  label: 'Pengaturan', icon: Settings },
]

const MAIN_TABS: NavTab[] = ['dashboard', 'scan', 'history', 'report', 'settings']

export function BottomNav() {
  const { activeTab, setTab, view } = useAppStore()

  useEffect(() => {
    const cleanup = initOnlineWatcher()
    return cleanup
  }, [])

  if (!MAIN_TABS.includes(view as NavTab)) return null

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t border-slate-100 bg-white/95 backdrop-blur-lg pb-2 shadow-lg"
      aria-label="Navigasi utama"
    >
      <div className="mx-auto w-full max-w-7xl px-2 sm:px-6">
        <div className="mx-auto grid max-w-md grid-cols-5 items-center">
          {tabs.map((tab) => {
            const active = activeTab === tab.id
            const Icon = tab.icon

            if (tab.isCenter) {
              return (
                <div key={tab.id} className="flex justify-center -mt-5">
                  <button
                    id={`nav-tab-${tab.id}`}
                    onClick={() => setTab(tab.id)}
                    className="flex h-13 w-13 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/40 active:scale-95 transition-transform"
                    aria-label="Scan Nota Baru"
                  >
                    <Plus className="h-7 w-7 stroke-[2.5]" />
                  </button>
                </div>
              )
            }

            return (
              <button
                key={tab.id}
                id={`nav-tab-${tab.id}`}
                onClick={() => setTab(tab.id)}
                className="flex flex-col items-center justify-center gap-1 py-2 px-1 transition-colors"
                aria-label={tab.label}
                aria-current={active ? 'page' : undefined}
              >
                <div className="relative flex items-center justify-center">
                  <Icon className={cn('h-5 w-5 transition-colors', active ? 'text-blue-600' : 'text-slate-400')} strokeWidth={active ? 2.5 : 2} />
                  {tab.id === 'history' && <SyncIndicator variant="nav" />}
                </div>
                <span
                  className={cn(
                    'text-[10px] font-semibold leading-none',
                    active ? 'text-blue-600 font-bold' : 'text-slate-400'
                  )}
                >
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

