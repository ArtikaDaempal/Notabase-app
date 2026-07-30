## 1\. Ringkasan Produk

NOTABASE adalah aplikasi digitalisasi dan manajemen arsip nota yang berjalan di Windows dan Android. Aplikasi menangani pemindaian, penyimpanan, pencarian, pengelolaan, dan pelaporan nota dalam satu sistem terintegrasi.

Pengguna dapat memindai nota via kamera atau memilih gambar dari galeri. Gambar diproses dengan Optical Character Recognition (OCR) untuk mengenali data secara otomatis; jika hasil OCR kurang akurat, pengguna dapat mengoreksi secara manual sebelum data disimpan.

Seluruh data nota disimpan di database terpusat (Supabase PostgreSQL), sedangkan gambar disimpan di Supabase Storage. **\[REVISI]** Data dipisahkan per **workspace** (satu workspace = satu instansi/organisasi/UMKM) sehingga data antar organisasi tidak tercampur, meski aplikasi tetap tidak memakai login akun personal. Data yang sama dapat diakses dari Windows maupun Android dalam satu workspace yang sama, sehingga sinkronisasi antar perangkat berjalan otomatis. Laporan Excel yang diekspor dapat diunggah secara real-time ke penyimpanan cloud Microsoft OneDrive milik pengguna melalui integrasi OAuth 2.0 dan Microsoft Graph API.

*Alasan revisi: PRD asli menyatakan "tidak ada login/role" sekaligus "data terpusat di satu database" — tanpa pemisah, semua pengguna dari organisasi berbeda akan melihat data satu sama lain. Konsep workspace menjaga UX "tanpa login" tapi mencegah kebocoran data.*

\---

## 2\. Tujuan Produk

* Mengurangi penggunaan arsip fisik
* Mempermudah digitalisasi nota
* Mempercepat pencarian dokumen
* Mengurangi kesalahan pencatatan melalui OCR
* Menyediakan laporan Excel otomatis
* Menyimpan data secara terpusat **\[REVISI]** namun terisolasi per organisasi (workspace)
* Mendukung penggunaan lintas perangkat (laptop dan smartphone)
* Menyediakan sinkronisasi data antar perangkat
* **\[BARU]** Menjaga data tetap aman meski tanpa sistem login personal

\---

## 3\. Target Pengguna

* Pegawai administrasi
* Bagian keuangan / bendahara
* Pengelola arsip
* Instansi pemerintah, organisasi, UMKM, perusahaan

**\[REVISI]** Versi 1.0 tidak menggunakan sistem login maupun role personal. Setelah aplikasi dijalankan pertama kali, pengguna diminta membuat atau memasukkan **Kode Workspace** (mis. `BPSDMP-MANADO`) — proses ini satu kali saja, bukan login berulang, dan tidak memerlukan password/akun individu. Setelah itu seluruh fitur langsung dapat digunakan oleh siapa pun yang memakai perangkat tersebut.

*Alasan revisi: mempertahankan semangat "tanpa login yang merepotkan" dari PRD asli, sambil menutup celah keamanan data.*

\---

## 4\. Platform yang Didukung

|Platform|Minimum Versi|Output|
|-|-|-|
|Windows|Windows 10 / 11|NOTABASE.exe|
|Android|Android 9 (API 28)|NOTABASE.apk|

*(Tidak ada perubahan dari PRD asli.)*

\---

## 5\. Ruang Lingkup Produk

Setup workspace (satu kali) · scan nota via kamera · ambil gambar dari galeri · buat nota manual · OCR otomatis · koreksi hasil OCR · simpan data \& gambar · lihat arsip · edit/hapus data · pencarian \& filter · export Excel · upload Excel ke OneDrive · pengaturan aplikasi.

**\[BARU]** "Setup workspace (satu kali)" ditambahkan sebagai langkah pertama di ruang lingkup, sesuai revisi §3.

Semua fitur tersedia di Windows dan Android, dengan penyesuaian antarmuka sesuai ukuran layar **\[REVISI]**: di Windows, navigasi bawah (bottom tab) mobile digantikan sidebar, dan tampilan Arsip default berupa tabel data, bukan kartu — karena mockup rujukan hanya dirancang untuk layar HP dan perlu adaptasi eksplisit untuk laptop.

\---

## 6\. Teknologi

|Komponen|Teknologi|
|-|-|
|Cross Platform|Tauri 2|
|Frontend|React + TypeScript|
|UI|Tailwind CSS + shadcn/ui|
|Build Tool|Vite|
|OCR|Mesin OCR lokal lintas platform (model berbasis ONNX)|
|Image Processing|OpenCV|
|Backend|Supabase (PostgreSQL + Storage), dengan Row Level Security per workspace **\[REVISI]**|
|Penyimpanan lokal sementara|SQLite (Tauri plugin-sql) untuk antrian sinkronisasi **\[BARU]**|
|Penyimpanan token aman|OS Keychain (Tauri plugin-stronghold) untuk token OneDrive **\[BARU]**|
|Export Excel|ExcelJS|
|Upload OneDrive|Microsoft Graph API|

Catatan keputusan arsitektur OCR: PaddleOCR standar (Python) tidak dapat berjalan langsung di Android sebagaimana di Windows. Karena target produk adalah satu basis kode untuk EXE dan APK dengan pengalaman konsisten, OCR diselesaikan menggunakan model lokal lintas platform (ONNX) yang berjalan langsung di perangkat — bukan via layanan backend terpisah. Pendekatan ini menghindari ketergantungan koneksi internet saat proses OCR dan lebih mudah dipelihara jangka panjang dibanding menjalankan PaddleOCR lewat server.

**\[BARU]** Catatan keamanan: token OAuth OneDrive (access \& refresh token) **tidak** disimpan di database Supabase maupun local storage biasa, melainkan di OS Keychain terenkripsi milik masing-masing perangkat, untuk mencegah pencurian token jika database bocor.

\---

## 7\. Arsitektur Sistem

```
User
│
Windows / Android
│
NOTABASE (Tauri)
│
React + TypeScript
│
├── Kamera
├── Galeri
└── Dashboard
│
▼
OCR Engine Lokal (ONNX) + OpenCV
│
▼
OCR Result (JSON)
│
▼
React Frontend
│
├── Antrian Lokal (SQLite) — jika offline  \[BARU]
│
▼
Supabase (RLS per workspace\_id)  \[REVISI]
├── Database (PostgreSQL)
└── Image Storage (private, signed URL)  \[REVISI]
│
▼
Export Excel
│
▼
Microsoft OneDrive
```

*Detail lengkap arsitektur lapisan (presentation, application, native bridge, integrasi) ada di dokumen terpisah `01-architecture.md`.*

\---

## 8\. Alur Penggunaan

### 8.0 Setup Awal Workspace **\[BARU]**

1. Aplikasi dibuka pertama kali
2. Pengguna memilih "Buat Workspace Baru" atau "Gabung Workspace" (masukkan kode yang sudah ada)
3. Kode \& identitas workspace disimpan di perangkat
4. Aplikasi masuk ke Dashboard seperti biasa

### Scan Nota

1. Buka menu Scan Nota
2. Kamera perangkat terbuka
3. Ambil foto
4. Gambar diproses dengan OpenCV
5. OCR membaca isi nota
6. Data otomatis ditampilkan (dengan badge tingkat keyakinan) **\[REVISI: ditambahkan penjelasan tingkat keyakinan]**
7. Koreksi bila diperlukan — **wajib** jika tingkat keyakinan di bawah ambang tertentu **\[REVISI]**
8. Data disimpan (lokal dulu jika offline, lalu sinkron otomatis) **\[REVISI]**
9. Gambar disimpan ke Supabase Storage

### Ambil dari Galeri

1. Pilih gambar (JPG/JPEG/PNG)
2. OCR dijalankan
3. Data ditampilkan
4. Koreksi bila diperlukan
5. Data disimpan

### Buat Nota Manual

1. Buka menu Buat Nota
2. Isi form (info toko, nomor nota, tanggal, daftar barang, pajak, diskon, catatan)
3. Preview nota real-time (total dihitung otomatis dari barang − diskon + pajak) **\[REVISI: menegaskan rumus perhitungan]**
4. Generate gambar nota (JPG)
5. Gambar diunggah ke Supabase Storage
6. Data disimpan ke Supabase PostgreSQL
7. Nota muncul di menu Arsip (sejajar dengan hasil scan/galeri)

### Arsip Nota

Pengguna dapat melihat daftar \& detail, melihat/memperbesar/memutar gambar, mengedit, **menghapus (soft delete — data dipulihkan masih mungkin dalam 30 hari, baru dihapus permanen setelahnya)** **\[REVISI]**, dan mengunduh gambar.

### Export Excel

Filter berdasarkan Hari/Minggu/Bulan/Tahun/Rentang tanggal, lalu aplikasi membuat file Excel yang dapat langsung diunggah ke OneDrive.

\---

## 9\. Fitur Utama

### Dashboard

* Total nota: hari ini, minggu ini, bulan ini, tahun ini
* Total nominal
* Aktivitas terbaru
* Quick Action: Scan Nota · Import Galeri · Buat Nota · Export Excel

### Buat Nota

Layout dua panel:

* Panel kiri: informasi toko, nomor nota, tanggal, daftar barang, pajak, diskon, total, catatan
* Panel kanan: preview nota real-time
* Tombol: Simpan · Download JPG · Reset · Simpan Draft

Form lengkap: Nomor Nota, Nama Toko, Logo Toko (opsional), Tanggal, Daftar Barang, Jumlah, Harga Satuan, Subtotal, Diskon, Pajak (PPN), Total, Metode Pembayaran, Keterangan, Footer.

Fitur tambahan: tambah/hapus barang, hitung total otomatis, format Rupiah, pilihan template nota, edit kembali setelah disimpan.

### Scan Nota

Kamera perangkat, auto capture (opsional), crop otomatis, rotate otomatis, OCR otomatis, preview gambar.

### Ambil dari Galeri

Format: JPG, JPEG, PNG. **\[REVISI]** Ukuran maksimum 10MB per gambar.

### OCR

Menggunakan mesin OCR lokal (ONNX-based), diproses langsung di perangkat. **\[REVISI]** Tiga tingkat hasil:

* Keyakinan ≥ 80% → auto-terisi, siap simpan
* Keyakinan 50–79% → auto-terisi, wajib ditinjau pengguna sebelum simpan
* Keyakinan < 50% atau gagal → form manual penuh muncul, seluruh data dapat diedit oleh pengguna

*Alasan revisi: PRD asli hanya menyebut "jika OCR gagal, form manual muncul" tanpa aturan untuk hasil OCR yang "kurang yakin tapi tidak sepenuhnya gagal" — celah ini ditutup dengan 3 tingkatan di atas.*

### Arsip

Mode tampilan: List / Grid. Fitur:

* **Pratinjau Nota**: Lihat gambar struk, zoom (perbesar), dan download gambar asli.
* **Cetak Nota**: Fitur cetak khusus yang secara otomatis menyembunyikan elemen UI aplikasi dan mencetak gambar nota secara penuh (fit to page) dalam 1 lembar kertas.
* **Edit Nota Interaktif**: Mengedit Nama Toko, Tanggal, Nominal, Keterangan, Teks mentah OCR, serta menambah/menghapus/mengubah daftar barang belanjaan dengan perhitungan nominal total otomatis. Seluruh perubahan disinkronkan langsung ke database Supabase.
* **Hapus Nota** **\[REVISI]**: Menghapus nota dari tampilan arsip (soft delete). Data baru dihapus permanen dari database dan storage setelah 30 hari, sebagai jaring pengaman terhadap salah hapus.

Setiap nota diberi badge sumber: Scan / Galeri / Manual (badge ini permanen, tidak berubah walau data lain diedit) **\[REVISI: menegaskan sifat read-only]**.

### Pencarian

Berdasarkan nama toko, nominal, tanggal, kata kunci.

### Filter

* Hari / Minggu / Bulan / Tahun / Rentang tanggal
* Status OCR
* Sumber Nota: Semua / Scan Kamera / Galeri / Manual
* **\[BARU]** Kategori nota — daftar tetap: ATK \& Kantor, Operasional, Konsumsi, Transportasi, Utilitas, Referensi/Cetak, Lain-lain (dapat ditambah pengguna)

*Alasan revisi: mockup UI menampilkan tag kategori (ATK, Operasional, Konsumsi) dan filter "Semua Kategori", tapi PRD asli tidak mendefinisikan kategori sebagai fitur/kolom data — ditambahkan agar konsisten dengan desain.*

### Export Excel

Kolom: Nomor, Tanggal, Nama Toko, Kategori **\[BARU]**, Nominal, Keterangan, Status OCR, Jenis Nota.

Contoh:

|Nomor|Jenis|Nama Toko|Total|
|-|-|-|-|
|INV001|Scan|Indomaret|25000|
|INV002|Manual|Toko ATK|120000|

### Sinkronisasi OneDrive

Integrasi Microsoft Graph API yang terhubung secara otomatis dengan akun `ifkadaempal5@gmail.com` tanpa memerlukan login berulang. Pengguna dapat langsung melakukan pengunggahan laporan Excel biner dengan perutean folder terstruktur: `Notabase/Ekspor Bulanan/` untuk ekspor bulanan/harian/mingguan dan `Notabase/Ekspor Tahunan/` untuk ekspor tahunan. **\[REVISI]**

**\[BARU — klarifikasi]** Pengunggahan OneDrive dilakukan secara langsung dan terkelola secara otomatis ke direktori `ifkadaempal5@gmail.com` tanpa memerlukan alur otorisasi berulang bagi pengguna aplikasi.

### Generate Nota JPG (bagian dari fitur Buat Nota)

* Preview real-time, pilihan template nota
* Ukuran menyerupai nota thermal (58 mm dan 80 mm) serta ukuran A4
* Penyesuaian font dan tata letak menyerupai nota kasir
* Logo toko (opsional), QR Code/Barcode (opsional)
* Output JPG resolusi tinggi, dapat diunduh **\[REVISI]**: minimum 1080px lebar untuk thermal, \~2480px (setara 300dpi) untuk A4
* Upload otomatis ke Supabase Storage, tersimpan di arsip yang sama dengan hasil scan OCR

\---

## 10\. Struktur Data

### Receipts

|Kolom|Tipe|
|-|-|
|id|UUID|
|**workspace\_id** \[BARU]|UUID|
|receipt\_number|String|
|image\_url|Text|
|receipt\_type|Enum(scan, gallery, manual)|
|receipt\_template|Text|
|tanggal|Date|
|nama\_toko|Text|
|**kategori** \[BARU]|Text|
|nominal|Decimal|
|**diskon** \[BARU]|Decimal|
|**pajak** \[BARU]|Decimal|
|**metode\_pembayaran** \[BARU]|Text|
|keterangan|Text|
|status\_ocr|Text|
|**ocr\_confidence** \[BARU]|Decimal|
|**ocr\_raw\_text** \[BARU]|Text|
|**is\_deleted, deleted\_at** \[BARU]|Boolean, Timestamp|
|created\_at|Timestamp|
|updated\_at|Timestamp|

### Receipt Items

|Kolom|Tipe|
|-|-|
|id|UUID|
|receipt\_id|UUID|
|nama\_barang|Text|
|qty|Integer|
|harga|Decimal|
|subtotal|Decimal|

Relasi: satu Receipts memiliki banyak Receipt Items (One-to-Many).

**\[BARU]** Tabel tambahan: `workspaces`, `devices`, `export\_history`, `onedrive\_connections`, `app\_settings` — lihat rincian penuh di `04-database-schema.md`. Ditambahkan karena mockup UI menampilkan data (riwayat upload, info akun OneDrive, pengaturan tersinkron) yang tidak punya tabel sumber di PRD asli.

\---

## 11\. Sinkronisasi Data

Semua data (hasil scan OCR, hasil impor galeri, hasil pembuatan nota manual) tersimpan di Supabase dan tersinkronisasi otomatis secara real-time **dalam satu workspace yang sama** **\[REVISI]**:

* Data dari Android langsung muncul di Windows, dan sebaliknya
* Tidak diperlukan proses impor/ekspor manual antar perangkat
* **\[BARU]** Jika perangkat offline saat menyimpan, data ditahan di antrian lokal dan otomatis dikirim begitu koneksi tersedia kembali (lihat §13 batasan produk yang direvisi)

\---

## 12\. Kebutuhan Nonfungsional

* Berjalan pada Windows 10/11 dan Android 9 ke atas
* Startup aplikasi < 5 detik pada perangkat yang memenuhi syarat
* Mendukung kamera internal, webcam USB, dan kamera smartphone
* OCR diproses secara lokal sesuai kemampuan perangkat
* Komunikasi ke Supabase menggunakan HTTPS
* Antarmuka sederhana dan responsif untuk desktop maupun perangkat seluler
* **\[BARU]** Data antar workspace terisolasi penuh melalui Row Level Security, tidak hanya filter di sisi aplikasi
* **\[BARU]** Token OneDrive disimpan terenkripsi di penyimpanan aman OS, tidak pernah dalam bentuk plain text di database atau local storage biasa
* **\[BARU]** Ukuran model OCR ONNX dijaga di bawah \~50MB agar target startup <5 detik tetap tercapai di perangkat Android 9 kelas bawah

\---

## 13\. Batasan Produk (Versi 1.0)

* Tidak mendukung iOS
* Tidak mendukung batch scan
* Tidak menggunakan login atau manajemen pengguna **individual** — tetap memakai kode workspace untuk pemisahan data organisasi **\[REVISI]**
* **\[REVISI]** Membutuhkan koneksi internet untuk sinkronisasi final ke Supabase dan upload ke OneDrive, namun hasil scan/nota dapat dibuat dan disimpan sementara secara lokal saat offline, lalu otomatis tersinkron ketika online kembali (buffer, bukan mode offline penuh — mode offline penuh tetap di roadmap v1.2)
* Laporan hanya tersedia dalam format Excel
* **\[BARU]** Nota yang dihapus tersimpan sebagai "terhapus" selama 30 hari sebelum benar-benar hilang permanen

*Alasan revisi poin koneksi internet: PRD asli mensyaratkan internet untuk menyimpan data, padahal use case utama (scan nota di lapangan) sering terjadi di lokasi dengan sinyal lemah. Buffer lokal ringan menutup risiko kehilangan data tanpa perlu membangun mode offline penuh di v1.0.*

\---

## 14\. Indikator Keberhasilan

* Nota dapat disimpan dalam waktu < 30 detik
* Arsip dapat ditemukan via pencarian/filter dalam hitungan detik
* Data dari Android tersedia langsung di Windows, dan sebaliknya, **dalam workspace yang sama** **\[REVISI]**
* Laporan Excel dibuat otomatis sesuai filter
* Gambar nota tersimpan dengan baik di Supabase Storage
* Laporan dapat diunggah ke OneDrive dengan mudah
* **\[BARU]** Tidak ada data yang terlihat lintas workspace/organisasi dalam kondisi apa pun (diverifikasi lewat pengujian RLS)
* **\[BARU]** Nota yang tidak sengaja terhapus dapat dipulihkan dalam masa retensi 30 hari

\---

## 15\. Roadmap Pengembangan

### Versi 1.0

* ✔ Setup Workspace (satu kali, tanpa login personal) **\[BARU]**
* ✔ Scan Nota (kamera)
* ✔ Import Galeri
* ✔ OCR otomatis + koreksi manual (3 tingkat keyakinan) **\[REVISI]**
* ✔ Buat Nota Manual + Generate JPG
* ✔ Arsip (dengan badge sumber, soft delete) **\[REVISI]**
* ✔ Pencarian \& Filter (termasuk kategori) **\[REVISI]**
* ✔ Export Excel
* ✔ Upload OneDrive
* ✔ Buffer offline ringan untuk hasil scan **\[BARU]**
* ✔ Dukungan Windows dan Android

### Versi 1.1

* Impor PDF
* Batch scan
* Dashboard statistik lebih lengkap
* Kompresi gambar otomatis
* Riwayat ekspor \& riwayat unggahan
* **\[BARU]** Manajemen multi-workspace dalam satu perangkat (mis. konsultan yang menangani beberapa instansi)

### Versi 1.2

* Mode offline penuh dengan sinkronisasi saat koneksi tersedia
* Dukungan scanner dokumen USB
* Notifikasi kegagalan OCR
* Analisis pengeluaran berdasarkan periode dan merchant teratas
* Dukungan iOS (opsional)
* **\[BARU]** Role/hak akses opsional di dalam workspace (mis. admin vs staf), jika kebutuhan organisasi berkembang melebihi kode workspace tunggal

\---

## Lampiran: Ringkasan Semua Perubahan

|Bab|Perubahan|Alasan|
|-|-|-|
|§1, §3|Tambah konsep Workspace|Cegah kebocoran data lintas organisasi tanpa mengorbankan UX "tanpa login"|
|§6|Tambah SQLite lokal \& OS Keychain|Buffer offline + keamanan token OneDrive|
|§8, §13|Buffer offline ringan untuk penyimpanan|Use case lapangan sering minim sinyal|
|§9 (OCR)|3 tingkat keyakinan, bukan 2 (sukses/gagal)|Menutup celah kasus "kurang yakin tapi tidak gagal total"|
|§9 (Arsip)|Hapus jadi soft delete + retensi 30 hari|Mitigasi human error pada data keuangan|
|§9 (Filter/Export)|Tambah kategori nota|Konsisten dengan mockup UI yang sudah menampilkan tag kategori|
|§10|Tambah kolom kategori/diskon/pajak/metode bayar/confidence/raw text/soft-delete, tambah tabel workspace/export\_history/onedrive\_connections|Kolom \& tabel ini dibutuhkan mockup UI tapi tidak ada di struktur data PRD asli|
|§12, §14|Tambah indikator keamanan \& isolasi data|Konsekuensi dari perubahan workspace|

*Rincian teknis implementasi setiap poin di atas ada di tiga dokumen pendamping: `01-architecture.md`, `02-design-system.md`, `03-business-rules.md`, `04-database-schema.md`.*

