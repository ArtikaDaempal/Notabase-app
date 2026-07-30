import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/settings — retrieve all settings for a workspace.
 * Sekarang menggunakan tabel app_settings (04-database-schema.md §7).
 * workspace_id dibaca dari header x-workspace-id.
 */
export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.headers.get('x-workspace-id')

    // Fallback: jika tidak ada workspace_id, kembalikan default kosong
    if (!workspaceId) {
      return NextResponse.json({ language: 'id' })
    }

    const { data, error } = await db
      .from('app_settings')
      .select('key, value')
      .eq('workspace_id', workspaceId)

    if (error) throw error

    const settingsMap: Record<string, unknown> = {}
    ;(data || []).forEach((row) => {
      settingsMap[row.key] = row.value
    })

    // Pastikan selalu ada default language
    if (!settingsMap.language) settingsMap.language = 'id'

    return NextResponse.json(settingsMap)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * POST /api/settings — upsert settings for a workspace.
 * Body: { workspaceId: string, key: string, value: unknown }
 * atau bulk: { workspaceId: string, settings: Record<string, unknown> }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const workspaceId = body.workspaceId || req.headers.get('x-workspace-id')

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId diperlukan' }, { status: 400 })
    }

    const settingsObj: Record<string, unknown> = body.settings ?? { [body.key]: body.value }

    const upserts = Object.entries(settingsObj).map(([key, val]) => ({
      workspace_id: workspaceId as string,
      key,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      value: val as any,
    }))

    const { error } = await db
      .from('app_settings')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(upserts as any[], { onConflict: 'workspace_id,key' })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * DELETE /api/settings — reset settings (kecuali OneDrive).
 * Body: { workspaceId: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const workspaceId = body.workspaceId || req.headers.get('x-workspace-id')

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId diperlukan' }, { status: 400 })
    }

    const { error } = await db
      .from('app_settings')
      .delete()
      .eq('workspace_id', workspaceId)
      .not('key', 'in', '("onedrive_connected","onedrive_account","onedrive_folder")')

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
