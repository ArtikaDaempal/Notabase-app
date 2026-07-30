import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/sync/onedrive — Receive FormData file upload and upload directly to Microsoft Graph API
export async function POST(req: NextRequest) {
  try {
    const workspaceId = req.headers.get('x-workspace-id') || '00000000-0000-4000-a000-000000000000'
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const periodType = (formData.get('periodType') as string) || 'bulanan'

    if (!file) {
      return NextResponse.json({ error: 'File wajib disertakan dalam FormData' }, { status: 400 })
    }

    const { data: settingsData } = await db
      .from('app_settings')
      .select('key, value')
      .eq('workspace_id', workspaceId)

    const settingsMap = new Map((settingsData || []).map((s) => [s.key, String(s.value)]))

    // Resolve access token — auto-refresh, no user login required
    let accessToken = settingsMap.get('onedrive_access_token') || null

    // Validate stored token
    if (accessToken) {
      const ping = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!ping.ok) accessToken = null
    }

    // Try to refresh using stored or env refresh token
    if (!accessToken) {
      const clientId = process.env.ONEDRIVE_CLIENT_ID || '5e370255-144d-4238-a006-8c3065b21040'
      const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET || ''
      const storedRefresh = settingsMap.get('onedrive_refresh_token')
      const envRefresh = process.env.ONEDRIVE_REFRESH_TOKEN || ''
      const refreshToken = (storedRefresh && storedRefresh.length > 10) ? storedRefresh : envRefresh

      if (refreshToken && refreshToken.length > 10) {
        const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            scope: 'Files.ReadWrite offline_access User.Read',
          }).toString(),
        })
        const tokenData = await tokenRes.json()
        if (tokenRes.ok && tokenData.access_token) {
          accessToken = tokenData.access_token

          // Persist refreshed token
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const upserts: any[] = [
            { workspace_id: workspaceId, key: 'onedrive_access_token', value: tokenData.access_token },
            { workspace_id: workspaceId, key: 'onedrive_connected', value: 'true' },
            // onedrive_account is updated with real email from Graph /me by /api/sync GET
          ]
          if (tokenData.refresh_token) {
            upserts.push({ workspace_id: workspaceId, key: 'onedrive_refresh_token', value: tokenData.refresh_token })
          }
          try {
            await db.from('app_settings').upsert(upserts, { onConflict: 'workspace_id,key' })
          } catch {}
        }
      }
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Token OneDrive tidak tersedia. Tambahkan ONEDRIVE_REFRESH_TOKEN ke file .env' },
        { status: 503 }
      )
    }

    const isYearly = periodType === 'yearly' || periodType === 'tahunan'
    const subFolder = isYearly ? 'Ekspor Tahunan' : 'Ekspor Bulanan'
    const targetFolderPath = `Notabase/${subFolder}`
    const fileName = file.name || `Laporan_Notabase_${isYearly ? 'Tahunan' : 'Bulanan'}_${new Date().toISOString().slice(0, 10)}.xlsx`

    const fileBuffer = Buffer.from(await file.arrayBuffer())

    const graphUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${targetFolderPath}/${fileName}:/content`
    const uploadRes = await fetch(graphUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      body: fileBuffer,
    })

    const graphData = await uploadRes.json()

    if (!uploadRes.ok) {
      return NextResponse.json(
        { error: `Gagal unggah OneDrive: ${graphData.error?.message || 'Microsoft Graph error'}` },
        { status: 502 }
      )
    }

    const webUrl = graphData.webUrl || `https://onedrive.live.com/?id=${encodeURIComponent(targetFolderPath)}`

    return NextResponse.json({
      success: true,
      fileName,
      folder: targetFolderPath,
      webUrl,
      rowCount: 0,
      message: `File berhasil diunggah ke OneDrive/${targetFolderPath}/${fileName}`,
    })
  } catch (err: any) {
    console.error('OneDrive upload route error:', err)
    return NextResponse.json({ error: err.message || 'Gagal mengunggah file ke OneDrive' }, { status: 500 })
  }
}
