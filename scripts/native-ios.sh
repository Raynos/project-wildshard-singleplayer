#!/usr/bin/env bash
# Build the iOS app (docs/plans/NATIVE-APPS.md). Default: an unsigned Debug app for the Simulator at
# .native-build/ios/Build/Products/Debug-iphonesimulator/App.app. `release` builds the Release configuration for
# the Simulator (what ships, minus signing). Device archives for TestFlight need an Apple team (N2) — not yet.
#   usage: scripts/native-ios.sh [debug|release] [--no-web]   (--no-web: reuse dist-native/ as it is)
set -euo pipefail
cd "$(dirname "$0")/.."
config=Debug
[[ "${1:-debug}" == release ]] && config=Release
if [[ " $* " != *" --no-web "* ]]; then pnpm build:native; fi
pnpm exec cap sync ios
node scripts/native-paths.mjs
# netrc: SwiftPM's default Keychain auth provider can stall headless (found by trials-gauntlet)
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration "$config" \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath .native-build/ios -packageAuthorizationProvider netrc CODE_SIGNING_ALLOWED=NO build
echo "built .native-build/ios/Build/Products/${config}-iphonesimulator/App.app"
