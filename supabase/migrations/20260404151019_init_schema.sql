-- ── Tablas ────────────────────────────────────────────────────────────────

create table public.profiles (
  id         uuid references auth.users(id) on delete cascade primary key,
  email      text not null,
  name       text,
  role       text not null default 'user',
  created_at timestamptz not null default now(),
  constraint valid_role check (role in ('user', 'admin'))
);

create table public.parking_zones (
  id          text primary key,
  name        text not null,
  total_spots int  not null,
  polygon     jsonb not null,
  center      jsonb not null,
  created_at  timestamptz not null default now()
);

create table public.parking_spots (
  id         text primary key,
  zone_id    text not null references public.parking_zones(id),
  number     int  not null,
  status     text not null default 'available',
  updated_at timestamptz not null default now(),
  constraint valid_status check (status in ('available', 'occupied', 'reported'))
);

create table public.parking_events (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id),
  spot_id          text not null references public.parking_spots(id),
  zone_id          text not null references public.parking_zones(id),
  action           text not null,
  duration_minutes int,
  created_at       timestamptz not null default now(),
  constraint valid_action check (action in ('claim', 'release'))
);

create table public.spot_reports (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id),
  spot_id    text not null references public.parking_spots(id),
  zone_id    text not null references public.parking_zones(id),
  type       text not null,
  resolved   boolean not null default false,
  created_at timestamptz not null default now(),
  constraint valid_type check (type in ('occupied_but_free', 'free_but_occupied'))
);

-- ── Trigger: perfil automático al registrarse ─────────────────────────────

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'name',
      initcap(replace(split_part(new.email, '@', 1), '.', ' '))
    )
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Helper: chequeo de admin sin recursión ────────────────────────────────
-- security definer hace que la función corra con los permisos del owner
-- (postgres), bypasseando RLS al consultar profiles desde las políticas.

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ── Row Level Security ─────────────────────────────────────────────────────

alter table public.profiles       enable row level security;
alter table public.parking_zones  enable row level security;
alter table public.parking_spots  enable row level security;
alter table public.parking_events enable row level security;
alter table public.spot_reports   enable row level security;

create policy "users_read_own_profile" on public.profiles
  for select using (auth.uid() = id);

create policy "admins_read_all_profiles" on public.profiles
  for select using (public.is_admin());

create policy "auth_read_zones" on public.parking_zones
  for select using (auth.role() = 'authenticated');

create policy "auth_read_spots" on public.parking_spots
  for select using (auth.role() = 'authenticated');

create policy "auth_update_spots" on public.parking_spots
  for update using (auth.role() = 'authenticated');

create policy "users_insert_own_events" on public.parking_events
  for insert with check (auth.uid() = user_id);

create policy "users_read_own_events" on public.parking_events
  for select using (auth.uid() = user_id);

create policy "admins_read_all_events" on public.parking_events
  for select using (public.is_admin());

create policy "users_insert_own_reports" on public.spot_reports
  for insert with check (auth.uid() = user_id);

create policy "users_read_own_reports" on public.spot_reports
  for select using (auth.uid() = user_id);

create policy "admins_read_all_reports" on public.spot_reports
  for select using (public.is_admin());

-- ── Realtime ───────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.parking_spots;

-- ── Seed: zonas y lugares ─────────────────────────────────────────────────

insert into public.parking_zones (id, name, total_spots, center, polygon) values
('A', 'Estacionamiento Norte', 128,
  '{"latitude": -31.485889, "longitude": -64.240413}',
  '[{"latitude":-31.485669,"longitude":-64.240683},{"latitude":-31.485658,"longitude":-64.240150},{"latitude":-31.486117,"longitude":-64.240147},{"latitude":-31.486114,"longitude":-64.240672}]'),
('B', 'Zona B', 50,
  '{"latitude": -31.486446, "longitude": -64.240339}',
  '[{"latitude":-31.486275,"longitude":-64.240657},{"latitude":-31.486292,"longitude":-64.240010},{"latitude":-31.486615,"longitude":-64.240040},{"latitude":-31.486617,"longitude":-64.240667}]'),
('C', 'Zona C', 50,
  '{"latitude": -31.487814, "longitude": -64.240162}',
  '[{"latitude":-31.487700,"longitude":-64.240620},{"latitude":-31.487718,"longitude":-64.239694},{"latitude":-31.487916,"longitude":-64.239747},{"latitude":-31.487927,"longitude":-64.240630}]'),
('D', 'Zona D', 50,
  '{"latitude": -31.487787, "longitude": -64.241338}',
  '[{"latitude":-31.487659,"longitude":-64.241776},{"latitude":-31.487653,"longitude":-64.240920},{"latitude":-31.487921,"longitude":-64.240899},{"latitude":-31.487916,"longitude":-64.241771}]'),
('E', 'Zona E', 50,
  '{"latitude": -31.487763, "longitude": -64.242987}',
  '[{"latitude":-31.487626,"longitude":-64.243130},{"latitude":-31.487645,"longitude":-64.241873},{"latitude":-31.487900,"longitude":-64.241845},{"latitude":-31.487886,"longitude":-64.243124}]'),
('F', 'Zona F', 50,
  '{"latitude": -31.488149, "longitude": -64.242588}',
  '[{"latitude":-31.488038,"longitude":-64.243370},{"latitude":-31.488061,"longitude":-64.241815},{"latitude":-31.488258,"longitude":-64.241794},{"latitude":-31.488259,"longitude":-64.243382}]'),
('G', 'Zona G', 50,
  '{"latitude": -31.488176, "longitude": -64.240534}',
  '[{"latitude":-31.488038,"longitude":-64.241755},{"latitude":-31.488066,"longitude":-64.240364},{"latitude":-31.488315,"longitude":-64.240313},{"latitude":-31.488245,"longitude":-64.241737}]');

insert into public.parking_spots (id, zone_id, number, status)
select 'A' || n, 'A', n, 'available'
from generate_series(1, 128) as n;

insert into public.parking_spots (id, zone_id, number, status)
select z.id || n, z.id, n, 'available'
from (values ('B'), ('C'), ('D'), ('E'), ('F'), ('G')) as z(id)
cross join generate_series(1, 50) as n;
