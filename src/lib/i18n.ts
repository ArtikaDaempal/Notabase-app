// i18n Translation Dictionary for Notabase

export type Language = 'id' | 'en'

export const translations: Record<string, Record<Language, string>> = {
  // Common Navigation / Tabs
  dashboard: { id: 'Dashboard', en: 'Dashboard' },
  scan: { id: 'Scan', en: 'Scan' },
  history: { id: 'History', en: 'History' },
  settings: { id: 'Pengaturan', en: 'Settings' },

  // General Settings
  general_settings: { id: 'Pengaturan Umum', en: 'General Settings' },
  app_lang: { id: 'Bahasa Aplikasi', en: 'Application Language' },
  app_lang_desc: { id: 'Pilih bahasa yang digunakan di seluruh aplikasi.', en: 'Select the language used across the entire application.' },
  save_path: { id: 'Lokasi Simpan Default', en: 'Default Save Location' },
  save_path_desc: { id: 'Tentukan folder untuk menyimpan arsip nota digital.', en: 'Specify the folder to store digital receipt archives.' },
  image_format: { id: 'Format Simpan Gambar', en: 'Image Save Format' },
  image_format_desc: { id: 'Format file standar untuk hasil pemindaian kamera.', en: 'Standard file format for camera scan results.' },
  delete_after_upload: { id: 'Hapus Gambar Setelah Upload', en: 'Delete Image After Upload' },
  delete_after_upload_desc: { id: 'Secara otomatis menghapus file lokal setelah berhasil disinkronkan ke OneDrive.', en: 'Automatically delete local files after successful OneDrive synchronization.' },
  show_notif: { id: 'Tampilkan Notifikasi', en: 'Show Notifications' },
  show_notif_desc: { id: 'Dapatkan pemberitahuan saat proses sinkronisasi selesai.', en: 'Get notified when the synchronization process is complete.' },
  auto_dark: { id: 'Mode Gelap Otomatis', en: 'Automatic Dark Mode' },
  auto_dark_desc: { id: 'Sesuaikan tema aplikasi dengan pengaturan sistem operasi Anda.', en: 'Adapt application theme to your operating system settings.' },

  // Camera Settings
  camera_settings: { id: 'Pengaturan Kamera', en: 'Camera Settings' },
  resolution: { id: 'Resolusi Default', en: 'Default Resolution' },
  resolution_desc: { id: 'Resolusi pemindaian kamera', en: 'Camera scan resolution' },
  autofocus: { id: 'Auto Focus', en: 'Auto Focus' },
  autofocus_desc: { id: 'Fokus otomatis saat memindai', en: 'Automatic focus when scanning' },
  autoflash: { id: 'Flash Otomatis', en: 'Auto Flash' },
  autoflash_desc: { id: 'Aktifkan flash di kondisi gelap', en: 'Enable flash in dark conditions' },
  grid: { id: 'Grid Pembantu', en: 'Helper Grid' },
  grid_desc: { id: 'Tampilkan grid untuk align nota', en: 'Display grid to align receipts' },
  camera_info: { id: 'Pengaturan kamera diterapkan saat sesi scan berikutnya.', en: 'Camera settings are applied in the next scan session.' },

  // OCR Settings
  ocr_language: { id: 'Bahasa OCR', en: 'OCR Language' },
  ocr_language_desc: { id: 'Bahasa utama untuk pengenalan teks', en: 'Primary language for text recognition' },
  min_confidence: { id: 'Minimum Confidence', en: 'Minimum Confidence' },
  min_confidence_desc: { id: 'Ambang batas akurasi OCR', en: 'OCR accuracy threshold' },
  auto_ocr: { id: 'Auto OCR Setelah Capture', en: 'Auto OCR After Capture' },
  auto_ocr_desc: { id: 'Jalankan OCR otomatis setelah foto diambil', en: 'Run OCR automatically after capturing photo' },
  extract_items: { id: 'Ekstrak Item Otomatis', en: 'Auto Extract Items' },
  extract_items_desc: { id: 'Parse daftar item dari teks nota', en: 'Parse items list from receipt text' },

  // Export Settings
  excel_template: { id: 'Template Excel', en: 'Excel Template' },
  excel_template_desc: { id: 'Format laporan Excel', en: 'Excel report format' },
  currency: { id: 'Mata Uang', en: 'Currency' },
  currency_desc: { id: 'Simbol mata uang pada laporan', en: 'Currency symbol on reports' },
  include_logo: { id: 'Sertakan Logo', en: 'Include Logo' },
  include_logo_desc: { id: 'Tambahkan logo Notabase di header laporan', en: 'Add Notabase logo in report header' },
  auto_upload: { id: 'Auto Upload ke OneDrive', en: 'Auto Upload to OneDrive' },
  auto_upload_desc: { id: 'Unggah laporan ke OneDrive setelah diekspor', en: 'Upload reports to OneDrive after export' },

  // OneDrive Settings
  connected: { id: 'Terhubung', en: 'Connected' },
  disconnected: { id: 'Terputus', en: 'Disconnected' },
  account: { id: 'Akun', en: 'Account' },
  folder: { id: 'Folder', en: 'Folder' },
  auto_sync: { id: 'Auto Sync', en: 'Auto Sync' },
  sync_schedule: { id: 'Setiap hari 23:00', en: 'Daily 23:00' },
  manage_sync: { id: 'Kelola Sinkronisasi', en: 'Manage Sync' },
  connect_onedrive: { id: 'Hubungkan OneDrive', en: 'Connect OneDrive' },
  disconnect_onedrive: { id: 'Putuskan Koneksi', en: 'Disconnect' },

  // Display Settings
  display_settings: { id: 'Tampilan', en: 'Display' },
  dark_mode: { id: 'Mode Gelap', en: 'Dark Mode' },
  dark_mode_desc: { id: 'Aktifkan tema gelap', en: 'Enable dark theme' },
  compact_display: { id: 'Tampilan Kompak', en: 'Compact Display' },
  compact_display_desc: { id: 'Kurangi spacing untuk lebih banyak konten', en: 'Reduce spacing for more content' },
  font_size: { id: 'Ukuran Font', en: 'Font Size' },
  font_size_desc: { id: 'Ukuran teks aplikasi', en: 'Application text size' },
  small: { id: 'Kecil', en: 'Small' },
  medium: { id: 'Sedang', en: 'Medium' },
  large: { id: 'Besar', en: 'Large' },

  // Danger Zone
  danger_zone: { id: 'Zona Berbahaya', en: 'Danger Zone' },
  reset_settings: { id: 'Reset Semua Pengaturan', en: 'Reset All Settings' },
  reset_settings_desc: { id: 'Kembalikan semua konfigurasi ke pengaturan pabrik. Tindakan ini tidak dapat dibatalkan.', en: 'Restore all configurations to factory defaults. This action cannot be undone.' },
  reset_btn: { id: 'Reset Pengaturan', en: 'Reset Settings' },
  reset_dialog_title: { id: 'Reset semua pengaturan?', en: 'Reset all settings?' },
  reset_dialog_desc: { id: 'Semua konfigurasi akan dikembalikan ke nilai awal. Tindakan ini tidak dapat dibatalkan.', en: 'All configurations will be reverted to initial values. This action cannot be undone.' },
  cancel: { id: 'Batal', en: 'Cancel' },
  yes_reset: { id: 'Ya, Reset', en: 'Yes, Reset' },

  // Dashboard
  today: { id: 'Hari Ini', en: 'Today' },
  this_week: { id: 'Minggu Ini', en: 'This Week' },
  this_month: { id: 'Bulan Ini', en: 'This Month' },
  this_year: { id: 'Tahun Ini', en: 'This Year' },
  all: { id: 'Semua', en: 'All' },
  recently_uploaded: { id: 'Terakhir Diupload', en: 'Recently Uploaded' },
  view_all: { id: 'Lihat Semua', en: 'View All' },
  scan_new: { id: 'Pindai Nota Baru', en: 'Scan New Receipt' },
  upload_img: { id: 'Unggah Gambar', en: 'Upload Image' },
  export_report: { id: 'Ekspor Laporan', en: 'Export Report' },
  welcome: { id: 'Kelola preferensi akun dan konfigurasi aplikasi Anda.', en: 'Manage your account preferences and application configurations.' },

  // Receipt Detail
  back: { id: 'Kembali', en: 'Back' },
  save: { id: 'Simpan', en: 'Save' },
  edit: { id: 'Edit', en: 'Edit' },
  delete: { id: 'Hapus', en: 'Delete' },
  receipt_detail: { id: 'Detail Nota', en: 'Receipt Details' },
  transaction_info: { id: 'Informasi transaksi', en: 'Transaction info' },
  description: { id: 'Keterangan', en: 'Description' },
  ocr_text_label: { id: 'Teks OCR (Edit Tabel/Baris)', en: 'OCR Text (Edit Table/Row)' },
  no_items_yet: { id: 'Belum ada item barang', en: 'No item list yet' },
  items_list: { id: 'Daftar Barang', en: 'Items List' },
  item_name: { id: 'Nama Barang', en: 'Item Name' },
  price: { id: 'Harga', en: 'Price' },
  qty: { id: 'Banyaknya', en: 'Qty' },
  total: { id: 'Total', en: 'Total' },
  subtotal: { id: 'Jumlah', en: 'Subtotal' },
  date: { id: 'Tanggal', en: 'Date' },
  amount_idr: { id: 'Nominal (IDR)', en: 'Amount (IDR)' },
  receipt_no: { id: 'No. Nota', en: 'Receipt No.' },
  receipt_no_opt: { id: 'Nomor nota (opsional)', en: 'Receipt number (optional)' },
  desc_opt: { id: 'Keterangan (opsional)', en: 'Description (optional)' },
  print: { id: 'Cetak', en: 'Print' },
  share: { id: 'Bagikan', en: 'Share' },
  secure_info: { id: 'Transaksi ini telah diverifikasi dan aman untuk diakses', en: 'This transaction is verified and secure to access' },
  show_ocr: { id: 'Tampilkan', en: 'Show' },
  hide_ocr: { id: 'Sembunyikan', en: 'Hide' },

  // Receipt History
  history_title: { id: 'Riwayat Nota', en: 'Receipt History' },
  search_placeholder: { id: 'Cari nota berdasarkan nama toko atau nomor...', en: 'Search receipts by store name or number...' },
  all_categories: { id: 'Semua Kategori', en: 'All Categories' },
  sort_by: { id: 'Urutkan', en: 'Sort By' },
  newest: { id: 'Tanggal Terbaru', en: 'Newest Date' },
  oldest: { id: 'Tanggal Terlama', en: 'Oldest Date' },
  largest: { id: 'Nominal Terbesar', en: 'Largest Amount' },
  smallest: { id: 'Nominal Terkecil', en: 'Smallest Amount' },

  // OneDrive View
  onedrive_sync: { id: 'Sinkronisasi OneDrive', en: 'OneDrive Sync' },
  onedrive_desc: { id: 'Semua data nota Anda tersinkronisasi dengan aman.', en: 'All your receipt data is securely synchronized.' },
  sync_status: { id: 'Status Sinkronisasi', en: 'Sync Status' },
  last_sync: { id: 'Terakhir Sinkronisasi', en: 'Last Sync' },
  never: { id: 'Belum pernah', en: 'Never' },
  sync_now: { id: 'Sinkronkan Sekarang', en: 'Sync Now' },
  processing: { id: 'Memproses...', en: 'Processing...' },
  finished: { id: 'Selesai', en: 'Finished' },

  // Scan View
  start_scan: { id: 'Mulai Pindai', en: 'Start Scan' },
  select_camera: { id: 'Pilih Kamera', en: 'Select Camera' },
  capture: { id: 'Ambil Foto', en: 'Capture Photo' },
  ocr_result: { id: 'Hasil OCR', en: 'OCR Result' },
  ocr_confirm_desc: { id: 'Apakah hasil OCR di bawah sudah sesuai? Silakan edit jika ada kesalahan.', en: 'Is the OCR result below correct? Please edit if there are errors.' },
  verify_receipt: { id: 'Verifikasi Nota', en: 'Verify Receipt' },
}

export function translate(key: string, lang: Language): string {
  const item = translations[key]
  if (!item) return key
  return item[lang] || item['id']
}
