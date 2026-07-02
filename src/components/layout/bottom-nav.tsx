'use client'

import { LayoutDashboard, ScanLine, History, Settings } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import type { NavTab } from '@/types'
import { cn } from '@/lib/utils'

const tabs: { id: NavTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'scan', label: 'Scan', icon: ScanLine },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function BottomNav() {
  const { activeTab, setTab, view } = useAppStore()
  // Only show on main tabs
  const mainTabs: NavTab[] = ['dashboard', 'scan', 'history', 'settings']
  if (!mainTabs.includes(view as NavTab)) return null

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto w-full max-w-7xl px-2 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {tabs.map((tab) => {
            const active = activeTab === tab.id && view === tab.id
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className="flex flex-col items-center justify-center gap-1 py-2.5 px-1 transition-colors"
                aria-label={tab.label}
                aria-current={active ? 'page' : undefined}
              >
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl transition-all',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
                      : 'text-muted-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                </div>
                <span
                  className={cn(
                    'text-[11px] font-medium leading-none',
                    active ? 'text-primary' : 'text-muted-foreground'
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
