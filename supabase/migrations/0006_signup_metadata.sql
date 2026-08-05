-- ════════════════════════════════════════════════════════════════════════════
-- Comly — carry signup choices into the profile row
--
-- handle_new_user() only read `name` and `neighborhood` from the signup
-- metadata, so two fields chosen on the sign-up screen were silently dropped:
--
--   • roles      — every account landed as 'customer', so a user who signed up
--                  to help had no helper role and the feed they came for was
--                  unreachable.
--   • age_group  — every account defaulted to 'adult'. Combined with 0005
--                  pinning the column against self-service edits, a teen had
--                  no path to being recorded as a teen at all, and 0004's
--                  safety gate would wave them through 18+ work.
--
-- Both are validated here rather than trusted verbatim: raw_user_meta_data is
-- client-supplied, so an unexpected value must fall back to the safest option
-- rather than reach an enum cast.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role   text;
  v_age    text;
  v_roles  user_role[];
begin
  v_role := coalesce(new.raw_user_meta_data->'roles'->>0, 'customer');
  if v_role not in ('customer', 'helper') then
    v_role := 'customer';
  end if;
  v_roles := array[v_role]::user_role[];

  -- Default to 'teen' when the value is absent or unrecognized: over-protecting
  -- an adult costs them a parent-approval prompt, while under-protecting a
  -- minor exposes them to 18+ work.
  v_age := coalesce(new.raw_user_meta_data->>'age_group', 'teen');
  if v_age not in ('teen', 'adult') then
    v_age := 'teen';
  end if;

  insert into public.profiles (id, name, neighborhood, roles, age_group)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'neighborhood', ''),
    v_roles,
    v_age::age_group
  );

  insert into public.verification_status (user_id, email_verified)
  values (new.id, new.email_confirmed_at is not null);

  insert into public.profiles_private (user_id)
  values (new.id);

  return new;
end;
$$;

-- Keep email_verified honest: Supabase stamps email_confirmed_at when the user
-- clicks the confirmation link, which happens after the row above is created.
-- 0005 blocks users from setting this flag themselves, so nothing would ever
-- flip it without this.
create or replace function sync_email_verified()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.verification_status
    set email_verified = true
    where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_email_verified on auth.users;
create trigger trg_sync_email_verified
  after update on auth.users
  for each row execute function sync_email_verified();
