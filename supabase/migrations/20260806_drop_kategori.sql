-- ============================================================
-- Migration: Hapus kolom kategori dari tabel receipts
-- Tanggal    : 2026-08-06
-- Alasan     : Kolom kategori tidak digunakan dan dihapus dari aplikasi
-- ============================================================

ALTER TABLE receipts DROP COLUMN IF EXISTS kategori;
