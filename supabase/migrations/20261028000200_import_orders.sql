-- Jalankan sesudah 20261028000100_unified_store.sql. Impor bersifat atomik dan tidak mengganti order lama.
begin;
create or replace function public.import_miuu_orders(p_rows jsonb,p_logs jsonb default '[]'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare x jsonb; l jsonb; c jsonb; oid uuid; tid uuid; sid uuid; imported integer:=0; skipped integer:=0; tracking text;
begin
  if not public.is_store_admin() then raise exception 'Akses admin diperlukan.'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>5000 or jsonb_typeof(p_logs) is distinct from 'array' or jsonb_array_length(p_logs)>10000 then raise exception 'Format backup tidak valid.'; end if;
  -- Serialize imports for the same owner; repeats cannot create duplicate orders.
  perform 1 from public.store_admins where owner_id=auth.uid() for update;
  for x in select value from jsonb_array_elements(p_rows) loop
    if length(coalesce(x->>'source_key','')) not between 1 and 200 or length(trim(coalesce(x->>'buyer',''))) not between 1 and 120
      or length(trim(coalesce(x->>'product_name',''))) not between 1 and 120 then raise exception 'Backup berisi order yang tidak valid.'; end if;
    if exists(select 1 from public.orders where owner_id=auth.uid() and (source_key=x->>'source_key' or (x->>'existing_id' is not null and id::text=x->>'existing_id'))) then skipped=skipped+1; continue; end if;
    tracking='RO-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,20));
    insert into public.orders(owner_id,tracking_code,buyer,buyer_wa,product_name,variant,duration,price,cost,quantity,supplier,supplier_admin,device,location,
      order_date,order_at,due_date,warranty_days,rental_end_at,status,notes,public_note,refund_amount,payment_status,source_key)
    values(auth.uid(),tracking,x->>'buyer',coalesce(x->>'buyer_wa',''),x->>'product_name',coalesce(x->>'variant',''),coalesce(x->>'duration',''),
      (x->>'price')::bigint,(x->>'cost')::bigint,(x->>'quantity')::integer,coalesce(x->>'supplier',''),coalesce(x->>'supplier_admin',''),coalesce(x->>'device',''),coalesce(x->>'location',''),
      (x->>'order_date')::date,(x->>'order_at')::timestamptz,coalesce(x->>'due_date',''),(x->>'warranty_days')::integer,(x->>'rental_end_at')::timestamptz,
      x->>'status',coalesce(x->>'notes',''),coalesce(x->>'public_note',''),(x->>'refund_amount')::bigint,x->>'payment_status',x->>'source_key') returning id into oid;
    c=x->'canva';
    if c is not null then
      if length(c->>'email')>254 or c->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Email Canva tidak valid.'; end if;
      insert into public.canva_teams(owner_id,name,invite_url) values(auth.uid(),c->>'team',coalesce(c->>'invite_url','')) on conflict(owner_id,name) do nothing;
      select id into tid from public.canva_teams where owner_id=auth.uid() and name=c->>'team';
      insert into public.canva_subscriptions(owner_id,order_id,team_id,email,months,renewal_index) values(auth.uid(),oid,tid,c->>'email',(c->>'months')::integer,(c->>'renewal_index')::integer) returning id into sid;
      for l in select value from jsonb_array_elements(p_logs) where value->>'old_id'=c->>'old_id' loop
        insert into public.canva_renewal_logs(owner_id,subscription_id,renewal_index,created_at) values(auth.uid(),sid,(l->>'index')::integer,(l->>'created_at')::timestamptz) on conflict do nothing;
      end loop;
    end if;
    imported=imported+1;
  end loop;
  return jsonb_build_object('imported',imported,'skipped',skipped);
end;
$$;
revoke all on function public.import_miuu_orders(jsonb,jsonb) from public,anon;
grant execute on function public.import_miuu_orders(jsonb,jsonb) to authenticated;
commit;
