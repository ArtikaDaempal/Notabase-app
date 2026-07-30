/**
 * shared/services/supabase.ts
 * Supabase Client Configuration with automatic workspace_id injection.
 *
 * Dokumen acuan:
 *   01-architecture.md §6 (Keamanan — RLS per workspace_id)
 *   04-database-schema.md §3 (Row Level Security & JWT claims / headers)
 *   05-risk-testing-checklist.md Prioritas 0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

// ─────────────────────────────────────────────────────────────────────────────
// Environment Variables
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xyzcompany.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emNvbXBhbnkiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoyMDAwMDAwMDAwfQ.placeholder'

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  if (typeof window !== 'undefined') {
    console.warn(
      '[Notabase] NEXT_PUBLIC_SUPABASE_URL atau NEXT_PUBLIC_SUPABASE_ANON_KEY tidak ditemukan di environment variables.',
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace State Helper
// ─────────────────────────────────────────────────────────────────────────────

const WORKSPACE_STORAGE_KEY = 'notabase_workspace_id'

/** Dapatkan active workspace_id yang tersimpan di client-side (localStorage/memory). */
export function getStoredWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('notabase_workspace')
    if (raw) {
      const parsed = JSON.parse(raw)
      return parsed?.state?.workspaceId || localStorage.getItem(WORKSPACE_STORAGE_KEY) || null
    }
    return localStorage.getItem(WORKSPACE_STORAGE_KEY) || null
  } catch {
    return null
  }
}

/** Simpan active workspace_id ke localStorage client-side. */
export function setStoredWorkspaceId(workspaceId: string): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId)
    } catch {
      // ignore storage error
    }
  }
}

/** Hapus active workspace_id (saat ganti workspace / BR-WS-04). */
export function clearStoredWorkspaceId(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(WORKSPACE_STORAGE_KEY)
    } catch {
      // ignore
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Client Factory with Workspace Injection
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  SUPABASE_ANON_KEY

/**
 * Buat Supabase Client yang secara otomatis menyisipkan `workspace_id`
 * ke dalam custom headers (`x-workspace-id`) dan `global.headers`.
 *
 * Sesuai aturan di 04-database-schema.md §3 & 01-architecture.md §6:
 * - Header ini dibaca oleh RLS PostgreSQL policy Supabase.
 * - Jika `workspaceId` tidak diberikan, fungsi secara otomatis mencoba mengambil
 *   `workspace_id` dari stored state (`getStoredWorkspaceId()`).
 *
 * @param workspaceId - UUID workspace instansi/UMKM (opsional)
 */
export function createWorkspaceSupabaseClient(
  workspaceId?: string | null,
): SupabaseClient<Database> {
  const activeWorkspaceId = workspaceId || getStoredWorkspaceId()
  const isServer = typeof window === 'undefined'
  const apiKey = isServer ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY

  const headers: Record<string, string> = {}
  if (activeWorkspaceId) {
    headers['x-workspace-id'] = activeWorkspaceId
  }

  return createClient<Database>(SUPABASE_URL, apiKey, {
    global: {
      headers,
    },
    auth: {
      persistSession: false,   // Tanpa user login personal (01-architecture.md §6)
      autoRefreshToken: false,
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Context RPC Helper (Opsi C Postgres set_config)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Panggil RPC Postgres `set_workspace_context` untuk menetapkan session variable
 * `app.workspace_id` sebelum melakukan query.
 *
 * Sesuai dengan spesifikasi DDL & RLS di 04-database-schema.md.
 *
 * @param client - Client Supabase
 * @param workspaceId - UUID workspace
 */
export async function setWorkspaceContext(
  client: SupabaseClient<Database>,
  workspaceId: string,
): Promise<void> {
  try {
    const { error } = await client.rpc('set_workspace_context', {
      workspace_id: workspaceId,
    })

    if (error) {
      console.warn('[Notabase] RPC set_workspace_context failed:', error.message)
    }
  } catch (err) {
    console.warn('[Notabase] RPC set_workspace_context error:', err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Supabase Client Instance
// ─────────────────────────────────────────────────────────────────────────────

const g = globalThis as typeof globalThis & {
  _notabaseSupabaseClient?: SupabaseClient<Database>
}

/**
 * Singleton Supabase Client default.
 * Secara otomatis menggunakan workspace_id aktif dari storage jika ada.
 */
export const supabase: SupabaseClient<Database> =
  g._notabaseSupabaseClient ?? createWorkspaceSupabaseClient()

if (process.env.NODE_ENV !== 'production') {
  g._notabaseSupabaseClient = supabase
}

/** Alias `db` untuk konsistensi impor lintas modul. */
export const db = supabase
