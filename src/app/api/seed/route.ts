import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/seed — populate demo data
export async function POST() {
  // Categories
  const categories = [
    { name: 'Makanan & Minuman', color: '#EF4444', icon: 'UtensilsCrossed' },
    { name: 'Transportasi', color: '#F59E0B', icon: 'Car' },
    { name: 'Alat Tulis Kantor', color: '#2563EB', icon: 'Pencil' },
    { name: 'Belanja', color: '#10B981', icon: 'ShoppingBag' },
    { name: 'Kesehatan', color: '#8B5CF6', icon: 'HeartPulse' },
    { name: 'Elektronik', color: '#06B6D4', icon: 'Cpu' },
    { name: 'Lainnya', color: '#6B7280', icon: 'Tag' },
  ]

  for (const c of categories) {
    const exists = await db.category.findUnique({ where: { name: c.name } })
    if (!exists) {
      await db.category.create({ data: c })
    }
  }

  // Sample receipts (only if none exist)
  const count = await db.receipt.count()
  if (count > 0) {
    return NextResponse.json({ message: 'Data already exists', count })
  }

  const now = new Date()
  const sample: Array<{
    invoiceNumber: string | null
    merchantName: string
    daysAgo: number
    category: string
    total: number
    description: string
    confidence: number
    status: 'verified' | 'pending' | 'failed'
  }> = [
    { invoiceNumber: 'INV-202507-1284', merchantName: 'Indomaret', daysAgo: 0, category: 'Makanan & Minuman', total: 32500, description: 'Belanja kebutuhan harian: air mineral, roti, dan kopi', confidence: 95, status: 'verified' },
    { invoiceNumber: 'INV-202507-1283', merchantName: 'Pertamina', daysAgo: 0, category: 'Transportasi', total: 75000, description: 'Pengisian bahan bakar Pertalite 7 liter', confidence: 92, status: 'verified' },
    { invoiceNumber: 'INV-202507-1282', merchantName: 'Toko Makmur ATK', daysAgo: 1, category: 'Alat Tulis Kantor', total: 125000, description: 'Pembelian perkakas alat tulis kantor divisi operasional', confidence: 88, status: 'verified' },
    { invoiceNumber: 'INV-202507-1281', merchantName: 'Kopi Senja', daysAgo: 1, category: 'Makanan & Minuman', total: 48000, description: '2 cappuccino dan 1 croissant untuk rapat tim', confidence: 79, status: 'pending' },
    { invoiceNumber: 'INV-202507-1280', merchantName: 'Apotek K24', daysAgo: 2, category: 'Kesehatan', total: 56000, description: 'Pembelian vitamin dan obat ringan', confidence: 94, status: 'verified' },
    { invoiceNumber: 'INV-202507-1279', merchantName: 'GoFood', daysAgo: 3, category: 'Makanan & Minuman', total: 42000, description: 'Pesanan makan siang ayam geprek', confidence: 65, status: 'pending' },
    { invoiceNumber: 'INV-202507-1278', merchantName: 'Transmart', daysAgo: 4, category: 'Belanja', total: 287000, description: 'Belanja bulanan keluarga', confidence: 91, status: 'verified' },
    { invoiceNumber: 'INV-202507-1277', merchantName: 'Gojek', daysAgo: 5, category: 'Transportasi', total: 18000, description: 'Ojek online ke kantor', confidence: 72, status: 'verified' },
    { invoiceNumber: 'INV-202507-1276', merchantName: 'Warung Bu Tini', daysAgo: 6, category: 'Makanan & Minuman', total: 15000, description: 'Makan pagi nasi uduk', confidence: 55, status: 'failed' },
    { invoiceNumber: 'INV-202507-1275', merchantName: 'Tokopedia', daysAgo: 7, category: 'Elektronik', total: 450000, description: 'Pembelian kabel HDMI dan mouse wireless', confidence: 90, status: 'verified' },
    { invoiceNumber: 'INV-202507-1274', merchantName: 'Alfamart', daysAgo: 8, category: 'Makanan & Minuman', total: 38000, description: 'Belanja sabun dan shampo', confidence: 89, status: 'verified' },
    { invoiceNumber: 'INV-202507-1273', merchantName: 'Klinik Sehat', daysAgo: 12, category: 'Kesehatan', total: 150000, description: 'Konsultasi dokter umum', confidence: 85, status: 'verified' },
  ]

  for (const s of sample) {
    const d = new Date(now)
    d.setDate(now.getDate() - s.daysAgo)
    d.setHours(9 + (s.daysAgo % 8), (s.daysAgo * 7) % 60, 0, 0)
    await db.receipt.create({
      data: {
        invoiceNumber: s.invoiceNumber,
        merchantName: s.merchantName,
        transactionDate: d,
        category: s.category,
        total: s.total,
        description: s.description,
        confidence: s.confidence,
        status: s.status,
        items: null,
        ocrText: `NOTA\n${s.merchantName}\n${d.toLocaleDateString('id-ID')}\nNo: ${s.invoiceNumber}\nTotal: Rp ${s.total.toLocaleString('id-ID')}`,
      },
    })
  }

  return NextResponse.json({ message: 'Seeded successfully', categories: categories.length, receipts: sample.length })
}
