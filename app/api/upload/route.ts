import { verifiedOwner, unauthorized } from "@/lib/supabase-server";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const owner = await verifiedOwner(request);
    if (!owner) return unauthorized();
    if (Number(request.headers.get("content-length")) > 6 * 1024 * 1024)
      throw new Error("Ukuran gambar maksimal 5 MB.");
    const form = await request.formData(),
      file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 5242880)
      throw new Error("Pilih gambar dengan ukuran maksimal 5 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const signature = [...bytes.slice(0, 12)]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    const format = signature.startsWith("89504e470d0a1a0a")
      ? ["png", "image/png"]
      : signature.startsWith("ffd8ff")
        ? ["jpg", "image/jpeg"]
        : signature.startsWith("474946383761") ||
            signature.startsWith("474946383961")
          ? ["gif", "image/gif"]
          : signature.startsWith("52494646") &&
              signature.slice(16, 24) === "57454250"
            ? ["webp", "image/webp"]
            : null;
    if (!format) throw new Error("Gunakan gambar PNG, JPG, WebP, atau GIF.");
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, ""),
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!base || !key) throw new Error("Penyimpanan gambar belum diatur.");
    const path = owner.id + "/" + crypto.randomUUID() + "." + format[0];
    const response = await fetch(
      base + "/storage/v1/object/miuu-assets/" + path,
      {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: "Bearer " + owner.token,
          "Content-Type": format[1],
        },
        body: bytes,
      },
    );
    if (!response.ok)
      throw new Error(
        "Gambar belum tersimpan. Periksa koneksi lalu coba lagi.",
      );
    return Response.json({
      url: base + "/storage/v1/object/public/miuu-assets/" + path,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unggah gambar gagal.",
      },
      { status: 400 },
    );
  }
}
