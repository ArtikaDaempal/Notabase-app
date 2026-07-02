'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Settings2,
  Camera,
  Languages,
  FileSpreadsheet,
  Cloud,
  Palette,
  Trash2,
  ChevronRight,
  Folder,
  Image as ImageIcon,
  Loader2,
  ShieldAlert,
  Info,
  Moon,
  Sun,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { AppHeader } from '@/components/layout/app-header'
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

type Section = 'general' | 'camera' | 'ocr' | 'export' | 'onedrive' | 'display' | 'danger'

const sections: { id: Section; label: string; icon: typeof Settings2 }[] = [
  { id: 'general', label: 'Umum', icon: Settings2 },
  { id: 'camera', label: 'Kamera', icon: Camera },
  { id: 'ocr', label: 'OCR & Bahasa', icon: Languages },
  { id: 'export', label: 'Ekspor & Format', icon: FileSpreadsheet },
  { id: 'onedrive', label: 'OneDrive', icon: Cloud },
  { id: 'display', label: 'Tampilan', icon: Palette },
  { id: 'danger', label: 'Danger Zone', icon: ShieldAlert },
]

export function SettingsView() {
  const { navigate } = useAppStore()
  const [active, setActive] = useState<Section>('general')
  const [resetting, setResetting] = useState(false)

  // settings state
  const [language, setLanguage] = useState('id')
  const [savePath, setSavePath] = useState('C:\\Users\\User\\Documents\\Notabase\\')
  const [imageFormat, setImageFormat] = useState('png')
  const [deleteAfterUpload, setDeleteAfterUpload] = useState(true)
  const [autoOcr, setAutoOcr] = useState(true)
  const [ocrLanguage, setOcrLanguage] = useState('id')
  const [minConfidence, setMinConfidence] = useState('65')
  const [excelTemplate, setExcelTemplate] = useState('standard')
  const [currency, setCurrency] = useState('IDR')
  const [darkMode, setDarkMode] = useState(false)
  const [compactView, setCompactView] = useState(false)

  const handleReset = async () => {
    setResetting(true)
    try {
      // Delete all receipts
      const res = await fetch('/api/receipts?page=1&pageSize=1000')
      const data = await res.json()
      await Promise.all(
        data.data.map((r: { id: string }) =>
          fetch(`/api/receipts/${r.id}`, { method: 'DELETE' })
        )
      )
      toast.success('Semua data nota telah direset')
    } catch {
      toast.error('Gagal mereset data')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="min-h-screen pb-24">
      <AppHeader title="Pengaturan" subtitle="Kelola preferensi akun dan konfigurasi aplikasi Anda." />

      <main className="mx-auto max-w-2xl px-4 py-4">
        {/* Section menu */}
        <Card className="mb-4 overflow-hidden">
          {sections.map((s, i) => {
            const Icon = s.icon
            const isActive = active === s.id
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                  isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50',
                  i > 0 && 'border-t border-border'
                )}
              >
                <Icon className={cn('h-4 w-4', isActive ? 'text-primary-foreground' : 'text-muted-foreground')} />
                <span className={cn('flex-1 text-sm font-medium', isActive ? 'text-primary-foreground' : 'text-foreground')}>
                  {s.label}
                </span>
                <ChevronRight className={cn('h-4 w-4', isActive ? 'text-primary-foreground' : 'text-muted-foreground')} />
              </button>
            )
          })}
        </Card>

        {/* Section content */}
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {active === 'general' && (
            <Card className="space-y-4 p-4">
              <h3 className="text-sm font-bold text-foreground">Pengaturan Umum</h3>
              <SettingRow
                label="Bahasa Aplikasi"
                desc="Pilih bahasa yang digunakan di seluruh aplikasi"
              >
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="id">Bahasa Indonesia</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
              <Separator />
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Lokasi Simpan Default</Label>
                <p className="text-[11px] text-muted-foreground">
                  Tempatkan folder Notabase untuk menyimpan nota digital
                </p>
                <div className="relative">
                  <Folder className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={savePath}
                    onChange={(e) => setSavePath(e.target.value)}
                    className="pl-9 pr-9"
                  />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-primary">
                    <Folder className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <Separator />
              <SettingRow
                label="Format Simpan Gambar"
                desc="Format file untuk digunakan saat pemindaian kamera"
              >
                <Select value={imageFormat} onValueChange={setImageFormat}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="png">PNG (High Quality)</SelectItem>
                    <SelectItem value="jpg">JPG (Compressed)</SelectItem>
                    <SelectItem value="webp">WebP (Modern)</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>

              <Separator />
              <h3 className="pt-2 text-sm font-bold text-foreground">Privasi & Otomatisasi</h3>
              <SettingRow
                label="Hapus Gambar Setelah Upload"
                desc="Opsi aman untuk menghapus file lokal setelah upload berhasil"
              >
                <Switch checked={deleteAfterUpload} onCheckedChange={setDeleteAfterUpload} />
              </SettingRow>
            </Card>
          )}

          {active === 'camera' && (
            <Card className="space-y-4 p-4">
              <h3 className="text-sm font-bold text-foreground">Pengaturan Kamera</h3>
              <SettingRow
                label="Resolusi Default"
                desc="Resolusi pemindaian kamera"
              >
                <Select defaultValue="1280x720">
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="640x480">SD (640×480)</SelectItem>
                    <SelectItem value="1280x720">HD (1280×720)</SelectItem>
                    <SelectItem value="1920x1080">Full HD</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
              <Separator />
              <SettingRow label="Auto Focus" desc="Fokus otomatis saat memindai">
                <Switch defaultChecked />
              </SettingRow>
              <SettingRow label="Flash Otomatis" desc="Aktifkan flash di kondisi gelap">
                <Switch defaultChecked={false} />
              </SettingRow>
              <SettingRow label="Grid Pembantu" desc="Tampilkan grid untuk align nota">
                <Switch defaultChecked />
              </SettingRow>
              <Separator />
              <div className="flex items-start gap-2 rounded-lg bg-primary/5 p-3 text-[11px] text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>Pengaturan kamera diterapkan saat sesi scan berikutnya.</span>
              </div>
            </Card>
          )}

          {active === 'ocr' && (
            <Card className="space-y-4 p-4">
              <h3 className="text-sm font-bold text-foreground">OCR & Bahasa</h3>
              <SettingRow
                label="Bahasa OCR"
                desc="Bahasa utama untuk pengenalan teks"
              >
                <Select value={ocrLanguage} onValueChange={setOcrLanguage}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="id">Indonesia</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="both">Indonesia + English</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
              <Separator />
              <SettingRow
                label="Minimum Confidence"
                desc="Ambang batas akurasi (di bawah ini ditandai warning)"
              >
                <Select value={minConfidence} onValueChange={setMinConfidence}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50%</SelectItem>
                    <SelectItem value="65">65%</SelectItem>
                    <SelectItem value="75">75%</SelectItem>
                    <SelectItem value="85">85%</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
              <SettingRow
                label="Auto OCR Setelah Capture"
                desc="Jalankan OCR otomatis setelah foto diambil"
              >
                <Switch checked={autoOcr} onCheckedChange={setAutoOcr} />
              </SettingRow>
              <SettingRow
                label="Ekstrak Item Otomatis"
                desc="Parse daftar item dari teks nota"
              >
                <Switch defaultChecked />
              </SettingRow>
            </Card>
          )}

          {active === 'export' && (
            <Card className="space-y-4 p-4">
              <h3 className="text-sm font-bold text-foreground">Ekspor & Format</h3>
              <SettingRow
                label="Template Excel"
                desc="Format laporan Excel"
              >
                <Select value={excelTemplate} onValueChange={setExcelTemplate}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="detailed">Detailed</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
              <Separator />
              <SettingRow
                label="Mata Uang"
                desc="Simbol mata uang pada laporan"
              >
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IDR">IDR (Rp)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
              <SettingRow
                label="Sertakan Logo"
                desc="Tambahkan logo Notabase di header laporan"
              >
                <Switch defaultChecked />
              </SettingRow>
              <SettingRow
                label="Auto Upload ke OneDrive"
                desc="Unggah laporan ke OneDrive setelah diekspor"
              >
                <Switch defaultChecked={false} />
              </SettingRow>
            </Card>
          )}

          {active === 'onedrive' && (
            <Card className="space-y-4 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">OneDrive</h3>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600">
                  Terhubung
                </span>
              </div>
              <div className="space-y-2 rounded-lg bg-muted/40 p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Akun</span>
                  <span className="font-medium text-foreground">notabase.user@outlook.com</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Folder</span>
                  <span className="font-mono font-medium text-foreground">Notabase/</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Auto Sync</span>
                  <span className="font-medium text-foreground">Setiap hari 23:00</span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('onedrive')}
              >
                Kelola Sinkronisasi
              </Button>
              <Button
                variant="outline"
                className="w-full text-destructive"
                onClick={() => toast.info('Memutuskan OneDrive...')}
              >
                Putuskan Koneksi
              </Button>
            </Card>
          )}

          {active === 'display' && (
            <Card className="space-y-4 p-4">
              <h3 className="text-sm font-bold text-foreground">Tampilan</h3>
              <SettingRow
                label="Mode Gelap"
                desc="Aktifkan tema gelap"
                icon={darkMode ? Moon : Sun}
              >
                <Switch checked={darkMode} onCheckedChange={setDarkMode} />
              </SettingRow>
              <Separator />
              <SettingRow
                label="Tampilan Kompak"
                desc="Kurangi spacing untuk lebih banyak konten"
              >
                <Switch checked={compactView} onCheckedChange={setCompactView} />
              </SettingRow>
              <SettingRow
                label="Ukuran Font"
                desc="Ukuran teks aplikasi"
              >
                <Select defaultValue="medium">
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Kecil</SelectItem>
                    <SelectItem value="medium">Sedang</SelectItem>
                    <SelectItem value="large">Besar</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
            </Card>
          )}

          {active === 'danger' && (
            <Card className="overflow-hidden border-destructive/30">
              <div className="flex items-center gap-2 border-b border-destructive/20 bg-destructive/5 px-4 py-3">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                <h3 className="text-sm font-bold text-destructive">Danger Zone</h3>
              </div>
              <div className="space-y-4 p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Reset Data</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Hapus semua nota, riwayat OCR, dan log sinkronisasi dari
                    database lokal. Tindakan ini tidak dapat dibatalkan.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <Trash2 className="mr-2 h-4 w-4" /> Reset Semua Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset semua data?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Semua nota dan riwayat akan dihapus permanen. Pastikan
                        Anda telah mengekspor data penting sebelum melanjutkan.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleReset}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {resetting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="mr-2 h-4 w-4" />
                        )}
                        Ya, Reset
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          )}
        </motion.div>

        {/* App info */}
        <div className="mt-6 flex flex-col items-center gap-1 text-center">
          <p className="text-[11px] font-semibold text-muted-foreground">
            Notabase v1.0.0
          </p>
          <p className="text-[10px] text-muted-foreground/70">
            Digital Receipt Management System · BPSDMP KOMINFO MANADO
          </p>
        </div>
      </main>
    </div>
  )
}

function SettingRow({
  label,
  desc,
  children,
  icon: Icon,
}: {
  label: string
  desc: string
  children: React.ReactNode
  icon?: typeof Settings2
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
          <p className="text-sm font-medium text-foreground">{label}</p>
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
