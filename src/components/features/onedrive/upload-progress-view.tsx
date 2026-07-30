'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bell, CheckCircle2, Circle, Loader2, UploadCloud, XCircle } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { toast } from 'sonner'

interface UploadStep {
  label: string
  status: 'done' | 'active' | 'pending'
}

export function UploadProgressView() {
  const { navigate, goBack } = useAppStore()
  const [progress, setProgress] = useState(0)
  const [steps, setSteps] = useState<UploadStep[]>([
    { label: 'Mempersiapkan data nota...', status: 'active' },
    { label: 'Mengupload ke Microsoft OneDrive...', status: 'pending' },
    { label: 'Menyelesaikan arsip...', status: 'pending' },
  ])
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    let progressVal = 0

    // Smoothly animate progress bar to 85% while waiting for network upload
    const interval = setInterval(() => {
      if (progressVal < 85) {
        progressVal += Math.random() * 5 + 1
        setProgress(Math.min(85, Math.round(progressVal)))
      }
    }, 250)

    const runUpload = async () => {
      try {
        if (active) {
          setSteps([
            { label: 'Mempersiapkan data nota...', status: 'done' },
            { label: 'Mengupload ke Microsoft OneDrive...', status: 'active' },
            { label: 'Menyelesaikan arsip...', status: 'pending' },
          ])
        }

        const fileName = `Laporan_Arsip_${new Date().toISOString().slice(0, 10)}.xlsx`
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Gagal mengupload file ke OneDrive')
        }

        clearInterval(interval)
        if (active) {
          setProgress(100)
          setSteps([
            { label: 'Mempersiapkan data nota...', status: 'done' },
            { label: 'Mengupload ke Microsoft OneDrive...', status: 'done' },
            { label: 'Menyelesaikan arsip...', status: 'done' },
          ])
          setDone(true)
          toast.success('Laporan Excel berhasil diupload ke OneDrive!')
          setTimeout(() => {
            navigate('onedrive')
          }, 1500)
        }
      } catch (err: any) {
        clearInterval(interval)
        if (active) {
          setFailed(true)
          toast.error(err.message || 'Gagal melakukan sinkronisasi')
          setSteps([
            { label: 'Mempersiapkan data nota...', status: 'done' },
            { label: 'Mengupload ke Microsoft OneDrive...', status: 'pending' },
            { label: 'Menyelesaikan arsip...', status: 'pending' },
          ])
        }
      }
    }

    runUpload()

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [navigate])

  return (
    <div className="min-h-screen bg-[#F8FAFF] pb-28">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <span className="text-lg font-bold text-blue-600">Notabase</span>
            <div className="flex items-center gap-3">
              <button className="relative flex h-9 w-9 items-center justify-center rounded-full text-blue-600 hover:bg-slate-100 transition-colors">
                <Bell className="h-5 w-5" />
              </button>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 border border-slate-200">
                AD
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-sm px-6 py-10 sm:max-w-md">
        {/* Upload icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-8 flex justify-center"
        >
          <div className={`flex h-24 w-24 items-center justify-center rounded-full transition-colors duration-500 ${failed ? 'bg-red-100' : done ? 'bg-emerald-100' : 'bg-blue-100'}`}>
            {failed ? (
              <XCircle className="h-12 w-12 text-red-500" />
            ) : done ? (
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            ) : (
              <UploadCloud className="h-12 w-12 text-blue-600 animate-bounce" />
            )}
          </div>
        </motion.div>

        {/* Title */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">
            {failed ? 'Upload Gagal' : done ? 'Upload Selesai!' : 'Mengupload ke OneDrive'}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {failed
              ? 'Terjadi kesalahan saat mengunggah file. Pastikan internet Anda aktif dan token OneDrive valid.'
              : done
              ? 'File laporan berhasil disimpan ke folder OneDrive Anda.'
              : 'Sinkronisasi arsip digital Anda dengan aman ke penyimpanan cloud pribadi.'}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-600">
              {failed ? 'Gagal' : done ? 'Selesai' : 'Sedang diproses...'}
            </span>
            <span className="font-bold text-blue-600">{progress}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
            <motion.div
              className={`h-full rounded-full ${failed ? 'bg-red-500' : done ? 'bg-emerald-500' : 'bg-blue-600'}`}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="mb-8 space-y-3">
          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="flex items-center gap-3"
            >
              {step.status === 'done' ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              ) : step.status === 'active' ? (
                <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                  <span className="absolute h-5 w-5 animate-ping rounded-full bg-blue-400 opacity-40" />
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-blue-600 bg-white" />
                </div>
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-slate-300" />
              )}
              <span className={`text-sm ${step.status === 'pending' ? 'text-slate-300' : step.status === 'done' ? 'text-slate-600' : 'font-semibold text-blue-700'}`}>
                {step.label}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Warning note */}
        <p className="text-center text-[11px] text-slate-400">
          Jangan tutup aplikasi selama proses berlangsung<br />untuk menghindari kegagalan data.
        </p>

        {/* Cancel / Back button */}
        {failed ? (
          <button
            onClick={() => goBack()}
            className="mt-6 w-full rounded-xl bg-slate-800 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 transition-colors"
          >
            Kembali
          </button>
        ) : !done ? (
          <button
            onClick={() => {
              toast.info('Upload dibatalkan')
              goBack()
            }}
            className="mt-6 w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors"
          >
            Batalkan Upload
          </button>
        ) : null}
      </main>
    </div>
  )
}
