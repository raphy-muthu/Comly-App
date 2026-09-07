#!/usr/bin/env bash
# Run the Maestro end-to-end suite against a booted iOS simulator.
#
#   ./.maestro/run.sh              # whole suite
#   ./.maestro/run.sh 03           # just the flow whose name starts with 03
#
# Why this script exists rather than a bare `maestro test`:
#
#   1. Homebrew's openjdk is keg-only, so it is NOT on PATH by default and
#      `maestro` fails with "Unable to locate a Java Runtime" until you export
#      it. That is a confusing failure to hit repeatedly.
#   2. The flows drive seeded demo data, which only exists in mock mode. The
#      app has to have been BUILT with EXPO_PUBLIC_USE_MOCKS=true — flipping
#      .env now does nothing to an already-installed binary.
set -euo pipefail

export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
MAESTRO="${HOME}/.maestro/bin/maestro"
APP_ID="com.comly.app"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v java >/dev/null 2>&1; then
  echo "error: no Java runtime. Install one with: brew install openjdk" >&2
  exit 1
fi

if [ ! -x "$MAESTRO" ]; then
  echo "error: maestro not found at $MAESTRO" >&2
  echo "install with: curl -Ls https://get.maestro.mobile.dev | bash" >&2
  exit 1
fi

booted="$(xcrun simctl list devices booted | grep -c "Booted" || true)"
if [ "$booted" -eq 0 ]; then
  echo "error: no booted simulator. Boot one first, e.g.:" >&2
  echo "  xcrun simctl boot 'iPhone 16 Pro Max'" >&2
  exit 1
fi

if ! xcrun simctl get_app_container booted "$APP_ID" >/dev/null 2>&1; then
  echo "error: $APP_ID is not installed on the booted simulator." >&2
  echo "Build and install it first (see .maestro/README.md)." >&2
  exit 1
fi

if [ $# -gt 0 ]; then
  target="$(ls "$HERE"/"$1"*.yaml | head -1)"
  echo "running $target"
  exec "$MAESTRO" test "$target"
fi

exec "$MAESTRO" test "$HERE"
