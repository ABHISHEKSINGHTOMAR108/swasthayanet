
-- ROLES
create type public.app_role as enum ('staff','officer','admin');

create table public.phcs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  district text not null,
  state text not null,
  lat double precision not null,
  lng double precision not null,
  beds_total int not null default 30,
  created_at timestamptz not null default now()
);

create table public.medicines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null,
  base_qty int not null default 600,
  daily_burn int not null default 20
);

create table public.profiles (
  id uuid primary key,
  name text not null default '',
  email text not null default '',
  role public.app_role not null default 'staff',
  phc_id uuid references public.phcs(id),
  district text,
  state text,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  unique (user_id, role)
);

create table public.stock_entries (
  id uuid primary key default gen_random_uuid(),
  phc_id uuid not null references public.phcs(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id) on delete cascade,
  quantity int not null,
  recorded_at timestamptz not null default now(),
  recorded_by uuid
);
create index stock_entries_idx on public.stock_entries (phc_id, medicine_id, recorded_at);

create table public.bed_status (
  id uuid primary key default gen_random_uuid(),
  phc_id uuid not null references public.phcs(id) on delete cascade,
  beds_occupied int not null,
  recorded_at timestamptz not null default now()
);

create table public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  phc_id uuid not null references public.phcs(id) on delete cascade,
  staff_present_pct numeric not null,
  recorded_at timestamptz not null default now()
);

create table public.redistribution_requests (
  id uuid primary key default gen_random_uuid(),
  from_phc_id uuid not null references public.phcs(id) on delete cascade,
  to_phc_id uuid not null references public.phcs(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id) on delete cascade,
  units int not null,
  distance_km numeric not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  approved_by uuid
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  phc_id uuid not null references public.phcs(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id) on delete cascade,
  severity text not null,
  days_remaining numeric not null,
  created_at timestamptz not null default now(),
  resolved boolean not null default false
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  details text,
  created_at timestamptz not null default now()
);

-- GRANTS
grant select on public.phcs to authenticated, anon;
grant select on public.medicines to authenticated, anon;
grant select, insert, update on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select, insert on public.stock_entries to authenticated;
grant select, insert on public.bed_status to authenticated;
grant select, insert on public.staff_attendance to authenticated;
grant select, insert, update on public.redistribution_requests to authenticated;
grant select, insert, update on public.alerts to authenticated;
grant select, insert on public.audit_log to authenticated;
grant all on public.phcs, public.medicines, public.profiles, public.user_roles,
  public.stock_entries, public.bed_status, public.staff_attendance,
  public.redistribution_requests, public.alerts, public.audit_log to service_role;

-- HELPERS
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.my_phc_id()
returns uuid language sql stable security definer set search_path = public as $$
  select phc_id from public.profiles where id = auth.uid()
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.app_role;
begin
  r := coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'staff');
  insert into public.profiles (id, name, email, role, phc_id, district, state)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name',''),
    coalesce(new.email,''),
    r,
    nullif(new.raw_user_meta_data->>'phc_id','')::uuid,
    (select district from public.phcs where id = nullif(new.raw_user_meta_data->>'phc_id','')::uuid),
    (select state from public.phcs where id = nullif(new.raw_user_meta_data->>'phc_id','')::uuid)
  );
  insert into public.user_roles (user_id, role) values (new.id, r) on conflict do nothing;
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- RLS
alter table public.phcs enable row level security;
alter table public.medicines enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.stock_entries enable row level security;
alter table public.bed_status enable row level security;
alter table public.staff_attendance enable row level security;
alter table public.redistribution_requests enable row level security;
alter table public.alerts enable row level security;
alter table public.audit_log enable row level security;

create policy "phcs readable" on public.phcs for select to authenticated, anon using (true);
create policy "medicines readable" on public.medicines for select to authenticated, anon using (true);

create policy "own profile read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'officer') or public.has_role(auth.uid(),'admin'));
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "own roles read" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create policy "stock read" on public.stock_entries for select to authenticated using (true);
create policy "stock insert own phc" on public.stock_entries for insert to authenticated
  with check (phc_id = public.my_phc_id() or public.has_role(auth.uid(),'admin'));

create policy "beds read" on public.bed_status for select to authenticated using (true);
create policy "beds insert own phc" on public.bed_status for insert to authenticated
  with check (phc_id = public.my_phc_id() or public.has_role(auth.uid(),'admin'));

create policy "att read" on public.staff_attendance for select to authenticated using (true);
create policy "att insert own phc" on public.staff_attendance for insert to authenticated
  with check (phc_id = public.my_phc_id() or public.has_role(auth.uid(),'admin'));

create policy "redis read" on public.redistribution_requests for select to authenticated using (true);
create policy "redis insert" on public.redistribution_requests for insert to authenticated with check (true);
create policy "redis update by officer" on public.redistribution_requests for update to authenticated
  using (public.has_role(auth.uid(),'officer') or public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'officer') or public.has_role(auth.uid(),'admin'));

create policy "alerts read" on public.alerts for select to authenticated using (true);
create policy "alerts insert" on public.alerts for insert to authenticated with check (true);
create policy "alerts update" on public.alerts for update to authenticated using (true) with check (true);

create policy "audit read" on public.audit_log for select to authenticated using (true);
create policy "audit insert" on public.audit_log for insert to authenticated with check (true);

-- REALTIME
alter table public.alerts replica identity full;
alter table public.redistribution_requests replica identity full;
alter publication supabase_realtime add table public.alerts;
alter publication supabase_realtime add table public.redistribution_requests;

-- SEED
insert into public.medicines (name, unit, base_qty, daily_burn) values
 ('Paracetamol 500mg','tablets',1800,60),
 ('Amoxicillin 250mg','capsules',1200,42),
 ('ORS Sachets','sachets',900,34),
 ('Insulin (Regular)','vials',300,11),
 ('Iron & Folic Acid','tablets',1500,48),
 ('Anti-Rabies Vaccine','doses',180,6);

insert into public.phcs (name, district, state, lat, lng, beds_total) values
 ('PHC Bhopal Central','Bhopal','Madhya Pradesh',23.2599,77.4126,40),
 ('PHC Indore Rural','Indore','Madhya Pradesh',22.7196,75.8577,30),
 ('PHC Gwalior North','Gwalior','Madhya Pradesh',26.2183,78.1828,26),
 ('PHC Jabalpur East','Jabalpur','Madhya Pradesh',23.1815,79.9864,24),
 ('PHC Jaipur South','Jaipur','Rajasthan',26.9124,75.7873,44),
 ('PHC Jodhpur Rural','Jodhpur','Rajasthan',26.2389,73.0243,28),
 ('PHC Udaipur Hills','Udaipur','Rajasthan',24.5854,73.7125,22),
 ('PHC Kota Industrial','Kota','Rajasthan',25.2138,75.8648,30),
 ('PHC Patna Sadar','Patna','Bihar',25.5941,85.1376,46),
 ('PHC Gaya West','Gaya','Bihar',24.7955,84.9994,26),
 ('PHC Muzaffarpur North','Muzaffarpur','Bihar',26.1209,85.3647,24),
 ('PHC Bhagalpur Riverside','Bhagalpur','Bihar',25.2425,86.9842,20),
 ('PHC Pune Rural','Pune','Maharashtra',18.5204,73.8567,42),
 ('PHC Nagpur East','Nagpur','Maharashtra',21.1458,79.0882,32),
 ('PHC Nashik Valley','Nashik','Maharashtra',19.9975,73.7898,26),
 ('PHC Guwahati Central','Kamrup','Assam',26.1445,91.7362,36),
 ('PHC Dibrugarh North','Dibrugarh','Assam',27.4728,94.9120,22),
 ('PHC Silchar South','Cachar','Assam',24.8333,92.7789,20);

insert into public.stock_entries (phc_id, medicine_id, quantity, recorded_at)
select p.id, m.id,
  greatest(0, round(
    (m.base_qty * (0.6 + (abs(hashtext(p.id::text || m.id::text)) % 70)/100.0))
    - d * (m.daily_burn * (0.55 + (abs(hashtext(m.id::text || p.id::text || 'b')) % 130)/100.0))
    + ((abs(hashtext(p.id::text || m.id::text || d::text)) % 31) - 15)
  ))::int,
  (now() - ((29 - d) || ' days')::interval)
from public.phcs p cross join public.medicines m cross join generate_series(0,29) d;

insert into public.bed_status (phc_id, beds_occupied, recorded_at)
select p.id,
  least(p.beds_total, greatest(0, round(p.beds_total * (0.45 + (abs(hashtext(p.id::text || d::text)) % 45)/100.0))::int)),
  (now() - ((29 - d) || ' days')::interval)
from public.phcs p cross join generate_series(0,29) d;

insert into public.staff_attendance (phc_id, staff_present_pct, recorded_at)
select p.id, 60 + (abs(hashtext(p.id::text || d::text || 's')) % 40),
  (now() - ((29 - d) || ' days')::interval)
from public.phcs p cross join generate_series(0,29) d;
