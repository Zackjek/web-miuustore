export const MIUU_NAME = "Miuu Store";
export const MIUU_SLUG = "miuu";

export function isMiuuCatalog(slug: string | null) {
  return slug === null || slug === MIUU_SLUG;
}

export function assertMiuuIdentity(values: Record<string, unknown>) {
  if (
    ("slug" in values && values.slug !== MIUU_SLUG) ||
    ("shop_name" in values && values.shop_name !== MIUU_NAME) ||
    ("is_public" in values && values.is_public !== true)
  )
    throw new Error("Website ini khusus Miuu Store. Identitas dan alamat toko tidak dapat diganti.");
}
