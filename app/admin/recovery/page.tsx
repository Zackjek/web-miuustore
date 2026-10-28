"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { recoveryUser, setRecoveryPassword } from "@/lib/browser-auth";
export default function Recovery() {
  const started = useRef(false);
  const [token, setToken] = useState(""),
    [checking, setChecking] = useState(true),
    [message, setMessage] = useState("");
  const [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const hash = new URLSearchParams(location.hash.slice(1)),
      access = hash.get("access_token");
    history.replaceState(null, "", location.pathname);
    if (!access || hash.get("type") !== "recovery") {
      setMessage(
        "Tautan pemulihan tidak valid atau sudah kedaluwarsa. Minta tautan baru dari halaman masuk.",
      );
      setChecking(false);
      return;
    }
    void recoveryUser(access)
      .then(() => setToken(access))
      .catch(() =>
        setMessage("Tautan pemulihan sudah kedaluwarsa. Minta tautan baru."),
      )
      .finally(() => setChecking(false));
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmation) {
      setMessage("Konfirmasi password belum sama.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await setRecoveryPassword(token, password);
      setDone(true);
      setToken("");
      setPassword("");
      setConfirmation("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Password belum tersimpan.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="soft-bg flex min-h-screen items-center justify-center p-5">
      <section className="glass w-full max-w-md rounded-[28px] p-7">
        <h1 className="serif text-3xl">Password baru</h1>
        {checking ? (
          <p role="status" className="mt-5">
            Memeriksa tautan…
          </p>
        ) : done ? (
          <p role="status" className="mt-5">
            Password berhasil diperbarui. Silakan masuk kembali.
          </p>
        ) : token ? (
          <form className="mt-6 space-y-4" onSubmit={(e) => void submit(e)}>
            <label className="block text-sm font-semibold">
              Password baru
              <input
                className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-3"
                required
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="block text-sm font-semibold">
              Ulangi password
              <input
                className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-3"
                required
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            <button disabled={busy} className="miuu-button w-full">
              {busy ? "Menyimpan…" : "Simpan password"}
            </button>
          </form>
        ) : null}
        {message && (
          <p role="alert" className="mt-5 rounded-xl bg-secondary p-3 text-sm">
            {message}
          </p>
        )}
        <Link
          href="/admin/dashboard"
          className="mt-6 inline-flex min-h-11 items-center font-medium text-primary underline"
        >
          Kembali ke halaman masuk
        </Link>
      </section>
    </main>
  );
}
