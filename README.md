# Miuu Store 🐈

Web untuk mengelola pesanan Miuu Store. Saya pakai untuk mencatat order aplikasi, memantau masa sewa dan garansi, serta melihat keuntungan dari penjualan.

Situs: https://miuu-store.netlify.app/

## Yang bisa dilakukan

- Mencatat pesanan, status, data buyer, dan rincian pembayaran.
- Menyimpan katalog produk dan data supplier.
- Membuat nota serta link untuk buyer mengecek progres pesanan.
- Memantau garansi dan mendapat pengingat saat masa sewa hampir habis.
- Menghitung profit, refund, dan pengeluaran.
- Mengunduh data order sebagai CSV atau backup sebagai JSON.
- Menggunakan tema terang atau gelap.

Link cek progres hanya menampilkan informasi yang diperlukan buyer. Harga modal dan catatan pribadi tidak ikut ditampilkan.

## Teknologi

Proyek ini menggunakan Next.js, TypeScript, Tailwind CSS, dan Supabase. Situsnya di-deploy melalui Netlify dari repository GitHub ini.

## Menjalankan di komputer sendiri

Gunakan Node.js versi 22.13 atau lebih baru, lalu jalankan:

```bash
npm install
```

Buat file `.env.local` di folder utama proyek, sejajar dengan `package.json`. Isi dengan data dari proyek Supabase yang digunakan:

```env
NEXT_PUBLIC_SUPABASE_URL=https://alamat-proyek.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=publishable-key-atau-anon-key
```

Setelah itu jalankan:

```bash
npm run dev
```

Buka `http://localhost:3000`. Variabel yang tersimpan di Netlify tidak otomatis tersedia saat menjalankan `npm run dev` di komputer sendiri, jadi `.env.local` memang diperlukan untuk mencoba login secara lokal.

## Database dan deployment

Untuk **pemasangan baru**, jalankan `supabase/schema.sql` melalui SQL Editor di Supabase dan aktifkan login Email pada Supabase Authentication.

Situs Miuu Store yang sudah tayang memakai database yang telah disiapkan. Jika hanya mengubah tampilan atau kode aplikasi, tidak perlu menjalankan SQL tersebut lagi.

Netlify menyimpan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` di pengaturan **Environment variables**. Setelah perubahan kode di-push ke cabang GitHub yang terhubung, Netlify akan membuat deploy baru untuk situs yang sama.

## Catatan

Pengingat browser bekerja saat situs sedang dibuka. Tombol WhatsApp menyiapkan pesan pengingat untuk dikirim sendiri; aplikasi tidak mengirim pesan atau mengeluarkan akun buyer secara otomatis.