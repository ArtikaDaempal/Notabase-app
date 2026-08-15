'use client'

/**
 * image-lightbox.tsx
 * Full-screen lightbox for viewing receipt images with
 * navigation, zoom (+/-), mouse wheel zoom, double-click zoom,
 * rotate, drag/pan, and download controls.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Download,
  ExternalLink,
  FileText,
  Maximize2,
  RefreshCw,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { formatRupiah, formatDateID } from '@/lib/utils'
import { downloadReceiptImage, rotateImage } from '@/lib/download-image'
import type { Receipt } from '@/types'
import { cn } from '@/lib/utils'

interface ImageLightboxProps {
  receipts: Receipt[]
  initialIndex: number
  onClose: () => void
}

export function ImageLightbox({ receipts, initialIndex, onClose }: ImageLightboxProps) {
  const { openReceipt } = useAppStore()
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [rotation, setRotation] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const receipt = receipts[currentIndex]

  // Reset state when receipt changes
  useEffect(() => {
    setRotation(0)
    setZoom(1)
    setCurrentImageUrl(receipt?.imageUrl ?? null)
  }, [currentIndex, receipt])

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, receipts.length - 1))
  }, [receipts.length])

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0))
  }, [])

  const rotateRight = useCallback(async () => {
    const newRotation = (rotation + 90) % 360
    setRotation(newRotation)
    if (currentImageUrl) {
      try {
        const rotated = await rotateImage(currentImageUrl, 90)
        setCurrentImageUrl(rotated)
        setRotation(0)
      } catch {
        // Fallback to CSS rotation if canvas fails
      }
    }
  }, [rotation, currentImageUrl])

  const rotateLeft = useCallback(async () => {
    const newRotation = (rotation - 90 + 360) % 360
    setRotation(newRotation)
    if (currentImageUrl) {
      try {
        const rotated = await rotateImage(currentImageUrl, 270)
        setCurrentImageUrl(rotated)
        setRotation(0)
      } catch { /* fallback */ }
    }
  }, [rotation, currentImageUrl])

  const handleDownload = useCallback(async () => {
    if (!currentImageUrl || !receipt) return
    setIsDownloading(true)
    try {
      const name = receipt.namaToko || receipt.merchantName || 'Nota'
      const date = receipt.tanggal || receipt.transactionDate || new Date().toISOString()
      await downloadReceiptImage(currentImageUrl, name, date)
    } catch {
      // silent fail
    } finally {
      setIsDownloading(false)
    }
  }, [currentImageUrl, receipt])

  // Mouse Wheel Zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(+(z + 0.25).toFixed(2), 4))
    } else {
      setZoom((z) => Math.max(+(z - 0.25).toFixed(2), 0.5))
    }
  }, [])

  // Double click to toggle 1x / 2.2x zoom
  const handleDoubleClick = useCallback(() => {
    setZoom((z) => (z > 1.2 ? 1 : 2.2))
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'r' || e.key === 'R') rotateRight()
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(+(z + 0.25).toFixed(2), 4))
      if (e.key === '-') setZoom((z) => Math.max(+(z - 0.25).toFixed(2), 0.5))
      if (e.key === '0') setZoom(1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, goNext, goPrev, rotateRight])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  if (!receipt) return null

  return (
    <AnimatePresence>
      <motion.div
        key="lightbox"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md select-none"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        {/* ── Top toolbar ── */}
        <div className="flex shrink-0 items-center justify-between px-4 py-3 bg-black/40 backdrop-blur-lg border-b border-white/10 z-20">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{receipt.merchantName}</p>
            <p className="text-[11px] text-white/60">
              {formatDateID(receipt.transactionDate)} · {formatRupiah(receipt.total)}
            </p>
          </div>

          <div className="flex items-center gap-2 pl-3">
            {/* Zoom percentage badge */}
            <button
              onClick={() => setZoom(1)}
              title="Reset Zoom (100%)"
              className="flex items-center gap-1 rounded-full bg-blue-600/80 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-600 transition-all shadow-xs"
            >
              {Math.round(zoom * 100)}%
              {zoom !== 1 && <RefreshCw className="h-3 w-3 ml-0.5" />}
            </button>

            {/* Counter */}
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/70">
              {currentIndex + 1} / {receipts.length}
            </span>

            {/* Close */}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Image area (Supports wheel zoom, double-click, drag) ── */}
        <div
          className="relative flex flex-1 items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
          onWheel={handleWheel}
        >
          {/* Prev */}
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="absolute left-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 disabled:opacity-20 transition-all shadow-lg backdrop-blur-xs"
            aria-label="Sebelumnya"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          {/* Image Canvas Container */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="flex max-h-full max-w-full items-center justify-center p-4 sm:p-8"
              onDoubleClick={handleDoubleClick}
            >
              {currentImageUrl ? (
                <motion.div
                  drag={zoom > 1}
                  dragConstraints={{ left: -400 * zoom, right: 400 * zoom, top: -400 * zoom, bottom: 400 * zoom }}
                  dragElastic={0.05}
                  className="relative flex items-center justify-center"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imgRef}
                    src={currentImageUrl}
                    alt={receipt.merchantName}
                    className="max-h-[82vh] max-w-[90vw] rounded-xl object-contain shadow-2xl transition-transform duration-150 ease-out pointer-events-none"
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    }}
                  />
                </motion.div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/5 p-12 text-center">
                  <FileText className="h-16 w-16 text-white/20" />
                  <p className="text-sm text-white/50">Nota Manual — tidak ada gambar</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Next */}
          <button
            onClick={goNext}
            disabled={currentIndex === receipts.length - 1}
            className="absolute right-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 disabled:opacity-20 transition-all shadow-lg backdrop-blur-xs"
            aria-label="Berikutnya"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        {/* ── Bottom toolbar ── */}
        <div className="shrink-0 border-t border-white/10 bg-black/80 backdrop-blur-md px-4 py-3 z-20">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-2">
            {/* Image controls */}
            <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-2xl">
              <ToolBtn onClick={rotateLeft} label="Putar Kiri (R)">
                <RotateCcw className="h-4 w-4" />
              </ToolBtn>
              <ToolBtn onClick={rotateRight} label="Putar Kanan (R)">
                <RotateCw className="h-4 w-4" />
              </ToolBtn>
              <div className="h-4 w-px bg-white/20 mx-0.5" />
              <ToolBtn
                onClick={() => setZoom((z) => Math.max(+(z - 0.25).toFixed(2), 0.5))}
                label="Perkecil (-)"
                disabled={zoom <= 0.5}
              >
                <ZoomOut className="h-4 w-4" />
              </ToolBtn>
              <button
                onClick={() => setZoom(1)}
                className="px-2 text-xs font-bold text-white/80 hover:text-white transition-colors"
                title="Reset ke 100%"
              >
                {Math.round(zoom * 100)}%
              </button>
              <ToolBtn
                onClick={() => setZoom((z) => Math.min(+(z + 0.25).toFixed(2), 4))}
                label="Perbesar (+)"
                disabled={zoom >= 4}
              >
                <ZoomIn className="h-4 w-4" />
              </ToolBtn>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { openReceipt(receipt.id); onClose() }}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-white/20 px-3 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Detail Nota
              </button>
              <button
                onClick={handleDownload}
                disabled={!currentImageUrl || isDownloading}
                className={cn(
                  'flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold transition-all shadow-md',
                  'bg-blue-600 text-white hover:bg-blue-500 active:scale-95 disabled:opacity-40'
                )}
              >
                <Download className="h-3.5 w-3.5" />
                {isDownloading ? 'Mengunduh...' : 'Unduh'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function ToolBtn({
  children,
  onClick,
  label,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-xl text-white/70 hover:bg-white/20 hover:text-white disabled:opacity-30 transition-all"
    >
      {children}
    </button>
  )
}
