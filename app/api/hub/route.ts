import {
  bad,
  failed,
  filter,
  money,
  rest,
  str,
  unauthorized,
  verifiedOwner,
} from "@/lib/supabase-server";
import { requestBody, uuid, webUrl } from "@/lib/hub-server";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const owner = await verifiedOwner(request);
    return owner
      ? Response.json(
          { ok: true },
          { headers: { "Cache-Control": "no-store" } },
        )
      : unauthorized();
  } catch (error) {
    return failed(error);
  }
}
async function mutate(request: Request) {
  try {
    const owner = await verifiedOwner(request);
    if (!owner) return unauthorized();
    const data = await requestBody(request),
      kind = str(data.kind, 40),
      token = owner.token;
    const id = uuid(data.id) ? String(data.id) : null;
    const rpc = (name: string, body: unknown) =>
      rest("rpc/" + name, token, "POST", body);
    if (kind === "category" || kind === "canva_team") {
      const name = str(data.name, kind === "category" ? 80 : 120);
      if (!name) return bad("Nama wajib diisi.");
      const table = kind === "category" ? "catalog_categories" : "canva_teams";
      const values =
        kind === "category"
          ? { name, sort_order: money(data.sort_order) }
          : { name, invite_url: webUrl(data.invite_url) };
      await rest(
        table +
          (id ? filter({ id: "eq." + id, owner_id: "eq." + owner.id }) : ""),
        token,
        id ? "PATCH" : "POST",
        { ...values, ...(!id ? { owner_id: owner.id } : {}) },
      );
    } else if (kind === "storefront") {
      const slug = str(data.slug, 40).toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(slug))
        return bad(
          "Alamat toko harus 2–40 huruf kecil, angka, atau tanda hubung.",
        );
      await rest(
        "storefront_settings?on_conflict=owner_id",
        token,
        "POST",
        {
          owner_id: owner.id,
          slug,
          shop_name: str(data.shop_name, 100) || "Miuu Store",
          tagline: str(data.tagline, 200),
          header_text: str(data.header_text, 1000),
          footer_text: str(data.footer_text, 1000),
          logo_url: webUrl(data.logo_url),
          is_public: data.is_public === true,
          voucher_valid_days: Math.min(money(data.voucher_valid_days), 3650),
          loyalty_program:
            data.loyalty_program === "classic10" ? "classic10" : "miuu8",
          discount_label: str(data.discount_label, 100) || "Voucher diskon",
          free_app_label: str(data.free_app_label, 100) || "Gratis 1 aplikasi",
          canva_invite_url: webUrl(data.canva_invite_url),
          updated_at: new Date().toISOString(),
        },
        "resolution=merge-duplicates",
      );
    } else if (kind === "member") {
      await rpc("save_loyalty_member_v2", {
        p_id: id,
        p_name: str(data.name, 120),
        p_member_id: str(data.member_id, 40),
        p_code: str(data.code, 64),
        p_phone: str(data.phone, 40),
        p_program: data.program === "classic10" ? "classic10" : "miuu8",
      });
    } else if (kind === "member_code") {
      if (!id) return bad("Member tidak valid.");
      const code = await rpc("get_loyalty_code", { p_id: id });
      return Response.json(
        { ok: true, code },
        { headers: { "Cache-Control": "no-store" } },
      );
    } else if (kind === "reward_status") {
      if (!id) return bad("Reward tidak valid.");
      await rpc("update_loyalty_reward", {
        p_id: id,
        p_status: str(data.status, 15),
      });
    } else if (kind === "reward_add") {
      if (!uuid(data.member_id)) return bad("Member tidak valid.");
      await rpc("add_loyalty_reward", {
        p_member: data.member_id,
        p_type: str(data.reward_type, 15),
      });
    } else if (kind === "stamp") {
      if (!uuid(data.member_id) || ![-1, 1].includes(Number(data.delta)))
        return bad("Koreksi stamp tidak valid.");
      await rpc("adjust_loyalty_stamp", {
        p_member: data.member_id,
        p_delta: Number(data.delta),
        p_reason: str(data.reason, 300),
      });
    } else if (kind === "voucher") {
      if (!id) return bad("Voucher tidak valid.");
      await rpc("use_loyalty_voucher", { p_id: id });
    } else if (kind === "claim") {
      if (
        !id ||
        !["Baru", "Diproses", "Selesai", "Ditolak"].includes(str(data.status))
      )
        return bad("Status klaim tidak valid.");
      await rest(
        "warranty_claims" +
          filter({ id: "eq." + id, owner_id: "eq." + owner.id }),
        token,
        "PATCH",
        { status: data.status },
      );
    } else if (kind === "canva") {
      if (!uuid(data.order_id) || (data.team_id && !uuid(data.team_id)))
        return bad("Pilih order dan tim yang valid.");
      await rpc("save_canva_subscription", {
        p_id: id,
        p_order_id: data.order_id,
        p_team_id: data.team_id || null,
        p_email: str(data.email, 254),
        p_months: Number(data.months),
      });
    } else if (kind === "canva_action") {
      if (!id || !Number.isInteger(data.renewal_index))
        return bad("Jadwal tidak valid.");
      await rpc("canva_renewal_action", {
        p_id: id,
        p_expected_index: data.renewal_index,
        p_action: str(data.action, 10),
      });
    } else return bad("Tindakan tidak dikenal.");
    return Response.json({ ok: true });
  } catch (error) {
    return failed(error);
  }
}
export const POST = mutate;
export const PATCH = mutate;
export async function DELETE(request: Request) {
  try {
    const owner = await verifiedOwner(request);
    if (!owner) return unauthorized();
    const data = await requestBody(request);
    const table = (
      {
        category: "catalog_categories",
        canva_team: "canva_teams",
        canva: "canva_subscriptions",
      } as Record<string, string>
    )[String(data.kind)];
    if (!table || !uuid(data.id)) return bad("Data tidak valid.");
    await rest(
      table + filter({ id: "eq." + data.id, owner_id: "eq." + owner.id }),
      owner.token,
      "DELETE",
    );
    return Response.json({ ok: true });
  } catch (error) {
    return failed(error);
  }
}
