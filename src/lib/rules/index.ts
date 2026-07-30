/**
 * lib/rules/index.ts
 * Barrel re-export untuk semua business rules Notabase.
 *
 * Dokumen acuan: 03-business-rules.md, 01-architecture.md §4
 * Prinsip: semua logika bisnis ada di shared/rules/ — bukan di komponen page.
 */

export * from './ocr-rules'
export * from './receipt-rules'
export * from './archive-rules'
