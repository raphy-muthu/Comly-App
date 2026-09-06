# End-to-end flows (Maestro)

Covers the safety-critical spine of the app: signing up with a real age check,
posting a job, applying to it as a helper, and accepting an applicant so
contact unlocks.

## Status

**These flows have not been executed yet.** Maestro's CLI needs a Java runtime,
which wasn't installed when they were written. They are authored against the
screens as they actually exist (verified by hand in the simulator), but treat
the first run as a debugging pass rather than a green check — selectors are the
most likely thing to need adjusting.

## Prerequisites

```bash
# Maestro CLI (needs a Java runtime — install a JDK first, e.g. brew install openjdk)
curl -Ls "https://get.maestro.mobile.dev" | bash
export PATH="$PATH:$HOME/.maestro/bin"

# A running app on a booted simulator
npx expo run:ios
```

## Mock mode

These flows assume `EXPO_PUBLIC_USE_MOCKS=true`. Mock mode's sign-in accepts
any credentials and the data is seeded, which is what makes the flows
deterministic and free of cleanup. The tradeoff is real: they exercise the UI
and the client-side gates, **not** Postgres RLS. The bugs this project has
actually hit — an RLS policy that looked enforced but wasn't, a migration
trigger collision — live below the layer these flows can see. Real-backend E2E
is a separate, harder job (test account creation and teardown at test speed)
and is deliberately not attempted here.

## Running

```bash
export PATH="$PATH:$HOME/.maestro/bin"
maestro test .maestro/                 # everything
maestro test .maestro/01-signup.yaml   # one flow
```

`appId` is `com.comly.app`, matching `app.json`.
