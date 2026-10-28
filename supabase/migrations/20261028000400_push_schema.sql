-- Lengkapi skema untuk fitur push yang sudah ada di repositori.
begin;
create table if not exists public.push_subscriptions(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 endpoint text not null unique,p256dh text not null,auth text not null,created_at timestamptz not null default now()
);
create table if not exists public.push_delivery_log(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,
 subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
 phase text not null check(phase in ('soon','expired')),rental_end_at timestamptz not null,created_at timestamptz not null default now(),
 unique(order_id,subscription_id,phase,rental_end_at)
);
alter table public.push_subscriptions enable row level security;
alter table public.push_delivery_log enable row level security;
revoke all on public.push_subscriptions,public.push_delivery_log from anon,authenticated;
grant select,insert,update,delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions,public.push_delivery_log to service_role;
drop policy if exists "registered owner manages push" on public.push_subscriptions;
create policy "registered owner manages push" on public.push_subscriptions for all to authenticated using(owner_id=(select auth.uid()) and (select public.is_store_admin())) with check(owner_id=(select auth.uid()) and (select public.is_store_admin()));
create index if not exists idx_push_owner on public.push_subscriptions(owner_id);
create index if not exists idx_claims_owner_status on public.warranty_claims(owner_id,status);
create index if not exists idx_loyalty_members_owner on public.loyalty_members(owner_id);
create index if not exists idx_loyalty_vouchers_owner on public.loyalty_vouchers(owner_id,member_id);
create index if not exists idx_loyalty_logs_member on public.loyalty_stamp_logs(member_id,created_at desc);
commit;
