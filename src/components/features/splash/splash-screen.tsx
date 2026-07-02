'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/store/app-store'
import { NotabaseLogo } from '@/components/layout/logo'

export function SplashScreen() {
  const navigate = useAppStore((s) => s.navigate)

  useEffect(() => {
    const t = setTimeout(() => navigate('dashboard'), 2600)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div className="splash-gradient fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden">
      {/* Top org label */}
      <div className="absolute top-6 left-6 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 via-emerald-400 to-orange-400 text-[10px] font-black text-white">
          K
        </div>
        <span className="text-[11px] font-semibold text-slate-600">
          BPSDMP KOMINFO MANADO
        </span>
      </div>

      {/* Center logo + title */}
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="flex flex-col items-center"
      >
        <motion.div
          initial={{ rotate: -8 }}
          animate={{ rotate: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="mb-6"
        >
          <NotabaseLogo size={96} />
        </motion.div>
        <h1 className="text-4xl font-extrabold tracking-tight text-primary">
          NOTABASE
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Digital Receipt Management System
        </p>
      </motion.div>

      {/* Loading bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.4 }}
        className="absolute bottom-32 flex w-64 flex-col items-center gap-3"
      >
        <div className="h-1 w-full overflow-hidden rounded-full bg-blue-100">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-blue-400 to-primary"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 2, ease: 'easeInOut' }}
          />
        </div>
        <span className="text-xs text-slate-500">Memuat aplikasi...</span>
      </motion.div>

      {/* Footer */}
      <div className="absolute bottom-6 flex items-center gap-1.5 text-slate-400">
        <div className="h-4 w-4 rounded-sm bg-slate-300" />
        <span className="text-[11px] font-semibold tracking-wide">
          AETERNA CLOUD
        </span>
      </div>

      {/* Decorative wave */}
      <svg
        className="absolute bottom-0 left-0 w-full"
        viewBox="0 0 375 120"
        fill="none"
        preserveAspectRatio="none"
        style={{ height: '20%' }}
      >
        <path
          d="M0 60C60 90 140 100 200 70C260 40 330 30 375 50V120H0V60Z"
          fill="#D6E6FF"
          fillOpacity="0.6"
        />
        <path
          d="M0 80C70 110 150 110 210 85C270 60 330 50 375 70V120H0V80Z"
          fill="#C7DDFF"
          fillOpacity="0.5"
        />
      </svg>
    </div>
  )
}
