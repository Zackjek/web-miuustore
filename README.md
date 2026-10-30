# Miuu Store — little order studio

Website khusus Miuu Store untuk katalog publik, pengelolaan pesanan, loyalty, dan renewal Canva pada satu domain. Tidak menyediakan pendaftaran penjual atau toko lain. Proyek ini melanjutkan web order Miuu Store yang sudah ada.

## Desain ungu dan micro-interaction

Pembaruan visual dibuat dari `main` pada commit `d15265c` (upgrade, 30 Oktober 2026 pukul 21.38 WIB). Tombol Login Admin tetap terlihat di navigasi publik. Desain menggunakan lavender/lilac, ilustrasi kucing berpita, kupu-kupu, dan kartu stamp yang sama untuk admin serta member.

Tombol memiliki respons tekan/hover, sparkle klik, fokus yang jelas, dan indikator proses. Stamp mendarat setelah jumlah stamp benar-benar bertambah; hadiah pada ambang program mendapat perayaan tersendiri. Animasi tidak diputar ulang pada refresh data, pergantian member, atau pengurangan stamp. Preferensi reduced motion mematikan gerakan dekoratif; feedback teks tetap tersedia.

Perubahan ini tidak menambah dependensi atau migrasi database. Harga, program loyalty, data pesanan, logo/avatar, dan penguncian Miuu dipertahankan. Terapkan patch pada repo yang sudah diperbarui, lalu gunakan deployment Netlify yang sama.

## Halaman

- `/`: pricelist publik dengan kategori, pencarian, stok, dan paket berkelompok.
- `/cek`: progres pesanan melalui kode order.
- `/loyalty`: kartu member, stamp, hadiah, garansi, dan klaim.
- `/admin/dashboard`: seluruh pengelolaan dengan Supabase Auth dan daftar admin.
- `/admin/recovery`: pemulihan password.

Data Products dipakai untuk pemesanan dan katalog. Pesanan yang sama digunakan untuk loyalty dan Canva. Nota, profit, supplier, buyer, kalender, template pesan, watermark, backup, serta notifikasi yang sudah ada dipertahankan.

## Jalankan lokal

Gunakan Node.js 22.13 atau lebih baru; pemeriksaan pengerjaan ini memakai Node.js 24.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Isi URL Supabase dan publishable/anon key pada `.env.local`. Untuk instalasi database baru, jalankan `supabase/schema.sql`, lalu kelima migrasi dalam urutan timestamp. Untuk database yang sudah dipakai, jalankan migrasi baru saja. Instruksi lengkap tersedia di [PANDUAN_MERGE.md](PANDUAN_MERGE.md).

## Pembaruan 30 Oktober 2026

- Identitas Miuu Store dikunci di API dan database. Hanya akun pemilik Miuu yang dapat mengelola data.
- Katalog hanya pada `/`; parameter toko lain ditolak. Produk baru secara default tampil di pricelist dan tetap dapat disembunyikan satu per satu.
- Stamp card kucing dan kupu-kupu dipakai bersama di dashboard admin dan halaman pelanggan.
- Add Stamp bisa langsung diklik; alasan audit otomatis diisi server jika catatan kosong.
- Terapkan `supabase/migrations/20261030000100_miuu_only.sql` **sebelum** deployment kode ini. Pemilik dipilih dari katalog `miuu` yang sudah ada atau satu akun Miuu yang dapat dikenali dengan pasti; migrasi berhenti bila ambigu.

## Pemeriksaan

```bash
npm run typecheck
npm test
npm run build
```

Test menggunakan database sementara PGlite, tanpa kredensial Supabase produksi. Workflow GitHub Actions tersedia pada `.github/workflows/quality.yml`. Skenario browser menggunakan adapter uji dalam `tests/preview` dan sesi fixture; adapter ini bukan entry point deployment.

## Pemasangan dan penerimaan

- [Panduan merge, database, Netlify, dan pemindahan order](PANDUAN_MERGE.md)
- [Kriteria keberhasilan dan bukti pengujian](KRITERIA_SUKSES.md)

Website produksi dan data lama belum diubah pada pengerjaan ini. Setelah merge, gunakan deployment Netlify yang terhubung ke repositori yang sama, dengan project Supabase yang sama. Data dari web loyalty lama memerlukan ekspor admin tersendiri.
