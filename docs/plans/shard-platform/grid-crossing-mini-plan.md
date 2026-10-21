# Grid crossing under 5 seconds: mini plan (G579, G580)

Jake, 2026-10-21 ~18:05 Cancun: *"we need to be able to go from shard to shard in the infinite wild shard, and this needs to
be fast … sub 5 seconds … The whole thing is dead if you can't go from shard to shard fast."* With G578: a cell's load
never leaves the 3D world.

## What the audit measured (plan agent's subagent, live f66a4309e, Chromium as iPhone 16 Pro, phone tier, 4x CPU)

Every crossing **tears the source shard down and builds the destination from nothing**, and that build only starts past
the road midpoint, after the source has retired. The player stands at the cell wall the whole time.

| Crossing | Held at the wall | Terrain + physics | World | Equipment + creatures | Gameplay | Shader warm-up |
|---|---|---|---|---|---|---|
| Pine → Sky, first | 13.6 s | 0.66 | 7.75 | 0.47 | 0.75 | 5.38 |
| Pine → Sky, warm | 9.8 s | 0.37 | 4.59 | 0.27 | 0.57 | 5.43 |
| Sky → Pine, warm | 30.5 s | 1.48 | 13.90 | 2.58 | 2.35 | 11.58 |
| Padding cell | 0 s (built ahead on the road) | | | | | ~1.6 |

- Saving the source takes 1–9 ms: saved state is not the cost. Jake's '14.6 s Gameplay and saved state' is most likely
  the shader warm-up under a wrong label (`cellLoading.ts`).
- During a 15 s Sky build only ~24 % of CPU time is building; ~30 % idle, ~31 % drawing the waiting view.
- A cheap re-activate path for a still-loaded shard exists (`hybrid.ts:441-452`, 5–12 ms) but is never used, because
  leaving always retires the shard (`liveSession.ts:396`); only one shard world may exist (`live.ts:301-302`, `:577`);
  the build starts past the road midpoint (`live.ts:439`).

## Rows

| Row | What | Saves | Effort |
|---|---|---|---|
| **T1** | **Warm neighbour** (architecture): two shard worlds at once. Build the approached cell fully (warm-up included) while the player is still in the source, and keep the last cell loaded on leave (retire by the existing cold-dwell rule, `retireColdRegions`, not on leave). A crossing becomes the 5–12 ms re-activate. Lifts the one-world rule (`live.ts:301-302`, `:577`); starts the existing build-ahead (`hybrid.ts:413`, `liveSession.ts:749`) earlier. Memory is judged per shard (G556); the page total's only limit is not crashing | 10–30 s; the only route to seamless | ~1 week |
| **T2** | **Keep and pre-build shaders**: keep compiled programs for shared and recently visited materials across retirement; compile the destination's set on the road with parallel shader compile; more than one program per frame while held (`precompile.ts:691`, `Game.ts:839-920`) | 3–8 s | 2–3 days |
| **T3** | **Cache world-scene builds** per shard (fixed content): keep built geometry and instance buffers, or build them in a worker, instead of rebuilding per entry (Sky's world scenes; Pine's props 2.7–3.8 s, grass 0.9 s) | 3–6 s | 2–4 days |
| **T4** | **Start the build when the source edge is crossed** toward one destination, not at the road midpoint (`live.ts:439`) | ~1 s hover, ~5 s walking | 0.5 day |
| **T5** | A bigger per-frame build budget while held at the wall (`framePacing.ts:68`, `workSlice.ts:19`); no gain in Chromium at 60 fps, may matter on the phone at 30 fps | unproven | 0.5 day |
| **T6** | Honest labels: the warm-up is reported as warm-up, not 'Gameplay and saved state' (`cellLoading.ts`) | — | 0.5 h |

T2 + T3 + T4 bring Pine → Sky from ~11 s to ~5 s. Pine (~32 s) and sub-5 s everywhere need **T1**. Order: T4 and T6 at
once (small), T2 and T3 in parallel, T1 as the main row from now. **Done when** a warm crossing into every neighbour
cell is under 5 s in Chromium at phone tier, measured with the audit's harness (handed to the builder).
