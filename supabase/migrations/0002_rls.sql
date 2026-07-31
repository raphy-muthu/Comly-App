-- ════════════════════════════════════════════════════════════════════════════
-- Comly — Row Level Security
--
-- Principles:
--  • Profiles, verification, reviews are publicly readable (trust is built on
--    visible reputation), but only the owner can mutate their own rows.
--  • Jobs are publicly readable; only the posting customer can change them.
--  • Applications are visible only to the job owner and the applying helper.
--  • Conversations/messages are private to their two participants.
--  • Notifications & reputation events are private; writes come from the server
--    (service role bypasses RLS) or from the owner (marking notifications read).
-- ════════════════════════════════════════════════════════════════════════════

alter table profiles            enable row level security;
alter table verification_status enable row level security;
alter table jobs                enable row level security;
alter table applications        enable row level security;
alter table conversations       enable row level security;
alter table messages            enable row level security;
alter table reviews             enable row level security;
alter table reputation_events   enable row level security;
alter table notifications       enable row level security;
alter table saved_jobs          enable row level security;

-- ── profiles ────────────────────────────────────────────────────────────────
create policy "Profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can insert their own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

-- ── verification_status ─────────────────────────────────────────────────────
create policy "Verification is viewable by everyone"
  on verification_status for select using (true);

create policy "Users manage their own verification"
  on verification_status for update using (auth.uid() = user_id);

-- ── jobs ────────────────────────────────────────────────────────────────────
create policy "Jobs are viewable by everyone"
  on jobs for select using (true);

create policy "Customers can create their own jobs"
  on jobs for insert with check (auth.uid() = customer_id);

create policy "Customers can update their own jobs"
  on jobs for update using (auth.uid() = customer_id);

create policy "Customers can delete their own jobs"
  on jobs for delete using (auth.uid() = customer_id);

-- ── applications ────────────────────────────────────────────────────────────
create policy "Applications visible to job owner and applicant"
  on applications for select using (
    auth.uid() = helper_id
    or auth.uid() = (select customer_id from jobs where jobs.id = applications.job_id)
  );

create policy "Helpers can apply"
  on applications for insert with check (auth.uid() = helper_id);

create policy "Helper can update own application; owner can update status"
  on applications for update using (
    auth.uid() = helper_id
    or auth.uid() = (select customer_id from jobs where jobs.id = applications.job_id)
  );

-- ── conversations ───────────────────────────────────────────────────────────
create policy "Participants can view conversations"
  on conversations for select using (
    auth.uid() = customer_id or auth.uid() = helper_id
  );

create policy "Participants can create conversations"
  on conversations for insert with check (
    auth.uid() = customer_id or auth.uid() = helper_id
  );

-- ── messages ────────────────────────────────────────────────────────────────
create policy "Participants can read messages"
  on messages for select using (
    exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.customer_id or auth.uid() = c.helper_id)
    )
  );

create policy "Participants can send messages"
  on messages for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.customer_id or auth.uid() = c.helper_id)
    )
  );

create policy "Recipients can mark messages read"
  on messages for update using (
    exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.customer_id or auth.uid() = c.helper_id)
    )
  );

-- ── reviews ─────────────────────────────────────────────────────────────────
create policy "Reviews are viewable by everyone"
  on reviews for select using (true);

create policy "Users can write reviews as themselves"
  on reviews for insert with check (auth.uid() = reviewer_id);

-- ── reputation_events (read own; writes are server-side) ────────────────────
create policy "Users can view their own reputation events"
  on reputation_events for select using (auth.uid() = user_id);

-- ── notifications ───────────────────────────────────────────────────────────
create policy "Users can view their own notifications"
  on notifications for select using (auth.uid() = user_id);

create policy "Users can update their own notifications"
  on notifications for update using (auth.uid() = user_id);

-- ── saved_jobs ──────────────────────────────────────────────────────────────
create policy "Users can view their saved jobs"
  on saved_jobs for select using (auth.uid() = user_id);

create policy "Users can save jobs"
  on saved_jobs for insert with check (auth.uid() = user_id);

create policy "Users can unsave jobs"
  on saved_jobs for delete using (auth.uid() = user_id);
