-- ============================================================
-- Migration: Tambah kolom extended ke tabel receipts & receipt_items
-- Tanggal    : 2026-08-06
-- Alasan     : Mendukung fitur Scan Nota komprehensif (field baru OCR)
-- ============================================================

-- ── receipts: tambah kolom baru ─────────────────────────────────────────────

ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS waktu               TEXT              NULL,           -- jam transaksi misal "14:30"
  ADD COLUMN IF NOT EXISTS diskon_nominal      NUMERIC(15, 2)    NOT NULL DEFAULT 0,  -- diskon dalam Rupiah
  ADD COLUMN IF NOT EXISTS diskon_persen       NUMERIC(5, 2)     NOT NULL DEFAULT 0,  -- diskon dalam persen (0-100)
  ADD COLUMN IF NOT EXISTS pajak_nominal       NUMERIC(15, 2)    NOT NULL DEFAULT 0,  -- PPN/pajak dalam Rupiah
  ADD COLUMN IF NOT EXISTS pajak_persen        NUMERIC(5, 2)     NOT NULL DEFAULT 0,  -- pajak dalam persen (0-100)
  ADD COLUMN IF NOT EXISTS biaya_tambahan      NUMERIC(15, 2)    NOT NULL DEFAULT 0,  -- biaya admin/transaksi
  ADD COLUMN IF NOT EXISTS sumber_dana         TEXT              NULL,           -- rekening/kartu sumber dana
  ADD COLUMN IF NOT EXISTS alamat_toko         TEXT              NULL,           -- alamat toko (jika beda dari alamat lama)
  ADD COLUMN IF NOT EXISTS no_telepon          TEXT              NULL;           -- no. telepon toko

-- Catatan: kolom `diskon` dan `pajak` yang sudah ada (tipe NUMERIC) dipertahankan
--          untuk backward-compat. Kolom baru diskon_nominal/pajak_nominal lebih eksplisit.
-- Kolom `metode_pembayaran` sudah ada (lihat skema awal).
-- Kolom `alamat` mungkin sudah ada — tambah `alamat_toko` sebagai alias bersih.

-- ── receipt_items: tambah keterangan per-item ────────────────────────────────

ALTER TABLE receipt_items
  ADD COLUMN IF NOT EXISTS keterangan          TEXT              NULL;           -- catatan per-item

-- ── Komentar & indeks ────────────────────────────────────────────────────────

COMMENT ON COLUMN receipts.waktu          IS 'Jam transaksi (format HH:MM atau HH:MM:SS)';
COMMENT ON COLUMN receipts.diskon_nominal IS 'Diskon dalam nominal Rupiah';
COMMENT ON COLUMN receipts.diskon_persen  IS 'Diskon dalam persen (0–100)';
COMMENT ON COLUMN receipts.pajak_nominal  IS 'Pajak (PPN dll.) dalam nominal Rupiah';
COMMENT ON COLUMN receipts.pajak_persen   IS 'Pajak dalam persen (0–100)';
COMMENT ON COLUMN receipts.biaya_tambahan IS 'Biaya admin/transaksi/layanan tambahan';
COMMENT ON COLUMN receipts.sumber_dana    IS 'Rekening/kartu/wallet sumber dana pembayaran';
COMMENT ON COLUMN receipts.alamat_toko    IS 'Alamat toko/merchant (dari OCR)';
COMMENT ON COLUMN receipts.no_telepon     IS 'Nomor telepon toko/merchant (dari OCR)';
COMMENT ON COLUMN receipt_items.keterangan IS 'Catatan/keterangan per baris barang';
