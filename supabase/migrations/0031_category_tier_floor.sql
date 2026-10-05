-- ════════════════════════════════════════════════════════════════════════════
-- Comly — category tier floor (babysitting ≥ adult_supervision)
--
-- The keyword floor (0027) can only raise a job's tier based on its wording,
-- and "watch my two kids Friday night" contains nothing it flags. Caring for
-- children should never be something a minor accepts without a parent
-- knowing, so babysitting jobs are held to adult_supervision at minimum: any
-- minor needs parent approval to apply (the applications INSERT policy in
-- 0018, and accept_application / invite_helper_to_job in 0028); adults are
-- unaffected.
--
-- Mirrors CATEGORY_TIER_FLOOR / applyCategoryTierFloor() in
-- src/types/domain.ts. The client applies it too, but this trigger is what
-- stops a direct API write — or an edit, which can't change the category but
-- can lower the tier — from storing anything below the floor. Change both
-- together.
--
-- Not SECURITY DEFINER, and it only ever raises a tier, so it is safe for
-- every role including the service role.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function enforce_category_tier_floor()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.category = 'babysitting'
     and safety_tier_rank(new.safety_tier) < safety_tier_rank('adult_supervision') then
    new.safety_tier := 'adult_supervision';
    new.requires_adult_supervision := true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_category_tier_floor on jobs;
create trigger trg_category_tier_floor
  before insert or update of category, safety_tier on jobs
  for each row execute function enforce_category_tier_floor();

-- 0011 pattern: trigger functions are never called directly.
revoke execute on function public.enforce_category_tier_floor() from public;
