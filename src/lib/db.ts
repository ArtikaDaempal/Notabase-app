/**
 * lib/db.ts
 * Re-exports Supabase client & workspace-aware utilities from shared/services/supabase.ts.
 *
 * Dokumen acuan:
 *   01-architecture.md §6 (Keamanan — RLS per workspace_id)
 *   04-database-schema.md §3 (RLS via current_workspace_id())
 */

export {
  supabase,
  db,
  createWorkspaceSupabaseClient,
  createWorkspaceSupabaseClient as getWorkspaceDb,
  setWorkspaceContext,
  getStoredWorkspaceId,
  setStoredWorkspaceId,
  clearStoredWorkspaceId,
} from '@/shared/services/supabase'

import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/shared/types/database'

/**
 * Generate path di Supabase Storage untuk gambar nota.
 * Format: {workspace_id}/{tahun}/{bulan}/{receipt_id}.jpg
 *
 * Dokumen acuan: 04-database-schema.md §4 (Storage bucket receipt-images)
 */
export function buildStoragePath(
  workspaceId: string,
  receiptId: string,
  date: Date = new Date(),
): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${workspaceId}/${year}/${month}/${receiptId}.jpg`
}

/**
 * Dapatkan signed URL untuk mengakses gambar nota.
 * Bucket bersifat private — tidak ada public URL (01-architecture.md §6).
 *
 * @param workspaceDb - client Supabase
 * @param storagePath - path di bucket (dari Receipt.imageUrl)
 * @param expiresIn   - durasi signed URL dalam detik (default: 3600 = 1 jam)
 */
export async function getSignedImageUrl(
  workspaceDb: SupabaseClient<Database>,
  storagePath: string,
  expiresIn: number = 3600,
): Promise<string | null> {
  const { data, error } = await workspaceDb.storage
    .from('receipt-images')
    .createSignedUrl(storagePath, expiresIn)

  if (error) {
    console.error('[Notabase] Failed to create signed URL:', error.message)
    return null
  }

  return data.signedUrl
}
