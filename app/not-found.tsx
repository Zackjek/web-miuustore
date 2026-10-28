import Link from "next/link";
export default function NotFound() {
  return (
    <main className="soft-bg flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
      <p className="text-sm font-semibold text-primary">
        404 · tersesat sebentar ♡
      </p>
      <h1 className="serif text-4xl">Halaman belum ditemukan</h1>
      <p className="text-muted-foreground">
        Kembali ke toko untuk menemukan yang kamu cari.
      </p>
      <Link className="miuu-button" href="/">
        Ke Miuu Store
      </Link>
    </main>
  );
}
