do $$
declare
  admin_user uuid;
  w1 uuid;
  w2 uuid;
  z1 uuid;
  z2 uuid;
  z3 uuid;
  c1 uuid;
  c2 uuid;
  p1 uuid;
  p2 uuid;
begin
  select id into admin_user from auth.users order by created_at asc limit 1;

  insert into public.warehouses (code, name, city, country, has_cool_zone, created_by)
  values
    ('W1', 'Bridgetown Primary', 'Bridgetown', 'Barbados', true, admin_user),
    ('W2', 'Seawell Overflow', 'Christ Church', 'Barbados', false, admin_user)
  on conflict (code) do update set name = excluded.name;

  select id into w1 from public.warehouses where code = 'W1';
  select id into w2 from public.warehouses where code = 'W2';

  insert into public.zones (warehouse_id, code, name, temperature_class, sort_order, is_staging, is_dispatch, is_quarantine, created_by)
  values
    (w1, 'AMB', 'Ambient Rack', 'ambient', 1, false, false, false, admin_user),
    (w1, 'COOL', 'Cool Zone', 'cool', 2, false, false, false, admin_user),
    (w1, 'DSTG', 'Dispatch Staging', 'ambient', 3, true, true, false, admin_user),
    (w1, 'QTN', 'Quarantine', 'ambient', 4, false, false, true, admin_user),
    (w2, 'AMB', 'Overflow Rack', 'ambient', 1, false, false, false, admin_user),
    (w2, 'DSTG', 'Overflow Dispatch', 'ambient', 2, true, true, false, admin_user)
  on conflict (warehouse_id, code) do update set name = excluded.name;

  select id into z1 from public.zones where warehouse_id = w1 and code = 'AMB';
  select id into z2 from public.zones where warehouse_id = w1 and code = 'COOL';
  select id into z3 from public.zones where warehouse_id = w1 and code = 'DSTG';

  insert into public.locations (
    warehouse_id, zone_id, code, aisle, bay, level, depth, location_type, temperature_class,
    max_length, max_width, max_height, max_weight, max_pallets, pick_sequence, putaway_sequence, created_by
  )
  values
    (w1, z1, 'W1-AMB-A01-B01-L01-D1', 'A01', 'B01', 1, 1, 'rack', 'ambient', 120, 100, 180, 1200, 1, 10, 10, admin_user),
    (w1, z1, 'W1-AMB-A01-B01-L01-D2', 'A01', 'B01', 1, 2, 'rack', 'ambient', 120, 100, 180, 1200, 1, 20, 20, admin_user),
    (w1, z2, 'W1-COOL-A03-B12-L04-D1', 'A03', 'B12', 4, 1, 'rack', 'cool', 120, 100, 180, 1000, 1, 30, 30, admin_user),
    (w1, z2, 'W1-COOL-A03-B12-L04-D2', 'A03', 'B12', 4, 2, 'rack', 'cool', 120, 100, 180, 1000, 1, 40, 40, admin_user),
    (w1, z3, 'W1-DSTG-S01-B01-L01-D1', 'S01', 'B01', 1, 1, 'dispatch', 'ambient', 120, 100, 180, 1200, 6, 5, 5, admin_user)
  on conflict (code) do nothing;

  insert into public.clients (code, name, allow_mixed_stock, require_expiry, created_by)
  values
    ('ARCTIC', 'Arctic Foods', false, true, admin_user),
    ('ISLAND', 'Island Retail', true, false, admin_user)
  on conflict (code) do update set name = excluded.name;

  select id into c1 from public.clients where code = 'ARCTIC';
  select id into c2 from public.clients where code = 'ISLAND';

  insert into public.products (
    sku, barcode, name, description, client_owner_id, product_family, temperature_requirement,
    length, width, height, weight, stackable, max_stack_height, lot_tracked, batch_tracked, expiry_tracked, rotation_method, created_by
  )
  values
    ('ICE-CRM-01', '100000000001', 'Ice Cream Tub 5L', 'Frozen dairy product', c1, 'Frozen Goods', 'cool', 40, 30, 25, 12.5, true, 4, true, true, true, 'fefo', admin_user),
    ('RICE-25KG', '100000000002', 'Rice Sack 25kg', 'Dry goods', c2, 'Dry Goods', 'ambient', 80, 50, 20, 25, true, 2, true, false, false, 'fifo', admin_user)
  on conflict (sku) do update set name = excluded.name;

  select id into p1 from public.products where sku = 'ICE-CRM-01';
  select id into p2 from public.products where sku = 'RICE-25KG';

  insert into public.product_packaging_profiles (
    product_id, profile_name, package_type, units_per_package, length, width, height, weight, is_default, created_by
  )
  values
    (p1, 'Pallet', 'pallet', 48, 120, 100, 160, 600, true, admin_user),
    (p1, 'Carton', 'carton', 6, 40, 30, 25, 12.5, false, admin_user),
    (p2, 'Pallet', 'pallet', 40, 120, 100, 140, 1000, true, admin_user),
    (p2, 'Unit', 'unit', 1, 80, 50, 20, 25, false, admin_user)
  on conflict (product_id, profile_name) do update set package_type = excluded.package_type;

  if admin_user is not null then
    insert into public.user_roles (user_id, role_id, warehouse_id)
    select admin_user, r.id, null
    from public.roles r
    where r.code = 'admin'
    on conflict (user_id, role_id, warehouse_id) do nothing;

    update public.profiles
    set full_name = coalesce(full_name, 'System Admin'),
        default_warehouse_id = w1
    where id = admin_user;
  end if;
end;
$$;
