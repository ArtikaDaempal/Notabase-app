-- NOTABASE - SUPABASE DATABASE MIGRATION SCRIPT
-- Paste and run this script directly in Supabase SQL Editor.

-- =============================================================================
-- 1. EXTENSIONS & FUNCTIONS
-- =============================================================================
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function current_workspace_id()
returns uuid
language sql
stable
as $$
  select (current_setting('request.jwt.claims', true)::json->>'workspace_id')::uuid;
$$;

-- =============================================================================
-- 2. TABLES DEFINITION
-- =============================================================================

-- WORKSPACES
create table if not exists workspaces (
  id          uuid        primary key default gen_random_uuid(),
  code        text        unique not null,
  nama        text        not null,
  logo_url    text,
  created_at  timestamptz not null default now()
);

-- DEVICES
create table if not exists devices (
  id              uuid        primary key default gen_random_uuid(),
  workspace_id    uuid        not null references workspaces(id) on delete cascade,
  nama_perangkat  text,
  platform        text        check (platform in ('windows', 'android')),
  install_id      text        unique not null,
  last_seen_at    timestamptz,
  created_at      timestamptz not null default now()
);

-- RECEIPTS
create table if not exists receipts (
  id                  uuid         primary key default gen_random_uuid(),
  workspace_id        uuid         not null references workspaces(id) on delete cascade,
  device_id           uuid         references devices(id),
  receipt_number      text         not null,
  receipt_type        text         not null check (receipt_type in ('scan', 'gallery', 'manual')),
  receipt_template    text,
  image_url           text,
  tanggal             date         not null,
  waktu               text,
  nama_toko           text         not null,
  alamat              text,
  no_telepon          text,
  kategori            text,
  nominal             numeric(14,2) not null check (nominal >= 0),
  subtotal_nominal    numeric(14,2) default 0,
  diskon              numeric(14,2) not null default 0 check (diskon >= 0),
  pajak               numeric(14,2) not null default 0 check (pajak >= 0),
  biaya_tambahan      numeric(14,2) not null default 0 check (biaya_tambahan >= 0),
  nama_biaya_tambahan text,
  metode_pembayaran   text,
  keterangan          text,
  status_ocr          text         check (status_ocr in ('berhasil', 'perlu_review', 'gagal', 'manual')),
  ocr_confidence      numeric(5,2) check (ocr_confidence between 0 and 100),
  ocr_raw_text        text,
  is_deleted          boolean      not null default false,
  deleted_at          timestamptz,
  created_at          timestamptz  not null default now(),
  updated_at          timestamptz  not null default now(),
  constraint uq_receipts_number_per_ws unique (workspace_id, receipt_number)
);

-- RECEIPT ITEMS
create table if not exists receipt_items (
  id           uuid          primary key default gen_random_uuid(),
  receipt_id   uuid          not null references receipts(id) on delete cascade,
  nama_barang  text          not null,
  qty          integer       not null default 1 check (qty > 0),
  harga        numeric(14,2) not null check (harga >= 0),
  subtotal     numeric(14,2) generated always as (qty * harga) stored,
  urutan       integer       not null default 0,
  created_at   timestamptz   not null default now()
);

-- EXPORT HISTORY
create table if not exists export_history (
  id                uuid          primary key default gen_random_uuid(),
  workspace_id      uuid          not null references workspaces(id) on delete cascade,
  device_id         uuid          references devices(id),
  file_name         text          not null,
  period_type       text          check (period_type in ('harian', 'mingguan', 'bulanan', 'tahunan', 'rentang')),
  period_start      date,
  period_end        date,
  total_baris       integer,
  total_nominal     numeric(14,2),
  status            text          check (status in ('sukses', 'gagal')),
  uploaded_onedrive boolean       not null default false,
  onedrive_path     text,
  created_at        timestamptz   not null default now()
);

-- ONEDRIVE CONNECTIONS
create table if not exists onedrive_connections (
  id                   uuid          primary key default gen_random_uuid(),
  workspace_id         uuid          not null references workspaces(id) on delete cascade,
  account_email        text          not null,
  connected_at         timestamptz   not null default now(),
  status               text          not null default 'connected' check (status in ('connected', 'expired', 'disconnected')),
  storage_used_bytes   bigint,
  storage_total_bytes  bigint,
  last_checked_at      timestamptz,
  constraint uq_onedrive_per_ws unique (workspace_id)
);

-- APP SETTINGS
create table if not exists app_settings (
  id            uuid          primary key default gen_random_uuid(),
  workspace_id  uuid          not null references workspaces(id) on delete cascade,
  key           text          not null,
  value         jsonb         not null,
  updated_at    timestamptz   not null default now(),
  constraint uq_app_settings_key unique (workspace_id, key)
);

-- =============================================================================
-- 3. INDEXES & TRIGGERS
-- =============================================================================
create index if not exists idx_devices_workspace on devices (workspace_id);

create index if not exists idx_receipts_workspace on receipts (workspace_id) where is_deleted = false;
create index if not exists idx_receipts_tanggal on receipts (workspace_id, tanggal desc);
create index if not exists idx_receipts_type on receipts (workspace_id, receipt_type);
create index if not exists idx_receipts_status_ocr on receipts (workspace_id, status_ocr);
create index if not exists idx_receipts_deleted on receipts (is_deleted, deleted_at) where is_deleted = true;
create index if not exists idx_receipts_nama_toko_trgm on receipts using gin (nama_toko gin_trgm_ops);

create index if not exists idx_receipt_items_receipt on receipt_items (receipt_id);
create index if not exists idx_export_history_ws on export_history (workspace_id, created_at desc);
create index if not exists idx_app_settings_workspace on app_settings (workspace_id);

drop trigger if exists trg_receipts_updated_at on receipts;
create trigger trg_receipts_updated_at before update on receipts for each row execute function set_updated_at();

drop trigger if exists trg_app_settings_updated_at on app_settings;
create trigger trg_app_settings_updated_at before update on app_settings for each row execute function set_updated_at();

-- =============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
alter table devices              enable row level security;
alter table receipts             enable row level security;
alter table receipt_items        enable row level security;
alter table export_history       enable row level security;
alter table onedrive_connections enable row level security;
alter table app_settings         enable row level security;
alter table workspaces           enable row level security;

-- WORKSPACES POLICIES
drop policy if exists "ws_anon_select" on workspaces;
create policy "ws_anon_select" on workspaces for select using (true);

-- DEVICES POLICIES
drop policy if exists "devices_select" on devices;
create policy "devices_select" on devices for select using (workspace_id = current_workspace_id());
drop policy if exists "devices_insert" on devices;
create policy "devices_insert" on devices for insert with check (workspace_id = current_workspace_id());
drop policy if exists "devices_update" on devices;
create policy "devices_update" on devices for update using (workspace_id = current_workspace_id()) with check (workspace_id = current_workspace_id());

-- RECEIPTS POLICIES
drop policy if exists "receipts_select" on receipts;
create policy "receipts_select" on receipts for select using (workspace_id = current_workspace_id());
drop policy if exists "receipts_insert" on receipts;
create policy "receipts_insert" on receipts for insert with check (workspace_id = current_workspace_id());
drop policy if exists "receipts_update" on receipts;
create policy "receipts_update" on receipts for update using (workspace_id = current_workspace_id()) with check (workspace_id = current_workspace_id());
drop policy if exists "receipts_delete" on receipts;
create policy "receipts_delete" on receipts for delete using (workspace_id = current_workspace_id());

-- RECEIPT ITEMS POLICIES
drop policy if exists "items_select" on receipt_items;
create policy "items_select" on receipt_items for select using (
  exists (select 1 from receipts r where r.id = receipt_items.receipt_id and r.workspace_id = current_workspace_id())
);
drop policy if exists "items_insert" on receipt_items;
create policy "items_insert" on receipt_items for insert with check (
  exists (select 1 from receipts r where r.id = receipt_items.receipt_id and r.workspace_id = current_workspace_id())
);
drop policy if exists "items_update" on receipt_items;
create policy "items_update" on receipt_items for update using (
  exists (select 1 from receipts r where r.id = receipt_items.receipt_id and r.workspace_id = current_workspace_id())
) with check (
  exists (select 1 from receipts r where r.id = receipt_items.receipt_id and r.workspace_id = current_workspace_id())
);
drop policy if exists "items_delete" on receipt_items;
create policy "items_delete" on receipt_items for delete using (
  exists (select 1 from receipts r where r.id = receipt_items.receipt_id and r.workspace_id = current_workspace_id())
);

-- EXPORT HISTORY POLICIES
drop policy if exists "export_history_select" on export_history;
create policy "export_history_select" on export_history for select using (workspace_id = current_workspace_id());
drop policy if exists "export_history_insert" on export_history;
create policy "export_history_insert" on export_history for insert with check (workspace_id = current_workspace_id());

-- ONEDRIVE CONNECTIONS POLICIES
drop policy if exists "onedrive_select" on onedrive_connections;
create policy "onedrive_select" on onedrive_connections for select using (workspace_id = current_workspace_id());
drop policy if exists "onedrive_insert" on onedrive_connections;
create policy "onedrive_insert" on onedrive_connections for insert with check (workspace_id = current_workspace_id());
drop policy if exists "onedrive_update" on onedrive_connections;
create policy "onedrive_update" on onedrive_connections for update using (workspace_id = current_workspace_id()) with check (workspace_id = current_workspace_id());
drop policy if exists "onedrive_delete" on onedrive_connections;
create policy "onedrive_delete" on onedrive_connections for delete using (workspace_id = current_workspace_id());

-- APP SETTINGS POLICIES
drop policy if exists "settings_select" on app_settings;
create policy "settings_select" on app_settings for select using (workspace_id = current_workspace_id());
drop policy if exists "settings_insert" on app_settings;
create policy "settings_insert" on app_settings for insert with check (workspace_id = current_workspace_id());
drop policy if exists "settings_update" on app_settings;
create policy "settings_update" on app_settings for update using (workspace_id = current_workspace_id()) with check (workspace_id = current_workspace_id());
drop policy if exists "settings_delete" on app_settings;
create policy "settings_delete" on app_settings for delete using (workspace_id = current_workspace_id());
