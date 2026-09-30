# Nalati load memory (NALATI-FINISH B8, E302)

**Status (2026-09-29):** cut shipped in `2d54fd57`; the iPhone re-reading is **still owed** (the USB iPhone was
`unavailable` all session). Simulator numbers below are a stand-in only (AGENTS.md E271/E272).

The 2026-09-28 iPhone 17 Pro baseline ([JSON](physical-shard-memory-baseline-2026-09-28.json), [E263](../tasks/asks/E263.md))
read **1.833 GB** during Nalati's load, over the 1.8 GB cap. That reading came from Pine Hollow, then Nalati by a
navigation in the same Safari tab, with Web Inspector attached (Memory.trackingUpdate, categories summed). At the peak,
`javascript` was 1229 MB and `page` was 497 MB. The world and Explorer settled at 0.78–0.82 GB.

## The method

- **The same metric in the iOS Simulator.** An iPhone 17 Pro simulator (iOS 26.5), Safari, paired through
  `ios_webkit_debug_proxy`, read by [`scripts/webkit-mem-reading.mjs`](../../scripts/webkit-mem-reading.mjs). It is the E263
  recorder as a script, and it takes the USB iPhone too.
- **The E263 flow in the simulator gave 1.775 GB against the phone's 1.833.** Pine Hollow's own peak was 1.169 (phone
  1.147). That is close enough to compare variants, but not to accept one.
- **Every run starts from a fresh Safari process with warm caches.** Nalati then loads KTX2, as Jake's phone does (auto: the
  set is cached).
- **Two flows:**
  - `switch`: Pine Hollow loaded, then Nalati in the same tab. `href` is what E263 did. `replace` is what the game's shard
    switch does after this change.
  - `fresh`: Nalati straight from a blank page.
- **The desktop ruler is [`scripts/load-mem-probe.mjs`](../../scripts/load-mem-probe.mjs).** It records the V8 heap,
  ArrayBuffers and native footprints per loading step, plus allocation sites. It runs Chromium or Playwright's WebKit.
- **All the runs are in [the run table](nalati-load-memory-2026-09-29.json):** every run, its variant, flow, texture mode
  and categories at the peak.

## What the peak is

1. **It is JavaScriptCore garbage, not live data.**
   - In the props step I took Web Inspector heap snapshots back to back. Each forces a full GC, and the JS category stayed
     at 0.19–0.44 GB.
   - Left alone, the same step reads 0.7–1.4 GB.
   - The live heap right after the spike is ~0.3 GB. 179 MB of that is Nalati's decoded audio: 173 AudioBuffers, the
     largest live item.
   - So the peak is where JSC decides to collect. Repeats of the same build spread by ±0.1–0.3 GB.
2. **The Inspector sum is about 2× the process's native footprint.**
   - Sampled from macOS with the Inspector attached, the WebContent physical footprint peaked at **0.91 GB** in the run the
     Inspector read as **1.71 GB**.
   - Without the Inspector, the switch flow peaked at 0.92–1.00 GB native, and a fresh Nalati at 0.76 GB.
   - Jetsam acts on the native number. E264's kill logs cite ActiveHard 2048 MB.
3. **The old shard's page stays alive.**
   - An assigned navigation (`location.href =`, the game's shard switch until now) puts the page in WebKit's
     back/forward cache: `pagehide` gives `persisted = true`, and history.back() restores it.
   - A replaced navigation does not (`persisted = false`).
   - An `unload` listener does not stop the caching.
4. **Where the garbage comes from.**
   - V8's sampled allocations over the load total ~4.3 GB.
   - The largest real (object) source was `signedTrailDistance` in the painterly terrain: ~0.55 GB of destructuring
     iterators.
   - `creatureCoats.coatAtlas` tops V8's list at ~0.9 GB, but that is V8 boxing doubles in unoptimised code.
     JavaScriptCore NaN-boxes doubles, so it is not an iPhone cost. The inlined-closure change made no difference and was
     dropped.
   - With console markers in a build, the GC bursts sit in these windows:
     - the outcrops and crags;
     - NalatiDressing's build;
     - the dressing's collider registration: 5 back-to-back full GCs while Rapier's wasm memory grows 7 → 26 MB.

## What changed (`2d54fd57`)

| change | why |
|---|---|
| `signedTrailDistance` (src/world/Terrain.ts): an indexed loop instead of `for (const [ax, az, bx, bz] of segs)` | the same result, without an iterator per segment per terrain vertex. V8's sampled churn from it: ~0.65 GB → ~0.15 GB |
| `requestShard` (src/shard/switch.ts): `location.replace` instead of `location.href =` | the old shard's page is torn down instead of kept in the back/forward cache. After several switches, WebKit could otherwise hold more than one old game page. Side effect: Safari's Back no longer returns to the previous shard |

No look, texture or resolution change. No multi-draw. The audio still decodes at the bar.

## Readings (simulator, Web Inspector sum, decimal GB)

| build | flow | runs | median | range |
|---|---|---:|---:|---|
| main before B8 | switch, href (E263) | 10 | **1.71** | 1.64 – 2.01 |
| `2d54fd57` | switch, href (E263) | 4 | **1.49** | 1.47 – 1.53 |
| `2d54fd57` | switch, replace (the game's own switch) | 4 | **1.56** | 1.47 – 1.63 |
| main before B8 | fresh | 5 | 1.22 | 1.09 – 1.48 |
| `2d54fd57` | fresh | 3 | 1.50 | 1.34 – 1.51 |

The last before/after batch interleaved the two builds: before 1.66 / 1.67 / 1.71, after 1.47–1.53. Without the Inspector
attached, replace read 0.86 GB native against href's 0.92 and 1.00 (single runs).

In the fresh flow the change is lost in the noise. Every fresh run of either build stayed under 1.6.

### Tried and not shipped

- **Nalati's phone audio decoded late**, one file at a time at the audio step:
  - fresh: 0.87–1.01, the best of any variant;
  - switch: 1.88–2.17, worse. The audio's early live growth is what triggers the full GC that frees the old page's heap.
    Deferred, that GC comes during the props burst.
- **A boot-time "GC nudge"** (a short-lived 192 MB allocation before the world build): switch 1.51–1.57, not better than
  without it.
- **Procedural creatures instead of the GLBs:** 0.94–1.56, no signal.

## Desktop, indicative (`load-mem-probe.mjs`, phone tier, cold)

| build | engine | load peak: JS heap + ArrayBuffers | load peak: renderer / WebContent native | GPU process |
|---|---|---|---|---|
| main before B8 | Chromium (V8) | 271, 267 MB | 943, 918 MB | 923, 919 MB |
| `2d54fd57` | Chromium (V8) | 268 MB | 940 MB | 932 MB |
| main before B8 | Playwright WebKit (JSC, macOS) | — | 1131, 1224 MB | 1249, 1255 MB |
| `2d54fd57` | Playwright WebKit (JSC, macOS) | — | 1213 MB | 1258 MB |

The same within noise. V8 collects its garbage promptly: its heap peak is ~0.1 GB against ~4.3 GB allocated over the load.
Desktop WebKit's native footprint is dominated by other things (textures, pages). The effect is on JavaScriptCore's GC
timing in the Inspector metric, and only the iPhone or the simulator shows it. `pnpm test:gpu-boot` passes on
`2d54fd57`: the facade stays instanced on desktop, the phone tier and the iPhone at desktop quality, and every injected
fault recovers.

## The phone reading still owed

1. Plug in the USB iPhone and unlock it. Turn on Web Inspector (Safari ▸ Settings ▸ Advanced) and open
   `https://wildshard-singleplayer.vercel.app/version.json` in one tab.
2. For the fps half, turn Low Power Mode off.
3. Run [`scripts/iphone-mem-reading.sh`](../../scripts/iphone-mem-reading.sh). It records:
   - Pine → Nalati (href, the E263 flow);
   - Pine → Nalati (replace, the game's own switch);
   - Nalati with Explorer, the world and a 150 s fps run in 10 s windows (so the iPhone's 1–2 min thermal drop shows).

Take at least three runs of each: one reading has ±0.2 GB of GC noise.
