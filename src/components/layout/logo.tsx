import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  size?: number
}

/** Komdigi logo — uses the official logo image from /public */
export function NotabaseLogo({ className, size = 40 }: LogoProps) {
  return (
    <div
      className={cn('flex items-center justify-center overflow-hidden rounded-xl bg-white border border-slate-100 shadow-xs', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label="Komdigi"
    >
      <Image
        src="/kominfo-logo.png"
        alt="Komdigi Logo"
        width={size}
        height={size}
        className="object-contain"
        style={{ width: size * 0.85, height: size * 0.85 }}
      />
    </div>
  )
}

/** Wordmark with Komdigi logo */
export function NotabaseWordmark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <NotabaseLogo size={32} />
      <span className="text-xl font-bold tracking-tight text-primary">NotaBase</span>
    </div>
  )
}

