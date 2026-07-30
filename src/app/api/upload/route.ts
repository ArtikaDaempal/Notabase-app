import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { randomUUID } from 'crypto'

// POST /api/upload — upload a receipt image to Supabase Storage
export async function POST(req: NextRequest) {
  try {
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

    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `${randomUUID()}.${ext}`
    const bytes = await file.arrayBuffer()

    // Upload to Supabase Storage bucket 'receipts'
    let { data: uploadData, error: uploadError } = await db.storage
      .from('receipts')
      .upload(filename, Buffer.from(bytes), {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      })

    // If bucket does not exist, attempt to auto-create and retry
    if (uploadError && (uploadError.message?.includes('bucket') || uploadError.message?.includes('not found') || uploadError.message?.includes('does not exist'))) {
      try {
        console.log('Attempting to auto-create bucket "receipts"...')
        const { error: createError } = await db.storage.createBucket('receipts', {
          public: true,
          fileSizeLimit: 52428800 // 50MB
        })
        if (!createError) {
          const retryResult = await db.storage
            .from('receipts')
            .upload(filename, Buffer.from(bytes), {
              contentType: file.type,
              cacheControl: '3600',
              upsert: false
            })
          uploadData = retryResult.data
          uploadError = retryResult.error
        }
      } catch (createErr) {
        console.error('Failed to auto-create bucket:', createErr)
      }
    }

    if (uploadError) {
      console.error('Supabase upload error:', uploadError)
      return NextResponse.json({ error: `Gagal mengunggah ke Supabase Storage: ${uploadError.message}` }, { status: 500 })
    }

    // Get the public URL of the uploaded image
    const { data: { publicUrl } } = db.storage
      .from('receipts')
      .getPublicUrl(filename)

    return NextResponse.json({ url: publicUrl, filename, size: file.size })
  } catch (error: any) {
    console.error('Upload handler error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
