-- Jalankan sekali di SQL Editor pada project Supabase yang baru.
-- Semua data seller diisolasi dengan Row Level Security (RLS).
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  invoice_seq bigint generated always as identity,
  tracking_code text not null unique,
  buyer text not null,
  buyer_wa text not null default '',
  product_name text not null,
  variant text not null default '',
  duration text not null default '',
  device text not null default '',
  location text not null default '',
  price bigint not null default 0,
  cost bigint not null default 0,
  quantity integer not null default 1,
  supplier text not null default '',
  supplier_admin text not null default '',
  order_date date not null default current_date,
  due_date text not null default '',
  warranty_days integer not null default 30,
  rental_end_at timestamptz,
  logged_out_at timestamptz,
  status text not null default 'Diproses' check (status in ('Baru','Diproses','Menunggu','Selesai','Dibatalkan')),
  notes text not null default '',
  public_note text not null default '',
  refund_amount bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_nonnegative check (price >= 0 and cost >= 0 and quantity >= 1 and warranty_days >= 0 and refund_amount >= 0)
);
create index if not exists idx_orders_owner_updated on public.orders (owner_id, updated_at desc);
create index if not exists idx_orders_owner_rental on public.orders (owner_id, rental_end_at) where rental_end_at is not null;

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_order_events_order on public.order_events (order_id, created_at desc);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  variant text not null default '',
  duration text not null default '',
  cost bigint not null default 0,
  price bigint not null default 0,
  supplier text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_products_owner_name on public.products (owner_id, name);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  admin text not null default '',
  contact text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_suppliers_owner on public.suppliers (owner_id);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  amount bigint not null default 0,
  date date not null default current_date,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_expenses_owner_date on public.expenses (owner_id, date desc);

create table if not exists public.buyer_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  buyer text not null,
  notes text not null default '',
  updated_at timestamptz not null default now(),
  unique(owner_id, buyer)
);

create table if not exists public.shop_settings (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  shop_name text not null default 'Ruang Order',
  currency text not null default 'Rp',
  default_warranty integer not null default 30,
  receipt_style text not null default 'thermal',
  receipt_color text not null default '#399dc8',
  buyer_template text not null default 'Halo {buyer}, pesanan {invoice} untuk {product} sedang diproses. Cek progres: {link}',
  account_template text not null default 'Halo {buyer}, pesanan {invoice} untuk {product} sudah selesai. Terima kasih!',
  seller_wa text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.orders enable row level security;
alter table public.order_events enable row level security;
alter table public.products enable row level security;
alter table public.suppliers enable row level security;
alter table public.expenses enable row level security;
alter table public.buyer_notes enable row level security;
alter table public.shop_settings enable row level security;

-- Anon tidak dapat membaca tabel. Hanya fungsi lookup_progress yang menampilkan data terbatas.
revoke all on public.orders, public.order_events, public.products, public.suppliers, public.expenses, public.buyer_notes, public.shop_settings from anon;
grant select, insert, update, delete on public.orders, public.products, public.suppliers, public.expenses, public.buyer_notes, public.shop_settings to authenticated;
grant select on public.order_events to authenticated;

create policy "seller owns orders" on public.orders for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "seller reads own order events" on public.order_events for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.owner_id = (select auth.uid())));
create policy "seller owns products" on public.products for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "seller owns suppliers" on public.suppliers for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "seller owns expenses" on public.expenses for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "seller owns buyer notes" on public.buyer_notes for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "seller owns settings" on public.shop_settings for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

-- Riwayat status dicatat oleh database agar tidak ada perubahan yang terlewat.
create or replace function public.record_order_event() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_events(order_id,status,note) values(new.id,new.status,new.public_note);
  elsif new.status is distinct from old.status then
    insert into public.order_events(order_id,status,note) values(new.id,new.status,new.public_note);
  end if;
  return new;
end;
$$;
revoke all on function public.record_order_event() from public, anon, authenticated;
create trigger order_event_trigger after insert or update of status on public.orders
for each row execute function public.record_order_event();

-- Kode acak pada link progres hanya membuka kolom yang aman untuk buyer.
create or replace function public.lookup_progress(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o record;
begin
  if p_code !~ '^RO-[0-9A-F]{20}$' then return null; end if;
  select id,invoice_seq,product_name,variant,duration,order_date,due_date,warranty_days,rental_end_at,status,public_note,updated_at
  into o from public.orders where tracking_code = p_code;
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
revoke all on function public.lookup_progress(text) from public;
grant execute on function public.lookup_progress(text) to anon, authenticated;
