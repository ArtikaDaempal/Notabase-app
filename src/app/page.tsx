'use client'

import { useEffect, useRef } from 'react'
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
  const seededRef = useRef(false)

  // Seed demo data once on first load - runs in background during splash
  useEffect(() => {
    if (seededRef.current) return
    seededRef.current = true
    fetch('/api/seed', { method: 'POST' }).catch(() => {})
  }, [])

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
