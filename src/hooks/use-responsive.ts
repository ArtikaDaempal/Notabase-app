'use client'

import { useState, useEffect } from 'react'

/**
 * Custom hook to detect if current device/window is desktop/laptop (width >= 768px).
 */
export function useIsDesktop(breakpointMs: number = 768): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkIsDesktop = () => {
      setIsDesktop(window.innerWidth >= breakpointMs)
    }

    checkIsDesktop()
    window.addEventListener('resize', checkIsDesktop)
    return () => window.removeEventListener('resize', checkIsDesktop)
  }, [breakpointMs])

  return isDesktop
}
