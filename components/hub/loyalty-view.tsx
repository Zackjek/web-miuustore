"use client";
import { useState, type FormEvent } from "react";
import type { Store, Order } from "../order-types";
import { invoice, dateFmt, moneyFmt } from "../order-types";
import { whatsappNumber } from "@/lib/date-tools";
import { authFetch } from "@/lib/browser-auth";
import { rewardState, rewardStateText } from "@/lib/loyalty";
import type { LoyaltyMember } from "@/lib/unified-types";
import { Field, useHub } from "./common";
import StampCard from "../stamp-card";
import { CuteKitten } from "../cute-art";
import { HeartPlus, Minus } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    crypto.getRandomValues(new Uint8Array(8)),
    (n) => chars[n % chars.length],
  ).join("");
}
export default function LoyaltyView({
  data,
  reload,
  openOrder,
}: {
  data: Store;
  reload: () => Promise<void>;
  openOrder: (values?: Partial<Order>) => void;
}) {
  const hub = useHub(reload),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState(data.members[0]?.id || "");
  const [editor, setEditor] = useState<LoyaltyMember | "new" | null>(null),
    [credentials, setCredentials] = useState("");
  const [reason, setReason] = useState("");
  const [stampNotice, setStampNotice] = useState("");
  const [stampPending, setStampPending] = useState<1 | -1 | null>(null);
  const member = data.members.find((m) => m.id === selected),
    members = data.members.filter((m) =>
      (m.name + " " + m.member_id).toLowerCase().includes(query.toLowerCase()),
    );
  async function showCode() {
    if (!member) return;
    try {
      const r = await authFetch("/api/hub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "member_code", id: member.id }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      const link =
        location.origin + "/loyalty?kode=" + encodeURIComponent(body.code);
      setCredentials(
        `Member ID: ${member.member_id}\nKode akses: ${body.code}\nKartu loyalty: ${link}`,
      );
    } catch (e) {
      setCredentials(
        e instanceof Error ? e.message : "Kode belum dapat dimuat.",
      );
    }
  }
  async function adjust(delta: 1 | -1) {
    if (!member || hub.busy) return;
    setStampPending(delta);
    const ok = await hub.run({ kind: "stamp", member_id: member.id, delta, reason }, "POST", delta > 0 ? "Stamp ditambahkan ♡" : "Stamp dikurangi");
    setStampPending(null);
    if (ok) {
      setReason("");
      setStampNotice(delta > 0 ? `Satu stamp ditambahkan untuk ${member.name}.` : `Satu stamp dikurangi untuk ${member.name}.`);
    }
  }
  return (
    <div className="space-y-5">
      <div className="hub-row justify-between">
        <label className="hub-field min-w-0 flex-1">
          Cari nama / Member ID
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <Button onClick={() => setEditor("new")}>+ Member baru</Button>
        <a
          href="/loyalty"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline"
        >
          Buka kartu member ↗
        </a>
      </div>
      {hub.error && (
        <p role="alert" className="hub-error">
          {hub.error}
        </p>
      )}
      {credentials && (
        <div className="hub-card">
          <p className="mb-2 text-sm font-semibold">
            Catat dan berikan kode akses ini kepada member.
          </p>
          <pre className="whitespace-pre-wrap rounded-lg bg-secondary p-3 text-sm">
            {credentials}
          </pre>
          <div className="hub-actions">
            <button
              onClick={() => void navigator.clipboard.writeText(credentials)}
            >
              Salin
            </button>
            <button onClick={() => setCredentials("")}>Sudah dicatat</button>
          </div>
        </div>
      )}
      <div className="hub-grid">
        <section className="hub-card">
          <h2 className="hub-title">Little members ♡</h2>
          {members.map((m) => (
            <button
              key={m.id}
              className={
                "hub-list-row miuu-member-picker flex w-full items-center justify-between gap-3 text-left " +
                (selected === m.id ? "text-primary" : "")
              }
              disabled={hub.busy}
              aria-pressed={selected === m.id}
              onClick={() => { setSelected(m.id); setReason(""); setStampNotice(""); }}
            >
              <span className="miuu-member-name">
                <span className="miuu-member-avatar"><CuteKitten /></span>
                <span><strong className="block text-sm">{m.name}</strong>
                <span className="hub-muted">{m.member_id}</span></span>
              </span>
              <span className="hub-pill">
                {m.stamps}/{m.program === "classic10" ? 10 : 8} ♡
              </span>
            </button>
          ))}
          {!members.length && (
            <p className="hub-muted">
              {query
                ? "Member tidak ditemukan."
                : "Member dibuat otomatis saat order Lunas minimal Rp15.000 dengan nomor WA yang valid. Kamu juga bisa membuat member secara manual."}
            </p>
          )}
        </section>
        {member ? (
          <section className="hub-card">
            <div className="hub-row justify-between">
              <div>
                <h2 className="hub-title mb-1">{member.name}</h2>
                <p className="hub-muted">
                  {member.member_id} · bergabung {dateFmt(member.joined_at)}
                </p>
              </div>
              <Button variant="outline" onClick={() => setEditor(member)}>
                Edit member / kode
              </Button>
            </div>
            <StampCard member={member} />
            <div className="hub-actions mb-4">
              <button onClick={() => void showCode()}>
                Lihat / salin kode & tautan kartu
              </button>
            </div>
            <Field label="Catatan stamp (opsional)">
              <input
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Contoh: pembelian langsung atau koreksi pesanan"
              />
            </Field>
            <div className="hub-actions">
              <button
                className="miuu-stamp-add"
                aria-busy={stampPending === 1}
                disabled={hub.busy}
                onClick={() => void adjust(1)}
              >
                {stampPending === 1 ? <span className="miuu-mini-spinner" aria-hidden="true" /> : <HeartPlus size={16} aria-hidden="true" />}
                {stampPending === 1 ? "Menyimpan stamp…" : "+ Add Stamp"}
              </button>
              <button
                aria-busy={stampPending === -1}
                disabled={
                  hub.busy ||
                  member.total_stamps === 0
                }
                onClick={() => void adjust(-1)}
              >
                <Minus size={14} aria-hidden="true" /> {stampPending === -1 ? "Menyimpan…" : "Kurangi stamp"}
              </button>
            </div>
            <p className="hub-muted mt-3">Catatan kosong dicatat otomatis sebagai penyesuaian admin.</p>
            {stampNotice && <p role="status" className="mt-3 text-sm text-primary">{stampNotice}</p>}
            <div className="my-5 border-t border-border pt-5">
              <Button
                onClick={() =>
                  openOrder({ buyer: member.name, member_id: member.id })
                }
              >
                + Order untuk member ini
              </Button>
            </div>
            <h3 className="mb-2 font-semibold">Pesanan & klaim garansi</h3>
            {data.orders
              .filter((o) => o.member_id === member.id)
              .map((o) => (
                <div className="hub-list-row" key={o.id}>
                  <div className="hub-row justify-between">
                    <strong className="text-sm">
                      {invoice(o.invoice_seq)} · {o.product_name}
                    </strong>
                    <span className={"status-pill status-" + o.status}>
                      {o.status}
                    </span>
                  </div>
                  <p className="hub-muted">
                    {moneyFmt(o.price * o.quantity - o.refund_amount)}
                  </p>
                  {data.claims
                    .filter((c) => c.order_id === o.id)
                    .map((c) => (
                      <div
                        key={c.id}
                        className="mt-3 rounded-lg border border-border p-3"
                      >
                        <p className="text-sm">{c.message}</p>
                        <label className="hub-field mt-3">
                          Status klaim
                          <select
                            disabled={hub.busy}
                            value={c.status}
                            onChange={(e) =>
                              void hub.run({
                                kind: "claim",
                                id: c.id,
                                status: e.target.value,
                              })
                            }
                          >
                            {["Baru", "Diproses", "Selesai", "Ditolak"].map(
                              (s) => (
                                <option key={s}>{s}</option>
                              ),
                            )}
                          </select>
                        </label>
                      </div>
                    ))}
                </div>
              ))}
            <h3 className="mb-2 mt-6 font-semibold">Reward & voucher</h3>
            {data.vouchers
              .filter((v) => v.member_id === member.id)
              .map((v) => (
                <div key={v.id} className="hub-list-row">
                  <strong className="text-sm">{v.label}</strong>
                  <p className="hub-muted font-mono">{v.code}</p>
                  <p className="hub-muted">
                    {v.expires_at
                      ? "Sampai " + dateFmt(v.expires_at)
                      : "Tanpa kedaluwarsa"}{" "}
                    · {rewardStateText[rewardState(v)]}
                  </p>
                  <div className="hub-actions">
                    {rewardState(v) === "available" && (
                      <button
                        disabled={hub.busy}
                        onClick={() => {
                          if (confirm("Tandai hadiah ini sudah digunakan?"))
                            void hub.run({ kind: "voucher", id: v.id });
                        }}
                      >
                        Tandai terpakai
                      </button>
                    )}
                    <button
                      disabled={hub.busy}
                      onClick={() => {
                        if (confirm("Ubah status reward ini?"))
                          void hub.run({
                            kind: "reward_status",
                            id: v.id,
                            status:
                              rewardState(v) === "available"
                                ? "revoked"
                                : "available",
                          });
                      }}
                    >
                      {rewardState(v) === "available"
                        ? "Batalkan hadiah"
                        : "Aktifkan / batal pakai"}
                    </button>
                    {rewardState(v) === "available" && (
                      <button
                        disabled={hub.busy}
                        onClick={() => {
                          if (confirm("Tandai reward kedaluwarsa?"))
                            void hub.run({
                              kind: "reward_status",
                              id: v.id,
                              status: "expired",
                            });
                        }}
                      >
                        Kedaluwarsa
                      </button>
                    )}
                  </div>
                </div>
              ))}
            <div className="hub-actions">
              {[
                ["discount", "+ Diskon manual"],
                ["free_app", "+ Gratis aplikasi manual"],
              ].map(([type, label]) => (
                <button
                  key={type}
                  disabled={hub.busy}
                  onClick={() => {
                    if (confirm("Berikan reward manual kepada member ini?"))
                      void hub.run({
                        kind: "reward_add",
                        member_id: member.id,
                        reward_type: type,
                      });
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <details className="mt-6">
              <summary className="min-h-11 cursor-pointer font-semibold">
                Riwayat stamp
              </summary>
              {data.stampLogs
                .filter((l) => l.member_id === member.id)
                .map((l) => (
                  <p
                    key={l.id}
                    className="hub-muted border-t border-border py-3"
                  >
                    {dateFmt(l.created_at)} ·{" "}
                    <b>
                      {l.delta > 0 ? "+" : ""}
                      {l.delta}
                    </b>{" "}
                    · {l.reason}
                  </p>
                ))}
            </details>
          </section>
        ) : (
          <div className="hub-card flex min-h-60 items-center justify-center">
            <p className="hub-muted text-center">
              Pilih member untuk melihat pesanan, garansi, dan voucher.
            </p>
          </div>
        )}
      </div>
      <Dialog
        open={!!editor}
        onOpenChange={(open) => !open && !hub.busy && setEditor(null)}
      >
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>
              {editor === "new" ? "Member baru" : "Edit member"}
            </DialogTitle>
            <DialogDescription>
              Kode diverifikasi dengan hash dan disimpan terenkripsi agar admin
              dapat mengirimkannya kembali. Kode baru menutup sesi member yang
              lama.
            </DialogDescription>
          </DialogHeader>
          {editor && (
            <MemberForm
              key={editor === "new" ? "new" : editor.id}
              member={editor === "new" ? undefined : editor}
              defaultProgram={data.storefront?.loyalty_program || "miuu8"}
              busy={hub.busy}
              save={async (v) => {
                const ok = await hub.run({
                  kind: "member",
                  ...v,
                  ...(editor !== "new" ? { id: editor.id } : {}),
                });
                if (ok) {
                  if (v.code)
                    setCredentials(
                      `Member ID: ${v.member_id.toUpperCase()}\nKode akses: ${v.code.toUpperCase()}`,
                    );
                  setEditor(null);
                }
              }}
            />
          )}{" "}
          {hub.error && (
            <p className="hub-error" role="alert">
              {hub.error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function MemberForm({
  member,
  defaultProgram,
  busy,
  save,
}: {
  member?: LoyaltyMember;
  defaultProgram: "miuu8" | "classic10";
  busy: boolean;
  save: (data: {
    name: string;
    member_id: string;
    code: string;
    phone: string;
    program: "miuu8" | "classic10";
  }) => Promise<void>;
}) {
  const [name, setName] = useState(member?.name || ""),
    [id, setId] = useState(
      member?.member_id || "MIU-" + randomCode().slice(0, 6),
    ),
    [code, setCode] = useState("");
  const [phone, setPhone] = useState(member?.phone || ""),
    [program, setProgram] = useState<"miuu8" | "classic10">(
      member?.program || defaultProgram,
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save({ name, member_id: id, code, phone, program });
      }}
    >
      <Field label="Nama member">
        <input
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Nomor WhatsApp (untuk stamp otomatis)">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </Field>
      <Field label="Program loyalty">
        <select
          disabled={!!member}
          value={program}
          onChange={(e) => setProgram(e.target.value as "miuu8" | "classic10")}
        >
          <option value="miuu8">8 stamp · lunas minimal Rp15.000</option>
          <option value="classic10">10 stamp · order selesai</option>
        </select>
      </Field>
      <Field label="Member ID unik">
        <input
          required
          pattern="[A-Za-z0-9-]{3,40}"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="MIU-NAMA"
        />
      </Field>
      <Field
        label={
          member ? "Kode akses baru (kosongkan untuk tetap)" : "Kode akses"
        }
      >
        <input
          pattern="[A-Za-z0-9-]{8,64}"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
        />
      </Field>
      <div className="hub-row mb-5">
        <Button
          type="button"
          variant="outline"
          onClick={() => setCode(randomCode())}
        >
          Acak kode akses
        </Button>
      </div>
      <Button disabled={busy}>{busy ? "Menyimpan…" : "Simpan member"}</Button>
    </form>
  );
}
