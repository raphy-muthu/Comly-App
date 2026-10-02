-- ════════════════════════════════════════════════════════════════════════════
-- Comly — the server enforces a keyword safety floor on every job
--
-- A job's safety_tier has always been chosen on the device and written as-is:
-- 0002's insert/update policies only check ownership, and no trigger looks at
-- the tier. So a modified client — or a plain PostgREST call — could post
-- "bring your chainsaw" as teen_safe. And even the honest client only applied
-- its keyword rules when the AI call failed; a description written to talk the
-- model out of its instructions became the final tier.
--
-- This trigger recomputes a floor from the title and description on every
-- insert, and on every edit of title/description/tier, and never lets the
-- stored tier sit below it. It only ever RAISES a tier; the AI (or the poster)
-- can still choose something stricter. Edits that never re-ran the review
-- (EditJobScreen) are covered too.
--
-- The patterns are the same as src/lib/safetyKeywords.ts, matched on whole
-- words (\y is Postgres's word boundary). src/__tests__/safetyKeywords.test.ts
-- parses the VALUES list below and fails if it differs from the TypeScript
-- copy — change both together.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function safety_tier_rank(p_tier safety_tier)
returns int language sql immutable set search_path = public as $$
  select case p_tier
    when 'teen_safe'          then 0
    when 'caution'            then 1
    when 'adult_supervision'  then 2
    when 'sixteen_plus_only'  then 3
    when 'eighteen_plus_only' then 4
    when 'adults_only'        then 4  -- legacy value from 0001, unused by the app
    when 'blocked'            then 5
  end
$$;

create or replace function safety_keyword_floor(p_text text)
returns safety_tier language sql immutable set search_path = public as $$
  select coalesce(
    (
      select k.tier
      from (values
        ('blocked'::safety_tier, 'roof(s|ing|er|ers)?'),
        ('blocked'::safety_tier, 'electrical'),
        ('blocked'::safety_tier, 'wiring'),
        ('blocked'::safety_tier, 'heavy machinery'),
        ('blocked'::safety_tier, 'chain ?saws?'),
        ('blocked'::safety_tier, 'firearms?'),
        ('blocked'::safety_tier, 'guns?'),
        ('eighteen_plus_only'::safety_tier, 'ladders?'),
        ('eighteen_plus_only'::safety_tier, 'gutters?'),
        ('eighteen_plus_only'::safety_tier, 'chemicals?'),
        ('eighteen_plus_only'::safety_tier, 'pressure wash(er|ers|ing)?'),
        ('eighteen_plus_only'::safety_tier, 'power tools?'),
        ('eighteen_plus_only'::safety_tier, 'driv(e|es|ing|er|ers)'),
        ('eighteen_plus_only'::safety_tier, 'deliver(s|y|ies|ing|ed)?'),
        ('eighteen_plus_only'::safety_tier, 'door[- ]to[- ]door'),
        ('eighteen_plus_only'::safety_tier, 'canvass(ing)?'),
        ('sixteen_plus_only'::safety_tier, 'mow(s|ed|er|ers|ing)?'),
        ('sixteen_plus_only'::safety_tier, 'weed ?whack(er|ers|ing)?'),
        ('sixteen_plus_only'::safety_tier, 'string trimmers?'),
        ('sixteen_plus_only'::safety_tier, 'hedge trimm(er|ers|ing)'),
        ('adult_supervision'::safety_tier, 'pools?'),
        ('adult_supervision'::safety_tier, 'basements?'),
        ('adult_supervision'::safety_tier, 'attics?'),
        ('caution'::safety_tier, 'snow'),
        ('caution'::safety_tier, 'ice'),
        ('caution'::safety_tier, 'icy'),
        ('caution'::safety_tier, 'lift(s|ing)?'),
        ('caution'::safety_tier, 'carry(ing)?'),
        ('caution'::safety_tier, 'heavy'),
        ('caution'::safety_tier, 'outdoors?')
      ) as k(tier, pattern)
      where p_text ~* ('\y(?:' || k.pattern || ')\y')
      order by safety_tier_rank(k.tier) desc
      limit 1
    ),
    'teen_safe'::safety_tier
  )
$$;

create or replace function enforce_safety_keyword_floor()
returns trigger language plpgsql set search_path = public as $$
declare
  v_floor safety_tier;
begin
  v_floor := safety_keyword_floor(coalesce(new.title, '') || ' ' || coalesce(new.description, ''));
  if safety_tier_rank(v_floor) > safety_tier_rank(new.safety_tier) then
    new.safety_tier := v_floor;
    if v_floor = 'adult_supervision' then
      new.requires_adult_supervision := true;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_safety_keyword_floor on jobs;
create trigger trg_safety_keyword_floor
  before insert or update of title, description, safety_tier on jobs
  for each row execute function enforce_safety_keyword_floor();

-- 0011 pattern.
revoke execute on function public.enforce_safety_keyword_floor() from public;
revoke execute on function public.safety_keyword_floor(text) from public, anon;
revoke execute on function public.safety_tier_rank(safety_tier) from public, anon;
grant execute on function public.safety_keyword_floor(text) to authenticated, service_role;
grant execute on function public.safety_tier_rank(safety_tier) to authenticated, service_role;
