---
name: ios-simulator
description: Drive the game in an iOS Simulator (Safari or the native app) without leaving a 6 GB zombie behind — lease or run it through scripts/sim-lane.sh, serve a build to it, screenshot / record / Web-Inspect it, and shut it down. Use for any iOS Simulator work: a Safari check, an app-switch recording, a WebKit memory probe, the native build. Not a substitute for the physical iPhone.
---

# iOS Simulator (E316)

A booted Simulator costs about 6 GB and 300 processes, and this Mac also runs up to ten agents plus the local-model jobs.
So Simulators go through **`scripts/sim-lane.sh`**, the same way browsers go through `scripts/browser-lane.sh`:
- **At most 1 booted machine-wide** (`SIM_LANES`), whoever booted it.
- **Idle ones are shut down.** A device with no lease and nothing driving it goes after 30 minutes, and an expired lease
  goes at once. The reaper runs from the SessionStart, Stop and SubagentStop hooks.
- **The hook blocks a raw `xcrun simctl boot` / `open -a Simulator`.**

## What it is and isn't evidence of

The Simulator runs on the Mac's memory and GPU. **It is never evidence for the iPhone caps** (1.8 GB loading /
1.0 GB Explorer) or for iPhone fps. An actual iPhone killed WebContent at multi-GB while the Simulator stayed under 1 GB
(AGENTS.md, E271 / E272). Use it for:
- layout and touch checks;
- Safari-only behaviour;
- app-switch / lifecycle recordings;
- relative WebKit memory before / after on the same build.

Take phone readings on the USB iPhone (`xcrun devicectl list devices`).

## 1. Get a device

```bash
# scripted: boot, run, shut down (SIM_UDID is set for the command; killed after --max minutes)
scripts/sim-lane.sh run --max 20 wildshard-iphone bash my-check.sh

# by hand, several commands: lease it (default 30 min), renew with the same command while you work
U=$(scripts/sim-lane.sh lease wildshard-iphone 45)
```

A name that doesn't exist yet is created as an iPhone 17 Pro on the newest installed iOS runtime.
`scripts/sim-lane.sh status` shows what is booted, its lease and what is driving it.

## 2. Give it a build

No vite dev servers (E317). Serve a build and point Safari at it:

```bash
URL=$(scripts/serve-build.sh --name sim-check --hours 2)   # http://127.0.0.1:<port>/ — the Simulator reaches the Mac's localhost
xcrun simctl openurl "$U" "${URL}?skipintro&mute=1&chunk=nalati-grasslands"
```

A cold load in the Simulator's Safari takes about 1–2 minutes. Keep `mute=1` on (the user hears agents' game audio).

## 3. Look at it

- Screenshot: `xcrun simctl io "$U" screenshot shot.png`, then save as JPEG before committing (`sips -s format jpeg …`).
- Video: `xcrun simctl io "$U" recordVideo --codec=h264 --force out.mp4 &` … `pkill -INT -f "recordVideo.*$U"`.
- App switch (a true background): `xcrun simctl launch "$U" com.apple.Preferences`, wait 3 s,
  then `xcrun simctl launch "$U" com.apple.mobilesafari`.
- Web Inspector / WebKit memory: `ios_webkit_debug_proxy -s unix:$(xcrun simctl getenv "$U" RWI_LISTEN_SOCKET) -c null:9221,:9232-9240`,
  then `curl -s http://127.0.0.1:9232/json` lists the pages and their `webSocketDebuggerUrl`. Stop the proxy when done.
- Native app: `scripts/native-ios.sh` builds and installs it. Run it inside `scripts/sim-lane.sh run …`.
- Nine Dragon memory, before / after (E264): `node scripts/nine-sim-memory.mjs --rev=HEAD --rev=<older>` serves each rev
  and runs the lane itself. For each build it measures loading, 60 s of play and 60 s of World Explorer flight on a cold
  Safari, with the kernel's WebContent footprint and Web Inspector's total. It prints the table. It compares builds; it
  does not measure the phone.

## 4. Always finish

```bash
scripts/sim-lane.sh release wildshard-iphone      # shuts it down, drops the lease; quits Simulator.app when nothing is left
scripts/serve-build.sh stop <port>
```

Before you report, `scripts/sim-lane.sh status` shows nothing of yours booted.
