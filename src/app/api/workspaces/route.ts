/**
 * app/api/workspaces/route.ts
 * API Endpoint for Workspace Creation & Joining (Onboarding)
 *
 * Dokumen acuan:
 *   01-architecture.md §6 (Service-role / Proxy Endpoint untuk pembuatan workspace)
 *   04-database-schema.md §2 & §3 (Policy RLS Workspaces)
 *   03-business-rules.md §1 (BR-WS-01 s.d. BR-WS-04)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xyzcompany.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emNvbXBhbnkiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoyMDAwMDAwMDAwfQ.placeholder'

function getAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action = 'create', code, nama, platform = 'windows', installId } = body

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Kode workspace wajib diisi.' },
        { status: 400 },
      )
    }

    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '-')
    const client = getAdminClient()

    if (action === 'create') {
      if (!nama || typeof nama !== 'string' || !nama.trim()) {
        return NextResponse.json(
          { success: false, error: 'Nama instansi/UMKM wajib diisi.' },
          { status: 400 },
        )
      }

      const cleanNama = nama.trim()

      // 1. Cek apakah kode sudah dipakai di Supabase
      const { data: existing } = await client
        .from('workspaces')
        .select('id')
        .eq('code', cleanCode)
        .maybeSingle()

      if (existing) {
        return NextResponse.json(
          {
            success: false,
            error: `Kode "${cleanCode}" sudah dipakai. Gunakan "Gabung Workspace" untuk bergabung.`,
          },
          { status: 409 },
        )
      }

      // 2. Insert workspace baru
      const wsId = crypto.randomUUID()
      const { data: ws, error: wsErr } = await client
        .from('workspaces')
        .insert({ id: wsId, code: cleanCode, nama: cleanNama })
        .select()
        .single()

      if (wsErr) {
        console.warn('[API Workspaces] Error inserting workspace to Supabase:', wsErr.message)
        // Fallback local response
        const fallbackWs = { id: wsId, code: cleanCode, nama: cleanNama }
        const deviceId = crypto.randomUUID()
        return NextResponse.json({
          success: true,
          workspace: fallbackWs,
          device: { id: deviceId, workspace_id: wsId, install_id: installId || crypto.randomUUID() },
          isLocalFallback: true,
        })
      }

      // 3. Daftarkan device
      const deviceId = crypto.randomUUID()
      const { data: device } = await client
        .from('devices')
        .insert({
          id: deviceId,
          workspace_id: ws.id,
          install_id: installId || crypto.randomUUID(),
          platform,
          nama_perangkat: 'Perangkat Utama',
        })
        .select()
        .single()

      return NextResponse.json({
        success: true,
        workspace: ws,
        device: device || { id: deviceId, workspace_id: ws.id, install_id: installId },
      })
    }

    if (action === 'join') {
      // Lookup workspace by code
      const { data: ws, error: wsErr } = await client
        .from('workspaces')
        .select('id, code, nama, logo_url')
        .eq('code', cleanCode)
        .maybeSingle()

      if (wsErr || !ws) {
        return NextResponse.json(
          {
            success: false,
            error: `Workspace dengan kode "${cleanCode}" tidak ditemukan.`,
          },
          { status: 404 },
        )
      }

      // Daftarkan device baru
      const deviceId = crypto.randomUUID()
      const { data: device } = await client
        .from('devices')
        .insert({
          id: deviceId,
          workspace_id: ws.id,
          install_id: installId || crypto.randomUUID(),
          platform,
          nama_perangkat: null,
        })
        .select()
        .single()

      return NextResponse.json({
        success: true,
        workspace: ws,
        device: device || { id: deviceId, workspace_id: ws.id, install_id: installId },
      })
    }

    return NextResponse.json({ success: false, error: 'Aksi tidak valid.' }, { status: 400 })
  } catch (err: any) {
    console.error('[API Workspaces Exception]:', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'Terjadi kesalahan pada server workspace.' },
      { status: 500 },
    )
  }
}
