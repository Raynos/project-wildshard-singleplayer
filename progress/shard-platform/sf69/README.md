# SF69: desktop grid frame headroom (the spawn hitch and the AO pre-pass)

Base: `bed65d4e9`. Builder: sf69 (Opus). Probe: [`probe.mjs`](probe.mjs) (the floor's desktop setup: 1440×900 @2 =
2880×1800, desktop tier, fps auto, Developer on, the grid entered by the title tap), run through `scripts/browser-lane.sh`.

## The cause: SF64's label walks, not the GPU

The spawn's doubled frame was the **main thread**, not the GPU. At HEAD the spawn frame's CPU work was 17.8–20.6 ms
(p50) against a 16.7 ms vsync, so every second or third frame missed (22–65 doubled frames in 240). The GPU timer read
13.5 ms.

A CPU profile put ≈ 40 % of the main thread in `gpuLabels.ts`. SF64 (`81888d1c4`) turned its labelling on for every
Developer session (`enabled() = isDev() || census`). Before, only the census harness had it. With it on:

- every `renderer.render` walked the **whole scene** (`tree()`), building fresh label objects, path strings and
  `Object.entries` arrays for every node, material and attribute. That ran 3 × per frame, n8ao's two pre-passes
  included. This is why "the N8AO pass" read ≈ 6–10 ms of CPU for 2 draws;
- every draw re-marked its geometry and material, Developer or not;
- every `renderer.properties.get` ran `Object.entries` + a regex over three's properties and re-tagged each GL handle.

Allocation, sampled at the spawn (CDP heap sampling, own allocation site, Developer on):

| Build | Allocated per frame | Biggest |
|---|---|---|
| HEAD `bed65d4e9` | ≈ 17.5 MB | `Object.entries` 12.7 MB, `properties.get` 0.73 MB, label walk / ledger (`observe`, `WeakRef`, `buffer`) ≈ 2 MB |
| SF69 | ≈ 2.8 MB | `Object.entries` 1.2 MB, ktx2's `properties.get` wrapper 0.2 MB, rapier 0.16 MB |

## The fix

1. **`gpuLabels.ts`: amortized outside the census harness.** The census harness keeps the full walk on every render and
   draw. Otherwise:
   - a node or drawn object is (re)labelled when it is new or its geometry / material / material version / skeleton
     changed;
   - every node is also revisited once per 240 renders, spread by id, so late-loaded images and new attributes still
     get labels;
   - a GL handle already tagged with the same label is not re-tagged;
   - the handle keys are read directly instead of `Object.entries` + a regex.

   The Developer predicate is injectable (`installGpuLabels(renderer, developer = isDev)`). The test is
   `test/engine/gpu-labels-amortized.test.ts`.
2. **`aoTransparency.ts` (new; the PH-P2 wrapper moved out of `Game.ts`): n8ao's pre-passes touch only this frame's
   visible renderables.** One walk of the visible graph gives each object the visibility n8ao would give it in each
   pass, with PH-P2's rules folded in. n8ao's four whole-scene walks with a fresh `Map`, and its every-frame
   transparency detection walk, are gone.
3. **The same module skips both pre-passes when nothing in view would draw in them.** Two 1×1 stand-ins hold exactly
   what the empty passes would hold: alpha 0, and the clear depth, which the compositer's `depth == scene depth` test
   meets only where the scene depth is the clear value. The scene's render hooks still run twice.
   - It does not fire at the grid spawn or the crossroads: the held sword's depth-writing transparent material is in
     view there.
   - It fired at the template pose (scene renders 3 → 1 per frame).
4. A third cut was measured and dropped: reusing the main pass's matrices in the pre-pass renders. It changed 372 k
   bytes at the spawn and saved no time.

## Exactness (pixel diff)

The method: hold the loop, mock `performance.now` (n8ao's noise reads it), call `composer.render(0)` and read back all
2880×1800 pixels. The reference is n8ao's own passes under the old PH-P2 wrapper, in the same page.

| Pose | ref vs ref (later) | lean pre-pass (cut 1) | + skip-empty (cut 2) | skip fired |
|---|---|---|---|---|
| Driftwood spawn (grid) | 0 / 0 bytes | **0 bytes** | **0 bytes** | no (sword in view) |
| grid-crossroads (240, 6, 240) | 0 / 0 | **0** | **0** | no |
| template-2 copy (547, 2, 530) | 0 / 0 | **0** | **0** | **yes** |

The template pose freezes the game loop on HEAD too (0 frames in 60 s after `pose()` into an unentered cell). That is
pre-existing and not from this change; the pixel diff renders through the composer directly.

## Floors and timings

Probe A/B at the spawn (same machine state, load ≈ 4.5):

| | work p50 / p95 | doubled frames / 240 | interval p95 | AO pass CPU |
|---|---|---|---|---|
| HEAD | 17.8 / 18.6 ms | 22–30 | 33.3 ms | 6.5 ms |
| SF69 | 8.2 / 9.2 ms | 0 | 16.7 ms | 0.7 ms |

At the crossroads (600 frames, SF69): work p50 5.6 ms (HEAD 15–18), interval p95 16.8 ms, 0 doubled.

`node scripts/frame-floor.mjs --shards=grid --surface=desktop --rev=<sha>`:

| Run | spawn | crossroads | deck | Receipt |
|---|---|---|---|---|
| 1 (`1d57746dc`, the fix before the dropped cut was removed) | PASS 59.88 fps, p95 16.7 (work 10.6) | PASS p95 16.8 (work 8.5) | north PASS | `progress/frame-floor/1d57746dc-75866-1791483013514.json` |
| 2 (`59180d418`, final tree) | PASS 59.88, p95 16.7 (work 7.9) | scan p95 16.7 (work 9); the floor picked the two decks as heaviest | north / east PASS | `progress/frame-floor/59180d418-81413-1791484122678.json` |
| Simulator (`59180d418`) | PASS 30.30 fps, p95 34 | PASS p95 34 (35–39 on `2ed39b862` / `49ef3b917`) | east PASS p95 34 | `progress/frame-floor/59180d418-97418-1791484395672.json` |

Standalone desktop floors on `59180d418`: Driftwood (spawn, pier, beach) and Pine Hollow (spawn, pond, cabin) all PASS at
59.88 fps, p95 16.7–16.8 ms (`progress/frame-floor/59180d418-67463-1791484861389.json`).

Full vitest (heavy lane, shared working tree): 5315 passed, 9 failed. All 9 failures come from other lanes' uncommitted
work (the drafts atlas, layer-edges, ENGINE.md's `graphAdmissionErrors`, the baked Nine Dragon map, Driftwood's
sea-lowered); none touches these files.

`scripts/test-facade-instancing.mjs` (on the candidate build): PASS desktop / phone-tier / iphone-desktop-quality, with 0
batches.

## Developer off (the public build) pays too

Allocation sampled at the standalone Driftwood spawn with Developer off. HEAD allocates ≈ 6.8 MB per frame:
`Object.entries` 4.0 MB from the per-draw marking, and `properties.get` 0.95 MB. SF69 allocates ≈ 2.0 MB:
`Object.entries` 0.54 MB, and gpuLabels' `properties.get` 0.23 MB.

These are sampled heap allocations, which overstate retained memory. Per-frame garbage under WebKit's malloc retention
is plausible, though, and it is now 3–6× smaller.

What remains at the Developer-on grid spawn (≈ 2.8 MB per frame):
- `Object.entries` 1.2 MB. Most of it is likely the draw marking of multi-material meshes, whose material alternates
  per group, so the cache misses each draw. The next cut is to key the draw cache on the object's material array.
- ktx2's own `properties.get` wrapper, 0.2 MB.
- rapier, 0.16 MB.
