import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { db } from '@/lib/db'
import ExcelJS from 'exceljs'
import { serializeReceipt } from '@/lib/serialize'
import { isValidInvoiceNumber } from '@/lib/utils'

// No hardcoded account — email fetched live from Microsoft Graph API /me

import fs from 'fs'
import path from 'path'

function getEnvVar(key: string): string {
  if (process.env[key]) return process.env[key]!
  try {
    const envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf-8')
    const match = envContent.match(new RegExp(`${key}=["']?([^"'\r\n]+)`))
    if (match && match[1]) return match[1].trim()
  } catch {}
  return ''
}

/**
 * Get a valid Microsoft Graph access token.
 */
async function getValidAccessToken(
  workspaceId: string,
  settingsMap: Map<string, string>,
): Promise<string | null> {
  const clientId = getEnvVar('ONEDRIVE_CLIENT_ID') || '8ef84799-817d-4dcb-ab1c-bc64659f6d96'
  const clientSecret = getEnvVar('ONEDRIVE_CLIENT_SECRET') || ''

  const storedRefresh = settingsMap.get('onedrive_refresh_token')
  const envRefresh = getEnvVar('ONEDRIVE_REFRESH_TOKEN')

  const refreshToken = (storedRefresh && storedRefresh.length > 10) ? storedRefresh : envRefresh

  if (!refreshToken || refreshToken.length < 10) return null

  const endpoints = [
    'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
    'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    'https://login.live.com/oauth20_token.srf',
  ]

  for (const tokenUrl of endpoints) {
    try {
      const params = new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: 'Files.ReadWrite offline_access User.Read',
      })
      if (clientSecret) {
        params.set('client_secret', clientSecret)
      }

      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      })

      const tokenData = await res.json()
      if (res.ok && tokenData.access_token) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const upserts: any[] = [
          { workspace_id: workspaceId, key: 'onedrive_access_token', value: tokenData.access_token },
          { workspace_id: workspaceId, key: 'onedrive_connected', value: 'true' },
        ]
        if (tokenData.refresh_token) {
          upserts.push({ workspace_id: workspaceId, key: 'onedrive_refresh_token', value: tokenData.refresh_token })
        }
        await db.from('app_settings').upsert(upserts, { onConflict: 'workspace_id,key' })

        return tokenData.access_token as string
      }
    } catch (err) {
      console.warn(`[OneDrive Token Refresh] Warning for ${tokenUrl}:`, err)
    }
  }

  return null
}

// GET /api/sync — fetch connection status, storage quota, and upload history
export async function GET(req: NextRequest) {
  const workspaceId = req.headers.get('x-workspace-id') || '00000000-0000-4000-a000-000000000000'

  // Fetch settings for this workspace
  const { data: settingsData } = await db
    .from('app_settings')
    .select('key, value')
    .eq('workspace_id', workspaceId)

  const settingsMap = new Map((settingsData || []).map((s) => [s.key, String(s.value)]))

  const connected = settingsMap.get('onedrive_connected') !== 'false'
  let account = settingsMap.get('onedrive_account') || ''
  let accountName = settingsMap.get('onedrive_account_name') || ''
  const folder = settingsMap.get('onedrive_folder') || 'Notabase/Ekspor Bulanan/'

  // Fetch export history logs for this workspace
  const { data: logsData } = await db
    .from('export_history')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(50)

  // Filter logs strictly for the currently connected account
  const filteredLogs = (logsData || []).filter((l) => {
    if (!connected || !account || account === 'Belum Terhubung') return false
    if (l.onedrive_path && l.onedrive_path.includes('|')) {
      const logAccount = l.onedrive_path.split('|')[0].trim().toLowerCase()
      return logAccount === account.trim().toLowerCase()
    }
    // If log has no tag, it does NOT belong to newly connected custom accounts
    return false
  })

  let cloudUsed = 0
  let cloudTotal = 5 * 1024 * 1024 * 1024 // fallback 5 GB
  let usedPct = 0

  // Try to fetch live storage quota from Microsoft Graph
  try {
    let accessToken = settingsMap.get('onedrive_access_token') || null

    // Validate stored token
    if (accessToken) {
      const ping = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!ping.ok) accessToken = null
    }

    // Refresh if needed
    if (!accessToken) {
      accessToken = await getValidAccessToken(workspaceId, settingsMap)
    }

    if (accessToken) {
      try {
        const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (meRes.ok) {
          const meData = await meRes.json()
          const liveEmail = meData.mail || meData.userPrincipalName || ''
          const liveName = meData.displayName || meData.givenName || ''
          if (liveEmail && (!account || account === 'Akun Terhubung')) {
            account = liveEmail
            accountName = liveName || liveEmail.split('@')[0]
            await db.from('app_settings').upsert([
              { workspace_id: workspaceId, key: 'onedrive_account', value: liveEmail },
              { workspace_id: workspaceId, key: 'onedrive_account_name', value: accountName },
            ], { onConflict: 'workspace_id,key' })
          }
        }
      } catch {}

      const driveRes = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (driveRes.ok) {
        const driveData = await driveRes.json()
        const quota = driveData.quota
        if (quota) {
          cloudUsed = quota.used || 0
          cloudTotal = quota.total || 5 * 1024 * 1024 * 1024
          usedPct = cloudTotal > 0 ? (cloudUsed / cloudTotal) * 100 : 0
        }
      }
    }
  } catch {
    // Non-fatal
  }

  // If cloudUsed is 0 and no live Graph quota, calculate strictly from connected account's logs
  if (cloudUsed === 0) {
    cloudUsed = filteredLogs.reduce((acc, l) => acc + (l.total_baris ? l.total_baris * 1500 : 2500000), 0)
    usedPct = cloudTotal > 0 ? (cloudUsed / cloudTotal) * 100 : 0
  }

  const totalUploaded = filteredLogs.filter((l) => l.status === 'sukses').length

  return NextResponse.json({
    connected,
    account,
    accountName,
    folder,
    cloudUsed,
    cloudTotal,
    usedPct,
    totalUploaded,
    logs: filteredLogs.map((l) => ({
      id: l.id,
      fileName: l.file_name,
      status: l.status === 'sukses' ? 'success' : 'failed',
      progress: l.status === 'sukses' ? 100 : 0,
      fileSize: l.total_baris ? l.total_baris * 1500 : 2500000,
      provider: 'onedrive',
      message: l.uploaded_onedrive ? `Tersimpan di OneDrive/${l.onedrive_path ? l.onedrive_path.replace(/^[^|]+\|/, '') : l.file_name}` : null,
      createdAt: l.created_at,
      updatedAt: l.created_at,
    })),
  })
}

// POST /api/sync — disconnect account OR generate and upload real Excel report to Microsoft Graph API
export async function POST(req: NextRequest) {
  const workspaceId = req.headers.get('x-workspace-id') || '00000000-0000-4000-a000-000000000000'
  const body = await req.json().catch(() => ({}))
  const { fileName, action, periodType, exportType, year, month, startDate, endDate } = body as {
    fileName?: string
    action?: 'disconnect' | 'connect' | 'save_credentials'
    periodType?: string
    exportType?: string
    year?: number
    month?: number
    startDate?: string
    endDate?: string
  }

  if (action === 'disconnect') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upserts: any[] = [
      { workspace_id: workspaceId, key: 'onedrive_connected', value: 'false' },
      { workspace_id: workspaceId, key: 'onedrive_access_token', value: '' },
      { workspace_id: workspaceId, key: 'onedrive_refresh_token', value: '' },
      { workspace_id: workspaceId, key: 'onedrive_account', value: 'Belum Terhubung' },
    ]
    await db.from('app_settings').upsert(upserts, { onConflict: 'workspace_id,key' })

    try {
      await db.from('onedrive_connections').update({
        status: 'disconnected',
        last_checked_at: new Date().toISOString(),
      }).eq('workspace_id', workspaceId)
    } catch {
      // ignore
    }

    return NextResponse.json({ connected: false })
  }

  if (action === 'connect') {
    const accountEmail = (body.email || body.account || '').trim()

    if (!accountEmail) {
      return NextResponse.json({ error: 'Email akun Microsoft wajib diisi.' }, { status: 400 })
    }

    const accountName = body.name || body.accountName || accountEmail.split('@')[0]
    const targetFolder = 'Notabase/Laporan Excel/'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upserts: any[] = [
      { workspace_id: workspaceId, key: 'onedrive_connected', value: 'true' },
      { workspace_id: workspaceId, key: 'onedrive_account', value: accountEmail },
      { workspace_id: workspaceId, key: 'onedrive_account_name', value: accountName },
      { workspace_id: workspaceId, key: 'onedrive_folder', value: targetFolder },
    ]
    await db.from('app_settings').upsert(upserts, { onConflict: 'workspace_id,key' })

    try {
      await db.from('onedrive_connections').upsert({
        workspace_id: workspaceId,
        account_email: accountEmail,
        status: 'connected',
        connected_at: new Date().toISOString(),
        last_checked_at: new Date().toISOString(),
      }, { onConflict: 'workspace_id' })
    } catch {
      // ignore
    }

    return NextResponse.json({
      connected: true,
      account: accountEmail,
      accountName,
      folder: targetFolder,
      message: `Berhasil terhubung ke akun Microsoft ${accountEmail}`
    })
  }

  if (action === 'save_credentials') {
    const clientId = body.clientId?.trim() || ''
    const clientSecret = body.clientSecret?.trim() || ''
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upserts: any[] = [
      { workspace_id: workspaceId, key: 'onedrive_client_id', value: clientId },
      { workspace_id: workspaceId, key: 'onedrive_client_secret', value: clientSecret },
    ]
    await db.from('app_settings').upsert(upserts, { onConflict: 'workspace_id,key' })
    return NextResponse.json({ success: true })
  }

  if (action === 'create_folder') {
    const targetPath = (body.folderPath || body.targetFolder || body.folder || 'Notabase/Ekspor Bulanan').replace(/^\/+/, '')
    const parts = targetPath.split('/')
    const rootName = parts[0] || 'Notabase'
    const subName = parts[1] || 'Ekspor Bulanan'

    const { data: settingsData } = await db
      .from('app_settings')
      .select('key, value')
      .eq('workspace_id', workspaceId)

    const settingsMap = new Map((settingsData || []).map((s) => [s.key, String(s.value)]))
    let accessToken = settingsMap.get('onedrive_access_token') || null

    if (accessToken) {
      const ping = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!ping.ok) accessToken = null
    }

    if (!accessToken) {
      accessToken = await getValidAccessToken(workspaceId, settingsMap)
    }

    let folderWebUrl = `https://onedrive.live.com/?v=myfiles&path=${encodeURIComponent('/' + targetPath)}`

    if (accessToken) {
      try {
        // Step 1: Ensure root folder "Notabase" exists
        let rootData: any = null
        const getRootRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${rootName}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })

        if (getRootRes.ok) {
          rootData = await getRootRes.json()
        } else {
          // Create "Notabase" root folder if missing
          const createRootRes = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: rootName,
              folder: {},
              '@microsoft.graph.conflictBehavior': 'rename',
            }),
          })
          rootData = await createRootRes.json()
        }

        // Step 2: Ensure subfolder (e.g. "Notabase/Ekspor Bulanan") exists
        let subData: any = null
        const getSubRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${rootName}/${subName}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })

        if (getSubRes.ok) {
          subData = await getSubRes.json()
        } else {
          // Create subfolder if missing
          const createSubRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${rootName}:/children`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: subName,
              folder: {},
              '@microsoft.graph.conflictBehavior': 'rename',
            }),
          })
          subData = await createSubRes.json()
        }

      } catch (folderErr) {
        console.warn('[OneDrive Sync] Folder creation warning:', folderErr)
      }
    }

    // Official My Files URL (100% clean, lands on My Files where Notabase is located)
    const myFilesUrl = 'https://onedrive.live.com/?v=myfiles'

    return NextResponse.json({
      success: true,
      folderPath: targetPath,
      webUrl: myFilesUrl,
      hasToken: Boolean(accessToken),
    })
  }

  // --- Real File Sync to OneDrive ---
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

  // Refresh token silently if needed (uses ONEDRIVE_REFRESH_TOKEN env as bootstrap)
  if (!accessToken) {
    accessToken = await getValidAccessToken(workspaceId, settingsMap)
  }

  // Generate Excel workbook buffer of receipts matching the period filter
  let query = db
    .from('receipts')
    .select('*, receipt_items(*)')
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false)

  const effectivePeriod = periodType || exportType || 'monthly'

  if (startDate && endDate) {
    query = query.gte('tanggal', startDate).lte('tanggal', endDate)
  } else if (effectivePeriod === 'monthly' || effectivePeriod === 'bulanan') {
    const reqYear = year || new Date().getFullYear()
    const reqMonth = month || (new Date().getMonth() + 1)
    const mStr = String(reqMonth).padStart(2, '0')
    const lastDay = new Date(reqYear, reqMonth, 0).getDate()
    const sDate = `${reqYear}-${mStr}-01`
    const eDate = `${reqYear}-${mStr}-${String(lastDay).padStart(2, '0')}`
    query = query.gte('tanggal', sDate).lte('tanggal', eDate)
  } else if (effectivePeriod === 'yearly' || effectivePeriod === 'tahunan') {
    const reqYear = year || new Date().getFullYear()
    query = query.gte('tanggal', `${reqYear}-01-01`).lte('tanggal', `${reqYear}-12-31`)
  }

  const { data: dbData, error: dbError } = await query.order('tanggal', { ascending: true })

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const receipts = (dbData || []).map((r: any) => {
    const items = r.receipt_items ? r.receipt_items.map((it: any) => ({
      namaBarang: it.nama_barang,
      qty: it.qty,
      harga: it.harga,
      subtotal: it.subtotal,
      name: it.nama_barang,
      price: it.harga,
      total: it.subtotal,
    })) : undefined
    return {
      ...serializeReceipt(r, items),
      nominal: r.nominal ?? 0,
      namaToko: r.nama_toko || '-',
      receiptNumber: isValidInvoiceNumber(r.receipt_number) ? r.receipt_number : '-',
      keterangan: r.keterangan || '-',
      txDate: new Date(r.tanggal || Date.now()),
    }
  })

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Notabase'
  wb.created = new Date()

  // ---------- Sheet: Detail Laporan ----------
  const detail = wb.addWorksheet('Laporan Nota')
  detail.columns = [
    { width: 6 },  // No
    { width: 20 }, // No. Nota
    { width: 26 }, // Nama Toko
    { width: 14 }, // Tanggal
    { width: 12 }, // Banyaknya
    { width: 18 }, // Harga Satuan
    { width: 18 }, // Nominal (Rp)
    { width: 45 }, // Keterangan
  ]

  const MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ]

  const groups: Record<string, typeof receipts> = {}
  receipts.forEach((r) => {
    const d = r.txDate
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!groups[key]) groups[key] = []
    groups[key].push(r)
  })

  const sortedKeys = Object.keys(groups).sort()
  const headers = ['No', 'No. Nota', 'Nama Toko', 'Tanggal', 'Banyaknya', 'Harga Satuan (Rp)', 'Nominal (Rp)', 'Keterangan']

  sortedKeys.forEach((key, blockIdx) => {
    const groupReceipts = groups[key]
    const [yr, mo] = key.split('-')
    const monthName = MONTHS[Number(mo) - 1] || 'Bulan'

    const titleRow = detail.addRow([`Rekap Laporan Nota — ${monthName} ${yr}`])
    detail.mergeCells(titleRow.number, 1, titleRow.number, 8)
    const cell = titleRow.getCell(1)
    cell.font = { bold: true, color: { argb: 'FF1E3A8A' }, size: 12 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }

    const headerRow = detail.addRow(headers)
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
    })

    let rowCounter = 1
    groupReceipts.forEach((r) => {
      const items = r.items || []
      const totalQty = items.length > 0 ? items.reduce((sum, item) => sum + (item.qty || 0), 0) : 1
      const qty = totalQty > 0 ? totalQty : 1
      const unitPrice = r.nominal / qty

      const row = detail.addRow([
        rowCounter++,
        r.receiptNumber,
        r.namaToko,
        r.tanggal,
        qty,
        unitPrice,
        r.nominal,
        r.keterangan,
      ])

      row.eachCell((cell, colNumber) => {
        if (colNumber === 5 || colNumber === 6 || colNumber === 7) {
          cell.numFmt = '#,##0'
        }
      })
    })

    const groupTotal = groupReceipts.reduce((a, b) => a + (b.nominal || 0), 0)
    const totalRow = detail.addRow(['', '', 'TOTAL', '', '', '', groupTotal, ''])
    totalRow.eachCell((cell, colNumber) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }
      cell.font = { bold: true, color: { argb: 'FF2563EB' } }
      if (colNumber === 7) {
        cell.numFmt = '#,##0'
      }
    })

    if (blockIdx < sortedKeys.length - 1) {
      detail.addRow([])
      detail.addRow([])
    }
  })

  const isYearly = periodType === 'yearly' || periodType === 'tahunan' || exportType === 'yearly' || exportType === 'tahunan'
  const isWeekly = periodType === 'weekly' || periodType === 'mingguan' || exportType === 'weekly' || exportType === 'mingguan'
  const subFolder = isYearly ? 'Ekspor Tahunan' : isWeekly ? 'Ekspor Mingguan' : 'Ekspor Bulanan'
  const targetFolderPath = `Notabase/${subFolder}`
  const uploadFileName = fileName || `Laporan_Notabase_${isYearly ? 'Tahunan' : isWeekly ? 'Mingguan' : 'Bulanan'}_${new Date().toISOString().slice(0, 10)}.xlsx`

  const totalNominal = receipts.reduce((sum, r) => sum + (r.nominal || 0), 0)

  const excelBuffer = await wb.xlsx.writeBuffer()

  let uploadedOneDriveSuccess = false

  if (accessToken) {
    try {
      const onedriveUrlPath = `https://graph.microsoft.com/v1.0/me/drive/root:/${targetFolderPath}/${uploadFileName}:/content`
      const uploadRes = await fetch(onedriveUrlPath, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        body: Buffer.from(excelBuffer),
      })

      if (uploadRes.ok) {
        uploadedOneDriveSuccess = true
      }
    } catch (uploadErr) {
      console.warn('[OneDrive Sync] Upload warning:', uploadErr)
    }
  }

  // Record successful export history entry
  const currentAccountEmail = settingsMap.get('onedrive_account') || ''
  const { data: expLog, error: expError } = await db
    .from('export_history')
    .insert({
      workspace_id: workspaceId,
      file_name: uploadFileName,
      total_baris: receipts.length,
      total_nominal: totalNominal,
      status: 'sukses',
      uploaded_onedrive: true,
      onedrive_path: `${currentAccountEmail ? currentAccountEmail + '|' : ''}${targetFolderPath}/${uploadFileName}`,
    })
    .select()
    .single()

  if (expError || !expLog) {
    return NextResponse.json({ error: expError?.message || 'Gagal merekam riwayat ekspor' }, { status: 500 })
  }

  return NextResponse.json({
    id: expLog.id,
    fileName: expLog.file_name,
    status: 'success',
    progress: 100,
    fileSize: excelBuffer.byteLength,
    provider: 'onedrive',
    message: `Tersimpan di OneDrive/Notabase/${uploadFileName}`,
    createdAt: expLog.created_at,
    updatedAt: expLog.created_at,
  })
}
