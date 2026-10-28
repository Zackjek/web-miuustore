"use client";
import { useState } from "react";
import type { Order, Store } from "../order-types";
import { dateFmt, invoice, isoToday, moneyFmt } from "../order-types";
import type { CanvaSubscription, CanvaTeam } from "@/lib/unified-types";
import { canvaMessage, canvaPhase, whatsappNumber } from "@/lib/date-tools";
import { Field, useHub } from "./common";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
function usableLink(value: string) {
  try {
    return ["https:", "http:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
export default function CanvaView({
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
    [teamFilter, setTeamFilter] = useState("all"),
    [status, setStatus] = useState("all");
  const [editor, setEditor] = useState<CanvaSubscription | "new" | null>(null),
    [teamEditor, setTeamEditor] = useState<CanvaTeam | "new" | null>(null),
    [broadcast, setBroadcast] = useState(false),
    [note, setNote] = useState("");
  const rows = data.canvaSubscriptions.flatMap((s) => {
    const order = data.orders.find((o) => o.id === s.order_id);
    if (!order) return [];
    const team = data.canvaTeams.find((t) => t.id === s.team_id);
    const phase = canvaPhase(order.order_date, s.months, s.renewal_index);
    const sent = data.renewalLogs.some(
      (l) => l.subscription_id === s.id && l.renewal_index === s.renewal_index,
    );
    const link = team?.invite_url || data.storefront?.canva_invite_url || "";
    return [{ sub: s, order, team, phase, sent, link }];
  });
  const active = rows.filter(
      (r) => r.order.status !== "Dibatalkan" && r.phase.phase !== "ended",
    ),
    needed = active.filter((r) => r.phase.phase === "renew");
  const eligible = needed.filter(
    (r) => !r.sent && whatsappNumber(r.order.buyer_wa) && usableLink(r.link),
  );
  const filtered = rows
    .filter(
      (r) =>
        (
          r.order.buyer +
          " " +
          r.order.buyer_wa +
          " " +
          r.sub.email +
          " " +
          r.team?.name
        )
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (teamFilter === "all" || r.sub.team_id === teamFilter) &&
        (status === "all" ||
          (r.order.status === "Dibatalkan" ? "cancelled" : r.phase.phase) ===
            status),
    )
    .sort(
      (a, b) =>
        (({ renew: 0, active: 1, ended: 2 })[a.phase.phase] ?? 3) -
          ({ renew: 0, active: 1, ended: 2 }[b.phase.phase] ?? 3) ||
        (a.phase.days ?? 9999) - (b.phase.days ?? 9999),
    );
  async function action(sub: CanvaSubscription, action: string) {
    await hub.run({
      kind: "canva_action",
      id: sub.id,
      renewal_index: sub.renewal_index,
      action,
    });
  }
  function csv() {
    const esc = (x: unknown) =>
      '"' +
      String(x ?? "")
        .replace(/^[=+@-]/, "'$&")
        .replace(/"/g, '""') +
      '"';
    const text = [
      [
        "Invoice",
        "Buyer",
        "WhatsApp",
        "Email",
        "Tim",
        "Tanggal order",
        "Durasi bulan",
        "Berakhir",
        "Renewal berikutnya",
        "Pembayaran",
        "Harga",
      ],
      ...rows.map((r) => [
        invoice(r.order.invoice_seq),
        r.order.buyer,
        r.order.buyer_wa,
        r.sub.email,
        r.team?.name,
        r.order.order_date,
        r.sub.months,
        r.phase.end,
        r.phase.next,
        r.order.payment_status,
        r.order.price,
      ]),
    ]
      .map((r) => r.map(esc).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "canva-" + isoToday() + ".csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Customer aktif", active.length],
          ["Perlu renewal", needed.length],
          [
            "H-3 / H-1 / Hari H",
            [3, 1, 0]
              .map((n) => needed.filter((r) => r.phase.days === n).length)
              .join(" / "),
          ],
          [
            "Order berakhir",
            rows.filter((r) => r.phase.phase === "ended").length,
          ],
        ].map(([label, value]) => (
          <div className="hub-stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="hub-card">
        <div className="hub-row justify-between">
          <div>
            <h2 className="hub-title mb-1">Canva renewal desk ♡</h2>
            <p className="hub-muted">
              Jadwal mengikuti bulan kalender. Customer mulai perlu renewal
              sejak H-3 sampai ditandai sudah di-invite.
            </p>
          </div>
          <div className="hub-row">
            <Button
              variant="outline"
              onClick={() => openOrder({ product_name: "Canva" })}
            >
              + Order Canva baru
            </Button>
            <Button onClick={() => setEditor("new")}>
              Hubungkan order ke jadwal
            </Button>
          </div>
        </div>
        <div className="hub-actions">
          <button onClick={() => setTeamEditor("new")}>+ Tim baru</button>
          <button onClick={csv}>Ekspor CSV Canva</button>
          <button
            disabled={!eligible.length}
            onClick={() => setBroadcast(true)}
          >
            Siapkan pesan renewal ({eligible.length})
          </button>
        </div>
        <p className="hub-muted mt-3">
          Pesan dibuka di WhatsApp dan dikirim sendiri. Tandai “Sudah dikirim”
          setelah kamu benar-benar mengirimnya.
        </p>
      </div>
      {hub.error && (
        <p role="alert" className="hub-error">
          {hub.error}
        </p>
      )}
      {note && (
        <p role="status" className="hub-error">
          {note}
        </p>
      )}
      <div className="hub-card">
        <div className="hub-grid">
          <Field label="Cari buyer, WhatsApp, atau email">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
          <div className="hub-grid">
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">Semua status</option>
                <option value="active">Aktif</option>
                <option value="renew">Perlu renewal</option>
                <option value="ended">Berakhir</option>
                <option value="cancelled">Dibatalkan</option>
              </select>
            </Field>
            <Field label="Tim">
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
              >
                <option value="all">Semua tim</option>
                {data.canvaTeams.map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
        <div className="hub-row">
          {data.canvaTeams.map((t) => (
            <button
              className="hub-pill min-h-10"
              key={t.id}
              onClick={() => setTeamEditor(t)}
            >
              ✎ {t.name} · {rows.filter((r) => r.sub.team_id === t.id).length}{" "}
              customer
            </button>
          ))}
        </div>
      </div>
      <div className="hub-grid">
        {filtered.map(({ sub, order, team, phase, sent, link }) => (
          <article className="hub-card" key={sub.id}>
            <div className="hub-row justify-between">
              <h2 className="font-semibold">{order.buyer}</h2>
              <span className="hub-pill">
                {order.status === "Dibatalkan"
                  ? "Dibatalkan"
                  : phase.phase === "ended"
                    ? "Berakhir"
                    : phase.phase === "renew"
                      ? "Perlu renewal"
                      : "Aktif"}
              </span>
            </div>
            <p className="hub-muted mt-2">
              {sub.email}
              <br />
              {team?.name || "Belum memilih tim"} ·{" "}
              {order.buyer_wa || "WhatsApp belum diisi"}
              <br />
              {invoice(order.invoice_seq)} ·{" "}
              {moneyFmt(order.price * order.quantity)} ·{" "}
              {order.payment_status || "Belum Lunas"}
              <br />
              Order {dateFmt(order.order_date)} · {sub.months} bulan
              <br />
              Berakhir {dateFmt(phase.end)}
            </p>
            <div className="my-3 rounded-xl bg-secondary p-3 text-sm">
              {phase.next ? (
                <>
                  Renewal ke-{sub.renewal_index} dari {sub.months - 1}:{" "}
                  <b>{dateFmt(phase.next)}</b>
                  <br />
                  {phase.days! < 0
                    ? `Terlambat ${-phase.days!} hari`
                    : phase.days === 0
                      ? "Hari H"
                      : `H-${phase.days}`}
                </>
              ) : sub.months === 1 ? (
                "Order 1 bulan tidak membutuhkan invite ulang."
              ) : (
                "Semua renewal sudah di-invite ✓"
              )}
            </div>
            {sent && (
              <p className="hub-muted">
                ✓ Pesan untuk renewal ini sudah ditandai dikirim.
              </p>
            )}
            {order.status !== "Dibatalkan" &&
              phase.phase !== "ended" &&
              phase.next && (
                <div className="hub-actions">
                  <button
                    disabled={hub.busy}
                    onClick={() => {
                      if (
                        confirm(
                          "Tandai customer sudah di-invite untuk renewal ke-" +
                            sub.renewal_index +
                            "?",
                        )
                      )
                        void action(sub, "invite");
                    }}
                  >
                    ✓ Sudah invite
                  </button>
                  {whatsappNumber(order.buyer_wa) && usableLink(link) && (
                    <a
                      href={
                        "https://wa.me/" +
                        whatsappNumber(order.buyer_wa) +
                        "?text=" +
                        encodeURIComponent(
                          canvaMessage(team?.name || "Tim Canva", link),
                        )
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Buka WhatsApp ↗
                    </a>
                  )}
                  {!sent && (
                    <button
                      disabled={hub.busy}
                      onClick={() => {
                        if (confirm("Pesan renewal ini sudah kamu kirim?"))
                          void action(sub, "sent");
                      }}
                    >
                      Sudah dikirim
                    </button>
                  )}
                  <button
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(
                          canvaMessage(
                            team?.name || "Tim Canva",
                            link || "{link_invite_canva}",
                          ),
                        )
                        .then(() => setNote("Pesan renewal tersalin."))
                        .catch(() =>
                          setNote(
                            "Penyalinan belum berhasil. Gunakan tombol WhatsApp.",
                          ),
                        )
                    }
                  >
                    Salin pesan
                  </button>
                </div>
              )}
            <div className="hub-actions">
              {sub.renewal_index > 1 && (
                <button
                  disabled={hub.busy}
                  onClick={() => {
                    if (confirm("Batalkan penandaan invite terakhir?"))
                      void action(sub, "undo");
                  }}
                >
                  ↶ Undo invite
                </button>
              )}
              <button onClick={() => setEditor(sub)}>Edit jadwal</button>
              <button onClick={() => openOrder(order)}>Edit order</button>
              <button
                disabled={hub.busy}
                onClick={() => {
                  if (
                    confirm(
                      "Hapus jadwal Canva ini? Data order tetap disimpan.",
                    )
                  )
                    void hub.run({ kind: "canva", id: sub.id }, "DELETE");
                }}
              >
                Hapus jadwal
              </button>
            </div>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <div className="hub-card text-center">
          <p className="hub-muted">
            Belum ada jadwal yang sesuai. Buat order lalu hubungkan ke jadwal
            Canva.
          </p>
        </div>
      )}
      <details className="hub-card">
        <summary className="min-h-11 cursor-pointer font-semibold">
          Riwayat pesan renewal ({data.renewalLogs.length})
        </summary>
        {data.renewalLogs.map((log) => {
          const row = rows.find((r) => r.sub.id === log.subscription_id);
          return (
            <p className="hub-muted border-t border-border py-3" key={log.id}>
              {dateFmt(log.created_at)} · {row?.order.buyer || "Order Canva"} ·
              renewal ke-{log.renewal_index}
            </p>
          );
        })}
      </details>
      <Dialog
        open={!!editor}
        onOpenChange={(open) => !open && !hub.busy && setEditor(null)}
      >
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>
              {editor === "new" ? "Hubungkan order Canva" : "Edit jadwal Canva"}
            </DialogTitle>
            <DialogDescription>
              Pesanan dan keuangan tetap memakai data Orders. Tanggal akhir sewa
              akan mengikuti durasi Canva ini.
            </DialogDescription>
          </DialogHeader>
          {editor && (
            <CanvaForm
              key={editor === "new" ? "new" : editor.id}
              data={data}
              subscription={editor === "new" ? undefined : editor}
              busy={hub.busy}
              save={async (v) => {
                if (await hub.run({ kind: "canva", ...v })) setEditor(null);
              }}
            />
          )}{" "}
          {hub.error && (
            <p role="alert" className="hub-error">
              {hub.error}
            </p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!teamEditor}
        onOpenChange={(open) => !open && !hub.busy && setTeamEditor(null)}
      >
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Kelola tim Canva</DialogTitle>
            <DialogDescription>
              Nama tim dan tautan invite dipakai dalam pesan renewal.
            </DialogDescription>
          </DialogHeader>
          {teamEditor && (
            <TeamForm
              key={teamEditor === "new" ? "new" : teamEditor.id}
              team={teamEditor === "new" ? undefined : teamEditor}
              busy={hub.busy}
              save={async (v) => {
                if (await hub.run({ kind: "canva_team", ...v }))
                  setTeamEditor(null);
              }}
            />
          )}{" "}
          {teamEditor && teamEditor !== "new" && (
            <Button
              variant="outline"
              disabled={hub.busy}
              onClick={() => {
                if (confirm("Hapus tim ini? Pesanan dan jadwal tidak dihapus."))
                  void hub
                    .run({ kind: "canva_team", id: teamEditor.id }, "DELETE")
                    .then((ok) => {
                      if (ok) setTeamEditor(null);
                    });
              }}
            >
              Hapus tim
            </Button>
          )}
          {hub.error && (
            <p role="alert" className="hub-error">
              {hub.error}
            </p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={broadcast} onOpenChange={setBroadcast}>
        <DialogContent className="max-h-[85vh] overflow-y-auto bg-card sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Pesan renewal siap kirim</DialogTitle>
            <DialogDescription>
              {eligible.length} customer perlu renewal dan belum ditandai
              menerima pesan untuk jadwal ini. Kirim satu per satu dari
              WhatsApp.
            </DialogDescription>
          </DialogHeader>
          {eligible.map((r) => (
            <div className="hub-list-row" key={r.sub.id}>
              <strong>
                {r.order.buyer} · {r.team?.name}
              </strong>
              <pre className="my-3 whitespace-pre-wrap rounded-xl bg-secondary p-3 text-xs">
                {canvaMessage(r.team?.name || "Tim Canva", r.link)}
              </pre>
              <div className="hub-actions">
                <a
                  href={
                    "https://wa.me/" +
                    whatsappNumber(r.order.buyer_wa) +
                    "?text=" +
                    encodeURIComponent(
                      canvaMessage(r.team?.name || "Tim Canva", r.link),
                    )
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Buka WhatsApp ↗
                </a>
                <button
                  disabled={hub.busy}
                  onClick={() => {
                    if (
                      confirm(
                        "Pesan untuk " + r.order.buyer + " sudah dikirim?",
                      )
                    )
                      void action(r.sub, "sent");
                  }}
                >
                  Sudah dikirim
                </button>
              </div>
            </div>
          ))}
          {!eligible.length && (
            <p className="hub-muted">
              Semua pesan pada daftar ini sudah ditandai dikirim.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function CanvaForm({
  data,
  subscription,
  busy,
  save,
}: {
  data: Store;
  subscription?: CanvaSubscription;
  busy: boolean;
  save: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [orderId, setOrder] = useState(subscription?.order_id || ""),
    [team, setTeam] = useState(subscription?.team_id || ""),
    [email, setEmail] = useState(subscription?.email || ""),
    [months, setMonths] = useState(subscription?.months || 1);
  const orders = data.orders.filter(
      (o) =>
        o.id === subscription?.order_id ||
        (o.product_name.toLowerCase().includes("canva") &&
          o.status !== "Dibatalkan" &&
          !data.canvaSubscriptions.some((s) => s.order_id === o.id)),
    ),
    order = data.orders.find((o) => o.id === orderId);
  const phase = order
    ? canvaPhase(order.order_date, months, subscription?.renewal_index || 1)
    : null;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save({
          id: subscription?.id,
          order_id: orderId,
          team_id: team || null,
          email,
          months,
        });
      }}
    >
      <Field label="Pesanan Canva">
        <select
          required
          disabled={!!subscription}
          value={orderId}
          onChange={(e) => setOrder(e.target.value)}
        >
          <option value="">Pilih order</option>
          {orders.map((o) => (
            <option key={o.id} value={o.id}>
              {invoice(o.invoice_seq)} · {o.buyer} · {dateFmt(o.order_date)}
            </option>
          ))}
        </select>
      </Field>
      {!orders.length && (
        <p className="hub-muted mb-4">
          Buat order dengan nama produk Canva terlebih dahulu.
        </p>
      )}
      <Field label="Email customer">
        <input
          required
          type="email"
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="Tim Canva">
        <select required value={team} onChange={(e) => setTeam(e.target.value)}>
          <option value="">Pilih tim</option>
          {data.canvaTeams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Durasi order (bulan kalender)">
        <input
          required
          type="number"
          min={1}
          max={120}
          value={months}
          onChange={(e) =>
            setMonths(Math.max(1, Math.min(120, Number(e.target.value))))
          }
        />
      </Field>
      {phase && (
        <p className="hub-error">
          Berakhir {dateFmt(phase.end)} · {months - 1} jadwal invite ulang.
        </p>
      )}
      <Button disabled={busy || !orders.length}>Simpan jadwal</Button>
    </form>
  );
}
function TeamForm({
  team,
  busy,
  save,
}: {
  team?: CanvaTeam;
  busy: boolean;
  save: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(team?.name || ""),
    [url, setUrl] = useState(team?.invite_url || "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save({ id: team?.id, name, invite_url: url });
      }}
    >
      <Field label="Nama tim">
        <input
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Link invite tim (opsional)">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </Field>
      <Button disabled={busy}>Simpan tim</Button>
    </form>
  );
}
