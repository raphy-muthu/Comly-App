-- ════════════════════════════════════════════════════════════════════════════
-- Comly — fix enum values that never matched the application code
--
-- Found during the first real-account smoke test, immediately after 0007
-- unblocked table access: two Postgres enums were missing values the app has
-- always relied on. Neither surfaced before now because mock mode never
-- touches these enums, and this is the first real INSERT/UPDATE any of this
-- code has executed.
--
--  1. job_status never had 'accepted' — migration 0001 named it 'assigned'
--     instead, and every reference since (the app's JobStatus type, both
--     backends, enforce_job_limits, and the accept_application RPC in 0004/
--     0005) has always used the string 'accepted'. The very first real job
--     post failed immediately: `invalid input value for enum job_status:
--     "accepted"`. Renaming the value (rather than adding a duplicate and
--     leaving 'assigned' orphaned) keeps the enum matching the app exactly.
--
--  2. notification_type was missing 'application_declined' and
--     'report_update'. The first is not cosmetic: accept_application (both
--     the 0004 original and the 0005 replacement) inserts a
--     'application_declined' notification for every applicant who wasn't
--     picked. With more than one applicant, that insert — inside the same
--     transaction as the acceptance itself — would throw and roll back the
--     ENTIRE accept, meaning the core "hire a helper" action would fail
--     outright the first time two people applied to the same job.
--
-- Left alone as harmless, unused dead values (renaming/removing an enum
-- value the app never references isn't worth the risk): application_status's
-- 'rejected' (the app uses 'declined'), and safety_tier's 'adults_only' (the
-- app uses 'eighteen_plus_only').
-- ════════════════════════════════════════════════════════════════════════════

alter type job_status rename value 'assigned' to 'accepted';

alter type notification_type add value if not exists 'application_declined';
alter type notification_type add value if not exists 'report_update';
