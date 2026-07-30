import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/sync/callback — exchange Microsoft OAuth code for real Access & Refresh Tokens
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const workspaceId = searchParams.get('state') ? decodeURIComponent(searchParams.get('state')!) : null
  
  if (!code) {
    return NextResponse.json({ error: 'Kode otorisasi tidak ditemukan.' }, { status: 400 })
  }

  let clientId = process.env.ONEDRIVE_CLIENT_ID || 'de389965-0370-4f51-b847-d5d2ecae2ef1'
  let clientSecret = process.env.ONEDRIVE_CLIENT_SECRET || ''

  if (workspaceId) {
    const { data: settingsData } = await db
      .from('app_settings')
      .select('key, value')
      .eq('workspace_id', workspaceId)

    const settingsMap = new Map((settingsData || []).map((s) => [s.key, String(s.value)]))
    if (settingsMap.get('onedrive_client_id')) clientId = settingsMap.get('onedrive_client_id')!
    if (settingsMap.get('onedrive_client_secret')) clientSecret = settingsMap.get('onedrive_client_secret')!
  }

  const redirectUri = `${new URL(req.url).origin}/api/sync/callback`
  const isLiveSdk = clientId === '0000000048170289' || !clientId || clientId === '5e370255-144d-4238-a006-8c3065b21040'
  const activeClientId = isLiveSdk ? '0000000048170289' : clientId
  const tokenUrl = isLiveSdk ? 'https://login.live.com/oauth20_token.srf' : 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
  
  const bodyParams = new URLSearchParams({
    client_id: activeClientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  })
  
  if (clientSecret && !isLiveSdk) {
    bodyParams.set('client_secret', clientSecret)
  }
  
  try {
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyParams.toString(),
    })
    
    const tokenData = await res.json()
    
    // Fetch user profile from Microsoft Graph or Live User endpoint
    let accountEmail = 'Akun Microsoft Terhubung'
    let accessToken = tokenData.access_token || null

    if (accessToken) {
      const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (profileRes.ok) {
        const profile = await profileRes.json()
        accountEmail = profile.mail || profile.userPrincipalName || accountEmail
      } else {
        const liveUserRes = await fetch(`https://apis.live.net/v5.0/me?access_token=${accessToken}`)
        if (liveUserRes.ok) {
          const liveUser = await liveUserRes.json()
          accountEmail = liveUser.emails?.preferred || liveUser.emails?.account || liveUser.name || accountEmail
        }
      }
    }

    if (workspaceId) {
      const upserts = [
        { workspace_id: workspaceId, key: 'onedrive_connected', value: 'true' as any },
        { workspace_id: workspaceId, key: 'onedrive_access_token', value: tokenData.access_token as any },
        { workspace_id: workspaceId, key: 'onedrive_account', value: accountEmail as any },
      ]

      if (tokenData.refresh_token) {
        upserts.push({ workspace_id: workspaceId, key: 'onedrive_refresh_token', value: tokenData.refresh_token as any })
      }

      await db.from('app_settings').upsert(upserts, { onConflict: 'workspace_id,key' })

      // Upsert to onedrive_connections table
      await db.from('onedrive_connections').upsert({
        workspace_id: workspaceId,
        account_email: accountEmail,
        status: 'connected',
        connected_at: new Date().toISOString(),
        last_checked_at: new Date().toISOString(),
      }, { onConflict: 'workspace_id' })
    }
    
    // Redirect back to Settings Page -> OneDrive View section
    return NextResponse.redirect(`${new URL(req.url).origin}/?tab=settings&view=onedrive`)
  } catch (err: any) {
    console.error('OneDrive OAuth callback error:', err)
    return NextResponse.json({ error: err.message || 'Gagal menghubungkan ke OneDrive' }, { status: 500 })
  }
}
