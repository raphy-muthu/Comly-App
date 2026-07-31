# Comly — Deployment & Service Setup Guide

This guide takes Comly from **mock mode** (runs with zero config) to a **production** build connected to real services and submitted to the App Store / Google Play.

> You can skip everything here and just run `npm install && npm start` to demo the app on mock data.

---

## 0. Prerequisites

- Node 20+ and npm
- Expo account → `npx expo login`
- EAS CLI → `npm i -g eas-cli` (or use `npx eas-cli`)
- Apple Developer account (iOS) and/or Google Play Console account (Android)
- A Supabase project, OpenAI API key, and Google Maps API key

---

## 1. Supabase

### 1.1 Create the project
1. Create a project at [supabase.com](https://supabase.com).
2. Copy **Project URL** and **anon public key** from Project Settings → API.

### 1.2 Apply the schema
Using the Supabase CLI (recommended):

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push          # applies supabase/migrations/*.sql
```

Or paste `supabase/migrations/0001_init.sql`, `0002_rls.sql`, then `0003_enhancements.sql` into the SQL Editor, in order.

### 1.3 (Optional) Seed local data
For a local stack only:

```bash
npx supabase start
npx supabase db reset         # runs migrations + supabase/seed.sql
```

### 1.4 Regenerate typed schema
After the schema is live, regenerate the client types so they exactly match:

```bash
npx supabase gen types typescript --linked > src/types/database.ts
```

---

## 2. Edge Functions (AI + push)

The OpenAI key lives **only** as a function secret — never in the client.

```bash
# Secrets
npx supabase secrets set OPENAI_API_KEY=sk-...

# Deploy
npx supabase functions deploy ai-job-assistant
npx supabase functions deploy ai-safety-review
npx supabase functions deploy ai-recommendations
npx supabase functions deploy push-dispatch
```

Functions live in `supabase/functions/`. They share helpers in `supabase/functions/_shared/`.

> To wire the client to call these instead of the mock AI, implement a real `AIService` in `src/services/ai.ts` that POSTs to the deployed function URLs, and return it from `resolveAI()` when not in mock mode. The mock already matches the response shapes.

---

## 2.5 OAuth (Google / Apple sign-in)

In mock mode the social buttons sign in the demo user. For production:

1. **Supabase dashboard** → Authentication → Providers:
   - **Google:** create OAuth credentials in Google Cloud Console (iOS + web client), paste the client ID/secret.
   - **Apple:** create a Services ID + key in the Apple Developer portal, paste the ID/secret.
2. Add the redirect URL `comly://auth-callback` to Supabase → Authentication → URL Configuration (the `comly` scheme is already set in `app.json`).
3. Implement the native flow in `src/services/auth.ts` (the TODO documents the exact 3 steps):
   `expo-web-browser` auth session → `supabase.auth.signInWithOAuth({ skipBrowserRedirect: true })` → `exchangeCodeForSession`.
4. Until configured, the buttons show a clear setup message instead of failing silently.

---

## 3. Google Maps

1. In Google Cloud Console, enable **Maps SDK for iOS/Android** and create an API key.
2. Restrict the key to your bundle id `com.comly.app` (change this first — see §5).
3. Put it in `.env` as `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`.

The job detail screen currently shows a coarse location placeholder; swap in a real map component once the key is set.

---

## 4. Environment variables

Copy `.env.example` → `.env` and fill in:

```bash
EXPO_PUBLIC_USE_MOCKS=false
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
```

Restart the dev server after changes. With `USE_MOCKS=false` and valid Supabase keys, the app uses the real backend; otherwise it logs a warning and falls back to mock data.

---

## 5. App identity

Before building for stores, edit `app.json`:

- `expo.ios.bundleIdentifier` and `expo.android.package` — replace `com.comly.app` with your real id.
- `expo.name` / `expo.slug` if needed.
- Add real `assets/icon.png` and splash assets.

---

## 6. Builds (EAS)

```bash
eas login
eas build:configure          # if eas.json needs (re)generating
eas build --platform ios     # or android, or all
```

Environment variables for builds: set the `EXPO_PUBLIC_*` values as EAS secrets or in `eas.json` build profiles so they're inlined at build time:

```bash
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value https://xxxx.supabase.co
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value eyJ...
eas secret:create --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY --value AIza...
# Ensure EXPO_PUBLIC_USE_MOCKS=false for production profiles.
```

---

## 7. Push notifications

1. Push works on a real device (not the simulator). `registerForPushNotifications()` in `src/services/push.ts` returns an Expo push token — store it on the user's profile.
2. iOS requires an APNs key configured via `eas credentials`.
3. Send pushes server-side from the `push-dispatch` edge function (e.g. trigger it from a DB webhook when an application is inserted).

---

## 8. Submit to stores

```bash
eas submit --platform ios
eas submit --platform android
```

Have ready: app screenshots, privacy policy URL, store descriptions, and (for iOS) App Privacy answers. Because Comly handles no payments and minimal personal data, the privacy surface is small — but you still collect names, neighborhoods, and (if enabled) phone numbers, so disclose those.

---

## Pre-launch checklist

- [ ] Bundle id changed from `com.comly.app`
- [ ] Supabase migrations applied + RLS verified
- [ ] `database.ts` regenerated from the live schema
- [ ] Edge functions deployed + `OPENAI_API_KEY` secret set
- [ ] `.env` / EAS secrets set with `EXPO_PUBLIC_USE_MOCKS=false`
- [ ] Real app icon + splash assets
- [ ] Push credentials configured (APNs / FCM)
- [ ] Tested a real sign-up → post job → apply flow against Supabase
```
