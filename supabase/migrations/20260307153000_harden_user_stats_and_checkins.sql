begin;

create or replace function public.sync_user_email()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $function$
begin
  if new.email is null then
    new.email := (select au.email from auth.users au where au.id = new.id);
  end if;

  if session_user in ('anon', 'authenticated') then
    new.points := 0;
    new.checkin_count := 0;
    new.total_minutes := 0;
    new.is_admin := false;
    new.is_super_admin := false;
    new.approval_status := 'pending';
    new.approved_at := null;
    new.approved_by := null;
    new.reservation_strikes := 0;
    new.reservation_restricted_until := null;
  end if;

  return new;
end;
$function$;

create or replace function public.protect_user_approval_fields()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if current_user = 'authenticated' then
    if new.student_id is distinct from old.student_id
      or new.grade is distinct from old.grade
      or new.email is distinct from old.email
      or new.points is distinct from old.points
      or new.checkin_count is distinct from old.checkin_count
      or new.created_at is distinct from old.created_at
      or new.is_admin is distinct from old.is_admin
      or new.total_minutes is distinct from old.total_minutes
      or new.approval_status is distinct from old.approval_status
      or new.approved_at is distinct from old.approved_at
      or new.approved_by is distinct from old.approved_by
      or new.reservation_strikes is distinct from old.reservation_strikes
      or new.reservation_restricted_until is distinct from old.reservation_restricted_until
      or new.is_super_admin is distinct from old.is_super_admin then
      raise exception 'Only basic profile fields can be updated directly';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.checkin_requires_active_reservation()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  has_reservation boolean;
begin
  if auth.uid() is null then
    raise exception '请先登录';
  end if;

  new.user_id := auth.uid();
  new.checked_at := now();
  new.checked_out_at := null;
  new.check_date := current_date;
  new.time_slot := 'allday';

  if new.seat_id is null then
    raise exception '必须先预约座位后再签到';
  end if;

  if exists (
    select 1
    from public.checkins c
    where c.user_id = new.user_id
      and c.checked_out_at is null
  ) then
    raise exception '存在未签退记录，请先完成签退';
  end if;

  select exists(
    select 1
    from public.reservations r
    where r.user_id = new.user_id
      and r.reserve_date = new.check_date
      and r.seat_id = new.seat_id
      and r.status = 'active'
  ) into has_reservation;

  if not has_reservation then
    raise exception '请先预约该座位后再签到';
  end if;

  return new;
end;
$function$;

create or replace function public.checkout_checkin(p_checkin_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_actor_id uuid;
  v_user_id uuid;
  v_checked_at timestamptz;
  v_check_date date;
  v_minutes integer;
  v_today_minutes integer;
  v_daily_factor numeric;
  v_points_gain numeric;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception '请先登录';
  end if;

  select user_id, checked_at, check_date into v_user_id, v_checked_at, v_check_date
  from public.checkins
  where id = p_checkin_id and checked_out_at is null;

  if not found then
    raise exception 'Checkin not found or already checked out';
  end if;

  if v_user_id <> v_actor_id then
    raise exception '只能签退自己的签到记录';
  end if;

  v_minutes := greatest(0, extract(epoch from (now() - v_checked_at)) / 60)::integer;

  select coalesce(sum(greatest(0, extract(epoch from (c.checked_out_at - c.checked_at)) / 60)), 0)::integer
    into v_today_minutes
  from public.checkins c
  where c.user_id = v_user_id
    and c.check_date = v_check_date
    and c.checked_out_at is not null;

  v_daily_factor := 1 + least((v_today_minutes + v_minutes)::numeric, 480) / 480;
  v_points_gain := round((v_minutes::numeric / 60) * v_daily_factor, 2);

  update public.checkins
  set checked_out_at = now()
  where id = p_checkin_id;

  update public.users
  set total_minutes = total_minutes + v_minutes,
      points = round((coalesce(points, 0) + v_points_gain)::numeric, 2)
  where id = v_user_id;
end;
$function$;

drop policy if exists checkins_update_own on public.checkins;
drop policy if exists checkins_delete_own on public.checkins;

update public.checkins
set checked_out_at = checked_at
where user_id = (
  select id from public.users where student_id = '2024124151'
)
  and checked_out_at is null;

update public.users
set total_minutes = 600,
    points = 15.00
where student_id = '2024124151';

commit;
