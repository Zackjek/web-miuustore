import { test } from "node:test";
import assert from "node:assert/strict";
import { restAll } from "../lib/supabase-server";
test("all order records load even when the server caps each page below 1,000", async (t) => {
  const savedFetch = globalThis.fetch,
    savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
    savedKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  t.after(() => {
    globalThis.fetch = savedFetch;
    if (savedUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
    if (savedKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedKey;
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://qa.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "qa-public";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    const offset = Number(url.searchParams.get("offset"));
    const page = Array.from(
      { length: Math.min(200, 1001 - offset) },
      (_, i) => ({ id: offset + i }),
    );
    return new Response(JSON.stringify(page), {
      headers: {
        "content-type": "application/json",
        "content-range": `${offset}-${offset + page.length - 1}/1001`,
      },
    });
  };
  const rows = await restAll<{ id: number }>(
    "orders?owner_id=eq.qa",
    "qa-token",
  );
  assert.equal(rows.length, 1001);
  assert.equal(new Set(rows.map((r) => r.id)).size, 1001);
  assert.equal(rows.at(-1)?.id, 1000);
});
