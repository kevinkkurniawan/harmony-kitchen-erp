## Ringkasan

Perubahan ini menyederhanakan pengelolaan barang di ERP, memperkuat jejak audit transaksi stok dan penjualan, melengkapi laporan profitabilitas, serta menambahkan kontrol harga grosir dan diskon nota pada POS.

Proposal mencakup aplikasi `harmony-kitchen-erp` dan `harmony-kitchen-pos`. Implementasi harus menjaga kompatibilitas data transaksi lama dan membatasi operasi sensitif berdasarkan role.

## Latar Belakang

Alur operasional saat ini masih memiliki beberapa hambatan:

- Koreksi stok dapat terlihat seperti perubahan manual dan belum memiliki jejak transaksi yang cukup jelas.
- Form Master Barang memakai beberapa tab dan menampilkan field yang tidak lagi dibutuhkan, sehingga ruang kerja tidak efisien.
- Penyimpanan inventory dapat berakhir dengan pesan umum `Failed to fetch` tanpa penanganan kegagalan yang membantu pengguna.
- Filter, detail transaksi, koreksi pembayaran, reprint, void, dan unvoid belum konsisten di area operasional ERP.
- Aturan quantity grosir masih tersebar dan sebagian hard-coded, sementara POS belum memiliki override Grosir 1 untuk seluruh keranjang.
- POS belum menyediakan diskon manual per nota sebagai input kasir yang eksplisit.
- Laporan belum menampilkan net income berdasarkan penjualan dikurangi HPP.
- Kontrol role dan filter per kolom perlu diperketat.
- Pembuatan barcode masih bercampur dengan antrian di Master Barang dan perlu dipisahkan menjadi halaman khusus.

## Tujuan

- Semua perubahan stok dan status penjualan yang material memiliki transaksi dan jejak audit.
- Master Barang lebih ringkas, cepat dipakai, dan tidak memuat kontrol yang sudah tidak relevan.
- Aturan grosir dikelola terpusat di ERP dan diterapkan secara konsisten oleh POS.
- Koreksi operasional dapat dilakukan dari ERP tanpa menghilangkan histori awal.
- Laporan harian dan bulanan konsisten serta dapat menunjukkan net income.
- Aksi sensitif hanya tersedia bagi role yang berwenang.

## Perubahan yang Diusulkan

### 1. Stok opname berbasis transaksi

- Simpan setiap stok opname sebagai transaksi dengan nomor transaksi, tanggal, gudang, pembuat, catatan, stok sistem, stok fisik, dan selisih per barang.
- Saat transaksi diposting, buat pergerakan stok sebesar selisih; jangan menimpa saldo stok secara langsung dari UI.
- Transaksi yang sudah diposting tidak dapat diedit. Koreksi dilakukan melalui pembatalan/reversal dan transaksi pengganti.
- Riwayat kartu stok harus menampilkan referensi transaksi opname.
- Cegah posting ganda dengan idempotency/validasi status transaksi.

### 2. Penyederhanaan Master Barang dan inventory

- Ubah form tambah/edit menjadi satu layout tanpa tab, menggunakan grid responsif agar ruang desktop dan tablet terpakai maksimal.
- Hapus kategori barang dari tampilan, filter, form, detail, dan ekspor Master Barang. Data lama boleh tetap tersimpan untuk kompatibilitas sampai migrasi terpisah disetujui.
- Hapus input dan kolom minimum/maksimum stok dari Master Barang. Penghapusan fisik field database bukan bagian proposal ini.
- Hapus seluruh antrian barcode dari Master Barang, termasuk state, tombol, counter, menu konteks, dan aksi cetaknya.
- Sediakan filter status `Semua`, `Aktif`, dan `Nonaktif` secara berdampingan.
- Perbaiki penyimpanan inventory dengan validasi client/server, respons error terstruktur, timeout/network handling, dan pesan kesalahan yang dapat ditindaklanjuti. Tombol simpan harus mencegah submit ganda dan mempertahankan isi form ketika gagal.

Bagian ini memperluas proposal `improve-master-barang-workflow`; implementasi dan acceptance criteria yang beririsan harus digabung agar tidak ada dua perubahan pada komponen yang sama secara terpisah.

### 3. Kategori dan aturan quantity grosir

- Tambahkan `kategori grosir` pada barang sebagai identifier kelompok aturan, misalnya 1, 2, dan seterusnya.
- Master Promo Grosir hanya menentukan ambang quantity per kategori dan tier; harga tetap berasal dari Harga Grosir 1, 2, dan 3 milik barang.
- ERP memvalidasi bahwa ambang quantity positif, unik, dan berurutan naik untuk setiap kategori.
- API produk mengirim kategori grosir, harga grosir, dan ambang quantity yang berlaku kepada POS.
- POS tidak boleh memakai angka ambang hard-coded ketika konfigurasi ERP tersedia.
- Detail barang/equipment menampilkan kategori dan aturan grosir yang efektif setelah arti “detail equipment” dikonfirmasi.

### 4. Detail Penerimaan Barang

- Double-click baris pada daftar Penerimaan Barang Ekspres maupun Penerimaan Barang dengan Harga membuka popup detail transaksi.
- Popup menampilkan header, supplier, gudang, status, pembuat, waktu, catatan, dan seluruh detail barang.
- Popup bersifat read-only; aksi koreksi/void tetap mengikuti izin terpisah.
- Tetap sediakan cara akses yang dapat digunakan tanpa mouse, misalnya tombol Detail atau Enter pada baris terpilih.

### 5. Sales Monitoring dan kontrol transaksi

- Tambahkan preset filter harian dan rentang tanggal eksplisit dengan zona waktu operasional `Asia/Bangkok`.
- Izinkan perubahan tipe pembayaran tanpa mengubah nilai total penjualan. Simpan tipe lama, tipe baru, alasan, waktu, dan pengguna yang melakukan perubahan.
- Reprint menggunakan snapshot transaksi tersimpan dan menandai hasil sebagai salinan/reprint tanpa membuat transaksi penjualan baru.
- Void memerlukan konfirmasi, alasan, dan permission; stok dikembalikan melalui transaksi reversal yang dapat diaudit.
- Unvoid memerlukan permission yang lebih tinggi, mengembalikan efek transaksi secara konsisten, dan ditolak bila stok atau dependensi transaksi tidak memungkinkan.
- Ringkasan Sales Monitoring dihitung ulang setelah perubahan pembayaran, void, atau unvoid.

### 6. POS: override Grosir 1

- Tambahkan tombol `Override Semua ke Grosir 1` yang menerapkan Harga Grosir 1 pada semua item aktif di keranjang tanpa melihat quantity.
- Override hanya berlaku pada nota aktif, terlihat jelas pada setiap baris, dan dapat dibatalkan sebelum pembayaran.
- Barang tanpa Harga Grosir 1 yang valid tetap menggunakan harga normal dan ditampilkan dalam ringkasan pengecualian.
- Transaksi menyimpan flag override dan harga efektif per baris agar receipt dan reprint konsisten.
- Hak memakai override dikontrol oleh permission POS.

### 7. POS: diskon manual per nota

- Tambahkan input diskon manual di pojok kanan bawah area ringkasan nota.
- Dukung input nominal rupiah dan persentase dengan mode yang dipilih secara eksplisit.
- Terapkan diskon pada level nota setelah subtotal/harga grosir dan sebelum pajak serta service charge.
- Total diskon tidak boleh membuat nilai nota negatif.
- Tampilkan diskon manual secara terpisah dari diskon member, voucher, atau promo pada UI, payload transaksi, receipt, reprint, dan laporan.
- Simpan pengguna pemberi diskon dan minta permission/reason sesuai batas diskon yang ditetapkan.

### 8. Laporan harian, bulanan, dan net income

- Gunakan definisi kolom dan rumus yang sama untuk laporan harian dan bulanan; perbedaannya hanya granularitas periode.
- Tambahkan HPP, laba kotor/net income operasional, dan margin.
- Rumus dasar: `Net Income = Net Sales - HPP Barang Terjual`.
- HPP dihitung dari snapshot HPP per detail penjualan, bukan nilai master barang saat laporan dibuka.
- Transaksi void dikeluarkan, sedangkan reversal/koreksi tercermin pada periode efektifnya.
- Nilai HPP dan net income hanya terlihat bagi role yang memiliki permission View HPP/Profit.

### 9. Role dan permission

- Audit seluruh halaman, tombol, dan endpoint yang terdampak; UI yang disembunyikan tidak dianggap sebagai kontrol keamanan.
- Terapkan pemeriksaan permission pada server untuk: posting/reversal opname, edit inventory, perubahan payment, reprint, void, unvoid, override grosir, diskon manual, create barcode, serta View HPP/Profit.
- Default role mengikuti least privilege dan perubahan permission tercatat dalam audit log.
- Pengguna yang tidak berwenang menerima respons `403` yang konsisten tanpa data sensitif.

### 10. Filter strict per kolom

- Tambahkan filter pada setiap kolom yang relevan di Master Barang, Penerimaan Barang, Sales Monitoring, dan laporan.
- Filter teks strict menggunakan exact match setelah trim dan normalisasi huruf besar/kecil; kolom angka, tanggal, status, dan boolean memakai operator sesuai tipe.
- Beberapa filter digabung menggunakan logika AND.
- Sorting, pagination, export, dan summary harus memakai filter yang sama dari server.
- Sediakan tombol reset seluruh filter dan indikator filter aktif.

### 11. Halaman Create Barcode

- Buat halaman ERP khusus untuk memilih barang, menentukan jumlah label, memilih tampil/tidaknya harga, melihat preview, dan mencetak barcode.
- Pemilihan barang dapat dilakukan melalui scan, pencarian, atau filter strict.
- Validasi barcode dan jumlah label sebelum print; item invalid ditolak dengan alasan yang jelas.
- Halaman tidak memakai antrian global di Master Barang dan tidak mengubah data inventory ketika mencetak.
- Akses halaman dan aksi print dikontrol oleh permission.

## Kapabilitas

### Kapabilitas Baru

- `inventory-opname-transactions`: posting dan reversal stok opname dengan audit trail.
- `wholesale-rule-categories`: kategori grosir dan ambang quantity terpusat untuk ERP/POS.
- `sales-transaction-corrections`: perubahan payment, reprint, void, dan unvoid yang dapat diaudit.
- `pos-invoice-adjustments`: override Grosir 1 dan diskon manual per nota.
- `sales-profit-reporting`: HPP snapshot, net income, dan margin pada laporan.
- `barcode-creation-page`: pemilihan, preview, dan pencetakan label barcode.
- `strict-column-filtering`: filter bertipe dan exact-match pada tabel operasional.

### Kapabilitas yang Dimodifikasi

- `master-barang`: form satu halaman, status filter, penghapusan category/min-max/antrian dari UI, dan error handling penyimpanan.
- `goods-receiving`: popup detail melalui double-click dan akses keyboard.
- `user-permissions`: permission baru dan enforcement server-side.
- `sales-reporting`: konsistensi laporan harian dan bulanan.

## Acceptance Criteria

- Posting opname menghasilkan transaksi selisih dan kartu stok tanpa update saldo manual dari client.
- Form Master Barang tidak memiliki tab, category, min/max, atau antrian barcode, dan dapat disimpan tanpa kehilangan data saat request gagal.
- Filter status dapat menampilkan aktif saja, nonaktif saja, atau seluruh barang.
- Aturan quantity grosir berasal dari ERP dan POS menerapkannya tanpa threshold hard-coded.
- Double-click atau aksi keyboard pada penerimaan membuka detail transaksi yang benar.
- Sales Monitoring dapat difilter per hari; perubahan payment, reprint, void, dan unvoid memiliki audit trail dan permission check.
- Override Semua menerapkan Grosir 1 tanpa syarat quantity dan tersimpan pada transaksi.
- Diskon manual per nota tampil terpisah dan menghasilkan total, pajak, receipt, serta laporan yang konsisten.
- Laporan harian dan bulanan memakai rumus sama dan net income berasal dari net sales dikurangi snapshot HPP.
- Filter per kolom diterapkan secara strict di server dan konsisten dengan pagination/export/summary.
- Halaman Create Barcode dapat preview dan print tanpa mengubah inventory.
- Semua endpoint sensitif menolak pengguna tanpa permission yang sesuai.

## Urutan Implementasi yang Direkomendasikan

1. Tetapkan keputusan bisnis yang masih terbuka serta matriks permission.
2. Tambahkan audit model, snapshot HPP, dan aturan grosir yang dibutuhkan oleh ERP/POS.
3. Perbaiki fondasi transaksi opname dan koreksi Sales Monitoring.
4. Sederhanakan Master Barang serta perbaiki error handling penyimpanan.
5. Implementasikan kategori/quantity grosir dan integrasi POS.
6. Implementasikan override Grosir 1 dan diskon manual POS.
7. Samakan laporan harian/bulanan dan tambahkan net income.
8. Tambahkan strict column filters, detail penerimaan, dan halaman Create Barcode.
9. Jalankan regression test lintas ERP/POS, permission test, dan rekonsiliasi laporan.

## Risiko dan Mitigasi

- **Histori HPP tidak memiliki snapshot:** laporan lama dapat berbeda jika memakai HPP master saat ini. Mitigasi: tetapkan kebijakan backfill dan beri penanda untuk hasil estimasi.
- **Unvoid dapat menyebabkan stok negatif atau duplikasi jurnal:** gunakan validasi dependensi, transaksi database atomik, idempotency, dan reversal ledger.
- **Perubahan aturan grosir memengaruhi harga kasir:** versioning atau snapshot aturan dan harga pada setiap transaksi.
- **Diskon bertumpuk:** tentukan urutan kalkulasi tunggal dan simpan komponen diskon secara terpisah.
- **Filter exact match terlalu ketat untuk pencarian umum:** pertahankan global search terpisah sebagai contains-search; strict hanya untuk filter kolom.
- **Proposal menyentuh dua aplikasi:** kontrak API perlu dirilis kompatibel sebelum UI POS bergantung padanya.

## Non-goals

- Menghapus fisik kolom category/minstock/maxstock dari database pada perubahan ini.
- Mengubah transaksi lama secara otomatis tanpa prosedur migrasi yang disetujui.
- Membuat ulang seluruh desain ERP atau POS.
- Mengganti perangkat, driver, atau protokol printer barcode/receipt.
- Menambahkan skema akuntansi penuh di luar rumus net sales dikurangi HPP.

## Keputusan Perencanaan

1. `Kategori grosir` melekat pada master barang dan memakai tiga tier harga yang sudah ada.
2. Master Promo Grosir menyimpan ambang quantity untuk setiap tier dan kategori; harga tetap disimpan pada barang.
3. “Detail equipment” diperlakukan sebagai panel detail barang dan akan menampilkan kategori serta aturan grosir efektif.
4. Diskon manual mendukung nominal dan persentase, serta selalu memerlukan alasan dan permission.
5. Permission berisiko tinggi tersedia untuk dikonfigurasi per pengguna; Admin mendapatkannya secara default dan pengguna non-Admin tidak mendapatkannya sampai diberikan secara eksplisit.
6. `Net Income` pada perubahan ini berarti laba kotor operasional: `Net Sales - Snapshot HPP`, tanpa biaya operasional lain.
7. Create Barcode memakai preview dan print browser dengan preset label yang dapat dipilih; preset awal adalah 50 × 30 mm.

## Dampak Teknis

- ERP frontend: Master Barang, Stock Opname, Penerimaan Barang, Sales Monitoring, Master Promo, Sales Report, User Access, navigasi, dan halaman Create Barcode.
- ERP API: inventory, opname, promo/rules, sales monitoring, reporting, barcode, dan permissions.
- POS frontend/API: kalkulasi harga grosir, cart totals, discount input, checkout payload, receipt, dan reprint.
- Database: audit event/transaksi reversal, kategori dan quantity rule grosir, snapshot HPP, komponen diskon, serta metadata override/koreksi.
- Testing: unit test kalkulasi, permission/API integration test, concurrency/idempotency test, dan end-to-end ERP–POS.
