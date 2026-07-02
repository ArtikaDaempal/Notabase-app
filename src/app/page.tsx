'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '@/store/app-store'
import { BottomNav } from '@/components/layout/bottom-nav'
import { SplashScreen } from '@/components/features/splash/splash-screen'
import { DashboardView } from '@/components/features/dashboard/dashboard-view'
import { ScanView } from '@/components/features/scan/scan-view'
import { OcrPreviewView } from '@/components/features/ocr/ocr-preview-view'
import { HistoryView } from '@/components/features/history/history-view'
import { DetailView } from '@/components/features/detail/detail-view'
import { ReportView } from '@/components/features/report/report-view'
import { OnedriveView } from '@/components/features/onedrive/onedrive-view'
import { SettingsView } from '@/components/features/settings/settings-view'

export default function Home() {
  const view = useAppStore((s) => s.view)
  const [seeded, setSeeded] = useState(false)

  // Seed demo data once on first load
  useEffect(() => {
    fetch('/api/seed', { method: 'POST' })
      .then(() => setSeeded(true))
      .catch(() => setSeeded(true))
  }, [])

  if (!seeded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {view === 'splash' && <SplashScreen />}
          {view === 'dashboard' && <DashboardView />}
          {view === 'scan' && <ScanView />}
          {view === 'ocr-preview' && <OcrPreviewView />}
          {view === 'history' && <HistoryView />}
          {view === 'detail' && <DetailView />}
          {view === 'report' && <ReportView />}
          {view === 'onedrive' && <OnedriveView />}
          {view === 'settings' && <SettingsView />}
        </motion.div>
      </AnimatePresence>

      <BottomNav />
    </div>
  )
}
