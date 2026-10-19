# Store listing copy — draft

Draft for review and editing, not final. Everything here is a factual claim
about the app, so anything you change should stay true of the shipped build —
app review reads these, and "AI reviews every job" is a claim the app has to
actually keep.

Two claims rest on database rules, both deployed to production on 2026-10-05:

- "No one can message a teen out of the blue" — `0029` removes the open
  conversation-insert policies.
- "Work that isn't allowed on Comly is never listed" — `0032` hides Blocked
  jobs from everyone but their owner and admins.

Teens *do* see jobs they can't apply to. That's deliberate: each card says
"You can't apply" and why, and the database refuses the application. The
copy describes that honestly rather than promising those jobs are hidden.

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
Every job posted is reviewed and sorted into a safety tier before a helper ever sees it. Yard work a 14-year-old can safely do is treated differently from work that needs to be 16+, which is treated differently again from adults-only jobs. Every listing shows its tier, and a younger helper's feed marks the jobs they can't take with "You can't apply" and the reason. The app refuses those applications outright; it isn't just a warning. Work that isn't allowed on Comly at all is never listed.

CONTACT STAYS PRIVATE UNTIL YOU ACCEPT
Phone numbers and exact addresses stay hidden until a customer accepts a specific helper for a specific job. No one can message a teen out of the blue, because there's no channel to do it through.

BUILT FOR PARENTS TOO
Helpers under 18 can ask a parent or guardian to approve them, by email — no extra account needed. Some jobs require that approval before a minor can accept them.

FAIR PAY, AGREED BETWEEN NEIGHBORS
Comly suggests a fair range based on the task and shows local minimum-wage guidance, then gets out of the way. Payment is arranged directly between neighbors — Comly never handles the money and takes no cut.

WHAT PEOPLE USE IT FOR
Snow shoveling · Lawn mowing · Leaf cleanup · Dog walking · Pet sitting · Tutoring · Babysitting · Tech help for grandparents · Moving help · Errands · Car washing · Plant watering · House sitting

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
- It includes **childcare jobs** (Babysitting). Some questionnaires ask about
  unsupervised contact with minors; answer that honestly. Babysitting jobs
  require parent approval before any minor can apply, and Comly does not
  background-check helpers.

Keep the answers consistent with the Terms of Service (version 2026-10-02):
users must be 13+, a minor's parent or guardian must agree to the Terms, Comly
sells nothing today, and paid work is arranged and paid directly between
users. The casual-labor position lives in §3 and §6 of those Terms. Counsel
approved the earlier §2 clause on 2026-09-20, but the 2026-10-02 rewrite
replaced it and has **not** been re-reviewed — so treat these answers as
provisional until it has.

---

## Screenshots

In `store-assets/screenshots-69/`, captured at **1320×2868** (Apple's required
6.9" size) from a Release build in mock mode — no dev-client overlay. Order
matters — the first two are what most people actually see in search results:

| File | Shows |
| --- | --- |
| `01-safety-tier-on-job.png` | A job with its safety tier badge — the differentiator, first |
| `02-ai-preview-safety-and-pay.png` | Pay suggestion + "Teen Safe" classification, with the human-override link |
| `03-contact-unlocked.png` | Contact revealed only after acceptance |
| `04-onboarding-safe-by-design.png` | Onboarding |
| `05-leave-a-review.png` | Two-sided review after a completed job |
| `06-profile-trust.png` | Verification badges and reputation score |

These six are submission-ready for the iPhone slot.

### Still missing

- **iPad captures**, since `app.json` sets `supportsTablet: true`. An app that
  declares iPad support must supply iPad screenshots.
- **Google Play** needs its own phone screenshots (any 16:9–9:16 ratio,
  1080px+ recommended); the iPhone set can likely be reused after a size check.
