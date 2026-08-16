# Comly

A neighborhood services marketplace that connects residents who need help with trusted local helpers (primarily teens and young adults). Comly is a **matchmaking platform** — customers post jobs, helpers apply, and the two connect. **Payment is arranged off-platform**, so there is no in-app payment, escrow, or subscription.

Built with React Native + Expo, TypeScript, React Navigation, React Query, Zustand, and Supabase. AI features (job assistant, safety review) run as Supabase Edge Functions backed by Gemini; recommendations use a deterministic scoring function, no model call.

---

## ✨ Runs out of the box (mock mode)

The app ships in **mock mode** — it runs end-to-end on seeded demo data with **no accounts or API keys required**. Just install and start:

```bash
npm install
npm start          # then press i (iOS), a (Android), or scan the QR in Expo Go
```

Mock mode is controlled by `EXPO_PUBLIC_USE_MOCKS=true` in `.env` (already set). Every service (data, auth, AI) has a mock implementation seeded from `src/lib/mockData.ts`. Flip to real services when you're ready (see [Connecting real services](#-connecting-real-services)).

---

## Features

- **Onboarding & Auth** — splash, welcome carousel, email/Google/Apple/phone sign-in (mocked; OAuth path documented for production), with a "I need help / I want to help" role picker. Users can hold both roles and switch anytime.
- **Customer flow** — dashboard, AI-assisted job creation (preset + custom categories, date/time pickers, duration presets, equipment, community tags → AI preview with fair-pay guidance and safety check → review), full listing management (edit / pause / mark filled / cancel / soft delete), applicant review with **working accept/decline**, and contact unlock after acceptance.
- **Senior Help Mode** — a simplified large-type posting flow with task preset cards and an optional private family contact.
- **Helper flow** — opportunity dashboard with reputation stats, searchable feed with safety/equipment labels and community-tag filters, AI-assisted apply flow with **teen age-gating** (minors cannot apply to 18+/blocked jobs).
- **Teen Safety System** — 5-tier safety labels (Teen Safe / Caution / Adult Supervision / 18+ Only / Not Allowed) on every job, AI safety classification at posting, parent-approval gating, and equipment badges before applying.
- **Trust & Youth Skills** — verification badges (email, phone, photo, school email, parent approval — no government ID), earned profile badges, reputation scoring, 4-category reviews, "Skills Built Through Comly," and a shareable AI experience summary.
- **Safety & Support** — in-app reporting with AI risk triage, Safety Center (tips, report history, block list), Help & Support tickets, and a minimal admin console (reports + tickets moderation).
- **Community Impact** — a public impact dashboard (jobs completed, seniors/families helped, teen-safe tasks, trust score — deliberately non-monetary) plus an About page with the community mission.
- **Listing integrity** — 3 active-listing limit, 5-per-hour rate limit, soft deletes, database as the single source of truth.
- **AI** — fair-pay suggestions with low-pay warnings, description polishing, safety review, resume summaries (mock locally; Gemini via edge functions in production).

> Messaging and in-app payments are intentionally out of scope: Comly is a matchmaking platform, and neighbors coordinate pay off-app (contact unlocks after acceptance). The database includes `conversations`/`messages` tables for a future chat feature, but no chat UI is built.

---

## Tech stack

| Area | Choice |
|---|---|
| Framework | Expo (React Native), TypeScript |
| Navigation | React Navigation (native stack + bottom tabs) |
| Server state | TanStack React Query |
| Client state | Zustand |
| Backend | Supabase (Auth, Postgres, Storage, Realtime, Edge Functions) |
| AI | Gemini (via Edge Functions) |
| Maps | Google Maps (location preview) |
| Notifications | Expo Push Notifications |
| Fonts | Plus Jakarta Sans |

---

## Project structure

```
comly/
├── App.tsx                  # Providers (SafeArea, React Query) + fonts
├── app.json                 # Expo config (bundle id: com.comly.app)
├── .env / .env.example      # Environment (mock toggle + keys)
├── src/
│   ├── theme/               # "Organic Vitality" design tokens
│   ├── components/
│   │   ├── ui/              # Button, Card, Chip, Input, Text, …
│   │   ├── trust/           # TrustBadge, SafetyBadge, ScoreRing, Verification
│   │   ├── job/             # JobCard, JobListItem
│   │   └── people/          # HelperRow
│   ├── screens/
│   │   ├── onboarding/      # Splash, Welcome
│   │   ├── auth/            # SignUp, Login, PhoneVerify
│   │   ├── customer/        # Dashboard, MyJobs
│   │   ├── helper/          # Dashboard, JobFeed
│   │   ├── jobs/            # CreateJob, JobDetail, Applications, ApplyToJob
│   │   ├── shared/          # Profile, HelperProfile, Alerts
│   │   ├── HomeScreen.tsx   # role-aware tab wrappers
│   │   └── JobsScreen.tsx
│   ├── navigation/          # Root / Public / App stacks + tabs
│   ├── services/            # backend abstraction (mock + supabase), ai, push
│   ├── hooks/               # React Query hooks
│   ├── stores/              # Zustand (auth + active role)
│   ├── lib/                 # mock data, formatters, query client
│   ├── config/              # env access
│   └── types/               # domain + database types
└── supabase/
    ├── migrations/          # 0001_init.sql, 0002_rls.sql
    ├── functions/           # ai-job-assistant, ai-safety-review, ai-recommendations, push-dispatch
    └── seed.sql             # local dev seed
```

---

## Architecture notes

- **Backend abstraction.** Screens never call Supabase directly. They use React Query hooks → `services/index.ts`, which resolves to either `mockBackend` or `supabaseBackend` based on config. Both implement the same `DataBackend` interface (`services/types.ts`), so the UI is identical in either mode.
- **Mock toggle.** `EXPO_PUBLIC_USE_MOCKS` (with `expo.extra.useMocks` as fallback) decides the backend. If real mode is requested but credentials are missing, the app logs a warning and safely falls back to mock data.
- **Server secrets stay server-side.** The Gemini key and Supabase service-role key live only as Supabase Edge Function secrets — never in the client bundle.

---

## 🔌 Connecting real services

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full steps. In short:

1. **Supabase** — create a project, run the SQL in `supabase/migrations/`, then set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`.
2. **Gemini** — `supabase secrets set GEMINI_API_KEY=...` and deploy the edge functions.
3. **Google Maps** — set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`.
4. Set `EXPO_PUBLIC_USE_MOCKS=false` and restart.
5. Regenerate DB types: `npx supabase gen types typescript --linked > src/types/database.ts`.

---

## Scripts

```bash
npm start          # Expo dev server
npm run ios        # open iOS simulator
npm run android    # open Android emulator
npx tsc --noEmit   # type-check
npx expo export --platform ios   # produce a production JS bundle (CI check)
```

---

## What you'll need before going to production

- A Supabase project (free tier is fine to start)
- A Gemini API key (for AI features)
- A Google Maps API key (for the location preview)
- An Expo account (for EAS builds & push)
- Apple Developer + Google Play accounts (for store submission)
- Replace the placeholder bundle id `com.comly.app` in `app.json`

The app runs fully without any of these in mock mode.
