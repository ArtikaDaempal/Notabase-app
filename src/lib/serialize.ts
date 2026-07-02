import type { Receipt as PrismaReceipt } from '@prisma/client'
import type { Receipt } from '@/types'

/** Convert a Prisma receipt row into the API Receipt shape */
export function serializeReceipt(r: PrismaReceipt): Receipt {
  return {
    id: r.id,
    invoiceNumber: r.invoiceNumber,
    merchantName: r.merchantName,
    transactionDate: r.transactionDate.toISOString(),
    category: r.category,
    total: r.total,
    description: r.description,
    imageUrl: r.imageUrl,
    ocrText: r.ocrText,
    confidence: r.confidence,
    status: r.status as Receipt['status'],
    items: r.items ? (JSON.parse(r.items) as Receipt['items']) : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}
