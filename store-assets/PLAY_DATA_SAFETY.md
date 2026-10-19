# Google Play — Data safety form and app content answers

Drafted from what the code actually collects (`src/services`, the Supabase
schema, `src/lib/secureStorage.ts`, Sentry setup in `App.tsx`). If the app
starts collecting something new, update this file and the form together.

Play Console → **Policy and programs → App content**.

---

## Data safety

### Overview questions

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS to Supabase, Sentry, and the AI function) |
| Do you provide a way for users to request that their data is deleted? | **Yes**. In the app (Profile → Delete my account) and at **https://comly.app/delete-account** |

**Sharing:** answer **No** for every data type below. Play doesn't count
transfers to service providers that process data on your behalf (Supabase,
Sentry, Google's Gemini API, Resend), or information a user chooses to show
other users (their public profile, job listings, reviews), as "sharing".

### Data types collected

| Category → type | Collected? | Required / optional | Purposes |
|---|---|---|---|
| Personal info → **Name** | Yes | Required | App functionality, Account management |
| Personal info → **Email address** | Yes | Required | Account management, App functionality |
| Personal info → **Phone number** | Yes | Optional | App functionality (shared with the other person only after acceptance) |
| Personal info → **Address** | Yes | Required | App functionality. The neighborhood users type in, shown publicly as an approximate area. Declared conservatively. |
| Personal info → **Other info** | Yes | Required | App functionality, Fraud prevention, security and compliance. Date of birth (age-gating), school email and parent or guardian email (optional verifications) |
| Photos and videos → **Photos** | Yes | Optional | App functionality (profile photo) |
| App activity → **Other user-generated content** | Yes | Required | App functionality. Job posts, application messages, reviews, reports, support tickets |
| App info and performance → **Crash logs** | Yes | Required | Analytics (Sentry; IP storage turned off) |
| App info and performance → **Diagnostics** | Yes | Required | Analytics (Sentry performance traces) |

**Not collected:** precise or approximate *device* location, contacts,
calendar, financial info, health, messages (SMS/email), audio, files,
web browsing, installed apps, device or other IDs, advertising ID.

"Ephemeral processing" doesn't apply to any of the above. Everything listed
is stored.

---

## Other App content declarations

| Declaration | Answer |
|---|---|
| **Privacy policy** | https://comly.app/privacy |
| **App access** | Some functionality is restricted: provide a reviewer test account (an adult customer, plus a teen helper if you want them to see the eligibility rules), with sign-in instructions |
| **Ads** | No, the app does not contain ads |
| **Content rating** | Complete the IARC questionnaire. Answer *yes* to user interaction / user-generated content and to users being able to share info; *no* to violence, sexual content, gambling, purchases |
| **Target audience** | **13–15, 16–17, 18 and over**. Do *not* select under 13 (sign-up refuses under-13s; selecting it would put the app under the Families policy) |
| **News app** | No |
| **Health apps** | No |
| **Financial features** | None (Comly handles no money) |
| **Government app** | No |
| **Account deletion** | URL: https://comly.app/delete-account |

---

## Before production (personal developer accounts)

If the Play developer account is a **personal** account, Google requires a
**closed test with at least 12 testers opted in for 14 consecutive days**
before production access can be requested. Start the closed test as soon as
the first Android build passes a device check. Organization accounts are exempt.
