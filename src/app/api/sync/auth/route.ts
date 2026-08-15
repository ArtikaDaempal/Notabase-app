import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/sync/auth
 * Initiates Microsoft OAuth 2.0 authentication flow for ANY Microsoft / OneDrive account
 * (Personal, Work, or School accounts).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspaceId') || searchParams.get('state') || '00000000-0000-4000-a000-000000000000'
  const redirectUri = `${new URL(req.url).origin}/api/sync/callback`

  const clientId = process.env.ONEDRIVE_CLIENT_ID || 'de389965-0370-4f51-b847-d5d2ecae2ef1'

  // Microsoft OAuth 2.0 authorization URL for 'common' tenant with forced account selection prompt
  const authUrl =
    `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
    new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: 'Files.ReadWrite offline_access User.Read',
      prompt: 'select_account',
      state: encodeURIComponent(workspaceId),
    }).toString()

  if (searchParams.get('redirect') === 'true') {
    return NextResponse.redirect(authUrl)
  }

  return NextResponse.json({
    connected: true,
    authUrl,
    clientId,
    redirectUri,
    message: 'Buka authUrl atau klik Hubungkan OneDrive untuk login dengan akun Microsoft apa pun.',
  })
}
