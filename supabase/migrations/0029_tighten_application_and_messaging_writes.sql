-- ════════════════════════════════════════════════════════════════════════════
-- Comly — two write paths that were looser than the app needs
--
-- 1. Helpers could revive decided applications. 0004's "Helpers update own
--    pending applications" checked only the NEW status (pending/withdrawn),
--    not the OLD one, so a helper could move an accepted, declined, or
--    not_selected application back to pending. The USING clause now limits
--    helpers to rows that are still pending. (The app has no withdraw
--    feature; editing a pending application's message still works.)
--
-- 2. Anyone could open a conversation with anyone. 0002 lets a user insert a
--    conversation naming themselves plus ANY other user, then send messages
--    into it — an unsolicited channel to minors, which the store listing
--    promises does not exist. The app has no messaging feature today, so the
--    insert policies are removed outright; when messaging is built, it should
--    go through a function that requires an accepted job between the two.
--    Existing read/mark-read policies are left as they are.
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "Helpers update own pending applications" on applications;
create policy "Helpers update own pending applications"
  on applications for update
  using (auth.uid() = helper_id and status = 'pending')
  with check (status in ('pending', 'withdrawn'));

drop policy if exists "Participants can create conversations" on conversations;
drop policy if exists "Participants can send messages" on messages;
