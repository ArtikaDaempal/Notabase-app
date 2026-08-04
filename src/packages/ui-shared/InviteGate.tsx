'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, Lock, KeyRound, Laptop, ArrowRight, AlertCircle, Headphones, Info, Sparkles, CheckCircle2, Cloud } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { unlockDevice } from '@/shared/services/deviceGate'
import { SINGLE_TENANT_WORKSPACE } from '@/shared/config/workspace'

export interface InviteGateProps {
  onSuccess: () => void
}

export function InviteGate({ onSuccess }: InviteGateProps) {
  const [deviceName, setDeviceName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setLoading(true)

    const finalName = deviceName.trim() || 'Perangkat Instansi'

    setTimeout(() => {
      const result = unlockDevice(finalName, inviteCode)
      setLoading(false)

      if (result.success) {
        onSuccess()
      } else {
        setErrorMsg(result.message || 'Kode undangan aktivasi tidak valid. Silakan periksa kembali.')
      }
    }, 300)
  }

  return (
    <div className="min-h-screen w-full bg-[#F4F7FC] dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Header: Logo Komdigi + Logo NotaBase */}
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Logo Komdigi Image */}
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm p-1.5 shrink-0">
            <img src="/kominfo-logo.png" alt="Logo Komdigi" className="h-full w-full object-contain" />
          </div>
          
          {/* Header Titles */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                NotaBase
              </span>
              <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 dark:bg-blue-950/80 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-900">
                BLSDM MANADO
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Kementerian Komunikasi dan Digital RI
            </span>
          </div>
        </div>

        {/* Right Badge */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-200/60 dark:border-slate-800">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Sistem Terenkripsi</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-6xl mx-auto my-auto py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        
        {/* LEFT PANEL: Dynamic 3D Animated Computer Display (Desktop Only) */}
        <div className="hidden lg:flex lg:col-span-6 flex-col space-y-6 pr-4">
          
          {/* Dynamic Interactive Laptop Illustration */}
          <div className="relative w-full max-w-lg h-64 flex items-center justify-center">
            {/* Ambient Glowing Background */}
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 via-indigo-500/15 to-sky-400/20 rounded-full blur-3xl" />
            
            {/* Floating Particles */}
            <motion.div
              animate={{ y: [-6, 6, -6], rotate: [0, 5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-2 left-6 z-20 flex items-center gap-1.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-2 text-[10px] font-bold text-blue-600 dark:text-blue-400 shadow-lg backdrop-blur-md"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>AI Gemini OCR</span>
            </motion.div>

            <motion.div
              animate={{ y: [6, -6, 6] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute bottom-4 right-2 z-20 flex items-center gap-1.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-2 text-[10px] font-bold text-slate-700 dark:text-slate-300 shadow-lg backdrop-blur-md"
            >
              <Cloud className="h-3.5 w-3.5 text-sky-500" />
              <span>OneDrive Sync</span>
            </motion.div>

            {/* Laptop Body & Display */}
            <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
              {/* Laptop Screen Frame */}
              <div className="w-full h-44 rounded-2xl bg-slate-900 p-2 shadow-2xl border border-slate-700/80 relative overflow-hidden flex flex-col">
                {/* Screen Header Bar */}
                <div className="flex items-center justify-between px-2 py-1 bg-slate-950/80 rounded-t-xl border-b border-slate-800">
                  <div className="flex gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-red-500/80" />
                    <div className="h-2 w-2 rounded-full bg-amber-500/80" />
                    <div className="h-2 w-2 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-[9px] font-mono text-slate-400">notabase-secure-gate.app</span>
                </div>

                {/* Inner Screen Display Content */}
                <div className="flex-1 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-b-xl relative overflow-hidden flex items-center justify-center p-4">
                  {/* Laser Scanner Animation Line */}
                  <motion.div
                    animate={{ y: [-40, 40, -40] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#38bdf8]"
                  />

                  {/* Receipt Preview Artwork */}
                  <div className="w-32 bg-white/10 backdrop-blur-md rounded-xl border border-white/15 p-2.5 space-y-1.5 shadow-inner">
                    <div className="h-1.5 w-16 bg-blue-400/80 rounded-full" />
                    <div className="h-1 w-24 bg-white/40 rounded-full" />
                    <div className="h-1 w-20 bg-white/30 rounded-full" />
                    <div className="pt-1 flex justify-between">
                      <div className="h-1 w-8 bg-emerald-400/80 rounded-full" />
                      <div className="h-1 w-6 bg-blue-400/80 rounded-full" />
                    </div>
                  </div>

                  {/* 3D Shield Badge Centered */}
                  <motion.div
                    animate={{ scale: [0.95, 1.05, 0.95] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute h-12 w-12 rounded-2xl bg-blue-600/90 border border-blue-400/50 shadow-lg shadow-blue-500/50 flex items-center justify-center text-white backdrop-blur-md"
                  >
                    <ShieldCheck className="h-7 w-7" />
                  </motion.div>
                </div>
              </div>

              {/* Laptop Keyboard Base */}
              <div className="w-[108%] h-3.5 bg-gradient-to-b from-slate-300 to-slate-400 dark:from-slate-700 dark:to-slate-800 rounded-b-xl shadow-md border-t border-slate-200 dark:border-slate-700 flex justify-center">
                <div className="w-16 h-1 bg-slate-400 dark:bg-slate-600 rounded-b-sm" />
              </div>
            </div>

          </div>

          <div>
            <span className="inline-block bg-blue-100/80 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-semibold px-3.5 py-1 rounded-full">
              Langkah Awal
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-3">
              Aktivasi Perangkat
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 font-medium">
              Ini adalah langkah pertama untuk menggunakan NotaBase.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100/70 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Aman & Terpercaya</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Perangkat Anda dilindungi dengan sistem enkripsi instansi yang aman.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100/70 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
                <Laptop className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Satu Perangkat, Satu Akun</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Setiap akun hanya dapat digunakan pada satu perangkat yang terverifikasi.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 p-4 flex items-center gap-3 mt-4 shadow-2xs">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400">
              <Headphones className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Butuh bantuan?</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Hubungi admin instansi jika Anda kehilangan kode undangan.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL / CARD (Desktop & Mobile) */}
        <div className="col-span-1 lg:col-span-6 w-full max-w-md mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none">
              
              {/* Top Shield Icon */}
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 text-blue-600 dark:text-blue-400 shadow-sm">
                  <ShieldCheck className="h-9 w-9" />
                </div>
              </div>

              {/* Card Title & Subtitle */}
              <div className="text-center mt-4">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Aktivasi Perangkat
                </h2>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                  Sistem Manajemen Nota
                </p>
                <span className="inline-block text-xs font-extrabold text-blue-600 dark:text-blue-400 tracking-wide mt-0.5">
                  {SINGLE_TENANT_WORKSPACE.name}
                </span>
              </div>

              {/* Helper text */}
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-3 max-w-xs mx-auto leading-relaxed">
                Perangkat ini belum terdaftar. Silakan masukkan informasi di bawah ini untuk mengaktifkannya.
              </p>

              {/* Form */}
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {errorMsg && (
                  <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/50 p-3 text-xs text-red-600 dark:text-red-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Laptop className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    Nama Perangkat / Pemakai
                  </Label>
                  <Input
                    type="text"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="Contoh: Laptop Admin Keuangan 01"
                    className="h-11 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus-visible:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    Kode Undangan Aktivasi
                  </Label>
                  <Input
                    type="password"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="Masukkan kode rahasia instansi..."
                    className="h-11 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus-visible:ring-blue-500 tracking-wider"
                  />
                </div>

                {/* Info Note Box */}
                <div className="rounded-2xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-950/40 p-3.5 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 mt-0.5">
                    <Info className="h-3.5 w-3.5" />
                  </div>
                  <p className="leading-normal text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    <span className="font-bold text-slate-800 dark:text-slate-200">Perangkat hanya perlu diaktivasi satu kali.</span> Setelah aktif, Anda akan langsung masuk ke beranda.
                  </p>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="mt-2 w-full h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold text-xs sm:text-sm shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <span>Memverifikasi Kode...</span>
                  ) : (
                    <>
                      <span>Aktivasi Perangkat</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

            </Card>

            {/* Bottom note under card */}
            <div className="mt-4 text-center">
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium flex items-center justify-center gap-1.5">
                <Lock className="h-3 w-3 text-slate-400" />
                <span>Aktivasi ini diperlukan hanya pada penggunaan pertama.</span>
              </p>
            </div>
          </motion.div>
        </div>

      </div>

      <div className="w-full text-center text-[10px] text-slate-400 dark:text-slate-600 font-medium py-2">
        NotaBase Management System • {SINGLE_TENANT_WORKSPACE.name}
      </div>
    </div>
  )
}


