# Plan: Wildshard on the App Store and Google Play

**State:** `blocked` 2026-09-22 — shells, native saves/lifecycle and the signed OTA channel are built (E23); simulator + emulator E2E pass. Waits on the user for the stores (E24: Apple + Play accounts, `VERCEL_UPDATES_TOKEN`); open for an agent meanwhile (E29): store listing kit, privacy / support pages, upgrade + OTA + context-loss drills.

## Where this comes from

`~/projects/game-demos/trials-gauntlet-demo` got to both stores' doorstep first. There are two parts to its work, and
only one of them applies here:

- **Its store plan** (`docs/plans/STORE_RELEASE.md` on `main`) is mostly an **IP scrub**: rename away from "Trials",
  reskin the Trials-coded look, redesign all 12 levels, replace the music, delete Ubisoft reference footage.
  **None of that applies.** Wildshard is original IP: our own name, world, creatures, music (`scripts/music/`) and
  CC0 Poly Haven assets. What we borrow from that plan: the store mechanics (accounts, the closed-test clock,
  listings, compliance) and the store-build flag that strips dev UI.
- **Its native shells** (branch `docs/native-mobile-publishing`, `ea4ad76c`…`2829cd2a`, 121 files) already
  **build installable binaries**. They use Capacitor 8.5.2, commit `ios/` and `android/`, and add a native web
  target (`vite build --mode native` → `dist-native/`), `src/platform/` (lifecycle, Back, transactional native
  saves, update selection), and headless iOS Simulator / Android emulator runners. **This is what we port.**
  Doc: `git show 2829cd2a:docs/native/README.md` in that repo.

The approach is the same: **Capacitor wraps the existing Vite build in a WKWebView (iOS) or Android WebView.**
The game, three.js, the shaders and the UI stay as they are. Wrapping it does not make WebGL faster. The iPhone
app runs the same WebKit as Safari, so L1 (shader load) and the phone tier carry over unchanged. Neither gets
better or worse.

## What is different about Wildshard (the port is not a copy)

| Topic | Gauntlet | Wildshard | Consequence |
|---|---|---|---|
| Bundle size | small | `dist/` **152 MB** (142 MB assets: tex 62, hdri 36, models 28; trailers 10) | Play's base-module download cap is **200 MB compressed**. We fit today, and JPEG/KTX2 do not compress further. P5 (30 → ~10 MB cold bytes) and dropping the trailers from the native build give headroom. If we pass 200 MB, the tex/hdri go into a Play **install-time asset pack**. iOS has no problem at this size. |
| Service worker | `src/boot/sw.ts` pattern (ported *from* gauntlet) | same, plus `src/ui/Update.ts` polls `/version.json` | The native target compiles out SW registration and the update pill. WKWebView does not run service workers on `capacitor://`, and the pill would poll the bundled file. `__ws_sw.ready` already resolves at once with no SW. |
| Asset paths | relative | absolute `/assets/...` (`src/core/assets.ts:49`, `bakedTextures.ts:29`) | Fine: Capacitor serves `webDir` at the origin root (`capacitor://localhost/`, `https://localhost/`). |
| Saves | PBs, ghosts, settings | `localStorage` in `Progress`, `Inventory`, `Skins`, `Settings`, `Menu`, `tier` | The OS can evict WebView localStorage under storage pressure. Built simpler than gauntlet's checksummed slots: `src/native/saves.ts` mirrors every `ws.*` key into `@capacitor/preferences` and restores it at boot (the Android E2E deletes the WebView's storage and gets the save back). |
| Load | one small scene | 142 shader programs, 30 MB cold | Bytes come off local disk, so there is no network cost. Shader compile (L1) is the whole boot. A first native launch should look like today's warm PWA launch. |
| Input | touch bike controls | touch + aim assist (`src/ui/styles/touch.css`, `AimAssist.ts`) | Check safe areas / home indicator against the HUD. Android Back = pause menu. |
| Target | 30-cap on phone | AGENTS.md: 60 FPS | The store build ships the phone tier by default. The PLAY-PERF plan is still the gate for "finished". |

## Decisions (the user)

| # | Decision | Taken (the user, 2026-09-22) |
|---|---|---|
| N1 | **App IDs** (permanent on both stores) | iOS `com.jakeverbaten.wildshard-singleplayer`; Android `com.jakeverbaten.wildshard_singleplayer` (Android ids can't hold `-`). Display name "Wildshard". |
| N2 | **Accounts** | **Neither yet.** Everything is built up to signing: Simulator apps, a debug APK, an unsigned release AAB. Enrol Apple Developer (individual, $99/yr) + Play Console (personal, $25) when ready; this Mac has 0 signing identities today. |
| N3 | **OTA web-bundle updates in v1** | **Yes** ("and the vercel update server stuff"): the signed channel on the `wildshard-updates` Vercel project, in the first binary (the updater plugin is native), see N-D. |
| N3a | **Who promotes an OTA release** | **CI on manual trigger**: `gh workflow run ota-promote`. The signing key is the Actions secret `OTA_SIGNING_KEY` (a copy in `~/.config/wildshard/`). |
| N4 | **Devices** | iPhone only (`TARGETED_DEVICE_FAMILY = 1`; iPad runs it in compatibility mode), landscape. Minimum **iOS 17** and **Android 10 (API 29)**, OpenGL ES 3 required (WebGL2). |
| N5 | **When to start the Play closed test** | As soon as the Play account exists: the first AAB is ready. |

**The long pole is Google's closed test, per app.** New personal Play accounts must run a closed test with
**≥ 12 testers opted in for 14 continuous days** before they can apply for production. As far as I can tell,
production access is granted per app, so Wildshard runs its own 14 days even if the gauntlet has done its own.
Re-check this when the account exists. The same 12 people can test both games in parallel. Until then, your
Android phone gets builds through **internal testing** the same day (no review, no minimum), and your iPhone
through **TestFlight internal** (no review).

## Phases

### N-A Shells — **built** (2026-09-22, E7)

- [x] `capacitor.config.ts`: Capacitor 8.5.2 (`@capacitor/{core,cli,ios,android,app,preferences}`),
      `webDir: 'dist-native'`, stable local origins (`capacitor://localhost`, `https://localhost`),
      `server.errorPath` → `native-unavailable.html` (no script, no fonts, no network: "update your WebView").
      `ios/` and `android/` are committed (build outputs, synced web copies and signing material are gitignored).
- [x] `pnpm build:native` = `vite build --mode native` → `dist-native/` (vite.config.ts `nativePlugin`): the page's
      service-worker / update-pill / Google-Fonts tags are dropped and `main.ts` is swapped for `src/native/boot.ts`;
      no source maps, no trailers. Fonts (Rajdhani, JetBrains Mono) are bundled from `@fontsource`. CI builds it on
      every push (`deploy.yml` "Native web build"): a push that breaks the native target is red; it ships nowhere.
- [x] `src/native/boot.ts`: saves → OTA → lifecycle → the unchanged game. `src/native/saves.ts` mirrors every
      `ws.*` localStorage key into `@capacitor/preferences` (UserDefaults / SharedPreferences) and restores it at boot;
      `src/native/lifecycle.ts` turns app backgrounding into `ws:background` (HUD pauses, saves flush) and Android
      Back into a cancelable `ws:back` (HUD closes the menu / pauses; unused Back minimizes). `main.ts` fires
      `ws:ready` at the title (the OTA watchdog's healthy-boot signal).
- [x] iOS: bundle id `com.jakeverbaten.wildshard-singleplayer`, 1.0.0 (1), iOS 17+, iPhone only, landscape only,
      full screen, status bar + home indicator hidden (`SystemBars.hidden`), edge gestures deferred to the game
      (`GameViewController` in AppDelegate.swift), ambient audio (the silent switch mutes), screen never sleeps,
      `PrivacyInfo.xcprivacy` (UserDefaults CA92.1, file timestamps C617.1, no tracking), `ITSAppUsesNonExemptEncryption = NO`.
- [x] Android: `com.jakeverbaten.wildshard_singleplayer`, 1.0.0 (1), minSdk 29, target 36, `sensorLandscape`,
      immersive, keep-screen-on, draws under the cutout, OpenGL ES 3 required (Play hides it from phones without WebGL2).
- [x] Icons + launch art from the Pine Hollow hero painting (`scripts/native-icons.py`; Play icon in
      `art/native-app/round-1-icons/`).
- [x] Found and fixed on the way (the web build had them too): on a landscape phone (~360–411 CSS px tall) the title's
      ENTER WORLD button was below the screen (menu.css short-landscape rule); the Android WebView rejects pointer lock
      and the unhandled rejection raised the error modal on ENTER WORLD (`Player.lock` catches it); the closed pause
      menu stayed in the accessibility tree (now `inert` while closed).

Sizes: Android debug APK 141 MB, release AAB 132 MB (Play's base cap is 200 MB); iOS Simulator app 160 MB.

### N-B Qualify — simulator/emulator **passing**; phones are yours

- [x] `scripts/native-android-e2e.mjs` (headless emulator `wildshard_api36`, adb input + CDP observation), 7/7:
      airplane-mode cold boot to the title (WebGL2, zero requests but the post-boot OTA check), ENTER WORLD by a native
      tap with no error modal, Back opens / closes the pause menu, Home → relaunch lands paused, and **a save survives
      the WebView's localStorage being deleted on disk** (the Preferences mirror restores it).
- [x] `scripts/native-ios-ui.sh` (XCUITest `ios/App/AppUITests`, headless task simulator `wildshard-iphone`): title →
      ENTER WORLD → PAUSE → Resume → Home / foreground lands paused → Resume, by native taps; screenshots + a screen
      recording land in `.native-build/ios-ui/`.
- [ ] Binary upgrade 1.0.0 → 1.0.1 keeps saves; WebGL context-loss recovery (gauntlet has runners for both).
- [ ] **Your two phones (human reading):** TestFlight + Play internal build once the accounts exist. Cold launch time
      vs the PWA, shader-step time (L1), a 15-min session for thermals, the phone-tier fps. The simulator never
      counts as a phone reading.

### N-C Stores (your clicks; I prep everything else)

- [ ] **You:** enrol both accounts (N2). Then: an App Store Connect API key (.p8) and a Play service-account JSON in
      `~/.config/wildshard/`, and the Android upload keystore there too (never committed).
- [ ] **Me, after enrolment:** signing (Apple team id in the Xcode project, Play App Signing + upload key in
      `android/app/build.gradle` from `~/.config/wildshard/`), fastlane lanes `ios beta` (archive → TestFlight) and
      `android internal` (AAB → internal track), run on this Mac.
- [ ] **Me:** `store/` listing kit (subtitle, description, keywords, Play short/full text, Games › Adventure,
      screenshots from played runs, Play feature graphic 1024×500, optional preview from `public/trailer-30.mp4`);
      privacy policy + support pages on the web build (both stores require URLs). Labels: "Data not collected" /
      no data collected or shared; age ratings (combat → likely 9+/12+); export compliance none; EU DSA non-trader.
- [ ] **You:** 12 closed testers for Play (the 14-day clock starts on the first closed-track build, N5), then apply for
      production. **Submit for review / Release is always your click.**

### N-D OTA over a Vercel update host — **built; promotion waits on one token**

The app always boots its **installed** bundle; nothing on the critical path touches the network. After `ws:ready` it
fetches a **signed manifest** from its platform channel
(`https://wildshard-updates.vercel.app/{ios,android}/v1/manifest.json`): RSA-PSS/SHA-256 over the payload, checked
against the public key pinned in `src/native/ota-config.ts`, bound to platform, native version range, runtime
`native-v1`, save schema 1, a monotonic sequence and an expiry. The manifest lists **every file** of the bundle by
SHA-256 (`/f/<sha256>` on the host); `@capgo/capacitor-updater` (8.51.21, manual self-hosted mode, Capgo's cloud off,
MPL-2.0) copies each file whose hash matches the installed bundle or its delta cache and downloads only the rest —
a code-only update is a few MB, not 140. The staged bundle **activates on the next cold launch**, never mid-session;
a bundle that doesn't reach `ws:ready` within 120 s is rolled back by the plugin's watchdog and blocked in an
activation ledger (`src/native/updates.ts`, 52 unit tests in `test/native-updates.test.ts`).

- [x] Vercel project **`wildshard-updates`** (`prj_ovNwXLanIg9I1hfcGaRiERffDTkD`), created by name before its first
      deploy; a signed sequence-0 placeholder is live (manifests `no-store`, `/f/*` immutable, CORS `*`). A 152 MB /
      169-file test upload hit no Vercel limit (one transient CLI "fetch failed", hence retries in the workflow).
- [x] `scripts/ota-release.mjs` (hash + lay out + sign; never uploads), `deploy/ota/vercel.json`,
      `.github/workflows/ota-promote.yml`: `gh workflow run ota-promote` → native build → sign (sequence = run number)
      → deploy with retries → verify the live manifest → summary. It keeps the previous release's files so a phone
      mid-download can finish; promoting one platform leaves the other's manifest byte-identical.
- [x] Secrets: `OTA_SIGNING_KEY` (RSA-3072; the only other copy is `~/.config/wildshard/ota-signing.pem` — **back it up
      offline**: losing it means a store update to trust a new key) and `VERCEL_UPDATES_PROJECT_ID`.
- [ ] **You: `VERCEL_UPDATES_TOKEN`.** A Vercel token can only be made in the dashboard (the CLI's token cannot mint
      one): log in with Google (raynos2@gmail.com — not "Continue with GitHub", that is a different account), create a
      token scoped to `wildshard-updates` (or raynos-projects), then `gh secret set VERCEL_UPDATES_TOKEN -R
      Raynos/project-wildshard-singleplayer`. Until then the workflow's first step fails and says so.
- [ ] Installed-app OTA drills (A → B, rollback, bad signature, offline) on both simulators once a real promote exists.
- **Store policy:** Play allows JS/WebView updates within policy. Apple §2.5.2 does not allow downloaded code that adds
  or changes features: on iOS, OTA carries **fixes, tuning, art and content**; a new shard, weapon or mode goes
  through review, and the review notes say the mechanism exists.
- Disk: the plugin copies (does not link) unchanged files into each staged bundle — a staged update can cost ~140 MB
  of storage beyond the app. Manifests expire after 30 days; a promote refreshes them.

| Change | Delivery |
|---|---|
| Web deploy (every push) | website only; the phones do not move |
| Bug fix, balance, art, text | `gh workflow run ota-promote` (both platforms) |
| New shard / mode / major mechanic | store release on iOS (OTA OK on Android) |
| Capacitor / plugin / icon / permission / SDK bump | store release, both |

### Runbook

```
pnpm build:native                     # dist-native/ (the web bundle the apps embed)
bash scripts/native-ios.sh            # → .native-build/ios/Build/Products/Debug-iphonesimulator/App.app  (release: … release)
bash scripts/native-android.sh all    # → android/app/build/outputs/apk/debug/app-debug.apk + bundle/release/app-release.aab (unsigned)
bash scripts/native-ios-ui.sh         # XCUITest on the shut-down `wildshard-iphone` simulator, headless
node scripts/native-android-e2e.mjs   # headless emulator `wildshard_api36` (create: avdmanager create avd -n wildshard_api36 -k "system-images;android-36;google_apis;arm64-v8a" -d pixel_7)
python3 scripts/native-icons.py       # re-cut icons + splash from the hero painting
gh workflow run ota-promote           # ship the current main to installed phones (needs VERCEL_UPDATES_TOKEN)
```
Toolchain on this Mac: Xcode 26.6 (iOS 26.5 simulator), Android SDK 36 + JDK 21 (the scripts pick it).

## Sequencing

```
N-A shells ──► internal track + TestFlight (your phones) ──► Play CLOSED TEST day 0 ── 14 days ──► apply prod ──► review
      │                                                          ▲ updated builds keep landing
      └──► N-B qualify ──► N-C listing kit ──► App Store review (can go any time after TestFlight is good) ──┘
```

## Costs

Apple $99/yr · Google $25 once (both shared with the gauntlet if the same accounts) · the update host is Vercel Hobby. Each OTA download is ZIP-sized bandwidth per phone, which is why the delta item matters.

## Out of scope for v1

Game Center / Play Games · cloud save / web-progress import · iPad-native layout · gamepads ·
localisation · monetisation.
