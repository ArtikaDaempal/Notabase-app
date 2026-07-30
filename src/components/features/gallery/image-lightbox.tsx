'use client'

/**
 * image-lightbox.tsx
 * Full-screen lightbox for viewing receipt images with
 * navigation, zoom, rotate, and download controls.
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
        setRotation(0) // Already applied via canvas
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

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'r' || e.key === 'R') rotateRight()
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
        className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        {/* ── Top toolbar ── */}
        <div className="flex shrink-0 items-center justify-between px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{receipt.merchantName}</p>
            <p className="text-[11px] text-white/60">
              {formatDateID(receipt.transactionDate)} · {formatRupiah(receipt.total)}
            </p>
          </div>

          <div className="flex items-center gap-1.5 pl-3">
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

        {/* ── Image area ── */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          {/* Prev */}
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="absolute left-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-20 transition-all"
            aria-label="Sebelumnya"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Image */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.18 }}
              className="flex max-h-full max-w-full items-center justify-center px-16"
            >
              {currentImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  ref={imgRef}
                  src={currentImageUrl}
                  alt={receipt.merchantName}
                  className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transition: 'transform 0.2s',
                  }}
                />
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
            className="absolute right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-20 transition-all"
            aria-label="Berikutnya"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* ── Bottom toolbar ── */}
        <div className="shrink-0 border-t border-white/10 bg-black/60 px-4 py-3">
          <div className="mx-auto flex max-w-md items-center justify-between gap-2">
            {/* Image controls */}
            <div className="flex items-center gap-1">
              <ToolBtn onClick={rotateLeft}  label="Putar Kiri">
                <RotateCcw className="h-4 w-4" />
              </ToolBtn>
              <ToolBtn onClick={rotateRight} label="Putar Kanan">
                <RotateCw className="h-4 w-4" />
              </ToolBtn>
              <ToolBtn
                onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                label="Perbesar"
                disabled={zoom >= 3}
              >
                <ZoomIn className="h-4 w-4" />
              </ToolBtn>
              <ToolBtn
                onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                label="Perkecil"
                disabled={zoom <= 0.5}
              >
                <ZoomOut className="h-4 w-4" />
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
                  'flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors',
                  'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40'
                )}
              >
                <Download className="h-3.5 w-3.5" />
                {isDownloading ? 'Mengunduh...' : 'Download'}
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
      className="flex h-9 w-9 items-center justify-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30 transition-colors"
    >
      {children}
    </button>
  )
}
