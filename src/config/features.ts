/**
 * Google / Apple sign-in is hidden for v1.
 *
 * The signup trigger (handle_new_user) requires a date of birth — it's the
 * source of every age gate — and OAuth providers don't supply one, so a new
 * account created through them fails at the database. Existing accounts
 * could still sign in, but a button that errors for every new user is worse
 * than no button, and app review taps it.
 *
 * Turn this back on only after adding a required date-of-birth step for
 * OAuth signups (with the account treated as the most restricted bracket
 * until it's entered).
 */
export const OAUTH_SIGN_IN_ENABLED = false;
