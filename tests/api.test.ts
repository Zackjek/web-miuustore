import { test } from "node:test";
import assert from "node:assert/strict";
import { POST as hub } from "../app/api/hub/route";
import { GET as catalog } from "../app/api/storefront/route";
import { PATCH as dataPatch } from "../app/api/data/route";

test("Miuu API enforces the bound admin and fixed identity, and records one-click stamp additions", async (t) => {
  const originalFetch = globalThis.fetch;
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = oldKey;
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://qa.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "qa-public";
  const owner = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  let currentUser = owner;
  const calls: { path: string; method: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ path: url.pathname, method: init?.method || "GET", body });
    let result: unknown = null;
    if (url.pathname === "/auth/v1/user") result = { id: currentUser };
    else if (url.pathname === "/rest/v1/rpc/miuu_admin_owner") result = currentUser === owner ? owner : null;
    else if (url.pathname === "/rest/v1/rpc/public_storefront") result = { settings: { shop_name: "Miuu Store" }, products: [] };
    else if (url.pathname === "/rest/v1/rpc/adjust_loyalty_stamp") result = true;
    return Response.json(result);
  };
  const post = (body: Record<string, unknown>) => hub(new Request("https://miuu.invalid/api/hub", {
    method: "POST", headers: { Authorization: "Bearer qa-token", "Content-Type": "application/json" }, body: JSON.stringify(body),
  }));
  assert.equal((await post({ kind: "stamp", member_id: other, delta: 1, reason: "" })).status, 200);
  const stamp = calls.find((c) => c.path.endsWith("/adjust_loyalty_stamp"))!;
  assert.equal(stamp.body.p_delta, 1);
  assert.equal(stamp.body.p_reason, "Penambahan stamp oleh admin Miuu");
  assert.equal((await post({ kind: "stamp", member_id: other, delta: 1, reason: "Pembelian offline" })).status, 200);
  assert.equal(calls.at(-1)!.body.p_reason, "Pembelian offline");
  const writes = () => calls.filter((c) => !c.path.includes("/auth/") && !c.path.endsWith("/miuu_admin_owner")).length;
  const before = writes();
  for (const values of [{ slug: "other-shop" }, { shop_name: "Other shop" }, { is_public: false }])
    assert.equal((await post({ kind: "storefront", ...values })).status, 400);
  assert.equal(writes(), before);
  const renamed = await dataPatch(new Request("https://miuu.invalid/api/data", {
    method: "PATCH", headers: { Authorization: "Bearer qa-token", "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "settings", shop_name: "Other shop" }),
  }));
  assert.equal(renamed.status, 400);
  const beforeCatalog = calls.length;
  assert.equal((await catalog(new Request("https://miuu.invalid/api/storefront?toko=other-shop"))).status, 404);
  assert.equal(calls.length, beforeCatalog);
  assert.equal((await catalog(new Request("https://miuu.invalid/api/storefront"))).status, 200);
  assert.equal(calls.at(-1)!.body.p_slug, "miuu");
  currentUser = other;
  const beforeUnauthorized = writes();
  assert.equal((await post({ kind: "publish_catalog" })).status, 403);
  assert.equal(writes(), beforeUnauthorized);
});
