'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Cloud,
  CloudOff,
  HardDrive,
  RefreshCw,
  UploadCloud,
  CheckCircle2,
  XCircle,
  Loader2,
  FolderOpen,
  LogOut,
  LogIn,
  FileText,
  Clock,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { AppHeader } from '@/components/layout/app-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { cn, formatRupiah } from '@/lib/utils'
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
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function OnedriveView() {
  const goBack = useAppStore((s) => s.goBack)
  const [state, setState] = useState<SyncState | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const fetchState = () => {
    setLoading(true)
    fetch('/api/sync')
      .then((r) => r.json())
      .then((d) => setState(d))
      .catch(() => toast.error('Gagal memuat status sinkronisasi'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchState()
  }, [])

  const handleReconnect = async () => {
    setSyncing(true)
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      })
      await new Promise((r) => setTimeout(r, 600))
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect' }),
      })
      toast.success('Berhasil terhubung ke OneDrive')
      fetchState()
    } catch {
      toast.error('Gagal menyambungkan ulang')
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Putuskan koneksi OneDrive?')) return
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      })
      toast.success('Koneksi OneDrive diputus')
      fetchState()
    } catch {
      toast.error('Gagal memutuskan')
    }
  }

  const handleUploadReport = async () => {
    setSyncing(true)
    try {
      const fileName = `Report_${new Date().toISOString().slice(0, 10)}.xlsx`
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, fileSize: Math.floor(Math.random() * 400_000) + 80_000 }),
      })
      if (!res.ok) throw new Error()
      toast.success(`${fileName} diunggah ke OneDrive`)
      fetchState()
    } catch {
      toast.error('Gagal mengunggah')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="min-h-screen pb-24">
      <AppHeader
        title="OneDrive Sync"
        subtitle="Sinkronisasi laporan ke cloud Microsoft"
        showBack
        showLogo={false}
      />

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-4">
        {/* Account status card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className={cn(
            'overflow-hidden',
            state?.connected ? 'border-primary/30' : 'border-muted'
          )}>
            <div className={cn(
              'flex items-center gap-3 p-4',
              state?.connected ? 'bg-gradient-to-br from-primary/10 to-primary/5' : 'bg-muted/50'
            )}>
              <div className={cn(
                'flex h-12 w-12 items-center justify-center rounded-xl',
                state?.connected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              )}>
                {state?.connected ? <Cloud className="h-6 w-6" /> : <CloudOff className="h-6 w-6" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">
                  {loading ? 'Memuat...' : state?.connected ? 'OneDrive Terhubung' : 'Tidak Terhubung'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {state?.connected ? state.account : 'Sambungkan akun Microsoft Anda'}
                </p>
              </div>
              {state?.connected && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              )}
            </div>

            {state?.connected && (
              <div className="space-y-2 p-4">
                <div className="flex items-center gap-2 text-xs">
                  <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Folder:</span>
                  <span className="font-mono font-semibold text-foreground">{state.folder}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-muted-foreground">Total file terunggah:</span>
                  <span className="font-semibold text-foreground">{state.totalUploaded} file</span>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 border-t border-border bg-muted/20 p-3">
              {state?.connected ? (
                <>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={handleReconnect}
                    disabled={syncing}
                  >
                    {syncing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                    Reconnect
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-destructive"
                    onClick={handleDisconnect}
                  >
                    <LogOut className="mr-1.5 h-3.5 w-3.5" /> Disconnect
                  </Button>
                </>
              ) : (
                <Button size="sm" className="flex-1" onClick={handleReconnect} disabled={syncing}>
                  {syncing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <LogIn className="mr-1.5 h-3.5 w-3.5" />}
                  Sambungkan Akun
                </Button>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Cloud usage */}
        {state?.connected && (
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Cloud Usage</h3>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {formatBytes(state.cloudUsed)} terpakai
                </span>
                <span className="font-semibold text-foreground">
                  {formatBytes(state.cloudTotal)} total
                </span>
              </div>
              <Progress
                value={state.usedPct}
                className="mt-2 h-2"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {state.usedPct.toFixed(1)}% ruang cloud terpakai
              </p>
            </div>
          </Card>
        )}

        {/* Upload progress / quick action */}
        {state?.connected && (
          <Button
            size="lg"
            className="w-full rounded-xl"
            onClick={handleUploadReport}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="mr-2 h-4 w-4" />
            )}
            Unggah Laporan Terbaru
          </Button>
        )}

        {/* Upload history */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Riwayat Upload</h3>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={fetchState}>
              <RefreshCw className="mr-1 h-3 w-3" /> Refresh
            </Button>
          </div>
          <div className="space-y-2">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="p-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-lg" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-2.5 w-24" />
                      </div>
                    </div>
                  </Card>
                ))
              : state?.logs.length
              ? state.logs.map((log) => (
                  <Card key={log.id} className="p-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                          log.status === 'success'
                            ? 'bg-emerald-50 text-emerald-600'
                            : log.status === 'uploading'
                            ? 'bg-blue-50 text-primary'
                            : log.status === 'failed'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {log.status === 'success' ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : log.status === 'failed' ? (
                          <XCircle className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-semibold text-foreground">
                          {log.fileName}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(log.createdAt).toLocaleString('id-ID')}
                          {log.fileSize && <span>· {formatBytes(log.fileSize)}</span>}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-bold',
                          log.status === 'success'
                            ? 'bg-emerald-50 text-emerald-600'
                            : log.status === 'failed'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {log.status === 'success' ? 'Selesai' : log.status === 'failed' ? 'Gagal' : log.status}
                      </span>
                    </div>
                    {log.status === 'uploading' && (
                      <Progress value={log.progress} className="mt-2 h-1" />
                    )}
                  </Card>
                ))
              : (
                <Card className="p-8 text-center">
                  <CloudOff className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium text-foreground">Belum ada riwayat</p>
                  <p className="text-xs text-muted-foreground">
                    Unggah file untuk melihat riwayat di sini
                  </p>
                </Card>
              )}
          </div>
        </div>
      </main>
    </div>
  )
}
