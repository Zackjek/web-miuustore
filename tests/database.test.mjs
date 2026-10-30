import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const db = new PGlite({ extensions: { pgcrypto } });
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
let checks = 0;
async function check(name, fn) {
  await fn();
  checks++;
  console.log("PASS", name);
}
async function role(value, uid = "") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
  if (value) await db.exec("set role " + value);
}
async function scalar(sql, params = []) {
  const result = await db.query(sql, params);
  return Object.values(result.rows[0])[0];
}
async function denied(sql, params = []) {
  await assert.rejects(db.query(sql, params));
}
try {
  await db.exec(`create role service_role bypassrls;create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
    grant usage on schema storage to authenticated; grant all on storage.objects to authenticated;
    insert into auth.users values('${owner}'),('${other}');`);
  await db.exec(
    await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
  );
  await db.query(
    "insert into public.shop_settings(owner_id,shop_name) values($1,$2)",
    [owner, "Miuu Store"],
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261028000100_unified_store.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261028000200_import_orders.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261028000300_loyalty_programs.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261028000400_push_schema.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await role("authenticated", owner);
  await db.exec(
    "update public.storefront_settings set loyalty_program='classic10'",
  );
  await check("existing owner remains admin", async () =>
    assert.equal(await scalar("select public.is_store_admin()"), true),
  );
  await db.exec("update public.storefront_settings set shop_name='QA brand'");
  await check(
    "public branding and receipt branding stay synchronized",
    async () =>
      assert.equal(
        await scalar("select shop_name from public.shop_settings"),
        "QA brand",
      ),
  );
  await db.exec("update public.shop_settings set shop_name='Miuu Store'");
  await check(
    "workspace brand changes also update the public storefront",
    async () =>
      assert.equal(
        await scalar("select shop_name from public.storefront_settings"),
        "Miuu Store",
      ),
  );
  const category = await scalar(
    "insert into public.catalog_categories(name) values('Streaming') returning id",
  );
  const product = await scalar(
    `insert into public.products(name,price,cost,is_published,category_id,variants) values('Netflix',4000,2000,true,$1,'[{"label":"Sharing 1P1U | 1 hari","price":4000,"cost":2000,"supplier":"private QA"}]') returning id`,
    [category],
  );
  await db.exec(
    "insert into public.products(name,price,cost) values('Hidden product',99999,1)",
  );
  await check("invalid variant JSON is rejected by database", async () =>
    denied(
      "insert into public.products(name,variants) values('Broken','[{}]')",
    ),
  );
  const member = await scalar(
    "select public.save_loyalty_member(null,'QA Member','MIU-QA','TESTCODE88')",
  );
  const memberId = member.id;
  await check("admin cannot read access code hashes", async () =>
    denied("select code_hash from public.loyalty_members"),
  );
  const orderIds = [];
  for (let i = 0; i < 10; i++)
    orderIds.push(
      await scalar(
        `insert into public.orders(owner_id,tracking_code,buyer,product_name,member_id,status,price,cost,order_date,warranty_days)
    values($1,$2,'QA Member','Canva',$3,'Selesai',10000,2000,(now() at time zone 'Asia/Jakarta')::date,30) returning id`,
        [owner, "RO-" + String(i).padStart(20, "0"), memberId],
      ),
    );
  await check("ten completed orders issue exactly one voucher", async () => {
    assert.equal(
      Number(
        await scalar(
          "select count(*) from public.loyalty_vouchers where member_id=$1",
          [memberId],
        ),
      ),
      1,
    );
    assert.equal(
      await scalar("select stamps from public.loyalty_members where id=$1", [
        memberId,
      ]),
      0,
    );
  });
  await db.query("update public.orders set status='Diproses' where id=$1", [
    orderIds[0],
  ]);
  await db.query("update public.orders set status='Selesai' where id=$1", [
    orderIds[0],
  ]);
  await check("repeated completion cannot award a second stamp", async () =>
    assert.equal(
      Number(
        await scalar(
          "select count(*) from public.loyalty_stamp_logs where order_id=$1",
          [orderIds[0]],
        ),
      ),
      1,
    ),
  );
  await check("stamp correction requires a reason", async () =>
    denied("select public.adjust_loyalty_stamp($1,1,'')", [memberId]),
  );
  const voucher = await scalar(
    "select id from public.loyalty_vouchers where member_id=$1",
    [memberId],
  );
  await db.query("select public.use_loyalty_voucher($1)", [voucher]);
  await check("voucher cannot be redeemed twice", async () =>
    denied("select public.use_loyalty_voucher($1)", [voucher]),
  );
  await role("anon");
  await check(
    "anonymous users cannot read orders or edit products",
    async () => {
      await denied("select * from public.orders");
      await denied("update public.products set price=1 where id=$1", [product]);
    },
  );
  const catalog = await scalar("select public.public_storefront('miuu')");
  await check("catalog exposes published retail data only", async () => {
    assert.equal(catalog.products.length, 1);
    assert.equal(catalog.products[0].name, "Netflix");
    assert.equal(catalog.products[0].variants[0].cost, undefined);
    assert.equal(catalog.products[0].variants[0].supplier, undefined);
    for (const key of ["cost", "supplier", "owner_id", "buyer_wa"])
      assert.equal(key in catalog.products[0], false);
  });
  await check("invalid member credentials are rejected", async () => {
    const result = await scalar(
      "select public.login_loyalty_member('MIU-QA','WRONGCODE')",
    );
    assert.ok(result.error);
    assert.equal(result.token, undefined);
  });
  const login = await scalar(
    "select public.login_loyalty_member('MIU-QA','TESTCODE88')",
  );
  assert.ok(login.token);
  const profile = await scalar("select public.loyalty_member_profile($1)", [
    login.token,
  ]);
  await check("member receives only own public order fields", async () => {
    assert.equal(profile.orders.length, 10);
    assert.equal(profile.customer.code_hash, undefined);
    assert.equal(profile.orders[0].cost, undefined);
    assert.equal(profile.orders[0].notes, undefined);
  });
  await db.query("select public.submit_warranty_claim($1,$2,$3)", [
    login.token,
    orderIds[0],
    "QA warranty claim",
  ]);
  await check("duplicate open warranty claims are rejected", async () =>
    denied("select public.submit_warranty_claim($1,$2,$3)", [
      login.token,
      orderIds[0],
      "Duplicate claim",
    ]),
  );
  await check("anonymous calls cannot issue stamps", async () =>
    denied("select public.adjust_loyalty_stamp($1,1,'Unauthorized')", [
      memberId,
    ]),
  );
  await role("authenticated", other);
  await check("non-admin account has no workspace access", async () => {
    assert.equal(await scalar("select public.is_store_admin()"), false);
    assert.equal(Number(await scalar("select count(*) from public.orders")), 0);
    await denied("insert into public.suppliers(name) values('Unauthorized')");
    await denied(
      "select public.save_loyalty_member(null,'No','MIU-NO','TESTCODE88')",
    );
  });
  await role("authenticated", owner);
  const team = await scalar(
    "insert into public.canva_teams(name) values('QA Team') returning id",
  );
  await db.query(
    "update public.orders set order_date='2026-01-31' where id=$1",
    [orderIds[1]],
  );
  await db.query("select public.save_canva_subscription(null,$1,$2,$3,3)", [
    orderIds[1],
    team,
    "qa@example.invalid",
  ]);
  const subscription = await scalar(
    "select id from public.canva_subscriptions where order_id=$1",
    [orderIds[1]],
  );
  await check("calendar months clamp end of month correctly", async () =>
    assert.match(
      String(
        await scalar(
          "select rental_end_at::text from public.orders where id=$1",
          [orderIds[1]],
        ),
      ),
      /^2026-04-30/,
    ),
  );
  await db.query("select public.canva_renewal_action($1,1,'invite')", [
    subscription,
  ]);
  await check("stale renewal action cannot advance twice", async () =>
    denied("select public.canva_renewal_action($1,1,'invite')", [subscription]),
  );
  await role("anon");
  await db.query("select public.logout_loyalty_member($1)", [login.token]);
  await check("logout invalidates member session", async () =>
    assert.equal(
      await scalar("select public.loyalty_member_profile($1)", [login.token]),
      null,
    ),
  );
  await role("authenticated", owner);
  await db.exec(
    "update public.storefront_settings set loyalty_program='miuu8',voucher_valid_days=0",
  );
  const paid = [];
  for (let i = 0; i < 8; i++)
    paid.push(
      await scalar(
        "insert into public.orders(owner_id,tracking_code,buyer,buyer_wa,product_name,price,payment_status) values($1,$2,'Paid QA','081234567890','Canva',15000,'Lunas') returning id",
        [owner, "RO-" + String(100 + i).padStart(20, "0")],
      ),
    );
  const autoMember = await scalar(
    "select id from public.loyalty_members where phone='6281234567890'",
  );
  await check(
    "paid orders automatically create one member per WhatsApp",
    async () =>
      assert.equal(
        Number(
          await scalar(
            "select count(*) from public.loyalty_members where phone='6281234567890'",
          ),
        ),
        1,
      ),
  );
  await check(
    "stamp 4 grants discount and stamp 8 grants a free application",
    async () => {
      const rows = (
        await db.query(
          "select reward_type,earned_stamps,expires_at from public.loyalty_vouchers where member_id=$1 order by earned_stamps",
          [autoMember],
        )
      ).rows;
      assert.deepEqual(
        rows.map((r) => [r.reward_type, r.earned_stamps]),
        [
          ["discount", 4],
          ["free_app", 8],
        ],
      );
      assert.ok(rows.every((r) => r.expires_at === null));
      assert.equal(
        await scalar("select stamps from public.loyalty_members where id=$1", [
          autoMember,
        ]),
        8,
      );
    },
  );
  const accessCode = await scalar("select public.get_loyalty_code($1)", [
    autoMember,
  ]);
  assert.equal(accessCode.length, 8);
  await role("anon");
  await check(
    "private member codes cannot be retrieved anonymously",
    async () => denied("select public.get_loyalty_code($1)", [autoMember]),
  );
  const codeLogin = await scalar("select public.login_loyalty_member('',$1)", [
    accessCode,
  ]);
  await check("code-only customer card works", async () =>
    assert.ok(codeLogin.token),
  );
  await role("authenticated", owner);
  await db.query(
    "update public.orders set payment_status='Refund' where id=$1",
    [paid[7]],
  );
  await check(
    "refunding an eligible transaction retracts its stamp and unused milestone reward",
    async () => {
      assert.equal(
        await scalar("select stamps from public.loyalty_members where id=$1", [
          autoMember,
        ]),
        7,
      );
      assert.equal(
        await scalar(
          "select status from public.loyalty_vouchers where member_id=$1 and reward_type='free_app'",
          [autoMember],
        ),
        "revoked",
      );
    },
  );
  await db.query(
    "update public.orders set payment_status='Lunas' where id=$1",
    [paid[7]],
  );
  await check(
    "repaying restores the milestone without duplicating rewards",
    async () => {
      assert.equal(
        Number(
          await scalar(
            "select count(*) from public.loyalty_vouchers where member_id=$1",
            [autoMember],
          ),
        ),
        2,
      );
      assert.equal(
        await scalar("select stamps from public.loyalty_members where id=$1", [
          autoMember,
        ]),
        8,
      );
    },
  );
  const ninth = await scalar(
    "insert into public.orders(owner_id,tracking_code,buyer,buyer_wa,product_name,price,payment_status) values($1,'RO-00000000000000000999','Paid QA','081234567890','Canva',16000,'Lunas') returning id",
    [owner],
  );
  await check(
    "ninth paid transaction starts the next eight-stamp card",
    async () => {
      assert.equal(
        await scalar("select stamps from public.loyalty_members where id=$1", [
          autoMember,
        ]),
        1,
      );
      assert.equal(
        await scalar(
          "select total_stamps from public.loyalty_members where id=$1",
          [autoMember],
        ),
        9,
      );
    },
  );
  await db.query("delete from public.orders where id=$1", [ninth]);
  await check("deleted paid transaction retracts its credit", async () =>
    assert.equal(
      await scalar(
        "select total_stamps from public.loyalty_members where id=$1",
        [autoMember],
      ),
      8,
    ),
  );
  const cheap = await scalar(
    "insert into public.orders(owner_id,tracking_code,buyer,buyer_wa,product_name,price,payment_status) values($1,'RO-00000000000000000998','Paid QA','081234567890','Canva',14999,'Lunas') returning id",
    [owner],
  );
  await check("transactions below Rp15,000 do not earn stamps", async () =>
    assert.equal(
      await scalar(
        "select total_stamps from public.loyalty_members where id=$1",
        [autoMember],
      ),
      8,
    ),
  );
  const item = {
    source_key: "miuu-page:order:QA-1",
    buyer: "Imported",
    buyer_wa: "081333333333",
    product_name: "Spotify",
    price: 15000,
    cost: 0,
    quantity: 1,
    order_date: "2026-10-28",
    order_at: null,
    due_date: "",
    warranty_days: 0,
    rental_end_at: null,
    status: "Diproses",
    refund_amount: 0,
    payment_status: "Lunas",
  };
  await db.query("select public.import_miuu_orders($1,$2)", [
    JSON.stringify([item]),
    "[]",
  ]);
  await check("reimporting the same source skips duplicates", async () => {
    const result = await scalar("select public.import_miuu_orders($1,$2)", [
      JSON.stringify([item]),
      "[]",
    ]);
    assert.deepEqual(result, { imported: 0, skipped: 1 });
  });
  await check("a malformed import rolls back every inserted row", async () => {
    await denied("select public.import_miuu_orders($1,$2)", [
      JSON.stringify([
        { ...item, source_key: "rollback-good" },
        { ...item, source_key: "rollback-bad", price: -1 },
      ]),
      "[]",
    ]);
    assert.equal(
      Number(
        await scalar(
          "select count(*) from public.orders where source_key='rollback-good'",
        ),
      ),
      0,
    );
  });
  await check("ordinary admin cannot forge stamp logs", async () =>
    denied(
      "insert into public.loyalty_stamp_logs(owner_id,member_id,delta,reason) values($1,$2,100,'Forged')",
      [owner, autoMember],
    ),
  );
  await check("image upload policy rejects another owner folder", async () =>
    denied(
      "insert into storage.objects(bucket_id,name) values('miuu-assets',$1)",
      [other + "/test.png"],
    ),
  );
  await db.query(
    "select public.save_loyalty_member_v2($1,'Paid QA',(select member_id from public.loyalty_members where id=$1),'NEWCODE88','6281234567890','miuu8')",
    [autoMember],
  );
  await role("anon");
  await check(
    "resetting a code invalidates existing member sessions",
    async () =>
      assert.equal(
        await scalar("select public.loyalty_member_profile($1)", [
          codeLogin.token,
        ]),
        null,
      ),
  );
  await check("the previous code stops working after reset", async () =>
    assert.ok(
      (await scalar("select public.login_loyalty_member('',$1)", [accessCode]))
        .error,
    ),
  );
  // Test the upgrade using a second, previously approved store and an old session.
  await role("");
  await db.query("insert into public.store_admins(owner_id) values($1) on conflict do nothing", [other]);
  await role("authenticated", other);
  await db.query("insert into public.shop_settings(owner_id,shop_name) values($1,'Other shop') on conflict(owner_id) do update set shop_name='Other shop'", [other]);
  await db.query("insert into public.storefront_settings(owner_id,slug,shop_name) values($1,'other-shop','Other shop') on conflict(owner_id) do update set slug='other-shop'", [other]);
  await db.query("select public.save_loyalty_member_v2(null,'Other member','OTHER-QA','OTHERCODE88','','miuu8')");
  await db.query("insert into public.orders(owner_id,tracking_code,buyer,product_name,price) values($1,'RO-FFFFFFFFFFFFFFFFFFFF','Other buyer','Other product',10000)", [other]);
  await role("anon");
  const otherLogin = await scalar("select public.login_loyalty_member('OTHER-QA','OTHERCODE88')");
  assert.ok(otherLogin.token);
  await role("");
  const miuuOnlyMigration = await readFile(new URL("../supabase/migrations/20261030000100_miuu_only.sql", import.meta.url), "utf8");
  await db.exec(miuuOnlyMigration);
  await check("migration binds the existing canonical Miuu owner without deleting other data", async () => {
    assert.equal(await scalar("select owner_id from miuu_private.store_identity"), owner);
    assert.equal(Number(await scalar("select count(*) from public.orders where owner_id=$1", [other])), 1);
    assert.equal(await scalar("select is_public from public.storefront_settings where owner_id=$1", [other]), false);
  });
  await role("authenticated", owner);
  await check("only the Miuu owner can use the admin API", async () => {
    assert.equal(await scalar("select public.miuu_admin_owner()"), owner);
    assert.equal(await scalar("select public.is_store_admin()"), true);
  });
  await check("store name, slug and public access are fixed even through direct SQL", async () => {
    await denied("update public.storefront_settings set slug='another-shop'");
    await denied("update public.storefront_settings set shop_name='Another shop'");
    await denied("update public.storefront_settings set is_public=false");
    await denied("update public.shop_settings set shop_name='Another shop'");
    await denied("delete from public.storefront_settings");
    await denied("delete from public.shop_settings");
    await denied("insert into miuu_private.store_identity(owner_id) values($1)", [other]);
  });
  await check("existing Miuu products are published and new products default to public", async () => {
    assert.equal(Number(await scalar("select count(*) from public.products where not is_published")), 0);
    assert.equal(await scalar("insert into public.products(name,price) values('New Miuu product',20000) returning is_published"), true);
  });
  await db.query("update public.products set is_published=false where id=$1", [product]);
  await role("");
  await db.exec(miuuOnlyMigration);
  await check("rerunning the upgrade preserves an explicitly hidden product", async () => {
    assert.equal(await scalar("select is_published from public.products where id=$1", [product]), false);
    assert.equal(Number(await scalar("select count(*) from miuu_private.store_identity")), 1);
  });
  await role("authenticated", other);
  await check("a former store admin cannot manage or create another store", async () => {
    assert.equal(await scalar("select public.is_store_admin()"), false);
    assert.equal(await scalar("select public.miuu_admin_owner()"), null);
    assert.equal(Number(await scalar("select count(*) from public.store_admins")), 0);
    assert.equal(Number(await scalar("select count(*) from public.orders")), 0);
    await denied("insert into public.products(name,price) values('Unauthorized',1)");
    await denied("insert into public.storefront_settings(owner_id,slug) values($1,'new-shop')", [other]);
    await denied("select public.save_loyalty_member_v2(null,'New member','OTHER-NEW','NEWCODE88','','miuu8')");
  });
  await role("anon");
  await check("public catalog supports Miuu only and never exposes wholesale fields", async () => {
    assert.equal(await scalar("select public.public_storefront('other-shop')"), null);
    const miuuCatalog = await scalar("select public.public_storefront('miuu')");
    assert.equal(miuuCatalog.settings.shop_name, "Miuu Store");
    assert.equal(miuuCatalog.settings.slug, "miuu");
    assert.ok(miuuCatalog.products.length > 0);
    for (const p of miuuCatalog.products) {
      for (const key of ["cost", "supplier", "owner_id", "buyer_wa"]) assert.equal(key in p, false);
      for (const v of p.variants) {
        assert.equal("cost" in v, false);
        assert.equal("supplier" in v, false);
      }
    }
    assert.equal(miuuCatalog.products.some((p) => p.id === product), false);
  });
  await check("other stores' member credentials, old sessions and order links stop working", async () => {
    assert.ok((await scalar("select public.login_loyalty_member('OTHER-QA','OTHERCODE88')")).error);
    assert.ok((await scalar("select public.login_loyalty_member('','OTHERCODE88')")).error);
    assert.equal(await scalar("select public.loyalty_member_profile($1)", [otherLogin.token]), null);
    assert.equal(await scalar("select public.lookup_progress('RO-FFFFFFFFFFFFFFFFFFFF')"), null);
    assert.ok((await scalar("select public.login_loyalty_member('','NEWCODE88')")).token);
  });
  await check("scheduled reminders resolve only Miuu and the server-only resolver is private", async () => {
    await denied("select public.miuu_reminder_owner()");
    await role("authenticated", owner);
    await denied("select public.miuu_reminder_owner()");
    await role("service_role");
    assert.equal(await scalar("select public.miuu_reminder_owner()"), owner);
  });
  console.log(`Database checks passed: ${checks}`);
} finally {
  await db.close();
}
