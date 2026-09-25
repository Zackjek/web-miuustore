# Ruang Order — kode mandiri

Situs untuk mencatat pesanan aplikasi, status buyer, profit, dan pengingat logout saat masa sewa berakhir. Ini versi mandiri dari Ruang Order: **tidak membutuhkan login ChatGPT maupun hosting Sites**. Pilihan gratis untuk penggunaan jualan: **Netlify Free + Supabase Free**. Kode Next.js ini juga dapat dijalankan di Vercel (paket yang mengizinkan penggunaan komersial) atau penyedia lain yang mendukung Next.js dengan API routes. Paket Vercel Hobby hanya untuk penggunaan pribadi nonkomersial.

## 1. Siapkan Supabase

1. Buat project Supabase baru.
2. Buka **SQL Editor**, tempel seluruh isi [`supabase/schema.sql`](supabase/schema.sql), lalu jalankan. Skrip ini membuat tabel, kebijakan privasi per akun (RLS), pencatatan riwayat status, dan fungsi cek progres buyer.
3. Buka **Project Settings → API Keys** dan salin **Project URL** serta **publishable key** (atau `anon` key lama). Jangan gunakan `service_role` atau secret key di browser.
4. Di **Authentication → Providers → Email**, aktifkan Email. Bila konfirmasi email diaktifkan, pastikan pengaturan **URL Configuration** mengarah ke domain situsmu agar tautan konfirmasi benar. Kamu bisa membuat akun dari tombol **Daftar** di halaman login.
5. Setelah akun sellermu dibuat, kamu boleh mematikan pendaftaran publik di Supabase Auth bila situs hanya untukmu. Akun yang sudah ada tetap bisa masuk.

## 2. Jalankan lokal

Butuh Node.js 22 atau lebih baru.

```bash
npm install
cp .env.example .env.local
```

Isi `.env.local` dengan Project URL dan publishable key dari project Supabase yang sama. Keduanya memang boleh berada pada sisi browser; akses data pribadi dibatasi oleh login dan RLS. Lalu:

```bash
npm run dev
```

Buka `http://localhost:3000`. Untuk memeriksa TypeScript dan build:

```bash
npm run typecheck
npm run build
```

## 3. Deploy ke Netlify (pilihan gratis untuk jualan)

1. Unggah folder ini ke repo Git milikmu. Di Netlify, pilih **Add new site → Import an existing project** dan hubungkan repo. Netlify mendukung aplikasi Next.js beserta API routes; jangan gunakan static export karena kode ini memakai `/api/data` dan `/api/progress`.
2. Tambahkan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` pada **Environment variables** untuk build dan runtime. Isi nilainya sebelum deployment pertama karena variabel `NEXT_PUBLIC_` dimasukkan pada saat build.
3. Jalankan deployment. Tambahkan domainmu melalui pengaturan domain Netlify bila sudah punya.
4. Di Supabase **Authentication → URL Configuration**, isi Site URL dengan domain produksimu dan tambahkan Redirect URL yang diperlukan untuk konfirmasi email.

### Pilihan Vercel

Langkahnya serupa: impor repo sebagai project Next.js, tambahkan dua variabel lingkungan yang sama, lalu deploy. **Vercel Hobby membatasi penggunaan pada proyek pribadi nonkomersial**, jadi untuk usaha/order jualan gunakan paket Vercel yang mengizinkan penggunaan komersial. Di luar itu, kode ini tidak terikat pada Netlify atau Vercel.

## Pengingat masa sewa

- Pada form order, isi **Akhir masa sewa aplikasi (WIB)**. Kolom ini **berbeda** dari tanggal garansi/jatuh tempo. Order lama yang belum diisi tidak memunculkan pengingat sampai kamu menambahkannya.
- Tiga hari sebelum akhir masa sewa, kartu dashboard dan ikon lonceng menampilkan order. Setelah habis, statusnya menjadi **Perlu logout** sampai seller mengeluarkan akun buyer di aplikasi terkait dan menekan **Sudah logout**.
- Tombol **Aktifkan notifikasi browser** meminta izin browser. Pop-up muncul satu kali saat halaman sedang terbuka untuk kondisi segera habis dan saat lewat tenggat. Situs tetap memperbarui lonceng/daftar ketika dibuka kembali. **Browser yang tertutup tidak mengirim notifikasi otomatis.**
- Isi nomor WhatsApp seller di Settings untuk membuka pesan pengingat yang sudah terisi, lalu kirim sendiri. Kode ini **tidak mengirim WhatsApp otomatis** dan tidak punya akses untuk mengeluarkan pengguna dari aplikasi pihak ketiga.
- Jika masa sewa diperpanjang melalui edit order, tanda logout lama direset agar siklus pengingat baru dapat berjalan.

## Data dan keamanan

Setiap seller hanya dapat membaca/mengubah order miliknya berkat RLS. Halaman `/cek?kode=RO-...` mengakses hanya nomor invoice, produk, status, catatan publik, riwayat status, dan tanggal terkait. Kode pelacakan dibuat acak. Data harga, modal, nomor WhatsApp, dan catatan pribadi tidak dikirim ke halaman buyer. Jangan masukkan kredensial akun aplikasi di catatan order.

Paket Supabase Free dapat mem-pause project setelah seminggu tanpa aktivitas; cek status project sebelum memakai web lagi setelah lama tidak aktif. Ekspor CSV/JSON tersedia di Settings. Berkas backup berisi data buyer; simpan dengan aman. Impor backup otomatis belum disediakan. Kode ini tidak menyertakan data dari situs Ruang Order yang sudah terbit; jika ada order di sana, unduh ekspornya sebelum berpindah dan catat ulang atau migrasikan dengan bantuan teknis.
