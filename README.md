# Notabase — Digital Receipt Management System

Sistem manajemen nota digital dengan fitur **OCR otomatis**, **analitik dashboard**, **export Excel**, dan **sinkronisasi cloud**. Dibangun dengan Next.js 16, TypeScript, Tailwind CSS, dan Prisma.

![Notabase](public/logo.svg)

## Fitur Utama

- **Dashboard Analitik** — statistik harian/mingguan/bulanan/total, grafik nominal, kategori & merchant terbanyak
- **Scan Nota** — kamera live preview dengan frame scanner, auto-focus, flash, import dari galeri
- **OCR Otomatis** — ekstrak merchant, tanggal, total, invoice, dan item dari foto nota menggunakan AI Vision (Z.AI VLM)
- **Review & Edit** — semua hasil OCR dapat diedit sebelum disimpan
- **History** — pencarian, filter (kategori/status), sort, dan pagination
- **Detail Receipt** — preview nota, barcode, metadata lengkap, raw OCR text
- **Report** — laporan harian/mingguan/bulanan/tahunan dengan export Excel (ExcelJS)
- **OneDrive Sync** — sinkronisasi laporan ke cloud (mock implementation)
- **Settings** — konfigurasi lengkap (umum, kamera, OCR, export, OneDrive, tampilan, danger zone)
- **Responsive** — menyesuaikan layar mobile, tablet, dan desktop

## Tech Stack

| Kategori | Teknologi |
|----------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Database | Prisma ORM + SQLite |
| OCR | Z.AI Vision Language Model (VLM) |
| Excel | ExcelJS |
| State | Zustand |
| Animation | Framer Motion |
| Icons | Lucide React |

## Persyaratan Sistem

Pastikan komputer Anda telah terinstall:

- **Node.js** v18.17 atau lebih baru → [Download](https://nodejs.org/)
- **npm** (sudah bundel dengan Node.js) atau **bun** (opsional, lebih cepat) → [Download](https://bun.sh/)

Cek versi:
```bash
node --version    # harus v18.17+
npm --version     # atau: bun --version
```

## Cara Install

### 1. Download / Clone Project

Jika mendownload sebagai ZIP, ekstrak ke folder pilihan Anda. Jika menggunakan git:

```bash
git clone <repository-url> notabase
cd notabase
```

### 2. Install Dependencies

Menggunakan **npm** (default):
```bash
npm install
```

Atau menggunakan **bun** (lebih cepat, direkomendasikan):
```bash
bun install
```

> Perintah `postinstall` akan otomatis menjalankan `prisma generate` untuk generate client database.

### 3. Setup Database

Buat database SQLite dan tabel dari schema Prisma:

```bash
npm run db:push
```

Ini akan membuat file `db/custom.db` dengan tabel: `User`, `Receipt`, `Category`, `UploadLog`, `SyncLog`, `Setting`.

### 4. Konfigurasi Environment (Opsional)

File `.env` sudah berisi konfigurasi default:

```env
# Database (SQLite) - relative path, works on any computer
DATABASE_URL="file:./db/custom.db"

# Z.AI API Key untuk fitur OCR
# Dapatkan key gratis di https://z.ai
ZAI_API_KEY=""
```

**Untuk OCR AI (opsional tapi direkomendasikan):**
1. Daftar akun gratis di [https://z.ai](https://z.ai)
2. Dapatkan API key
3. Isi `ZAI_API_KEY` di file `.env`

> **Tanpa API key:** fitur OCR akan tetap berfungsi tetapi mengembalikan placeholder dengan confidence rendah. Anda dapat mengisi data nota secara manual di layar Review.

### 5. Jalankan Aplikasi

```bash
npm run dev
```

Buka browser ke **http://localhost:3000**

Aplikasi akan menampilkan:
1. **Splash Screen** (2.6 detik) — logo Notabase + loading animation
2. **Dashboard** — otomatis terisi data demo (12 nota contoh + 7 kategori)

## Struktur Project

```
notabase/
├── prisma/
│   └── schema.prisma          # Database schema (User, Receipt, Category, dll)
├── public/
│   ├── logo.svg               # Logo Notabase
│   └── robots.txt
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout (Inter font, theme)
│   │   ├── page.tsx           # App shell (view router via Zustand)
│   │   ├── globals.css        # Tailwind theme + Notabase brand colors
│   │   └── api/               # API routes (backend)
│   │       ├── receipts/      # CRUD receipts + search/filter/pagination
│   │       ├── ocr/           # OCR via Z.AI VLM
│   │       ├── upload/        # Image upload (multipart)
│   │       ├── stats/         # Dashboard analytics
│   │       ├── export/        # Excel export (ExcelJS)
│   │       ├── sync/          # OneDrive sync (mock)
│   │       ├── categories/    # Category CRUD
│   │       └── seed/          # Demo data seeder
│   ├── components/
│   │   ├── layout/            # AppHeader, BottomNav, Logo
│   │   ├── features/          # 9 views: splash, dashboard, scan, ocr,
│   │   │                      #   history, detail, report, onedrive, settings
│   │   └── ui/                # shadcn/ui components
│   ├── lib/
│   │   ├── db.ts              # Prisma client
│   │   ├── utils.ts           # formatRupiah, formatDateID, dll
│   │   └── serialize.ts       # Prisma → API transformers
│   ├── store/
│   │   └── app-store.ts       # Zustand navigation store
│   └── types/
│       └── index.ts           # Shared TypeScript types
├── .env                       # Environment variables
├── package.json
└── tsconfig.json
```

## Perintah yang Tersedia

| Perintah | Deskripsi |
|----------|-----------|
| `npm run dev` | Jalankan dev server di http://localhost:3000 |
| `npm run build` | Build untuk produksi (output ke `.next/`) |
| `npm run start` | Jalankan server produksi (setelah build) |
| `npm run lint` | Cek code quality dengan ESLint |
| `npm run db:push` | Sync schema Prisma ke database SQLite |
| `npm run db:generate` | Regenerate Prisma Client |
| `npm run db:migrate` | Buat migration (development) |
| `npm run db:reset` | Reset database (hapus semua data) |

## Cara Penggunaan

### 1. Dashboard
- Lihat ringkasan: Hari Ini, Minggu Ini, Bulan Ini, Total
- Grafik nominal 7 hari terakhir
- Kategori & merchant terbanyak
- Quick actions: **Scan**, **Import**, **Export**

### 2. Scan Nota
- Klik tab **Scan** di bottom navigation
- Posisikan nota di dalam bingkai scanner
- Klik tombol kamera untuk capture, atau **Import** dari galeri
- Klik **Proses OCR** untuk mengekstrak data

### 3. Review OCR
- Periksa hasil ekstraksi (Tanggal, Nama Toko, Total, Kategori, Keterangan)
- Edit field yang kurang tepat
- Klik **Simpan ke Database**

### 4. History
- Cari berdasarkan merchant / no. invoice / deskripsi
- Filter berdasarkan kategori & status OCR
- Sort: terbaru, terlama, nominal tertinggi/terendah, merchant A-Z
- Klik **Detail** untuk lihat nota lengkap

### 5. Report & Export
- Pilih periode: Harian / Mingguan / Bulanan / Tahunan / Rentang
- Lihat statistik: total nota, total nominal, rata-rata, terverifikasi
- Klik **Export Excel** untuk download file `.xlsx`
- Klik **Upload OneDrive** untuk sync ke cloud

### 6. Settings
- **Umum**: bahasa, lokasi simpan, format gambar
- **Kamera**: resolusi, auto-focus, flash, grid
- **OCR & Bahasa**: bahasa OCR, minimum confidence, auto-OCR
- **Ekspor & Format**: template Excel, mata uang
- **OneDrive**: status koneksi, auto-sync
- **Tampilan**: mode gelap, tampilan kompak, ukuran font
- **Danger Zone**: reset semua data

## Troubleshooting

### Port 3000 sudah digunakan
```bash
# Ubah port di package.json atau jalankan:
npx next dev -p 3001
```

### Database error / ingin reset
```bash
npm run db:reset
# atau hapus manual:
rm db/custom.db
npm run db:push
```

### OCR tidak akurat / error
- Pastikan `ZAI_API_KEY` terisi di `.env`
- Gunakan foto nota dengan pencahayaan cukup
- Pastikan nota rata dan teks terbaca jelas
- Jika tanpa API key, Anda tetap bisa input manual di layar Review

### Error saat `npm install`
- Hapus `node_modules` dan `bun.lock` / `package-lock.json`, lalu install ulang:
```bash
rm -rf node_modules
npm install
```

### Prisma client error
```bash
npm run db:generate
```

## Build untuk Produksi

```bash
npm run build
npm run start
```

Server produksi berjalan di http://localhost:3000 dengan performa optimal.

## Data Demo

Saat pertama kali dijalankan, aplikasi otomatis men-seed:
- **7 kategori**: Makanan & Minuman, Transportasi, Alat Tulis Kantor, Belanja, Kesehatan, Elektronik, Lainnya
- **12 nota contoh** dengan berbagai merchant (Indomaret, Pertamina, Toko Makmur ATK, dll)

Untuk reset data demo, gunakan **Settings → Danger Zone → Reset Semua Data**.

## Lisensi

© BPSDMP KOMINFO MANADO — Aeterna Cloud. Untuk penggunaan internal edukasi.
