# NOTABASE — Design System
Diekstrak dari mockup (splash, dashboard, scan, OCR review, arsip, detail, export, OneDrive sync, settings, search) + disesuaikan untuk mobile & desktop.

---

## 1. Perbaikan Konsistensi (ditemukan di mockup)

Sebelum jadi acuan resmi, ada inkonsistensi kecil di mockup yang perlu diselaraskan:

1. **Bottom navigation tidak konsisten.** Sebagian besar layar pakai 4 tab: `Dashboard · Scan · History · Settings`. Tapi layar Export & OneDrive Sync mengganti tab ke-4 jadi `Export`/`Sync` dan menghilangkan `Settings`.
   → **Keputusan final**: bottom nav punya **5 item tetap**: `Dashboard · Scan · History · Export · Settings`. OneDrive Sync menjadi sub-halaman dari **Settings → OneDrive** (sudah ada menu "OneDrive" di list Settings), bukan tab utama sendiri — supaya tab tidak berubah-ubah antar layar.
2. Splash screen pakai brand instansi (BPSDMP KOMINFO MANADO) sebagai co-branding — jadikan ini **opsional/configurable** di Settings (logo & nama instansi), bukan hardcode, karena target pengguna PRD mencakup UMKM & perusahaan lain juga.
3. Warna hijau dipakai untuk 2 makna berbeda (tombol "Export ke Excel" & badge "Selesai" OCR sukses) — tetap dipakai tapi didefinisikan sebagai token terpisah agar tidak campur aduk secara semantik (`--color-action-secondary` vs `--color-success`).

---

## 2. Design Tokens

### 2.1 Warna

```css
:root {
  /* Brand */
  --color-brand-primary:   #1D4ED8; /* biru utama: tombol, active nav, judul link */
  --color-brand-dark:      #1E3A8A; /* logo "Notabase", heading kuat */
  --color-brand-light:     #EFF3FB; /* background gradient utama */

  /* Semantic */
  --color-success:         #16A34A; /* badge "Selesai", status OCR sukses */
  --color-success-bg:      #DCFCE7;
  --color-danger:          #DC2626; /* Hapus, Zona Berbahaya */
  --color-danger-bg:       #FEE2E2;
  --color-action-secondary:#15803D; /* tombol Export ke Excel (hijau tua) */
  --color-info:            #2563EB; /* link "Lihat Semua", info banner */

  /* Kategori nota (tag) */
  --color-tag-atk:         #16A34A;
  --color-tag-operasional: #6B7280;
  --color-tag-konsumsi:    #059669;

  /* Neutral */
  --color-bg-app:          #EFF3FB;
  --color-bg-card:         #FFFFFF;
  --color-border:          #E2E8F0;
  --color-text-primary:    #0F172A;
  --color-text-secondary:  #64748B;
  --color-text-muted:      #94A3B8;
}
```

### 2.2 Tipografi

Font: **Plus Jakarta Sans** atau **Inter** (sans rounded-modern, dekat dengan kesan mockup) — fallback `system-ui`.

| Role | Ukuran | Weight | Contoh |
|---|---|---|---|
| Display (splash logo) | 32px | 800 | "NOTABASE" |
| H1 (judul halaman) | 24px | 700 | "Selamat datang," / "Arsip Nota" |
| H2 (judul kartu) | 16–18px | 600 | "Total Nominal", "Hasil OCR" |
| Body | 14px | 400–500 | teks form, deskripsi |
| Caption | 12px | 400 | tanggal, label kecil |
| Angka statistik | 28px | 700 | "178", "Rp 24.750.000" |

### 2.3 Spacing & Radius

```css
--radius-card:   16px;   /* kartu utama */
--radius-input:  10px;   /* input, dropdown */
--radius-pill:   999px;  /* badge, tombol utama, nav aktif */
--space-page:    20px;   /* padding horizontal halaman */
--space-card-gap:16px;
--shadow-card:   0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15,23,42,0.04);
```

### 2.4 Ikon
Set ikon: **lucide-react** (garis, rounded, konsisten dengan gaya mockup — kamera, galeri, dokumen, cloud, dsb).

---

## 3. Komponen Inti

### 3.1 Bottom Navigation (mobile) / Sidebar (desktop)
- Mobile: 5 ikon + label, fixed bottom, item aktif berwarna `--color-brand-primary` dengan background pill biru muda pada icon container.
- Desktop: sidebar kiri 220px, item sama, collapsible menjadi icon-only 64px.

### 3.2 Stat Card (Dashboard)
- Kartu putih rounded-2xl, border tipis, isi: label kecil (abu-abu) + angka besar bold.
- Grid 2 kolom di mobile, 4 kolom di desktop.

### 3.3 Chart Card
- Kartu biru muda (`--color-brand-light`) dengan area chart gradasi biru (Recharts `AreaChart`), tanpa grid line berat — gaya minimal sesuai mockup.

### 3.4 List Item Nota (Arsip)
- Thumbnail gambar 1:1 rounded-top, badge status pojok kanan atas (pill hijau "Selesai"), nomor nota + tanggal, nominal bold biru besar, tag kategori/sumber, tombol "Lihat Detail" + icon hapus.
- Mode List vs Grid: toggle di header Arsip (disebut di PRD §9 tapi tidak eksplisit di mockup — tambahkan toggle icon di kanan search bar).

### 3.5 Badge/Pill
```
Status OCR:    hijau (Selesai/Berhasil), kuning (Perlu Review, <80% confidence), merah (Gagal)
Sumber Nota:   Scan (biru) · Galeri (ungu) · Manual (abu-abu)
Kategori:      warna sesuai tag kategori di atas
```

### 3.6 Form Input
- Label di atas input, ikon kiri (kalender, toko, uang, dsb), border abu tipis, focus ring biru, tombol edit (pensil) di kanan untuk field yang auto-filled dari OCR — menandakan "bisa dikoreksi".

### 3.7 Tombol
| Jenis | Style |
|---|---|
| Primary | Solid biru `--color-brand-primary`, rounded-lg/pill, teks putih bold |
| Secondary/Success | Solid hijau (Export ke Excel) |
| Outline | Border abu, teks gelap (Batal, Retake) |
| Danger | Outline merah / solid merah (Hapus, Putuskan Koneksi, Reset Pengaturan) |
| FAB | Lingkaran biru, ikon "+", shadow, pojok kanan bawah (Dashboard, Arsip) |

### 3.8 Progress / Loading
- Splash: progress bar tipis biru di bawah teks "Memuat aplikasi...".
- Upload OneDrive: card besar dengan icon cloud, persen besar, checklist 3 tahap (Mempersiapkan → Mengupload → Menyelesaikan).

### 3.9 Empty State
- Ilustrasi line-art (kotak/box 3D outline biru) + judul + deskripsi + 2 tombol aksi utama (Scan Sekarang / Import Galeri) + 3 feature bullet mini di bawahnya. Dipakai juga untuk state kosong lain (hasil pencarian kosong, dsb) dengan ilustrasi yang disesuaikan.

### 3.10 Kamera Overlay
- Full-bleed viewfinder gelap, frame guide hijau di 4 sudut, tombol shutter besar bulat putih di tengah, "Retake"/"Import" kiri-kanan, panel "Pengaturan Kamera" collapsible di bawah viewfinder (pilih kamera device, kualitas gambar, toggle auto-rotate/auto-crop).

---

## 4. Layout Desktop (Windows) vs Mobile (Android) — Komponen Terpisah, Token Sama **[REVISI]**

Sesuai `01-architecture.md` §4, tampilan Windows dan Android **tidak** dibuat lewat satu komponen + CSS breakpoint, melainkan dua set komponen terpisah (`apps/desktop/pages/*`, `apps/mobile/pages/*`) yang memanggil logika sama dari `shared/`. Design token di dokumen ini (warna, tipografi, radius, shadow) berlaku sama persis untuk kedua set komponen — yang beda hanya susunan & kepadatan elemen. Rinciannya per halaman:

- **Shell**: Mobile pakai bottom nav 5 item (§3.1). Desktop pakai sidebar kiri tetap (collapsible) + topbar (judul halaman, notifikasi, avatar/nama workspace) — komponen `Sidebar.tsx`/`TopBar.tsx` khusus desktop, tidak dipakai di mobile.
- **Dashboard**: Mobile menumpuk stat card 2 kolom lalu chart lalu aktivitas lalu aksi cepat secara vertikal (sesuai mockup asli). Desktop menyusun stat card 4 kolom sejajar, chart lebar penuh di bawahnya, lalu dua kolom sejajar: kiri "Aktivitas Terbaru" (list), kanan "Aksi Cepat" (grid tombol besar) — komponen `DashboardMobile.tsx` dan `DashboardDesktop.tsx` terpisah, sama-sama memanggil `useReceipts()` dari `shared/`.
- **Arsip**: Mobile pakai card list/grid dengan thumbnail besar (`ArsipList.tsx`). Desktop default tampil sebagai **tabel data** (kolom: thumbnail kecil, no. nota, tanggal, toko, kategori, nominal, status, aksi) dengan pagination (`ArsipTable.tsx`) — keduanya memanggil `receiptService.getFiltered()` yang sama.
- **Scan**: Mobile pakai viewfinder full-bleed dengan shutter besar (`ScanMobile.tsx`). Desktop pakai webcam feed di kiri dengan panel "Pengaturan Kamera" tetap terlihat di sisi kanan, tidak collapsible seperti versi mobile (`ScanDesktop.tsx`) — keduanya sama-sama memanggil `ocrService` yang identik.
- **Buat Nota**: Mockup asli sudah 2 panel (form kiri, preview kanan) — di desktop ini dipertahankan apa adanya (`BuatNotaDesktop.tsx`). Di mobile, karena lebar layar tidak cukup untuk 2 panel sejajar, dipecah jadi 2 tab/step: "Isi Data" dan "Preview" (`BuatNotaMobile.tsx`) — rumus perhitungan total tetap satu fungsi yang sama dari `shared/rules/`.
- **Export**: Mobile pakai filter dropdown bertumpuk + tombol full-width (`ExportMobile.tsx`). Desktop pakai filter periode sebagai tab horizontal di atas + tabel pratinjau full width dengan lebih banyak baris terlihat (`ExportDesktop.tsx`).

**Prinsip pengujian konsistensi**: setiap kali sebuah fitur diubah, cek dua tempat (komponen desktop & mobile) hanya untuk *tampilannya*; kalau ada perbedaan *hasil/angka* antara kedua platform, itu tandanya ada logika yang salah ditaruh di `apps/` alih-alih di `shared/` — harus dipindah balik ke `shared/`.

---

## 5. Dark Mode
Mockup Settings sudah punya toggle "Mode Gelap Otomatis" — siapkan token gelap paralel:
```css
[data-theme="dark"] {
  --color-bg-app: #0B1220;
  --color-bg-card: #131C2E;
  --color-text-primary: #F1F5F9;
  --color-text-secondary: #94A3B8;
  --color-border: #1E293B;
  /* brand & semantic tetap sama, cukup naikkan sedikit brightness untuk kontras */
}
```
