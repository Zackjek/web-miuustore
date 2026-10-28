import { createHash } from "node:crypto";
import { addCalendarMonths, validDate } from "./date-tools";
type Row = Record<string, unknown>;
const object = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
const text = (value: unknown, length = 3000) =>
  String(value ?? "")
    .trim()
    .slice(0, length);
const money = (value: unknown) => {
  const number = Number(value || 0);
  if (!Number.isSafeInteger(number) || number < 0 || number > 1e12)
    throw new Error("Backup berisi nominal yang tidak valid.");
  return number;
};
const isUuid = (value: string) =>
  /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(value);
function iso(value: unknown) {
  let s = text(value, 40).replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += "T00:00";
  if (!s) return null;
  const parsed = new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(s) ? s : s + "+07:00");
  if (Number.isNaN(parsed.getTime()))
    throw new Error("Ada tanggal/jam yang tidak valid dalam backup.");
  return parsed.toISOString();
}
export function normalizeBackup(value: unknown) {
  const root = object(value),
    legacy = root.app === "miuu-page" || Array.isArray(value);
  const sourceOrders = Array.isArray(value) ? value : root.orders;
  if (!Array.isArray(sourceOrders) || sourceOrders.length > 5000)
    throw new Error(
      "Gunakan backup JSON Miuu Page atau backup order Miuu Store (maksimal 5.000 order).",
    );
  const canvas = Array.isArray(root.canva) ? root.canva : [];
  if (canvas.length + sourceOrders.length > 5000)
    throw new Error("Maksimal 5.000 order per impor.");
  let refunds = 0;
  const convert = (entry: unknown, canva = false) => {
    const r = object(entry),
      old = legacy || canva;
    const date = text(old ? r.tglOrder : r.order_date, 10);
    if (!validDate(date))
      throw new Error("Ada tanggal order yang tidak valid.");
    const buyer = text(old ? r.cust : r.buyer, 120),
      product = canva ? "Canva" : text(old ? r.app : r.product_name, 120);
    if (!buyer || !product)
      throw new Error("Setiap order wajib memiliki buyer dan nama aplikasi.");
    const rawPayment = text(old ? r.bayar : r.payment_status, 30).toLowerCase();
    const payment =
      (
        {
          belum: "Belum Lunas",
          "belum lunas": "Belum Lunas",
          lunas: "Lunas",
          batal: "Dibatalkan",
          dibatalkan: "Dibatalkan",
          refund: "Refund",
        } as Record<string, string>
      )[rawPayment] || "Belum Lunas";
    const status =
      text(r.status, 30) ||
      (payment === "Dibatalkan" ? "Dibatalkan" : "Diproses");
    if (payment === "Refund" && old) refunds++;
    const qty = old ? 1 : Number(r.quantity || 1);
    if (!Number.isInteger(qty) || qty < 1 || qty > 100000)
      throw new Error("Jumlah item dalam backup tidak valid.");
    const months = canva ? Number(r.durasi || 1) : 1;
    if (!Number.isInteger(months) || months < 1 || months > 120)
      throw new Error("Durasi Canva harus 1–120 bulan.");
    const source =
      text(r.id, 100) ||
      createHash("sha256").update(JSON.stringify(r)).digest("hex");
    const row: Row = {
      source_key:
        (old
          ? canva
            ? "miuu-page:canva:"
            : "miuu-page:order:"
          : "miuu-store:order:") + source,
      existing_id: !old && isUuid(text(r.id)) ? r.id : null,
      buyer,
      buyer_wa: text(old ? r.cust : r.buyer_wa, 40),
      product_name: product,
      variant: text(old ? r.jenis : r.variant, 120),
      duration: canva
        ? months + " bulan"
        : text(old ? r.durasi : r.duration, 80),
      price: money(old ? r.harga : r.price),
      cost: old ? 0 : money(r.cost),
      quantity: qty,
      supplier: text(r.supplier, 120),
      supplier_admin: text(r.supplier_admin, 120),
      device: text(r.device, 60),
      location: text(r.location, 90),
      order_date: date,
      order_at: old && !canva ? iso(r.tglOrder) : iso(r.order_at),
      due_date: validDate(text(r.due_date, 10)) ? text(r.due_date, 10) : "",
      warranty_days: old ? 0 : Math.min(money(r.warranty_days), 36500),
      rental_end_at: canva
        ? iso(addCalendarMonths(date, months) + "T23:59")
        : iso(old ? r.tglHabis : r.rental_end_at),
      notes: text(old ? r.akun : r.notes),
      public_note: text(r.public_note, 1000),
      refund_amount: old ? 0 : money(r.refund_amount),
      payment_status: ["Belum Lunas", "Lunas", "Dibatalkan", "Refund"].includes(
        payment,
      )
        ? payment
        : "Belum Lunas",
      status: [
        "Baru",
        "Diproses",
        "Menunggu",
        "Selesai",
        "Dibatalkan",
      ].includes(status)
        ? status
        : "Diproses",
    };
    if (canva) {
      const email = text(r.email, 254);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new Error("Ada email customer Canva yang tidak valid.");
      row.canva = {
        email,
        months,
        renewal_index: Math.max(1, Math.min(months, Number(r.renewIdx) || 1)),
        team: text(r.tim, 120) || "Tim Canva",
        invite_url: /^https?:\/\//.test(text(root.canvaLink))
          ? text(root.canvaLink, 2000)
          : "",
        old_id: text(r.id, 100),
      };
    }
    return row;
  };
  const rows = [
    ...sourceOrders.map((r) => convert(r)),
    ...canvas.map((r) => convert(r, true)),
  ];
  const unique = new Set(rows.map((r) => r.source_key));
  if (unique.size !== rows.length)
    throw new Error(
      "Backup memuat ID order ganda. Periksa berkas sebelum mengimpor.",
    );
  const logs = (Array.isArray(root.canvaLog) ? root.canvaLog : [])
    .slice(0, 10000)
    .map((l) => {
      const r = object(l);
      return {
        old_id: text(r.id, 100),
        index: Number(r.idx),
        created_at: iso(r.ts),
      };
    })
    .filter((l) => Number.isInteger(l.index) && l.index > 0 && l.created_at);
  return {
    rows,
    logs,
    summary: {
      orders: sourceOrders.length,
      canva: canvas.length,
      missingCosts: legacy ? rows.length : 0,
      refunds,
      note: "Impor menambah order dan jadwal Canva tanpa mengganti data yang ada. Produk, member, kode akses, dan pengaturan tidak diimpor dari berkas ini.",
    },
  };
}
