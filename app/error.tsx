"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="soft-bg flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
      <h1 className="serif text-3xl">Halaman belum dapat dimuat</h1>
      <p className="text-muted-foreground">Coba muat ulang halaman ini.</p>
      <button type="button" className="miuu-button" onClick={reset}>
        Coba lagi
      </button>
    </main>
  );
}
