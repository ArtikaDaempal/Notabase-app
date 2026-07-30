/**
 * apps/desktop/layout/Sidebar.tsx
 * Sidebar Navigation for Windows Desktop App (220px fixed, collapsible to 64px).
 *
 * Dokumen acuan:
 *   01-architecture.md §4 (Layout Desktop Windows)
 *   02-design-system.md §3.1 & §4 (5 nav items: Dashboard, Scan, History, Export, Settings)
 */

import React from 'react'
import {
  LayoutDashboard,
  History,
  FileSpreadsheet,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { SINGLE_TENANT_WORKSPACE } from '@/shared/config/workspace'
import type { NavTab } from '@/types'

export interface SidebarProps {
  activeTab: NavTab | string
  onTabChange: (tab: NavTab) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  workspaceName?: string
  workspaceCode?: string
  className?: string
}

export const SIDEBAR_NAV_ITEMS: {
  id: NavTab | string
  label: string
  icon: typeof LayoutDashboard
  description: string
}[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Ringkasan & Statistik',
  },
  {
    id: 'history',
    label: 'Arsip Nota',
    icon: History,
    description: 'Kelola & Cari Nota',
  },
  {
    id: 'report',
    label: 'Laporan & Export',
    icon: FileSpreadsheet,
    description: 'Excel & Ringkasan',
  },
  {
    id: 'settings',
    label: 'Pengaturan',
    icon: Settings,
    description: 'Preferensi Aplikasi',
  },
]

export function Sidebar({
  activeTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
  workspaceName = SINGLE_TENANT_WORKSPACE.name,
  workspaceCode = SINGLE_TENANT_WORKSPACE.code,
  className,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        'relative flex flex-col justify-between border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-300 z-20 shrink-0 select-none py-4',
        isCollapsed ? 'w-16' : 'w-64',
        className,
      )}
      aria-label="Navigasi Utama Desktop"
    >
      {/* ── Header / Brand Logo (Matching Mockup Logo) ── */}
      <div>
        <div
          className={cn(
            'pb-4 border-b border-slate-100 dark:border-slate-800',
            isCollapsed ? 'flex flex-col items-center gap-2 px-2' : 'flex items-center justify-between px-4'
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-xs shrink-0 overflow-hidden">
              <Image
                src="/kominfo-logo.png"
                alt="Komdigi Logo"
                width={32}
                height={32}
                className="object-contain w-7 h-7"
              />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <span className="block text-base font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-none">
                  NotaBase
                </span>
                <span className="block text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1">
                  Kelola Nota, Lebih Mudah
                </span>
              </div>
            )}
          </div>

          <button
            onClick={onToggleCollapse}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-xs transition-transform active:scale-95 shrink-0"
            title={isCollapsed ? 'Perluas Sidebar' : 'Ciutkan Sidebar'}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* ── Navigation Links (Matching Mockup Pill Buttons) ── */}
        <nav className="p-3 space-y-1 mt-2">
          {SIDEBAR_NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id || (item.id === 'category' && activeTab === 'history')

            return (
              <button
                key={item.id}
                onClick={() => onTabChange((item.id === 'category' ? 'history' : item.id === 'profile' ? 'settings' : item.id) as NavTab)}
                className={cn(
                  'flex w-full items-center gap-3.5 rounded-xl px-3.5 py-3 text-xs font-semibold transition-all text-left group',
                  isActive
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white',
                  isCollapsed && 'justify-center px-0 py-3',
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 shrink-0 transition-transform group-hover:scale-105',
                    isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300',
                  )}
                />
                {!isCollapsed && (
                  <span className={cn('block truncate text-sm font-semibold', isActive ? 'text-white font-bold' : 'text-slate-700 dark:text-slate-300')}>
                    {item.label}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}

