import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/ocr/models — list available Gemini models for the configured API key
export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key tidak dikonfigurasi' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=50`
    )
    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: data, status: res.status }, { status: res.status })
    }

    // Filter models that support generateContent (needed for OCR)
    const available = (data.models ?? [])
      .filter((m: any) =>
        Array.isArray(m.supportedGenerationMethods) &&
        m.supportedGenerationMethods.includes('generateContent')
      )
      .map((m: any) => ({
        name: m.name,         // e.g. "models/gemini-1.5-flash"
        displayName: m.displayName,
        id: m.name.replace('models/', ''),  // e.g. "gemini-1.5-flash"
      }))

    return NextResponse.json({ keyPrefix: apiKey.slice(0, 6) + '...', available })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
