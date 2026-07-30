'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Settings,
  Camera,
  Languages,
  FileSpreadsheet,
  Cloud,
  Trash2,
  Folder,
  Loader2,
  ShieldAlert,
  Bell,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { SINGLE_TENANT_WORKSPACE } from '@/shared/config/workspace'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Section = 'general' | 'camera' | 'ocr' | 'export' | 'onedrive'

const sections: { id: Section; label: string; mobileLabel: string; icon: any }[] = [
  { id: 'general',  label: 'Umum',           mobileLabel: 'Umum',     icon: Settings },
  { id: 'camera',   label: 'Kamera',          mobileLabel: 'Kamera',   icon: Camera },
  { id: 'ocr',      label: 'OCR & Bahasa',    mobileLabel: 'OCR',      icon: Languages },
  { id: 'export',   label: 'Ekspor & Format', mobileLabel: 'Ekspor',   icon: FileSpreadsheet },
  { id: 'onedrive', label: 'OneDrive',         mobileLabel: 'OneDrive', icon: Cloud },
]

export function SettingsView() {
  const { navigate } = useAppStore()
  const [active, setActive] = useState<Section>('general')
  const [resetting, setResetting] = useState(false)
  const workspaceId = SINGLE_TENANT_WORKSPACE.id

  // General
  const [savePath, setSavePath] = useState('C:\\Users\\User\\Documents\\Notabase\\')
  const [imageFormat, setImageFormat] = useState('png')
  const [deleteAfterUpload, setDeleteAfterUpload] = useState(true)
  const [showNotif, setShowNotif] = useState(true)

  // Camera
  const [cameraAutofocus, setCameraAutofocus] = useState(true)
  const [cameraGrid, setCameraGrid] = useState(true)

  // OCR
  const [ocrLanguage, setOcrLanguage] = useState('id')
  const [ocrExtractItems, setOcrExtractItems] = useState(true)

  // Export
  const [excelIncludeLogo, setExcelIncludeLogo] = useState(true)
  const [excelAutoUpload, setExcelAutoUpload] = useState(false)

  // OneDrive
  const [onedriveAccount, setOnedriveAccount] = useState('')
  const [onedriveConnected, setOnedriveConnected] = useState(true)

  useEffect(() => {
    fetch('/api/settings', {
      headers: { 'x-workspace-id': workspaceId },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.save_path)         setSavePath(d.save_path)
        if (d.image_format)      setImageFormat(d.image_format)
        if (d.delete_after_upload !== undefined) setDeleteAfterUpload(d.delete_after_upload === 'true' || d.delete_after_upload === true)
        if (d.show_notif !== undefined)          setShowNotif(d.show_notif === 'true' || d.show_notif === true)
        if (d.camera_autofocus !== undefined)    setCameraAutofocus(d.camera_autofocus === 'true' || d.camera_autofocus === true)
        if (d.camera_grid !== undefined)         setCameraGrid(d.camera_grid === 'true' || d.camera_grid === true)
        if (d.ocr_language)                      setOcrLanguage(d.ocr_language)
        if (d.ocr_extract_items !== undefined)   setOcrExtractItems(d.ocr_extract_items === 'true' || d.ocr_extract_items === true)
        if (d.excel_include_logo !== undefined)  setExcelIncludeLogo(d.excel_include_logo === 'true' || d.excel_include_logo === true)
        if (d.excel_auto_upload !== undefined)   setExcelAutoUpload(d.excel_auto_upload === 'true' || d.excel_auto_upload === true)
        if (d.onedrive_connected !== undefined)  setOnedriveConnected(d.onedrive_connected === 'true' || d.onedrive_connected === true)
      })
      .catch(() => {})

    // Fetch live OneDrive account email from Microsoft Graph API
    fetch('/api/sync', {
      headers: { 'x-workspace-id': workspaceId },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.account) setOnedriveAccount(d.account)
        if (d.connected !== undefined) setOnedriveConnected(d.connected)
      })
      .catch(() => {})
  }, [workspaceId])

  const saveSetting = async (key: string, val: string) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': workspaceId,
        },
        body: JSON.stringify({ workspaceId, key, value: val }),
      })
    } catch {}
  }

  const handleReset = async () => {
    setResetting(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': workspaceId,
        },
        body: JSON.stringify({ workspaceId }),
      })
      if (res.ok) {
        toast.success('Semua pengaturan telah di-reset ke nilai awal.')
        setSavePath('C:\\Users\\User\\Documents\\Notabase\\')
        setImageFormat('png')
        setDeleteAfterUpload(true)
        setShowNotif(true)
        setCameraAutofocus(true)
        setCameraGrid(true)
        setOcrLanguage('id')
        setOcrExtractItems(true)
        setExcelIncludeLogo(true)
        setExcelAutoUpload(false)
      } else {
        toast.error('Gagal mereset pengaturan.')
      }
    } catch {
      toast.error('Terjadi kesalahan koneksi.')
    } finally {
      setResetting(false)
    }
  }

  const renderContent = () => (
    <motion.div
      key={active}
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15 }}
      className="space-y-5"
    >
      {/* 1. UMUM */}
      {active === 'general' && (
        <Card className="rounded-3xl border border-slate-100/80 dark:border-slate-800 p-5 shadow-2xs bg-white dark:bg-slate-900 space-y-5">
          <div className="flex items-center gap-3.5 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-100/70 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Umum</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Pengaturan penyimpanan lokal dan notifikasi.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Lokasi Penyimpanan Lokal</Label>
              <div className="flex gap-2">
                <Input
                  value={savePath}
                  onChange={(e) => setSavePath(e.target.value)}
                  onBlur={() => saveSetting('save_path', savePath)}
                  className="rounded-2xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-mono text-slate-700 dark:text-slate-300 h-10"
                />
                <Button
                  variant="outline"
                  onClick={() => toast.info('Fitur penjelajah folder tersedia di versi desktop installer.')}
                  className="rounded-2xl shrink-0 border-slate-200 dark:border-slate-700 text-xs font-bold h-10 px-3 flex items-center gap-1.5"
                >
                  <Folder className="h-4 w-4 text-slate-500" />
                  <span className="hidden sm:inline">Ubah</span>
                </Button>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Folder tempat gambar nota hasil scan disimpan secara lokal.</p>
            </div>

            <Separator className="bg-slate-100 dark:bg-slate-800" />

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Format Gambar</Label>
              <Select
                value={imageFormat}
                onValueChange={(val) => {
                  setImageFormat(val)
                  saveSetting('image_format', val)
                  toast.success(`Format gambar diubah ke ${val.toUpperCase()}`)
                }}
              >
                <SelectTrigger className="w-full rounded-2xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10">
                  <SelectValue placeholder="Pilih format" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl dark:bg-slate-800 dark:border-slate-700">
                  <SelectItem value="png" className="text-xs">PNG (Kualitas Tinggi, Direkomendasikan)</SelectItem>
                  <SelectItem value="jpg" className="text-xs">JPG (Ukuran File Lebih Kecil)</SelectItem>
                  <SelectItem value="webp" className="text-xs">WEBP (Format Modern Web)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator className="bg-slate-100 dark:bg-slate-800" />

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Hapus Gambar Setelah Upload</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Otomatis menghapus gambar lokal setelah berhasil diunggah ke OneDrive.</p>
              </div>
              <Switch
                checked={deleteAfterUpload}
                onCheckedChange={(v) => {
                  setDeleteAfterUpload(v)
                  saveSetting('delete_after_upload', String(v))
                  toast.success(v ? 'Pembersihan otomatis diaktifkan' : 'Pembersihan otomatis dinonaktifkan')
                }}
              />
            </div>

            <Separator className="bg-slate-100 dark:bg-slate-800" />

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Notifikasi Sistem</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Tampilkan notifikasi toast saat proses scan, OCR, atau sinkronisasi selesai.</p>
              </div>
              <Switch
                checked={showNotif}
                onCheckedChange={(v) => {
                  setShowNotif(v)
                  saveSetting('show_notif', String(v))
                  toast.success(v ? 'Notifikasi diaktifkan' : 'Notifikasi dinonaktifkan')
                }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* 2. KAMERA */}
      {active === 'camera' && (
        <Card className="rounded-3xl border border-slate-100/80 dark:border-slate-800 p-5 shadow-2xs bg-white dark:bg-slate-900 space-y-5">
          <div className="flex items-center gap-3.5 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-100/70 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Kamera</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Pengambilan foto nota dan alat bantu kamera.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Autofokus Otomatis</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Mengaktifkan penyesuaian fokus otomatis pada lensa kamera.</p>
              </div>
              <Switch
                checked={cameraAutofocus}
                onCheckedChange={(v) => {
                  setCameraAutofocus(v)
                  saveSetting('camera_autofocus', String(v))
                  toast.success(v ? 'Autofokus diaktifkan' : 'Autofokus dinonaktifkan')
                }}
              />
            </div>

            <Separator className="bg-slate-100 dark:bg-slate-800" />

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Garis Kisi (Grid Overlay)</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Tampilkan garis bantu untuk mempermudah perataan dokumen nota.</p>
              </div>
              <Switch
                checked={cameraGrid}
                onCheckedChange={(v) => {
                  setCameraGrid(v)
                  saveSetting('camera_grid', String(v))
                  toast.success(v ? 'Garis kisi diaktifkan' : 'Garis kisi dinonaktifkan')
                }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* 3. OCR & BAHASA */}
      {active === 'ocr' && (
        <Card className="rounded-3xl border border-slate-100/80 dark:border-slate-800 p-5 shadow-2xs bg-white dark:bg-slate-900 space-y-5">
          <div className="flex items-center gap-3.5 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-100/70 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
              <Languages className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">OCR & Bahasa</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Pengenalan teks AI Gemini dan bahasa pengenalan.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Bahasa Utama Nota</Label>
              <Select
                value={ocrLanguage}
                onValueChange={(val) => {
                  setOcrLanguage(val)
                  saveSetting('ocr_language', val)
                  toast.success('Bahasa OCR berhasil diperbarui')
                }}
              >
                <SelectTrigger className="w-full rounded-2xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10">
                  <SelectValue placeholder="Pilih bahasa" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl dark:bg-slate-800 dark:border-slate-700">
                  <SelectItem value="id" className="text-xs">Bahasa Indonesia (Utama)</SelectItem>
                  <SelectItem value="en" className="text-xs">English (Internasional)</SelectItem>
                  <SelectItem value="auto" className="text-xs">Deteksi Otomatis (Auto-Detect)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator className="bg-slate-100 dark:bg-slate-800" />

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Ekstraksi Rincian Item</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Ekstrak setiap baris barang, kuantitas, dan harga dari nota secara rinci.</p>
              </div>
              <Switch
                checked={ocrExtractItems}
                onCheckedChange={(v) => {
                  setOcrExtractItems(v)
                  saveSetting('ocr_extract_items', String(v))
                  toast.success(v ? 'Ekstraksi barang diaktifkan' : 'Ekstraksi barang dinonaktifkan')
                }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* 4. EKSPOR & FORMAT */}
      {active === 'export' && (
        <Card className="rounded-3xl border border-slate-100/80 dark:border-slate-800 p-5 shadow-2xs bg-white dark:bg-slate-900 space-y-5">
          <div className="flex items-center gap-3.5 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-100/70 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Ekspor & Format</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Konfigurasi file Excel .xlsx dan laporan otomatis.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Sertakan Kop / Logo Instansi</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Menambahkan header resmi Komdigi / NotaBase pada bagian atas file Excel.</p>
              </div>
              <Switch
                checked={excelIncludeLogo}
                onCheckedChange={(v) => {
                  setExcelIncludeLogo(v)
                  saveSetting('excel_include_logo', String(v))
                  toast.success(v ? 'Kop dokumen diaktifkan' : 'Kop dokumen dinonaktifkan')
                }}
              />
            </div>

            <Separator className="bg-slate-100 dark:bg-slate-800" />

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Auto Sync Excel ke OneDrive</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Otomatis mengunggah file .xlsx setiap kali ekspor laporan dibuat.</p>
              </div>
              <Switch
                checked={excelAutoUpload}
                onCheckedChange={(v) => {
                  setExcelAutoUpload(v)
                  saveSetting('excel_auto_upload', String(v))
                  toast.success(v ? 'Auto sync ekspor diaktifkan' : 'Auto sync ekspor dinonaktifkan')
                }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* 5. ONEDRIVE */}
      {active === 'onedrive' && (
        <Card className="rounded-3xl border border-slate-100/80 dark:border-slate-800 p-5 shadow-2xs bg-white dark:bg-slate-900 space-y-5">
          <div className="flex items-center gap-3.5 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-100/70 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">OneDrive</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Status sinkronisasi akun cloud Microsoft OneDrive.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Akun Terhubung</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Aktif
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 font-mono">{onedriveAccount}</p>
            </div>

            <Button
              onClick={() => navigate('onedrive')}
              className="w-full rounded-2xl h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Cloud className="h-4.5 w-4.5" />
              <span>Buka Menu Backup & Sinkronisasi OneDrive</span>
            </Button>
          </div>
        </Card>
      )}

      {/* Zona Berbahaya — always visible */}
      <Card className="rounded-3xl border border-red-100 dark:border-red-950 overflow-hidden shadow-2xs bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2.5 bg-[#FEF2F2] dark:bg-red-950/40 border-b border-red-100 dark:border-red-900/60 px-5 py-3.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/80 text-red-600 dark:text-red-400">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <h3 className="text-xs sm:text-sm font-extrabold text-[#DC2626] dark:text-red-400">Zona Berbahaya</h3>
        </div>

        <div className="p-5 space-y-3.5">
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Reset Semua Pengaturan</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Kembalikan semua konfigurasi ke pengaturan pabrik. Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="w-full rounded-2xl h-11 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-red-600/20 active:scale-95 transition-all cursor-pointer">
                <Trash2 className="h-4 w-4" />
                <span>Reset Pengaturan</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-3xl dark:bg-slate-900 dark:border-slate-800">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-extrabold dark:text-slate-100">Reset semua pengaturan?</AlertDialogTitle>
                <AlertDialogDescription className="text-xs dark:text-slate-400">
                  Semua konfigurasi akan dikembalikan ke nilai awal. Tindakan ini tidak dapat dibatalkan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl text-xs font-semibold dark:bg-slate-800 dark:text-slate-200">Batal</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleReset}
                  className="rounded-xl bg-red-600 text-white hover:bg-red-700 text-xs font-bold"
                >
                  {resetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Ya, Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Card>

      {/* Footer */}
      <div className="pt-1 pb-4 text-center space-y-0.5">
        <p className="text-xs font-bold text-slate-400 dark:text-slate-500">NotaBase v1.0.0</p>
        <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
          Digital Receipt Management – BPPKI MANADO (DEPKOMINFO)
        </p>
      </div>
    </motion.div>
  )

  return (
    <div className="w-full pb-20">

      {/* ── DESKTOP LAYOUT ── */}
      <div className="hidden md:block space-y-5">
        {/* Desktop 2-column: Left nav + Right content */}
        <div className="flex gap-5 items-start">
          {/* Left sidebar nav */}
          <Card className="w-56 shrink-0 border border-slate-100/80 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900 rounded-3xl p-3 space-y-1">
            {sections.map((s) => {
              const Icon = s.icon
              const isActive = active === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-xs font-semibold transition-all text-left group',
                    isActive
                      ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300',
                    )}
                  />
                  <span className="truncate">{s.label}</span>
                </button>
              )
            })}
          </Card>

          {/* Right content */}
          <div className="flex-1 min-w-0">
            {renderContent()}
          </div>
        </div>
      </div>

      {/* ── MOBILE LAYOUT ── */}
      <div className="md:hidden space-y-4">
        {/* Mobile header */}
        <div className="flex items-center justify-between -mx-4 -mt-5 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-30">
          <span className="text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Pengaturan</span>
          <button className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white">
              1
            </span>
          </button>
        </div>

        {/* Mobile horizontal icon tab bar */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs">
          {sections.map((s) => {
            const Icon = s.icon
            const isActive = active === s.id
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={cn(
                  'shrink-0 flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[10px] font-semibold transition-all min-w-[56px]',
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
                )}
              >
                <Icon className={cn('h-4 w-4', isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500')} />
                <span>{s.mobileLabel}</span>
              </button>
            )
          })}
        </div>

        {/* Mobile content */}
        {renderContent()}
      </div>
    </div>
  )
}
