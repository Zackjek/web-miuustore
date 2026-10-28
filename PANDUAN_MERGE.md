# Miuu Store terpadu — panduan pemasangan

Perubahan ini melanjutkan repositori `Zackjek/web-miuustore` dari commit `60fe6c7`. Modul order, profit, nota, garansi, template pesan, watermark, dan notifikasi yang sudah tersedia tetap dipakai. Katalog, loyalty, dan renewal Canva ditambahkan pada aplikasi Next.js yang sama.

## Satu alamat utama

| Jalur              | Pengguna     | Isi                                                             |
| ------------------ | ------------ | --------------------------------------------------------------- |
| `/`                | Publik       | Pricelist, pencarian, kategori, urutan harga, paket berkelompok |
| `/cek?kode=RO-…`   | Buyer        | Progres pesanan dan catatan publik                              |
| `/loyalty`         | Member       | Kartu stamp, hadiah, garansi, klaim, riwayat pesanan            |
| `/admin/dashboard` | Admin        | Seluruh menu pengelolaan                                        |
| `/admin/recovery`  | Pemilik akun | Penggantian password dari tautan pemulihan                      |

`/admin` mengarah ke dashboard; `/admin.html` mengarah ke menu loyalty di dashboard. Domain Netlify yang sekarang dapat tetap digunakan setelah perubahan ini di-merge dan di-deploy.

## 1. Simpan data sebelum pemasangan

Unduh backup JSON dari Settings pada web order yang sekarang. Pada Miuu Page, gunakan **Backup Data** dari browser/perangkat yang menyimpan data order. Data localStorage pada domain lama tidak berpindah ketika kode website digabungkan.

Pengujian dalam pengerjaan ini memakai database sementara berisi data uji. Database dan website produksi belum diubah.

## 2. Terapkan migrasi pada Supabase yang sama

Untuk database Miuu Store yang sudah berjalan, jalankan **hanya empat file berikut, sesuai urutan**, melalui SQL Editor Supabase:

1. `supabase/migrations/20261028000100_unified_store.sql`
2. `supabase/migrations/20261028000200_import_orders.sql`
3. `supabase/migrations/20261028000300_loyalty_programs.sql`
4. `supabase/migrations/20261028000400_push_schema.sql`

Migrasi menambahkan kolom dan tabel, mengaktifkan kebijakan akses, dan mempertahankan data yang sudah ada. Untuk instalasi baru, jalankan `supabase/schema.sql` dahulu, lalu empat migrasi di atas. File skema awal berisi pembuatan policy/trigger, sehingga tidak perlu dijalankan ulang pada database lama.

Pengelola yang sudah memiliki data order, produk, supplier, pengeluaran, catatan buyer, atau pengaturan otomatis dimasukkan ke `store_admins`. Akun baru tidak otomatis mendapat akses admin. Bila akun pengelola belum pernah menyimpan data, tambahkan **akun milikmu yang benar** dengan mengganti email pada SQL ini:

```sql
insert into public.store_admins(owner_id)
select id from auth.users
where lower(email) = lower('EMAIL_ADMIN_MILIKMU')
on conflict do nothing;
```

Bucket publik `miuu-assets` hanya untuk foto produk/logo. Upload dibatasi PNG, JPG, WebP, atau GIF maksimal 5 MB. Objek baru hanya dapat ditulis admin ke folder miliknya. Tabel order, modal, catatan pribadi, hash kode, dan kunci internal tetap tidak dapat dibaca pengunjung anonim.

## 3. Merge dan deploy ke Netlify

Gabungkan perubahan ke repositori yang terhubung ke situs Netlify yang sekarang. Build tetap `npm run build`, menggunakan integrasi Next.js Netlify. Aplikasi menggunakan API routes, sehingga tidak menggunakan static export.

Pertahankan dua environment variable dari proyek Supabase yang sama:

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_MILIKMU.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=PUBLISHABLE_ATAU_ANON_KEY
```

Node.js 24 digunakan dalam pengujian. Batas versi dalam proyek tetap Node.js 22.13 atau lebih baru.

Notifikasi HP yang sudah ada menggunakan `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, dan `SUPABASE_SECRET_KEY`. Dua variabel terakhir hanya berada di server/Netlify Functions. Notifikasi browser saat web terbuka dan pengiriman push saat web ditutup memiliki jalur berbeda. Pengiriman push ke perangkat nyata belum diuji pada sesi ini.

Di Supabase Authentication, pastikan Site URL menggunakan domain toko dan izinkan Redirect URL `https://DOMAIN-TOKO/admin/recovery`. Fitur lupa password mengirim tautan pemulihan melalui Supabase; halaman recovery memeriksa token sebelum menerima password baru.

## 4. Lengkapi katalog dari dashboard

Masuk melalui `/admin/dashboard`, lalu:

1. Buka **Katalog & toko**. Pertahankan slug `miuu` untuk katalog pada halaman utama. Atur nama, logo, tagline, header, footer, kategori, dan publikasi toko.
2. Buka **Products**. Produk yang sama dipakai untuk pemesanan dan katalog. Aktifkan **Tampilkan di pricelist** pada produk yang ingin diumumkan. Produk lama tetap internal sampai dipilih untuk dipublikasikan.
3. Isi varian dengan format `Nama Paket | Durasi = Harga`. Tanpa kelompok, gunakan `Durasi = Harga`. Nama paket dan urutannya bebas untuk seluruh aplikasi.
4. Untuk Netflix, tombol **Isi 13 varian Netflix dari ketentuan** dapat digunakan pada produk Netflix yang sudah ada. Paket Semiprivate satu bulan menggunakan Rp45.000. Modal/supplier tidak diganti oleh template; periksa modal pada order sesuai varian.
5. Isi **Tautan penjelasan produk** bila ingin menambahkan tautan referensi seperti WhatsApp Channel. Tautan channel sebenarnya tidak terdapat dalam lampiran, sehingga tidak diisi dengan alamat perkiraan.

Katalog hanya menampilkan harga jual dan informasi publik. Varian juga diproyeksikan hanya sebagai label dan harga. Modal dan supplier tidak ikut dikirim melalui endpoint katalog.

## 5. Pilih aturan loyalty

Ada dua aturan dari sumber yang diberikan; program dipilih saat member dibuat:

| Program                               | Perolehan stamp                                                                   | Hadiah                                         |
| ------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------- |
| `miuu8` — default dari `index 5.html` | Satu transaksi **Lunas**, tidak dibatalkan, nilai setelah refund minimal Rp15.000 | Stamp ke-4: diskon; ke-8: gratis satu aplikasi |
| `classic10` — dari web loyalty lama   | Satu pesanan pertama kali berstatus **Selesai**                                   | Setiap 10 stamp: diskon 10%, maksimal Rp15.000 |

Pengaturan program default berlaku untuk member baru. Program member lama dipertahankan agar riwayat hadiah tidak berubah.

Pada program delapan stamp, member dibuat otomatis dari nomor WA yang valid pada transaksi yang memenuhi syarat. Nomor WA dipakai untuk mencocokkan transaksi berikutnya. Total stamp tetap dicatat; kartu menunjukkan delapan stamp penuh hingga transaksi berikutnya memulai siklus baru. Pembatalan, perubahan menjadi tidak lunas/refund, atau penurunan nilai di bawah batas menarik kembali credit transaksi. Hadiah otomatis yang belum dipakai ditarik bila ambangnya tidak lagi terpenuhi. Hadiah yang sudah dipakai tetap tercatat.

Pada menu Loyalty club, admin dapat mengubah nama/nomor WA, menampilkan atau mengganti kode, menyalin tautan kartu, mengoreksi stamp dengan alasan, memberi hadiah manual, dan memperbarui status hadiah. Nama hadiah dan masa berlakunya dapat diatur; `0` hari berarti tanpa kedaluwarsa. Perubahan nama hadiah berlaku pada hadiah baru.

Kode member diverifikasi memakai hash dan disimpan terenkripsi agar admin pemiliknya dapat mengambilnya kembali. Kunci enkripsi berada pada schema privat database. Mengganti kode menutup sesi member lama. Member dapat membuka kartu dengan kode saja; Member ID juga tersedia untuk cara masuk yang lama.

**Data historis dari backend web loyalty lama belum dipindahkan.** Pemindahannya membutuhkan ekspor data dari admin/backend lama. Tidak ada data member, token admin, atau kode akses yang diambil dari situs lama dalam pengerjaan ini.

## 6. Canva dan impor Miuu Page

Buat order melalui Orders, lalu gunakan **Canva & renewal → Hubungkan order ke jadwal**. Tambahkan email customer, tim, dan durasi. Jadwal memakai order yang sama, sehingga pencatatan keuangan tidak digandakan.

Renewal dihitung dari tanggal order ditambah bulan kalender, dengan penyesuaian akhir bulan. Misalnya 31 Januari + 1 bulan menjadi 28/29 Februari. Status perlu renewal dimulai H-3 sampai ditandai sudah invite. Ada ringkasan H-3, H-1, Hari H, pencarian, filter tim, CSV, dan riwayat pesan. Daftar pesan WhatsApp disiapkan untuk dikirim satu per satu; status terkirim dicatat setelah admin menandainya. Aplikasi tidak mengirim WhatsApp atau melakukan invite Canva sendiri.

Di Settings, gunakan **Pindahkan order lama** untuk membaca backup JSON Miuu Page atau backup order Miuu Store. Ada pratinjau dan konfirmasi. Impor menambah order dan jadwal Canva secara atomik; mengimpor sumber yang sama lagi akan melewati order yang sudah ada.

Impor ini tidak mengganti produk, member, atau pengaturan. Backup Miuu Page tidak menyimpan modal atau nominal refund; modal diimpor sebagai nol dan status refund ditampilkan untuk diperiksa. Lengkapi angka tersebut sebelum menggunakan laporan profit. Semua data lain dari backup tetap ada dalam berkas asal.

## 7. Periksa sebelum dipakai berjualan

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Workflow `.github/workflows/quality.yml` menjalankan pemeriksaan yang sama saat push/PR. Workflow disiapkan, tetapi belum dijalankan di GitHub karena perubahan belum di-push.

Gunakan `KRITERIA_SUKSES.md` untuk membedakan hasil yang sudah diuji secara lokal dari hal yang masih harus diperiksa pada domain, Supabase, email, storage, dan perangkat produksi.
