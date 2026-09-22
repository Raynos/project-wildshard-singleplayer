#!/usr/bin/env bash
# Build the Android app (docs/plans/NATIVE-APPS.md). debug → an installable debug APK; bundle → the release AAB
# (unsigned until the upload keystore exists, N2 — it lives outside the repo, never committed); all → both.
#   usage: scripts/native-android.sh [debug|bundle|all] [--no-web]   (--no-web: reuse dist-native/ as it is)
set -euo pipefail
case "${1:-debug}" in
  debug) tasks=(assembleDebug) ;;
  bundle) tasks=(bundleRelease) ;;
  all) tasks=(assembleDebug bundleRelease) ;;
  *) echo "usage: $0 [debug|bundle|all] [--no-web]" >&2; exit 2 ;;
esac
cd "$(dirname "$0")/.."
# Capacitor 8's Gradle toolchain wants Java 21
if [[ -x /usr/libexec/java_home ]]; then
  j21="$(/usr/libexec/java_home -v 21 2>/dev/null || true)"
  if [[ -n "$j21" ]]; then export JAVA_HOME="$j21"; fi
fi
if [[ -z "${ANDROID_HOME:-}" ]]; then
  if [[ -n "${ANDROID_SDK_ROOT:-}" ]]; then export ANDROID_HOME="$ANDROID_SDK_ROOT"
  elif [[ -d "$HOME/Library/Android/sdk" ]]; then export ANDROID_HOME="$HOME/Library/Android/sdk"
  elif [[ -d "$HOME/Android/Sdk" ]]; then export ANDROID_HOME="$HOME/Android/Sdk"
  else echo 'Install the Android SDK and set ANDROID_HOME' >&2; exit 1; fi
fi
if [[ " $* " != *" --no-web "* ]]; then pnpm build:native; fi
pnpm exec cap sync android
node scripts/native-paths.mjs
cd android
./gradlew --no-daemon "${tasks[@]}"
ls -la app/build/outputs/apk/debug/*.apk app/build/outputs/bundle/release/*.aab 2>/dev/null || true
