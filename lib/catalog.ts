import type { PriceVariant } from "./unified-types";

export function parseVariants(text: string): PriceVariant[] {
  const lines = text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (lines.length > 100) throw new Error("Maksimal 100 varian per produk.");
  const labels = new Set<string>();
  return lines.map((line, i) => {
    const match = /^(.+?)\s*=\s*(?:Rp\s*)?([\d.,\s]+)$/i.exec(line);
    if (!match)
      throw new Error(`Baris ${i + 1}: gunakan Nama Paket | Durasi = Harga.`);
    const label = match[1].trim();
    if (
      !label ||
      label.length > 160 ||
      label.split("|").some((x) => !x.trim()) ||
      label.split("|").length > 2
    )
      throw new Error(`Label varian di baris ${i + 1} tidak valid.`);
    const amount = match[2].replace(/\s/g, "");
    if (!/^\d+$/.test(amount) && !/^\d{1,3}(?:[.,]\d{3})+$/.test(amount))
      throw new Error(
        `Harga baris ${i + 1} harus berupa rupiah bulat, misalnya 4000 atau 4.000.`,
      );
    const price = Number(amount.replace(/[.,]/g, ""));
    if (!Number.isSafeInteger(price) || price < 0 || price > 1e12)
      throw new Error(`Harga di baris ${i + 1} tidak valid.`);
    const key = label.toLocaleLowerCase("id");
    if (labels.has(key)) throw new Error(`Varian “${label}” ditulis dua kali.`);
    labels.add(key);
    return { label, price };
  });
}
export const variantsText = (variants: PriceVariant[] = []) =>
  variants.map((v) => `${v.label} = ${v.price}`).join("\n");
export function groupVariants(variants: PriceVariant[] = []) {
  const groups = new Map<string, { name: string; rows: PriceVariant[] }>();
  for (const variant of variants) {
    const [first, second] = variant.label.split("|").map((x) => x.trim());
    const name = second ? first : "";
    const key = name.toLocaleLowerCase("id");
    if (!groups.has(key)) groups.set(key, { name, rows: [] });
    groups
      .get(key)!
      .rows.push({ label: second || first, price: variant.price });
  }
  return [...groups.values()];
}
export function parsePackageNotes(text: string) {
  const result: Record<string, string> = Object.create(null);
  for (const line of text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)) {
    const at = line.indexOf("=");
    if (at < 1)
      throw new Error("Catatan paket: gunakan Nama Paket = Keterangan.");
    const key = line.slice(0, at).trim(),
      value = line.slice(at + 1).trim();
    if (key.length > 160 || value.length > 500)
      throw new Error("Catatan paket terlalu panjang.");
    result[key] = value;
  }
  return result;
}
export const minimumPrice = (product: {
  price: number;
  variants?: PriceVariant[];
}) =>
  product.variants?.length
    ? Math.min(...product.variants.map((v) => v.price))
    : product.price;
export const netflixTemplate = {
  name: "Netflix",
  price: 4000,
  description: "Pilih paket dan durasi sesuai kebutuhanmu.",
  variants: parseVariants(
    `Sharing 1P1U | 1 hari = 4000\nSharing 1P1U | 3 hari = 8000\nSharing 1P1U | 5 hari = 11000\nSharing 1P1U | 7 hari = 15000\nSharing 1P1U | 14 hari = 23000\nSharing 1P1U | 1 bulan = 41000\nSharing 1P1U | 2 bulan = 80000\nSharing 1P2U | 3 hari = 5000\nSharing 1P2U | 7 hari = 9000\nSharing 1P2U | 14 hari = 15000\nSharing 1P2U | 1 bulan = 23000\nSemiprivate | 7 hari = 20000\nSemiprivate | 1 bulan = 45000`,
  ),
  package_notes: {
    "Sharing 1P1U": "Jarang limit screen.",
    "Sharing 1P2U": "Lebih rawan limit screen.",
    Semiprivate: "Login 2 device, jarang limit screen.",
  },
  terms:
    "Tidak menerima komplain limit screen untuk Netflix 1P2U.\nTidak bisa refund.\nTidak bisa tukar plan.",
};
