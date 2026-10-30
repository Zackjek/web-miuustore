-- Website khusus Miuu Store. Jalankan setelah empat migrasi 20261028.
-- Identitas pemilik dikunci sekali; data historis akun lain tetap disimpan.
begin;

create table if not exists miuu_private.store_identity (
  singleton boolean primary key default true check(singleton),
  owner_id uuid not null unique references auth.users(id)
);
revoke all on miuu_private.store_identity from public, anon, authenticated;

do $$
declare selected uuid; candidates integer; initial_setup boolean := false; previous_uid text;
begin
  select owner_id into selected from miuu_private.store_identity where singleton;
  if selected is null then
    -- Untuk kasus ambigu, operator dapat menentukan akun Miuu melalui
    -- SET LOCAL miuu.owner_id = '<UUID akun Miuu>' dalam transaksi migrasi.
    selected := nullif(current_setting('miuu.owner_id', true), '')::uuid;
    if selected is not null and not exists(select 1 from public.store_admins where owner_id=selected) then
      raise exception 'Akun Miuu yang dipilih belum terdaftar sebagai pengelola.';
    end if;
    if selected is null then
      select s.owner_id into selected from public.storefront_settings s
      join public.store_admins a on a.owner_id=s.owner_id where s.slug='miuu';
    end if;
    if selected is null then
      select count(*) into candidates from public.store_admins;
      if candidates=1 then select owner_id into selected from public.store_admins; end if;
    end if;
    if selected is null then
      select count(*) into candidates from public.store_admins a
      join public.shop_settings s on s.owner_id=a.owner_id where lower(trim(s.shop_name)) in ('miuu','miuu store');
      if candidates=1 then
        select a.owner_id into selected from public.store_admins a
        join public.shop_settings s on s.owner_id=a.owner_id where lower(trim(s.shop_name)) in ('miuu','miuu store');
      end if;
    end if;
    if selected is null then
      raise exception 'Pemilik Miuu belum dapat ditentukan dengan pasti. Tentukan miuu.owner_id milik Miuu sebelum menjalankan migrasi.';
    end if;
    insert into miuu_private.store_identity(owner_id) values(selected);
    initial_setup := true;
  end if;

  if initial_setup then
    update public.storefront_settings set is_public=false where owner_id<>selected;
    update public.storefront_settings set slug='archived-'||left(replace(owner_id::text,'-',''),24)
      where slug='miuu' and owner_id<>selected;
    insert into public.storefront_settings(owner_id,slug,shop_name,is_public)
      values(selected,'miuu','Miuu Store',true)
      on conflict(owner_id) do update set slug='miuu',shop_name='Miuu Store',is_public=true;
    -- Publikasikan pricelist Miuu yang memang diminta tampil di halaman utama.
    -- Kolom modal, supplier dan data buyer tidak masuk respons katalog publik.
    previous_uid := current_setting('request.jwt.claim.sub',true);
    perform set_config('request.jwt.claim.sub',selected::text,true);
    update public.products set is_published=true where owner_id=selected and not is_published;
    perform set_config('request.jwt.claim.sub',coalesce(previous_uid,''),true);
  end if;
end;
$$;

create or replace function public.is_store_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from miuu_private.store_identity i join public.store_admins a on a.owner_id=i.owner_id
    where i.singleton and i.owner_id=(select auth.uid()));
$$;

create or replace function public.miuu_admin_owner() returns uuid
language sql stable security definer set search_path='' as $$
  select i.owner_id from miuu_private.store_identity i where i.singleton and public.is_store_admin();
$$;
revoke all on function public.miuu_admin_owner() from public,anon;
grant execute on function public.miuu_admin_owner() to authenticated;

-- Fungsi jadwal memakai kredensial server, tetapi tetap hanya memproses Miuu.
create or replace function public.miuu_reminder_owner() returns uuid
language sql stable security definer set search_path='' as $$
  select owner_id from miuu_private.store_identity where singleton;
$$;
revoke all on function public.miuu_reminder_owner() from public,anon,authenticated;
grant execute on function public.miuu_reminder_owner() to service_role;

drop policy if exists "admin reads own membership" on public.store_admins;
create policy "admin reads own membership" on public.store_admins for select to authenticated
  using(owner_id=(select auth.uid()) and (select public.is_store_admin()));

create or replace function miuu_private.enforce_miuu_settings() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from miuu_private.store_identity where singleton and owner_id=new.owner_id)
    or new.shop_name is distinct from 'Miuu Store' then
    raise exception 'Website ini khusus Miuu Store. Identitas toko tidak dapat diganti.';
  end if;
  if tg_table_name='storefront_settings' then
    if new.slug is distinct from 'miuu' or new.is_public is distinct from true then
      raise exception 'Katalog Miuu Store hanya tersedia pada halaman utama dan selalu publik.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function miuu_private.enforce_miuu_settings() from public,anon,authenticated;
drop trigger if exists enforce_miuu_identity on public.storefront_settings;
create trigger enforce_miuu_identity before insert or update on public.storefront_settings
  for each row execute function miuu_private.enforce_miuu_settings();
drop trigger if exists enforce_miuu_identity on public.shop_settings;
create trigger enforce_miuu_identity before insert or update on public.shop_settings
  for each row execute function miuu_private.enforce_miuu_settings();
revoke delete on public.storefront_settings, public.shop_settings from authenticated;
alter table public.products alter column is_published set default true;

-- Fungsi publik di bawah tetap menggunakan daftar kolom aman dari migrasi asal.

create or replace function public.public_storefront(p_slug text default 'miuu') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.storefront_settings;
begin
  select * into s from public.storefront_settings where p_slug='miuu' and slug='miuu' and is_public and owner_id=(select owner_id from miuu_private.store_identity where singleton);
  if not found then return null; end if;
  return jsonb_build_object('settings',jsonb_build_object('shop_name',s.shop_name,'tagline',s.tagline,'header_text',s.header_text,'footer_text',s.footer_text,'logo_url',s.logo_url,'slug',s.slug),
    'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'price',p.price,'variant',p.variant,'duration',p.duration,
      'description',p.description,'image_url',p.image_url,'reference_url',p.reference_url,'category_id',p.category_id,'available',p.available,'is_published',p.is_published,
      'variants',coalesce((select jsonb_agg(jsonb_build_object('label',v.value->>'label','price',v.value->'price') order by v.ordinal) from jsonb_array_elements(p.variants) with ordinality as v(value,ordinal)),'[]'::jsonb),'package_notes',p.package_notes,'terms',p.terms,'sort_order',p.sort_order) order by p.sort_order,p.created_at) from public.products p where p.owner_id=s.owner_id and p.is_published),'[]'::jsonb),
    'categories',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'sort_order',c.sort_order) order by c.sort_order,c.name) from public.catalog_categories c where c.owner_id=s.owner_id),'[]'::jsonb));
end;
$$;

create or replace function public.login_loyalty_member(p_member_id text,p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.loyalty_members;k text;n integer;token text;code text;
begin
 if length(coalesce(p_member_id,''))>40 or length(coalesce(p_code,''))>64 then return jsonb_build_object('error','Member ID atau kode akses tidak sesuai.');end if;
 code=miuu_private.normalize_code(p_code);
 if coalesce(trim(p_member_id),'')='' then select * into m from public.loyalty_members where code_lookup=miuu_private.lookup_code(code) and owner_id=(select owner_id from miuu_private.store_identity where singleton);
 else select * into m from public.loyalty_members where member_id=upper(trim(p_member_id)) and owner_id=(select owner_id from miuu_private.store_identity where singleton);end if;
 k=encode(sha256(convert_to(coalesce(m.id::text,upper(trim(coalesce(p_member_id,'')))||':'||miuu_private.lookup_code(code)),'UTF8')),'hex');
 insert into miuu_private.login_limits(key) values(k) on conflict do nothing;
 perform 1 from miuu_private.login_limits where key=k for update;
 update miuu_private.login_limits set attempts=0,started_at=now() where key=k and started_at<now()-interval '15 minutes';
 select attempts into n from miuu_private.login_limits where key=k;
 if n>=5 then return jsonb_build_object('error','Terlalu banyak percobaan. Coba lagi dalam 15 menit.');end if;
 if m.id is null or m.code_hash is distinct from miuu_private.code_hash(code,m.code_hash) then update miuu_private.login_limits set attempts=attempts+1 where key=k;return jsonb_build_object('error','Member ID atau kode akses tidak sesuai.');end if;
 delete from miuu_private.login_limits where key=k;
 delete from miuu_private.member_sessions where expires_at<now();delete from miuu_private.login_limits where started_at<now()-interval '1 day';
 token=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');insert into miuu_private.member_sessions(token_hash,member_id) values(encode(sha256(convert_to(token,'UTF8')),'hex'),m.id);
 return jsonb_build_object('token',token);
end;
$$;

create or replace function miuu_private.session_member(p_token text) returns uuid
language sql stable security definer set search_path='' as $$
  select s.member_id from miuu_private.member_sessions s
  join public.loyalty_members m on m.id=s.member_id
  join miuu_private.store_identity i on i.owner_id=m.owner_id and i.singleton
  where s.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and s.expires_at>now();
$$;

create or replace function public.lookup_progress(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o record;
begin
  if p_code !~ '^RO-[0-9A-F]{20}$' then return null; end if;
  select id,invoice_seq,product_name,variant,duration,order_date,due_date,warranty_days,rental_end_at,status,public_note,updated_at
  into o from public.orders where tracking_code = p_code and owner_id=(select owner_id from miuu_private.store_identity where singleton);
  if not found then return null; end if;
  return jsonb_build_object(
    'order', jsonb_build_object('invoice_seq',o.invoice_seq,'product_name',o.product_name,'variant',o.variant,
      'duration',o.duration,'order_date',o.order_date,'due_date',o.due_date,'warranty_days',o.warranty_days,
      'rental_end_at',o.rental_end_at,'status',o.status,'public_note',o.public_note,'updated_at',o.updated_at),
    'events', coalesce((select jsonb_agg(jsonb_build_object('status',e.status,'note',e.note,'created_at',e.created_at) order by e.created_at desc)
      from (select status,note,created_at from public.order_events where order_id=o.id order by created_at desc limit 50) e),'[]'::jsonb)
  );
end;
$$;

commit;
