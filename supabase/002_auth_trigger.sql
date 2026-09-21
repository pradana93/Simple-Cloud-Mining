-- 002: auto-create profile + free plan on signup.
-- Fixes "new row violates row-level security policy for table profiles":
-- at signup the client has no session yet (email confirmation), so it can
-- never satisfy auth.uid() = id. Creation moves server-side via trigger.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_name text;
  final_name text;
  uid int;
  tries int := 0;
  default_plan_id bigint;
  default_duration int;
begin
  base_name := coalesce(
    nullif(new.raw_user_meta_data->>'username', ''),
    split_part(new.email, '@', 1),
    'miner'
  );
  base_name := substring(base_name from 1 for 40);
  loop
    tries := tries + 1;
    uid := (10000 + floor(random() * 89999))::int;
    final_name := case when tries = 1 then base_name else (base_name || '_' || tries::text) end;
    begin
      insert into public.profiles (id, username, email, unique_id)
      values (new.id, final_name, new.email, uid);
      exit;
    exception when unique_violation then
      if tries >= 10 then raise; end if;
    end;
  end loop;

  select p.id, p.duration into default_plan_id, default_duration
  from public.plans p where p.is_default = true order by p.id limit 1;

  if default_plan_id is not null
     and not exists (select 1 from public.user_plan_history where user_id = new.id and status = 'active') then
    insert into public.user_plan_history (user_id, plan_id, status, expire_date, last_sum)
    values (new.id, default_plan_id, 'active', now() + (default_duration || ' days')::interval, now());
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Belt & suspenders: logged-in users may insert their own profile row
-- (covers the email-confirmation-off flow where a session exists at signup).
drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles
  for insert with check (auth.uid() = id);
