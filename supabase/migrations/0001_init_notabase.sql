
-- =============================================================================
-- RESET SCHEMA LAMA (Menghapus tabel lama sebelum membuat skema baru)
-- =============================================================================
drop table if exists receipt_items cascade;
drop table if exists receipts cascade;
drop table if exists devices cascade;
drop table if exists export_history cascade;
drop table if exists onedrive_connections cascade;
drop table if exists app_settings cascade;
drop table if exists sync_logs cascade;
drop table if exists upload_logs cascade;
drop table if exists settings cascade;
drop table if exists workspaces cascade;

-- =============================================================================
-- EXTENSIONS
-- =============================================================================
create extension if not exists "pgcrypto";    -- gen_random_uuid()
create extension if not exists "pg_trgm";     -- full-text trigram search (idx_receipts_nama_toko_trgm)
create extension if not exists "pg_cron";     -- scheduled job purge soft-delete (§5)

-- =============================================================================
-- HELPER FUNCTION: auto-update kolom updated_at
-- Dipasang sebagai trigger di tabel receipts & app_settings.
-- =============================================================================
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- HELPER FUNCTION: baca workspace_id dari JWT claim
-- Digunakan oleh semua policy RLS agar tidak ada duplikasi ekspresi.
-- Arsitektur §6: workspace JWT claim dikirim via custom claim 'workspace_id'
-- di dalam payload JWT anon Supabase yang di-generate saat setup workspace.
-- =============================================================================
create or replace function current_workspace_id()
returns uuid
language sql
stable
as $$
  select (current_setting('request.jwt.claims', true)::json->>'workspace_id')::uuid;
$$;

-- =============================================================================
-- 1. WORKSPACES
--    Pemisah data antar instansi / UMKM (BR-WS-01 s.d. BR-WS-04)
--    Tabel ini TIDAK di-RLS — sengaja dapat dibaca tanpa filter workspace
--    agar proses "Gabung Workspace" (lookup by code) tetap bisa jalan.
--    Write access dikontrol hanya via service-role key, bukan anon key.
-- =============================================================================
create table if not exists workspaces (
  id          uuid        primary key default gen_random_uuid(),
  code        text        unique not null,    -- contoh: "BPSDMP-MANADO"
  nama        text        not null,           -- contoh: "BPSDMP Kominfo Manado"
  logo_url    text,
  created_at  timestamptz not null default now()
);

comment on table  workspaces            is 'Satu baris = satu instansi / UMKM. Dibuat sekali saat setup awal aplikasi.';
comment on column workspaces.code       is 'Kode unik workspace yang diketik pengguna saat onboarding (BR-WS-01).';
comment on column workspaces.logo_url   is 'URL logo instansi untuk header nota & UI (opsional).';

-- =============================================================================
-- 2. DEVICES
--    Jejak audit "diupload oleh Admin 1 / Laptop Kasir" (opsional).
--    install_id di-generate sekali saat pertama kali app dijalankan dan
--    disimpan di local storage / SQLite perangkat (BR-WS-02).
-- =============================================================================
create table if not exists devices (
  id              uuid        primary key default gen_random_uuid(),
  workspace_id    uuid        not null references workspaces(id) on delete cascade,
  nama_perangkat  text,                        -- "Admin 1", "Laptop Kasir"
  platform        text        check (platform in ('windows', 'android')),
  install_id      text        unique not null, -- UUID generated on first-run, stored locally
  last_seen_at    timestamptz,
  created_at      timestamptz not null default now()
);

comment on table  devices               is 'Daftar perangkat yang pernah bergabung ke suatu workspace.';
comment on column devices.install_id    is 'UUID unik per instalasi aplikasi. Disimpan di SQLite lokal perangkat.';
comment on column devices.platform      is '"windows" untuk .exe, "android" untuk .apk.';

create index if not exists idx_devices_workspace on devices (workspace_id);

-- =============================================================================
-- 3. RECEIPTS
--    Tabel utama nota — perluasan dari PRD §10.
--    Kolom tambahan vs PRD asli: kategori, diskon, pajak, metode_pembayaran,
--    status_ocr, ocr_confidence, ocr_raw_text, is_deleted, deleted_at,
--    receipt_template, device_id.
-- =============================================================================
create table if not exists receipts (
  id                uuid         primary key default gen_random_uuid(),
  workspace_id      uuid         not null references workspaces(id) on delete cascade,
  device_id         uuid         references devices(id),

  -- Identitas nota
  receipt_number    text         not null,    -- "INV-2025-051" (BR-MAN-01)
  receipt_type      text         not null
                    check (receipt_type in ('scan', 'gallery', 'manual')),
  receipt_template  text,                     -- "58mm" | "80mm" | "A4" — untuk receipt_type=manual

  -- Gambar
  image_url         text,                     -- path di Supabase Storage (bukan public URL)
                                              -- format: {workspace_id}/{tahun}/{bulan}/{receipt_id}.jpg

  -- Isi nota
  tanggal           date         not null,
  nama_toko         text         not null,
  kategori          text,                     -- daftar: lihat 03-business-rules.md §8
                                              -- tipe TEXT (bukan enum) agar mudah ditambah tanpa migrasi
  nominal           numeric(14,2) not null check (nominal >= 0),
  diskon            numeric(14,2) not null default 0 check (diskon >= 0),
  pajak             numeric(14,2) not null default 0 check (pajak >= 0),
  metode_pembayaran text,
  keterangan        text,

  -- OCR metadata (BR-OCR-03 s.d. BR-OCR-06)
  status_ocr        text         check (status_ocr in ('berhasil', 'perlu_review', 'gagal', 'manual')),
  ocr_confidence    numeric(5,2) check (ocr_confidence between 0 and 100), -- 0.00 – 100.00
  ocr_raw_text      text,                     -- raw OCR output untuk audit "Lihat Log"

  -- Soft delete (BR-ARC-01)
  is_deleted        boolean      not null default false,
  deleted_at        timestamptz,

  -- Audit timestamps
  created_at        timestamptz  not null default now(),
  updated_at        timestamptz  not null default now(),

  -- Constraint: nomor nota unik per workspace
  constraint uq_receipts_number_per_ws unique (workspace_id, receipt_number)
);

comment on table  receipts                  is 'Tabel utama nota hasil scan, galeri, atau input manual.';
comment on column receipts.receipt_type     is '"scan"=kamera, "gallery"=pilih dari galeri, "manual"=buat nota baru. Badge ini permanen (BR-ARC-04).';
comment on column receipts.image_url        is 'Path relatif di bucket receipt-images Supabase Storage. Bukan public URL — akses via signed URL.';
comment on column receipts.kategori         is 'Pilihan: ATK & Kantor, Operasional, Konsumsi, Transportasi, Utilitas, Referensi/Cetak, Lain-lain (BR §8).';
comment on column receipts.nominal          is 'Total akhir nota = subtotal - diskon + pajak (BR-MAN-04). Disimpan sebagai snapshot agar perubahan item tidak otomatis mengubah historical record.';
comment on column receipts.status_ocr       is '"berhasil"=conf≥80%, "perlu_review"=50-79%, "gagal"=<50%, "manual"=tidak melalui OCR.';
comment on column receipts.ocr_confidence   is 'Persentase keyakinan OCR (0.00–100.00). NULL untuk receipt_type=manual.';
comment on column receipts.ocr_raw_text     is 'Teks mentah hasil OCR sebelum parsing. Disimpan permanen untuk fitur "Lihat Log" (BR-OCR-06).';
comment on column receipts.is_deleted       is 'Soft-delete flag (BR-ARC-01). Row tidak muncul di UI tapi masih ada di DB selama < 30 hari.';
comment on column receipts.deleted_at       is 'Timestamp saat soft-delete dilakukan. Dipakai oleh cron purge (§5).';

-- Index untuk query umum (filter, pencarian, sinkronisasi)
create index if not exists idx_receipts_workspace
  on receipts (workspace_id)
  where is_deleted = false;

create index if not exists idx_receipts_tanggal
  on receipts (workspace_id, tanggal desc);

create index if not exists idx_receipts_type
  on receipts (workspace_id, receipt_type);

create index if not exists idx_receipts_status_ocr
  on receipts (workspace_id, status_ocr);

create index if not exists idx_receipts_deleted
  on receipts (is_deleted, deleted_at)
  where is_deleted = true;   -- dipakai cron purge agar efficient

-- Trigram index untuk full-text search nama_toko (BR-SRCH-01)
create index if not exists idx_receipts_nama_toko_trgm
  on receipts using gin (nama_toko gin_trgm_ops);

-- Trigger updated_at
create trigger trg_receipts_updated_at
  before update on receipts
  for each row
  execute function set_updated_at();

-- =============================================================================
-- 4. RECEIPT ITEMS
--    Detail barang dalam satu nota (BR-MAN-02, BR-MAN-03).
--    Terisolasi via receipts.workspace_id (join RLS — lihat §RLS di bawah).
-- =============================================================================
create table if not exists receipt_items (
  id           uuid          primary key default gen_random_uuid(),
  receipt_id   uuid          not null references receipts(id) on delete cascade,
  nama_barang  text          not null,
  qty          integer       not null default 1 check (qty > 0),
  harga        numeric(14,2) not null check (harga >= 0),
  subtotal     numeric(14,2) generated always as (qty * harga) stored,  -- BR-MAN-03
  urutan       integer       not null default 0,   -- urutan tampil di preview nota
  created_at   timestamptz   not null default now()
);

comment on table  receipt_items           is 'Baris barang dalam satu nota. Minimal 1 baris untuk simpan (BR-MAN-02).';
comment on column receipt_items.subtotal  is 'Computed column: qty × harga. Read-only, dihitung otomatis (BR-MAN-03).';
comment on column receipt_items.urutan    is 'Urutan tampil di preview/print nota. 0-indexed, ascending.';

create index if not exists idx_receipt_items_receipt on receipt_items (receipt_id);

-- =============================================================================
-- 5. EXPORT HISTORY
--    Riwayat setiap aksi export (sukses/gagal), ditampilkan di layar
--    "Riwayat Upload" pada mockup OneDrive Sync (BR-EXP-06).
-- =============================================================================
create table if not exists export_history (
  id                uuid          primary key default gen_random_uuid(),
  workspace_id      uuid          not null references workspaces(id) on delete cascade,
  device_id         uuid          references devices(id),

  file_name         text          not null,    -- "Laporan_Mei_2025.xlsx" (BR-EXP-01)
  period_type       text          check (period_type in ('harian', 'mingguan', 'bulanan', 'tahunan', 'rentang')),
  period_start      date,
  period_end        date,
  total_baris       integer,
  total_nominal     numeric(14,2),

  status            text          check (status in ('sukses', 'gagal')),
  uploaded_onedrive boolean       not null default false,
  onedrive_path     text,         -- "/Notabase/{nama_workspace}/{tahun}/" (BR-EXP-04)

  created_at        timestamptz   not null default now()
);

comment on table  export_history                  is 'Log setiap aksi export. Ditampilkan di layar Riwayat Upload (BR-EXP-06).';
comment on column export_history.onedrive_path    is 'Path tujuan OneDrive jika uploaded_onedrive=true. Format: /Notabase/{workspace}/{tahun}/.';
comment on column export_history.total_nominal    is 'Σ nominal dari semua baris yang diekspor pada aksi ini.';

create index if not exists idx_export_history_ws
  on export_history (workspace_id, created_at desc);

-- =============================================================================
-- 6. ONEDRIVE CONNECTIONS
--    Metadata koneksi akun Microsoft per workspace.
--    Token OAuth TIDAK disimpan di sini — disimpan di OS Keychain via
--    Tauri plugin-stronghold (01-architecture.md §6).
-- =============================================================================
create table if not exists onedrive_connections (
  id                   uuid          primary key default gen_random_uuid(),
  workspace_id         uuid          not null references workspaces(id) on delete cascade,
  account_email        text          not null,
  connected_at         timestamptz   not null default now(),
  status               text          not null default 'connected'
                       check (status in ('connected', 'expired', 'disconnected')),
  storage_used_bytes   bigint,
  storage_total_bytes  bigint,
  last_checked_at      timestamptz,

  -- Satu workspace hanya boleh punya satu koneksi OneDrive aktif
  constraint uq_onedrive_per_ws unique (workspace_id)
);

comment on table  onedrive_connections                   is 'Metadata koneksi Microsoft OneDrive per workspace. Token TIDAK disimpan di sini.';
comment on column onedrive_connections.account_email     is 'Email akun Microsoft yang terhubung. Hanya untuk display — bukan credential.';
comment on column onedrive_connections.status            is '"connected"=aktif, "expired"=token kadaluarsa (BR-EXP-04), "disconnected"=disconnect manual.';
comment on column onedrive_connections.storage_used_bytes is 'Penggunaan storage OneDrive (dari Microsoft Graph API). Untuk display quota di UI.';

-- =============================================================================
-- 7. APP SETTINGS
--    Pengaturan aplikasi per workspace, tersinkron lintas perangkat
--    via Supabase Realtime (BR-SYNC-01).
--    Key yang dikenal: "bahasa", "format_gambar", "hapus_setelah_upload",
--    "folder_simpan_default", "tema", "kategori_custom", dsb.
-- =============================================================================
create table if not exists app_settings (
  id            uuid          primary key default gen_random_uuid(),
  workspace_id  uuid          not null references workspaces(id) on delete cascade,
  key           text          not null,    -- nama pengaturan
  value         jsonb         not null,    -- nilai fleksibel (string, number, boolean, array)
  updated_at    timestamptz   not null default now(),

  constraint uq_app_settings_key unique (workspace_id, key)
);

comment on table  app_settings        is 'Key-value store pengaturan aplikasi per workspace. Tersinkron realtime lintas perangkat.';
comment on column app_settings.key    is 'Contoh: "bahasa", "format_gambar", "hapus_setelah_upload", "tema", "kategori_custom".';
comment on column app_settings.value  is 'JSONB agar fleksibel: bisa string, number, boolean, maupun array (untuk kategori_custom).';

-- Trigger updated_at
create trigger trg_app_settings_updated_at
  before update on app_settings
  for each row
  execute function set_updated_at();

create index if not exists idx_app_settings_workspace on app_settings (workspace_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================
-- Strategi: isolasi workspace via JWT claim 'workspace_id' (bukan auth.uid()).
-- Arsitektur §6 + BR-WS-03:
--   • Saat setup workspace, app minta service-role key generate JWT anon khusus
--     yang mengandung klaim {"workspace_id": "<uuid>"}.
--   • JWT ini disimpan di SQLite lokal dan dikirim sebagai bearer token ke setiap
--     request Supabase.
--   • RLS membaca klaim tersebut via fungsi current_workspace_id() di atas.
-- =============================================================================

-- Aktifkan RLS pada seluruh tabel yang mengandung data per-workspace
alter table devices              enable row level security;
alter table receipts             enable row level security;
alter table receipt_items        enable row level security;
alter table export_history       enable row level security;
alter table onedrive_connections enable row level security;
alter table app_settings         enable row level security;

-- Tabel workspaces TIDAK di-RLS (lihat catatan di §1 di atas):
--   anon key hanya bisa SELECT, INSERT dikontrol via service-role di sisi server.
alter table workspaces           enable row level security;

-- ── workspaces ──────────────────────────────────────────────────────────────
-- Anon key boleh SELECT workspace berdasarkan id atau code (untuk onboarding).
-- INSERT/UPDATE/DELETE hanya via service-role (bukan via anon/RLS).

create policy "ws_anon_select" on workspaces
  for select
  using (true);   -- siapa pun bisa lookup workspace by code untuk onboarding

-- ── devices ─────────────────────────────────────────────────────────────────

create policy "devices_select" on devices
  for select
  using (workspace_id = current_workspace_id());

create policy "devices_insert" on devices
  for insert
  with check (workspace_id = current_workspace_id());

create policy "devices_update" on devices
  for update
  using    (workspace_id = current_workspace_id())
  with check (workspace_id = current_workspace_id());

-- Perangkat tidak bisa dihapus via anon (hanya service-role/admin)
-- sehingga tidak ada policy DELETE untuk devices.

-- ── receipts ────────────────────────────────────────────────────────────────

create policy "receipts_select" on receipts
  for select
  using (workspace_id = current_workspace_id());

create policy "receipts_insert" on receipts
  for insert
  with check (workspace_id = current_workspace_id());

create policy "receipts_update" on receipts
  for update
  using    (workspace_id = current_workspace_id())
  with check (workspace_id = current_workspace_id());

-- Hapus (soft delete di aplikasi, tapi policy tetap diperlukan untuk kasus edge)
create policy "receipts_delete" on receipts
  for delete
  using (workspace_id = current_workspace_id());

-- ── receipt_items ────────────────────────────────────────────────────────────
-- Tidak ada kolom workspace_id langsung; isolasi dilakukan via join ke receipts.

create policy "items_select" on receipt_items
  for select
  using (
    exists (
      select 1 from receipts r
      where r.id = receipt_items.receipt_id
        and r.workspace_id = current_workspace_id()
    )
  );

create policy "items_insert" on receipt_items
  for insert
  with check (
    exists (
      select 1 from receipts r
      where r.id = receipt_items.receipt_id
        and r.workspace_id = current_workspace_id()
    )
  );

create policy "items_update" on receipt_items
  for update
  using (
    exists (
      select 1 from receipts r
      where r.id = receipt_items.receipt_id
        and r.workspace_id = current_workspace_id()
    )
  )
  with check (
    exists (
      select 1 from receipts r
      where r.id = receipt_items.receipt_id
        and r.workspace_id = current_workspace_id()
    )
  );

create policy "items_delete" on receipt_items
  for delete
  using (
    exists (
      select 1 from receipts r
      where r.id = receipt_items.receipt_id
        and r.workspace_id = current_workspace_id()
    )
  );

-- ── export_history ───────────────────────────────────────────────────────────

create policy "export_history_select" on export_history
  for select
  using (workspace_id = current_workspace_id());

create policy "export_history_insert" on export_history
  for insert
  with check (workspace_id = current_workspace_id());

-- Riwayat export bersifat append-only — tidak ada update/delete dari client.

-- ── onedrive_connections ─────────────────────────────────────────────────────

create policy "onedrive_select" on onedrive_connections
  for select
  using (workspace_id = current_workspace_id());

create policy "onedrive_insert" on onedrive_connections
  for insert
  with check (workspace_id = current_workspace_id());

create policy "onedrive_update" on onedrive_connections
  for update
  using    (workspace_id = current_workspace_id())
  with check (workspace_id = current_workspace_id());

create policy "onedrive_delete" on onedrive_connections
  for delete
  using (workspace_id = current_workspace_id());

-- ── app_settings ─────────────────────────────────────────────────────────────

create policy "settings_select" on app_settings
  for select
  using (workspace_id = current_workspace_id());

create policy "settings_insert" on app_settings
  for insert
  with check (workspace_id = current_workspace_id());

create policy "settings_update" on app_settings
  for update
  using    (workspace_id = current_workspace_id())
  with check (workspace_id = current_workspace_id());

create policy "settings_delete" on app_settings
  for delete
  using (workspace_id = current_workspace_id());

-- =============================================================================
-- SUPABASE STORAGE BUCKETS
-- (Dijalankan via Supabase Dashboard / API, bukan DDL biasa —
--  tapi didokumentasikan di sini untuk referensi deployment)
-- =============================================================================
-- Bucket: receipt-images
--   • Private, akses via signed URL (expiry ~1 jam)
--   • Path struktur: {workspace_id}/{tahun}/{bulan}/{receipt_id}.jpg
--   • Policy storage: anon bisa upload/download hanya path milik workspace-nya
--     (diimplementasi lewat Storage RLS Supabase menggunakan storage.foldername[1])
--
-- Bucket: receipt-templates
--   • Private, akses via signed URL
--   • Asset template nota (logo, background thermal 58mm/80mm/A4) opsional per workspace
--   • Path struktur: {workspace_id}/templates/{filename}

-- =============================================================================
-- SCHEDULED JOB: Purge soft-deleted receipts (BR-ARC-01)
-- Membutuhkan ekstensi pg_cron yang sudah di-enable di atas.
-- Job ini dijalankan setiap hari pukul 02:00 UTC.
-- Catatan: penghapusan file terkait di Supabase Storage harus dilakukan
-- via Edge Function terpisah (trigger AFTER DELETE tidak bisa langsung
-- memanggil Storage API).
-- =============================================================================
select cron.schedule(
  'purge-deleted-receipts',
  '0 2 * * *',
  $$
    delete from receipts
    where is_deleted = true
      and deleted_at < now() - interval '30 days';
  $$
);

-- =============================================================================
-- SEED DATA: Kategori default di app_settings
-- Diinjeksi saat workspace baru dibuat (via Edge Function / server-side).
-- Di sini hanya sebagai referensi; tidak bisa di-seed tanpa workspace_id nyata.
-- =============================================================================
-- Contoh:
-- insert into app_settings (workspace_id, key, value) values
--   ('<workspace_uuid>', 'kategori_list', '["ATK & Kantor","Operasional","Konsumsi","Transportasi","Utilitas","Referensi/Cetak","Lain-lain"]');
