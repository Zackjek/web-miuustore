# Kriteria keberhasilan proyek Miuu Store terpadu

## Pembaruan 30 Oktober 2026 — khusus Miuu

- Nama Miuu Store, slug `miuu`, dan katalog publik dikunci di API serta database.
- Akun selain pemilik Miuu ditolak, termasuk akun yang sebelumnya tercatat sebagai admin toko lain.
- Data historis akun lain disimpan, tetapi katalog, sesi member, tautan order, dan pengingat mereka tidak dilayani oleh website Miuu.
- Add Stamp tanpa alasan telah diuji lewat tombol dashboard: kartu 3/8 menjadi 4/8 dan voucher diskon terbit.
- Katalog contoh dengan produk dan harga telah terlihat tanpa login pada pratinjau terpisah.
- Pemeriksaan otomatis: 12 pengujian TypeScript/API, 43 pemeriksaan database, typecheck, serta build Next.js lulus.
- Pratinjau menggunakan UI hasil build, API dari source yang sama, dan PostgreSQL sementara. Cookie aman tetap wajib pada produksi; adapter QA menggunakan HTTP.
- Perubahan ini **belum dipasang pada Supabase/Netlify produksi**. Akses tulis GitHub dan Supabase belum tersedia di sesi pengerjaan ini.


Tanggal pemeriksaan: 28 Oktober 2026. Kriteria di bawah adalah definisi operasional untuk kebutuhan toko ini. Proyek belum dinyatakan selesai secara produksi sebelum pengujian pada akun dan domain sebenarnya dilakukan.

## Acuan yang dipakai

- [WCAG 2.2 — W3C](https://www.w3.org/TR/WCAG22/): dasar pemeriksaan reflow pada lebar 320 CSS pixel, nama kontrol, fokus keyboard, dan ukuran target. Batas minimum target adalah 24 × 24 CSS pixel dengan pengecualian yang dijelaskan standar. Kontrol utama baru dirancang lebih besar agar mudah disentuh.
- [Web Vitals — Google](https://web.dev/articles/vitals): target LCP ≤2,5 detik, INP ≤200 milidetik, dan CLS ≤0,1. Penilaian lapangan menggunakan persentil ke-75 dan membedakan mobile/desktop. Angka ini adalah sasaran; hasil produksi belum diukur.
- [Row Level Security — Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security) dan [Database Functions — Supabase](https://supabase.com/docs/guides/database/functions): dasar pemisahan akses dan pengujian allow/deny. Fungsi berprivilege dibatasi grant-nya, memeriksa pemilik, dan memakai `search_path` yang tetap.

## Gerbang kelulusan

| Area                 | Kriteria lulus                                                                                     | Bukti saat ini                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Tujuan pengguna      | Satu domain menyediakan katalog, cek order, loyalty, dan ruang admin dengan navigasi bersama       | Rute dan navigasi sudah dibuat dan dibuka pada preview                                        |
| Integrasi data       | Produk cukup dikelola sekali; order Canva dan loyalty menggunakan order yang sama                  | Produk dipakai bersama; jadwal Canva mengacu `order_id`                                       |
| Katalog              | Nama paket, durasi, harga, stok, kategori, deskripsi, foto, serta publikasi dapat dikelola         | Kode tersedia; edit varian dan pembaruannya di katalog diuji lewat browser                    |
| Universalitas varian | Berlaku untuk aplikasi mana pun; satu harga dan varian tanpa kelompok tetap didukung               | Pengujian parser dan pengelompokan lulus; Netflix dan Canva diuji di preview                  |
| Harga acuan          | 13 varian Netflix sesuai lampiran; Semiprivate satu bulan Rp45.000                                 | Pengujian data template lulus                                                                 |
| Akses publik         | Pengunjung tidak dapat membaca order/modal/kode privat atau mengubah data                          | Pemeriksaan allow/deny PostgreSQL lulus; payload katalog diproyeksikan terbatas sampai varian |
| Admin                | Akun yang tidak masuk daftar admin ditolak; akun selain pemilik Miuu ditolak                           | Pemeriksaan database untuk akun nonadmin lulus; sesi admin fixture diuji di browser           |
| Loyalty              | Credit transaksi tidak ganda; ambang Rp15.000 benar; hadiah ke-4/ke-8 dan classic10 konsisten      | Pengujian database untuk kedua program, refund, siklus, dan kode lulus                        |
| Klaim garansi        | Member mengajukan klaim pada order miliknya; admin dapat memperbarui status                        | Browser: klaim tersimpan, terlihat admin, berubah menjadi Diproses di kartu member            |
| Canva                | Akhir bulan benar; jadwal tidak maju dua kali dari aksi yang kedaluwarsa                           | Pengujian database lulus; tim dan jadwal tiga bulan disimpan lewat browser                    |
| Impor                | Pratinjau tersedia; sumber sama tidak menggandakan data; berkas rusak tidak membuat impor sebagian | Pengujian normalisasi, pengulangan, dan rollback transaksi lulus                              |
| Mobile               | Informasi dan harga tidak meluber saat nama paket/durasi panjang                                   | Iframe lebar 320px diuji; `scrollWidth` sama dengan `clientWidth` (305px setelah scrollbar)   |
| Kualitas kode        | Pemeriksaan tipe, test, dan build produksi berhasil                                                | Berhasil pada Node.js 24; 11 pengujian domain/pagination + 34 pemeriksaan database            |
| Pemeliharaan         | Ada panduan, contoh environment, migrasi berurutan, serta CI                                       | Berkas tersedia; CI GitHub belum dieksekusi pada repositori remote                            |
| Produksi             | Login nyata, email recovery, upload, dan notifikasi perangkat bekerja pada domain yang dipakai     | Belum diverifikasi pada akun produksi                                                         |
| Performa nyata       | Core Web Vitals memenuhi target di atas pada pengguna nyata                                        | Belum diukur setelah deployment                                                               |

## Pengujian browser yang sudah dilakukan

Preview menggunakan aplikasi Next.js yang dibangun, database PostgreSQL sementara melalui PGlite, dan sesi autentikasi fixture. Preview tidak terhubung ke proyek Supabase milik pengguna.

1. Halaman katalog memuat data dan mengelompokkan paket Netflix.
2. Pencarian `NETFLIX` menemukan produk meskipun kapitalisasi berbeda.
3. Urutan harga termahal memakai harga varian termurah sebagai dasar perbandingan antarproduk.
4. Admin menyimpan varian Canva dengan nama kelompok dan durasi panjang; katalog publik menampilkan pembaruannya.
5. Konten katalog yang sudah berisi varian panjang tetap tidak memiliki overflow horizontal pada frame mobile.
6. Kartu member menampilkan pesanan, garansi, total belanja, dan stamp.
7. Klaim garansi dikirim dari kartu member, kemudian ditampilkan pada detail admin.
8. Koreksi +1 dari tiga menjadi empat stamp menerbitkan hadiah diskon.
9. Perubahan status klaim menjadi Diproses tampil kembali pada kartu member.
10. Admin membuat tim Canva dan mengaitkan order yang sudah ada ke durasi tiga bulan. Akhir sewa dan jadwal renewal tampil tanpa menambah order baru.

Pemeriksaan ini membuktikan alur pada lingkungan pengujian. Login Supabase sebenarnya, email recovery, upload ke Storage produksi, browser push, dan pengalaman jaringan pengguna nyata harus diperiksa setelah pemasangan. Dokumen ini tidak menyatakan sertifikasi WCAG atau audit keamanan menyeluruh.

## Pemeriksaan penerimaan pada domain produksi

- [ ] Backup domain dan data lama tersimpan.
- [ ] Empat migrasi diterapkan ke project Supabase yang benar dan admin pemilik akun terverifikasi.
- [ ] Katalog memakai data produk yang benar; produk internal tidak ikut dipublikasikan.
- [ ] Tambah, edit, hapus, kategori, stok, dan upload foto berhasil setelah refresh.
- [ ] Akun nonadmin tidak dapat membuka data pengelolaan.
- [ ] Lupa password dikirim ke email pemilik dan recovery berhasil dengan tautan yang masih berlaku.
- [ ] Order baru, invoice, nota, profit, garansi, template, watermark, dan ekspor yang sudah ada tetap dapat dipakai.
- [ ] Member otomatis dari transaksi lunas dan program classic10 memberikan hasil sesuai aturan yang dipilih.
- [ ] Hadiah terpakai tidak dapat dipakai lagi melalui aksi penggunaan biasa; perubahan status manual dilakukan admin dengan sengaja.
- [ ] Member/riwayat dari backend loyalty lama dipindahkan melalui ekspor yang berwenang bila datanya masih dibutuhkan.
- [ ] Push diterima perangkat yang didaftarkan; WhatsApp tetap dikirim sendiri oleh admin.
- [ ] Tampilan diperiksa pada perangkat pengguna, termasuk Safari/Android dan pengaturan reduced motion.
- [ ] Core Web Vitals diukur pada penggunaan nyata dan targetnya dipenuhi.

Proyek dapat disebut berhasil digunakan ketika tujuan satu domain tercapai, alur utama lolos penerimaan produksi, data lama yang diperlukan tersedia, dan tidak ada masalah kritis yang belum diselesaikan. Pengujian otomatis dan CI menjadi pemeriksaan berulang untuk perubahan berikutnya.
