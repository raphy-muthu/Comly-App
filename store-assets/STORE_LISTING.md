# Store listing copy — draft

Draft for review and editing, not final. Everything here is a factual claim
about the app, so anything you change should stay true of the shipped build —
app review reads these, and "AI reviews every job" is a claim the app has to
actually keep.

---

## App Store

### App name (30 char max)
```
Comly: Neighborhood Help
```
`Comly` alone is preferable if it's available in your territories — the
qualifier is only there for search.

### Subtitle (30 char max)
```
Local jobs, safety-checked
```

Alternates, same limit:
- `Neighbors helping neighbors` (27)
- `Safer local work for teens` (26)

### Promotional text (170 char max — editable without a new build)
```
Every job is safety-checked before a teen can see it. Post small jobs, find trusted local helpers, and keep contact private until you accept.
```

### Description (4000 char max)

```
Comly connects neighbors who need small jobs done with local helpers nearby — including teens looking for their first work.

The difference is what happens before anyone sees a job.

SAFETY CHECKED BEFORE IT'S VISIBLE
Every job posted is reviewed and sorted into a safety tier before a helper ever sees it. Yard work a 14-year-old can safely do is treated differently from work that needs to be 16+, which is treated differently again from adults-only jobs. Younger helpers simply never see work that isn't appropriate for them — it isn't hidden behind a warning, it isn't shown at all.

CONTACT STAYS PRIVATE UNTIL YOU ACCEPT
Phone numbers and exact addresses stay hidden until a customer accepts a specific helper for a specific job. No one can message a teen out of the blue, because there's no channel to do it through.

BUILT FOR PARENTS TOO
Helpers under 18 can ask a parent or guardian to approve them, by email — no extra account needed. Some jobs require that approval before a minor can accept them.

FAIR PAY, AGREED BETWEEN NEIGHBORS
Comly suggests a fair range based on the task and shows local minimum-wage guidance, then gets out of the way. Payment is arranged directly between neighbors — Comly never handles the money and takes no cut.

WHAT PEOPLE USE IT FOR
Snow shoveling · Lawn mowing · Leaf cleanup · Dog walking · Pet sitting · Tutoring · Tech help for grandparents · Moving help · Errands · Car washing · Plant watering · House sitting

SIMPLE MODE FOR SENIORS
A larger-type posting flow with preset tasks, for neighbors who want fewer steps.

REAL ACCOUNTABILITY
Verified profiles, reviews from both sides after a job is done, and a no-show system where reports are reviewed by a person before anything is held against someone.

Comly is a matchmaking app. Neighbors agree on the work and settle payment themselves.
```

### Keywords (100 char max, comma separated, no spaces)
```
neighborhood,odd jobs,teen jobs,yard work,snow,babysitting,dog walking,local help,chores,tutoring
```

### Support URL / Marketing URL
Both still needed — see the launch-readiness split. Neither exists yet.

---

## Google Play

### Short description (80 char max)
```
Small local jobs, safety-checked before any teen helper can see them.
```

### Full description (4000 char max)
Reuse the App Store description above. Play renders line breaks, so the same
section structure works without changes.

---

## Age rating — answer honestly, not optimistically

Both stores ask a questionnaire, and a wrong answer here is the kind of thing
that gets an app pulled rather than just rejected. Points that need a real
answer rather than a default:

- The app is **used by minors** and facilitates them doing paid work for adults.
- It includes **user-generated content** (job posts, messages on applications,
  reviews) and therefore needs moderation claims you can actually stand behind.
- It arranges **in-person meetings between users**, which several rating
  questionnaires ask about directly.
- It does **not** contain purchases of digital goods today, and Comly handles
  no payments at all.

Worth having the exemption question answered by a lawyer before you commit to
answers here, since some of them are effectively statements about the legal
posture of the business.

---

## Screenshots

In `store-assets/screenshots/`, captured at 1206×2622 from an iPhone 16
simulator in mock mode. Order matters — the first two are what most people
actually see in search results:

| File | Shows |
| --- | --- |
| `01-safety-tier-on-job.png` | A job with its safety tier badge — the differentiator, first |
| `02-ai-preview-safety-and-pay.png` | Pay suggestion + "Teen Safe" classification, with the human-override link |
| `03-contact-unlocked.png` | Contact revealed only after acceptance |
| `04-onboarding-safe-by-design.png` | Onboarding |
| `06-profile-trust.png` | Verification badges and reputation score |

### These are drafts, not submission assets

Three things have to be fixed before these can be uploaded:

1. **They carry the Expo dev-client overlay** — the blue gear in the top-right
   corner is the "Tools" button, not part of the app. Apple will reject
   screenshots showing development chrome.
2. **They came from a debug build.** Store screenshots should come from a
   release build, which has no dev menu at all.
3. **They are the wrong size.** These were captured at 1206×2622 (iPhone 16
   Pro, 6.3"). Apple's primary required iPhone size is **6.9" — 1320×2868**
   (iPhone 16 Pro Max). Recapture on that device, not the one used here.

All three are fixed by one recapture from a release build on a 16 Pro Max.
That cannot currently be produced on this machine, and the cause is more
specific than previously recorded: the Xcode scheme has **no eligible build
destinations at all**.

```
$ xcodebuild -workspace ios/Comly.xcworkspace -scheme Comly -showdestinations
    Ineligible destinations for the "Comly" scheme:
        { platform:iOS, ..., error:iOS 26.5 is not installed. }
```

The installed Xcode offers only iOS 26.5 and that platform is not downloaded;
the one installed simulator runtime (iOS 18.6) is not accepted for this scheme.
This is not a matter of passing the right `--device` flag — it was tried three
ways, including driving `xcodebuild` directly with an explicit simulator
destination, and all fail the same way.

**To unblock:** Xcode → Settings → Components → install the iOS platform, then:

```bash
# set EXPO_PUBLIC_USE_MOCKS=true in .env for seeded demo data, then:
npx expo run:ios --configuration Release --device "iPhone 16 Pro Max"
# ...capture, then set EXPO_PUBLIC_USE_MOCKS back to false
```

What these drafts are good for right now: reviewing composition, ordering, and
whether the listing tells the right story, and showing a partner what the
listing will look like.

### Still missing

- **`05` — the review screen.** Needs a job carried through to completion and
  mutual confirmation first.
- **iPad captures**, since `app.json` sets `supportsTablet: true`. An app that
  declares iPad support must supply iPad screenshots.
