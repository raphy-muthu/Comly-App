-- ════════════════════════════════════════════════════════════════════════════
-- Comly — permission before AI, and a filter for objectionable text
--
-- 1. AI consent (App Store guideline 5.1.2(i): "clearly disclose where
--    personal data will be shared with third parties, including with
--    third-party AI, and obtain explicit permission before doing so").
--    ai_consents holds each account's answer to the in-app notice. Only
--    set_ai_consent() writes it, so decided_at is the server's clock. The
--    ai-job-assistant and ai-safety-review edge functions read it with the
--    caller's own token and refuse to call Gemini without granted = true;
--    the app falls back to its on-device rules, as it already does when the
--    AI is unreachable. No row means the person hasn't been asked yet, which
--    is treated the same as "no".
--
-- 2. Objectionable-text filter (guideline 1.2: "a method for filtering
--    objectionable material from being posted"). A BEFORE trigger on every
--    table where people write free text for others to read refuses slurs,
--    explicit sexual terms, strong profanity and self-harm taunts. On UPDATE
--    only changed columns are checked, so an existing row can't block an
--    unrelated change (a status update, say).
--
--    Reports, support tickets and no-show notes are deliberately NOT
--    filtered: someone reporting abuse has to be able to quote it.
--
--    Matching is on whole words after lowercasing and undoing common
--    character swaps (@ → a, 0 → o, $ → s, ...), with repeated letters
--    allowed ("fuuuck"). Suffixes are listed explicitly instead of matched
--    with \w*, so "shiitake", "retardant" and "Scunthorpe" pass.
--
--    The pattern list is mirrored in src/lib/contentFilter.ts (used to check
--    the sign-up form before the account is created, since an error raised
--    inside the sign-up trigger reaches the app only as a generic message).
--    contentFilter.test.ts fails if the two lists drift apart.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. AI consent ────────────────────────────────────────────────────────────
create table if not exists ai_consents (
  user_id     uuid primary key references profiles (id) on delete cascade,
  granted     boolean not null,
  decided_at  timestamptz not null default now()
);

alter table ai_consents enable row level security;

drop policy if exists "Users read their AI choice" on ai_consents;
create policy "Users read their AI choice" on ai_consents
  for select using (auth.uid() = user_id);
-- No insert/update/delete policies: writes go through set_ai_consent() only.

create or replace function set_ai_consent(p_granted boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  if p_granted is null then
    raise exception 'A yes or no answer is required';
  end if;

  insert into ai_consents (user_id, granted, decided_at)
  values (auth.uid(), p_granted, now())
  on conflict (user_id) do update
    set granted = excluded.granted, decided_at = now();
end;
$$;

-- ── 2. Objectionable-text filter ─────────────────────────────────────────────
-- Regex fragments, matched as whole words. Keep in sync with
-- OBJECTIONABLE_PATTERNS in src/lib/contentFilter.ts.
create or replace function objectionable_patterns()
returns text[]
language sql immutable set search_path = public as $$
  select array[
    -- strong profanity
    'f+u+c+k+(s|ed|er|ers|ing|in|face|head|wit)?',
    'm+o+t+h+e+r+f+u+c+k+(er|ers|ing|in)?',
    'f+c+k+',
    'f+u+k+',
    'sh+i+t+(s|ty|ting|ter|head|hole|bag)?',
    'b+i+t+c+h+(es|y|ing)?',
    'c+u+n+t+s?',
    'a+s+s+h+o+l+e+s?',
    'd+i+c+k+h+e+a+d+s?',
    'b+a+s+t+a+r+d+s?',
    'c+o+c+k+s+u+c+k+e+r+s?',
    'tw+a+t+s?',
    'w+a+n+k+e+r+s?',
    'j+a+c+k+a+s+s+(es)?',
    'd+u+m+b+a+s+s+(es)?',
    'd+o+u+c+h+e+(bag|bags|s)?',
    'w+h+o+r+e+s?',
    's+l+u+t+s?',
    -- slurs
    'n+i+g+g+(a|ah|as|az|er|ers|uh)',
    'f+a+g+(s|got|gots|gy)?',
    'r+e+t+a+r+d+(s|ed)?',
    'k+i+k+e+s?',
    'c+h+i+n+k+s?',
    'w+e+t+b+a+c+k+s?',
    'g+o+o+k+s?',
    'tr+a+n+n+(y|ies)',
    'b+e+a+n+e+r+s?',
    'r+a+g+h+e+a+d+s?',
    't+o+w+e+l+h+e+a+d+s?',
    -- explicit sexual content
    'p+o+r+n+(o|s|hub)?',
    'n+u+d+e+s',
    'b+l+o+w+j+o+b+s?',
    'h+a+n+d+j+o+b+s?',
    'b+o+o+b+s',
    't+i+t+s',
    'd+i+l+d+o+s?',
    'o+n+l+y+f+a+n+s',
    'h+o+r+n+y',
    's+e+x+t+(s|ing)?',
    -- self-harm taunts
    'k+i+l+l+ +y+o+u+r+ *s+e+l+f+',
    'k+y+s'
  ]
$$;

create or replace function contains_objectionable_text(p_text text)
returns boolean
language sql immutable set search_path = public as $$
  select coalesce(
    translate(lower(p_text), '@4$5!1|03', 'aassiiioe')
      ~ ('\y(' || array_to_string(objectionable_patterns(), '|') || ')\y'),
    false
  )
$$;

-- Generic BEFORE trigger: the trigger arguments name the columns to check.
-- Array columns (skills) are checked through their JSON text. Not SECURITY
-- DEFINER, and it never modifies the row; it only refuses it.
create or replace function reject_objectionable_text()
returns trigger
language plpgsql set search_path = public as $$
declare
  v_col text;
  v_new text;
begin
  foreach v_col in array tg_argv loop
    v_new := to_jsonb(new) ->> v_col;
    if tg_op = 'UPDATE' and v_new is not distinct from (to_jsonb(old) ->> v_col) then
      continue;
    end if;
    if contains_objectionable_text(v_new) then
      raise exception 'Please remove offensive language and try again.'
        using errcode = 'check_violation', hint = v_col;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_reject_objectionable_jobs on jobs;
create trigger trg_reject_objectionable_jobs
  before insert or update on jobs
  for each row execute function reject_objectionable_text(
    'title', 'description', 'custom_category_text', 'equipment_details', 'neighborhood'
  );

drop trigger if exists trg_reject_objectionable_applications on applications;
create trigger trg_reject_objectionable_applications
  before insert or update on applications
  for each row execute function reject_objectionable_text('message', 'availability');

drop trigger if exists trg_reject_objectionable_reviews on reviews;
create trigger trg_reject_objectionable_reviews
  before insert or update on reviews
  for each row execute function reject_objectionable_text('comment');

drop trigger if exists trg_reject_objectionable_profiles on profiles;
create trigger trg_reject_objectionable_profiles
  before insert or update on profiles
  for each row execute function reject_objectionable_text(
    'name', 'bio', 'neighborhood', 'skills'
  );

drop trigger if exists trg_reject_objectionable_messages on messages;
create trigger trg_reject_objectionable_messages
  before insert or update on messages
  for each row execute function reject_objectionable_text('body');

-- ── Grants (0011 pattern) ────────────────────────────────────────────────────
-- 0007's default privileges grant every new function to anon; take it back.
revoke execute on function public.set_ai_consent(boolean) from public, anon;
grant execute on function public.set_ai_consent(boolean) to authenticated, service_role;

revoke execute on function public.reject_objectionable_text() from public, anon, authenticated;
-- The two helpers are pure functions of their input; the app never calls
-- them, but nothing is gained by hiding them either.
revoke execute on function public.objectionable_patterns() from public, anon;
revoke execute on function public.contains_objectionable_text(text) from public, anon;
grant execute on function public.objectionable_patterns() to authenticated, service_role;
grant execute on function public.contains_objectionable_text(text) to authenticated, service_role;
