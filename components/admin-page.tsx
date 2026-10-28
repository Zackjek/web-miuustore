"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, LockKeyhole } from "lucide-react";
import Workspace from "./workspace";
import { MiuuCat } from "./miuu-cat";
import {
  authFetch,
  currentUser,
  sendPasswordReset,
  signIn,
  signOut,
  type User,
} from "@/lib/browser-auth";
export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null),
    [checking, setChecking] = useState(true),
    [reset, setReset] = useState(false);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function verify(candidate: User | null) {
    if (!candidate) return;
    const response = await authFetch("/api/hub", { cache: "no-store" });
    if (!response.ok) {
      const body = await response.json();
      throw new Error(body.error || "Akun belum memiliki akses admin.");
    }
    setUser(candidate);
  }
  useEffect(() => {
    void currentUser()
      .then(verify)
      .catch((e) =>
        setMessage(e instanceof Error ? e.message : "Akses belum tersedia."),
      )
      .finally(() => setChecking(false));
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      if (reset) {
        await sendPasswordReset(email);
        setMessage(
          "Jika email terdaftar, tautan pemulihan akan dikirim. Periksa juga folder spam.",
        );
      } else await verify(await signIn(email, password));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Permintaan belum berhasil.");
    } finally {
      setBusy(false);
    }
  }
  if (checking)
    return (
      <main
        className="soft-bg flex min-h-screen items-center justify-center"
        role="status"
      >
        Memeriksa sesi…
      </main>
    );
  if (user)
    return (
      <Workspace
        displayName={
          user.user_metadata?.full_name || user.email.split("@")[0] || "Seller"
        }
        onSignOut={() => void signOut().finally(() => setUser(null))}
      />
    );
  return (
    <main className="soft-bg flex min-h-screen items-center justify-center px-4 py-10">
      <div className="glass w-full max-w-[430px] rounded-[30px] p-7 sm:p-9">
        <Link
          href="/"
          className="mb-7 inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft size={16} /> Kembali ke pricelist
        </Link>
        <MiuuCat className="mx-auto size-14" />
        <h1 className="serif mt-5 text-center text-4xl">
          Miuu Store<span className="text-primary">.</span>
        </h1>
        <p className="mt-2 text-center text-xs font-semibold tracking-[.2em] text-muted-foreground">
          RUANG PENGELOLA
        </p>
        <h2 className="mt-8 flex items-center gap-2 font-semibold">
          <LockKeyhole size={17} />
          {reset ? "Pulihkan password" : "Masuk ke ruang kerjamu"}
        </h2>
        <form onSubmit={(e) => void submit(e)} className="mt-5 space-y-3">
          <label className="block text-sm font-semibold" htmlFor="auth-email">
            Email admin
          </label>
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 w-full rounded-xl border border-border bg-card px-3"
          />
          {!reset && (
            <>
              <label
                className="block text-sm font-semibold"
                htmlFor="auth-password"
              >
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 w-full rounded-xl border border-border bg-card px-3"
              />
            </>
          )}
          {message && (
            <p role="status" className="rounded-xl bg-secondary p-3 text-sm">
              {message}
            </p>
          )}
          <button
            disabled={busy}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Memproses…" : reset ? "Kirim tautan pemulihan" : "Masuk"}
            <ArrowRight size={17} />
          </button>
        </form>
        <button
          className="mt-4 min-h-11 w-full text-center text-sm font-medium text-primary hover:underline"
          onClick={() => {
            setReset(!reset);
            setMessage("");
          }}
        >
          {reset ? "Kembali ke halaman masuk" : "Lupa password?"}
        </button>
        <p className="mt-4 text-center text-sm leading-relaxed text-muted-foreground">
          Satu ruang untuk order, katalog, member, dan renewal Canva.
        </p>
      </div>
    </main>
  );
}
