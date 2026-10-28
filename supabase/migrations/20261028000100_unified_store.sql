-- Jalankan SETELAH schema.sql (hanya untuk instalasi baru).
-- Untuk database Miuu Store yang sudah digunakan, jalankan file migrasi ini saja.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists miuu_private;
revoke all on schema miuu_private from public, anon, authenticated;

create table if not exists public.store_admins (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.store_admins enable row level security;
revoke all on public.store_admins from anon, authenticated;
grant select on public.store_admins to authenticated;
drop policy if exists "admin reads own membership" on public.store_admins;
create policy "admin reads own membership" on public.store_admins for select to authenticated using (owner_id = (select auth.uid()));
-- Pertahankan pengelola yang sudah memiliki data. Akun baru tidak otomatis menjadi admin.
insert into public.store_admins(owner_id)
select owner_id from public.orders union select owner_id from public.products
union select owner_id from public.shop_settings union select owner_id from public.suppliers
union select owner_id from public.expenses union select owner_id from public.buyer_notes
on conflict do nothing;
create or replace function public.is_store_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.store_admins where owner_id = (select auth.uid()));
$$;
revoke all on function public.is_store_admin() from public, anon;
grant execute on function public.is_store_admin() to authenticated;

create table if not exists public.catalog_categories (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check(length(trim(name)) between 1 and 80), sort_order integer not null default 0,
  unique(owner_id,name)
);
create table if not exists public.storefront_settings (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  slug text not null unique check(slug ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  shop_name text not null default 'Miuu Store', tagline text not null default 'a little happiness, in every order ♡',
  header_text text not null default 'Temukan aplikasi favorit dan paket yang pas untukmu.',
  footer_text text not null default 'Terima kasih sudah mendukung toko kecil kami. ♡', logo_url text not null default '',
  is_public boolean not null default true, voucher_valid_days integer not null default 30 check(voucher_valid_days between 1 and 3650),
  canva_invite_url text not null default '', updated_at timestamptz not null default now()
);
insert into public.storefront_settings(owner_id,slug,shop_name)
select a.owner_id, case when (select count(*) from public.store_admins)=1 then 'miuu' else 'miuu-'||left(a.owner_id::text,8) end,coalesce(s.shop_name,'Miuu Store')
from public.store_admins a left join public.shop_settings s on s.owner_id=a.owner_id on conflict(owner_id) do nothing;

alter table public.products add column if not exists description text not null default '';
alter table public.products add column if not exists image_url text not null default '';
alter table public.products add column if not exists reference_url text not null default '';
alter table public.products add column if not exists category_id uuid references public.catalog_categories(id) on delete set null;
alter table public.products add column if not exists available boolean not null default true;
alter table public.products add column if not exists is_published boolean not null default false;
alter table public.products add column if not exists variants jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists package_notes jsonb not null default '{}'::jsonb;
alter table public.products add column if not exists terms text not null default '';

create or replace function miuu_private.check_product() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.store_admins where owner_id=auth.uid()) or new.owner_id is distinct from auth.uid() then
    raise exception 'Hanya admin toko yang dapat mengubah produk.';
  end if;
  if new.category_id is not null and not exists(select 1 from public.catalog_categories where id=new.category_id and owner_id=new.owner_id) then
    raise exception 'Kategori tidak ditemukan pada toko ini.';
  end if;
  if jsonb_typeof(new.variants)<>'array' or jsonb_array_length(new.variants)>100 or jsonb_typeof(new.package_notes)<>'object' then
    raise exception 'Format varian tidak valid.';
  end if;
  if exists(select 1 from jsonb_array_elements(new.variants) v where jsonb_typeof(v)<>'object'
    or jsonb_typeof(v->'label') is distinct from 'string' or length(trim(v->>'label')) not between 1 and 160
    or jsonb_typeof(v->'price') is distinct from 'number' or coalesce(v->>'price','') !~ '^[0-9]{1,13}$'
    or (v->>'price')::numeric>1000000000000) then raise exception 'Format harga varian tidak valid.'; end if;
  return new;
end;
$$;
drop trigger if exists check_catalog_product on public.products;
create trigger check_catalog_product before insert or update on public.products for each row execute function miuu_private.check_product();

create table if not exists public.loyalty_members (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  member_id text not null unique check(member_id ~ '^[A-Z0-9-]{3,40}$'), name text not null check(length(trim(name)) between 1 and 120),
  code_hash text not null, stamps integer not null default 0 check(stamps between 0 and 9), joined_at timestamptz not null default now()
);
create or replace function miuu_private.sync_shop_name() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='shop_settings' then
   update public.storefront_settings set shop_name=new.shop_name where owner_id=new.owner_id and shop_name is distinct from new.shop_name;
 else
   insert into public.shop_settings(owner_id,shop_name) values(new.owner_id,new.shop_name)
   on conflict(owner_id) do update set shop_name=excluded.shop_name where public.shop_settings.shop_name is distinct from excluded.shop_name;
 end if;
 return new;
end;
$$;
drop trigger if exists sync_storefront_name on public.storefront_settings;
create trigger sync_storefront_name after insert or update of shop_name on public.storefront_settings for each row execute function miuu_private.sync_shop_name();
drop trigger if exists sync_workspace_name on public.shop_settings;
create trigger sync_workspace_name after insert or update of shop_name on public.shop_settings for each row execute function miuu_private.sync_shop_name();
alter table public.orders add column if not exists member_id uuid references public.loyalty_members(id) on delete set null;
alter table public.orders add column if not exists payment_status text not null default 'Belum Lunas' check(payment_status in ('Belum Lunas','Lunas','Dibatalkan','Refund'));
alter table public.orders add column if not exists order_at timestamptz;
alter table public.orders add column if not exists source_key text;
create unique index if not exists idx_orders_import_source on public.orders(owner_id,source_key) where source_key is not null;
create table if not exists public.loyalty_vouchers (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid not null references public.loyalty_members(id) on delete cascade,
  code text not null unique, discount_pct integer not null default 10, max_amount bigint not null default 15000,
  expires_at date not null, used_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.loyalty_stamp_logs (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid not null references public.loyalty_members(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null, delta integer not null,
  reason text not null, created_at timestamptz not null default now()
);
create unique index if not exists idx_one_stamp_per_order on public.loyalty_stamp_logs(order_id) where order_id is not null;
create table if not exists public.warranty_claims (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid not null references public.loyalty_members(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  message text not null check(length(trim(message)) between 1 and 2000),
  status text not null default 'Baru' check(status in ('Baru','Diproses','Selesai','Ditolak')), created_at timestamptz not null default now()
);
create unique index if not exists idx_one_open_claim on public.warranty_claims(order_id) where status in ('Baru','Diproses');
create table if not exists miuu_private.member_sessions (
  token_hash text primary key, member_id uuid not null references public.loyalty_members(id) on delete cascade,
  expires_at timestamptz not null default now()+interval '12 hours'
);
create table if not exists miuu_private.login_limits (
  key text primary key, attempts integer not null default 0, started_at timestamptz not null default now()
);
-- pgcrypto dapat sudah terpasang di schema public atau extensions pada project lama.
do $outer$
declare ns text;
begin
  select n.nspname into ns from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto';
  execute format($ddl$create or replace function miuu_private.code_hash(p_code text,p_hash text default null) returns text
    language sql volatile set search_path = '' as $f$select %1$I.crypt(upper(trim(p_code)),coalesce(p_hash,%1$I.gen_salt('bf',10)))$f$$ddl$,ns);
end;
$outer$;

create or replace function public.save_loyalty_member(p_id uuid,p_name text,p_member_id text,p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.loyalty_members; h text;
begin
  if not public.is_store_admin() then raise exception 'Akses admin diperlukan.'; end if;
  if length(trim(p_name)) not between 1 and 120 or upper(trim(p_member_id)) !~ '^[A-Z0-9-]{3,40}$' then raise exception 'Nama atau Member ID tidak valid.'; end if;
  if p_id is not null then
    select * into m from public.loyalty_members where id=p_id and owner_id=auth.uid() for update;
    if not found then raise exception 'Member tidak ditemukan.'; end if;
    h=m.code_hash;
  end if;
  if coalesce(p_code,'')<>'' then
    if p_code !~ '^[A-Za-z0-9-]{8,64}$' then raise exception 'Kode akses harus 8–64 huruf, angka, atau tanda hubung.'; end if;
    h=miuu_private.code_hash(p_code);
  end if;
  if h is null then raise exception 'Kode akses wajib diisi untuk member baru.'; end if;
  if p_id is null then
    insert into public.loyalty_members(owner_id,name,member_id,code_hash) values(auth.uid(),trim(p_name),upper(trim(p_member_id)),h) returning * into m;
  else
    update public.loyalty_members set name=trim(p_name),member_id=upper(trim(p_member_id)),code_hash=h where id=p_id returning * into m;
    if coalesce(p_code,'')<>'' then delete from miuu_private.member_sessions where member_id=p_id; end if;
  end if;
  return jsonb_build_object('id',m.id,'name',m.name,'member_id',m.member_id,'stamps',m.stamps,'joined_at',m.joined_at);
end;
$$;

create or replace function miuu_private.apply_stamp(p_member uuid,p_delta integer,p_reason text,p_order uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.loyalty_members; balance integer; code text; validity integer;
begin
  select * into m from public.loyalty_members where id=p_member for update;
  if not found then raise exception 'Member tidak ditemukan.'; end if;
  if p_order is not null and exists(select 1 from public.loyalty_stamp_logs where order_id=p_order) then return; end if;
  balance=m.stamps+p_delta;
  if balance<0 then raise exception 'Stamp tidak dapat kurang dari nol.'; end if;
  insert into public.loyalty_stamp_logs(owner_id,member_id,order_id,delta,reason) values(m.owner_id,m.id,p_order,p_delta,p_reason);
  select coalesce(s.voucher_valid_days,30) into validity from public.storefront_settings s where s.owner_id=m.owner_id;
  while balance>=10 loop
    code='MIU-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
    insert into public.loyalty_vouchers(owner_id,member_id,code,expires_at)
      values(m.owner_id,m.id,code,(now() at time zone 'Asia/Jakarta')::date+coalesce(validity,30));
    insert into public.loyalty_stamp_logs(owner_id,member_id,delta,reason) values(m.owner_id,m.id,-10,'Ditukar otomatis menjadi voucher '||code);
    balance=balance-10;
  end loop;
  update public.loyalty_members set stamps=balance where id=m.id;
end;
$$;
create or replace function miuu_private.stamp_order() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.member_id is not null and not exists(select 1 from public.loyalty_members where id=new.member_id and owner_id=new.owner_id) then raise exception 'Member berasal dari toko lain.'; end if;
  if tg_op='UPDATE' and old.member_id is distinct from new.member_id and exists(select 1 from public.loyalty_stamp_logs where order_id=new.id) then
    raise exception 'Member pada order yang sudah mendapat stamp tidak dapat diganti.';
  end if;
  if new.status='Selesai' and new.member_id is not null then
    perform miuu_private.apply_stamp(new.member_id,1,'Pesanan INV-'||lpad(new.invoice_seq::text,5,'0')||' selesai',new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists loyalty_order_stamp on public.orders;
create trigger loyalty_order_stamp after insert or update of status,member_id on public.orders for each row execute function miuu_private.stamp_order();
create or replace function public.adjust_loyalty_stamp(p_member uuid,p_delta integer,p_reason text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_store_admin() or not exists(select 1 from public.loyalty_members where id=p_member and owner_id=auth.uid()) then raise exception 'Member tidak ditemukan.'; end if;
  if p_delta not in (-1,1) or length(trim(p_reason)) not between 3 and 300 then raise exception 'Koreksi hanya +1/−1 dan wajib menyertakan alasan.'; end if;
  perform miuu_private.apply_stamp(p_member,p_delta,trim(p_reason)); return true;
end;
$$;
create or replace function public.use_loyalty_voucher(p_id uuid) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_store_admin() then raise exception 'Akses admin diperlukan.'; end if;
  update public.loyalty_vouchers set used_at=now() where id=p_id and owner_id=auth.uid() and used_at is null and expires_at>=(now() at time zone 'Asia/Jakarta')::date;
  if not found then raise exception 'Voucher sudah terpakai, kedaluwarsa, atau tidak ditemukan.'; end if;
  return true;
end;
$$;

create or replace function public.login_loyalty_member(p_member_id text,p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.loyalty_members; k text; n integer; token text;
begin
  if length(coalesce(p_member_id,''))>40 or length(coalesce(p_code,''))>64 then return jsonb_build_object('error','Member ID atau kode akses tidak sesuai.'); end if;
  k=encode(sha256(convert_to(upper(trim(coalesce(p_member_id,''))),'UTF8')),'hex');
  insert into miuu_private.login_limits(key) values(k) on conflict do nothing;
  select attempts into n from miuu_private.login_limits where key=k for update;
  update miuu_private.login_limits set attempts=0,started_at=now() where key=k and started_at<now()-interval '15 minutes';
  select attempts into n from miuu_private.login_limits where key=k;
  if n>=5 then return jsonb_build_object('error','Terlalu banyak percobaan. Coba lagi dalam 15 menit.'); end if;
  select * into m from public.loyalty_members where member_id=upper(trim(p_member_id));
  if m.id is null or m.code_hash is distinct from miuu_private.code_hash(coalesce(p_code,''),m.code_hash) then
    update miuu_private.login_limits set attempts=attempts+1 where key=k;
    return jsonb_build_object('error','Member ID atau kode akses tidak sesuai.');
  end if;
  delete from miuu_private.login_limits where key=k;
  delete from miuu_private.member_sessions where expires_at<now();
  delete from miuu_private.login_limits where started_at<now()-interval '1 day';
  token=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  insert into miuu_private.member_sessions(token_hash,member_id) values(encode(sha256(convert_to(token,'UTF8')),'hex'),m.id);
  return jsonb_build_object('token',token);
end;
$$;
create or replace function miuu_private.session_member(p_token text) returns uuid language sql stable security definer set search_path = '' as $$
  select member_id from miuu_private.member_sessions where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and expires_at>now();
$$;
create or replace function public.loyalty_member_profile(p_token text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare mid uuid; m public.loyalty_members;
begin
  mid=miuu_private.session_member(p_token);
  if mid is null then return null; end if;
  select * into m from public.loyalty_members where id=mid;
  return jsonb_build_object('customer',jsonb_build_object('id',m.id,'member_id',m.member_id,'name',m.name,'stamps',m.stamps,'joined_at',m.joined_at),
    'orders',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'invoice_seq',o.invoice_seq,'product_name',o.product_name,'variant',o.variant,'duration',o.duration,
      'price',o.price,'quantity',o.quantity,'refund_amount',o.refund_amount,'order_date',o.order_date,'due_date',o.due_date,'warranty_days',o.warranty_days,
      'rental_end_at',o.rental_end_at,'status',o.status,'public_note',o.public_note) order by o.created_at desc) from public.orders o where o.member_id=mid),'[]'::jsonb),
    'vouchers',coalesce((select jsonb_agg(to_jsonb(v)-'owner_id' order by v.created_at desc) from public.loyalty_vouchers v where v.member_id=mid),'[]'::jsonb),
    'claims',coalesce((select jsonb_agg(to_jsonb(c)-'owner_id' order by c.created_at desc) from public.warranty_claims c where c.member_id=mid),'[]'::jsonb),
    'logs',coalesce((select jsonb_agg(to_jsonb(l)-'owner_id' order by l.created_at desc) from public.loyalty_stamp_logs l where l.member_id=mid),'[]'::jsonb));
end;
$$;
create or replace function public.logout_loyalty_member(p_token text) returns boolean language plpgsql security definer set search_path = '' as $$
begin delete from miuu_private.member_sessions where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex'); return true; end;
$$;
create or replace function public.submit_warranty_claim(p_token text,p_order uuid,p_message text) returns boolean language plpgsql security definer set search_path = '' as $$
declare mid uuid; o public.orders; ends date;
begin
  mid=miuu_private.session_member(p_token);
  if mid is null then raise exception 'Sesi member habis. Masuk kembali.'; end if;
  select * into o from public.orders where id=p_order and member_id=mid;
  if not found or o.status='Dibatalkan' then raise exception 'Pesanan tidak ditemukan.'; end if;
  ends=case when o.due_date<>'' then o.due_date::date else o.order_date+o.warranty_days end;
  if ends<(now() at time zone 'Asia/Jakarta')::date then raise exception 'Masa garansi sudah berakhir.'; end if;
  if length(trim(p_message)) not between 1 and 2000 then raise exception 'Ceritakan masalahnya (maksimal 2.000 karakter).'; end if;
  if exists(select 1 from public.warranty_claims where order_id=p_order and status in ('Baru','Diproses')) then raise exception 'Klaim pesanan ini masih diproses.'; end if;
  insert into public.warranty_claims(owner_id,member_id,order_id,message) values(o.owner_id,mid,p_order,trim(p_message)); return true;
end;
$$;

create table if not exists public.canva_teams (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check(length(trim(name)) between 1 and 120), invite_url text not null default '', unique(owner_id,name)
);
create table if not exists public.canva_subscriptions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  team_id uuid references public.canva_teams(id) on delete set null, email text not null,
  months integer not null check(months between 1 and 120), renewal_index integer not null default 1 check(renewal_index>=1)
);
create table if not exists public.canva_renewal_logs (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null references public.canva_subscriptions(id) on delete cascade,
  renewal_index integer not null, created_at timestamptz not null default now(), unique(subscription_id,renewal_index)
);
create or replace function public.save_canva_subscription(p_id uuid,p_order_id uuid,p_team_id uuid,p_email text,p_months integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  if not public.is_store_admin() then raise exception 'Akses admin diperlukan.'; end if;
  select * into o from public.orders where id=p_order_id and owner_id=auth.uid() for update;
  if not found then raise exception 'Order tidak ditemukan.'; end if;
  if p_team_id is not null and not exists(select 1 from public.canva_teams where id=p_team_id and owner_id=auth.uid()) then raise exception 'Tim tidak ditemukan.'; end if;
  if p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_email)>254 or p_months not between 1 and 120 then raise exception 'Email atau durasi tidak valid.'; end if;
  if p_id is null then
    insert into public.canva_subscriptions(owner_id,order_id,team_id,email,months) values(auth.uid(),p_order_id,p_team_id,trim(p_email),p_months);
  else
    update public.canva_subscriptions set team_id=p_team_id,email=trim(p_email),months=p_months,renewal_index=least(renewal_index,p_months)
    where id=p_id and owner_id=auth.uid() and order_id=p_order_id;
    if not found then raise exception 'Order Canva tidak ditemukan.'; end if;
  end if;
  update public.orders set rental_end_at=(o.order_date+make_interval(months=>p_months)+interval '23 hours 59 minutes') at time zone 'Asia/Jakarta',
    duration=p_months||' bulan',logged_out_at=null,updated_at=now() where id=p_order_id;
  return true;
end;
$$;
create or replace function public.canva_renewal_action(p_id uuid,p_expected_index integer,p_action text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare s public.canva_subscriptions; o public.orders;
begin
  if not public.is_store_admin() then raise exception 'Akses admin diperlukan.'; end if;
  select * into s from public.canva_subscriptions where id=p_id and owner_id=auth.uid() for update;
  if not found then raise exception 'Order Canva tidak ditemukan.'; end if;
  select * into o from public.orders where id=s.order_id;
  if o.status='Dibatalkan' then raise exception 'Order sudah dibatalkan.'; end if;
  if s.renewal_index<>p_expected_index then raise exception 'Jadwal sudah berubah. Muat ulang sebelum melanjutkan.'; end if;
  if p_action='undo' and s.renewal_index>1 then update public.canva_subscriptions set renewal_index=renewal_index-1 where id=s.id;
  elsif p_action='invite' and s.renewal_index<s.months then update public.canva_subscriptions set renewal_index=renewal_index+1 where id=s.id;
  elsif p_action='sent' and s.renewal_index<s.months then
    insert into public.canva_renewal_logs(owner_id,subscription_id,renewal_index) values(auth.uid(),s.id,s.renewal_index) on conflict do nothing;
  else raise exception 'Tidak ada jadwal renewal untuk tindakan ini.'; end if;
  return true;
end;
$$;

-- Kebijakan baru bersifat per pemilik dan hanya untuk akun dalam daftar admin.
do $$
declare tbl text;
begin
  foreach tbl in array array['orders','order_events','products','suppliers','expenses','buyer_notes','shop_settings'] loop
    execute format('drop policy if exists "registered admin required" on public.%I',tbl);
    execute format('create policy "registered admin required" on public.%I as restrictive for all to authenticated using((select public.is_store_admin())) with check((select public.is_store_admin()))',tbl);
  end loop;
  foreach tbl in array array['catalog_categories','storefront_settings','canva_teams'] loop
    execute format('alter table public.%I enable row level security',tbl);
    execute format('revoke all on public.%I from anon,authenticated',tbl);
    execute format('grant select,insert,update,delete on public.%I to authenticated',tbl);
    execute format('drop policy if exists "admin owns data" on public.%I',tbl);
    execute format('create policy "admin owns data" on public.%I for all to authenticated using(owner_id=(select auth.uid()) and (select public.is_store_admin())) with check(owner_id=(select auth.uid()) and (select public.is_store_admin()))',tbl);
  end loop;
  foreach tbl in array array['loyalty_members','loyalty_vouchers','loyalty_stamp_logs','warranty_claims','canva_subscriptions','canva_renewal_logs'] loop
    execute format('alter table public.%I enable row level security',tbl);
    execute format('revoke all on public.%I from anon,authenticated',tbl);
    execute format('grant select on public.%I to authenticated',tbl);
    execute format('drop policy if exists "admin reads own data" on public.%I',tbl);
    execute format('create policy "admin reads own data" on public.%I for select to authenticated using(owner_id=(select auth.uid()) and (select public.is_store_admin()))',tbl);
  end loop;
end;
$$;
grant update(status) on public.warranty_claims to authenticated;
drop policy if exists "admin updates own claims" on public.warranty_claims;
create policy "admin updates own claims" on public.warranty_claims for update to authenticated using(owner_id=(select auth.uid()) and (select public.is_store_admin())) with check(owner_id=(select auth.uid()) and (select public.is_store_admin()));
grant delete on public.canva_subscriptions to authenticated;
drop policy if exists "admin deletes own canva detail" on public.canva_subscriptions;
create policy "admin deletes own canva detail" on public.canva_subscriptions for delete to authenticated using(owner_id=(select auth.uid()) and (select public.is_store_admin()));
-- Hash kode tidak dikirim melalui API/table browser, termasuk kepada admin.
revoke select on public.loyalty_members from authenticated;
grant select(id,owner_id,member_id,name,stamps,joined_at) on public.loyalty_members to authenticated;

create or replace function public.public_storefront(p_slug text default 'miuu') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.storefront_settings;
begin
  select * into s from public.storefront_settings where slug=p_slug and is_public;
  if not found then return null; end if;
  return jsonb_build_object('settings',jsonb_build_object('shop_name',s.shop_name,'tagline',s.tagline,'header_text',s.header_text,'footer_text',s.footer_text,'logo_url',s.logo_url,'slug',s.slug),
    'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'price',p.price,'variant',p.variant,'duration',p.duration,
      'description',p.description,'image_url',p.image_url,'reference_url',p.reference_url,'category_id',p.category_id,'available',p.available,'is_published',p.is_published,
      'variants',coalesce((select jsonb_agg(jsonb_build_object('label',v.value->>'label','price',v.value->'price') order by v.ordinal) from jsonb_array_elements(p.variants) with ordinality as v(value,ordinal)),'[]'::jsonb),'package_notes',p.package_notes,'terms',p.terms,'sort_order',p.sort_order) order by p.sort_order,p.created_at) from public.products p where p.owner_id=s.owner_id and p.is_published),'[]'::jsonb),
    'categories',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'sort_order',c.sort_order) order by c.sort_order,c.name) from public.catalog_categories c where c.owner_id=s.owner_id),'[]'::jsonb));
end;
$$;

revoke all on all functions in schema miuu_private from public,anon,authenticated;
revoke all on function public.public_storefront(text),public.login_loyalty_member(text,text),public.loyalty_member_profile(text),public.logout_loyalty_member(text),public.submit_warranty_claim(text,uuid,text) from public;
grant execute on function public.public_storefront(text),public.login_loyalty_member(text,text),public.loyalty_member_profile(text),public.logout_loyalty_member(text),public.submit_warranty_claim(text,uuid,text) to anon,authenticated;
revoke all on function public.save_loyalty_member(uuid,text,text,text),public.adjust_loyalty_stamp(uuid,integer,text),public.use_loyalty_voucher(uuid),public.save_canva_subscription(uuid,uuid,uuid,text,integer),public.canva_renewal_action(uuid,integer,text) from public,anon;
grant execute on function public.save_loyalty_member(uuid,text,text,text),public.adjust_loyalty_stamp(uuid,integer,text),public.use_loyalty_voucher(uuid),public.save_canva_subscription(uuid,uuid,uuid,text,integer),public.canva_renewal_action(uuid,integer,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('miuu-assets','miuu-assets',true,5242880,array['image/jpeg','image/png','image/webp','image/gif']) on conflict(id) do nothing;
drop policy if exists "admin uploads own miuu images" on storage.objects;
create policy "admin uploads own miuu images" on storage.objects for insert to authenticated with check(bucket_id='miuu-assets' and (storage.foldername(name))[1]=auth.uid()::text and public.is_store_admin());
drop policy if exists "admin updates own miuu images" on storage.objects;
create policy "admin updates own miuu images" on storage.objects for update to authenticated using(bucket_id='miuu-assets' and (storage.foldername(name))[1]=auth.uid()::text and public.is_store_admin()) with check(bucket_id='miuu-assets' and (storage.foldername(name))[1]=auth.uid()::text and public.is_store_admin());
drop policy if exists "admin deletes own miuu images" on storage.objects;
create policy "admin deletes own miuu images" on storage.objects for delete to authenticated using(bucket_id='miuu-assets' and (storage.foldername(name))[1]=auth.uid()::text and public.is_store_admin());
commit;
