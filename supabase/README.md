# NOTABASE — Panduan Deploy Supabase

## Langkah-langkah Deployment

### 1. Buat Project Supabase Baru
Buka [supabase.com](https://supabase.com) → New Project.

### 2. Aktifkan Ekstensi yang Dibutuhkan
Di **Database → Extensions**, aktifkan:
- `pgcrypto` (biasanya sudah aktif)
- `pg_trgm` (untuk pencarian trigram nama toko)
- `pg_cron` (untuk scheduled purge soft-delete)

### 3. Jalankan Migrasi DDL
Buka **SQL Editor** di dashboard Supabase, lalu jalankan file:
```
supabase/migrations/0001_init_notabase.sql
```

### 4. Buat Storage Buckets
Di **Storage**, buat dua bucket berikut (keduanya **Private**):

| Bucket | Akses | Struktur path |
|---|---|---|
| `receipt-images` | Private, signed URL | `{workspace_id}/{tahun}/{bulan}/{receipt_id}.jpg` |
| `receipt-templates` | Private, signed URL | `{workspace_id}/templates/{filename}` |

Tambahkan Storage Policy di masing-masing bucket:
- **SELECT**: `(storage.foldername(name))[1] = (current_setting('request.jwt.claims', true)::json->>'workspace_id')`
- **INSERT / UPDATE / DELETE**: sama dengan SELECT

### 5. Konfigurasi JWT Custom Claim untuk Workspace
Notabase tidak menggunakan sistem login user standard. Isolasi data dilakukan
via klaim `workspace_id` di JWT.

**Alur setup workspace baru:**
1. Client menggunakan **service-role key** (hanya saat onboarding, tidak disimpan permanen di client) untuk:
   - `INSERT INTO workspaces (code, nama)` → dapatkan `workspace_id`
2. Client generate **JWT anon** kustom berisi `{ "workspace_id": "<uuid>" }` menggunakan Supabase JWT secret.
3. JWT ini disimpan di SQLite lokal perangkat (Tauri plugin-sql).
4. Semua request selanjutnya memakai JWT ini → RLS otomatis memfilter per workspace.

> ⚠️ **Catatan keamanan**: JWT kustom ini **bukan** token user individual. Semua perangkat dalam satu workspace berbagi JWT yang sama. Token OneDrive disimpan terpisah di OS Keychain (Tauri plugin-stronghold), tidak pernah masuk ke database.

### 6. Set Environment Variables di Aplikasi
```env
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

---

## Struktur Tabel

| Tabel | Keterangan |
|---|---|
| `workspaces` | Satu baris per instansi/UMKM |
| `devices` | Perangkat yang pernah masuk workspace |
| `receipts` | Nota (scan/galeri/manual) — tabel utama |
| `receipt_items` | Baris barang per nota |
| `export_history` | Log setiap aksi export Excel |
| `onedrive_connections` | Metadata koneksi Microsoft OneDrive |
| `app_settings` | Key-value setting per workspace (tersinkron realtime) |

## Scheduled Jobs

| Job | Jadwal | Fungsi |
|---|---|---|
| `purge-deleted-receipts` | Setiap hari 02:00 UTC | Hapus permanen nota yang `is_deleted=true` dan `deleted_at < now() - 30 hari` |

> Penghapusan file gambar terkait di Storage dilakukan via **Edge Function** terpisah yang di-trigger setelah purge SQL selesai.
