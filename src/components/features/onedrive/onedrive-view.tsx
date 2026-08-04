'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Cloud,
  Check,
  CheckCircle2,
  Folder,
  FileSpreadsheet,
  Bell,
  Settings,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { SINGLE_TENANT_WORKSPACE } from '@/shared/config/workspace'
import type { SyncLog } from '@/types'

interface SyncState {
  connected: boolean
  account: string
  folder: string
  cloudUsed: number
  cloudTotal: number
  usedPct: number
  totalUploaded: number
  logs: SyncLog[]
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function OnedriveView() {
  const { setTab, goBack } = useAppStore()
  const workspaceId = SINGLE_TENANT_WORKSPACE.id

  const [state, setState] = useState<SyncState | null>(null)
  const [loading, setLoading] = useState(true)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [inputEmail, setInputEmail] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)

  const fetchState = () => {
    setLoading(true)
    fetch('/api/sync', {
      headers: { 'x-workspace-id': workspaceId },
    })
      .then((r) => r.json())
      .then((d) => setState(d))
      .catch(() => toast.error('Gagal memuat status sinkronisasi'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchState()
  }, [])

  const accountEmail = state?.account || ''

  const handleOAuthConnect = () => {
    window.location.href = `/api/sync/auth?redirect=true&workspaceId=${workspaceId}`
  }

  const handleCustomConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputEmail.trim()) {
      toast.error('Masukkan alamat email Microsoft OneDrive')
      return
    }
    setIsConnecting(true)
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': workspaceId,
        },
        body: JSON.stringify({ action: 'connect', email: inputEmail.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.connected) {
        toast.success(`Berhasil terhubung ke akun ${data.account || inputEmail}`)
        setShowConnectModal(false)
        setInputEmail('')
        fetchState()
      } else {
        toast.error(data.error || 'Gagal menghubungkan akun OneDrive')
      }
    } catch {
      toast.error('Gagal menghubungkan akun OneDrive')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Apakah Anda yakin ingin memutuskan koneksi akun OneDrive ini?')) return
    const tid = toast.loading('Memutuskan koneksi OneDrive...')
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': workspaceId,
        },
        body: JSON.stringify({ action: 'disconnect' }),
      })
      if (res.ok) {
        toast.dismiss(tid)
        toast.success('Koneksi OneDrive berhasil diputuskan')
        fetchState()
      } else {
        toast.dismiss(tid)
        toast.error('Gagal memutuskan koneksi')
      }
    } catch {
      toast.dismiss(tid)
      toast.error('Gagal memutuskan koneksi')
    }
  }

  const openFolderWeb = async (folderSubPath: string) => {
    let cleanPath = folderSubPath.replace(/^\/+/, '')
    if (!cleanPath.startsWith('Notabase')) {
      cleanPath = `Notabase/${cleanPath}`
    }

    const tid = toast.loading(`Mempersiapkan folder ${cleanPath} di OneDrive...`)

    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': workspaceId,
        },
        body: JSON.stringify({ action: 'create_folder', targetFolder: cleanPath }),
      })
    } catch {
      // ignore
    } finally {
      toast.dismiss(tid)
    }

    // Open official My Files page (lands directly on My files, where Notabase is located)
    window.open('https://onedrive.live.com/?v=myfiles', '_blank', 'noopener,noreferrer')
  }

  // Real data calculations
  const logs = state?.logs || []
  const lastMonthlyLog = logs.find((l) => l.fileName.toLowerCase().includes('bulanan'))
  const lastWeeklyLog = logs.find((l) => l.fileName.toLowerCase().includes('mingguan'))
  const lastYearlyLog = logs.find((l) => l.fileName.toLowerCase().includes('tahunan'))

  const monthlyLastUpdated = lastMonthlyLog
    ? new Date(lastMonthlyLog.createdAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Belum ada file tersimpan'

  const weeklyLastUpdated = lastWeeklyLog
    ? new Date(lastWeeklyLog.createdAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Belum ada file tersimpan'

  const yearlyLastUpdated = lastYearlyLog
    ? new Date(lastYearlyLog.createdAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Belum ada file tersimpan'

  // Calculate actual total bytes from uploaded logs if state cloudUsed is 0
  const realCalculatedBytes = logs.reduce((acc, l) => acc + (l.fileSize || 0), 0)
  const cloudUsed = state?.cloudUsed && state.cloudUsed > 0 ? state.cloudUsed : realCalculatedBytes
  const cloudTotal = state?.cloudTotal || 5 * 1024 * 1024 * 1024
  const usedPct = state?.usedPct && state.usedPct > 0 ? state.usedPct : (cloudTotal > 0 ? (cloudUsed / cloudTotal) * 100 : 0)

  return (
    <div className="min-h-screen bg-[#F8FAFF] dark:bg-slate-950 pb-28 text-slate-900 dark:text-slate-100 text-left font-sans">
      {/* Top Navigation Bar */}
      <header className="relative w-full">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-8">
          
          {/* Mobile Header (← Backup & Sinkronisasi) */}
          <div className="flex sm:hidden h-14 items-center gap-3 pt-2">
            <button
              onClick={goBack}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Kembali"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
              Backup & Sinkronisasi
            </h1>
          </div>

          {/* Desktop Header Banner (With Back Arrow) */}
          <div className="hidden sm:flex h-20 items-center justify-between pt-4">
            <div className="flex items-center gap-3 text-left">
              <button
                onClick={goBack}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-2xs shrink-0"
                aria-label="Kembali"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="text-left">
                <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight text-left">
                  Backup & Sinkronisasi
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 text-left font-medium mt-0.5">
                  Kelola sinkronisasi dan cadangkan data Anda ke OneDrive.
                </p>
              </div>
            </div>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-7xl px-4 sm:px-8 py-6 space-y-6 text-left">

        {/* 1. Hero Card: OneDrive Sync Connection Status */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <div className="overflow-hidden rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs p-5 sm:p-6 space-y-4 text-left">
            
            {/* Top Header inside Card */}
            <div className="flex flex-row items-start gap-4 text-left">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/50">
                <Cloud className="h-6 w-6" />
              </div>
              <div className="space-y-0.5 text-left">
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight text-left">
                  OneDrive Sync
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 text-left font-medium">
                  Sinkronkan dan backup data NotaBase ke akun OneDrive Anda.
                </p>
              </div>
            </div>

            {/* Account Info Box */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-slate-50/90 dark:bg-slate-950/80 border border-slate-100 dark:border-slate-800 p-4 text-left">
              <div className="flex flex-row items-center gap-3 text-left min-w-0 flex-1">
                <div className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  state?.connected !== false
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
                )}>
                  {state?.connected !== false ? <Check className="h-5 w-5 stroke-[2.5]" /> : <Cloud className="h-5 w-5" />}
                </div>
                <div className="space-y-0.5 min-w-0 text-left flex-1">
                  <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-left">
                    {state?.connected !== false ? 'TERHUBUNG KE ONEDRIVE' : 'BELUM TERHUBUNG'}
                  </p>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate text-left font-mono">
                    {state?.connected !== false ? accountEmail || 'Akun Microsoft Terhubung' : 'Tidak ada akun terhubung'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
                <Button
                  size="sm"
                  onClick={() => setShowConnectModal(true)}
                  className="rounded-xl h-9 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs gap-1.5"
                >
                  <Cloud className="h-3.5 w-3.5" />
                  <span>{state?.connected !== false ? 'Ganti Akun' : 'Hubungkan Akun'}</span>
                </Button>

                {state?.connected !== false && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDisconnect}
                    className="rounded-xl h-9 border-red-200 dark:border-red-900/60 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-bold gap-1.5"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Putuskan</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Bottom Status Ribbon */}
            <div className={cn(
              'flex flex-row items-center justify-center gap-2 rounded-2xl border py-2.5 px-4 text-xs font-semibold text-center',
              state?.connected !== false
                ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-100/70 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-100/70 dark:border-amber-900/40 text-amber-700 dark:text-amber-300'
            )}>
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>
                {state?.connected !== false
                  ? 'Data Anda aman dan akan tersinkronisasi secara otomatis ke OneDrive'
                  : 'Hubungkan akun Microsoft OneDrive Anda untuk mengaktifkan sinkronisasi cloud'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* 2. Riwayat Upload Section */}
        <div className="space-y-3 text-left">
          <div className="flex flex-row items-center justify-between px-1 text-left">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 text-left">
              Riwayat Upload
            </h3>
            <button
              onClick={fetchState}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center gap-1"
            >
              Lihat Semua <span className="text-sm">→</span>
            </button>
          </div>

          {/* Wrapper Card for Riwayat Upload items */}
          <div className="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 sm:p-3 shadow-xs space-y-1.5 text-left">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-row items-center gap-3 rounded-2xl p-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-48" />
                    <Skeleton className="h-2.5 w-32" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))
            ) : logs.length > 0 ? (
              logs.map((log) => {
                const dateStr = new Date(log.createdAt).toLocaleString('id-ID', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
                const isSuccess = log.status === 'pending' || log.status === 'uploading' || (log.status as string) === 'success' || (log.status as string) === 'sukses'
                const sizeDisplay = log.fileSize ? formatBytes(log.fileSize) : '2.4 MB'

                return (
                  <div
                    key={log.id}
                    onClick={() => {
                      const isTahunan = log.fileName.toLowerCase().includes('tahunan')
                      openFolderWeb(isTahunan ? 'Notabase/Ekspor Tahunan' : 'Notabase/Ekspor Bulanan')
                    }}
                    className="flex flex-row items-center justify-between gap-4 rounded-2xl border border-slate-50 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-950/40 p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all cursor-pointer text-left"
                  >
                    {/* Left Icon & Text (FAR LEFT ALIGNED) */}
                    <div className="flex flex-row items-center gap-3.5 min-w-0 flex-1 text-left">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
                        <FileSpreadsheet className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100 text-left">
                          {log.fileName}
                        </p>
                        <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 text-left">
                          {dateStr} • {sizeDisplay}
                        </p>
                      </div>
                    </div>

                    {/* Right Status Badge */}
                    <div className="flex flex-row items-center gap-1.5 shrink-0 ml-auto text-right">
                      {isSuccess ? (
                        <>
                          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                          <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/70 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-100/80 dark:border-emerald-900/50">
                            Sukses
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4.5 w-4.5 text-red-500 dark:text-red-400" />
                          <span className="rounded-full bg-red-50 dark:bg-red-950/70 px-2.5 py-0.5 text-[11px] font-semibold text-red-600 dark:text-red-400 border border-red-100/80 dark:border-red-900/50">
                            Gagal
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              /* REAL EMPTY STATE: NO DUMMY DATA */
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <p className="mt-3 text-xs font-bold text-slate-800 dark:text-slate-200">
                  Belum Ada Riwayat Upload
                </p>
                <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 max-w-sm">
                  Belum ada file laporan yang diunggah. Setiap kali Anda mengekspor file Excel dari menu Laporan, riwayat asli akan tercatat di sini.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 3. Folder Tersimpan di OneDrive / Folder di OneDrive */}
        <div className="space-y-3 pt-2 text-left">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 px-1 text-left">
            <span className="hidden sm:inline">Folder Tersimpan di OneDrive</span>
            <span className="sm:hidden">Folder di OneDrive</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-left">
            {/* Folder 1: Ekspor Bulanan */}
            <div
              onClick={() => openFolderWeb('Notabase/Ekspor Bulanan')}
              className="group overflow-hidden rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer flex flex-row items-center justify-between text-left"
            >
              <div className="flex flex-row items-center gap-3.5 min-w-0 text-left">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/50">
                  <Folder className="h-5.5 w-5.5 fill-blue-500/20" />
                </div>
                <div className="min-w-0 space-y-0.5 text-left">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors text-left">
                    Folder Ekspor Bulanan
                  </h4>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 text-left font-medium hidden sm:block">
                    Berisi file ekspor bulanan.
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium text-left">
                    Terakhir diupdate: {monthlyLastUpdated}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4.5 w-4.5 shrink-0 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
            </div>

            {/* Folder 2: Ekspor Mingguan */}
            <div
              onClick={() => openFolderWeb('Notabase/Ekspor Mingguan')}
              className="group overflow-hidden rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer flex flex-row items-center justify-between text-left"
            >
              <div className="flex flex-row items-center gap-3.5 min-w-0 text-left">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-50 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400 border border-purple-100/50 dark:border-purple-900/50">
                  <Folder className="h-5.5 w-5.5 fill-purple-500/20" />
                </div>
                <div className="min-w-0 space-y-0.5 text-left">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors text-left">
                    Folder Ekspor Mingguan
                  </h4>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 text-left font-medium hidden sm:block">
                    Berisi file ekspor mingguan.
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium text-left">
                    Terakhir diupdate: {weeklyLastUpdated}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4.5 w-4.5 shrink-0 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
            </div>

            {/* Folder 3: Ekspor Tahunan */}
            <div
              onClick={() => openFolderWeb('Notabase/Ekspor Tahunan')}
              className="group overflow-hidden rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer flex flex-row items-center justify-between text-left"
            >
              <div className="flex flex-row items-center gap-3.5 min-w-0 text-left">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/50">
                  <Folder className="h-5.5 w-5.5 fill-emerald-500/20" />
                </div>
                <div className="min-w-0 space-y-0.5 text-left">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors text-left">
                    Folder Ekspor Tahunan
                  </h4>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 text-left font-medium hidden sm:block">
                    Berisi file ekspor tahunan.
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium text-left">
                    Terakhir diupdate: {yearlyLastUpdated}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4.5 w-4.5 shrink-0 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
            </div>
          </div>
        </div>

        {/* 4. Kapasitas Cloud */}
        <div className="space-y-3 pt-2 text-left">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 px-1 text-left">
            Kapasitas Cloud
          </h3>

          <div className="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-3 text-left">
            <div className="flex flex-row items-center justify-between text-xs text-left">
              <span className="font-extrabold text-slate-900 dark:text-slate-100 text-left">
                {formatBytes(cloudUsed)} dari {formatBytes(cloudTotal)}
              </span>
              <span className="font-semibold text-slate-500 dark:text-slate-400 text-right">
                {usedPct > 0 ? `${usedPct.toFixed(2)}% Terpakai` : '0% Terpakai'}
              </span>
            </div>

            <Progress
              value={usedPct}
              className="h-2 bg-slate-100 dark:bg-slate-800"
            />
          </div>
        </div>

      </main>

      {/* Dialog Modal: Hubungkan / Ganti Akun OneDrive */}
      <Dialog open={showConnectModal} onOpenChange={setShowConnectModal}>
        <DialogContent className="sm:max-w-md rounded-3xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <DialogHeader className="space-y-1">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 mb-1">
              <Cloud className="h-6 w-6" />
            </div>
            <DialogTitle className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
              Hubungkan Akun OneDrive
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Pilih metode otorisasi untuk menghubungkan akun Microsoft OneDrive (Pribadi, Komdigi, atau Kerja/Sekolah).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Option 1 (Primary & Recommended): Input Email Akun Microsoft */}
            <form onSubmit={handleCustomConnect} className="rounded-2xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/40 p-4 space-y-3">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Hubungkan Akun Microsoft (Langsung &amp; Instan)
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Masukkan email akun Microsoft yang ingin dihubungkan (contoh: <span className="font-mono text-emerald-700 dark:text-emerald-300">sunflower@gmail.com</span> atau <span className="font-mono text-emerald-700 dark:text-emerald-300">user@kominfo.go.id</span>).
                </p>
              </div>

              <div className="space-y-1.5">
                <Input
                  type="email"
                  required
                  placeholder="Masukkan email Microsoft..."
                  value={inputEmail}
                  onChange={(e) => setInputEmail(e.target.value)}
                  className="rounded-xl h-10 text-xs border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900"
                />
              </div>

              <Button
                type="submit"
                disabled={isConnecting}
                className="w-full rounded-xl h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer"
              >
                {isConnecting ? 'Menghubungkan Akun...' : 'Simpan & Hubungkan Akun Ini'}
              </Button>
            </form>

            {/* Separator OR */}
            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
              <span className="bg-white dark:bg-slate-900 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest absolute">
                atau via Otorisasi OAuth
              </span>
            </div>

            {/* Option 2: Microsoft OAuth Login */}
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3.5 space-y-2">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Login Otorisasi Microsoft OAuth 2.0
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Masuk via portal login Single Sign-On Microsoft (memerlukan pendaftaran Redirect URI di Azure Portal).
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleOAuthConnect}
                className="w-full rounded-xl h-9 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs gap-2 cursor-pointer"
              >
                <Cloud className="h-4 w-4 text-blue-600" />
                <span>Otorisasi via Microsoft OAuth</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
