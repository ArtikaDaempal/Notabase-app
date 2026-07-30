/**
 * shared/config/inviteCode.ts
 * Master Invite Code for Device Gate Activation (Hard-to-guess secret key).
 */

export const MASTER_INVITE_CODE = 'KOMDIGI-MND-8942X'

/**
 * Validate user input against master invite code (case-insensitive & whitespace trimmed).
 */
export function validateInviteCode(input: string): boolean {
  if (!input) return false
  return input.trim().toUpperCase() === MASTER_INVITE_CODE.toUpperCase()
}
