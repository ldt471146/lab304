begin;

create or replace function public.admin_set_user_reservation_strikes(
  target_user_id uuid,
  p_reservation_strikes integer
)
returns table (
  id uuid,
  reservation_strikes integer,
  reservation_restricted_until date
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_actor_id uuid;
  v_actor_is_admin boolean;
  v_actor_is_super_admin boolean;
  v_target_is_super_admin boolean;
  v_threshold integer;
  v_next_strikes integer;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception '请先登录';
  end if;

  select coalesce(actor.is_admin, false), coalesce(actor.is_super_admin, false)
    into v_actor_is_admin, v_actor_is_super_admin
  from public.users as actor
  where actor.id = v_actor_id;

  if not coalesce(v_actor_is_admin, false) and not coalesce(v_actor_is_super_admin, false) then
    raise exception '仅管理员可修改标记次数';
  end if;

  select coalesce(target.is_super_admin, false)
    into v_target_is_super_admin
  from public.users as target
  where target.id = target_user_id;

  if not found then
    raise exception '目标用户不存在';
  end if;

  if v_target_is_super_admin and not v_actor_is_super_admin then
    raise exception '仅超级管理员可修改超级管理员标记';
  end if;

  v_next_strikes := greatest(0, coalesce(p_reservation_strikes, 0));

  select coalesce(rr.strike_threshold, 3)
    into v_threshold
  from public.reservation_rules as rr
  where rr.id = true;

  update public.users as u
  set reservation_strikes = v_next_strikes,
      reservation_restricted_until = case
        when v_next_strikes < coalesce(v_threshold, 3) then null
        else u.reservation_restricted_until
      end
  where u.id = target_user_id;

  return query
  select u.id, u.reservation_strikes, u.reservation_restricted_until
  from public.users as u
  where u.id = target_user_id;
end;
$function$;

commit;
