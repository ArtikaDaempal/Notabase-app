'use client'

/**
 * use-network-status.ts
 * Reactive hook for tracking online/offline status.
 */

import { useEffect, useState, useCallback } from 'react'

export interface NetworkStatus {
  /** Whether the browser has a network connection right now */
  isOnline: boolean
  /** True for ~5 s after coming back online (for "back online" banner) */
  wasOffline: boolean
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [wasOffline, setWasOffline] = useState(false)

  const handleOnline = useCallback(() => {
    setIsOnline(true)
    setWasOffline(true)
    // Clear the "was offline" flag after 5 s
    setTimeout(() => setWasOffline(false), 5000)
  }, [])

  const handleOffline = useCallback(() => {
    setIsOnline(false)
  }, [])

  useEffect(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [handleOnline, handleOffline])

  return { isOnline, wasOffline }
}
