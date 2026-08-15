'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/store/app-store'

export function SplashScreen() {
  const navigate = useAppStore((s) => s.navigate)

  useEffect(() => {
    const t = setTimeout(() => navigate('dashboard'), 1800)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div className="splash-gradient fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden">
      {/* Top org label */}
      <div className="absolute top-8 left-8 flex items-center gap-3">
        <img
          src="/kominfo-logo.png"
          alt="Logo Kominfo"
          className="h-10 w-10 object-contain"
        />
        <div className="flex flex-col text-left leading-tight">
          <span className="text-[13px] font-extrabold tracking-wide text-[#1E3A8A]">
            BPSDMP KOMINFO
          </span>
          <span className="text-[13px] font-extrabold tracking-wide text-[#1E3A8A]">
            MANADO
          </span>
        </div>
      </div>

      {/* Center logo + title */}
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="flex flex-col items-center max-w-xs sm:max-w-md px-4"
      >
        <img
          src="/notabase-logo-clean.png"
          alt="Notabase Logo"
          className="w-64 sm:w-80 h-auto object-contain drop-shadow-md"
          onError={(e) => {
            // Fallback to /notabase-logo.png if /notabase-logo-clean.png fails
            (e.target as HTMLImageElement).src = '/notabase-logo.png'
          }}
        />
      </motion.div>

      {/* Loading bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="absolute bottom-32 flex w-64 flex-col items-center gap-2"
      >
        <span className="text-xs font-medium text-slate-500">Memuat aplikasi...</span>
        <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200">
          <motion.div
            className="h-full rounded-full bg-blue-600"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.4, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>

      {/* Footer */}
      <div className="absolute bottom-8 flex items-center gap-2 text-slate-500 font-semibold tracking-widest text-[10px]">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-slate-400"
        >
          <rect x="2" y="3" width="20" height="8" rx="2" ry="2" />
          <rect x="2" y="13" width="20" height="8" rx="2" ry="2" />
          <line x1="6" y1="7" x2="6.01" y2="7" />
          <line x1="6" y1="17" x2="6.01" y2="17" />
        </svg>
        <span>AETERNA CLOUD</span>
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
        >
          <animate attributeName="d" dur="10s" repeatCount="indefinite"
            values="
              M0 60C60 90 140 100 200 70C260 40 330 30 375 50V120H0V60Z;
              M0 50C80 80 150 90 220 60C290 30 340 40 375 60V120H0V50Z;
              M0 60C60 90 140 100 200 70C260 40 330 30 375 50V120H0V60Z
            "
          />
        </path>
        <path
          d="M0 80C70 110 150 110 210 85C270 60 330 50 375 70V120H0V80Z"
          fill="#C7DDFF"
          fillOpacity="0.5"
        >
          <animate attributeName="d" dur="8s" repeatCount="indefinite"
            values="
              M0 80C70 110 150 110 210 85C270 60 330 50 375 70V120H0V80Z;
              M0 70C90 100 160 95 230 75C300 55 350 65 375 80V120H0V70Z;
              M0 80C70 110 150 110 210 85C270 60 330 50 375 70V120H0V80Z
            "
          />
        </path>
      </svg>
    </div>
  )
}
