import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  size?: number
}

/** Notabase document-style logo */
export function NotabaseLogo({ className, size = 40 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={cn('text-primary', className)}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Notabase"
    >
      <rect width="48" height="48" rx="12" fill="url(#nb-grad)" />
      <path
        d="M14 12h14l6 6v18a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2Z"
        fill="white"
        fillOpacity="0.95"
      />
      <path d="M28 12v6h6" fill="white" fillOpacity="0.7" />
      <rect x="17" y="22" width="14" height="2.2" rx="1.1" fill="#2563EB" />
      <rect x="17" y="26.5" width="14" height="2.2" rx="1.1" fill="#2563EB" fillOpacity="0.8" />
      <rect x="17" y="31" width="9" height="2.2" rx="1.1" fill="#2563EB" fillOpacity="0.6" />
      <defs>
        <linearGradient id="nb-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#0B5ED7" />
        </linearGradient>
      </defs>
    </svg>
  )
}

/** Wordmark with logo */
export function NotabaseWordmark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <NotabaseLogo size={32} />
      <span className="text-xl font-bold tracking-tight text-primary">Notabase</span>
    </div>
  )
}
