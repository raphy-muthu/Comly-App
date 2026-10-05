-- ════════════════════════════════════════════════════════════════════════════
-- Comly — add the job_category values the app has always used, plus babysitting
--
-- 0001 created job_category with 8 values. The app's JobCategory type grew to
-- 17 without a matching migration, so a real INSERT for Yard Work, Leaf
-- Cleanup, Dog Walking, Moving Help, Cleaning, Organization, Plant Watering,
-- Car Washing or Other failed with `invalid input value for enum
-- job_category`. Mock mode never touches Postgres enums, so this only shows up
-- against the real database — the same bug class 0008 fixed for job_status
-- and notification_type.
--
-- 'babysitting' is new. It's used by the tier-floor trigger in 0031, which has
-- to be a separate migration: a value added by ALTER TYPE can't be used in the
-- transaction that added it.
--
-- src/__tests__/categoryEnum.test.ts parses these statements so the app and
-- the enum can't drift apart again.
-- ════════════════════════════════════════════════════════════════════════════

alter type job_category add value if not exists 'yard_work';
alter type job_category add value if not exists 'leaf_cleanup';
alter type job_category add value if not exists 'dog_walking';
alter type job_category add value if not exists 'moving_help';
alter type job_category add value if not exists 'cleaning';
alter type job_category add value if not exists 'organization';
alter type job_category add value if not exists 'plant_watering';
alter type job_category add value if not exists 'car_washing';
alter type job_category add value if not exists 'other';
alter type job_category add value if not exists 'babysitting';
