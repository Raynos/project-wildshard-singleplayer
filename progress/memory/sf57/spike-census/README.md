# SF57 spike: the template-exit WebContent transient was the soak's own GL census

Lane sf57-spike, 2026-10-09. The 83c719436 soak's cells loop 2 had a +113 MB WebContent-only transient of about 2 s,
about 5 s into `template-3-to-template-4`, with GL flat (`../public-83c719436/`). The route line is logged when a route
**starts**, so "+5 s" is the moment the player walks out of template-3's interior onto the road strip, before the
crossing commits. Earlier soaks had smaller transients of the same shape (40–60 MB) at other template exits.

## The allocation site

`src/engine/render/gpuLabels.ts`, in census mode, which is on only when the soak / parity harness installs
`window.__sc_label_gl` (`GL_INIT`). Census mode walks the whole scene on every render and every draw, and each visit
allocated new things: a label object and a path string for every node, `Object.entries` arrays for every node and
material, `{ ...label, asset }` copies for every attribute and texture role, and for every attribute array a
`memoryAttribution.observe` entry with a new `WeakRef` and closure plus a harness `sources` entry with another `WeakRef`.
Nothing was kept, so it was all garbage, and on WebKit the footprint carried it between collections.

- **Chromium, 5 s windows** (`chromium-windows.json`, `probe-chromium.mjs`, sampling heap profiler that counts collected
  objects too): with the census, **1375 MB** were allocated at the template-3 exit and 1200 MB on the open road. Without
  the census it was 276 / 195 MB. The top stacks were all in the gpuLabels walk. Chromium's heap shows no
  exit-specific transient: V8 collects it.
- **iOS Simulator Safari, one public cells circuit** (`probe-sim.mjs` with the soak's exact pins: WebKit
  `Memory.trackingUpdate` categories, `Heap.garbageCollected`, and the soak's native sampler with interval highs).

## The fix (identical labels, no fresh allocation)

Derived labels are interned per (parent label, role). Texture, draw and render-target labels are cached while their
inputs stay the same. A node's path string is built only when the node is new. `for…in` with `Object.hasOwn` replaces
`Object.entries`. A source whose label, resolved label and identity are unchanged is not observed or emitted again:
`relabelImageMemory` keeps the last-write-wins label on a shared backing store or image. `memoryAttribution.label`
returns early when the label is unchanged. Every skipped write would have rewritten the same value. The new unit test
shows a repeated walk emits nothing until a source changes, and that the new source gets the same path the first walk
would have given it (`test/engine/gpu-labels.test.ts`). The census still walks everything on every render. Players
without Developer never ran the census at all; Developer's amortized walk shares the same helpers and gets cheaper too.

## Before / after on the same base (29ab9aa5d vs df7ba9f00 = 29ab9aa5d + this fix, census pins on both)

| | before | after |
|---|---|---|
| Chromium allocation, template-3 exit, 5 s | 1375 MB | **341 MB** (no census: 276) |
| Chromium allocation, open road, 5 s | 1200 MB | **255 MB** (no census: 195) |
| Simulator eden GCs in the circuit | 1178 | **552** |
| Simulator WebKit `javascript` category max | 961 MB | **650 MB** |
| Simulator WebContent transients (interval high over the ±3 s median) | max **54.0 MB**, 9 of 20 MB or more, sum of those of 10 MB or more 296 MB | max **22.0 MB**, 3 of 20 MB or more, sum 75 MB |

The transients left (about 21 MB) sit at the crossing **commit** (`+7–8 s`, current → null), which is the regional
checkpoint: the sim snapshot is serialized to its wire string and hashed (`src/game/grid/durability.ts`). That is the
game's real save, it also runs on the phone, and it is bounded by the region's snapshot size. Chromium shows the same
burst as about 17 MB of ArrayBuffer backing store at the commit. It is not touched here.

Files: `probe-chromium.mjs`, `probe-sim.mjs` (run inside `scripts/sim-lane.sh`), `analyse-sim.cjs` / `transients.cjs`
(they read the decompressed `census-*.json` and `*-native.jsonl`), the raw `.br` archives, `sim-analysis.json`,
`sim-transients.txt`, `chromium-windows.json`.

Plan-State: unchanged
