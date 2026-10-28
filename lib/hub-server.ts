import { restAll, filter, str, money } from "./supabase-server";
import { parseVariants, variantsText } from "./catalog";
import type { PriceVariant } from "./unified-types";

export const uuid = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function webUrl(value: unknown) {
  const text = str(value, 2000);
  if (!text) return "";
  try {
    const url = new URL(text);
    if (url.protocol === "https:" || url.protocol === "http:")
      return url.toString();
  } catch {}
  throw new Error("Gunakan tautan lengkap yang diawali https://.");
}
export async function requestBody(request: Request) {
  const text = await request.text();
  if (text.length > 100_000) throw new Error("Data formulir terlalu besar.");
  const body: unknown = JSON.parse(text);
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("Formulir tidak valid.");
  return body as Record<string, unknown>;
}
export function catalogValues(data: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const key of ["description", "terms"])
    if (key in data) result[key] = str(data[key], 5000);
  if ("image_url" in data) result.image_url = webUrl(data.image_url);
  if ("reference_url" in data)
    result.reference_url = webUrl(data.reference_url);
  if ("category_id" in data) {
    if (data.category_id && !uuid(data.category_id))
      throw new Error("Kategori tidak valid.");
    result.category_id = data.category_id || null;
  }
  for (const key of ["available", "is_published"])
    if (key in data) {
      if (typeof data[key] !== "boolean")
        throw new Error("Status produk tidak valid.");
      result[key] = data[key];
    }
  if ("sort_order" in data)
    result.sort_order = Math.min(money(data.sort_order), 100000);
  if ("variants" in data) {
    if (
      !Array.isArray(data.variants) ||
      data.variants.length > 100 ||
      data.variants.some(
        (v) =>
          !v ||
          typeof v.label !== "string" ||
          !Number.isSafeInteger(v.price) ||
          v.price < 0,
      )
    )
      throw new Error("Daftar varian tidak valid.");
    result.variants = parseVariants(
      variantsText(data.variants as PriceVariant[]),
    );
  }
  if ("package_notes" in data) {
    const notes = data.package_notes;
    if (
      !notes ||
      typeof notes !== "object" ||
      Array.isArray(notes) ||
      Object.keys(notes).length > 100
    )
      throw new Error("Catatan paket tidak valid.");
    result.package_notes = Object.fromEntries(
      Object.entries(notes).map(([key, value]) => [
        str(key, 160),
        str(value, 500),
      ]),
    );
  }
  return result;
}
export async function loadHub(owner: string, token: string) {
  const q = (table: string, order?: string, select = "*") =>
    restAll<unknown>(
      table +
        filter({
          owner_id: "eq." + owner,
          select,
          ...(order ? { order } : {}),
        }),
      token,
    );
  const [
    categories,
    storefront,
    members,
    vouchers,
    stampLogs,
    claims,
    canvaTeams,
    canvaSubscriptions,
    renewalLogs,
  ] = await Promise.all([
    q("catalog_categories", "sort_order.asc,name.asc"),
    q("storefront_settings"),
    q(
      "loyalty_members",
      "joined_at.desc",
      "id,member_id,name,phone,program,total_stamps,stamps,joined_at",
    ),
    q("loyalty_vouchers", "created_at.desc"),
    q("loyalty_stamp_logs", "created_at.desc"),
    q("warranty_claims", "created_at.desc"),
    q("canva_teams", "name.asc"),
    q("canva_subscriptions"),
    q("canva_renewal_logs", "created_at.desc"),
  ]);
  return {
    categories,
    storefront: storefront[0] || null,
    members,
    vouchers,
    stampLogs,
    claims,
    canvaTeams,
    canvaSubscriptions,
    renewalLogs,
  };
}
