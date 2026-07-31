-- ════════════════════════════════════════════════════════════════════════════
-- Comly — local development seed
--
-- Runs after migrations on `supabase db reset`. Creates a few demo auth users
-- and matching profiles/jobs so a connected (non-mock) build has data to show.
--
-- NOTE: In the app's default mock mode this is NOT used — the client seeds
-- itself from src/lib/mockData.ts. This file is only for a real local Supabase.
-- ════════════════════════════════════════════════════════════════════════════

-- Demo auth users (local only). Passwords are a bcrypt hash of 'password123'.
insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', 'sarah@example.com',
   crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"name":"Sarah Mitchell","neighborhood":"Bryn Mawr"}'),
  ('22222222-2222-2222-2222-222222222222', 'diego@example.com',
   crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"name":"Diego Ramirez","neighborhood":"Lower Merion"}'),
  ('33333333-3333-3333-3333-333333333333', 'nina@example.com',
   crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"name":"Nina Patel","neighborhood":"Wynnewood"}')
on conflict (id) do nothing;

-- The on_auth_user_created trigger creates profile + verification rows. Enrich
-- those profiles with reputation/role data.
update profiles set
  roles = array['customer','helper']::user_role[],
  rating = 4.9, jobs_count = 12, reputation_score = 94, trust_level = 3
where id = '11111111-1111-1111-1111-111111111111';

update profiles set
  roles = array['helper']::user_role[],
  rating = 4.9, jobs_count = 87, reputation_score = 96, trust_level = 4
where id = '22222222-2222-2222-2222-222222222222';

update profiles set
  roles = array['customer']::user_role[],
  rating = 4.8, jobs_count = 9, reputation_score = 90, trust_level = 3
where id = '33333333-3333-3333-3333-333333333333';

-- Demo jobs (distance is derived from lat/lng at query time in production)
insert into jobs (customer_id, category, title, description, pay, pay_type, status, safety_tier, neighborhood, lat, lng, scheduled_for, estimated_duration)
  values
  ('33333333-3333-3333-3333-333333333333', 'snow_removal', 'Shovel front walkway',
   'Need my front walkway and steps cleared. Salt provided.', 30, 'fixed', 'open',
   'teen_safe', 'Bryn Mawr', 40.0205, -75.3140, 'Today, 4 PM', 'Under 1 hour'),
  ('33333333-3333-3333-3333-333333333333', 'tutoring', 'Algebra tutoring',
   'High-school sophomore needs help preparing for an algebra exam.', 25, 'hourly', 'open',
   'teen_safe', 'Wynnewood', 40.0051, -75.2935, 'This week', '1 hour')
on conflict do nothing;
