-- ════════════════════════════════════════════════════════════════════════════
-- Comly — initial schema
--
-- A neighborhood services marketplace that *matches* customers with helpers.
-- Payments are handled OFF-PLATFORM, so there are deliberately NO payments,
-- earnings, or subscription tables. Pay fields on jobs/applications are
-- informational only.
-- ════════════════════════════════════════════════════════════════════════════

-- Extensions ------------------------------------------------------------------
create extension if not exists "uuid-ossp";

-- Enums -----------------------------------------------------------------------
create type user_role as enum ('customer', 'helper');

create type job_category as enum (
  'snow_removal', 'lawn_care', 'tutoring', 'pool_cleaning',
  'pet_care', 'tech_help', 'errands', 'house_sitting'
);

create type safety_tier as enum ('teen_safe', 'adult_supervision', 'adults_only');

create type pay_type as enum ('fixed', 'hourly');

create type job_status as enum (
  'open', 'reviewing', 'assigned', 'in_progress', 'completed', 'cancelled'
);

create type application_status as enum (
  'pending', 'accepted', 'rejected', 'withdrawn'
);

create type notification_type as enum (
  'application_received', 'application_accepted', 'job_match',
  'review_received', 'verification', 'safety'
);

-- ── profiles ────────────────────────────────────────────────────────────────
-- One row per auth user (id == auth.users.id).
create table profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  name             text not null default '',
  avatar_url       text,
  neighborhood     text not null default '',
  roles            user_role[] not null default array['customer']::user_role[],
  bio              text,
  rating           numeric(2,1) not null default 0 check (rating >= 0 and rating <= 5),
  jobs_count       integer not null default 0 check (jobs_count >= 0),
  reputation_score integer not null default 0 check (reputation_score between 0 and 100),
  trust_level      smallint not null default 1 check (trust_level between 1 and 4),
  member_since     timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── verification_status ─────────────────────────────────────────────────────
create table verification_status (
  user_id                uuid primary key references profiles (id) on delete cascade,
  email_verified         boolean not null default false,
  phone_verified         boolean not null default false,
  id_verified            boolean not null default false,
  neighborhood_verified  boolean not null default false,
  updated_at             timestamptz not null default now()
);

-- ── jobs ────────────────────────────────────────────────────────────────────
create table jobs (
  id                  uuid primary key default uuid_generate_v4(),
  customer_id         uuid not null references profiles (id) on delete cascade,
  category            job_category not null,
  title               text not null check (char_length(title) between 3 and 120),
  description         text not null default '',
  pay                 numeric(8,2) not null default 0 check (pay >= 0),
  pay_type            pay_type not null default 'fixed',
  status              job_status not null default 'open',
  safety_tier         safety_tier not null default 'teen_safe',
  neighborhood        text not null default '',
  lat                 double precision,
  lng                 double precision,
  scheduled_for       text,
  estimated_duration  text,
  photos              text[] not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index jobs_customer_idx on jobs (customer_id);
create index jobs_status_idx on jobs (status);
create index jobs_category_idx on jobs (category);
create index jobs_created_idx on jobs (created_at desc);

-- ── applications ────────────────────────────────────────────────────────────
create table applications (
  id            uuid primary key default uuid_generate_v4(),
  job_id        uuid not null references jobs (id) on delete cascade,
  helper_id     uuid not null references profiles (id) on delete cascade,
  message       text not null default '',
  proposed_pay  numeric(8,2) check (proposed_pay >= 0),
  availability  text,
  status        application_status not null default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (job_id, helper_id)
);

create index applications_job_idx on applications (job_id);
create index applications_helper_idx on applications (helper_id);

-- ── conversations & messages (schema only; UI deferred) ─────────────────────
create table conversations (
  id           uuid primary key default uuid_generate_v4(),
  job_id       uuid references jobs (id) on delete set null,
  customer_id  uuid not null references profiles (id) on delete cascade,
  helper_id    uuid not null references profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (job_id, customer_id, helper_id)
);

create table messages (
  id               uuid primary key default uuid_generate_v4(),
  conversation_id  uuid not null references conversations (id) on delete cascade,
  sender_id        uuid not null references profiles (id) on delete cascade,
  body             text not null default '',
  image_url        text,
  read_at          timestamptz,
  created_at       timestamptz not null default now()
);

create index messages_conversation_idx on messages (conversation_id, created_at);

-- ── reviews ─────────────────────────────────────────────────────────────────
create table reviews (
  id               uuid primary key default uuid_generate_v4(),
  job_id           uuid not null references jobs (id) on delete cascade,
  reviewer_id      uuid not null references profiles (id) on delete cascade,
  reviewee_id      uuid not null references profiles (id) on delete cascade,
  reliability      smallint not null check (reliability between 1 and 5),
  quality          smallint not null check (quality between 1 and 5),
  communication    smallint not null check (communication between 1 and 5),
  professionalism  smallint not null check (professionalism between 1 and 5),
  comment          text not null default '',
  created_at       timestamptz not null default now(),
  unique (job_id, reviewer_id, reviewee_id)
);

create index reviews_reviewee_idx on reviews (reviewee_id);

-- ── reputation_events (audit feeding reputation_score) ──────────────────────
create table reputation_events (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles (id) on delete cascade,
  event_type  text not null,
  weight      numeric(5,2) not null default 0,
  created_at  timestamptz not null default now()
);

create index reputation_events_user_idx on reputation_events (user_id);

-- ── notifications ───────────────────────────────────────────────────────────
create table notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles (id) on delete cascade,
  type        notification_type not null,
  title       text not null,
  body        text not null default '',
  payload     jsonb not null default '{}'::jsonb,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index notifications_user_idx on notifications (user_id, created_at desc);

-- ── saved_jobs ──────────────────────────────────────────────────────────────
create table saved_jobs (
  user_id     uuid not null references profiles (id) on delete cascade,
  job_id      uuid not null references jobs (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, job_id)
);

-- ════════════════════════════════════════════════════════════════════════════
-- Triggers
-- ════════════════════════════════════════════════════════════════════════════

-- updated_at touch ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated   before update on profiles      for each row execute function set_updated_at();
create trigger trg_jobs_updated       before update on jobs          for each row execute function set_updated_at();
create trigger trg_apps_updated       before update on applications  for each row execute function set_updated_at();

-- Provision a profile + verification row when an auth user is created ----------
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, neighborhood)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'neighborhood', '')
  );
  insert into public.verification_status (user_id, email_verified)
  values (new.id, new.email_confirmed_at is not null);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Keep applicants implicit via count(*) on applications; expose a helper view --
create view job_with_applicant_count as
  select j.*, coalesce(a.cnt, 0)::int as applicants_count
  from jobs j
  left join (
    select job_id, count(*) as cnt from applications group by job_id
  ) a on a.job_id = j.id;
