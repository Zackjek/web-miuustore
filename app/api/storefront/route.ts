import { rest } from "@/lib/supabase-server";
import { isMiuuCatalog, MIUU_SLUG } from "@/lib/store-identity";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("toko");
  if (!isMiuuCatalog(slug))
    return Response.json({ error: "Toko tidak ditemukan." }, { status: 404 });
  try {
    const result = await rest<unknown>("rpc/public_storefront", null, "POST", {
      p_slug: MIUU_SLUG,
    });
    return result
      ? Response.json(result, { headers: { "Cache-Control": "no-store" } })
      : Response.json(
          { error: "Katalog belum dipublikasikan." },
          { status: 404 },
        );
  } catch {
    return Response.json(
      { error: "Katalog belum dapat dimuat. Coba lagi beberapa saat." },
      { status: 503 },
    );
  }
}
