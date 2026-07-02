'use client'

import { ArrowLeft, Bell } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { NotabaseWordmark } from '@/components/layout/logo'
import { cn } from '@/lib/utils'

interface AppHeaderProps {
  title?: string
  subtitle?: string
  showBack?: boolean
  showLogo?: boolean
  rightAction?: React.ReactNode
  backTo?: 'dashboard' | 'history' | 'settings'
}

export function AppHeader({
  title,
  subtitle,
  showBack = false,
  showLogo = true,
  rightAction,
}: AppHeaderProps) {
  const goBack = useAppStore((s) => s.goBack)

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-card/80 backdrop-blur-lg">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {showBack ? (
            <button
              onClick={goBack}
              className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent"
              aria-label="Kembali"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : showLogo ? (
            <NotabaseWordmark />
          ) : (
            <div className="w-9" />
          )}

          {title && (
            <div className={cn('text-center', showBack && 'flex-1')}>
              <h1 className="text-base font-bold text-foreground">{title}</h1>
              {subtitle && (
                <p className="text-[11px] text-muted-foreground">{subtitle}</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-1">
            {rightAction ?? (
              <button
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent"
                aria-label="Notifikasi"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-destructive" />
              </button>
            )}
          </div>
        </div>
        {title && subtitle && !showBack && (
          <div className="pb-3">
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        )}
      </div>
    </header>
  )
}
