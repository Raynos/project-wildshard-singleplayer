#!/usr/bin/env bash
# Headless native-touch E2E on iOS (docs/plans/NATIVE-APPS.md N-B): XCUITest (ios/App/AppUITests) drives the
# installed app with real taps on a task-owned simulator — boot → title → ENTER WORLD → PAUSE → Home / foreground
# stays paused → Resume. No Simulator.app window. Uses the web bundle already synced into ios/ (run
# scripts/native-ios.sh first). Outputs: .native-build/ios-ui/{result-*.xcresult,shots-*/,video-*.mp4,test-*.log}.
#   WILDSHARD_SIM=<udid>  another shut-down simulator (default: the one named wildshard-iphone, created if missing)
set -euo pipefail
cd "$(dirname "$0")/.."
out=.native-build/ios-ui
mkdir -p "$out"
out="$(cd "$out" && pwd)"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"

device="${WILDSHARD_SIM:-}"
if [[ -z "$device" ]]; then
  device="$(xcrun simctl list devices available | sed -n 's/^ *wildshard-iphone (\([0-9A-F-]*\)).*/\1/p' | head -1)"
  if [[ -z "$device" ]]; then
    runtime="$(xcrun simctl list runtimes | sed -n 's/^iOS.* - \(com.apple.CoreSimulator.SimRuntime.iOS-[0-9-]*\).*/\1/p' | tail -1)"
    device="$(xcrun simctl create wildshard-iphone "iPhone 17 Pro" "$runtime")"
  fi
fi
if ! xcrun simctl list devices | grep "$device" | grep -q "(Shutdown)"; then
  echo "simulator $device is not shut down — the runner only uses a simulator it can own" >&2; exit 1
fi

record_pid=''
cleanup() {
  if [[ -n "$record_pid" ]]; then kill -INT "$record_pid" 2>/dev/null || true; wait "$record_pid" 2>/dev/null || true; fi
  xcrun simctl shutdown "$device" 2>/dev/null || true
}
trap cleanup EXIT

echo "building the app + AppUITests for $device"
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination "id=$device" \
  -derivedDataPath "$out/DerivedData" -packageAuthorizationProvider netrc CODE_SIGNING_ALLOWED=NO \
  build-for-testing > "$out/build.log" 2>&1 || { tail -30 "$out/build.log"; exit 1; }
xctestrun="$(ls "$out"/DerivedData/Build/Products/App_*.xctestrun | head -1)"

xcrun simctl boot "$device"
xcrun simctl bootstatus "$device" -b > /dev/null
xcrun simctl io "$device" recordVideo --codec=h264 "$out/video-$stamp.mp4" > "$out/video-$stamp.log" 2>&1 &
record_pid=$!
status=0
xcodebuild -xctestrun "$xctestrun" -destination "id=$device" test-without-building \
  -resultBundlePath "$out/result-$stamp.xcresult" > "$out/test-$stamp.log" 2>&1 || status=$?
mkdir -p "$out/shots-$stamp"
xcrun xcresulttool export attachments --path "$out/result-$stamp.xcresult" --output-path "$out/shots-$stamp" > /dev/null 2>&1 || true
grep -E "Test Case .* (passed|failed)|error:|XCTAssert" "$out/test-$stamp.log" | head -20 || true
echo "result: $out/result-$stamp.xcresult · shots: $out/shots-$stamp · video: $out/video-$stamp.mp4"
exit "$status"
