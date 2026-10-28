// Isolated QA adapter. Runs the real Next build against disposable PostgreSQL data.
// It never connects to the user's Supabase project and is not a deployment entry point.
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import next from "next";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { netflixTemplate } from "../../lib/catalog.ts";
if (process.env.MIUU_QA_PREVIEW !== "1")
  throw new Error(
    "QA preview requires MIUU_QA_PREVIEW=1. Do not use this adapter for production.",
  );
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const args = process.argv.slice(2),
  port = Number(args[args.indexOf("--port") + 1] || 4173),
  host = "0.0.0.0";
process.env.NEXT_PUBLIC_SUPABASE_URL = `http://localhost:${port}/__qa/supabase`;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "qa-public";
const owner = "11111111-1111-4111-8111-111111111111";
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`create role service_role bypassrls;create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 insert into auth.users values('${owner}');`);
await db.exec(await readFile(path.join(root, "supabase/schema.sql"), "utf8"));
await db.query(
  "insert into public.shop_settings(owner_id,shop_name) values($1,$2)",
  [owner, "Miuu Store"],
);
for (const file of [
  "20261028000100_unified_store.sql",
  "20261028000200_import_orders.sql",
  "20261028000300_loyalty_programs.sql",
])
  await db.exec(
    await readFile(path.join(root, "supabase/migrations", file), "utf8"),
  );
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
await db.exec("set role authenticated");
const streaming = (
  await db.query(
    "insert into public.catalog_categories(name) values('Streaming') returning id",
  )
).rows[0].id;
const productivity = (
  await db.query(
    "insert into public.catalog_categories(name) values('Produktivitas') returning id",
  )
).rows[0].id;
await db.query(
  "insert into public.products(name,price,cost,is_published,category_id,description,variants,package_notes,terms) values($1,$2,2000,true,$3,$4,$5,$6,$7)",
  [
    netflixTemplate.name,
    netflixTemplate.price,
    streaming,
    netflixTemplate.description,
    JSON.stringify(netflixTemplate.variants),
    JSON.stringify(netflixTemplate.package_notes),
    netflixTemplate.terms,
  ],
);
await db.query(
  'insert into public.products(name,price,cost,is_published,available,category_id,description,variants) values(\'Canva · contoh uji\',10000,4000,true,true,$1,\'Data contoh untuk pengujian tampilan.\', \'[{"label":"Premium | 1 bulan","price":10000},{"label":"Premium | 3 bulan","price":25000}]\')',
  [productivity],
);
await db.exec(
  "update public.storefront_settings set footer_text='Pratinjau pengujian · data contoh. Harga Netflix mengikuti ketentuan yang diberikan.'",
);
await db.query(
  "select public.save_loyalty_member_v2(null,'Member Uji','MIU-QA','QACODE88','081234567890','miuu8')",
);
const mid = (
  await db.query(
    "select id from public.loyalty_members where member_id='MIU-QA'",
  )
).rows[0].id;
for (let i = 0; i < 3; i++)
  await db.query(
    "insert into public.orders(owner_id,tracking_code,buyer,buyer_wa,product_name,member_id,status,price,cost,payment_status,order_date,warranty_days) values($1,$2,'Member Uji','081234567890','Canva',$3,'Selesai',15000,5000,'Lunas',(now() at time zone 'Asia/Jakarta')::date,30)",
    [owner, "RO-" + String(i).padStart(20, "0"), mid],
  );
await db.exec("reset role");
let queue = Promise.resolve();
function serial(fn) {
  const operation = queue.then(fn);
  queue = operation.catch(() => {});
  return operation;
}
const tables = new Set([
  "store_admins",
  "orders",
  "products",
  "suppliers",
  "expenses",
  "buyer_notes",
  "shop_settings",
  "catalog_categories",
  "storefront_settings",
  "loyalty_members",
  "loyalty_vouchers",
  "loyalty_stamp_logs",
  "warranty_claims",
  "canva_teams",
  "canva_subscriptions",
  "canva_renewal_logs",
]);
const ident = (s) => {
  if (!/^[a-z_][a-z_0-9]*$/.test(s)) throw new Error("Invalid SQL identifier");
  return '"' + s + '"';
};
const send = (res, status, body, extra = {}) => {
  res.writeHead(status, { "content-type": "application/json", ...extra });
  res.end(
    JSON.stringify(body, (key, value) =>
      ["order_date", "date", "expires_at"].includes(key) &&
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T/.test(value)
        ? value.slice(0, 10)
        : value,
    ),
  );
};
async function body(req) {
  let s = "";
  for await (const part of req) s += part;
  if (s.length > 6 * 1024 * 1024) throw new Error("Too large");
  return s ? JSON.parse(s) : {};
}
async function api(req, res, url) {
  const part = url.pathname.slice("/__qa/supabase/".length),
    authorized = req.headers.authorization === "Bearer qa-admin";
  if (part.startsWith("auth/v1/")) {
    if (part.startsWith("auth/v1/token")) {
      const input = await body(req);
      if (
        (input.email === "qa@example.invalid" &&
          input.password === "qa-test-password") ||
        input.refresh_token === "qa-refresh"
      )
        return send(res, 200, {
          access_token: "qa-admin",
          refresh_token: "qa-refresh",
          expires_in: 3600,
          user: { id: owner, email: "qa@example.invalid" },
        });
      return send(res, 400, { msg: "Email atau password uji tidak sesuai." });
    }
    if (part === "auth/v1/user")
      return send(
        res,
        authorized ? 200 : 401,
        authorized
          ? { id: owner, email: "qa@example.invalid" }
          : { msg: "Unauthorized" },
      );
    if (part.startsWith("auth/v1/recover") || part === "auth/v1/logout")
      return send(res, 200, {});
    return send(res, 404, {});
  }
  if (!part.startsWith("rest/v1/")) return send(res, 404, {});
  const name = part.slice("rest/v1/".length),
    input = ["POST", "PATCH"].includes(req.method) ? await body(req) : {};
  return serial(async () => {
    try {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        authorized ? owner : "",
      ]);
      await db.exec("set role " + (authorized ? "authenticated" : "anon"));
      if (name.startsWith("rpc/")) {
        const fn = name.slice(4);
        ident(fn);
        const entries = Object.entries(input),
          params = entries.map(([, v]) =>
            typeof v === "object" && v !== null ? JSON.stringify(v) : v,
          );
        const result = await db.query(
          "select public." +
            ident(fn) +
            "(" +
            entries.map(([key], i) => ident(key) + "=> $" + (i + 1)).join(",") +
            ") as result",
          params,
        );
        return send(res, 200, result.rows[0]?.result ?? null);
      }
      if (!tables.has(name))
        return send(res, 404, { message: "Unknown table" });
      const params = [],
        where = [];
      for (const [key, value] of url.searchParams) {
        if (["select", "order", "on_conflict", "limit", "offset"].includes(key))
          continue;
        const at = value.indexOf("."),
          op = value.slice(0, at),
          v = value.slice(at + 1);
        if (op === "eq") {
          params.push(v);
          where.push(ident(key) + "=$" + params.length);
        } else if (op === "is" && v === "null")
          where.push(ident(key) + " is null");
        else throw new Error("Unsupported QA filter");
      }
      const filter = where.length ? " where " + where.join(" and ") : "";
      if (req.method === "GET") {
        const cols = url.searchParams.get("select") || "*",
          select = cols === "*" ? "*" : cols.split(",").map(ident).join(",");
        const order = url.searchParams.get("order"),
          ordering = order
            ? " order by " +
              order
                .split(",")
                .map((x) => {
                  const [field, direction] = x.split(".");
                  return (
                    ident(field) + (direction === "desc" ? " desc" : " asc")
                  );
                })
                .join(",")
            : "";
        return send(
          res,
          200,
          (
            await db.query(
              "select " +
                select +
                " from public." +
                ident(name) +
                filter +
                ordering,
              params,
            )
          ).rows,
        );
      }
      if (req.method === "DELETE") {
        await db.query("delete from public." + ident(name) + filter, params);
        return send(res, 200, null);
      }
      const entries = Object.entries(input),
        values = entries.map(([, v]) =>
          typeof v === "object" && v !== null ? JSON.stringify(v) : v,
        ),
        keys = entries.map(([key]) => ident(key));
      let sql;
      if (req.method === "POST") {
        sql =
          "insert into public." +
          ident(name) +
          "(" +
          keys.join(",") +
          ") values(" +
          keys.map((_, i) => "$" + (i + 1)).join(",") +
          ")";
        const conflict = url.searchParams.get("on_conflict");
        if (conflict)
          sql +=
            " on conflict(" +
            conflict.split(",").map(ident).join(",") +
            ") do update set " +
            keys.map((k) => k + "=excluded." + k).join(",");
        sql += " returning *";
      } else {
        const update = keys.map((k, i) => k + "=$" + (i + 1)).join(",");
        const shifted = filter.replace(
          /\$(\d+)/g,
          (_, n) => "$" + (Number(n) + values.length),
        );
        sql =
          "update public." +
          ident(name) +
          " set " +
          update +
          shifted +
          " returning *";
        values.push(...params);
      }
      const result = await db.query(sql, values);
      return send(
        res,
        200,
        req.headers.prefer?.includes("return=representation")
          ? result.rows
          : null,
      );
    } catch (error) {
      return send(res, 400, { message: error.message });
    } finally {
      await db.exec("reset role");
    }
  });
}
const app = next({ dev: false, dir: root, hostname: host, port });
await app.prepare();
const handle = app.getRequestHandler();
const upstreamFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const value =
    typeof input === "string"
      ? input
      : input instanceof Request
        ? input.url
        : input instanceof URL
          ? input.toString()
          : "";
  if (value.includes("/__qa/supabase/")) {
    const route = value.startsWith("/")
      ? value
      : new URL(value).pathname + new URL(value).search;
    const target = `http://localhost:${port}${route}`;
    return upstreamFetch(
      input instanceof Request ? new Request(target, input) : target,
      init,
    );
  }
  return upstreamFetch(input, init);
};
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname.startsWith("/__qa/supabase/"))
    return api(req, res, url).catch((e) =>
      send(res, 500, { message: e.message }),
    );
  if (url.pathname === "/__qa/workspace") {
    res.writeHead(200, { "content-type": "text/html;charset=utf-8" });
    return res.end(
      '<!doctype html><title>QA workspace fixture</title><p>Membuka ruang pengujian…</p><script>localStorage.setItem("ruang-order-supabase-session",JSON.stringify({access_token:"qa-admin",refresh_token:"qa-refresh",expires_at:Date.now()+3600000,user:{id:"11111111-1111-4111-8111-111111111111",email:"qa@example.invalid"}}));location.replace("/admin/dashboard");</script>',
    );
  }
  if (url.pathname === "/__qa/member") {
    return serial(async () => {
      await db.exec("reset role;set role anon");
      const result = (
        await db.query(
          "select public.login_loyalty_member('MIU-QA','QACODE88') as login",
        )
      ).rows[0].login;
      await db.exec("reset role");
      res.writeHead(302, {
        location: "/loyalty",
        "set-cookie": `miuu_member_session=${result.token}; HttpOnly; SameSite=Strict; Path=/api/loyalty; Max-Age=43200`,
      });
      res.end();
    });
  }
  if (url.pathname === "/__qa/mobile") {
    res.writeHead(200, { "content-type": "text/html;charset=utf-8" });
    return res.end(
      '<!doctype html><html><title>Miuu · QA 320px</title><body style="margin:0;background:#ddd;padding:20px"><p>Pengujian tampilan pada lebar 320 CSS px · data contoh</p><iframe title="Miuu pada layar 320 pixel" src="/" style="display:block;width:320px;height:1100px;border:0"></iframe></body></html>',
    );
  }
  return handle(req, res);
});
server.listen(port, host, () =>
  console.log(`QA preview http://${host}:${port} · disposable test data`),
);
