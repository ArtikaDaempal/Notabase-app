'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '@/store/app-store'
import { useWorkspaceStore } from '@/store/workspace-store'
import { useIsDesktop } from '@/hooks/use-responsive'
import dynamic from 'next/dynamic'
import { SINGLE_TENANT_WORKSPACE } from '@/shared/config/workspace'
import { isDeviceUnlocked } from '@/shared/services/deviceGate'
import { InviteGate } from '@/packages/ui-shared/InviteGate'
import { NetworkStatusBar } from '@/components/ui/network-status-bar'
import type { NavTab } from '@/types'

// Dynamic imports for view components (Code-Splitting for fast initial page load)
const Sidebar = dynamic(() => import('@/apps/desktop/layout/Sidebar').then((m) => m.Sidebar))
const TopBar = dynamic(() => import('@/apps/desktop/layout/TopBar').then((m) => m.TopBar))
const ArsipDesktopPage = dynamic(() => import('@/apps/desktop/pages/ArsipDesktopPage').then((m) => m.ArsipDesktopPage))
const BottomNav = dynamic(() => import('@/components/layout/bottom-nav').then((m) => m.BottomNav))
const SplashScreen = dynamic(() => import('@/components/features/splash/splash-screen').then((m) => m.SplashScreen))
const DashboardView = dynamic(() => import('@/components/features/dashboard/dashboard-view').then((m) => m.DashboardView))
const ScanView = dynamic(() => import('@/components/features/scan/scan-view').then((m) => m.ScanView))
const OcrPreviewView = dynamic(() => import('@/components/features/ocr/ocr-preview-view').then((m) => m.OcrPreviewView))
const HistoryView = dynamic(() => import('@/components/features/history/history-view').then((m) => m.HistoryView))
const DetailView = dynamic(() => import('@/components/features/detail/detail-view').then((m) => m.DetailView))
const ReportView = dynamic(() => import('@/components/features/report/report-view').then((m) => m.ReportView))
const OnedriveView = dynamic(() => import('@/components/features/onedrive/onedrive-view').then((m) => m.OnedriveView))
const UploadProgressView = dynamic(() => import('@/components/features/onedrive/upload-progress-view').then((m) => m.UploadProgressView))
const SettingsView = dynamic(() => import('@/components/features/settings/settings-view').then((m) => m.SettingsView))
const SearchView = dynamic(() => import('@/components/features/search/search-view').then((m) => m.SearchView))
const GalleryView = dynamic(() => import('@/components/features/gallery/gallery-view').then((m) => m.GalleryView))

export default function Home() {
  const view = useAppStore((s) => s.view)
  const activeTab = useAppStore((s) => s.activeTab)
  const navigate = useAppStore((s) => s.navigate)
  const setTab = useAppStore((s) => s.setTab)
  const openReceipt = useAppStore((s) => s.openReceipt)
  const setLanguage = useAppStore((s) => s.setLanguage)

  const isSetupComplete = useWorkspaceStore((s) => s.isSetupComplete)
  const workspaceName = SINGLE_TENANT_WORKSPACE.name
  const workspaceCode = SINGLE_TENANT_WORKSPACE.code
  const workspaceId = SINGLE_TENANT_WORKSPACE.id

  const isDesktop = useIsDesktop(768)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState<boolean | null>(null)

  useEffect(() => {
    setIsUnlocked(isDeviceUnlocked())
  }, [])

  // Redirect workspace-setup view straight to dashboard
  useEffect(() => {
    if (view === 'workspace-setup') {
      navigate('dashboard')
    }
  }, [view, navigate])

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d.language) setLanguage(d.language)
      })
      .catch((err) => console.error('Failed to load initial settings:', err))
  }, [setLanguage])

  // If gate status is not loaded yet (SSR hydration)
  if (isUnlocked === null) {
    return (
      <div className="min-h-screen bg-[#F4F7FC] dark:bg-slate-950 flex items-center justify-center">
        <NetworkStatusBar />
      </div>
    )
  }

  // Render Invite Gate if device/workspace is not unlocked
  if (!isUnlocked) {
    return <InviteGate onSuccess={() => setIsUnlocked(true)} />
  }

  if (view === 'splash') {
    return (
      <div className="min-h-screen bg-background">
        <NetworkStatusBar />
        <SplashScreen />
      </div>
    )
  }

  // DESKTOP LAYOUT (Laptop / PC)
  if (isDesktop) {
    if (view === 'history') {
      return (
        <div className="min-h-screen bg-background">
          <NetworkStatusBar />
          <ArsipDesktopPage
            workspaceId={workspaceId}
            workspaceName={workspaceName}
            workspaceCode={workspaceCode}
            onNavigateTab={(tab) => setTab(tab)}
            onOpenDetail={(id) => openReceipt(id)}
            onAddNewReceipt={() => setTab('scan')}
          />
        </div>
      )
    }

    return (
      <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFF] dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100">
        <NetworkStatusBar />
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => setTab(tab as NavTab)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
          workspaceName={workspaceName}
          workspaceCode={workspaceCode}
        />

        {/* Desktop Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0 bg-[#F8FAFF] dark:bg-slate-950">
          <TopBar
            title={
              view === 'dashboard' ? 'Dashboard Utama' :
              view === 'scan' ? 'Scan & Input Nota' :
              view === 'ocr-preview' ? 'Pratinjau Hasil OCR' :
              view === 'detail' ? 'Rincian Detail Nota' :
              view === 'report' ? 'Laporan & Ekspor Data' :
              view === 'settings' ? 'Pengaturan Aplikasi' :
              view === 'onedrive' ? 'Backup & Sinkronisasi' :
              view === 'gallery' ? 'Arsip Gambar Struk' : 'Notabase Desktop'
            }
            isOnline={true}
            workspaceName={workspaceName}
          />

          <main className="flex-1 overflow-y-auto p-0 bg-[#F8FAFF] dark:bg-slate-950">
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="mx-auto w-full max-w-7xl"
              >
                {view === 'dashboard' && <DashboardView />}
                {view === 'scan' && <ScanView />}
                {view === 'ocr-preview' && <OcrPreviewView />}
                {view === 'detail' && <DetailView />}
                {view === 'report' && <ReportView />}
                {view === 'onedrive' && <OnedriveView />}
                {view === 'upload-progress' && <UploadProgressView />}
                {view === 'settings' && <SettingsView />}
                {view === 'search' && <SearchView />}
                {view === 'gallery' && <GalleryView />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    )
  }

  // MOBILE LAYOUT (HP / Tablet)
  return (
    <div className="min-h-screen bg-background">
      <NetworkStatusBar />
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {view === 'dashboard' && <DashboardView />}
          {view === 'scan' && <ScanView />}
          {view === 'ocr-preview' && <OcrPreviewView />}
          {view === 'history' && <HistoryView />}
          {view === 'detail' && <DetailView />}
          {view === 'report' && <ReportView />}
          {view === 'onedrive' && <OnedriveView />}
          {view === 'upload-progress' && <UploadProgressView />}
          {view === 'settings' && <SettingsView />}
          {view === 'search' && <SearchView />}
          {view === 'gallery' && <GalleryView />}
        </motion.div>
      </AnimatePresence>

      <BottomNav />
    </div>
  )
}
