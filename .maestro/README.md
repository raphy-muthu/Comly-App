# End-to-end tests (Maestro)

The 137 Jest tests are unit tests — they check functions in isolation and never
render a screen. These flows exist to cover what unit tests structurally
cannot: that the safety rules hold **in the running app**, not just in the
functions behind it.

The one that matters most is `04-accept-contact-unlock`. Contact details staying
hidden until a job is accepted is the core safety promise of the product. A unit
test can prove the rule; only an end-to-end test can prove the screen actually
obeys it.

## Status — read this first

**These flows have still never been executed.** Two of the three blockers are
now cleared; the third is not:

| Requirement | State |
| --- | --- |
| Java runtime | ✅ installed (`brew install openjdk`, OpenJDK 26) |
| Maestro CLI | ✅ installed and working (2.10.0) |
| Booted iOS simulator | ✅ available (iPhone 16 Pro Max, iOS 18.6) |
| **The app itself, installed on that simulator** | ❌ **cannot be built** |

The app cannot currently be built for any simulator on this machine. This is not
a flag or configuration problem — the Xcode scheme reports **zero eligible
destinations**:

```
$ xcodebuild -workspace ios/Comly.xcworkspace -scheme Comly -showdestinations
    Ineligible destinations for the "Comly" scheme:
        { platform:iOS, ..., error:iOS 26.5 is not installed. }
```

The installed Xcode offers only iOS 26.5, and that platform is not downloaded.
The one installed simulator runtime (iOS 18.6) is not accepted for this scheme.

**To unblock:** Xcode → Settings → Components → install the iOS platform /
simulator runtime. Then build and install the app in mock mode, and run the
suite.

Because these have never run, **treat the first execution as a debugging pass,
not a green check.** Selectors that look right against the source can still miss
at runtime.

## Running

```bash
./.maestro/run.sh          # whole suite
./.maestro/run.sh 03       # a single flow by number prefix
```

The script preflights Java, Maestro, a booted simulator, and the installed app,
and tells you which one is missing rather than failing obscurely.

## Mock mode is required

The flows drive seeded demo data (a customer with listings, a job with an
applicant), which only exists when `EXPO_PUBLIC_USE_MOCKS=true`.

That value is **baked into the JS bundle at build time**, so flipping `.env`
before a run does nothing to an app that is already installed. The app has to be
*built* with mocks on:

```bash
# set EXPO_PUBLIC_USE_MOCKS=true in .env first, then build, then set it back
npx expo run:ios --configuration Release --device "iPhone 16 Pro Max"
```

Always set `.env` back to `false` afterward — it is git-ignored, so nothing will
remind you.

## Selectors

Text selectors are verified against the actual source, not guessed. Two
non-obvious cases:

- **`^Log In$` is anchored on purpose.** The login screen's subtitle reads "Log
  in to pick up where you left off", which an unanchored substring match also
  hits — so a bare `"Log In"` is ambiguous between the button and that sentence.
- **Feed cards are selected by `id: job-card`, not by text.** A card's only text
  is seeded data that changes. `JobCard` carries a `testID` for exactly this
  reason; it is the only testID in the app so far.

## Coverage

| Flow | What it proves |
| --- | --- |
| `01-signup` | The age floor refuses an under-13 date at submission rather than silently accepting it |
| `02-post-job` | A posted job actually receives an AI safety classification — every downstream age gate reads that tier |
| `03-apply-eligibility` | The eligibility gate fires in the UI: either Apply is offered, or the refusal is explained |
| `04-accept-contact-unlock` | Contact details are hidden before acceptance and revealed only after — asserted on **both** sides, since checking only the "after" would pass even if contact leaked the whole time |

Not yet covered: guardian consent (the request sheet and pending/approved
states), no-show reporting, reviews, and the premium ordering rules.
