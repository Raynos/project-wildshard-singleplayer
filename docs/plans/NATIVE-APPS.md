# Plan: Wildshard on the App Store and Google Play

**State:** `draft` 2026-09-22 — written from the trials-gauntlet native work; waiting on the user's go and the picks under Decisions (E3). OTA over a Vercel update host is in v1 (user, 2026-09-22).

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
| Saves | PBs, ghosts, settings | `localStorage` in `Progress`, `Inventory`, `Skins`, `Settings`, `Menu`, `tier` | The OS can evict WebView localStorage under storage pressure. Port gauntlet's `src/platform/native-storage.ts` (two checksummed slots, Retry save) for Progress / Inventory / Skins. Settings and tier can stay in localStorage. |
| Load | one small scene | 142 shader programs, 30 MB cold | Bytes come off local disk, so there is no network cost. Shader compile (L1) is the whole boot. A first native launch should look like today's warm PWA launch. |
| Input | touch bike controls | touch + aim assist (`src/ui/styles/touch.css`, `AimAssist.ts`) | Check safe areas / home indicator against the HUD. Android Back = pause menu. |
| Target | 30-cap on phone | AGENTS.md: 60 FPS | The store build ships the phone tier by default. The PLAY-PERF plan is still the gate for "finished". |

## Decisions (the user)

| # | Decision | Recommendation |
|---|---|---|
| N1 | **App ID + store name** (the ID is permanent on both stores) | `com.raynos.wildshard` (or your reverse-DNS). Store name "Wildshard". Run a quick App Store / Play / USPTO name search first. It is cheap, and "shard" is a crowded word. |
| N2 | **Accounts** | The same Apple Developer (individual, $99/yr) and Play Console (personal, $25) accounts the gauntlet enrols. One account publishes many apps. `security find-identity` shows **0 signing identities** on this Mac today, so the accounts are not enrolled yet. |
| N3 | **OTA web-bundle updates in v1** | **Decided: yes** (user, 2026-09-22: "and the vercel update server stuff"). Port gauntlet's signed channel, see N-D. It has to be in the first binary, because the updater plugin is native and can only arrive through a store release. |
| N3a | **Who promotes an OTA release** | A **manual promote** (local script, or `gh workflow run ota-promote`). Not every push. A push reaches the web in about a minute, but an OTA promote reaches every installed phone, so it is your click. The private signing key lives in `~/.config/wildshard/`. If you want CI to promote, it goes in an Actions secret instead. |
| N4 | **Devices** | iPhone only (iPad runs it in compatibility mode), landscape. Minimum **iOS 17** and **Android 10 (API 29) + WebView ≥ 120**, both WebGL2. Gauntlet found API 24's stock WebView cannot run modern JS/WebGL2. |
| N5 | **When to start the Play closed test** | **As soon as the first shell exists** (see below). |

**The long pole is Google's closed test, per app.** New personal Play accounts must run a closed test with
**≥ 12 testers opted in for 14 continuous days** before they can apply for production. As far as I can tell,
production access is granted per app, so Wildshard runs its own 14 days even if the gauntlet has done its own.
Re-check this when the account exists. The same 12 people can test both games in parallel. Until then, your
Android phone gets builds through **internal testing** the same day (no review, no minimum), and your iPhone
through **TestFlight internal** (no review).

## Phases

### N-A Port the shells (1–2 days, autonomous)

- [ ] `capacitor.config.ts` (appId N1, `webDir: 'dist-native'`, `server.errorPath` → bundled no-JS
      `native-unavailable.html`). Commit `ios/` and `android/` and the pinned `@capacitor/{core,cli,ios,android,app,filesystem}` 8.5.2.
- [ ] `vite build --mode native` (`pnpm build:native`): no SW (`src/boot/sw.ts`), no update pill
      (`src/ui/Update.ts`), no DBG pill / dev modes (`src/dev/*`, `?`-params), no trailers, no sourcemaps.
      `window.__*` automation hooks go in debug builds only.
- [ ] Port gauntlet's `src/platform/{target,lifecycle,storage,native-storage}.ts` (`updates.ts` in N-D), adapted to
      Wildshard's game loop: background → pause sim + audio + clear held touches; Android Back → pause / close
      overlay / exit confirm; keep the screen awake while playing.
- [ ] iOS: landscape, `TARGETED_DEVICE_FAMILY = 1`, status bar hidden, home-indicator auto-hide,
      `PrivacyInfo.xcprivacy`, `ITSAppUsesNonExemptEncryption = NO`, **ambient** audio session (the silent switch mutes).
      Android: landscape, immersive, target SDK = Play's current (36), AAB.
- [ ] Icons / launch art from `public/icon-512.png` / the key art (1024² opaque for iOS; adaptive icon for Android).
- [ ] CI: add `build:native` to `deploy.yml` so a push that breaks the native target is red. It does not ship anywhere.

**Done when:** a Debug `.app` boots on the iOS 26.5 Simulator and an APK boots on the existing `trials_gauntlet_api36`
AVD, **with networking off**, to the menu. Both reach Pine Hollow and Driftwood Isle, and the byte counter never
touches the network.

### N-B Qualify (2–4 days; simulator autonomous, phones are yours)

- [ ] Port gauntlet's `scripts/native-{ios,android}-*.mjs` runners (simctl / headless emulator + adb). Cover cold
      boot offline, both shards, touch navigation, background/foreground, force-kill → progress/inventory/skins
      survive, binary upgrade 1.0.0 → 1.0.1 keeps saves, and WebGL context-loss recovery.
- [ ] Install size (IPA / AAB download size) is recorded. Headroom under Play's 200 MB is confirmed (see bundle size).
- [ ] **Your two phones (human reading):** TestFlight + Play internal build. Cold launch time vs the PWA,
      shader-step time (L1), a 15-min session for thermals, the phone-tier fps. The simulator never counts as a phone reading.

### N-C Stores (your clicks; I prep everything else)

- [ ] **You:** enrol both accounts (N2). Create an App Store Connect API key (.p8) and a Play service-account JSON,
      stored outside the repo (`~/.config/wildshard/`). Keep the Android upload keystore there too. It is never committed.
- [ ] **Me:** `store/` listing kit: subtitle, description, keywords, Play short/full text, category Games ›
      Adventure, **screenshots from played runs** (iPhone 6.9" landscape, Play phone), Play feature graphic 1024×500,
      optional 15–30 s preview cut from `public/trailer-30.mp4`.
- [ ] **Me:** privacy policy + support page on `wildshard-singleplayer.vercel.app/privacy` / `/support` (both stores
      require URLs). Labels: "Data not collected" (iOS) / no data collected or shared (Play). Age ratings (Apple
      questionnaire, IARC; the game has combat → likely 9+/12+). Content rights. Export compliance none. EU DSA non-trader.
- [ ] **Me:** fastlane lanes `ios beta` (archive → TestFlight) and `android internal` (AAB → internal track). They run
      locally on this Mac.
- [ ] **You:** 12 closed testers for Play (the 14-day clock starts on the first build, N5). After 14 days, apply for
      production. **Submit for review / Release is always your click** (outward-facing).

### N-D OTA over a Vercel update host (ported, in the first binary; N3)

How it works (gauntlet `docs/native/README.md` §"Signed updates hosted on Vercel", evidence `docs/evidence/native-mobile/updater.md`):
the app always boots its **installed** bundle, with no network on the critical path. After a healthy boot it fetches a
**signed manifest** from its platform channel. The manifest is RSA-PSS signed and checked against the public key
pinned in the binary. It is bound to platform, native version range, runtime + save schema, a monotonic sequence and
an expiry. The app then downloads the `<sha256>.zip`, verifies it, stages it, and **activates it on the next cold
launch**, never mid-ride. If the new bundle does not call `notifyReady()` within 120 s, the plugin's watchdog rolls
back to the last good bundle. Failed bundles are blocked in an activation ledger.

- [ ] `@capgo/capacitor-updater` 8.51.x in **manual, self-hosted mode**: `autoUpdate: 'off'`, and Capgo's cloud
      update/stats/channel URLs empty. No Capgo account or subscription. MPL-2.0, so its notice ships in the credits.
- [ ] Port `src/platform/updates.ts` (+ its tests), `scripts/mobile-release.mjs` (package + sign; never uploads),
      `scripts/mobile-config.mjs`, and the build-time check that `VITE_MOBILE_MANIFEST_{IOS,ANDROID}` +
      `VITE_MOBILE_PUBLIC_KEY` are present and valid for a release build.
- [ ] **A second Vercel project, `wildshard-updates`, named before its first deploy** (global CLAUDE.md, the
      `dist.vercel.app` lesson). It is static: `deploy/mobile-updates/vercel.json` gives
      `manifest.json` `no-store`, `*.zip` `immutable`, and CORS `*` (GET only). Channels:
      `https://wildshard-updates.vercel.app/{ios,android}/native-v1/manifest.json`. It is separate from the game site on
      purpose: a web deploy **never** advances the phones, and a promote never touches the web. Every deploy keeps all
      old ZIPs (an app mid-download must still find its ZIP).
- [ ] Key: generate an RSA-3072 keypair once. The public key JWK goes into the binary. The private key is kept outside
      the repo **and backed up**. If it is lost, every installed app needs a store update to trust a new key.
- [ ] **Wildshard-specific: the ZIP size.** Gauntlet's ZIP is the whole `dist-native/`. Ours would be ~140 MB per
      update, and most of that is textures/HDRIs that did not change. Before N-D ships, check whether Capgo's
      per-file **manifest (delta) download** works in manual mode, so only changed files download. If it does not,
      split the ZIP: code + shaders + baked data in the OTA bundle (a few MB), and the big immutable assets from the
      built-in bundle. That needs asset URLs that resolve to the built-in copy. Worst case, a full ZIP on Wi-Fi only.
- [ ] Qualify with gauntlet's installed-app suites (`scripts/native-{ios,android}-ota-suite.mjs`): A → B, no activation
      mid-ride, B → A rollback at a higher sequence, watchdog rollback, wrong signature / hash, incompatible native
      version, expired manifest, interrupted download, offline launch. Saves survive all of them.
- [ ] **Store policy:** Play allows JS/WebView updates as long as the content stays within policy. Apple §2.5.2 does
      not allow downloaded code that adds or changes features. So on iOS, OTA carries **fixes, tuning, art and
      content**. A new shard, weapon or mode goes through review. The review notes say the mechanism exists.

| Change | Delivery |
|---|---|
| Web deploy (every push) | website only; the phones do not move |
| Bug fix, balance, art, text | OTA promote (both platforms) |
| New shard / mode / major mechanic | store release on iOS (OTA OK on Android) |
| Capacitor / plugin / icon / permission / SDK bump | store release, both |

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
