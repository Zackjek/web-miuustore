"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Copy,
  Eye,
  EyeOff,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { PublicShell, PixelCat } from "./public-shell";
import StampCard from "./stamp-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Field } from "./hub/common";
import { addDays, dateFmt, invoice, moneyFmt } from "./order-types";
import { dateDistance } from "@/lib/date-tools";
import { rewardState, rewardStateText } from "@/lib/loyalty";
import type { MemberOrder, MemberProfile } from "@/lib/unified-types";
const warrantyEnd = (order: MemberOrder) =>
  order.due_date || addDays(order.order_date, order.warranty_days);
export default function MemberClub() {
  const [profile, setProfile] = useState<MemberProfile | null>(null),
    [checking, setChecking] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [member, setMember] = useState(""),
    [code, setCode] = useState(""),
    [shown, setShown] = useState(false),
    [copyNote, setCopyNote] = useState("");
  const [claim, setClaim] = useState<MemberOrder | null>(null),
    [message, setMessage] = useState(""),
    [notice, setNotice] = useState("");
  async function refresh(signal?: AbortSignal) {
    try {
      const response = await fetch("/api/loyalty", {
        cache: "no-store",
        signal,
      });
      const body = await response.json();
      if (response.ok) setProfile(body);
      else if (response.status === 401) setProfile(null);
      else setError(body.error || "Data belum dapat dimuat.");
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError"))
        setError(
          "Kartu member belum dapat dimuat. Periksa koneksi lalu coba lagi.",
        );
    } finally {
      if (!signal?.aborted) setChecking(false);
    }
  }
  const linkCode = useRef<string | null>(null),
    linkLogin = useRef<Promise<void> | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    if (linkCode.current === null) {
      linkCode.current = new URLSearchParams(location.search).get("kode") || "";
      if (linkCode.current) history.replaceState(null, "", location.pathname);
    }
    if (linkCode.current) {
      setCode(linkCode.current);
      if (!linkLogin.current)
        linkLogin.current = action({
          action: "login",
          member_id: "",
          code: linkCode.current,
        });
      void linkLogin.current
        .then(() => refresh(controller.signal))
        .catch((e) => {
          if (!controller.signal.aborted) {
            setError(
              e instanceof Error ? e.message : "Kode belum dapat dibuka.",
            );
            setChecking(false);
          }
        });
    } else void refresh(controller.signal);
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!profile) return;
    const controller = new AbortController();
    const timer = setInterval(() => {
      if (!document.hidden && !claim) void refresh(controller.signal);
    }, 30000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [!!profile, !!claim]);
  async function action(data: Record<string, unknown>) {
    const response = await fetch("/api/loyalty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Permintaan belum berhasil.");
  }
  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await action({ action: "login", member_id: member, code });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login belum berhasil.");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await action({ action: "logout" });
      setProfile(null);
      setCode("");
      setShown(false);
      setNotice("");
    } catch {
      setError("Belum berhasil keluar. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }
  async function submitClaim(e: FormEvent) {
    e.preventDefault();
    if (!claim) return;
    setBusy(true);
    setError("");
    try {
      await action({ action: "claim", order_id: claim.id, message });
      setClaim(null);
      setMessage("");
      setNotice(
        "Klaim garansi terkirim. Kamu dapat melihat statusnya di kartu garansi.",
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Klaim belum terkirim.");
    } finally {
      setBusy(false);
    }
  }
  const orders = profile?.orders || [],
    warranties = orders.filter(
      (o) =>
        (o.status !== "Dibatalkan" && o.warranty_days > 0) ||
        (o.status !== "Dibatalkan" && !!o.due_date),
    );
  const total = orders
    .filter((o) => o.status === "Selesai")
    .reduce((sum, o) => sum + o.price * o.quantity - o.refund_amount, 0);
  return (
    <PublicShell active="loyalty">
      <div className="miuu-member-wrap">
        {checking ? (
          <p role="status" className="miuu-empty">
            Memuat kartu member…
          </p>
        ) : !profile ? (
          <section className="miuu-member-login">
            <PixelCat className="mx-auto mb-4 size-16 text-primary" />
            <p className="miuu-eyebrow text-center">meow & butterfly club</p>
            <h1 className="serif mt-2 text-center text-3xl">
              A little club for you ♡
            </h1>
            <p className="hub-muted mb-7 mt-3 text-center">
              Masukkan kode akses dari admin untuk melihat stamp, garansi, dan
              hadiahmu.
            </p>
            <form onSubmit={(e) => void login(e)}>
              <Field label="Member ID (opsional)">
                <input
                  autoComplete="username"
                  autoCapitalize="characters"
                  maxLength={40}
                  value={member}
                  onChange={(e) => setMember(e.target.value)}
                  placeholder="MIU-…"
                />
              </Field>
              <Field label="Kode akses">
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  maxLength={64}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </Field>
              {error && (
                <p role="alert" className="hub-error">
                  {error}
                </p>
              )}
              <button disabled={busy} className="miuu-button w-full">
                {busy ? "Memeriksa…" : "Buka kartu member"}
              </button>
            </form>
            <p className="hub-muted mt-5 text-center">
              Lupa kode akses? Hubungi admin toko untuk mendapatkan kode baru.
            </p>
          </section>
        ) : (
          <div className="space-y-5">
            <div className="hub-row justify-between">
              <p className="miuu-eyebrow">your little loyalty corner</p>
              <button
                className="hub-row min-h-11 text-sm text-primary"
                disabled={busy}
                onClick={() => void logout()}
              >
                <LogOut size={16} /> Keluar
              </button>
            </div>
            <section className="miuu-member-card">
              <PixelCat className="miuu-card-cat" />
              <p className="miuu-eyebrow">my loyalty card</p>
              <h1>{profile.customer.name}</h1>
              <div className="hub-row">
                <span className="rounded-lg border border-border bg-card px-3 py-2 font-mono text-sm">
                  {profile.customer.member_id}
                </span>
                <button
                  className="min-h-11 px-2 text-primary"
                  aria-label="Salin Member ID"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(profile.customer.member_id)
                      .then(() => setCopyNote("Member ID tersalin."))
                      .catch(() =>
                        setCopyNote("Salin Member ID yang tertera pada kartu."),
                      )
                  }
                >
                  <Copy size={17} />
                </button>
              </div>
              {code && (
                <div className="hub-row mt-3">
                  <span className="font-mono text-sm">
                    {shown ? code.toUpperCase() : "••••••••"}
                  </span>
                  <button
                    className="flex size-11 items-center justify-center text-primary"
                    aria-label={
                      shown ? "Sembunyikan kode akses" : "Lihat kode akses"
                    }
                    onClick={() => setShown(!shown)}
                  >
                    {shown ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              )}
              <p className="hub-muted mt-3">
                Bergabung {dateFmt(profile.customer.joined_at)}
              </p>
              {copyNote && (
                <p role="status" className="text-sm">
                  {copyNote}
                </p>
              )}
            </section>
            <section className="hub-card">
              <h2 className="hub-title">Your stamp card ♡</h2>
              <StampCard member={profile.customer} />
            </section>
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ["Pesanan", orders.length],
                ["Total belanja", moneyFmt(total)],
                [
                  "Garansi aktif",
                  warranties.filter((o) => dateDistance(warrantyEnd(o)) >= 0)
                    .length,
                ],
                [
                  "Voucher tersedia",
                  profile.vouchers.filter((v) => rewardState(v) === "available")
                    .length,
                ],
              ].map(([label, value]) => (
                <div className="hub-stat" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            {notice && (
              <p role="status" className="hub-error">
                {notice}
              </p>
            )}
            {error && !claim && (
              <p role="alert" className="hub-error">
                {error}
              </p>
            )}
            <section className="hub-card">
              <h2 className="hub-title">
                <ShieldCheck className="mr-2 inline size-5 text-primary" />
                My warranty cards
              </h2>
              {warranties.map((o) => {
                const ends = warrantyEnd(o),
                  days = dateDistance(ends),
                  existing = profile.claims.filter((c) => c.order_id === o.id),
                  pending = existing.some((c) =>
                    ["Baru", "Diproses"].includes(c.status),
                  );
                return (
                  <div className="hub-list-row" key={o.id}>
                    <div className="hub-row justify-between">
                      <strong>
                        {o.product_name} {o.variant}
                      </strong>
                      <span className="hub-pill">
                        {days < 0
                          ? "Berakhir"
                          : days <= 3
                            ? "Segera berakhir"
                            : "Aktif"}
                      </span>
                    </div>
                    <p className="hub-muted mt-1">
                      {invoice(o.invoice_seq)} · {dateFmt(o.order_date)} →{" "}
                      {dateFmt(ends)}
                    </p>
                    {days >= 0 && (
                      <p className="hub-muted">
                        {days === 0 ? "Berakhir hari ini" : `${days} hari lagi`}
                      </p>
                    )}
                    {existing.map((c) => (
                      <p
                        key={c.id}
                        className="mt-3 rounded-lg bg-secondary p-3 text-sm"
                      >
                        {c.message}
                        <br />
                        <span className="font-semibold text-primary">
                          Klaim: {c.status}
                        </span>
                      </p>
                    ))}
                    {days >= 0 && !pending && (
                      <div className="hub-actions">
                        <button
                          onClick={() => {
                            setClaim(o);
                            setMessage("");
                            setError("");
                          }}
                        >
                          Klaim garansi
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {!warranties.length && (
                <p className="hub-muted">
                  Kartu garansi akan muncul dari pesananmu.
                </p>
              )}
            </section>
            <section className="hub-card">
              <h2 className="hub-title">My rewards 🎁</h2>
              {profile.vouchers.map((v) => (
                <div className="hub-list-row" key={v.id}>
                  <div className="hub-row justify-between">
                    <strong className="font-mono">{v.code}</strong>
                    <span className="hub-pill">
                      {rewardStateText[rewardState(v)]}
                    </span>
                  </div>
                  <p className="hub-muted mt-2">
                    {v.label ||
                      (v.reward_type === "free_app"
                        ? "Gratis 1 aplikasi"
                        : `Diskon ${v.discount_pct}% · maksimal ${moneyFmt(v.max_amount)}`)}{" "}
                    · sekali pakai
                    <br />
                    {v.expires_at
                      ? "Berlaku sampai " + dateFmt(v.expires_at)
                      : "Tanpa tanggal kedaluwarsa"}
                    . Klaim hadiah melalui admin dengan kode ini.
                  </p>
                </div>
              ))}
              {!profile.vouchers.length && (
                <p className="hub-muted">
                  Kumpulkan {profile.customer.program !== "classic10" ? 4 : 10} stamp untuk hadiah pertamamu
                  ♡
                </p>
              )}
            </section>
            <section className="hub-card">
              <h2 className="hub-title">My order history</h2>
              {orders.map((o) => (
                <div className="hub-list-row" key={o.id}>
                  <div className="hub-row justify-between">
                    <strong>{invoice(o.invoice_seq)}</strong>
                    <span className={"status-pill status-" + o.status}>
                      {o.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">
                    {[o.product_name, o.variant, o.duration]
                      .filter(Boolean)
                      .join(" · ")}{" "}
                    ×{o.quantity}
                  </p>
                  <div className="hub-row mt-2 justify-between">
                    <span className="hub-muted">{dateFmt(o.order_date)}</span>
                    <strong className="text-sm text-primary">
                      {moneyFmt(o.price * o.quantity - o.refund_amount)}
                    </strong>
                  </div>
                  {o.public_note && (
                    <p className="hub-muted mt-2">{o.public_note}</p>
                  )}
                </div>
              ))}
              {!orders.length && (
                <p className="hub-muted">
                  Belum ada pesanan yang dihubungkan ke member ini.
                </p>
              )}
            </section>
            <details className="hub-card">
              <summary className="min-h-11 cursor-pointer font-semibold">
                Riwayat stamp
              </summary>
              {profile.logs.map((l) => (
                <p className="hub-muted border-t border-border py-3" key={l.id}>
                  {dateFmt(l.created_at)} ·{" "}
                  {l.delta !== 0 && (
                    <>
                      <b>
                        {l.delta > 0 ? "+" : ""}
                        {l.delta}
                      </b>{" "}
                      ·{" "}
                    </>
                  )}
                  {l.reason}
                </p>
              ))}
            </details>
          </div>
        )}
        <Dialog
          open={!!claim}
          onOpenChange={(open) => {
            if (!busy && !open) setClaim(null);
          }}
        >
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle>Klaim garansi</DialogTitle>
              <DialogDescription>
                {claim?.product_name} · {claim && invoice(claim.invoice_seq)}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => void submitClaim(e)}>
              <Field label="Ceritakan kendalanya">
                <textarea
                  required
                  maxLength={2000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </Field>
              {error && (
                <p className="hub-error" role="alert">
                  {error}
                </p>
              )}
              <button className="miuu-button" disabled={busy}>
                {busy ? "Mengirim…" : "Kirim klaim"}
              </button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </PublicShell>
  );
}
