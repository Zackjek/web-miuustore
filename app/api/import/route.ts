import {
  bad,
  failed,
  rest,
  unauthorized,
  verifiedOwner,
} from "@/lib/supabase-server";
import { normalizeBackup } from "@/lib/import-backup";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const owner = await verifiedOwner(request);
    if (!owner) return unauthorized();
    const raw = await request.text();
    if (raw.length > 5_242_880) return bad("Ukuran backup maksimal 5 MB.");
    const body = JSON.parse(raw),
      normalized = normalizeBackup(body.data);
    if (body.preview === true) return Response.json(normalized.summary);
    if (body.confirm !== true)
      return bad("Pratinjau dan konfirmasi impor terlebih dahulu.");
    const result = await rest("rpc/import_miuu_orders", owner.token, "POST", {
      p_rows: normalized.rows,
      p_logs: normalized.logs,
    });
    return Response.json({ ok: true, result });
  } catch (error) {
    return failed(error);
  }
}
