import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/sync/auth
 * Previously redirected to Microsoft OAuth login page.
 * Now replaced: account ifkaa.rosadelima@gmail.com is pre-connected via
 * ONEDRIVE_REFRESH_TOKEN environment variable — no user login required.
 */
export async function GET(_req: NextRequest) {
  return NextResponse.json(
    {
      message: 'Akun OneDrive (ifkaa.rosadelima@gmail.com) sudah terhubung secara otomatis. Login tidak diperlukan.',
      connected: true,
      account: 'ifkaa.rosadelima@gmail.com',
    },
    { status: 200 }
  )
}
