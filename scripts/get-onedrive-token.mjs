/**
 * get-onedrive-token.mjs — PKCE Auth Code Flow (tanpa client secret)
 * Untuk akun personal Microsoft (MSA/Gmail linked ke Microsoft Account)
 *
 * Ganti CLIENT_ID dengan Application ID dari app registration Anda.
 * Jalankan: node scripts/get-onedrive-token.mjs
 */

import http from 'http'
import crypto from 'crypto'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'

// Read .env file directly
let envClientId = '8ef84799-817d-4dcb-ab1c-bc64659f6d96'
let envClientSecret = ''
try {
  const envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf-8')
  const matchId = envContent.match(/ONEDRIVE_CLIENT_ID=["']?([^"'\r\n]+)/)
  if (matchId && matchId[1]) envClientId = matchId[1].trim()
  const matchSecret = envContent.match(/ONEDRIVE_CLIENT_SECRET=["']?([^"'\r\n]+)/)
  if (matchSecret && matchSecret[1]) envClientSecret = matchSecret[1].trim()
} catch {}

const CLIENT_ID = envClientId
const CLIENT_SECRET = envClientSecret
const REDIRECT_URI = 'http://localhost:3456/callback'
const TENANT = 'consumers'
const SCOPE = 'Files.ReadWrite offline_access User.Read'

// PKCE - tidak butuh client secret
function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

const { verifier, challenge } = generatePKCE()

const authUrl =
  `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize` +
  `?client_id=${CLIENT_ID}` +
  `&response_type=code` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_mode=query` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&code_challenge=${challenge}` +
  `&code_challenge_method=S256` +
  `&prompt=select_account`

console.log('\n╔══════════════════════════════════════════════╗')
console.log('║   NOTABASE — Dapatkan OneDrive Refresh Token  ║')
console.log('╚══════════════════════════════════════════════╝\n')
console.log('Membuka browser... Login dengan ifkadaempal5@gmail.com')
console.log('Pilih "Personal account" / "Microsoft account"\n')

setTimeout(() => {
  try { exec(`start "" "${authUrl}"`) } catch {}
}, 300)

console.log('Jika browser tidak terbuka, buka URL ini:\n')
console.log(authUrl)
console.log()

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3456')
  if (url.pathname !== '/callback') { res.end('Menunggu...'); return }

  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  const errorDesc = url.searchParams.get('error_description') || ''

  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`<h2 style="color:red">❌ ${error}</h2><pre>${decodeURIComponent(errorDesc)}</pre>`)
    console.error('\n❌ Error:', error)
    console.error(decodeURIComponent(errorDesc))
    server.close()
    return
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(`<html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#f0fdf4">
    <h2 style="color:#16a34a">✅ Login Berhasil!</h2>
    <p>Refresh token sudah muncul di terminal Anda.</p>
    <p style="color:#6b7280">Anda bisa menutup tab ini.</p>
  </body></html>`)
  server.close()

  // Exchange code → tokens
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    scope: SCOPE,
  })
  if (CLIENT_SECRET) {
    params.set('client_secret', CLIENT_SECRET)
  }

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() }
  )
  const tokenData = await tokenRes.json()

  if (!tokenRes.ok) {
    console.error('\n❌ Gagal tukar token:', JSON.stringify(tokenData, null, 2))
    process.exit(1)
  }

  console.log('\n\n✅ BERHASIL! Tempel baris berikut ke file .env:\n')
  console.log('═'.repeat(60))
  console.log(`ONEDRIVE_CLIENT_ID="${CLIENT_ID}"`)
  console.log(`ONEDRIVE_CLIENT_SECRET=""`)
  if (tokenData.refresh_token) {
    console.log(`ONEDRIVE_REFRESH_TOKEN="${tokenData.refresh_token}"`)
  } else {
    console.warn('\n⚠️  Tidak ada refresh_token. Pastikan scope "offline_access" diizinkan di app.')
  }
  console.log('═'.repeat(60))
  console.log('\n→ Restart server: npm run dev')
  console.log('→ Upload OneDrive langsung bekerja tanpa login!\n')
  process.exit(0)
})

server.listen(3456, () => console.log('Server menunggu di http://localhost:3456/callback\n'))
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error('❌ Port 3456 dipakai. Tunggu sebentar lalu jalankan ulang.')
  else console.error(e)
  process.exit(1)
})
