import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

// POST /api/upload — upload a receipt image (multipart/form-data)
export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Validate type
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 })
  }

  const dir = path.join(process.cwd(), 'public', 'receipts')
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }

  const ext = file.name.split('.').pop() || 'jpg'
  const filename = `${randomUUID()}.${ext}`
  const filepath = path.join(dir, filename)
  const bytes = await file.arrayBuffer()
  await writeFile(filepath, Buffer.from(bytes))

  const url = `/receipts/${filename}`
  return NextResponse.json({ url, filename, size: file.size })
}
