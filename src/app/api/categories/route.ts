import { NextResponse } from 'next/server'

// GET /api/categories — Stubbed route since categories are removed
export async function GET() {
  return NextResponse.json([])
}

// POST /api/categories — Stubbed route
export async function POST() {
  return NextResponse.json({ success: true, message: 'Categories are deprecated' }, { status: 201 })
}
