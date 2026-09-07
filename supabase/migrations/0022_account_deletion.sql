-- ════════════════════════════════════════════════════════════════════════════
-- Comly — account deletion
--
-- Apple requires an in-app way to delete an account for any app that lets you
-- create one (App Store Review Guideline 5.1.1(v)). The deletion itself runs
-- from the `delete-account` edge function, which removes the auth user and
-- lets the existing foreign keys cascade.
--
-- This migration exists because those cascades were not all correct for
-- deletion. Every foreign key pointing at `profiles` was `on delete cascade`.
-- For most tables that is right: a departing user's own listings,
-- applications, notifications, saved jobs, blocks, consent requests and
-- private contact details should all go with them.
--
-- Two of them are wrong, because the row is not only about the person
-- leaving:
--
--   reviews.reviewer_id
--     A review you wrote is part of the *reviewee's* public history.
--     Cascading it means deleting your account silently rewrites a third
--     party's rating — and hands anyone a way to erase criticism they left.
--
--   no_show_events.reporter_id
--     Worse. A confirmed no-show is a strike against the ACCUSED, and
--     `profiles.strikes` is what gates the public caution at 2 and suspension
--     at 3. Cascading on the reporter means two cooperating accounts can
--     clear a strike by deleting one of them. That is a collusion path
--     wearing a privacy feature's clothes.
--
-- Both become `on delete set null`. The record survives with the departing
-- user's identity detached, which is what "delete my personal data" should
-- mean here — the other party keeps their history, and the person leaving
-- stops being named in it.
--
-- Deliberately NOT changed: `jobs.customer_id` stays `cascade`. A customer
-- deleting their account therefore also removes their listings, and the
-- reviews attached to those jobs go with them. That does cost a helper
-- reviews they earned. Fixing it means keeping ownerless job rows, which
-- every RLS policy on `jobs` currently assumes cannot exist — a larger change
-- than this one, and worth doing deliberately rather than as a side effect.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Reviews survive their author ──────────────────────────────────────────
alter table reviews alter column reviewer_id drop not null;

alter table reviews drop constraint if exists reviews_reviewer_id_fkey;
alter table reviews add constraint reviews_reviewer_id_fkey
  foreign key (reviewer_id) references profiles (id) on delete set null;

comment on column reviews.reviewer_id is
  'Null means the author deleted their account. The review stays, because it '
  'is part of the reviewee''s history — render it as from a former member.';

-- The unique constraint still holds: Postgres treats NULLs as distinct, so
-- several anonymised reviews on one job do not collide with each other.

-- ── 2. No-show reports survive their reporter ────────────────────────────────
alter table no_show_events alter column reporter_id drop not null;

alter table no_show_events drop constraint if exists no_show_events_reporter_id_fkey;
alter table no_show_events add constraint no_show_events_reporter_id_fkey
  foreign key (reporter_id) references profiles (id) on delete set null;

comment on column no_show_events.reporter_id is
  'Null means the reporter deleted their account. The event and any strike it '
  'produced stay on the accused: a strike must not be clearable by deleting '
  'the account that reported it.';

-- The `check (reported_user_id <> reporter_id)` still passes once reporter_id
-- is null — a CHECK fails only on FALSE, and `null <> x` is NULL.
-- The `unique (job_id, reporter_id)` likewise stops applying to anonymised
-- rows, which is correct: they are no longer attributable to anyone.
