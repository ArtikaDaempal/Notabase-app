/**
 * apps/mobile/layout/BottomNav.tsx
 * Mobile 5-Item Fixed Bottom Navigation Bar (02-design-system.md §1 & §3.1).
 *
 * Items: Dashboard · Scan · History · Export · Settings.
 */

import React from 'react'
import {
  LayoutDashboard,
  Scan,
  History,
  FileSpreadsheet,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NavTab } from '@/types'

export interface BottomNavProps {
  activeTab: NavTab | string
  onTabChange: (tab: NavTab) => void
  className?: string
}

export const BOTTOM_NAV_ITEMS: {
  id: NavTab
  label: string
  icon: typeof LayoutDashboard
}[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'scan', label: 'Scan', icon: Scan },
  { id: 'history', label: 'Arsip', icon: History },
  { id: 'report', label: 'Export', icon: FileSpreadsheet },
  { id: 'settings', label: 'Pengaturan', icon: Settings },
]

export function BottomNav({ activeTab, onTabChange, className }: BottomNavProps) {
  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg px-2 py-1.5 shadow-lg',
        className,
      )}
      aria-label="Navigasi Bawah Mobile"
    >
      <div className="mx-auto flex max-w-md items-center justify-around">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all',
                isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800',
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-12 items-center justify-center rounded-full transition-colors',
                  isActive ? 'bg-blue-50 dark:bg-blue-950/80' : 'bg-transparent',
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 transition-transform',
                    isActive ? 'scale-110 stroke-[2.5]' : 'stroke-[1.75]',
                  )}
                />
              </div>
              <span
                className={cn(
                  'mt-0.5 text-[10px] tracking-tight leading-none',
                  isActive ? 'font-bold' : 'font-medium',
                )}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
