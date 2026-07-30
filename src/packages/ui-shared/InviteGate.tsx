'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, Lock, KeyRound, Building2, Laptop, ArrowRight, AlertCircle } from 'lucide-react'
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

    setTimeout(() => {
      const result = unlockDevice(deviceName, inviteCode)
      setLoading(false)

      if (result.success) {
        onSuccess()
      } else {
        setErrorMsg(result.message || 'Kode aktivasi tidak valid.')
      }
    }, 400)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4 font-sans text-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <Card className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-6 sm:p-8 shadow-2xl">
          {/* Header & Logo */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/30">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white">Aktivasi Perangkat</h1>
              <p className="text-xs font-medium text-slate-400 mt-1">
                Sistem Manajemen Nota <span className="font-bold text-blue-400">{SINGLE_TENANT_WORKSPACE.name}</span>
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {errorMsg && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/50 p-3 text-xs text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Laptop className="h-3.5 w-3.5 text-blue-400" />
                Nama Perangkat / Pemakai
              </Label>
              <Input
                type="text"
                required
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="Contoh: Laptop Admin Keuangan 01"
                className="h-11 rounded-xl border-slate-800 bg-slate-900 text-xs text-white placeholder:text-slate-500 focus-visible:border-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-blue-400" />
                Kode Undangan Aktivasi
              </Label>
              <Input
                type="password"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Masukkan kode rahasia instansi..."
                className="h-11 rounded-xl border-slate-800 bg-slate-900 text-xs font-mono text-white placeholder:text-slate-500 focus-visible:border-blue-500 tracking-wider"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition-all gap-2"
            >
              {loading ? (
                <span>Memverifikasi Kode...</span>
              ) : (
                <>
                  <span>Buka Akses Perangkat</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 border-t border-slate-800/80 pt-4 text-center">
            <p className="text-[10px] text-slate-500">
              Perangkat hanya perlu diaktivasi satu kali. Hubungi Admin Instansi jika Anda kehilangan Kode Undangan.
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
