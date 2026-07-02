import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/categories
export async function GET() {
  const cats = await db.category.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(cats)
}

// POST /api/categories
export async function POST(req: NextRequest) {
  const body = await req.json()
  const created = await db.category.create({
    data: {
      name: body.name,
      color: body.color || '#2563EB',
      icon: body.icon || 'Tag',
    },
  })
  return NextResponse.json(created, { status: 201 })
}
