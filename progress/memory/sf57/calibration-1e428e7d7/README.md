# SF57 calibration: why the allocator over-states the public home (E435, sf57-qualify2, 2026-10-08)

The public soak `public-c47de2d8c` failed (c) only: (M − E) / A = 0.867–0.893 against [1.01, 1.21]. This folder
attributes the gap. **No model or window change landed**; the numbers below say what to change, and the open question is
which claims to re-measure (see "What to fix").

Builds: candidate `781e0bec3` (tree of `1e428e7d7`'s change on `e4616421b`) served by `scripts/serve-build.sh`; Chromium
"iPhone 16 Pro", muted, Metal ANGLE. Decimal MB.

## The settled home stop, claim by claim (soak c1, Simulator, texture mode `img`)

M = WebContent 517.5 + GL 247.2 = **764.7**; E = 300; A = **536.2**. For (M − E) / A = 1.11 the allocator would need
A ≈ 418.6, so it charges **≈ 118 MB too much**.

| Claim (accounted MB) | A | What the measurement says |
|---|---:|---|
| `sim:driftwood-isle` (the borrowed home, `DRIFTWOOD_RUNTIME_COST`, fe508c172) | 341.8 | (473.9 WC + 204.5 GL − 299) / 1.11: the **whole standalone page**, composer and engine included |
| `page:composer` | 42.8 | already inside the home's standalone measurement (the standalone page draws through the same composer): **double count** on a measured-runtime home page |
| `sim:template-1/3/4` + `sim-basis:*` (far-proxy neighbours) | 3 × 18.2 = 54.7 | the template's **declared** sim ceiling (`budgets.sim.resident` 16 MB), not a measurement |
| l0 (open plots 33.8, road deck 17.7, junctions 5.6, signs 3.2, asphalt 2.9, cell screens 6.1…) | 71.0 | platform render products |
| product 7.4 · far 8.0 · l1 3.8 · highway sim 5.4 | 24.6 | |
| **Non-home total** | **194.4** (× 1.11 = 215.8 raw) | measured: public home − standalone Driftwood = **+81 to +110 MB** raw (below) |

Standalone Driftwood = 678.4 (the cost row's own reading). Public home = 764.7 (soak c1) or 788.7 (G257's fixed ruler,
`progress/memory/ruler/`). So the grid adds 86–110 MB on the Simulator, while the model charges 216 MB raw for it.

## GL in both texture modes (this folder: `calib.mjs` → `calib.json`, Chromium labelled GL census)

| Page | `img` | `ktx2` | Δ |
|---|---:|---:|---:|
| Driftwood standalone | 196.3 | 175.2 | 21.1 |
| Public grid home | 241.6 | 220.5 | 21.1 |
| Public − standalone | **45.3** | **45.3** | |

- The home claim's GL (204.5, fe508c172) is ≈ today's `img` reading (196.3), so in `img` mode the texture mode explains
  **≈ 8 MB**, not the gap; in `ktx2` mode the home claim over-states its GL by ≈ 29 MB more. The model should carry both
  readings (`RuntimeCost.imagesFirst` exists for this, unset for Driftwood) and charge the one the page resolved.
- The grid adds the same 45 MB of GL in both modes; renderbuffers are 9.1 MB in both pages. The other ≈ 40–65 MB of the
  measured grid delta is WebContent.
- **Why the soak loads images on the Simulator:** `texModeWhy()` vetoes a KTX2 pick when `ktx2Probe()` finds the GPU
  samples the transcoder's compressed mips wrong (`src/engine/render/ktx2Probe.ts`, the Simulator's zeroed sRGB ASTC /
  ETC2 mips). The soak's receipt shows `probe: null` only because Auto stopped earlier at "KTX2 set not cached"; a warm
  cache would reach the probe, which vetoes on the Simulator, so **a Simulator soak is an `img` soak**. A KTX2 reading
  needs the physical phone.

## What to fix (in order of size)

1. **Neighbour sims at their declared 16 MB ceiling** (≈ 55 MB): measure a template sim's resident cost (WASM + JS of one
   far-proxy template with its basis) and charge that, or keep the ceiling for admission and grade (c) on a measured row.
2. **The composer on a measured-runtime home** (≈ 30–43 MB): the home's whole-runtime claim already contains the page's
   composer (less the 13.1 MB `PHONE_COMPOSER_CALIBRATION` inside E). Cover `page:composer` by the home claim the way
   `commons:retained:*` already are (`coveredBy: sim:<home>`; the allocator's `validateCoverage` allows only commons today).
3. **l0 products** (71 MB) against the 45 MB GL the grid adds: check whether the road / plot claims charge CPU and GPU
   copies of bytes the page frees after upload.
4. The home's GL per texture mode (8 MB in `img`, 29 MB in `ktx2`): add Driftwood's `imagesFirst` row.

Items 1 + 2 alone bring A to ≈ 438–451 → (M − E) / A ≈ 1.03–1.06 on the c1 stop: inside the window without touching it.
Then two layouts and both texture modes (the phone for KTX2) must confirm before any window change.

## Growth after the leak fixes (`reentry-heap.mjs` → `reentry-heap.json`)

Five road-and-back visits on the public page, forced GC before each reading: JS heap at home 217.1 → 222.0 → 222.0 →
222.4 → 222.5 MB (plateau after the first re-entry); colliders 2299 and pieces 92 at every home stop; every per-entry
install exactly once. The soak's +4.30 MB per circuit (WC +3.69, GL +0.61) predates `933205df4` / `f05a45712` /
`1e428e7d7`; a new Simulator soak must show the plateau.

Plan-State: unchanged
