import { NextRequest, NextResponse } from "next/server";
import { rest, str } from "@/lib/supabase-server";
import { requestBody, uuid } from "@/lib/hub-server";
import type { MemberProfile } from "@/lib/unified-types";
export const dynamic = "force-dynamic";
const cookie = "miuu_member_session";
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/loyalty",
  maxAge: 43200,
};
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(cookie)?.value;
    if (!token)
      return NextResponse.json(
        { error: "Masuk menggunakan Member ID dan kode akses." },
        { status: 401 },
      );
    const profile = await rest<MemberProfile | null>(
      "rpc/loyalty_member_profile",
      null,
      "POST",
      { p_token: token },
    );
    return profile
      ? NextResponse.json(profile, { headers: { "Cache-Control": "no-store" } })
      : NextResponse.json(
          { error: "Sesi member habis. Masuk kembali." },
          { status: 401 },
        );
  } catch {
    return NextResponse.json(
      { error: "Kartu member belum dapat dimuat." },
      { status: 503 },
    );
  }
}
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin"),
    host =
      request.headers.get("x-forwarded-host")?.split(",")[0].trim() ||
      request.headers.get("host") ||
      new URL(request.url).host;
  if (origin && new URL(origin).host !== host)
    return NextResponse.json(
      { error: "Permintaan tidak diizinkan." },
      { status: 403 },
    );
  try {
    const data = await requestBody(request),
      token = request.cookies.get(cookie)?.value || "";
    if (data.action === "login") {
      const result = await rest<{ token?: string; error?: string }>(
        "rpc/login_loyalty_member",
        null,
        "POST",
        { p_member_id: str(data.member_id, 40), p_code: str(data.code, 64) },
      );
      if (!result.token)
        return NextResponse.json(
          { error: result.error || "Login belum berhasil." },
          { status: 401 },
        );
      const response = NextResponse.json({ ok: true });
      response.cookies.set(cookie, result.token, cookieOptions);
      return response;
    }
    if (data.action === "logout") {
      if (token)
        await rest("rpc/logout_loyalty_member", null, "POST", {
          p_token: token,
        });
      const response = NextResponse.json({ ok: true });
      response.cookies.set(cookie, "", { ...cookieOptions, maxAge: 0 });
      return response;
    }
    if (data.action === "claim" && token && uuid(data.order_id)) {
      await rest("rpc/submit_warranty_claim", null, "POST", {
        p_token: token,
        p_order: data.order_id,
        p_message: str(data.message, 2000),
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { error: "Permintaan tidak valid. Masuk kembali bila sesi habis." },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Permintaan belum berhasil.",
      },
      { status: 400 },
    );
  }
}
