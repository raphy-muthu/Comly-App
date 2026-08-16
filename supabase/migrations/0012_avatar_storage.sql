-- ════════════════════════════════════════════════════════════════════════════
-- Comly — real avatar storage
--
-- EditProfileScreen has stored the picked image's local `file://` URI
-- directly as avatarUrl since it was first built. That URI only resolves on
-- the device that took the picture — every other user sees a broken image.
-- This creates a public bucket and scopes writes to "you may only touch the
-- folder named after your own user id", mirroring the row-level ownership
-- pattern used everywhere else in this schema.
--
-- Public read matches `profiles`' own RLS ("viewable by everyone", 0002) —
-- an avatar is exactly as public as the profile it's attached to.
-- ════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Path convention: {user_id}/{filename}. storage.foldername splits on '/' and
-- returns the segments before the object name, so [1] is the first folder.
create policy "Users upload to their own avatar folder"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users replace their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
