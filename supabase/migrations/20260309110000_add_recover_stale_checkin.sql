begin;

create or replace function public.recover_stale_checkin()
returns bigint
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_actor_id uuid;
  v_today date;
  v_checkin_id bigint;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception '请先登录';
  end if;

  v_today := (now() at time zone 'Asia/Shanghai')::date;

  select c.id
    into v_checkin_id
  from public.checkins c
  where c.user_id = v_actor_id
    and c.checked_out_at is null
    and c.check_date < v_today
  order by c.checked_at desc
  limit 1;

  if v_checkin_id is null then
    return null;
  end if;

  update public.checkins
  set checked_out_at = checked_at
  where id = v_checkin_id
    and user_id = v_actor_id
    and checked_out_at is null;

  return v_checkin_id;
end;
$function$;

grant execute on function public.recover_stale_checkin() to authenticated;

commit;
