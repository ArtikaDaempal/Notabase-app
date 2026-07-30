# NOTABASE — Architecture Document
Versi 1.1 (Revisi Teknis) · Windows (.exe) & Android (.apk) · pola `shared` core + `apps/desktop` & `apps/mobile` terpisah untuk tampilan

---

## 0. Catatan Revisi terhadap PRD

Sebelum masuk ke arsitektur, ada 3 celah di PRD asli yang **wajib diperbaiki** supaya aplikasi layak dipakai banyak instansi/UMKM, bukan cuma demo:

| # | Masalah di PRD | Risiko | Perbaikan |
|---|---|---|---|
| 1 | "Tidak ada login/role, semua fitur langsung dipakai" + "data terpusat di satu Supabase" | Semua pengguna dari instansi berbeda akan **melihat data satu sama lain** karena tidak ada pemisah data (tidak ada `tenant`/`workspace`). Ini bug fatal, bukan sekadar fitur hilang. | Tetap **tanpa login akun personal** (sesuai PRD), tapi tambahkan **Workspace Code** (kode instansi, dibuat sekali saat setup pertama, disimpan lokal). Semua tabel diberi `workspace_id` + Row Level Security (RLS) di Supabase. UX tetap "buka app langsung pakai", tinggal 1x isi/scan kode instansi di awal. |
| 2 | "Sinkronisasi OneDrive pakai OAuth 2.0" tapi "tidak ada login" | Kontradiksi — OneDrive tetap butuh akun Microsoft. | Klarifikasi: OneDrive login **terpisah** dari login aplikasi. Tidak melanggar "no-login app", karena itu koneksi akun cloud pihak ketiga, opsional, per workspace. |
| 3 | "Hapus Nota: permanen dari database & storage" | Human error (salah pencet) tidak bisa dipulihkan. Untuk aplikasi arsip keuangan, ini berisiko tinggi. | Gunakan **soft delete** (`is_deleted`, `deleted_at`) dengan retensi 30 hari sebelum purge permanen (job terjadwal). Tombol "Hapus" tetap terasa permanen di UI, tapi ada jaring pengaman di backend. |
| 4 | "Membutuhkan internet untuk simpan data" (batasan v1.0), padahal user Scan di lapangan sering tanpa sinyal | UX buruk untuk pegawai lapangan/bendahara UMKM | Tambahkan **local-first queue** ringan (SQLite via Tauri plugin) di v1.0: hasil scan disimpan lokal dulu, status `pending_sync`, otomatis upload begitu online. Ini bukan full offline mode (itu tetap di roadmap v1.2), hanya buffer anti-gagal. |

Keempat perbaikan ini dipakai sebagai dasar dokumen arsitektur & skema di bawah.

---

## 1. Gaya Arsitektur

**Client-heavy, BaaS-backed, single-codebase cross-platform.**

- Tauri 2 dipilih dengan tepat di PRD karena satu-satunya opsi yang menghasilkan `.exe` Windows **dan** `.apk` Android native dari satu basis kode React, dengan footprint jauh lebih kecil dari Electron+Capacitor terpisah.
- Logika berat (OCR, image processing) dijalankan **di perangkat** (ONNX + OpenCV), bukan di server → cocok untuk instansi dengan koneksi internet terbatas, dan menghindari biaya server OCR.
- Backend hanya berperan sebagai **BaaS** (Backend-as-a-Service): Supabase untuk data + file, Microsoft Graph untuk ekspor cloud. Tidak ada backend kustom (tidak perlu Node/Express server terpisah) — mengurangi biaya infrastruktur & maintenance, sesuai skala target user (UMKM/instansi kecil-menengah).

---

## 2. Diagram Lapisan (Layered View)

```
┌──────────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER  (React 18 + TypeScript + Tailwind + shadcn) │
│  Dashboard · Scan · Buat Nota · Arsip · Filter · Export · Sync   │
│  Settings · Cetak/Print View                                     │
├──────────────────────────────────────────────────────────────────┤
│  APPLICATION / STATE LAYER                                       │
│  - React Query (server state & cache Supabase)                   │
│  - Zustand (UI/local state: form draft, kamera, filter)          │
│  - Service modules: ocrService, syncService, exportService,      │
│    oneDriveService, receiptService, printService                 │
├──────────────────────────────────────────────────────────────────┤
│  TAURI CORE (Rust) — Native Bridge                                │
│  - Kamera & Galeri (plugin-camera / file picker)                 │
│  - Filesystem lokal (folder simpan default, cache gambar)        │
│  - SQLite lokal (plugin-sql) → antrian sync offline               │
│  - OS Keychain (plugin-stronghold) → simpan token OneDrive aman   │
│  - Print API native                                               │
├──────────────────────────────────────────────────────────────────┤
│  ON-DEVICE PROCESSING                                             │
│  OpenCV (crop, rotate, deskew, enhance)                          │
│        ↓                                                          │
│  ONNX Runtime — model OCR lintas platform                        │
│        ↓ JSON {toko, tanggal, items[], total, confidence}        │
├──────────────────────────────────────────────────────────────────┤
│  INTEGRATION LAYER                                                 │
│  - Supabase JS SDK → Postgres (data) + Storage (gambar nota)      │
│  - Supabase Realtime → sinkron lintas perangkat                  │
│  - ExcelJS → generate file .xlsx dari data hasil filter           │
│  - Microsoft Graph API → upload ke OneDrive (ifkadaempal5@gmail.com)
├──────────────────────────────────────────────────────────────────┤
│  BACKEND (BaaS) — Supabase                                        │
│  PostgreSQL (RLS per workspace) · Storage bucket (private,        │
│  signed URL) · Realtime channel · Scheduled function (purge       │
│  soft-deleted data > 30 hari)                                     │
└──────────────────────────────────────────────────────────────────┘
                    │
                    ▼
         Microsoft OneDrive (Notabase/Ekspor Bulanan/ & Notabase/Ekspor Tahunan/)
```

---

## 3. Alur Data Utama

### 3.1 Scan / Import Galeri → Simpan
```
Kamera/Galeri → OpenCV (crop, rotate, enhance)
             → ONNX OCR (on-device) → JSON hasil + confidence
             → Form review (auto-fill, editable)

── Online-First (impl. aktual v1.0) ─────────────────────────────────────────
  Jika ONLINE:
    → POST /api/receipts → Supabase Postgres INSERT
    → Cache lokal IndexedDB (status: synced=true)
    → UI toast "✅ Tersimpan ke Cloud"

  Jika OFFLINE / Supabase gagal:
    → Simpan ke IndexedDB (status: synced=false, pendingSync=true)
    → Tambahkan ke syncQueue IndexedDB
    → UI toast "📵 Tersimpan Lokal — akan sync otomatis"
    → Badge "Pending" muncul di kartu nota di Arsip

  Saat koneksi kembali (event 'online'):
    → processSyncQueue() replay semua pending (retry 3x + backoff)
    → Status lokal diupdate → synced=true, badge hilang
─────────────────────────────────────────────────────────────────────────────
```

> **Catatan implementasi**: Di v1.0 (Next.js web app), penyimpanan lokal menggunakan
> **IndexedDB via Dexie.js** (`src/lib/local-db.ts`) — bukan SQLite Tauri plugin seperti
> di rencana awal. Pilihan ini karena v1.0 berjalan sebagai web app dulu sebelum
> dikemas ke Tauri. Skema IndexedDB identik dengan tabel SQLite yang direncanakan,
> sehingga migrasi ke SQLite Tauri di v1.2 tidak memerlukan perubahan logika bisnis.

### 3.2 Buat Nota Manual
```
Form 2 panel → Preview real-time (canvas/HTML render)
            → Generate JPG (client-side render to image)
            → Upload ke Supabase Storage
            → Insert row Postgres (receipt_type = manual)
```

### 3.3 Export & OneDrive
```
Filter (periode/kategori/status) → Query Supabase
                                 → ExcelJS build workbook (in-memory)
                                 → Simpan lokal (Downloads) [opsional]
                                 → Jika "Upload ke OneDrive":
                                     Terhubung langsung (ifkadaempal5@gmail.com)
                                     → PUT /me/drive/root:/Notabase/Ekspor Bulanan/${fileName}:/content (Bulanan/Harian/Mingguan)
                                     → PUT /me/drive/root:/Notabase/Ekspor Tahunan/${fileName}:/content (Tahunan)
                                     → Catat ke tabel export_history
```

### 3.4 Sinkronisasi Lintas Perangkat
- Menggunakan **Supabase Realtime (Postgres CDC)**, subscribe ke channel `receipts:workspace_id=eq.<id>`.
- Android & Windows sama-sama subscribe → perubahan di satu perangkat langsung ter-push ke perangkat lain (tidak perlu polling).
- Saat perangkat offline: perubahan tersimpan di antrian lokal (`syncQueue` di IndexedDB via Dexie.js) → begitu online, `syncService` di `src/lib/sync-service.ts` melakukan replay (insert/update yang tertunda), dengan strategi **last-write-wins berbasis `updated_at`** untuk konflik.
- **Impl. v1.0**: online/offline detection via `navigator.onLine` + window events (`online`/`offline`). Auto-sync dipicu oleh event `window.online`. Indikator sync status tampil permanen di header dan bottom-nav (badge dot warna: hijau=synced, kuning=pending, merah=offline).

---

## 4. Struktur Modul Frontend — Pola `shared` + `apps` **[REVISI]**

> Pendekatan final: **bukan** satu UI dengan CSS breakpoint, melainkan **satu core logika yang dibagi (`shared/`)** dan **dua set komponen tampilan terpisah** per platform (`apps/desktop/`, `apps/mobile/`) — mirip pola *product flavors* di Android Studio atau *shared module* di Kotlin Multiplatform. Fungsinya identik di kedua platform; yang beda hanya *layout*, letak tombol/menu, dan kepadatan informasi.

```
notabase/
├── shared/                     # LOGIKA INTI — tidak ada JSX/tampilan di sini,
│   │                           # dipakai identik oleh apps/desktop & apps/mobile
│   ├── services/
│   │   ├── ocrService.ts        # panggil OpenCV+ONNX, hitung confidence, format hasil
│   │   ├── receiptService.ts    # CRUD nota, hitung subtotal/total (BR-MAN-03/04)
│   │   ├── syncService.ts       # antrian offline SQLite + Supabase Realtime
│   │   ├── exportService.ts     # build workbook ExcelJS dari data terfilter
│   │   └── oneDriveService.ts   # OAuth2 + upload Graph API
│   ├── stores/                  # zustand stores: receipts, filters, ocrDraft, syncStatus
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── onnx.ts
│   │   ├── opencv.ts
│   │   └── graphClient.ts
│   ├── hooks/                   # useReceipts(), useExport(), useOcrScan() — logika saja
│   ├── rules/                    # implementasi aturan dari 03-business-rules.md
│   └── types/                    # Receipt, ReceiptItem, Workspace, dst
│
├── packages/
│   └── ui-shared/                # komponen VISUAL yang benar-benar identik di kedua platform
│       └── (StatusBadge, kategori tag, chart, dsb — elemen kecil yang tidak butuh layout khusus)
│
└── apps/
    ├── desktop/                  # build target: Windows .exe
    │   ├── layout/
    │   │   ├── Sidebar.tsx
    │   │   └── TopBar.tsx
    │   ├── pages/
    │   │   ├── DashboardDesktop.tsx     # stat card 4 kolom + chart lebar penuh
    │   │   ├── ArsipTable.tsx           # tabel data, bukan card
    │   │   ├── ScanDesktop.tsx          # webcam feed besar + panel setting di sidebar kanan
    │   │   ├── BuatNotaDesktop.tsx      # 2 panel (sudah cocok desktop apa adanya)
    │   │   └── ExportDesktop.tsx        # filter horizontal tab + tabel pratinjau lebar
    │   └── main.tsx
    │
    └── mobile/                   # build target: Android .apk
        ├── layout/
        │   └── BottomNav.tsx      # 5 tab: Dashboard · Scan · History · Export · Settings
        ├── pages/
        │   ├── DashboardMobile.tsx  # stat card 2 kolom ditumpuk + FAB
        │   ├── ArsipList.tsx        # card list/grid
        │   ├── ScanMobile.tsx       # viewfinder full-bleed + shutter besar
        │   ├── BuatNotaMobile.tsx   # form & preview jadi 2 tab/step, bukan 2 panel sejajar
        │   └── ExportMobile.tsx     # filter dropdown + tombol full-width
        └── main.tsx
```

**Aturan pemisahan:**
- Kalau kode itu **menentukan hasil/perilaku** (hitung total, validasi OCR confidence, format Excel, aturan sync) → wajib di `shared/`, ditulis sekali, diimpor kedua `apps/`.
- Kalau kode itu **menentukan tampilan/posisi** (sidebar vs bottom nav, tabel vs card, 2-panel sejajar vs 2-step) → ditulis terpisah di `apps/desktop/` dan `apps/mobile/`.
- Setiap halaman di `apps/*/pages/` pada dasarnya hanya "merangkai" hook dari `shared/hooks/` dengan komponen layout miliknya sendiri — tidak boleh ada logika bisnis baru ditulis langsung di dalam file page.

**Keuntungan pola ini** (dibanding satu UI + breakpoint yang sempat diusulkan sebelumnya):
- Perubahan aturan bisnis (mis. threshold confidence OCR berubah dari 80% ke 85%) cukup diubah **satu kali** di `shared/rules/`, otomatis berlaku di Windows & Android.
- Bundle `apps/desktop` tidak ikut membawa kode komponen mobile dan sebaliknya → lebih ringan.
- Tidak ada risiko tampilan "setengah mobile setengah desktop" akibat breakpoint yang meleset — masing-masing platform memang dirancang khusus untuknya.

---

## 5. Adaptasi Multi-Perangkat (HP & Laptop) **[REVISI]**

Karena UI dipisah penuh per platform (§4), "adaptasi" di sini bukan soal breakpoint CSS, melainkan **pemetaan fungsi → layout** yang berbeda letak, sama fungsi:

| Fungsi (dari `shared/`) | Tampilan `apps/mobile` | Tampilan `apps/desktop` |
|---|---|---|
| Navigasi utama | Bottom tab bar, 5 ikon | Sidebar kiri, collapsible |
| Ringkasan dashboard | Stat card 2 kolom ditumpuk vertikal | Stat card 4 kolom sejajar |
| Daftar nota (Arsip) | Card list/grid dengan thumbnail besar | Tabel data dengan kolom & pagination |
| Buat Nota | Form & preview dipisah 2 tab/step (layar sempit) | Form kiri + preview kanan sejajar (sesuai mockup asli) |
| Scan | Viewfinder full-screen, tombol shutter besar | Feed webcam + panel pengaturan kamera tetap terlihat di sisi |
| Aksi cepat (Dashboard) | Tombol besar ditumpuk + FAB | Grid tombol dalam satu baris |
| Export & filter | Dropdown filter, tombol full-width | Tab horizontal filter, tabel pratinjau lebar |

Token warna, tipografi, spacing (`02-design-system.md`) **tetap identik** di kedua `apps/` — yang beda murni penempatan & kepadatan komponen, bukan gaya visualnya.

---

## 6. Keamanan

- Semua komunikasi ke Supabase & Microsoft Graph via HTTPS (bawaan SDK).
- **RLS Supabase**: setiap query otomatis difilter `workspace_id = current_setting('app.workspace_id')` — dikirim sebagai header/JWT klaim kustom per sesi aplikasi (bukan JWT user, tapi JWT workspace yang digenerate saat setup).
- Token OneDrive (access + refresh) **tidak** disimpan di Postgres/localStorage — disimpan di OS Keychain via Tauri `plugin-stronghold`/`plugin-store` terenkripsi.
- Storage bucket Supabase bersifat **private**; akses gambar nota memakai signed URL berumur pendek (expiry ± 1 jam), bukan public URL.
- Validasi ukuran & tipe file di sisi client sebelum upload (cegah abuse storage).

---

## 7. Build & Deployment

| Platform | Tooling | Output |
|---|---|---|
| Windows | `tauri build` (bundler NSIS/MSI + portable exe) | `NOTABASE_x.x.x_x64-setup.exe` |
| Android | `tauri android build` (Gradle, signed release) | `NOTABASE.apk` (dan `.aab` untuk Play Store jika suatu saat dirilis) |

CI/CD disarankan: GitHub Actions dengan 2 job (windows-latest, ubuntu-latest+android-sdk) — build paralel dari commit yang sama menjamin *satu basis kode, dua output*, sesuai tujuan PRD.

---

## 8. Nonfungsional (validasi terhadap PRD §12)

Semua poin nonfungsional PRD dipertahankan, ditambah:
- Ukuran model ONNX OCR harus dijaga < 50MB agar startup tetap < 5 detik di perangkat low-end (Android 9 target minimum cukup terbatas RAM-nya).
- Cache gambar lokal dibatasi (mis. auto-cleanup > 500MB atau sesuai setting "Hapus Gambar Setelah Upload" yang sudah ada di mockup Settings).
