# NOTABASE — Risk & Testing Checklist
Daftar titik risiko teknis yang harus diverifikasi tim dev **sebelum rilis**, supaya aplikasi benar-benar bisa di-install & dipakai tanpa kendala di HP dan laptop. Diurutkan dari yang paling menentukan kelayakan arsitektur (wajib dicek paling awal, idealnya sebagai proof-of-concept) sampai yang sifatnya polish sebelum rilis.

Status: `[ ]` belum dicek · `[x]` sudah lolos · `[!]` gagal/butuh mitigasi

---

## PRIORITAS 0 — Wajib dibuktikan lewat Proof of Concept sebelum lanjut full development

Kalau salah satu ini gagal, arsitektur di dokumen 01 perlu direvisi ulang. Jangan mulai development fitur lengkap sebelum dua hal ini lolos.

- [ ] **OCR + OpenCV berjalan di Android nyata (bukan cuma Windows/emulator)**
  - Test di minimal 2 device Android kelas bawah (RAM 3-4GB, setara target minimum Android 9) dan 1 device kelas menengah.
  - Ukuran model ONNX final < 50MB (target startup <5 detik, PRD §12).
  - Waktu proses OCR 1 nota < 5 detik di device kelas bawah — kalau lebih lama, UX scan terasa lambat dan perlu dicatat sebagai batasan atau dioptimasi model.
  - Akurasi OCR nota nyata (bukan gambar contoh yang mulus) diuji dengan minimal 20 sampel struk asli beragam kondisi (kusut, pudar, miring, thermal usang).
  - Cross-compile OpenCV + ONNX Runtime untuk arsitektur ARM (Android NDK) berhasil tanpa error linking, dan ukuran APK final masih wajar (idealnya < 100MB).

- [x] **Row Level Security (RLS) berbasis workspace_id benar-benar mengisolasi data**
  - Buat 2 workspace test, isi data di masing-masing, lalu coba akses data workspace A dari sesi/klaim workspace B — harus gagal (bukan cuma disembunyikan di UI, tapi ditolak di level query).
  - Test khusus: request langsung ke Supabase REST/Realtime API (bukan lewat UI aplikasi) dengan JWT/claim workspace yang salah — pastikan tetap ditolak.
  - Mekanisme pengiriman `workspace_id` (`x-workspace-id` header & anon fallback) telah didokumentasikan dan berjalan konsisten di semua API endpoint (`/api/receipts`, `/api/stats`, `/api/settings`). |

---

## PRIORITAS 1 — Instalasi & Distribusi

- [ ] **Windows: SmartScreen warning**
  - Build `.exe` tanpa code signing certificate akan memicu peringatan "Unrecognized publisher". Putuskan: beli sertifikat code signing, atau terima risiko user harus klik "Run anyway" (sertakan panduan visual di halaman download).
- [ ] **Windows: instalasi bersih di mesin tanpa dependency dev**
  - Test install di Windows 10 & 11 fresh (VM tanpa Visual C++ Redistributable / WebView2 terpasang) — Tauri butuh WebView2, pastikan installer men-download/bundle otomatis kalau belum ada.
- [ ] **Android: sideload APK**
  - Siapkan instruksi jelas untuk user mengaktifkan "Install dari sumber tidak dikenal", idealnya dengan screenshot per merk HP populer (Samsung/Xiaomi punya langkah sedikit beda).
  - Test APK signed release (bukan debug build) — debug build sering gagal jalan optimal atau memicu warning tambahan.
- [ ] **Ukuran file distribusi wajar**
  - `.exe` dan `.apk` final dicek ukurannya — kalau ONNX model + OpenCV bikin APK > 150MB, evaluasi model yang lebih ringan atau on-demand download model saat setup pertama.

---

## PRIORITAS 2 — Fitur yang Berperilaku Beda di Windows vs Android

- [ ] **Cetak Nota (fit-to-page)**
  - Windows: pakai print dialog OS biasa.
  - Android: perlu jalur Android Print Framework — beda implementasi, test terpisah di kedua platform, bukan asumsi "satu kode jalan semua".
- [ ] **Kamera**
  - Windows: webcam USB — test minimal 2 merk webcam berbeda (driver bisa beda perilaku, resolusi, orientasi).
  - Android: kamera internal — test di device dengan rasio kamera berbeda (16:9 vs lainnya), pastikan auto-crop/rotate OpenCV menyesuaikan, bukan hardcode asumsi orientasi.
- [x] **Integrasi Microsoft Graph (OneDrive)**
  - Pengunggahan terhubung secara otomatis ke akun `ifkadaempal5@gmail.com` tanpa pengalihan/login ulang.
  - Perutean otomatis: file ekspor bulanan/harian/mingguan ke `Notabase/Ekspor Bulanan/` dan ekspor tahunan ke `Notabase/Ekspor Tahunan/`.
  - Verifikasi pencatatan riwayat unggah di tabel `export_history` dan halaman OneDrive Sync.
- [ ] **OS Keychain untuk simpan token (plugin-stronghold atau setara)**
  - Verifikasi plugin yang dipakai benar-benar didukung penuh di Android (beberapa plugin Tauri masih desktop-first) — kalau tidak, siapkan fallback penyimpanan aman khusus Android (mis. Android Keystore langsung).
- [x] **IndexedDB & syncQueue lokal untuk antrian offline**
  - Test skenario: scan/simpan nota saat offline → data tersimpan di IndexedDB (`src/lib/local-db.ts`), ditandai `pendingSync: true` dengan badge "Menunggu Sync" & SyncIndicator di header/nav. begitu online kembali, `syncService.processSyncQueue()` mereplay antrian ke Supabase otomatis. |

---

## PRIORITAS 3 — Performa & Startup

- [ ] Startup aplikasi < 5 detik (PRD §12) diukur di:
  - Laptop spesifikasi menengah (bukan dev machine kencang)
  - Android kelas bawah (RAM 3GB, setara minimum API 28)
- [ ] Memory footprint saat OCR berjalan tidak menyebabkan app crash di Android RAM rendah (test dengan multitasking app lain terbuka, kondisi realistis pengguna).
- [ ] Sinkronisasi Realtime tidak menyebabkan battery drain berlebih di Android saat app di-background lama.

---

## PRIORITAS 4 — Konsistensi Antar `apps/desktop` dan `apps/mobile` **[REVISI]**

Karena UI Windows dan Android sekarang dua set komponen terpisah (`apps/desktop/`, `apps/mobile/`) yang sama-sama memanggil `shared/` — lihat `01-architecture.md` §4 — pengujian di sini bukan lagi soal breakpoint, tapi soal memastikan **hasil/angka identik** meski tampilannya beda, dan tidak ada logika bisnis yang "menyelinap" ditulis langsung di salah satu `apps/`.

- [ ] **Uji paritas hasil**: untuk skenario yang sama (mis. nota dengan diskon+pajak tertentu), bandingkan total yang tampil di `apps/desktop` vs `apps/mobile` — harus identik. Kalau beda, berarti ada logika hitung yang tidak sengaja ditaruh di `apps/` alih-alih `shared/rules/` (lihat prinsip pengujian di `02-design-system.md` §4).
- [ ] **Uji paritas aturan OCR**: threshold confidence (80%/50%) menghasilkan perilaku form yang sama persis di kedua platform.
- [ ] Layout `apps/desktop` (sidebar, tabel arsip) ditest di ukuran layar laptop nyata (bukan cuma window resize di browser dev), termasuk resolusi umum 1366×768 dan layar lebar.
- [ ] Layout `apps/mobile` ditest di HP layar kecil (< 5.5") memastikan bottom nav 5 item tidak terlalu sempit/terpotong.
- [ ] Test orientasi landscape di Android (khususnya layar Scan & Buat Nota, yang di mobile dipecah jadi tab/step — pastikan tetap wajar saat landscape).
- [ ] Dark mode (token di `02-design-system.md` §5) dicek kontrasnya di kedua `apps/`, khususnya elemen chart & badge warna — token sama, tapi harus divalidasi di komponen desktop *dan* mobile secara terpisah karena keduanya file berbeda.
- [ ] **Review kode berkala**: pastikan tidak ada duplikasi logika (mis. rumus hitung total ditulis ulang di `apps/desktop/pages/BuatNotaDesktop.tsx` padahal seharusnya impor dari `shared/rules/`) — ini risiko utama dari pola dua-`apps`, karena developer bisa tergoda menulis cepat langsung di halaman.

---

## PRIORITAS 5 — Keamanan & Data Integrity (sebelum rilis produksi)

- [ ] Storage bucket Supabase dipastikan **private**, bukan public — coba akses `image_url` langsung tanpa signed URL, harus gagal.
- [ ] Soft-delete + scheduled purge job (30 hari) diuji berjalan sesuai jadwal, dan file di Storage ikut terhapus saat purge (bukan cuma row database — ini butuh Edge Function terpisah, dicatat di `04-database-schema.md`).
- [ ] Validasi ukuran/tipe file upload (JPG/PNG, max 10MB) ditegakkan di sisi client **dan** di sisi Storage policy (jangan andalkan client saja).
- [ ] Test rekonsiliasi konflik sync (dua perangkat edit nota sama saat offline) — pastikan hasil akhirnya sesuai aturan last-write-wins (`03-business-rules.md` BR-SYNC-03), tidak ada data yang tiba-tiba hilang.

---

## Rekomendasi Urutan Kerja

1. Selesaikan **Prioritas 0** dulu sebagai proof-of-concept terisolasi (2 modul kecil: OCR-Android, RLS-workspace) sebelum membangun fitur lengkap.
2. Paralel dengan itu, siapkan **Prioritas 1** (sertifikat code signing, keystore Android) karena prosesnya butuh waktu administratif (bisa 1-2 minggu), jangan ditunda sampai akhir.
3. **Prioritas 2–3** dites bertahap tiap fitur selesai dibangun, bukan ditumpuk di akhir.
4. **Prioritas 4–5** jadi bagian dari QA checklist sebelum setiap rilis (termasuk update versi setelah 1.0).
