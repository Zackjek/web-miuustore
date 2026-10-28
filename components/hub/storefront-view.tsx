"use client";
import { useState, type FormEvent } from "react";
import type { Store } from "../order-types";
import type { Category } from "@/lib/unified-types";
import { storefrontDefaults } from "@/lib/unified-types";
import { Field, ImageUpload, useHub } from "./common";
import { Button } from "../ui/button";
export default function StorefrontView({
  data,
  reload,
  openProducts,
}: {
  data: Store;
  reload: () => Promise<void>;
  openProducts: () => void;
}) {
  const hub = useHub(reload),
    [v, setV] = useState({ ...(data.storefront || storefrontDefaults) });
  const [category, setCategory] = useState(""),
    [uploading, setUploading] = useState(false);
  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) =>
    setV((old) => ({ ...old, [key]: value }));
  async function save(e: FormEvent) {
    e.preventDefault();
    await hub.run({ kind: "storefront", ...v });
  }
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Total produk", data.products.length],
          ["Terpublikasi", data.products.filter((p) => p.is_published).length],
          [
            "Tersedia",
            data.products.filter((p) => p.is_published && p.available !== false)
              .length,
          ],
          ["Kategori", data.categories.length],
        ].map(([text, value]) => (
          <div className="hub-stat" key={text}>
            <span>{text}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="hub-row justify-between rounded-2xl border border-border bg-card p-4">
        <p className="hub-muted">
          Harga, foto, stok, dan varian memakai data Products yang sama.
        </p>
        <div className="hub-row">
          <Button variant="outline" onClick={openProducts}>
            Kelola produk
          </Button>
          <a
            className="miuu-button"
            href={"/?toko=" + encodeURIComponent(v.slug)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Lihat pricelist ↗
          </a>
        </div>
      </div>
      {hub.error && (
        <p role="alert" className="hub-error">
          {hub.error}
        </p>
      )}
      <div className="hub-grid">
        <section className="hub-card">
          <h2 className="hub-title">Identitas toko ♡</h2>
          <form onSubmit={(e) => void save(e)}>
            <Field label="Nama toko">
              <input
                required
                maxLength={100}
                value={v.shop_name}
                onChange={(e) => set("shop_name", e.target.value)}
              />
            </Field>
            <Field label="Alamat katalog">
              <input
                required
                pattern="[a-z0-9][a-z0-9-]{1,39}"
                value={v.slug}
                onChange={(e) => set("slug", e.target.value)}
              />
            </Field>
            <p className="hub-muted mb-4">
              Gunakan miuu untuk katalog pada halaman utama.
            </p>
            <Field label="Tagline">
              <input
                maxLength={200}
                value={v.tagline}
                onChange={(e) => set("tagline", e.target.value)}
              />
            </Field>
            <Field label="Teks di bawah nama toko">
              <textarea
                value={v.header_text}
                onChange={(e) => set("header_text", e.target.value)}
              />
            </Field>
            <Field label="Deskripsi footer">
              <textarea
                value={v.footer_text}
                onChange={(e) => set("footer_text", e.target.value)}
              />
            </Field>
            <ImageUpload
              label="Logo toko"
              value={v.logo_url}
              onChange={(url) => set("logo_url", url)}
              onBusy={setUploading}
            />
            <Field label="Program default member baru">
              <select
                value={v.loyalty_program}
                onChange={(e) =>
                  set(
                    "loyalty_program",
                    e.target.value as "miuu8" | "classic10",
                  )
                }
              >
                <option value="miuu8">
                  8 stamp · lunas minimal Rp15.000 · hadiah ke-4 & ke-8
                </option>
                <option value="classic10">
                  10 stamp · pesanan selesai · voucher 10%
                </option>
              </select>
            </Field>
            <p className="hub-muted mb-4">
              Program member lama tetap mengikuti program saat member dibuat.
            </p>
            <Field label="Nama hadiah stamp ke-4">
              <input
                maxLength={100}
                value={v.discount_label}
                onChange={(e) => set("discount_label", e.target.value)}
              />
            </Field>
            <Field label="Nama hadiah stamp ke-8">
              <input
                maxLength={100}
                value={v.free_app_label}
                onChange={(e) => set("free_app_label", e.target.value)}
              />
            </Field>
            <Field label="Masa berlaku reward baru (hari, 0 = tanpa kedaluwarsa)">
              <input
                type="number"
                min={0}
                max={3650}
                value={v.voucher_valid_days}
                onChange={(e) =>
                  set("voucher_valid_days", Number(e.target.value))
                }
              />
            </Field>
            <Field label="Link invite Canva cadangan (opsional)">
              <input
                type="url"
                value={v.canva_invite_url}
                onChange={(e) => set("canva_invite_url", e.target.value)}
              />
            </Field>
            <label className="mb-5 flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={v.is_public}
                onChange={(e) => set("is_public", e.target.checked)}
              />{" "}
              Katalog dapat dilihat publik
            </label>
            <Button disabled={hub.busy || uploading} className="min-h-11">
              Simpan pengaturan toko
            </Button>
          </form>
        </section>
        <section className="hub-card">
          <h2 className="hub-title">Kategori produk</h2>
          <form
            className="hub-row mb-5"
            onSubmit={(e) => {
              e.preventDefault();
              void hub.run({ kind: "category", name: category }).then((ok) => {
                if (ok) setCategory("");
              });
            }}
          >
            <label className="hub-field min-w-0 flex-1">
              Nama kategori
              <input
                required
                maxLength={80}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </label>
            <Button disabled={hub.busy} type="submit">
              Tambah
            </Button>
          </form>
          {data.categories.map((c) => (
            <CategoryRow
              key={c.id + c.name}
              category={c}
              busy={hub.busy}
              save={(name, sort_order) =>
                hub.run({ kind: "category", id: c.id, name, sort_order })
              }
              remove={() => {
                if (
                  confirm(
                    "Hapus kategori “" +
                      c.name +
                      "”? Produk tetap tersimpan tanpa kategori.",
                  )
                )
                  void hub.run(
                    { kind: "category", id: c.id },
                    "DELETE",
                    "Kategori dihapus",
                  );
              }}
            />
          ))}
          {!data.categories.length && (
            <p className="hub-muted">
              Tambahkan kategori seperti Streaming, Musik, atau Produktivitas.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
function CategoryRow({
  category,
  busy,
  save,
  remove,
}: {
  category: Category;
  busy: boolean;
  save: (name: string, sort: number) => Promise<boolean>;
  remove: () => void;
}) {
  const [name, setName] = useState(category.name),
    [sort, setSort] = useState(category.sort_order);
  return (
    <form
      className="hub-list-row"
      onSubmit={(e) => {
        e.preventDefault();
        void save(name, sort);
      }}
    >
      <div className="hub-grid">
        <Field label="Nama kategori">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Urutan">
          <input
            type="number"
            min={0}
            value={sort}
            onChange={(e) => setSort(Number(e.target.value))}
          />
        </Field>
      </div>
      <div className="hub-actions">
        <button disabled={busy}>Simpan</button>
        <button disabled={busy} type="button" onClick={remove}>
          Hapus kategori
        </button>
      </div>
    </form>
  );
}
