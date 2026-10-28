-- Program dari index 5.html: lunas >= Rp15.000, 4 stamp diskon, 8 stamp gratis aplikasi.
-- Program classic10 dari loyaltycmiu tetap tersedia untuk member yang memilihnya.
begin;
alter table public.storefront_settings add column if not exists loyalty_program text not null default 'miuu8' check(loyalty_program in ('miuu8','classic10'));
alter table public.storefront_settings add column if not exists discount_label text not null default 'Voucher diskon 10% (maks. Rp15.000)';
alter table public.storefront_settings add column if not exists free_app_label text not null default 'Gratis 1 aplikasi';
alter table public.storefront_settings drop constraint if exists storefront_settings_voucher_valid_days_check;
alter table public.storefront_settings add constraint storefront_settings_voucher_valid_days_check check(voucher_valid_days between 0 and 3650);
alter table public.loyalty_members add column if not exists phone text not null default '';
alter table public.loyalty_members add column if not exists program text not null default 'miuu8' check(program in ('miuu8','classic10'));
alter table public.loyalty_members add column if not exists total_stamps integer not null default 0 check(total_stamps>=0);
alter table public.loyalty_members add column if not exists manual_offset integer not null default 0;
alter table public.loyalty_members add column if not exists code_lookup text;
alter table public.loyalty_members add column if not exists sealed_code bytea;
create unique index if not exists idx_loyalty_phone on public.loyalty_members(owner_id,phone) where phone<>'';
create unique index if not exists idx_loyalty_code_lookup on public.loyalty_members(code_lookup) where code_lookup is not null;
alter table public.loyalty_vouchers add column if not exists reward_type text not null default 'discount' check(reward_type in ('discount','free_app'));
alter table public.loyalty_vouchers add column if not exists label text not null default 'Voucher diskon 10% (maks. Rp15.000)';
alter table public.loyalty_vouchers add column if not exists status text not null default 'available' check(status in ('available','used','expired','revoked'));
alter table public.loyalty_vouchers add column if not exists earned_stamps integer;
alter table public.loyalty_vouchers add column if not exists cycle integer;
alter table public.loyalty_vouchers alter column expires_at drop not null;
create unique index if not exists idx_loyalty_milestone on public.loyalty_vouchers(member_id,earned_stamps) where earned_stamps is not null;
drop index if exists public.idx_one_stamp_per_order;
create index if not exists idx_stamp_order_history on public.loyalty_stamp_logs(order_id);
create table if not exists miuu_private.loyalty_key(singleton boolean primary key default true check(singleton),secret text not null);
insert into miuu_private.loyalty_key values(true,gen_random_uuid()::text||gen_random_uuid()::text) on conflict do nothing;
create table if not exists miuu_private.order_credits(order_id uuid primary key references public.orders(id) on delete cascade,member_id uuid not null references public.loyalty_members(id) on delete cascade,active boolean not null default true);
create or replace function miuu_private.normalize_code(value text) returns text language sql immutable set search_path='' as $$select regexp_replace(upper(trim(value)),'[^A-Z0-9]','','g')$$;
create or replace function miuu_private.lookup_code(value text) returns text language sql stable security definer set search_path='' as $$select encode(sha256(convert_to(secret||':'||miuu_private.normalize_code(value),'UTF8')),'hex') from miuu_private.loyalty_key where singleton$$;
create or replace function miuu_private.new_code() returns text language sql volatile set search_path='' as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',1+get_byte(r.bytes,n)%32,1),'') from (select decode(md5(gen_random_uuid()::text),'hex') bytes) r cross join generate_series(0,7) n;
$$;
do $outer$
declare ns text;
begin
 select n.nspname into ns from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto';
 execute format($ddl$create or replace function miuu_private.seal_code(value text) returns bytea language sql volatile security definer set search_path='' as $f$select %1$I.pgp_sym_encrypt(value,secret,'cipher-algo=aes256') from miuu_private.loyalty_key where singleton$f$$ddl$,ns);
 execute format($ddl$create or replace function miuu_private.unseal_code(value bytea) returns text language sql stable security definer set search_path='' as $f$select %1$I.pgp_sym_decrypt(value,secret) from miuu_private.loyalty_key where singleton$f$$ddl$,ns);
end;
$outer$;
create or replace function miuu_private.normalize_phone(value text) returns text language plpgsql immutable set search_path='' as $$
declare p text:=regexp_replace(coalesce(value,''),'[^0-9]','','g');
begin if left(p,1)='0' then p='62'||substr(p,2); elsif left(p,1)='8' then p='62'||p; end if; return case when p ~ '^[0-9]{9,15}$' then p else '' end; end;
$$;

create or replace function public.save_loyalty_member_v2(p_id uuid,p_name text,p_member_id text,p_code text,p_phone text,p_program text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m public.loyalty_members; code text; normalized_phone text; program text;
begin
 if not public.is_store_admin() then raise exception 'Akses admin diperlukan.'; end if;
 if length(trim(p_name)) not between 1 and 120 or upper(trim(p_member_id)) !~ '^[A-Z0-9-]{3,40}$' then raise exception 'Nama atau Member ID tidak valid.'; end if;
 normalized_phone=miuu_private.normalize_phone(p_phone);
 if coalesce(p_phone,'')<>'' and normalized_phone='' then raise exception 'Nomor WhatsApp tidak valid.'; end if;
 if p_id is not null then
   select * into m from public.loyalty_members where id=p_id and owner_id=auth.uid() for update;
   if not found then raise exception 'Member tidak ditemukan.'; end if;
   if p_program is distinct from m.program then raise exception 'Program member yang sudah dibuat tidak dapat diganti agar riwayat hadiah tetap konsisten.'; end if;
 end if;
 program=coalesce(p_program,(select loyalty_program from public.storefront_settings where owner_id=auth.uid()),'miuu8');
 if program not in ('miuu8','classic10') then raise exception 'Program loyalty tidak valid.'; end if;
 code=case when coalesce(p_code,'')<>'' then miuu_private.normalize_code(p_code) when p_id is null then miuu_private.new_code() else null end;
 if code is not null and length(code) not between 8 and 64 then raise exception 'Kode akses minimal 8 karakter.'; end if;
 if p_id is null then
   insert into public.loyalty_members(owner_id,name,member_id,phone,program,code_hash,code_lookup,sealed_code)
   values(auth.uid(),trim(p_name),upper(trim(p_member_id)),normalized_phone,program,miuu_private.code_hash(code),miuu_private.lookup_code(code),miuu_private.seal_code(code)) returning * into m;
 else
   update public.loyalty_members set name=trim(p_name),member_id=upper(trim(p_member_id)),phone=normalized_phone where id=p_id returning * into m;
   if code is not null then
     update public.loyalty_members set code_hash=miuu_private.code_hash(code),code_lookup=miuu_private.lookup_code(code),sealed_code=miuu_private.seal_code(code) where id=p_id returning * into m;
     delete from miuu_private.member_sessions where member_id=p_id;
   end if;
 end if;
 return jsonb_build_object('id',m.id,'name',m.name,'member_id',m.member_id,'phone',m.phone,'program',m.program,'total_stamps',m.total_stamps,'stamps',m.stamps,'joined_at',m.joined_at);
end;
$$;
create or replace function public.save_loyalty_member(p_id uuid,p_name text,p_member_id text,p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.loyalty_members;
begin select * into m from public.loyalty_members where id=p_id and owner_id=auth.uid(); return public.save_loyalty_member_v2(p_id,p_name,p_member_id,p_code,coalesce(m.phone,''),coalesce(m.program,(select loyalty_program from public.storefront_settings where owner_id=auth.uid()),'miuu8')); end;
$$;
create or replace function public.get_loyalty_code(p_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare encrypted bytea;
begin
 if not public.is_store_admin() then raise exception 'Akses admin diperlukan.'; end if;
 select sealed_code into encrypted from public.loyalty_members where id=p_id and owner_id=auth.uid();
 if encrypted is null then raise exception 'Kode lama tidak dapat ditampilkan. Buat kode akses baru.'; end if;
 return miuu_private.unseal_code(encrypted);
end;
$$;

create or replace function miuu_private.apply_stamp(p_member uuid,p_delta integer,p_reason text,p_order uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare m public.loyalty_members; total integer; threshold integer; cyc integer; reward text; label text; validity integer; rewardcode text;
begin
 select * into m from public.loyalty_members where id=p_member for update;
 if not found then raise exception 'Member tidak ditemukan.'; end if;
 if p_order is null then
   m.manual_offset=m.manual_offset+p_delta;
 end if;
 select count(*)::integer+m.manual_offset into total from miuu_private.order_credits where member_id=m.id and active;
 if total<0 and p_order is null then raise exception 'Stamp tidak dapat kurang dari nol.'; end if;
 total=greatest(0,total);
 insert into public.loyalty_stamp_logs(owner_id,member_id,order_id,delta,reason) values(m.owner_id,m.id,p_order,total-m.total_stamps,p_reason);
 update public.loyalty_members set manual_offset=m.manual_offset where id=m.id;
 update public.loyalty_members set total_stamps=total,stamps=case when m.program='classic10' then total%10 when total=0 then 0 else (total-1)%8+1 end where id=m.id;
 if total>m.total_stamps then
   if m.program='classic10' and total%10=0 then threshold=total; reward='discount';cyc=total/10;
   elsif m.program='miuu8' and total%4=0 then threshold=total;reward=case when total%8=0 then 'free_app' else 'discount' end;cyc=(total-1)/8+1;
   end if;
   if threshold is not null then
     select case when reward='free_app' then s.free_app_label else s.discount_label end,s.voucher_valid_days into label,validity from public.storefront_settings s where s.owner_id=m.owner_id;
     rewardcode='MIU-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
     insert into public.loyalty_vouchers(owner_id,member_id,code,discount_pct,max_amount,reward_type,label,earned_stamps,cycle,expires_at)
     values(m.owner_id,m.id,rewardcode,case when reward='free_app' then 0 else 10 end,case when reward='free_app' then 0 else 15000 end,reward,
       coalesce(label,case when reward='free_app' then 'Gratis 1 aplikasi' else 'Voucher diskon 10% (maks. Rp15.000)' end),threshold,cyc,
       case when coalesce(validity,30)=0 then null else (now() at time zone 'Asia/Jakarta')::date+coalesce(validity,30) end)
     on conflict(member_id,earned_stamps) where earned_stamps is not null do update set status=case when public.loyalty_vouchers.status='revoked' and public.loyalty_vouchers.used_at is null then 'available' else public.loyalty_vouchers.status end;
   end if;
 elsif total<m.total_stamps then
   update public.loyalty_vouchers set status='revoked' where member_id=m.id and earned_stamps>total and used_at is null and status='available';
 end if;
end;
$$;
create or replace function miuu_private.auto_member() returns trigger language plpgsql security definer set search_path='' as $$
declare p text; program text; m uuid; code text;
begin
 if new.member_id is not null or new.payment_status<>'Lunas' or new.status='Dibatalkan' or new.price*new.quantity-new.refund_amount<15000 then return new; end if;
 select s.loyalty_program into program from public.storefront_settings s where s.owner_id=new.owner_id;
 if coalesce(program,'miuu8')<>'miuu8' then return new; end if;
 p=miuu_private.normalize_phone(new.buyer_wa); if p='' then return new; end if;
 perform 1 from public.store_admins where owner_id=new.owner_id for update;
 select id into m from public.loyalty_members where owner_id=new.owner_id and phone=p;
 if m is null then
   code=miuu_private.new_code();
   insert into public.loyalty_members(owner_id,name,member_id,phone,program,code_hash,code_lookup,sealed_code)
   values(new.owner_id,new.buyer,'MIU-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),p,'miuu8',miuu_private.code_hash(code),miuu_private.lookup_code(code),miuu_private.seal_code(code)) returning id into m;
 end if;
 new.member_id=m;return new;
end;
$$;
drop trigger if exists auto_loyalty_member on public.orders;
create trigger auto_loyalty_member before insert or update on public.orders for each row execute function miuu_private.auto_member();
create or replace function miuu_private.stamp_order() returns trigger language plpgsql security definer set search_path='' as $$
declare m public.loyalty_members; credit miuu_private.order_credits; eligible boolean;
begin
 if new.member_id is not null then
   select * into m from public.loyalty_members where id=new.member_id and owner_id=new.owner_id;
   if not found then raise exception 'Member berasal dari toko lain.'; end if;
 end if;
 select * into credit from miuu_private.order_credits where order_id=new.id for update;
 if credit.order_id is not null and new.member_id is distinct from credit.member_id then raise exception 'Member pada order yang sudah mendapat stamp tidak dapat diganti.'; end if;
 if m.id is null then return new; end if;
 eligible=case when m.program='classic10' then new.status='Selesai' else new.payment_status='Lunas' and new.status<>'Dibatalkan' and new.price*new.quantity-new.refund_amount>=15000 end;
 if eligible and not coalesce(credit.active,false) then
   insert into miuu_private.order_credits(order_id,member_id,active) values(new.id,m.id,true) on conflict(order_id) do update set active=true;
   perform miuu_private.apply_stamp(m.id,1,'Pesanan INV-'||lpad(new.invoice_seq::text,5,'0')||case when m.program='classic10' then ' selesai' else ' lunas minimal Rp15.000' end,new.id);
 elsif not eligible and coalesce(credit.active,false) and m.program='miuu8' then
   update miuu_private.order_credits set active=false where order_id=new.id;
   perform miuu_private.apply_stamp(m.id,-1,'Kelayakan stamp INV-'||lpad(new.invoice_seq::text,5,'0')||' dibatalkan',new.id);
 end if;
 return new;
end;
$$;
drop trigger if exists loyalty_order_stamp on public.orders;
create trigger loyalty_order_stamp after insert or update on public.orders for each row execute function miuu_private.stamp_order();
create or replace function miuu_private.remove_order_credit() returns trigger language plpgsql security definer set search_path='' as $$
declare c miuu_private.order_credits;
begin select * into c from miuu_private.order_credits where order_id=old.id for update; if c.active then update miuu_private.order_credits set active=false where order_id=old.id;perform miuu_private.apply_stamp(c.member_id,-1,'Order INV-'||lpad(old.invoice_seq::text,5,'0')||' dihapus',old.id);end if;return old;end;
$$;
drop trigger if exists loyalty_order_delete on public.orders;
create trigger loyalty_order_delete before delete on public.orders for each row execute function miuu_private.remove_order_credit();

create or replace function public.login_loyalty_member(p_member_id text,p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.loyalty_members;k text;n integer;token text;code text;
begin
 if length(coalesce(p_member_id,''))>40 or length(coalesce(p_code,''))>64 then return jsonb_build_object('error','Member ID atau kode akses tidak sesuai.');end if;
 code=miuu_private.normalize_code(p_code);
 if coalesce(trim(p_member_id),'')='' then select * into m from public.loyalty_members where code_lookup=miuu_private.lookup_code(code);
 else select * into m from public.loyalty_members where member_id=upper(trim(p_member_id));end if;
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
create or replace function public.loyalty_member_profile(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare mid uuid;m public.loyalty_members;
begin
 mid=miuu_private.session_member(p_token);if mid is null then return null;end if;
 select * into m from public.loyalty_members where id=mid;
 return jsonb_build_object('customer',jsonb_build_object('id',m.id,'member_id',m.member_id,'name',m.name,'phone',m.phone,'program',m.program,'total_stamps',m.total_stamps,'stamps',m.stamps,'joined_at',m.joined_at),
 'orders',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'invoice_seq',o.invoice_seq,'product_name',o.product_name,'variant',o.variant,'duration',o.duration,'price',o.price,'quantity',o.quantity,'refund_amount',o.refund_amount,'order_date',o.order_date,'due_date',o.due_date,'warranty_days',o.warranty_days,'rental_end_at',o.rental_end_at,'status',o.status,'public_note',o.public_note) order by o.created_at desc) from public.orders o where o.member_id=mid),'[]'::jsonb),
 'vouchers',coalesce((select jsonb_agg(to_jsonb(v)-'owner_id' order by v.created_at desc) from public.loyalty_vouchers v where v.member_id=mid),'[]'::jsonb),
 'claims',coalesce((select jsonb_agg(to_jsonb(c)-'owner_id' order by c.created_at desc) from public.warranty_claims c where c.member_id=mid),'[]'::jsonb),
 'logs',coalesce((select jsonb_agg(to_jsonb(l)-'owner_id' order by l.created_at desc) from public.loyalty_stamp_logs l where l.member_id=mid),'[]'::jsonb));
end;
$$;
create or replace function public.update_loyalty_reward(p_id uuid,p_status text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not public.is_store_admin() or p_status not in ('available','used','expired','revoked') then raise exception 'Tindakan reward tidak valid.';end if;
 update public.loyalty_vouchers set status=p_status,used_at=case when p_status='used' then now() when p_status='available' then null else used_at end,
 expires_at=case when p_status='available' and (status='expired' or expires_at<(now() at time zone 'Asia/Jakarta')::date) then
   case when (select voucher_valid_days from public.storefront_settings where owner_id=auth.uid())=0 then null
   else (now() at time zone 'Asia/Jakarta')::date+coalesce((select voucher_valid_days from public.storefront_settings where owner_id=auth.uid()),30) end else expires_at end
 where id=p_id and owner_id=auth.uid();if not found then raise exception 'Reward tidak ditemukan.';end if;return true;
end;
$$;
create or replace function public.add_loyalty_reward(p_member uuid,p_type text) returns boolean language plpgsql security definer set search_path='' as $$
declare m public.loyalty_members;label text;validity integer;
begin
 if not public.is_store_admin() or p_type not in ('discount','free_app') then raise exception 'Tindakan tidak valid.';end if;
 select * into m from public.loyalty_members where id=p_member and owner_id=auth.uid();if not found then raise exception 'Member tidak ditemukan.';end if;
 select case when p_type='free_app' then s.free_app_label else s.discount_label end,s.voucher_valid_days into label,validity from public.storefront_settings s where s.owner_id=m.owner_id;
 insert into public.loyalty_vouchers(owner_id,member_id,code,reward_type,label,discount_pct,max_amount,expires_at) values(m.owner_id,m.id,'MIU-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),p_type,coalesce(label,'Reward Miuu Store'),case when p_type='free_app' then 0 else 10 end,case when p_type='free_app' then 0 else 15000 end,case when coalesce(validity,30)=0 then null else (now() at time zone 'Asia/Jakarta')::date+coalesce(validity,30) end);return true;
end;
$$;
create or replace function public.use_loyalty_voucher(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not public.is_store_admin() then raise exception 'Akses admin diperlukan.';end if;
 update public.loyalty_vouchers set used_at=now(),status='used' where id=p_id and owner_id=auth.uid() and status='available' and used_at is null and (expires_at is null or expires_at>=(now() at time zone 'Asia/Jakarta')::date);
 if not found then raise exception 'Reward sudah terpakai, kedaluwarsa, atau tidak tersedia.';end if;return true;
end;
$$;
grant select(phone,program,total_stamps) on public.loyalty_members to authenticated;
revoke all on all functions in schema miuu_private from public,anon,authenticated;
revoke all on function public.save_loyalty_member_v2(uuid,text,text,text,text,text),public.get_loyalty_code(uuid),public.update_loyalty_reward(uuid,text),public.add_loyalty_reward(uuid,text) from public,anon;
grant execute on function public.save_loyalty_member_v2(uuid,text,text,text,text,text),public.get_loyalty_code(uuid),public.update_loyalty_reward(uuid,text),public.add_loyalty_reward(uuid,text) to authenticated;
commit;
