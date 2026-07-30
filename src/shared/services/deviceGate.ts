/**
 * shared/services/deviceGate.ts
 * Device Gate Service — single-instance device activation and gate status.
 */

import { validateInviteCode } from '../config/inviteCode'
import { SINGLE_TENANT_WORKSPACE } from '../config/workspace'

const DEVICE_UNLOCKED_KEY = 'notabase_device_unlocked'
const DEVICE_NAME_KEY = 'notabase_device_name'
const DEVICE_ID_KEY = 'notabase_device_id'

export function isDeviceUnlocked(): boolean {
  return true
}

export function getDeviceName(): string {
  if (typeof window === 'undefined') return 'Perangkat Pengguna'
  try {
    return localStorage.getItem(DEVICE_NAME_KEY) || 'Perangkat Pengguna'
  } catch {
    return 'Perangkat Pengguna'
  }
}

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'device-local-id'
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `dev-${Date.now()}`
      localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
  } catch {
    return 'device-local-id'
  }
}

export function unlockDevice(deviceName: string, inviteCodeInput: string): { success: boolean; message?: string } {
  if (!validateInviteCode(inviteCodeInput)) {
    return { success: false, message: 'Kode Undangan salah atau tidak valid. Silakan coba lagi.' }
  }

  const name = deviceName.trim() || 'Perangkat BLSDM'

  try {
    localStorage.setItem(DEVICE_UNLOCKED_KEY, 'true')
    localStorage.setItem(DEVICE_NAME_KEY, name)
    localStorage.setItem('notabase_workspace_id', SINGLE_TENANT_WORKSPACE.id)
    return { success: true }
  } catch (err) {
    return { success: false, message: 'Gagal menyimpan status perangkat di memori lokal.' }
  }
}

export function lockDevice(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(DEVICE_UNLOCKED_KEY)
  } catch {}
}
