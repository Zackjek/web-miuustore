"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Heart,
  Sparkles,
  PackageOpen,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { PublicShell, PixelCat, PixelBunny } from "./public-shell";
import { groupVariants, minimumPrice } from "@/lib/catalog";
import { moneyFmt } from "./order-types";
import type {
  PublicProduct,
  Category,
  StorefrontSettings,
} from "@/lib/unified-types";
type CatalogData = {
  products: PublicProduct[];
  categories: Category[];
  settings: Pick<
    StorefrontSettings,
    "shop_name" | "tagline" | "header_text" | "footer_text" | "logo_url"
  >;
};
export function ProductCard({
  product,
  category,
}: {
  product: PublicProduct;
  category?: string;
}) {
  const groups = groupVariants(product.variants);
  return (
    <article
      className={
        "miuu-product " + (product.available === false ? "miuu-sold-out" : "")
      }
    >
      <div className="miuu-product-heading">
        <div className="miuu-product-image">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              width={64}
              height={64}
              loading="lazy"
            />
          ) : (
            <PixelCat className="size-10 text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="miuu-eyebrow">{category || "digital little things"}</p>
          <h2>{product.name}</h2>
          <p className="text-sm text-muted-foreground">
            {[product.variant, product.duration].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span
          className={
            "miuu-stock " + (product.available === false ? "is-empty" : "")
          }
        >
          <i />
          {product.available === false ? "Habis" : "Tersedia"}
        </span>
      </div>
      {product.description && (
        <p className="miuu-product-description">{product.description}</p>
      )}
      {groups.length ? (
        <div className="miuu-package-list">
          {groups.map((group) => (
            <section key={group.name} className="miuu-package">
              {group.name && (
                <h3>
                  <Heart size={13} aria-hidden="true" />
                  {group.name}
                </h3>
              )}
              {product.package_notes?.[group.name] && (
                <p className="miuu-package-note">
                  {product.package_notes[group.name]}
                </p>
              )}
              <dl>
                {group.rows.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{moneyFmt(row.price)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      ) : (
        <div className="miuu-single-price">
          <span>{product.duration || "Harga"}</span>
          <strong>{moneyFmt(product.price)}</strong>
        </div>
      )}
      {product.terms && (
        <details className="miuu-product-terms">
          <summary>
            Ketentuan produk <ChevronDown size={15} />
          </summary>
          <p>{product.terms}</p>
        </details>
      )}
      {product.reference_url && (
        <a
          className="inline-flex min-h-11 items-center text-xs font-semibold text-primary"
          href={product.reference_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Penjelasan paket ↗
        </a>
      )}
      <div className="miuu-card-footer" aria-hidden="true">
        ✧ a little treat for you ✧
      </div>
    </article>
  );
}
export default function Catalog() {
  const [data, setData] = useState<CatalogData | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [sort, setSort] = useState("default");
  async function load(signal?: AbortSignal) {
    setLoading(true);
    setError("");
    try {
      const slug = new URLSearchParams(location.search).get("toko");
      const response = await fetch(
        "/api/storefront" + (slug ? "?toko=" + encodeURIComponent(slug) : ""),
        { cache: "no-store", signal },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Katalog belum dapat dimuat.");
      setData(body);
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError"))
        setError(
          e instanceof Error ? e.message : "Katalog belum dapat dimuat.",
        );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, []);
  const products = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("id");
    const items = (data?.products || []).filter(
      (p) =>
        (category === "all" || p.category_id === category) &&
        (!search ||
          `${p.name} ${p.description || ""}`
            .toLocaleLowerCase("id")
            .includes(search)),
    );
    return sort === "default"
      ? items
      : [...items].sort(
          (a, b) =>
            (minimumPrice(a) - minimumPrice(b)) * (sort === "low" ? 1 : -1),
        );
  }, [data, query, category, sort]);
  const settings = data?.settings;
  return (
    <PublicShell shopName={settings?.shop_name} logo={settings?.logo_url}>
      <section className="miuu-hero">
        <div className="miuu-hero-sparkles" aria-hidden="true">
          <span>✧</span>
          <span>♡</span>
          <span>✦</span>
        </div>
        <div className="miuu-window-label">
          <span />
          <span />
          <span />
          <p>welcome to our little corner</p>
          <Sparkles size={15} />
        </div>
        <div className="miuu-hero-content">
          <PixelBunny className="miuu-hero-bunny" />
          <div className="miuu-hero-cat">
            <PixelCat />
          </div>
          <p className="miuu-eyebrow">digital favorites, lovely prices</p>
          <h1>
            {settings?.shop_name || "Miuu Store"}
            <span>✦</span>
          </h1>
          <p className="miuu-typewriter">
            {settings?.tagline || "a little happiness, in every order ♡"}
          </p>
          <p className="miuu-hero-subtitle">
            {settings?.header_text ||
              "Temukan aplikasi favorit dan paket yang pas untukmu."}
          </p>
          <div className="miuu-hero-tags">
            <span>✿ Pilih paket favoritmu</span>
            <span>♡ Cek harga tanpa login</span>
          </div>
        </div>
      </section>
      <section
        className="miuu-catalog-section"
        aria-label="Daftar harga produk"
      >
        <div className="miuu-section-title">
          <div>
            <p className="miuu-eyebrow">the little shelf</p>
            <h2>
              Our digital picks <Heart size={22} />
            </h2>
          </div>
          <span>dibuat untuk harimu yang lebih mudah ♡</span>
        </div>
        <div className="miuu-catalog-tools">
          <label className="miuu-search">
            <Search size={19} />
            <input
              type="search"
              placeholder="Cari aplikasi favoritmu…"
              aria-label="Cari nama atau deskripsi produk"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="miuu-sort">
            <span className="sr-only">Urutkan produk</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="default">Urutan toko</option>
              <option value="low">Harga termurah</option>
              <option value="high">Harga termahal</option>
            </select>
          </label>
        </div>
        <div
          className="miuu-category-list"
          role="group"
          aria-label="Filter kategori"
        >
          <button
            type="button"
            aria-pressed={category === "all"}
            onClick={() => setCategory("all")}
          >
            ✦ Semua
          </button>
          {data?.categories.map((c) => (
            <button
              type="button"
              key={c.id}
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
        {!loading && !error && (
          <p role="status" className="miuu-results-count">
            {products.length} produk {query ? `untuk “${query}”` : "untuk kamu"}
          </p>
        )}
        {loading ? (
          <div
            className="miuu-catalog-grid"
            role="status"
            aria-label="Memuat katalog"
          >
            {[0, 1, 2].map((i) => (
              <div key={i} className="miuu-product miuu-skeleton">
                <div />
                <div />
                <div />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="miuu-empty" role="alert">
            <PackageOpen size={36} />
            <h3>Katalog belum tersedia</h3>
            <p>{error}</p>
            <button className="miuu-button" onClick={() => void load()}>
              <RefreshCw size={16} /> Coba lagi
            </button>
          </div>
        ) : products.length ? (
          <div className="miuu-catalog-grid">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                category={
                  data?.categories.find((c) => c.id === p.category_id)?.name
                }
              />
            ))}
          </div>
        ) : (
          <div className="miuu-empty">
            <PixelCat className="size-14 text-primary" />
            <h3>
              {data?.products.length
                ? "Belum ketemu, nih"
                : "Rak kecil ini sedang disiapkan"}
            </h3>
            <p>
              {data?.products.length
                ? "Coba kata kunci atau kategori lain, ya."
                : "Daftar harga akan muncul setelah produk dipublikasikan."}
            </p>
            {(query || category !== "all") && (
              <button
                className="miuu-button"
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                }}
              >
                Lihat semua produk
              </button>
            )}
          </div>
        )}
        {settings?.footer_text && (
          <p className="miuu-store-note">{settings.footer_text}</p>
        )}
      </section>
    </PublicShell>
  );
}
