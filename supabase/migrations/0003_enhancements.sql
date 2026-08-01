-- ════════════════════════════════════════════════════════════════════════════
-- Comly — enhancement migration
--
-- Adds: expanded safety tiers, equipment, scheduling, custom categories,
-- community tags, senior mode + family contact, parent approval, youth skills,
-- reports, support tickets, blocked users, soft-delete, and a community impact
-- view. Idempotent where practical.
-- ════════════════════════════════════════════════════════════════════════════

-- ── New enum values ──────────────────────────────────────────────────────────
-- Safety tiers gain 'caution' and 'eighteen_plus_only' and 'blocked'.
alter type safety_tier add value if not exists 'caution';
alter type safety_tier add value if not exists 'eighteen_plus_only';
alter type safety_tier add value if not exists 'blocked';

-- Equipment status (new enum).
do $$ begin
  create type equipment_status as enum ('yes', 'no', 'some', 'not_needed');
exception when duplicate_object then null; end $$;

-- Age group.
do $$ begin
  create type age_group as enum ('teen', 'adult');
exception when duplicate_object then null; end $$;

-- Job status gains 'paused' and 'filled'.
alter type job_status add value if not exists 'paused';
alter type job_status add value if not exists 'filled';

-- Application status gains 'declined' and 'not_selected'.
alter type application_status add value if not exists 'declined';
alter type application_status add value if not exists 'not_selected';

-- ── profiles ─────────────────────────────────────────────────────────────────
alter table profiles add column if not exists age_group age_group not null default 'adult';
alter table profiles add column if not exists is_trusted boolean not null default false;
alter table profiles add column if not exists is_admin boolean not null default false;
alter table profiles add column if not exists parent_approval_status text not null default 'not_required';
alter table profiles add column if not exists parent_name text;
alter table profiles add column if not exists parent_email text;
alter table profiles add column if not exists school_email text;
alter table profiles add column if not exists phone_number text;
alter table profiles add column if not exists preferred_contact_method text;
alter table profiles add column if not exists skills text[] not null default '{}';
alter table profiles add column if not exists preferred_categories text[] not null default '{}';
alter table profiles add column if not exists resume_summary text;

-- ── verification_status (drop gov ID, add photo/school/parent) ───────────────
alter table verification_status add column if not exists phone_added boolean not null default false;
alter table verification_status add column if not exists photo_added boolean not null default false;
alter table verification_status add column if not exists school_email_verified boolean not null default false;
alter table verification_status add column if not exists parent_approved boolean not null default false;
-- Migrate legacy phone_verified → phone_added, then drop ID/neighborhood cols.
update verification_status set phone_added = phone_verified where phone_verified is not null;
alter table verification_status drop column if exists id_verified;
alter table verification_status drop column if exists neighborhood_verified;
alter table verification_status drop column if exists phone_verified;

-- ── jobs ─────────────────────────────────────────────────────────────────────
alter table jobs add column if not exists custom_category_text text;
alter table jobs add column if not exists assigned_helper_id uuid references profiles (id) on delete set null;
alter table jobs add column if not exists safety_notes text;
alter table jobs add column if not exists requires_adult_supervision boolean not null default false;
alter table jobs add column if not exists equipment_status equipment_status not null default 'not_needed';
alter table jobs add column if not exists equipment_details text;
alter table jobs add column if not exists community_tags text[] not null default '{}';
alter table jobs add column if not exists is_time_flexible boolean not null default false;
alter table jobs add column if not exists duration_minutes integer;
alter table jobs add column if not exists public_lat double precision;
alter table jobs add column if not exists public_lng double precision;
alter table jobs add column if not exists private_address text;
alter table jobs add column if not exists created_with_senior_mode boolean not null default false;
alter table jobs add column if not exists family_contact_name text;
alter table jobs add column if not exists family_contact_phone text;
alter table jobs add column if not exists family_contact_email text;
alter table jobs add column if not exists notify_family_contact boolean not null default false;
alter table jobs add column if not exists contact_unlocked_at timestamptz;
alter table jobs add column if not exists paused_at timestamptz;
alter table jobs add column if not exists deleted_at timestamptz;

-- ── reports ──────────────────────────────────────────────────────────────────
create table if not exists reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_id       uuid not null references profiles (id) on delete cascade,
  reported_user_id  uuid references profiles (id) on delete set null,
  job_id            uuid references jobs (id) on delete set null,
  category          text not null,
  description       text not null default '',
  ai_risk_level     text not null default 'medium',
  ai_summary        text,
  status            text not null default 'open',
  admin_notes       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists reports_status_idx on reports (status, created_at desc);

-- ── support_tickets ──────────────────────────────────────────────────────────
create table if not exists support_tickets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles (id) on delete cascade,
  category    text not null,
  subject     text not null,
  message     text not null default '',
  status      text not null default 'open',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists support_user_idx on support_tickets (user_id, created_at desc);

-- ── blocked_users ────────────────────────────────────────────────────────────
create table if not exists blocked_users (
  user_id          uuid not null references profiles (id) on delete cascade,
  blocked_user_id  uuid not null references profiles (id) on delete cascade,
  created_at       timestamptz not null default now(),
  primary key (user_id, blocked_user_id)
);

-- ── RLS for new tables ───────────────────────────────────────────────────────
alter table reports enable row level security;
alter table support_tickets enable row level security;
alter table blocked_users enable row level security;

-- Reporters manage their own reports; admins see everything.
create policy "Users create reports" on reports
  for insert with check (auth.uid() = reporter_id);
create policy "Users view their reports" on reports
  for select using (
    auth.uid() = reporter_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );
create policy "Admins update reports" on reports
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );

create policy "Users create tickets" on support_tickets
  for insert with check (auth.uid() = user_id);
create policy "Users view their tickets" on support_tickets
  for select using (
    auth.uid() = user_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );
create policy "Admins update tickets" on support_tickets
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );

create policy "Users manage their blocks" on blocked_users
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Community impact view (NO dollar metrics) ────────────────────────────────
create or replace view community_impact_stats as
select
  count(*) filter (where status = 'completed') as completed_jobs,
  count(*) filter (where status = 'completed' and safety_tier = 'teen_safe') as teen_safe_jobs_completed,
  count(distinct customer_id) filter (
    where status = 'completed' and (created_with_senior_mode or 'senior_help' = any(community_tags))
  ) as seniors_helped,
  count(distinct customer_id) filter (
    where status = 'completed' and 'family_support' = any(community_tags)
  ) as families_helped,
  (select avg(reputation_score) from profiles where 'helper' = any(roles)) as average_trust_score,
  (select count(*) from (
     select customer_id from jobs where status = 'completed' group by customer_id having count(*) > 1
   ) r) as repeat_customers,
  (select count(*) from profiles where 'helper' = any(roles) and age_group = 'teen') as active_teen_helpers
from jobs
where deleted_at is null;
