'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ScanLine,
  ImagePlus,
  Camera,
  RefreshCw,
  Settings2,
  Loader2,
  CheckCircle2,
  Bell,
  ArrowLeft,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { useWorkspaceStore } from '@/store/workspace-store'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import type { OcrResult } from '@/types'
import { cn } from '@/lib/utils'
import { saveReceiptOnlineFirst } from '@/lib/sync-service'
import { DEFAULT_WORKSPACE_ID } from '@/lib/constants'
import { SINGLE_TENANT_WORKSPACE } from '@/shared/config/workspace'

type Phase = 'preview' | 'captured' | 'processing' | 'done'

export function ScanView() {
  const { startOcrReview, setTab, goBack } = useAppStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [phase, setPhase] = useState<Phase>('preview')
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [resolution, setResolution] = useState('1280x720')
  const [cameraGrid, setCameraGrid] = useState(true)
  const [cameraAutofocus, setCameraAutofocus] = useState(true)

  // Real media devices states
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')

  // Load configuration from database
  useEffect(() => {
    const workspaceId = SINGLE_TENANT_WORKSPACE.id
    fetch('/api/settings', {
      headers: { 'x-workspace-id': workspaceId },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.camera_resolution) setResolution(d.camera_resolution)
        if (d.camera_grid !== undefined) setCameraGrid(d.camera_grid === 'true' || d.camera_grid === true)
        if (d.camera_autofocus !== undefined) setCameraAutofocus(d.camera_autofocus === 'true' || d.camera_autofocus === true)
      })
      .catch(() => {})
  }, [])

  // Query actual video devices on mount
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices()
      .then((deviceInfos) => {
        const videoDevices = deviceInfos.filter((d) => d.kind === 'videoinput')
        setDevices(videoDevices)
        if (videoDevices.length > 0) {
          setSelectedDeviceId(videoDevices[0].deviceId)
        }
      })
      .catch((err) => console.error('Enumerate devices error:', err))
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    setCameraReady(false)
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
      const [w, h] = resolution.split('x').map(Number)
      
      // Build constraints
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const videoConstraints: any = {
        width: { ideal: w },
        height: { ideal: h },
      }
      if (selectedDeviceId) {
        videoConstraints.deviceId = { exact: selectedDeviceId }
      } else {
        videoConstraints.facingMode = 'environment'
      }

      if (cameraAutofocus) {
        videoConstraints.advanced = [{ focusMode: 'continuous' }]
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      })
      streamRef.current = stream

      const track = stream.getVideoTracks()[0]
      if (track && 'applyConstraints' in track && cameraAutofocus) {
        try {
          await track.applyConstraints({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            advanced: [{ focusMode: 'continuous' } as any],
          })
        } catch {}
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch((err) => {
          if (err.name !== 'AbortError') {
            console.error('Camera play error:', err)
          }
        })
      }
      setCameraReady(true)
    } catch (err) {
      console.error('Camera error:', err)
      setCameraError(
        'Tidak dapat mengakses kamera. Pastikan izin kamera diberikan, atau gunakan opsi Import dari Galeri.'
      )
    }
  }, [selectedDeviceId, resolution, cameraAutofocus])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraReady(false)
  }, [])

  // Start/restart camera when device or resolution changes
  useEffect(() => {
    if (phase === 'preview') {
      startCamera()
    }
    return () => stopCamera()
  }, [selectedDeviceId, resolution, phase, startCamera, stopCamera])

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' })
        const url = URL.createObjectURL(blob)
        setCapturedImage(url)
        setCapturedFile(file)
        setPhase('captured')
        stopCamera()
      },
      'image/jpeg',
      0.92
    )
  }, [stopCamera])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar')
      return
    }
    stopCamera()
    const url = URL.createObjectURL(file)
    setCapturedImage(url)
    setCapturedFile(file)
    setPhase('captured')
  }

  const retake = useCallback(() => {
    setCapturedImage(null)
    setCapturedFile(null)
    setPhase('preview')
  }, [])

  const runOcr = useCallback(async () => {
    if (!capturedFile || !capturedImage) return
    setPhase('processing')

    try {
      // Upload the image first
      const formData = new FormData()
      formData.append('file', capturedFile)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!uploadRes.ok) throw new Error('Upload gagal')
      const { url } = await uploadRes.json()

      // Run OCR
      const ocrRes = await fetch('/api/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': SINGLE_TENANT_WORKSPACE.id,
        },
        body: JSON.stringify({ imageUrl: url, filename: url.split('/').pop() }),
      })
      if (!ocrRes.ok) {
        const errData = await ocrRes.json().catch(() => ({}))
        throw new Error(errData.error || 'Gagal memproses OCR')
      }
      const result: OcrResult = await ocrRes.json()

      // Check if the VLM detected the image as a valid receipt
      if (result.isReceipt === false) {
        toast.error('Gambar tidak terdeteksi sebagai nota belanja. Silakan potret/pilih ulang gambar nota.')
        retake()
        return
      }

      // Smart auto-save: if all required fields are detected, save directly without showing form
      const isFullyRead =
        result.merchantName && result.merchantName.trim() !== '' &&
        result.total && result.total > 0 &&
        result.transactionDate && result.transactionDate.trim() !== ''

      if (isFullyRead) {
        const dateStr = result.transactionDate
          ? new Date(result.transactionDate).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10)

        const workspaceId = SINGLE_TENANT_WORKSPACE.id
        await saveReceiptOnlineFirst(
          {
            workspaceId,
            invoiceNumber: result.invoiceNumber || null,
            merchantName: result.merchantName,
            namaToko: result.merchantName,
            transactionDate: dateStr,
            tanggal: dateStr,
            total: result.total,
            nominal: result.total,
            description: result.description || null,
            keterangan: result.description || null,
            imageUrl: url,
            ocrText: result.ocrText,
            ocrRawText: result.ocrText,
            confidence: result.confidence,
            ocrConfidence: result.confidence,
            status: 'verified',
            statusOcr: 'berhasil',
            items: result.items,
          },
          workspaceId
        )

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('notabase_receipts_changed'))
          window.dispatchEvent(new Event('receipts-updated'))
          window.dispatchEvent(new Event('receipt-saved'))
        }

        toast.success('Berhasil')
        setPhase('done')
        setTimeout(() => {
          setTab('history')
        }, 600)
        return
      } else {
        // Partial read: notify user fields are incomplete
        toast.info('Beberapa data nota tidak terbaca. Silakan lengkapi form di bawah.')
      }

      // Fallback: show manual review form
      setPhase('done')
      setTimeout(() => {
        startOcrReview(url, result)
      }, 600)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Gagal memproses OCR. Silakan coba lagi.')
      setPhase('captured')
    }
  }, [capturedFile, capturedImage, startOcrReview, setTab])

  const handleLeftAction = () => {
    if (phase === 'preview') {
      setTab('dashboard')
    } else {
      retake()
    }
  }

  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#F8FAFF] pb-24">
      {/* Custom Mockup Header */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-lg md:hidden">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={goBack}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors"
                aria-label="Kembali"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className="text-lg font-bold text-blue-600">Notabase</span>
            </div>
            <div className="flex items-center gap-3">
              <button className="relative flex h-9 w-9 items-center justify-center rounded-full text-blue-600 hover:bg-slate-100 transition-colors">
                <Bell className="h-5 w-5" />
              </button>
              <div className="h-8 w-8 overflow-hidden rounded-full border border-slate-200 bg-slate-200">
                <div className="flex h-full w-full items-center justify-center bg-blue-100 text-xs font-semibold text-blue-700">
                  AD
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto w-full max-w-xl px-3 py-4 space-y-4 sm:px-6">
        {/* Unified Camera Viewport & Control Card */}
        <div className="relative overflow-hidden rounded-3xl bg-black shadow-xl text-white">
          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Video / Preview Viewport */}
          <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-900">
            {phase === 'preview' && (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                  autoPlay
                />
                
                {/* Scanner frame overlay */}
                <div className="pointer-events-none absolute inset-0">
                  {/* Dark mask around the frame using 4 strips */}
                  {/* Top */}
                  <div className="absolute inset-x-0 top-0 h-[8%] bg-black/50" />
                  {/* Bottom */}
                  <div className="absolute inset-x-0 bottom-0 h-[8%] bg-black/50" />
                  {/* Left */}
                  <div className="absolute left-0 top-[8%] bottom-[8%] w-[6%] bg-black/50" />
                  {/* Right */}
                  <div className="absolute right-0 top-[8%] bottom-[8%] w-[6%] bg-black/50" />

                  {/* Bingkai utama */}
                  <div className="absolute inset-x-[6%] top-[8%] bottom-[8%] rounded-2xl border-2 border-white/90 overflow-hidden">
                    {/* Grid Pembantu (Rule of Thirds 3x3) */}
                    {cameraGrid && (
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                        <div className="border-r border-b border-white" />
                        <div className="border-r border-b border-white" />
                        <div className="border-b border-white" />
                        <div className="border-r border-b border-white" />
                        <div className="border-r border-b border-white" />
                        <div className="border-b border-white" />
                        <div className="border-r border-white" />
                        <div className="border-r border-white" />
                        <div className="" />
                      </div>
                    )}

                    {/* Corner brackets */}
                    <span className="absolute -left-1 -top-1 h-8 w-8 rounded-tl-xl border-l-4 border-t-4 border-blue-400 z-10" />
                    <span className="absolute -right-1 -top-1 h-8 w-8 rounded-tr-xl border-r-4 border-t-4 border-blue-400 z-10" />
                    <span className="absolute -bottom-1 -left-1 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 border-blue-400 z-10" />
                    <span className="absolute -bottom-1 -right-1 h-8 w-8 rounded-br-xl border-b-4 border-r-4 border-blue-400 z-10" />
                    {/* Scan line */}
                    {cameraReady && (
                      <div className="absolute inset-x-2 top-0 h-0.5 overflow-hidden z-10">
                        <div className="scanline h-0.5 w-full bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
                      </div>
                    )}
                  </div>

                  <p className="absolute inset-x-0 bottom-3 text-center text-[11px] font-medium text-white/90 drop-shadow">
                    Posisikan nota di dalam bingkai
                  </p>
                </div>


                {/* Camera error overlay */}
                {cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900 p-6 text-center">
                    <p className="text-xs text-white/90">{cameraError}</p>
                    <Button size="sm" variant="secondary" onClick={startCamera}>
                      <RefreshCw className="mr-1 h-3.5 w-3.5" /> Coba lagi
                    </Button>
                  </div>
                )}

                {/* Camera starting spinner */}
                {!cameraReady && !cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    <p className="text-[10px] text-white/70">Memulai kamera...</p>
                  </div>
                )}
              </>
            )}

            {/* Captured image */}
            {phase === 'captured' && capturedImage && (
              <div className="relative h-full w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={capturedImage}
                  alt="Captured receipt"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-black/20" />
              </div>
            )}

            {/* Processing overlay */}
            {phase === 'processing' && capturedImage && (
              <div className="absolute inset-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={capturedImage}
                  alt="Processing"
                  className="h-full w-full object-cover opacity-50"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/70 backdrop-blur-sm">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <div className="text-center">
                    <p className="text-xs font-semibold text-white">Memproses OCR...</p>
                    <p className="text-[10px] text-white/60">Mengekstrak data dari nota</p>
                  </div>
                </div>
              </div>
            )}

            {/* Done overlay */}
            {phase === 'done' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900">
                <CheckCircle2 className="h-12 w-12 text-emerald-400 animate-pulse" />
                <p className="text-xs font-semibold text-white">OCR selesai!</p>
              </div>
            )}
          </div>

          {/* Unified Camera Controls Bar */}
          <div className="flex items-center justify-between px-8 py-5 bg-slate-950 border-t border-slate-900">
            {/* Left Button: Retake / Back */}
            <div className="flex flex-col items-center gap-1 w-16">
              <button
                onClick={handleLeftAction}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white"
                aria-label="Kembali atau Ulangi"
              >
                <RefreshCw className="h-4.5 w-4.5" />
              </button>
              <span className="text-[10px] font-semibold text-slate-400">
                {phase === 'preview' ? 'Batal' : 'Retake'}
              </span>
            </div>

            {/* Center Action: Capture or Process OCR */}
            {phase === 'preview' ? (
              <button
                onClick={capture}
                disabled={!cameraReady}
                className={cn(
                  'flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white p-1 transition-all active:scale-90',
                  cameraReady ? 'opacity-100' : 'opacity-40'
                )}
                aria-label="Ambil foto"
              >
                <div className="h-full w-full rounded-full bg-white border-2 border-slate-950" />
              </button>
            ) : (
              <button
                onClick={runOcr}
                disabled={phase === 'processing' || phase === 'done'}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white shadow-md transition-all hover:bg-blue-700 active:scale-90"
                aria-label="Proses OCR"
              >
                <ScanLine className="h-6 w-6" />
              </button>
            )}

            {/* Right Button: Import */}
            <div className="flex flex-col items-center gap-1 w-16">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={phase === 'processing' || phase === 'done'}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white disabled:opacity-40"
                aria-label="Import dari galeri"
              >
                <ImagePlus className="h-4.5 w-4.5" />
              </button>
              <span className="text-[10px] font-semibold text-slate-400">Import</span>
            </div>
          </div>
        </div>

        {/* Collapsible Settings Card */}
        <Card className="border-slate-100 shadow-sm bg-white overflow-hidden">
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
            aria-expanded={settingsOpen}
          >
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Pengaturan Kamera</span>
            </div>
            <motion.span
              animate={{ rotate: settingsOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-slate-400"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.span>
          </button>

          <motion.div
            initial={false}
            animate={{ height: settingsOpen ? 'auto' : 0, opacity: settingsOpen ? 1 : 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 px-4 pb-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500">Pilih Kamera</Label>
                <Select
                  value={selectedDeviceId}
                  onValueChange={setSelectedDeviceId}
                >
                  <SelectTrigger className="w-full bg-slate-50 border-slate-100 rounded-xl h-11">
                    <SelectValue placeholder="Pilih Kamera" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.length > 0 ? (
                      devices.map((device, idx) => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                          {device.label || `Camera ${idx + 1}`}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="default">Kamera Utama</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500">Kualitas Gambar</Label>
                <Select value={resolution} onValueChange={(v) => {
                  setResolution(v)
                  fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-workspace-id': SINGLE_TENANT_WORKSPACE.id },
                    body: JSON.stringify({ key: 'camera_resolution', value: v }),
                  })
                }}>
                  <SelectTrigger className="w-full bg-slate-50 border-slate-100 rounded-xl h-11">
                    <SelectValue placeholder="Pilih Kualitas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="640x480">SD (640×480)</SelectItem>
                    <SelectItem value="1280x720">HD (1280×720)</SelectItem>
                    <SelectItem value="1920x1080">Tinggi (Full HD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-900">Auto Focus Kamera</p>
                  <p className="text-[10px] text-slate-400">Fokus otomatis saat pemindaian</p>
                </div>
                <Switch
                  checked={cameraAutofocus}
                  onCheckedChange={(v) => {
                    setCameraAutofocus(v)
                    fetch('/api/settings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'x-workspace-id': SINGLE_TENANT_WORKSPACE.id },
                      body: JSON.stringify({ key: 'camera_autofocus', value: String(v) }),
                    })
                    toast.success(v ? 'Auto Focus diaktifkan' : 'Auto Focus dinonaktifkan')
                  }}
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-900">Grid Pembantu</p>
                  <p className="text-[10px] text-slate-400">Garis bantuan posisi nota</p>
                </div>
                <Switch
                  checked={cameraGrid}
                  onCheckedChange={(v) => {
                    setCameraGrid(v)
                    fetch('/api/settings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'x-workspace-id': SINGLE_TENANT_WORKSPACE.id },
                      body: JSON.stringify({ key: 'camera_grid', value: String(v) }),
                    })
                    toast.success(v ? 'Grid pembantu diaktifkan' : 'Grid pembantu dinonaktifkan')
                  }}
                />
              </div>
            </div>
          </motion.div>
        </Card>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  )
}
