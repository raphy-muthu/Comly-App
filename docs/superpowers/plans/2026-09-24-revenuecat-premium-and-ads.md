# Comly Premium (RevenueCat) and Ads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After the first launch, sell a **Comly Premium** auto-renewing subscription through the App Store and Google Play using RevenueCat. Part B, which is optional and needs its own decision, shows ads to non-Premium users.

**Architecture:** The app already has premium *effects* built and server-owned: `profiles.is_customer_plus` (listing boost and sort priority) and `profiles.is_helper_pro` (application priority), added in migration `0016_premium_visibility.sql`. The only thing missing is a way to *pay* for them. RevenueCat wraps StoreKit and Play Billing on the device. RevenueCat's webhook calls a new Supabase edge function, and that function is the only thing that ever flips those two flags. The client never grants itself Premium; it asks RevenueCat to show the paywall, then waits for the server flag to change. One entitlement, `premium`, turns on both flags.

**Tech Stack:** `react-native-purchases` and `react-native-purchases-ui` (RevenueCat), Supabase Edge Functions (Deno), Postgres, Jest. Part B adds `react-native-google-mobile-ads` (AdMob) and `expo-tracking-transparency`.

**Estimated effort:** Part A (Premium) is ~19.5 engineering hours plus ~4.5 hours of your account and store setup. Part B (Ads) is ~13 engineering hours plus ~1 hour of setup. Both parts together come to **~38 hours**, detailed in the table at the end. On the calendar, allow about 1.5–2 weeks for Part A, because of Apple's agreement processing and product review, and about 1 more week for Part B.

## Global Constraints

- **Never commit.** The user commits manually. Every "Commit" step means: stop, and give the suggested message.
- **Starts after the first App Store launch.** Nothing here blocks v1.0. It ships as an app update, and in-app purchase products are reviewed together with that update.
- Baseline: `npm run typecheck` is clean and `npm test` passes before and after every task.
- **Premium is sold to adults (18+) only in v1.** Pro Helper priority is effectively "pay for a better chance at jobs." Selling that to 13–17-year-olds is a bad look for a teen-safety app and an easy app-review objection. The paywall entry point is hidden for minors (`canPurchasePremium`). To change this later, change that one function.
- **One entitlement, `premium`,** sets both `is_customer_plus` and `is_helper_pro`. Proposed products, confirmed in Task A0:
  - iOS: `comly_premium_monthly`, $4.99/month, in subscription group `Comly Premium`
  - Android: subscription `comly_premium`, base plan `monthly`, $4.99/month
- Premium changes **visibility only**, as it does today. It must never affect safety tiers, age gating, or whether someone can see or apply to a job. The ToS text in Task A8 says exactly this.
- Native SDKs don't run in Expo Go. Every device test in this plan needs a **development build** (`eas build --profile development`). iOS dev builds need the Apple Developer account to be working.
- `--no-verify-jwt` is correct for the webhook function (Task A3) **only because** that function authenticates with its own secret, compared in constant time. That is the opposite of the `parent-consent` situation flagged in the earlier code review, where disabling gateway verification left nothing verifying the caller.
- Migration numbering: this plan uses `0028`. Use the next free number if the other plans haven't run.

---

## Part A — Comly Premium via RevenueCat

### Task A0: Accounts, agreements, and products (you, no code) — est. 3 h plus waits

**Files:** none

- [ ] **Step 1:** In App Store Connect, go to **Business** and accept the **Paid Apps Agreement**, then complete tax and banking. In-app purchases won't work, even in sandbox, until this shows **Active**. That can take 1–3 days.
- [ ] **Step 2:** In App Store Connect, open the app and go to **Monetization → Subscriptions**. Create the group `Comly Premium` and the product `comly_premium_monthly` at $4.99/month, with a display name and a description.
- [ ] **Step 3:** Once the Google Play account exists, go to **Monetize → Subscriptions**. Create `comly_premium` with base plan `monthly` at $4.99. Also set up a payments profile.
- [ ] **Step 4:** Create a RevenueCat account and project. Add the iOS app (bundle `com.comly.app`) with an App Store Connect **in-app purchase key**, and the Android app (package `com.comly.app`) with a Google Play **service account JSON**. RevenueCat's setup wizard walks through generating both.
- [ ] **Step 5:** In RevenueCat, create the entitlement `premium` and attach both products to it. Create an Offering `default` with a monthly package, then build a paywall for it in RevenueCat's paywall editor. Its templates include the disclosures Apple requires: price, billing period, auto-renewal, and links to your Terms and Privacy Policy, which you point at `comly.app/terms` and `/privacy`.
- [ ] **Step 6:** Collect the four values later tasks need, and keep the secret ones out of chat and out of git:
  - iOS public SDK key (`appl_...`) and Android public SDK key (`goog_...`). These are safe in the client and go in `.env`.
  - A RevenueCat **secret** API key (`sk_...`), server only. Used in Task A7.
  - A long random webhook secret you generate yourself, e.g. `openssl rand -hex 32`. Used in Task A3.

---

### Task A1: Install the SDK and configure it at startup — est. 2 h

**Files:**
- Modify: `package.json` (via `npx expo install`)
- Modify: `src/config/env.ts` (the `env` object)
- Modify: `.env.example`
- Create: `src/services/purchases.ts`
- Modify: `App.tsx` (after `Sentry.init`)

**Interfaces:**
- Produces: `purchases` object exported from `src/services/purchases.ts` with `enabled(): boolean`, `configure(): void`, `identify(userId: string): Promise<void>`, `reset(): Promise<void>`, `presentPaywall(): Promise<boolean>`, `restore(): Promise<void>`, `manageSubscriptionUrl(): Promise<string | null>`

- [ ] **Step 1: Install**

Run: `cd /Users/puneetmuthu/Documents/comly && npx expo install react-native-purchases react-native-purchases-ui`
Expected: both packages are added to `package.json`. No config plugin is needed.

- [ ] **Step 2: Add the keys to env**

In `src/config/env.ts`, add to the `env` object after `sentryDsn`:

```ts
  revenuecatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '',
  revenuecatAndroidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '',
```

In `.env.example`, add these, **with blank values** per the file's convention:

```
# ── RevenueCat (client) ──────────────────────────────────────────────────────
# Public SDK keys from RevenueCat → Project settings → API keys. Safe to ship.
# Leave blank to disable purchases entirely (the Premium entry point hides).
EXPO_PUBLIC_REVENUECAT_IOS_KEY=
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=
```

Put the real `appl_...` and `goog_...` values in your local `.env` only.

- [ ] **Step 3: Write the wrapper**

Create `src/services/purchases.ts`:

```ts
/**
 * Thin wrapper over RevenueCat. Every method is a no-op when purchases are
 * disabled — mock mode, or no SDK key configured — so Expo Go, Jest, and
 * builds without keys never touch the native module.
 *
 * The client never decides whether someone HAS Premium. That's the
 * profiles.is_customer_plus / is_helper_pro flags, which only the
 * revenuecat-webhook edge function writes. This file just opens the store's
 * purchase flow.
 */

import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { env } from '@/config/env';

let configured = false;

function apiKey(): string {
  return Platform.OS === 'ios' ? env.revenuecatIosKey : env.revenuecatAndroidKey;
}

export const purchases = {
  enabled(): boolean {
    return !env.useMocks && apiKey().length > 0;
  },

  configure(): void {
    if (configured || !purchases.enabled()) return;
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey: apiKey() });
    configured = true;
  },

  /** Ties purchases to the Supabase user id — what the webhook receives as app_user_id. */
  async identify(userId: string): Promise<void> {
    if (!configured) return;
    await Purchases.logIn(userId);
  },

  async reset(): Promise<void> {
    if (!configured) return;
    // logOut throws when the current RevenueCat user is already anonymous.
    if (await Purchases.isAnonymous()) return;
    await Purchases.logOut();
  },

  /** Shows the RevenueCat paywall. True if the user purchased or restored. */
  async presentPaywall(): Promise<boolean> {
    if (!configured) return false;
    const result = await RevenueCatUI.presentPaywall();
    return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
  },

  async restore(): Promise<void> {
    if (!configured) return;
    await Purchases.restorePurchases();
  },

  /** Store page where the user manages or cancels the subscription. */
  async manageSubscriptionUrl(): Promise<string | null> {
    if (!configured) return null;
    const info = await Purchases.getCustomerInfo();
    return info.managementURL;
  },
};
```

- [ ] **Step 4: Configure at startup**

In `App.tsx`, add `import { purchases } from '@/services/purchases';` alongside the other `@/` imports. Directly after the `Sentry.init({...});` block, add:

```ts
purchases.configure();
```

- [ ] **Step 5: Typecheck and test**

Run: `npm run typecheck && npm test`
Expected: clean and passing. No test imports `App.tsx` or `purchases.ts`. If one ever does, add Jest `moduleNameMapper` stubs for `react-native-purchases` and `react-native-purchases-ui`, following `src/__tests__/stubs/expo-native.js`.

- [ ] **Step 6: Build a dev client**

Run: `eas build --profile development --platform android`. Add `--platform ios` too once the Apple account works.
Expected: the build succeeds. Install it and launch with `EXPO_PUBLIC_USE_MOCKS=false`. Metro's log shows RevenueCat debug lines, including `Purchases SDK configured`.

- [ ] **Step 7: Commit (user runs this)**

Suggested message: `Add RevenueCat SDK and configure purchases at startup`

---

### Task A2: Map webhook events to Premium changes (pure, tested) — est. 1.5 h

**Files:**
- Create: `supabase/functions/_shared/premiumEvents.ts`
- Create: `src/__tests__/premiumEvents.test.ts`

**Interfaces:**
- Produces: `PREMIUM_ENTITLEMENT = 'premium'`, `interface RevenueCatEvent`, `interface PremiumChange { userId: string; premium: boolean }`, `premiumChangesFor(event: RevenueCatEvent): PremiumChange[]`

This logic goes in `_shared` so the Deno edge function can import it. It uses no Deno APIs, so Jest can import it by relative path too. (Jest's `roots` setting only limits where test files are found, not what they can import.)

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/premiumEvents.test.ts`:

```ts
/**
 * Which RevenueCat events turn Premium on or off. The subtle ones:
 * CANCELLATION means auto-renew was switched off, not that access ended —
 * the user paid through the period. BILLING_ISSUE is the store's grace
 * period. Only EXPIRATION removes access.
 */

import {
  premiumChangesFor,
  RevenueCatEvent,
} from '../../supabase/functions/_shared/premiumEvents';

const USER = '0b6f8c1e-2d3a-4e5f-8a9b-1c2d3e4f5a6b';
const OTHER = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d';

const event = (type: string, extra: Partial<RevenueCatEvent> = {}): RevenueCatEvent => ({
  id: `evt_${type}`,
  type,
  app_user_id: USER,
  entitlement_ids: ['premium'],
  ...extra,
});

describe('premiumChangesFor', () => {
  it.each(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'SUBSCRIPTION_EXTENDED'])(
    'grants on %s',
    (type) => {
      expect(premiumChangesFor(event(type))).toEqual([{ userId: USER, premium: true }]);
    }
  );

  it('revokes only on EXPIRATION', () => {
    expect(premiumChangesFor(event('EXPIRATION'))).toEqual([{ userId: USER, premium: false }]);
  });

  it.each(['CANCELLATION', 'BILLING_ISSUE', 'TEST'])('changes nothing on %s', (type) => {
    expect(premiumChangesFor(event(type))).toEqual([]);
  });

  it('ignores events for other entitlements', () => {
    expect(premiumChangesFor(event('INITIAL_PURCHASE', { entitlement_ids: ['other'] }))).toEqual([]);
  });

  it('ignores anonymous RevenueCat ids that are not Supabase users', () => {
    expect(
      premiumChangesFor(event('INITIAL_PURCHASE', { app_user_id: '$RCAnonymousID:abc123' }))
    ).toEqual([]);
  });

  it('moves Premium on TRANSFER', () => {
    expect(
      premiumChangesFor(
        event('TRANSFER', {
          entitlement_ids: null,
          transferred_from: [USER],
          transferred_to: [OTHER],
        })
      )
    ).toEqual([
      { userId: USER, premium: false },
      { userId: OTHER, premium: true },
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx jest src/__tests__/premiumEvents.test.ts`
Expected: FAIL, "Cannot find module '../../supabase/functions/_shared/premiumEvents'".

- [ ] **Step 3: Implement**

Create `supabase/functions/_shared/premiumEvents.ts`:

```ts
/**
 * RevenueCat webhook event → changes to a user's Premium flags.
 *
 * Pure — no Deno APIs — so Jest can test it (src/__tests__/premiumEvents.test.ts)
 * and the revenuecat-webhook function can import it.
 */

export const PREMIUM_ENTITLEMENT = 'premium';

export interface RevenueCatEvent {
  id: string;
  type: string;
  app_user_id: string;
  entitlement_ids?: string[] | null;
  transferred_from?: string[];
  transferred_to?: string[];
  environment?: 'SANDBOX' | 'PRODUCTION';
}

export interface PremiumChange {
  userId: string;
  premium: boolean;
}

// CANCELLATION = auto-renew off, still paid through the period.
// BILLING_ISSUE = store grace period. Neither ends access; EXPIRATION does.
const GRANTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
]);
const REVOKES = new Set(['EXPIRATION']);

// The app calls Purchases.logIn(<supabase uuid>) before any purchase, so a
// real customer's app_user_id is a UUID. Anything else ($RCAnonymousID:…)
// isn't a Comly account and must not be written to profiles.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const comlyUsers = (ids: string[] = []) => ids.filter((id) => UUID.test(id));

export function premiumChangesFor(event: RevenueCatEvent): PremiumChange[] {
  if (event.type === 'TRANSFER') {
    return [
      ...comlyUsers(event.transferred_from).map((userId) => ({ userId, premium: false })),
      ...comlyUsers(event.transferred_to).map((userId) => ({ userId, premium: true })),
    ];
  }
  if (!(event.entitlement_ids ?? []).includes(PREMIUM_ENTITLEMENT)) return [];

  const users = comlyUsers([event.app_user_id]);
  if (GRANTS.has(event.type)) return users.map((userId) => ({ userId, premium: true }));
  if (REVOKES.has(event.type)) return users.map((userId) => ({ userId, premium: false }));
  return [];
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx jest src/__tests__/premiumEvents.test.ts && npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit (user runs this)**

Suggested message: `Map RevenueCat webhook events to Premium flag changes`

---

### Task A3: Webhook edge function and idempotency table — est. 3 h

**Files:**
- Create: `supabase/migrations/0028_revenuecat_events.sql`
- Create: `supabase/functions/revenuecat-webhook/index.ts`

**Interfaces:**
- Consumes: `premiumChangesFor`, `RevenueCatEvent` from `../_shared/premiumEvents.ts`
- Produces: HTTPS endpoint `POST /functions/v1/revenuecat-webhook`; table `revenuecat_events(event_id text primary key, ...)`

- [ ] **Step 1: Migration**

Create `supabase/migrations/0028_revenuecat_events.sql`:

```sql
-- ════════════════════════════════════════════════════════════════════════════
-- Comly — RevenueCat webhook idempotency
--
-- RevenueCat retries a webhook until it gets a 2xx, so the same event can
-- arrive more than once. Recording each event id first makes replays no-ops.
--
-- RLS on with no policies: only the service role (which bypasses RLS) ever
-- reads or writes this table. Premium flags themselves stay where 0016 put
-- them — profiles.is_customer_plus / is_helper_pro — and remain writable only
-- by privileged callers via guard_profile_privileged_columns().
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists revenuecat_events (
  event_id    text primary key,
  event_type  text not null,
  app_user_id text not null,
  received_at timestamptz not null default now()
);

alter table revenuecat_events enable row level security;
```

- [ ] **Step 2: Edge function**

Create `supabase/functions/revenuecat-webhook/index.ts`:

```ts
/**
 * RevenueCat → Supabase: the ONLY writer of Premium flags.
 *
 * Deployed with --no-verify-jwt because RevenueCat can't send a Supabase JWT.
 * That is safe here only because every request must carry the shared secret
 * configured in RevenueCat's webhook settings, compared in constant time.
 */

import { premiumChangesFor, RevenueCatEvent } from '../_shared/premiumEvents.ts';

function env(key: string): string {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing env ${key}`);
  return value;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function rest(path: string, init: RequestInit): Promise<Response> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  return fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const expected = `Bearer ${env('REVENUECAT_WEBHOOK_SECRET')}`;
  if (!constantTimeEqual(req.headers.get('authorization') ?? '', expected)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const event: RevenueCatEvent | undefined = body?.event;
  if (!event?.id || !event.type) return new Response('Bad request', { status: 400 });

  // Claim the event id first; an empty result means it was already handled.
  const claim = await rest('revenuecat_events?on_conflict=event_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({
      event_id: event.id,
      event_type: event.type,
      app_user_id: event.app_user_id ?? '',
    }),
  });
  if (!claim.ok) return new Response('Could not record event', { status: 500 });
  const claimed = await claim.json();
  if (Array.isArray(claimed) && claimed.length === 0) {
    return new Response('Already processed', { status: 200 });
  }

  for (const change of premiumChangesFor(event)) {
    // userId is UUID-validated in premiumChangesFor, so it's safe in the URL.
    const res = await rest(`profiles?id=eq.${change.userId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        is_customer_plus: change.premium,
        is_helper_pro: change.premium,
      }),
    });
    if (!res.ok) {
      // Release the claim so RevenueCat's retry processes this event again.
      await rest(`revenuecat_events?event_id=eq.${encodeURIComponent(event.id)}`, {
        method: 'DELETE',
      });
      console.error(`premium update failed for ${change.userId}: ${res.status}`);
      return new Response('Could not update profile', { status: 500 });
    }
  }

  return new Response('ok', { status: 200 });
});
```

- [ ] **Step 3: Deploy**

```bash
npx supabase db push
npx supabase secrets set REVENUECAT_WEBHOOK_SECRET=<the value from Task A0 Step 6>
npx supabase functions deploy revenuecat-webhook --no-verify-jwt
```

- [ ] **Step 4: Verify the secret check**

```bash
curl -i -X POST "$SUPABASE_URL/functions/v1/revenuecat-webhook" -d '{}'
```

Expected: `401 Unauthorized`.

- [ ] **Step 5: Verify with a real test event**

In RevenueCat, go to **Project settings → Integrations → Webhooks** and set:
- URL: `https://lxcavavtgluqhxprvxnj.supabase.co/functions/v1/revenuecat-webhook`
- Authorization header: `Bearer <webhook secret>`

Click **Send test event**. Expected: RevenueCat shows a `200` response. In the SQL Editor, `select * from revenuecat_events order by received_at desc limit 1;` shows a `TEST` row. A `TEST` event changes no flags, by design.

- [ ] **Step 6: Commit (user runs this)**

Suggested message: `Add RevenueCat webhook as the sole writer of Premium flags`

---

### Task A4: Premium rules the UI relies on (pure, tested) — est. 1.5 h

**Files:**
- Create: `src/lib/premium.ts`
- Create: `src/__tests__/premium.purchase.test.ts`

**Interfaces:**
- Produces:
  - `canPurchasePremium(user: Pick<UserProfile, 'ageBracket' | 'ageGroup'>): boolean`
  - `hasPremium(user: Pick<UserProfile, 'isCustomerPlus' | 'isHelperPro'>): boolean`
  - `waitForPremium(reload: () => Promise<boolean>, opts?: { timeoutMs?: number; intervalMs?: number }): Promise<boolean>`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/premium.purchase.test.ts`:

```ts
/**
 * Premium purchase rules: adults only in v1, and the client waits for the
 * server-owned flag instead of trusting the store's receipt directly.
 */

import { canPurchasePremium, hasPremium, waitForPremium } from '@/lib/premium';

describe('canPurchasePremium', () => {
  it('allows adults', () => {
    expect(canPurchasePremium({ ageBracket: 'adult', ageGroup: 'adult' })).toBe(true);
  });

  it('refuses every minor bracket', () => {
    for (const ageBracket of ['under_14', 'fourteen_fifteen', 'sixteen_seventeen'] as const) {
      expect(canPurchasePremium({ ageBracket, ageGroup: 'teen' })).toBe(false);
    }
  });

  it('treats a legacy teen with no bracket as a minor', () => {
    expect(canPurchasePremium({ ageBracket: undefined, ageGroup: 'teen' })).toBe(false);
  });
});

describe('hasPremium', () => {
  it('is true if either server flag is set', () => {
    expect(hasPremium({ isCustomerPlus: true, isHelperPro: false })).toBe(true);
    expect(hasPremium({ isCustomerPlus: false, isHelperPro: false })).toBe(false);
  });
});

describe('waitForPremium', () => {
  it('resolves true as soon as the flag flips', async () => {
    let calls = 0;
    const reload = async () => ++calls >= 3;
    await expect(waitForPremium(reload, { timeoutMs: 500, intervalMs: 5 })).resolves.toBe(true);
    expect(calls).toBe(3);
  });

  it('resolves false if the flag never flips before the timeout', async () => {
    await expect(
      waitForPremium(async () => false, { timeoutMs: 30, intervalMs: 5 })
    ).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx jest src/__tests__/premium.purchase.test.ts`
Expected: FAIL, "Cannot find module '@/lib/premium'".

- [ ] **Step 3: Implement**

Create `src/lib/premium.ts`:

```ts
/**
 * Premium purchase rules for the UI. Having Premium is always read from the
 * server-owned profile flags — never from the store receipt on the device.
 */

import { effectiveAgeBracket, UserProfile } from '@/types/domain';

/** Adults only in v1: Pro Helper priority is effectively paying for a better shot at jobs. */
export function canPurchasePremium(user: Pick<UserProfile, 'ageBracket' | 'ageGroup'>): boolean {
  return effectiveAgeBracket(user.ageBracket, user.ageGroup) === 'adult';
}

export function hasPremium(user: Pick<UserProfile, 'isCustomerPlus' | 'isHelperPro'>): boolean {
  return user.isCustomerPlus || user.isHelperPro;
}

/**
 * The store confirms a purchase before RevenueCat's webhook reaches our
 * server, so the profile flag lags by a few seconds. Polls `reload` (which
 * should refetch the profile and report whether Premium is on) until it
 * flips or the timeout passes.
 */
export async function waitForPremium(
  reload: () => Promise<boolean>,
  { timeoutMs = 15_000, intervalMs = 1_500 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await reload()) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx jest src/__tests__/premium.purchase.test.ts && npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit (user runs this)**

Suggested message: `Add Premium purchase eligibility and server-flag polling helpers`

---

### Task A5: Tie RevenueCat identity to sign-in and sign-out — est. 1 h

**Files:**
- Modify: `src/stores/authStore.ts` (`adoptSession` ~line 268, `signOut` ~line 277)

**Interfaces:**
- Consumes: `purchases.identify`, `purchases.reset` from Task A1

- [ ] **Step 1: Implement**

In `src/stores/authStore.ts`, add `import { purchases } from '@/services/purchases';`.

In `adoptSession`, in the real-backend success path, directly after the final `set({ user: result.profile, ... });` and before `return { ok: true };`, add:

```ts
    // The webhook identifies buyers by this id. Failing here must not block
    // sign-in; the paywall re-identifies before any purchase anyway.
    purchases.identify(result.profile.id).catch((err) =>
      console.warn('[Comly] RevenueCat logIn failed:', err)
    );
```

In `signOut`, directly before `set({ user: null, isAuthenticated: false, activeRole: 'customer' });`, add:

```ts
    await purchases.reset().catch((err) =>
      console.warn('[Comly] RevenueCat logOut failed:', err)
    );
```

- [ ] **Step 2: Typecheck and test**

Run: `npm run typecheck && npm test`
Expected: clean and passing.

- [ ] **Step 3: Verify on the dev build**

Sign in, and check the RevenueCat dashboard's **Customers** list: the customer id is your Supabase user UUID, not `$RCAnonymousID`. Sign out and back in as a different account; a second UUID customer appears.

- [ ] **Step 4: Commit (user runs this)**

Suggested message: `Identify RevenueCat customers by Supabase user id`

---

### Task A6: Premium entry points on the Profile screen — est. 3 h

**Files:**
- Modify: `src/screens/shared/ProfileScreen.tsx` (imports lines 6–39; Settings card starting ~line 246)

**Interfaces:**
- Consumes: `purchases` (A1), `canPurchasePremium`, `hasPremium`, `waitForPremium` (A4), `useAuthStore` `adoptSession`

- [ ] **Step 1: Implement**

In `src/screens/shared/ProfileScreen.tsx`:

Change the `react-native` import to include `Linking`:

```ts
import { Linking, Pressable, StyleSheet, View } from 'react-native';
```

Add these imports:

```ts
import { purchases } from '@/services/purchases';
import { canPurchasePremium, hasPremium, waitForPremium } from '@/lib/premium';
```

Inside the component, next to `const signOut = useAuthStore((s) => s.signOut);` (line 56), add:

```ts
  const adoptSession = useAuthStore((s) => s.adoptSession);
  const [upgrading, setUpgrading] = useState(false);

  const showPremium = !!user && purchases.enabled() && canPurchasePremium(user);
  const isPremium = !!user && hasPremium(user);

  const reloadHasPremium = async () => {
    await adoptSession();
    const fresh = useAuthStore.getState().user;
    return !!fresh && hasPremium(fresh);
  };

  const upgrade = async () => {
    if (upgrading) return;
    setUpgrading(true);
    try {
      const bought = await purchases.presentPaywall();
      if (!bought) return;
      const active = await waitForPremium(reloadHasPremium);
      if (active) toast.success('Welcome to Comly Premium!');
      else toast.error('Purchase received — Premium will appear in a minute.');
    } catch {
      toast.error('Could not open the store. Please try again.');
    } finally {
      setUpgrading(false);
    }
  };

  const restore = async () => {
    try {
      await purchases.restore();
      const active = await waitForPremium(reloadHasPremium, { timeoutMs: 8_000 });
      toast.success(active ? 'Premium restored.' : 'No active Premium subscription found.');
    } catch {
      toast.error('Could not restore purchases. Please try again.');
    }
  };

  const manage = async () => {
    const url = await purchases.manageSubscriptionUrl();
    if (url) await Linking.openURL(url);
  };
```

This assumes the component already has `const user = useAuthStore((s) => s.user);`. Check near line 56; if the user comes from somewhere else, use that variable instead.

In the Settings `<Card>`, directly after the `Edit profile` row and its `<Divider inset />`, add:

```tsx
          {showPremium && (
            <>
              {isPremium ? (
                <SettingsRow icon="star" label="Manage Comly Premium" onPress={manage} />
              ) : (
                <SettingsRow
                  icon="star-outline"
                  label={upgrading ? 'Opening…' : 'Get Comly Premium'}
                  onPress={upgrade}
                />
              )}
              <Divider inset />
              {/* Apple requires a visible way to restore purchases. */}
              <SettingsRow icon="refresh-outline" label="Restore purchases" onPress={restore} />
              <Divider inset />
            </>
          )}
```

- [ ] **Step 2: Typecheck and test**

Run: `npm run typecheck && npm test`
Expected: clean and passing.

- [ ] **Step 3: Verify on the dev build (sandbox)**

1. As an **adult** account, open Profile. "Get Comly Premium" and "Restore purchases" are visible.
2. As a **minor** account, open Profile. Neither row appears.
3. With `EXPO_PUBLIC_USE_MOCKS=true`, neither row appears, because purchases are disabled.

- [ ] **Step 4: Commit (user runs this)**

Suggested message: `Add Premium upgrade, restore, and manage entry points for adults`

---

### Task A7: Account deletion and subscriptions — est. 1.5 h

**Files:**
- Modify: `supabase/functions/delete-account/index.ts` (add a helper after `removeAvatars`; call it in the handler after `removeAvatars(userId)`)
- Modify: `src/components/people/DeleteAccountSheet.tsx:82-83` (warning copy)

Apple requires telling users that deleting an account does **not** cancel a store subscription. RevenueCat's copy of the customer's data should also be removed on deletion.

- [ ] **Step 1: Delete the RevenueCat customer**

In `supabase/functions/delete-account/index.ts`, after the `removeAvatars` function, add:

```ts
/**
 * Removes the customer's purchase history from RevenueCat. This does NOT
 * cancel an App Store / Play subscription — only the user can, in their store
 * account — which the in-app deletion screen tells them.
 */
async function removeRevenueCatCustomer(userId: string): Promise<string | null> {
  const key = Deno.env.get('REVENUECAT_SECRET_API_KEY');
  if (!key) return null; // Premium isn't configured in this environment.
  try {
    const res = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${key}` } }
    );
    return res.ok || res.status === 404 ? null : `revenuecat delete failed (${res.status})`;
  } catch (err) {
    return `revenuecat error: ${String(err)}`;
  }
}
```

In the handler, replace:

```ts
    const storageWarning = await removeAvatars(userId);
```

with:

```ts
    const storageWarning = await removeAvatars(userId);
    const revenueCatWarning = await removeRevenueCatCustomer(userId);
```

And replace `return json({ ok: true, storageWarning });` with:

```ts
    return json({ ok: true, storageWarning, revenueCatWarning });
```

Deploy:

```bash
npx supabase secrets set REVENUECAT_SECRET_API_KEY=<sk_... from Task A0>
npx supabase functions deploy delete-account
```

- [ ] **Step 2: Warn in the deletion sheet**

In `src/components/people/DeleteAccountSheet.tsx`, the body text at lines 82–83 currently reads "This cannot be undone. Your profile, contact details, listings, and applications are permanently removed." Append this sentence to that same `Text`:

```
 If you subscribe to Comly Premium, deleting your account does not cancel it — cancel it in your App Store or Google Play subscriptions first.
```

- [ ] **Step 3: Verify**

Delete a sandbox test account that has Premium. Expected: the response JSON has `revenueCatWarning: null`, and the customer is gone from RevenueCat's Customers list.

- [ ] **Step 4: Commit (user runs this)**

Suggested message: `Remove RevenueCat customer on account deletion and warn about store subscriptions`

---

### Task A8: Legal text for subscriptions — est. 2 h plus counsel review

**Files:**
- Modify: `src/legal/content.ts` (ToS §1 — new `h3` after "Our role, and payment between users"; Privacy Policy §1 list and §4 list; version constants)

This adds the section as an `h3` under §1, so no section numbers change.

- [ ] **Step 1: Terms of Service**

In `TERMS_OF_SERVICE`, directly after the last paragraph of "Our role, and payment between users" (the one ending "Any such dispute must be resolved between the users themselves."), add:

```ts
    { type: 'h3', text: `Comly Premium` },
    {
      type: 'p',
      text: `Comly Premium is an optional auto-renewing subscription sold through the Apple App Store or Google Play and available only to users 18 and older. Premium changes where your listings and applications appear — your listings are shown higher and your applications are marked as priority. It does not change safety tiers, age rules, parent-approval requirements, or whether anyone can see or apply to a job.`,
    },
    {
      type: 'p',
      text: `Payment is charged to your App Store or Google Play account when you confirm the purchase. The subscription renews automatically at the same price and for the same period unless you turn off auto-renew at least 24 hours before the current period ends. You can manage or cancel it in your App Store or Google Play account settings. Refunds are handled by Apple or Google under their own policies. Deleting your Comly account does not cancel a subscription.`,
    },
```

- [ ] **Step 2: Privacy Policy**

In `PRIVACY_POLICY` §1's list of collected information, after the item about consent records, add:

```ts
    {
      type: 'li',
      text: `If you subscribe to Comly Premium: your subscription status and its purchase and renewal history, as reported by Apple or Google. We never receive your payment card details.`,
    },
```

In §4's sharing list, after the Sentry item, add:

```ts
    {
      type: 'li',
      text: `With RevenueCat, which manages Comly Premium subscriptions on our behalf: your Comly account ID and your subscription's purchase and renewal history.`,
    },
```

- [ ] **Step 3: Bump the versions**

Set `TERMS_VERSION`, `TERMS_RECONSENT_SINCE`, `PRIVACY_VERSION`, and `PRIVACY_RECONSENT_SINCE` to the ship date, and update both `lastUpdated` strings. Add changelog lines to the comment above the `*_RECONSENT_SINCE` constants, following the existing format:

```
 *   <date> terms   — added Comly Premium subscription terms.
 *   <date> privacy — disclosed RevenueCat and subscription purchase history.
```

- [ ] **Step 4: Regenerate the hosted pages and test**

Run: `npm run legal:html && npm run typecheck && npm test`
Expected: `wrote web/legal/terms.html`, `wrote web/legal/privacy.html`, and everything passes.

- [ ] **Step 5: Counsel review**

Send the two new ToS paragraphs to counsel before release, the same way the §2 clause was reviewed.

- [ ] **Step 6: Commit (user runs this)**

Suggested message: `Add Comly Premium subscription terms and RevenueCat privacy disclosure`

---

### Task A9: Store metadata for in-app purchase review — est. 1.5 h (you)

**Files:** none (App Store Connect and Play Console)

- [ ] **Step 1:** App Store Connect → **App Privacy**: add **Purchases → Purchase History**, *Linked to the user*, purpose *App Functionality*.
- [ ] **Step 2:** On the subscription product, upload a **review screenshot** of the paywall and write review notes: "Premium changes sort order and adds a badge. Sold to adults 18+ only. Test with the sandbox account below." Give the reviewer an adult sandbox account.
- [ ] **Step 3:** Play Console → **Data safety**: declare **Financial info → Purchase history**, collected, not shared, for app functionality.
- [ ] **Step 4:** Add a Premium line to the store description in `store-assets/STORE_LISTING.md`, e.g. "Optional Comly Premium (18+): your listings and applications get top placement."

---

### Task A10: Sandbox end-to-end test, then ship — est. 4 h plus Apple review

**Files:** none

- [ ] **Step 1: iOS sandbox.** On a dev build, as an adult account signed into a sandbox Apple ID: Profile → **Get Comly Premium** → buy. Expected, all within about 15 seconds:
  - "Welcome to Comly Premium!" toast
  - the row changes to "Manage Comly Premium"
  - `select is_customer_plus, is_helper_pro from profiles where id = '<uuid>';` returns `true, true`
  - the account's new job listing is posted boosted
- [ ] **Step 2: Expiration.** Sandbox subscriptions renew every few minutes and stop after a few renewals. Wait for the `EXPIRATION` webhook. Expected: both flags return to `false`.
- [ ] **Step 3: Restore.** Delete the app, reinstall it, sign in, and tap **Restore purchases** while a sandbox subscription is active. Expected: "Premium restored."
- [ ] **Step 4: Replay safety.** In RevenueCat's webhook log, resend a delivered `INITIAL_PURCHASE`. Expected: `200 Already processed`, and no duplicate row in `revenuecat_events`.
- [ ] **Step 5: Android.** Repeat Steps 1–3 with a Play **license tester** account on an internal-testing track build.
- [ ] **Step 6: Ship.** Build a production binary (`eas build --profile production --platform ios`). In App Store Connect, attach the `comly_premium_monthly` product to the new version, then submit. Apple reviews the product and the update together, typically in 1–3 days.

---

## Part B — Ads (optional)

### Task B0: Decision gate (you) — est. 1 h plus AdMob approval

**Files:** none

Be deliberate before building this:
- Comly's selling point is teen safety. Ads, even filtered ones, shown to 13–17-year-olds in a work marketplace can undercut that. The honest store copy has to say the app contains ads.
- Minors can't get personalized ads. Google's policies and many state privacy laws require non-personalized, age-appropriate ads for users under 18. That lowers what ads earn exactly where much of your audience is.
- Ads work best alongside Premium, with "No ads" as a Premium perk. That's why this is Part B and not a replacement for Part A.

**Recommendation:** ship Part A first. Decide on ads after a month of real Premium conversion data.

- [ ] **Step 1:** Decide go or no-go. If go, create an AdMob account, register the iOS and Android apps, and create one **banner** ad unit per platform. Note the two App IDs (`ca-app-pub-…~…`) and the two banner unit IDs (`ca-app-pub-…/…`).

---

### Task B1: Install AdMob and set up app IDs — est. 2 h

**Files:**
- Modify: `package.json` (via `npx expo install`)
- Modify: `app.json` (`plugins`, `ios.infoPlist`)
- Modify: `src/config/env.ts`, `.env.example`

- [ ] **Step 1: Install**

Run: `npx expo install react-native-google-mobile-ads expo-tracking-transparency`

- [ ] **Step 2: Config plugin and tracking permission text**

In `app.json`, add to `plugins`:

```json
      [
        "react-native-google-mobile-ads",
        {
          "androidAppId": "<AdMob Android App ID>",
          "iosAppId": "<AdMob iOS App ID>"
        }
      ],
      "expo-tracking-transparency"
```

In `ios.infoPlist`, add:

```json
        "NSUserTrackingUsageDescription": "Comly uses this only to show adults ads that are more relevant. Choosing not to allow it doesn't change anything else in the app."
```

- [ ] **Step 3: Ad unit env vars**

In `src/config/env.ts`, add to `env`:

```ts
  admobBannerIos: process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS ?? '',
  admobBannerAndroid: process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID ?? '',
```

In `.env.example`, add the two keys with blank values, under a `# ── AdMob (client) ──` heading.

- [ ] **Step 4: Rebuild the dev client and typecheck**

Run: `npm run typecheck && eas build --profile development --platform android`
Expected: the build succeeds.

- [ ] **Step 5: Commit (user runs this)**

Suggested message: `Add AdMob SDK and tracking-permission configuration`

---

### Task B2: Ad policy per user (pure, tested) — est. 1.5 h

**Files:**
- Create: `src/lib/ads.ts`
- Create: `src/__tests__/ads.test.ts`

**Interfaces:**
- Consumes: `hasPremium` (A4), `effectiveAgeBracket`
- Produces: `interface AdPolicy { showAds: boolean; personalizedAllowed: boolean; maxContentRating: 'G' | 'PG'; underAgeOfConsent: boolean }` and `adPolicyFor(user: Pick<UserProfile, 'ageBracket' | 'ageGroup' | 'isCustomerPlus' | 'isHelperPro'>): AdPolicy`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/ads.test.ts`:

```ts
/**
 * Ads are shown only to non-Premium users, never personalized for minors,
 * and capped at G-rated content for minors.
 */

import { adPolicyFor } from '@/lib/ads';

const base = { isCustomerPlus: false, isHelperPro: false };

describe('adPolicyFor', () => {
  it('shows no ads to Premium users', () => {
    const policy = adPolicyFor({ ...base, isCustomerPlus: true, ageBracket: 'adult', ageGroup: 'adult' });
    expect(policy.showAds).toBe(false);
  });

  it('never personalizes ads for minors, and caps them at G', () => {
    const policy = adPolicyFor({ ...base, ageBracket: 'sixteen_seventeen', ageGroup: 'teen' });
    expect(policy).toEqual({
      showAds: true,
      personalizedAllowed: false,
      maxContentRating: 'G',
      underAgeOfConsent: true,
    });
  });

  it('treats a legacy teen with no bracket as a minor', () => {
    expect(adPolicyFor({ ...base, ageBracket: undefined, ageGroup: 'teen' }).underAgeOfConsent).toBe(true);
  });

  it('lets adults opt into personalized, PG-capped ads', () => {
    const policy = adPolicyFor({ ...base, ageBracket: 'adult', ageGroup: 'adult' });
    expect(policy.personalizedAllowed).toBe(true);
    expect(policy.maxContentRating).toBe('PG');
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx jest src/__tests__/ads.test.ts`
Expected: FAIL, "Cannot find module '@/lib/ads'".

- [ ] **Step 3: Implement**

Create `src/lib/ads.ts`:

```ts
/**
 * What ads, if any, a user may be shown. Personalization for adults still
 * also requires their tracking/consent choice at runtime — personalizedAllowed
 * is the ceiling, not the decision.
 */

import { effectiveAgeBracket, UserProfile } from '@/types/domain';
import { hasPremium } from '@/lib/premium';

export interface AdPolicy {
  showAds: boolean;
  personalizedAllowed: boolean;
  maxContentRating: 'G' | 'PG';
  underAgeOfConsent: boolean;
}

export function adPolicyFor(
  user: Pick<UserProfile, 'ageBracket' | 'ageGroup' | 'isCustomerPlus' | 'isHelperPro'>
): AdPolicy {
  const adult = effectiveAgeBracket(user.ageBracket, user.ageGroup) === 'adult';
  return {
    showAds: !hasPremium(user),
    personalizedAllowed: adult,
    maxContentRating: adult ? 'PG' : 'G',
    underAgeOfConsent: !adult,
  };
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx jest src/__tests__/ads.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit (user runs this)**

Suggested message: `Add per-user ad policy: no ads for Premium, non-personalized G for minors`

---

### Task B3: Consent, tracking permission, and SDK startup — est. 3 h

**Files:**
- Create: `src/hooks/useAds.ts`

**Interfaces:**
- Consumes: `adPolicyFor` (B2), `useAuthStore`
- Produces: `useAds(): { ready: boolean; policy: AdPolicy | null; personalized: boolean }`

- [ ] **Step 1: Implement**

Create `src/hooks/useAds.ts`:

```ts
/**
 * Starts AdMob once per signed-in user with the right restrictions applied
 * BEFORE any ad loads: content rating and under-age-of-consent tagging come
 * from the user's age; personalization for adults also needs their GDPR
 * consent (UMP) and, on iOS, App Tracking Transparency permission.
 */

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import mobileAds, { AdsConsent, MaxAdContentRating } from 'react-native-google-mobile-ads';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { useAuthStore } from '@/stores/authStore';
import { adPolicyFor, AdPolicy } from '@/lib/ads';
import { env } from '@/config/env';

export function useAds(): { ready: boolean; policy: AdPolicy | null; personalized: boolean } {
  const user = useAuthStore((s) => s.user);
  const [ready, setReady] = useState(false);
  const [personalized, setPersonalized] = useState(false);
  const policy = user ? adPolicyFor(user) : null;

  useEffect(() => {
    if (!policy?.showAds || env.useMocks) return;
    let cancelled = false;

    (async () => {
      await mobileAds().setRequestConfiguration({
        maxAdContentRating:
          policy.maxContentRating === 'G' ? MaxAdContentRating.G : MaxAdContentRating.PG,
        tagForUnderAgeOfConsent: policy.underAgeOfConsent,
        tagForChildDirectedTreatment: false,
      });

      let allowPersonalized = false;
      if (policy.personalizedAllowed) {
        try {
          await AdsConsent.requestInfoUpdate();
          await AdsConsent.loadAndShowConsentFormIfRequired();
          const consent = await AdsConsent.getUserChoices();
          allowPersonalized = consent.selectPersonalisedAds;
          if (allowPersonalized && Platform.OS === 'ios') {
            const { granted } = await requestTrackingPermissionsAsync();
            allowPersonalized = granted;
          }
        } catch {
          allowPersonalized = false;
        }
      }

      await mobileAds().initialize();
      if (!cancelled) {
        setPersonalized(allowPersonalized);
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Re-run only when the inputs to the policy change, not on every render.
  }, [policy?.showAds, policy?.personalizedAllowed, policy?.maxContentRating, policy?.underAgeOfConsent]);

  return { ready, policy, personalized };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean. If the installed `react-native-google-mobile-ads` version names the consent calls differently (newer versions offer `AdsConsent.gatherConsent()`), use that version's equivalents. The behavior must stay the same: consent, then ATT, then initialize.

- [ ] **Step 3: Commit (user runs this)**

Suggested message: `Start AdMob with age-based restrictions, consent, and ATT`

---

### Task B4: A single feed banner — est. 2.5 h

**Files:**
- Create: `src/components/ads/FeedBannerAd.tsx`
- Modify: `src/screens/helper/JobFeedScreen.tsx` (render the banner directly below the filter chips, ~line 130)

Ads appear **only** in the job feed. They never appear in applying, messaging, contact, parent-consent, or safety/report flows.

- [ ] **Step 1: Component**

Create `src/components/ads/FeedBannerAd.tsx`:

```tsx
/**
 * The only ad placement in Comly: one banner in the job feed. Renders
 * nothing for Premium users, in mock mode, before AdMob is ready, or if the
 * ad fails to load.
 */

import { useState } from 'react';
import { Platform, View } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useAds } from '@/hooks/useAds';
import { env } from '@/config/env';

export function FeedBannerAd() {
  const { ready, policy, personalized } = useAds();
  const [failed, setFailed] = useState(false);

  if (!ready || !policy?.showAds || failed) return null;

  const unitId = __DEV__
    ? TestIds.ADAPTIVE_BANNER
    : Platform.OS === 'ios'
      ? env.admobBannerIos
      : env.admobBannerAndroid;
  if (!unitId) return null;

  return (
    <View style={{ alignItems: 'center', marginVertical: 8 }}>
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: !personalized }}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}
```

- [ ] **Step 2: Place it**

In `src/screens/helper/JobFeedScreen.tsx`, import `FeedBannerAd` from `@/components/ads/FeedBannerAd`. Render `<FeedBannerAd />` directly after the closing tag of the filter-chips `ScrollView` that starts at the `{/* Filter chips */}` comment (~line 117).

- [ ] **Step 3: Verify on the dev build**

1. As a **non-Premium adult**, the feed shows a Google *test* banner. The consent form appears first if your region requires it.
2. As a **minor**, the test banner shows, with no ATT prompt and no consent form (personalization is never requested).
3. As a **Premium** user, no banner.
4. Apply, messaging, and parent-consent screens never show a banner.

- [ ] **Step 4: Commit (user runs this)**

Suggested message: `Show a single age-restricted banner in the job feed for non-Premium users`

---

### Task B5: Legal and store declarations for ads — est. 2 h

**Files:**
- Modify: `src/legal/content.ts` (Privacy Policy "Information collected automatically" paragraph and §4 list; version bumps)
- Modify: `store-assets/STORE_LISTING.md`

- [ ] **Step 1: Privacy Policy.** The paragraph under "Information collected automatically" currently says "We do not use any third-party analytics or advertising service." Replace that sentence with:

```
We show ads to users without Comly Premium through Google AdMob. Ads shown to users under 18 are never personalized and are limited to general-audience content; adults are asked before any ad personalization, and on iOS can decline tracking without affecting anything else in the app.
```

In §4, add:

```ts
    {
      type: 'li',
      text: `With Google (AdMob), our advertising provider: device and app information needed to show an ad, and — only for adults who allow it — an advertising identifier used to personalize ads.`,
    },
```

Bump `PRIVACY_VERSION`, `PRIVACY_RECONSENT_SINCE`, and `lastUpdated`, add a changelog line, then run `npm run legal:html`.

- [ ] **Step 2: App Store Connect.** Update **App Privacy**: Identifiers → Device ID (for adults who allow tracking), Usage Data → Advertising Data, purpose *Third-Party Advertising*. Mark "Used for tracking" only for the adult-with-ATT case.
- [ ] **Step 3: Play Console.** Set **App content → Ads** to "Contains ads", and update **Data safety** to match.
- [ ] **Step 4: Store copy.** In `store-assets/STORE_LISTING.md`, add "Contains ads. Comly Premium (18+) removes them." to the description, and update the age-rating notes: the app now contains ads.
- [ ] **Step 5: Run everything.** `npm run typecheck && npm test`, both passing.
- [ ] **Step 6: Commit (user runs this).** Suggested message: `Disclose AdMob in the Privacy Policy and store listing`

---

### Task B6: Device test and release — est. 2 h

- [ ] **Step 1:** Run B4 Step 3's checks on a real iOS device and a real Android device, using test ads.
- [ ] **Step 2:** Confirm in the AdMob dashboard that requests from the minor test account show as **non-personalized** and **tagged under-age-of-consent**.
- [ ] **Step 3:** Ship as an app update. Only production builds use the real unit IDs, because `__DEV__` builds always use test IDs.

---

## Time estimate

### Part A — Comly Premium (RevenueCat)

| Task | Who | Est. |
|---|---|---|
| A0 — Agreements, products, RevenueCat setup | You | 3 h, plus 1–3 days waiting for Apple's Paid Apps Agreement |
| A1 — SDK install, config, dev build | Eng | 2 h |
| A2 — Webhook event mapper + tests | Eng | 1.5 h |
| A3 — Webhook function + idempotency + deploy | Eng | 3 h |
| A4 — Purchase rules + tests | Eng | 1.5 h |
| A5 — Identity on sign-in and sign-out | Eng | 1 h |
| A6 — Profile entry points (upgrade, restore, manage) | Eng | 3 h |
| A7 — Account deletion + subscription warning | Eng | 1.5 h |
| A8 — ToS and Privacy text | Eng | 2 h, plus counsel review |
| A9 — Store privacy labels and IAP review metadata | You | 1.5 h |
| A10 — Sandbox E2E on both platforms, then ship | Eng | 4 h, plus 1–3 days of Apple review |
| **Part A total** | | **~24 h** (19.5 h eng + 4.5 h yours); **~1.5–2 weeks on the calendar** |

### Part B — Ads (optional)

| Task | Who | Est. |
|---|---|---|
| B0 — Decision + AdMob setup | You | 1 h, plus AdMob app review (usually a few days) |
| B1 — SDK install + app IDs | Eng | 2 h |
| B2 — Per-user ad policy + tests | Eng | 1.5 h |
| B3 — Consent, ATT, startup | Eng | 3 h |
| B4 — Feed banner + placement | Eng | 2.5 h |
| B5 — Privacy Policy and store declarations | Eng | 2 h |
| B6 — Device test + release | Eng | 2 h |
| **Part B total** | | **~14 h** (13 h eng + 1 h yours); **~1 week on the calendar** |

### Combined

**~38 hours** for both parts: 32.5 engineering hours plus 5.5 hours of your setup. Spread over about 2.5–3 weeks of calendar time, mostly because of Apple and AdMob approval waits rather than engineering.
