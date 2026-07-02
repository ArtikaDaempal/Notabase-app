'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ScanLine,
  ImagePlus,
  Camera,
  Zap,
  ZapOff,
  SwitchCamera,
  RefreshCw,
  Settings2,
  X,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { AppHeader } from '@/components/layout/app-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { toast } from 'sonner'
import type { OcrResult } from '@/types'
import { cn } from '@/lib/utils'

type CameraMode = 'camera' | 'gallery' | 'idle'
type Phase = 'preview' | 'captured' | 'processing' | 'done'

export function ScanView() {
  const { startOcrReview } = useAppStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [mode, setMode] = useState<CameraMode>('idle')
  const [phase, setPhase] = useState<Phase>('preview')
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [flash, setFlash] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [resolution, setResolution] = useState('1280x720')
  const [showSettings, setShowSettings] = useState(false)

  const startCamera = useCallback(async () => {
    setCameraError(null)
    setCameraReady(false)
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
      const [w, h] = resolution.split('x').map(Number)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: w },
          height: { ideal: h },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraReady(true)
      setMode('camera')
    } catch (err) {
      console.error('Camera error:', err)
      setCameraError(
        'Tidak dapat mengakses kamera. Pastikan izin kamera diberikan, atau gunakan opsi Import dari Galeri.'
      )
      setMode('idle')
    }
  }, [facingMode, resolution])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraReady(false)
  }, [])

  // Try to start camera on mount
  useEffect(() => {
    startCamera()
    return () => stopCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Restart camera when facing mode changes
  useEffect(() => {
    if (mode === 'camera') startCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode])

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    if (flash) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
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
  }, [flash, stopCamera])

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
    setMode('gallery')
  }

  const retake = useCallback(() => {
    setCapturedImage(null)
    setCapturedFile(null)
    setPhase('preview')
    startCamera()
  }, [startCamera])

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: url, filename: url.split('/').pop() }),
      })
      if (!ocrRes.ok) throw new Error('OCR gagal')
      const result: OcrResult = await ocrRes.json()

      setPhase('done')
      setTimeout(() => {
        startOcrReview(url, result)
      }, 600)
    } catch (err) {
      console.error(err)
      toast.error('Gagal memproses OCR. Silakan coba lagi.')
      setPhase('captured')
    }
  }, [capturedFile, capturedImage, startOcrReview])

  return (
    <div className="min-h-screen bg-slate-950 pb-24">
      <AppHeader
        title="Scan Nota"
        subtitle="Pindai nota dengan kamera"
        showBack={false}
        showLogo={false}
        rightAction={
          <Sheet open={showSettings} onOpenChange={setShowSettings}>
            <SheetTrigger asChild>
              <button
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10"
                aria-label="Pengaturan Kamera"
              >
                <Settings2 className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent className="w-[85vw] max-w-sm">
              <SheetHeader>
                <SheetTitle>Pengaturan Kamera</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm">Resolusi</Label>
                  <Select value={resolution} onValueChange={setResolution}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="640x480">SD (640×480)</SelectItem>
                      <SelectItem value="1280x720">HD (1280×720)</SelectItem>
                      <SelectItem value="1920x1080">Full HD (1920×1080)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Device Camera</Label>
                  <Select
                    value={facingMode}
                    onValueChange={(v) => setFacingMode(v as 'environment' | 'user')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="environment">Kamera Belakang</SelectItem>
                      <SelectItem value="user">Kamera Depan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div>
                    <Label className="text-sm">Flash Effect</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Efek kilatan saat capture
                    </p>
                  </div>
                  <Switch checked={flash} onCheckedChange={setFlash} />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div>
                    <Label className="text-sm">Auto Focus</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Fokus otomatis aktif
                    </p>
                  </div>
                  <Switch checked={true} disabled />
                </div>

                <Button
                  className="w-full"
                  onClick={() => {
                    setShowSettings(false)
                    startCamera()
                  }}
                >
                  Terapkan & Mulai Kamera
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        }
      />

      {/* Camera viewport */}
      <div className="relative mx-auto max-w-2xl px-4 pt-4">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-black">
          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Video preview */}
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
                <div className="absolute inset-0 bg-black/30" />
                <div className="absolute inset-x-6 top-1/2 -translate-y-1/2">
                  <div className="relative mx-auto aspect-[3/4] max-h-[70%] w-full rounded-2xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                    {/* Corner brackets */}
                    <span className="absolute -left-1 -top-1 h-8 w-8 rounded-tl-2xl border-l-4 border-t-4 border-primary" />
                    <span className="absolute -right-1 -top-1 h-8 w-8 rounded-tr-2xl border-r-4 border-t-4 border-primary" />
                    <span className="absolute -bottom-1 -left-1 h-8 w-8 rounded-bl-2xl border-b-4 border-l-4 border-primary" />
                    <span className="absolute -bottom-1 -right-1 h-8 w-8 rounded-br-2xl border-b-4 border-r-4 border-primary" />
                    {/* Scan line */}
                    {cameraReady && (
                      <div className="absolute inset-x-2 top-0 h-0.5 overflow-hidden">
                        <div className="scanline h-0.5 w-full bg-gradient-to-r from-transparent via-primary to-transparent" />
                      </div>
                    )}
                  </div>
                </div>
                <p className="absolute inset-x-0 bottom-6 text-center text-xs text-white/80">
                  Posisikan nota di dalam bingkai
                </p>
              </div>

              {/* Camera error overlay */}
              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900 p-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                    <Camera className="h-6 w-6" />
                  </div>
                  <p className="text-sm text-white/90">{cameraError}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={startCamera}>
                      <RefreshCw className="mr-1 h-3.5 w-3.5" /> Coba lagi
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImagePlus className="mr-1 h-3.5 w-3.5" /> Import
                    </Button>
                  </div>
                </div>
              )}

              {!cameraReady && !cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-xs text-white/70">Memulai kamera...</p>
                </div>
              )}
            </>
          )}

          {/* Captured image */}
          {phase === 'captured' && capturedImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative h-full w-full"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capturedImage}
                alt="Captured receipt"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20" />
            </motion.div>
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
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900/70 backdrop-blur-sm">
                <div className="relative">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <ScanLine className="absolute inset-0 m-auto h-5 w-5 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-white">
                    Memproses OCR...
                  </p>
                  <p className="text-xs text-white/60">
                    Mengekstrak data dari nota
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Done overlay */}
          {phase === 'done' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <CheckCircle2 className="h-16 w-16 text-emerald-400" />
              </motion.div>
              <p className="text-sm font-semibold text-white">OCR selesai!</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="mt-5">
          {phase === 'preview' && (
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
                aria-label="Import dari galeri"
              >
                <ImagePlus className="h-5 w-5" />
              </button>

              <button
                onClick={capture}
                disabled={!cameraReady}
                className={cn(
                  'flex h-18 w-18 items-center justify-center rounded-full border-4 border-white bg-primary p-1 transition-all',
                  cameraReady ? 'active:scale-95' : 'opacity-50'
                )}
                style={{ width: 72, height: 72 }}
                aria-label="Ambil foto"
              >
                <div className="h-full w-full rounded-full bg-primary flex items-center justify-center">
                  <Camera className="h-7 w-7 text-white" />
                </div>
              </button>

              <button
                onClick={() => setTorchOn((v) => !v)}
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-full backdrop-blur transition-colors',
                  torchOn ? 'bg-amber-400 text-slate-900' : 'bg-white/10 text-white hover:bg-white/20'
                )}
                aria-label="Flash"
              >
                {torchOn ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
              </button>
            </div>
          )}

          {phase === 'captured' && (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="secondary"
                size="lg"
                className="rounded-full"
                onClick={retake}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Retake
              </Button>
              <Button size="lg" className="rounded-full" onClick={runOcr}>
                <ScanLine className="mr-2 h-4 w-4" /> Proses OCR
              </Button>
            </div>
          )}
        </div>

        {/* Tips */}
        {phase === 'preview' && (
          <Card className="mt-4 border-white/10 bg-white/5 p-3 text-white/80 backdrop-blur">
            <p className="text-xs leading-relaxed">
              <span className="font-semibold text-white">Tips:</span> Pastikan
              pencahayaan cukup, nota rata, dan seluruh teks terlihat dalam
              bingkai untuk hasil OCR optimal.
            </p>
          </Card>
        )}
      </div>

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
