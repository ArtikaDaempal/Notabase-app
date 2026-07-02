import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/sync — get sync status + history
export async function GET() {
  const logs = await db.syncLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
  const totalUploaded = logs.filter((l) => l.status === 'success').length
  const totalSize = logs.filter((l) => l.status === 'success').reduce((a, b) => a + (b.fileSize || 0), 0)

  // Mock cloud usage
  const cloudUsed = totalSize
  const cloudTotal = 5 * 1024 * 1024 * 1024 // 5 GB
  const usedPct = cloudTotal > 0 ? (cloudUsed / cloudTotal) * 100 : 0

  return NextResponse.json({
    connected: true,
    account: 'notabase.user@outlook.com',
    folder: 'Notabase/',
    cloudUsed,
    cloudTotal,
    usedPct,
    totalUploaded,
    logs: logs.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    })),
  })
}

// POST /api/sync — upload a file (mock OneDrive upload with progress simulation)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { fileName, fileSize, action } = body as {
    fileName?: string
    fileSize?: number
    action?: 'upload' | 'connect' | 'disconnect'
  }

  if (action === 'connect') {
    return NextResponse.json({ connected: true, account: 'notabase.user@outlook.com' })
  }
  if (action === 'disconnect') {
    return NextResponse.json({ connected: false })
  }

  // Create a sync log entry simulating an upload
  const log = await db.syncLog.create({
    data: {
      fileName: fileName || `Report_${Date.now()}.xlsx`,
      status: 'success',
      progress: 100,
      fileSize: fileSize || Math.floor(Math.random() * 500_000) + 50_000,
      provider: 'onedrive',
      message: 'Uploaded to OneDrive/Notabase/',
    },
  })

  return NextResponse.json({
    ...log,
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString(),
  })
}
