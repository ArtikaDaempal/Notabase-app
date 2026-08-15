# NOTABASE — Business Rules & Validation

---

## 1. Workspace (Perbaikan atas "tanpa login")

| Aturan | Detail |
|---|---|
| BR-WS-01 | Saat pertama kali aplikasi dijalankan, pengguna **wajib** membuat atau memasukkan **Kode Workspace** (mis. `BPSDMP-MANADO`). Ini bukan akun personal — tidak ada password per-user. |
| BR-WS-02 | Kode workspace dan `workspace_id` (UUID) disimpan di local storage/SQLite perangkat, dikirim sebagai identitas di setiap request Supabase. |
| BR-WS-03 | Semua data (`receipts`, `receipt_items`, `export_history`, `onedrive_connections`) **wajib** memiliki `workspace_id` dan hanya bisa diakses oleh perangkat dengan kode workspace yang sama (ditegakkan via Supabase RLS, bukan hanya filter di client). |
| BR-WS-04 | Ganti workspace di satu perangkat = logout implisit dari data lama (data lama tidak terhapus, hanya tidak lagi terlihat). |

---

## 2. Aturan Scan & OCR

| Aturan | Detail |
|---|---|
| BR-OCR-01 | Format gambar diterima: JPG, JPEG, PNG. Ukuran maksimum 10MB per gambar. |
| BR-OCR-02 | Setelah capture/import, gambar **wajib** melewati OpenCV preprocessing (crop, deskew, enhance kontras) sebelum masuk ke OCR — hasil OCR mentah tanpa preprocessing tidak boleh langsung dipakai. |
| BR-OCR-03 | Seluruh hasil OCR **wajib** melewati alur Pratinjau & Edit (OCR Preview) sebelum disimpan ke database. Auto-save tanpa review telah dihapus demi menjamin akurasi data. |
| BR-OCR-04 | `50% ≤ confidence < 80%` → field auto-terisi tapi badge kuning "Perlu Review", pengguna dianjurkan mengecek field bertanda kuning/merah sebelum menyimpan. |
| BR-OCR-05 | `confidence < 50%` atau OCR gagal total → form dikosongkan/diisi parsial, badge merah "Gagal", seluruh field wajib diisi manual. |
| BR-OCR-06 | Teks mentah hasil OCR (raw text) selalu disimpan (`ocr_raw_text`) untuk keperluan audit/"Lihat Log", meskipun user sudah mengoreksi field terstruktur. |
| BR-OCR-07 | Field wajib minimum untuk simpan: `nama_toko` dan `nominal` (>0). Jika tanggal tidak terdeteksi oleh OCR, field tanggal dikosongkan (null) agar diisi manual oleh pengguna. |

---

## 3. Aturan Nota Manual & Kalkulasi Dinamis

| Aturan | Detail |
|---|---|
| BR-MAN-01 | `receipt_number` otomatis generate jika kosong, format `INV-{YYYY}-{sequence_3digit}` per workspace per tahun, tapi tetap bisa diedit manual oleh user. |
| BR-MAN-02 | Minimal 1 baris barang wajib ada sebelum nota bisa disimpan. |
| BR-MAN-03 | `subtotal_barang = Σ(qty × harga)` per item. Mengubah Qty atau Harga Satuan item secara otomatis menghitung ulang nominal baris item dan subtotal nota secara real-time. |
| BR-MAN-04 | `total = subtotal − diskon + pajak + biaya_tambahan`, dihitung otomatis secara real-time di UI setiap kali Qty, Harga Satuan, Diskon, Pajak, atau Biaya Tambahan diubah. Pengguna tetap memiliki kontrol manual jika ingin meng-override total. |
| BR-MAN-05 | Generate JPG mengikuti template & ukuran yang dipilih user (58mm/80mm thermal atau A4) — resolusi minimum 1080px lebar untuk thermal, 2480px untuk A4 (setara 300dpi). |
| BR-MAN-06 | Nota manual yang sudah disimpan tetap bisa diedit kembali, setiap edit memperbarui `updated_at`. |

---

## 4. Aturan Arsip (Edit/Hapus)

| Aturan | Detail |
|---|---|
| BR-ARC-01 | **Hapus = soft delete.** Set `is_deleted = true`, `deleted_at = now()`. Data hilang dari tampilan Arsip & pencarian, tapi baru dihapus permanen (row + file di Storage) oleh scheduled job setelah 30 hari. |
| BR-ARC-02 | Edit field apapun di Detail Nota langsung sinkron ke Supabase, dengan optimistic UI update + rollback jika gagal. |
| BR-ARC-03 | Mengubah daftar barang di halaman edit akan **selalu** memicu recalculate `subtotal` dan `nominal` (BR-MAN-03/04) agar total selalu sinkron dengan isi barang. |
| BR-ARC-04 | Badge sumber (`Scan` / `Galeri` / `Manual`) bersifat **read-only permanen**, tidak berubah walau data lain diedit — untuk keperluan audit asal-usul nota. |
| BR-ARC-05 | Download gambar mengunduh file resolusi asli dari Storage, bukan thumbnail. |
| BR-ARC-06 | Cetak Nota: sembunyikan seluruh chrome UI (nav, header, tombol), render gambar nota fit-to-page pada 1 lembar, orientasi otomatis menyesuaikan rasio gambar. |

---

## 5. Pencarian & Filter

| Aturan | Detail |
|---|---|
| BR-SRCH-01 | Pencarian teks bebas mencocokkan `nama_toko`, `nominal` (string match), `keterangan`, dan `receipt_number`. |
| BR-SRCH-02 | Filter periode (Hari/Minggu/Bulan/Tahun/Rentang) bersifat **AND** dengan filter kategori dan status OCR — semua filter aktif dikombinasikan, bukan OR. |
| BR-SRCH-03 | Hasil filter/pencarian menampilkan **Total Hasil Pencarian** (Σ nominal dari baris yang cocok) di footer hasil — sesuai mockup. |
| BR-SRCH-04 | Hasil filter bisa langsung diekspor (Excel/PDF) mengikuti filter aktif saat itu, tanpa perlu ulang set filter di layar Export. |

---

## 6. Export & OneDrive

| Aturan | Detail |
|---|---|
| BR-EXP-01 | Nama file otomatis: `Laporan_{NamaPeriode}_{Tahun}.xlsx`, contoh `Laporan_Mei_2025.xlsx`. |
| BR-EXP-02 | Susunan kolom Excel wajib mengikuti urutan: 1. No, 2. No Nota, 3. Nama Toko, 4. Alamat Toko, 5. No Telepon, 6. Tanggal, 7. Waktu, 8. Nama Barang, 9. Jumlah, 10. Harga Satuan, 11. Nominal, 12. Diskon, 13. Pajak, 14. Biaya Tambahan, 15. Subtotal, 16. Total, 17. Keterangan. Seluruh nilai uang diekspor sebagai numerik murni tanpa string "Rp". |
| BR-EXP-03 | File disimpan lokal (folder default dari Settings) **setiap kali** export dijalankan, apapun status upload OneDrive-nya — upload OneDrive adalah aksi tambahan, bukan pengganti simpan lokal. |
| BR-EXP-04 | Upload OneDrive secara otomatis terhubung ke akun `ifkadaempal5@gmail.com` tanpa memerlukan login ulang. Perutean folder disesuaikan berdasarkan periode ekspor: `Notabase/Ekspor Bulanan/` untuk ekspor bulanan/harian/mingguan dan `Notabase/Ekspor Tahunan/` untuk ekspor tahunan. |
| BR-EXP-05 | Retry otomatis 3x dengan backoff untuk upload OneDrive yang gagal karena jaringan, sebelum menampilkan status "Gagal" ke user dengan tombol "Coba Lagi" manual. |
| BR-EXP-06 | Setiap export (berhasil/gagal) dicatat di `export_history` untuk ditampilkan di "Riwayat Upload" (mockup OneDrive Sync). |

---

## 7. Sinkronisasi Lintas Perangkat

| Aturan | Detail |
|---|---|
| BR-SYNC-01 | Setiap create/update/delete pada `receipts`/`receipt_items` di-broadcast via Supabase Realtime ke semua perangkat dalam `workspace_id` yang sama. |
| BR-SYNC-02 | Saat offline, aksi disimpan di antrian lokal dengan status `pending_sync`; UI menandai baris tersebut dengan indikator kecil "Menunggu Sinkron". **Impl. v1.0**: antrian disimpan di `syncQueue` IndexedDB (Dexie.js, `src/lib/local-db.ts`). Indikator sync tampil permanen di header + bottom-nav (`src/components/ui/sync-indicator.tsx`): dot hijau=synced, kuning=pending, merah=offline. Auto-sync dipicu event `window.online` via `initOnlineWatcher()` di `src/lib/sync-service.ts`. |
| BR-SYNC-03 | Konflik (dua perangkat edit nota sama saat offline) diselesaikan **last-write-wins** berdasarkan `updated_at` server, bukan client — mencegah jam perangkat yang salah setting merusak urutan. **Impl. v1.0**: diimplementasikan via `processSync Queue()` yang mereplay syncQueue saat kembali online, dengan retry 3x + backoff (1.5s, 3s, 4.5s). |
| BR-SYNC-04 | Gambar nota yang masih di antrian lokal (belum ter-upload) ditampilkan dari cache lokal, digantikan URL Supabase begitu upload sukses. |

---

## 8. Kategori Nota (baru — PRD sebelumnya hanya sebut "Kategori" tanpa daftar tetap)

Untuk konsistensi filter, export, dan dashboard, tetapkan daftar kategori tetap (bisa ditambah admin di masa depan):

```
ATK & Kantor · Operasional · Konsumsi · Transportasi ·
Utilitas (listrik/air/internet) · Referensi/Cetak · Lain-lain
```
Field `kategori` di tabel `receipts` bertipe teks (bukan enum kaku) agar mudah ditambah tanpa migrasi database, tapi UI menyediakan dropdown dari daftar di atas + opsi "Tambah kategori baru".
