-- ============================================================
-- ParkIt UCC — Vistas de métricas para el Admin Dashboard
-- Pegá esto en el SQL Editor de Supabase
-- ============================================================

-- 1. OCUPACIÓN EN TIEMPO REAL POR ZONA
create or replace view public.v_zone_occupancy as
select
  z.id                                                        as zone_id,
  z.name,
  z.total_spots,
  count(*) filter (where s.status = 'available')              as available,
  count(*) filter (where s.status = 'occupied')               as occupied,
  count(*) filter (where s.status = 'reported')               as reported,
  round(
    count(*) filter (where s.status = 'occupied')::numeric
    / nullif(z.total_spots, 0) * 100, 1
  )                                                           as occupancy_pct
from public.parking_zones z
join public.parking_spots s on s.zone_id = z.id
group by z.id, z.name, z.total_spots
order by z.id;

-- 2. DEMANDA HORARIA (últimos 30 días — hora local Argentina)
create or replace view public.v_hourly_demand as
select
  extract(hour from created_at at time zone 'America/Argentina/Cordoba')::int as hour,
  count(*) as claims
from public.parking_events
where action = 'claim'
  and created_at >= now() - interval '30 days'
group by hour
order by hour;

-- 3. TIEMPO PROMEDIO DE ESTADÍA POR ZONA
create or replace view public.v_avg_stay as
select
  zone_id,
  round(avg(duration_minutes), 1)                            as avg_minutes,
  round(avg(duration_minutes) / 60.0, 2)                    as avg_hours,
  count(*)                                                   as total_sessions
from public.parking_events
where action = 'release'
  and duration_minutes is not null
  and duration_minutes > 0
group by zone_id
order by zone_id;

-- 4. ROTACIÓN POR ZONA (claims hoy)
create or replace view public.v_zone_turnover as
select
  zone_id,
  count(*) filter (where action = 'claim')   as claims_today,
  count(*) filter (where action = 'release') as releases_today,
  round(
    count(*) filter (where action = 'claim')::numeric
    / nullif(count(distinct spot_id), 0), 2
  )                                          as turnover_rate
from public.parking_events
where created_at >= current_date
group by zone_id
order by claims_today desc;

-- 5. TASA DE REPORTES POR ZONA (últimos 7 días)
create or replace view public.v_report_rate as
select
  z.id                                                          as zone_id,
  z.name,
  z.total_spots,
  count(r.id)                                                   as reports_7d,
  round(count(r.id)::numeric / nullif(z.total_spots, 0) * 100, 1) as report_rate_pct
from public.parking_zones z
left join public.spot_reports r
  on r.zone_id = z.id
  and r.created_at >= now() - interval '7 days'
group by z.id, z.name, z.total_spots
order by report_rate_pct desc;

-- 6. USUARIOS ACTIVOS DIARIOS (últimos 30 días)
create or replace view public.v_dau as
select
  date(created_at at time zone 'America/Argentina/Cordoba') as day,
  count(distinct user_id)                                   as active_users,
  count(*)                                                  as total_actions
from public.parking_events
where created_at >= now() - interval '30 days'
group by day
order by day;

-- 7. DEMANDA POR ZONA Y FRANJA HORARIA
create or replace view public.v_zone_demand_slots as
select
  zone_id,
  case
    when extract(hour from created_at at time zone 'America/Argentina/Cordoba') between 7  and 9  then '07–09'
    when extract(hour from created_at at time zone 'America/Argentina/Cordoba') between 10 and 12 then '10–12'
    when extract(hour from created_at at time zone 'America/Argentina/Cordoba') between 13 and 15 then '13–15'
    when extract(hour from created_at at time zone 'America/Argentina/Cordoba') between 16 and 18 then '16–18'
    when extract(hour from created_at at time zone 'America/Argentina/Cordoba') between 19 and 21 then '19–21'
    else 'Otro'
  end as time_slot,
  count(*) as claims
from public.parking_events
where action = 'claim'
  and created_at >= now() - interval '30 days'
group by zone_id, time_slot
order by zone_id, time_slot;

-- 8. TASA DE PRECISIÓN DEL SISTEMA (últimos 7 días)
-- Proporción de claims que NO generaron un reporte en la hora siguiente
create or replace view public.v_system_accuracy as
select
  count(*)                                                        as total_claims,
  count(*) filter (where r.id is null)                            as clean_claims,
  round(
    count(*) filter (where r.id is null)::numeric
    / nullif(count(*), 0) * 100, 1
  )                                                               as accuracy_pct
from public.parking_events e
left join public.spot_reports r
  on r.spot_id = e.spot_id
  and r.created_at between e.created_at and e.created_at + interval '1 hour'
where e.action = 'claim'
  and e.created_at >= now() - interval '7 days';

-- 9. RESUMEN GLOBAL (una sola fila para los KPI cards)
create or replace view public.v_summary as
select
  (select count(*) from public.parking_spots where status = 'available')  as spots_available,
  (select count(*) from public.parking_spots where status = 'occupied')   as spots_occupied,
  (select count(*) from public.parking_spots where status = 'reported')   as spots_reported,
  (select count(*) from public.parking_spots)                             as spots_total,
  (select count(distinct user_id)
     from public.parking_events
    where created_at >= current_date)                                     as users_today,
  (select count(distinct user_id)
     from public.parking_events
    where created_at >= now() - interval '30 days')                       as users_mau,
  (select count(*)
     from public.spot_reports
    where created_at >= now() - interval '7 days')                        as reports_7d,
  (select round(avg(duration_minutes), 1)
     from public.parking_events
    where action = 'release' and duration_minutes > 0)                    as avg_stay_minutes;

-- 10. USUARIOS SIN ESTACIONAR NUNCA (potencial churn / baja adopción)
create or replace view public.v_inactive_users as
select
  p.id,
  p.name,
  p.email,
  p.created_at                                               as registered_at,
  max(e.created_at)                                          as last_activity,
  count(e.id) filter (where e.action = 'claim')              as total_claims
from public.profiles p
left join public.parking_events e on e.user_id = p.id
where p.role = 'user'
group by p.id, p.name, p.email, p.created_at
having count(e.id) filter (where e.action = 'claim') = 0
order by p.created_at desc;

-- ── RLS para las vistas (solo admins) ─────────────────────────────
-- Las vistas heredan RLS de las tablas base, pero agregamos
-- una función helper para verificar rol admin fácilmente.

create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;
