# NOTABASE — Database Schema (Supabase PostgreSQL)

Perluasan dari struktur data PRD §10 (`Receipts`, `Receipt Items`), ditambah tabel pendukung yang diperlukan agar arsitektur di dokumen 01 (workspace isolation, sync, export history, OneDrive) benar-benar bisa jalan.

---

## 1. Entity Relationship (ringkas)

```
workspaces (1) ──< receipts (1) ──< receipt_items
workspaces (1) ──< onedrive_connections
workspaces (1) ──< export_history
workspaces (1) ──< app_settings
workspaces (1) ──< devices           (opsional, untuk audit "diupload oleh Admin 1")
```

---

## 2. DDL

```sql
-- =========================================================
-- EXTENSIONS
-- =========================================================
create extension if not exists "pgcrypto"; -- untuk gen_random_uuid()

-- =========================================================
-- 1. WORKSPACES  (baru — pemisah data antar instansi/UMKM)
-- =========================================================
create table workspaces (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,          -- "BPSDMP-MANADO"
  nama          text not null,                  -- "BPSDMP Kominfo Manado"
  logo_url      text,
  created_at    timestamptz not null default now()
);

-- =========================================================
-- 2. DEVICES  (opsional — jejak "diupload oleh Admin 1")
-- =========================================================
create table devices (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  nama_perangkat text,                          -- "Admin 1", "Laptop Kasir"
  platform      text check (platform in ('windows','android')),
  install_id    text unique not null,           -- generated on first run, stored locally
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- =========================================================
-- 3. RECEIPTS  (perluasan dari PRD §10)
-- =========================================================
create table receipts (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  device_id         uuid references devices(id),

  receipt_number    text not null,                -- "INV-2025-051"
  receipt_type      text not null check (receipt_type in ('scan','gallery','manual')),
  receipt_template  text,                          -- template nota (58mm/80mm/A4) untuk tipe manual

  image_url         text,                          -- path di Supabase Storage (bukan public URL)

  tanggal           date not null,
  nama_toko         text not null,
  kategori          text,                          -- lihat 03-business-rules.md §8
  nominal           numeric(14,2) not null check (nominal >= 0),
  diskon            numeric(14,2) default 0,
  pajak             numeric(14,2) default 0,
  metode_pembayaran text,
  keterangan        text,

  status_ocr        text check (status_ocr in ('berhasil','perlu_review','gagal','manual')),
  ocr_confidence    numeric(5,2),                  -- 0.00 - 100.00
  ocr_raw_text      text,                          -- teks mentah OCR untuk audit

  is_deleted        boolean not null default false,  -- soft delete (BR-ARC-01)
  deleted_at        timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_receipts_workspace       on receipts (workspace_id) where is_deleted = false;
create index idx_receipts_tanggal         on receipts (workspace_id, tanggal desc);
create index idx_receipts_nama_toko_trgm  on receipts using gin (nama_toko gin_trgm_ops); -- butuh ext pg_trgm
create index idx_receipts_type            on receipts (workspace_id, receipt_type);
create index idx_receipts_status_ocr      on receipts (workspace_id, status_ocr);
create unique index uq_receipts_number_per_ws on receipts (workspace_id, receipt_number);

-- =========================================================
-- 4. RECEIPT ITEMS
-- =========================================================
create table receipt_items (
  id            uuid primary key default gen_random_uuid(),
  receipt_id    uuid not null references receipts(id) on delete cascade,
  nama_barang   text not null,
  qty           integer not null default 1 check (qty > 0),
  harga         numeric(14,2) not null check (harga >= 0),
  subtotal      numeric(14,2) generated always as (qty * harga) stored,
  urutan        integer default 0,                  -- urutan tampil di preview
  created_at    timestamptz not null default now()
);

create index idx_receipt_items_receipt on receipt_items (receipt_id);

-- =========================================================
-- 5. EXPORT HISTORY
-- =========================================================
create table export_history (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  device_id         uuid references devices(id),

  file_name         text not null,                  -- "Laporan_Mei_2025.xlsx"
  period_type       text check (period_type in ('harian','mingguan','bulanan','tahunan','rentang')),
  period_start      date,
  period_end        date,
  total_baris       integer,
  total_nominal     numeric(14,2),

  status            text check (status in ('sukses','gagal')),
  uploaded_onedrive boolean not null default false,
  onedrive_path     text,

  created_at        timestamptz not null default now()
);

create index idx_export_history_ws on export_history (workspace_id, created_at desc);

-- =========================================================
-- 6. ONEDRIVE CONNECTIONS
-- =========================================================
create table onedrive_connections (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references workspaces(id) on delete cascade,
  account_email         text not null,
  -- token TIDAK disimpan di sini demi keamanan (lihat 01-architecture.md §6);
  -- kolom ini hanya menyimpan status/metadata koneksi.
  connected_at          timestamptz not null default now(),
  status                text check (status in ('connected','expired','disconnected')) default 'connected',
  storage_used_bytes    bigint,
  storage_total_bytes   bigint,
  last_checked_at       timestamptz
);

create unique index uq_onedrive_per_ws on onedrive_connections (workspace_id);

-- =========================================================
-- 7. APP SETTINGS  (per workspace, sinkron lintas perangkat)
-- =========================================================
create table app_settings (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  key           text not null,                      -- "bahasa" | "format_gambar" | "hapus_setelah_upload" | dst
  value         jsonb not null,
  updated_at    timestamptz not null default now(),
  unique (workspace_id, key)
);

-- =========================================================
-- TRIGGER: auto-update updated_at
-- =========================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_receipts_updated_at
before update on receipts
for each row execute function set_updated_at();
```

---

## 3. Row Level Security (RLS)

Aplikasi tidak punya user login, jadi isolasi data dilakukan lewat `workspace_id` yang dikirim sebagai custom claim di JWT anon Supabase (digenerate saat setup workspace, disimpan di device secara lokal).

```sql
alter table receipts            enable row level security;
alter table receipt_items       enable row level security;
alter table export_history      enable row level security;
alter table onedrive_connections enable row level security;
alter table app_settings        enable row level security;
alter table devices             enable row level security;

-- contoh policy untuk receipts — pola yang sama diterapkan ke tabel lain
create policy "workspace_isolation_select" on receipts
  for select using (workspace_id = (current_setting('request.jwt.claims', true)::json->>'workspace_id')::uuid);

create policy "workspace_isolation_modify" on receipts
  for all using (workspace_id = (current_setting('request.jwt.claims', true)::json->>'workspace_id')::uuid)
  with check (workspace_id = (current_setting('request.jwt.claims', true)::json->>'workspace_id')::uuid);

-- receipt_items diisolasi lewat join ke receipts
create policy "workspace_isolation_items" on receipt_items
  for all using (
    exists (
      select 1 from receipts r
      where r.id = receipt_items.receipt_id
      and r.workspace_id = (current_setting('request.jwt.claims', true)::json->>'workspace_id')::uuid
    )
  );
```

---

## 4. Supabase Storage

| Bucket | Akses | Struktur path |
|---|---|---|
| `receipt-images` | Private, signed URL | `{workspace_id}/{tahun}/{bulan}/{receipt_id}.jpg` |
| `receipt-templates` | Private, signed URL | assets template nota (logo, background thermal/A4) opsional per workspace |

---

## 5. Scheduled Job (Supabase Edge Function / pg_cron)

```sql
-- Purge permanen data soft-deleted lebih dari 30 hari (BR-ARC-01)
select cron.schedule(
  'purge-deleted-receipts',
  '0 2 * * *',  -- setiap jam 02:00
  $$
    delete from receipts
    where is_deleted = true
    and deleted_at < now() - interval '30 days';
    -- catatan: hapus file terkait di Storage dilakukan via Edge Function terpisah
    -- (trigger AFTER DELETE tidak bisa langsung panggil Storage API)
  $$
);
```

---

## 6. Ringkasan Perbedaan dari Skema PRD Asli

| Item | PRD Asli | Skema Revisi | Alasan |
|---|---|---|---|
| Pemisah data antar instansi | Tidak ada | `workspaces` + RLS | Cegah kebocoran data lintas organisasi (lihat 01-architecture §0) |
| Hapus nota | Hard delete | Soft delete (`is_deleted`, `deleted_at`) + purge terjadwal | Mitigasi human error |
| Kategori nota | Disebut di fitur, tidak ada di kolom `Receipts` PRD §10 | Kolom `kategori` ditambahkan | Konsisten dengan fitur Filter & Dashboard kategori di mockup |
| Diskon/Pajak | Disebut di form Buat Nota, tidak ada kolom di §10 | Kolom `diskon`, `pajak`, `metode_pembayaran` ditambahkan | Data ini perlu tersimpan agar bisa dilihat lagi saat edit/cetak ulang |
| Riwayat export & OneDrive | Disebutkan di UI (mockup "Riwayat Upload") tapi tidak ada tabelnya di PRD §10 | Tabel `export_history`, `onedrive_connections` | Mockup menampilkan data ini, harus ada sumbernya di DB |
| Confidence OCR & raw text | Disebut "Tingkat Keyakinan 92%" di mockup, tidak ada kolomnya di PRD §10 | Kolom `ocr_confidence`, `ocr_raw_text` ditambahkan | Diperlukan untuk badge & fitur "Lihat Log" di Detail Nota |
