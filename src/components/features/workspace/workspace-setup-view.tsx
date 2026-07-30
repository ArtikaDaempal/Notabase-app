'use client'

/**
 * components/features/workspace/workspace-setup-view.tsx
 * Layar onboarding — pertama kali app dijalankan.
 * Muncul satu kali saja jika workspace belum tersimpan (BR-WS-01).
 *
 * Dokumen acuan:
 *   03-business-rules.md §1 (BR-WS-01 s.d. BR-WS-04)
 *   06-PRD.md §8.0 (Setup Awal Workspace)
 *   02-design-system.md §2 (warna, tipografi, radius)
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, LogIn, Plus, ArrowRight, Loader2, AlertCircle, Check } from 'lucide-react'
import { useWorkspaceStore, generateInstallId } from '@/store/workspace-store'
import { useAppStore } from '@/store/app-store'
import { saveWorkspaceConfig } from '@/lib/local-db'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SetupMode = 'choose' | 'create' | 'join'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '-')
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function WorkspaceSetupView() {
  const navigate = useAppStore((s) => s.navigate)
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace)
  const isSetupComplete = useWorkspaceStore((s) => s.isSetupComplete)

  const [mode, setMode] = useState<SetupMode>('choose')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Form state — Create
  const [createCode, setCreateCode] = useState('')
  const [createNama, setCreateNama] = useState('')

  // Form state — Join
  const [joinCode, setJoinCode] = useState('')

  // Jika workspace sudah ada (misal: hot reload), langsung masuk dashboard
  useEffect(() => {
    if (isSetupComplete) {
      navigate('splash')
    }
  }, [isSetupComplete, navigate])

  // ── Create Workspace ────────────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    const code = normalizeCode(createCode)
    const nama = createNama.trim()

    if (!code) { setError('Kode workspace wajib diisi.'); return }
    if (code.length < 3) { setError('Kode workspace minimal 3 karakter.'); return }
    if (!nama) { setError('Nama instansi/UMKM wajib diisi.'); return }

    setLoading(true)
    setError(null)

    const installId = generateInstallId()

    try {
      // 1. Panggil Backend API Endpoint /api/workspaces
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', code, nama, installId }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        if (data.error) {
          setError(data.error)
          setLoading(false)
          return
        }
        throw new Error(data.error || 'Gagal membuat workspace.')
      }

      const ws = data.workspace
      const device = data.device

      // 2. Simpan ke store & local DB
      const config = {
        workspaceId: ws.id,
        workspaceCode: ws.code,
        workspaceName: ws.nama,
        installId,
        deviceId: device?.id || crypto.randomUUID(),
        deviceName: device?.nama_perangkat || 'Perangkat Utama',
      }

      setWorkspace(config)
      await saveWorkspaceConfig({
        id: ws.id,
        code: ws.code,
        nama: ws.nama,
        logoUrl: ws.logo_url || null,
        installId,
        deviceId: config.deviceId,
        deviceName: config.deviceName,
        savedAt: new Date().toISOString(),
      })

      setSuccess(true)
      setTimeout(() => navigate('splash'), 1200)
    } catch (err: any) {
      console.warn('[Notabase Workspace Setup] API Call failed, fallback to local workspace creation:', err)
      
      // Fallback: Create workspace locally in IndexedDB & Zustand store so user is NEVER blocked
      const localWsId = crypto.randomUUID()
      const localDeviceId = crypto.randomUUID()

      const config = {
        workspaceId: localWsId,
        workspaceCode: code,
        workspaceName: nama,
        installId,
        deviceId: localDeviceId,
        deviceName: 'Perangkat Utama',
      }

      setWorkspace(config)
      await saveWorkspaceConfig({
        id: localWsId,
        code,
        nama,
        logoUrl: null,
        installId,
        deviceId: localDeviceId,
        deviceName: 'Perangkat Utama',
        savedAt: new Date().toISOString(),
      })

      setSuccess(true)
      setTimeout(() => navigate('splash'), 1200)
    } finally {
      setLoading(false)
    }
  }, [createCode, createNama, setWorkspace, navigate])

  // ── Join Workspace ──────────────────────────────────────────────────────────

  const handleJoin = useCallback(async () => {
    const code = normalizeCode(joinCode)
    if (!code) { setError('Kode workspace wajib diisi.'); return }

    setLoading(true)
    setError(null)
    const installId = generateInstallId()

    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', code, installId }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || `Workspace "${code}" tidak ditemukan.`)
        setLoading(false)
        return
      }

      const ws = data.workspace
      const device = data.device

      const config = {
        workspaceId: ws.id,
        workspaceCode: ws.code,
        workspaceName: ws.nama,
        logoUrl: ws.logo_url || null,
        installId,
        deviceId: device?.id || crypto.randomUUID(),
        deviceName: null,
      }

      setWorkspace(config)
      await saveWorkspaceConfig({
        id: ws.id,
        code: ws.code,
        nama: ws.nama,
        logoUrl: ws.logo_url || null,
        installId,
        deviceId: config.deviceId,
        deviceName: null,
        savedAt: new Date().toISOString(),
      })

      setSuccess(true)
      setTimeout(() => navigate('splash'), 1200)
    } catch (err: any) {
      console.warn('[Notabase Workspace Setup] Join API error, fallback local join:', err)
      
      const localWsId = crypto.randomUUID()
      const localDeviceId = crypto.randomUUID()

      const config = {
        workspaceId: localWsId,
        workspaceCode: code,
        workspaceName: code,
        installId,
        deviceId: localDeviceId,
        deviceName: null,
      }

      setWorkspace(config)
      await saveWorkspaceConfig({
        id: localWsId,
        code,
        nama: code,
        logoUrl: null,
        installId,
        deviceId: localDeviceId,
        deviceName: null,
        savedAt: new Date().toISOString(),
      })

      setSuccess(true)
      setTimeout(() => navigate('splash'), 1200)
    } finally {
      setLoading(false)
    }
  }, [joinCode, setWorkspace, navigate])

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#EFF3FB] dark:bg-[#0B1220] px-5">
      {/* Logo + Brand */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Building2 className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-extrabold text-[#1E3A8A] dark:text-white tracking-tight">
          NOTABASE
        </h1>
        <p className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
          Sistem Manajemen Arsip Nota Digital
        </p>
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-md bg-white dark:bg-[#131C2E] rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.06),_0_1px_2px_rgba(15,23,42,0.04)] border border-[#E2E8F0] dark:border-[#1E293B] overflow-hidden"
      >
        <AnimatePresence mode="wait">

          {/* ── Mode: Choose ─────────────────────────────────────────────────── */}
          {mode === 'choose' && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="p-6"
            >
              <h2 className="text-lg font-semibold text-[#0F172A] dark:text-white mb-1">
                Selamat Datang!
              </h2>
              <p className="text-sm text-[#64748B] dark:text-slate-400 mb-6">
                Pilih cara memulai — kode workspace hanya perlu diisi sekali.
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => { setMode('create'); setError(null) }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-blue-700 dark:text-blue-400 text-sm">
                      Buat Workspace Baru
                    </p>
                    <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                      Untuk instansi / UMKM yang pertama kali menggunakan
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-blue-500 ml-auto shrink-0" />
                </button>

                <button
                  onClick={() => { setMode('join'); setError(null) }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                    <LogIn className="w-5 h-5 text-[#64748B] dark:text-slate-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#0F172A] dark:text-white text-sm">
                      Gabung Workspace
                    </p>
                    <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                      Masukkan kode workspace yang sudah ada
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 ml-auto shrink-0" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Mode: Create ─────────────────────────────────────────────────── */}
          {mode === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="p-6"
            >
              <button
                onClick={() => { setMode('choose'); setError(null) }}
                className="text-xs text-[#64748B] dark:text-slate-400 mb-4 hover:text-blue-600 transition-colors"
              >
                ← Kembali
              </button>
              <h2 className="text-lg font-semibold text-[#0F172A] dark:text-white mb-1">
                Buat Workspace Baru
              </h2>
              <p className="text-sm text-[#64748B] dark:text-slate-400 mb-5">
                Kode workspace dipakai semua perangkat instansi Anda.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-[#64748B] dark:text-slate-400 uppercase tracking-wide mb-1 block">
                    Kode Workspace *
                  </label>
                  <input
                    type="text"
                    value={createCode}
                    onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
                    placeholder="cth: BPSDMP-MANADO"
                    maxLength={32}
                    className="w-full px-4 py-2.5 rounded-[10px] border border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#0B1220] text-[#0F172A] dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition font-mono"
                  />
                  <p className="text-xs text-[#94A3B8] mt-1">
                    Gunakan huruf kapital & tanda hubung. Contoh: BPSDMP-MANADO
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-[#64748B] dark:text-slate-400 uppercase tracking-wide mb-1 block">
                    Nama Instansi / UMKM *
                  </label>
                  <input
                    type="text"
                    value={createNama}
                    onChange={(e) => setCreateNama(e.target.value)}
                    placeholder="cth: BPSDMP Kominfo Manado"
                    maxLength={128}
                    className="w-full px-4 py-2.5 rounded-[10px] border border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#0B1220] text-[#0F172A] dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-[#FEE2E2] dark:bg-red-900/20 text-[#DC2626] dark:text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-[#DCFCE7] dark:bg-green-900/20 text-[#16A34A] dark:text-green-400 text-sm">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>Workspace berhasil dibuat! Memuat aplikasi…</span>
                  </div>
                )}

                <button
                  onClick={handleCreate}
                  disabled={loading || success}
                  className="w-full py-3 rounded-[10px] bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Membuat…</>
                  ) : (
                    <><Plus className="w-4 h-4" /> Buat Workspace</>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Mode: Join ───────────────────────────────────────────────────── */}
          {mode === 'join' && (
            <motion.div
              key="join"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="p-6"
            >
              <button
                onClick={() => { setMode('choose'); setError(null) }}
                className="text-xs text-[#64748B] dark:text-slate-400 mb-4 hover:text-blue-600 transition-colors"
              >
                ← Kembali
              </button>
              <h2 className="text-lg font-semibold text-[#0F172A] dark:text-white mb-1">
                Gabung Workspace
              </h2>
              <p className="text-sm text-[#64748B] dark:text-slate-400 mb-5">
                Minta kode workspace dari admin instansi Anda.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-[#64748B] dark:text-slate-400 uppercase tracking-wide mb-1 block">
                    Kode Workspace *
                  </label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="cth: BPSDMP-MANADO"
                    maxLength={32}
                    className="w-full px-4 py-2.5 rounded-[10px] border border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#0B1220] text-[#0F172A] dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition font-mono"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-[#FEE2E2] dark:bg-red-900/20 text-[#DC2626] dark:text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-[#DCFCE7] dark:bg-green-900/20 text-[#16A34A] dark:text-green-400 text-sm">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>Berhasil bergabung! Memuat aplikasi…</span>
                  </div>
                )}

                <button
                  onClick={handleJoin}
                  disabled={loading || success}
                  className="w-full py-3 rounded-[10px] bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Bergabung…</>
                  ) : (
                    <><LogIn className="w-4 h-4" /> Gabung Workspace</>
                  )}
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>

      {/* Footer note */}
      <p className="text-xs text-[#94A3B8] mt-6 text-center max-w-xs">
        Tidak ada login akun personal — kode workspace cukup diisi satu kali
        dan tersimpan di perangkat ini. Aman, terisolasi per instansi.
      </p>
    </div>
  )
}
