"use client";
import { useState, type FormEvent } from "react";
import type { Product } from "../order-types";
import type { Category, PriceVariant } from "@/lib/unified-types";
import {
  parseVariants,
  variantsText,
  parsePackageNotes,
  netflixTemplate,
} from "@/lib/catalog";
import { Field, ImageUpload } from "./common";
import { ProductCard } from "../catalog";
import { Button } from "../ui/button";
export default function ProductEditor({
  initial,
  categories = [],
  onSubmit,
  pending,
}: {
  initial?: Product | null;
  categories?: Category[];
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  pending: boolean;
}) {
  const [v, setV] = useState({
    name: initial?.name || "",
    variant: initial?.variant || "",
    duration: initial?.duration || "",
    cost: initial?.cost || 0,
    price: initial?.price || 0,
    supplier: initial?.supplier || "",
    description: initial?.description || "",
    image_url: initial?.image_url || "",
    reference_url: initial?.reference_url || "",
    category_id: initial?.category_id || "",
    available: initial?.available !== false,
    is_published: initial?.is_published || false,
    sort_order: initial?.sort_order || 0,
    terms: initial?.terms || "",
  });
  const [variants, setVariants] = useState(variantsText(initial?.variants)),
    [notes, setNotes] = useState(
      Object.entries(initial?.package_notes || {})
        .map(([k, x]) => `${k} = ${x}`)
        .join("\n"),
    );
  const [error, setError] = useState(""),
    [uploading, setUploading] = useState(false);
  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) =>
    setV((old) => ({ ...old, [key]: value }));
  let parsed: PriceVariant[] = [];
  try {
    parsed = parseVariants(variants);
  } catch {}
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await onSubmit({
        ...v,
        category_id: v.category_id || null,
        variants: parseVariants(variants),
        package_notes: parsePackageNotes(notes),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Produk belum tersimpan.");
    }
  }
  function template() {
    setV((old) => ({
      ...old,
      name: old.name || netflixTemplate.name,
      price: initial?.id ? old.price : netflixTemplate.price,
      description: old.description || netflixTemplate.description,
      terms: netflixTemplate.terms,
    }));
    setVariants(variantsText(netflixTemplate.variants));
    setNotes(
      Object.entries(netflixTemplate.package_notes)
        .map(([k, x]) => `${k} = ${x}`)
        .join("\n"),
    );
  }
  return (
    <form
      onSubmit={(e) => void save(e)}
      className="max-h-[73vh] space-y-4 overflow-y-auto pr-1"
    >
      {(!initial?.id || initial.name.toLowerCase().includes("netflix")) && (
        <Button type="button" variant="outline" onClick={template}>
          Isi 13 varian Netflix dari ketentuan
        </Button>
      )}
      <Field label="Nama aplikasi / produk *">
        <input
          required
          maxLength={120}
          value={v.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </Field>
      <div className="hub-grid">
        <Field label="Tipe tunggal (opsional)">
          <input
            value={v.variant}
            onChange={(e) => set("variant", e.target.value)}
          />
        </Field>
        <Field label="Durasi tunggal (opsional)">
          <input
            value={v.duration}
            onChange={(e) => set("duration", e.target.value)}
          />
        </Field>
        <Field label="Modal / harga FH (Rp)">
          <input
            type="number"
            min={0}
            value={v.cost}
            onChange={(e) => set("cost", Number(e.target.value))}
          />
        </Field>
        <Field label="Harga utama (Rp)">
          <input
            required
            type="number"
            min={0}
            value={v.price}
            onChange={(e) => set("price", Number(e.target.value))}
          />
        </Field>
      </div>
      <Field label="FH / supplier">
        <input
          value={v.supplier}
          onChange={(e) => set("supplier", e.target.value)}
        />
      </Field>
      <section className="rounded-2xl border border-border bg-secondary/30 p-4">
        <h3 className="mb-4 font-semibold text-primary">
          Tampilan pricelist publik
        </h3>
        <div className="hub-row mb-4">
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={v.is_published}
              onChange={(e) => set("is_published", e.target.checked)}
            />{" "}
            Tampilkan di pricelist
          </label>
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={v.available}
              onChange={(e) => set("available", e.target.checked)}
            />{" "}
            Tersedia
          </label>
        </div>
        <div className="hub-grid">
          <Field label="Kategori">
            <select
              value={v.category_id}
              onChange={(e) => set("category_id", e.target.value)}
            >
              <option value="">Tanpa kategori</option>
              {categories.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Urutan tampil (angka kecil lebih dulu)">
            <input
              type="number"
              min={0}
              value={v.sort_order}
              onChange={(e) => set("sort_order", Number(e.target.value))}
            />
          </Field>
        </div>
        <ImageUpload
          value={v.image_url}
          onChange={(url) => set("image_url", url)}
          onBusy={setUploading}
        />
        <Field label="Deskripsi">
          <textarea
            maxLength={5000}
            value={v.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>
        <Field label="Daftar varian & harga">
          <textarea
            className="font-mono"
            rows={7}
            value={variants}
            onChange={(e) => setVariants(e.target.value)}
            placeholder={
              "Sharing 1P1U | 1 hari = 4000\nPrivate | 1 bulan = 45000\n\nTanpa kelompok: 1 bulan = 10000"
            }
          />
        </Field>
        <p className="hub-muted -mt-2 mb-4">
          Satu varian per baris. Nama paket bebas; gunakan | untuk memisahkan
          paket dan durasi. Kosongkan jika memakai satu harga.
        </p>
        <Field label="Keterangan tiap paket (opsional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Sharing 1P1U = Jarang limit screen."
          />
        </Field>
        <Field label="Tautan penjelasan produk (opsional)">
          <input
            type="url"
            value={v.reference_url}
            onChange={(e) => set("reference_url", e.target.value)}
            placeholder="https://…"
          />
        </Field>
        <Field label="Ketentuan produk">
          <textarea
            maxLength={5000}
            value={v.terms}
            onChange={(e) => set("terms", e.target.value)}
          />
        </Field>
        <details>
          <summary className="min-h-11 cursor-pointer text-sm font-semibold text-primary">
            Lihat pratinjau kartu produk
          </summary>
          <div className="miuu-public mt-3">
            <ProductCard
              product={{
                ...v,
                id: initial?.id || "preview",
                variants: parsed,
                package_notes: (() => {
                  try {
                    return parsePackageNotes(notes);
                  } catch {
                    return {};
                  }
                })(),
              }}
              category={categories.find((c) => c.id === v.category_id)?.name}
            />
          </div>
        </details>
      </section>
      {error && (
        <p role="alert" className="hub-error">
          {error}
        </p>
      )}
      <div className="sticky bottom-0 flex justify-end bg-card py-3">
        <Button
          disabled={pending || uploading}
          className="min-h-11 rounded-xl px-6"
        >
          {pending || uploading ? "Menyimpan…" : "Simpan produk"}
        </Button>
      </div>
    </form>
  );
}
