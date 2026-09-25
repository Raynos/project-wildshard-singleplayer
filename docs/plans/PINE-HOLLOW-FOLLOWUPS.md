# Pine Hollow — follow-ups after the remaster merge

**State:** `draft` 2026-09-25 — everything left on Pine Hollow after PINE-HOLLOW-REMASTER landed on main (archived at
project/archive/2026-09-25-pine-hollow-remaster.md). Jake: "anything another agent needs to do on Pinewood going forward goes
into a follow-up plan". **Jake approved none of these rows yet: nothing is built from this plan until he names a row.**
Each row names where it came from (the remaster lane that left it) so the next agent can read the evidence.

## Moved out of the remaster to finish it sooner (PH-U32)

| # | Row | Why it moved |
|---|---|---|
| F-P5 | **WebGPU**: Pine Hollow on the TSL path (V-G2), parity at the 9 cameras (mean \|Δ\| under 6/255); WebGL stays default | WebGL is the default either way; ~half a day of parity work |
| F-0.2 | **The per-shard code split** (ENGINE-FIT E5): `ShardModule { build, look, quest, audio, fauna, loadSteps }`, main.ts's shard branches out into `src/shards/*` | A risky refactor right before a merge; better on main with all three shards landed |
| F-B1 | **Whole-map Blender pass**: `pnpm blender:island --chunk pine-hollow` — terrain at 2× grid, Geometry-Nodes scatter, AO + bounce lightmaps, LOD'd tiles | The trees, crags, cave and landmarks already carry most of the visual win |
| F-B5 | **CC0 photoreal kit**: 20–30 Poly Haven props / scanned rocks and logs | Nice to have |
| F-B6 | **The cabins lifted**: re-materialled for the new look; the ranger's cabin interior dressing | Nice to have |

## Jake's own checks (only he can do them)

| # | Row |
|---|---|
| F-J1 | **An iPhone reading** (Low Power Mode off): Pine Hollow's locked 30 fps at the gate / cabin / pond / hamlet / lookout / King's clearing (headless says 100 % of frames at 33.3 ms; the phone is the truth) |
| F-J2 | **A listen**: the new music (calm-night, the Antler King's 3 phases, the dawn sting) and the SFX / barks on `art/music/round-3-pine-hollow/index.html` — every pick there was made by the automatic rankers; veto any slot |
| F-J3 | **Mott the trader's voice**: the sound lane voiced the trader as a woman while the name and the model read as a man — keep or re-roll |

## Look (from the look loop, crags, trees and water lanes)

| # | Row | From |
|---|---|---|
| F-L1 | Per-zone ΔE00 misses left after round 3: the Ridge's rock 8.8 (the crag meshes' dark, stretched granite), the Ridge / Den sky 6.7 / 7.0 (codex painted paler skies there), the Hollow's far rock 6.2 | look loop round 3 (`art/pine-hollow/round-17-look-loop-3/README.md`) |
| F-L2 | Crags up close: the kit modules read as stacked blocks; the face skin's ledges stretch on near-vertical faces; a sculpted hero crag for the lookout's own view | crags lane (`art/pine-hollow/round-13-crags-cave/`) |
| F-L3 | Tree crowns read near-black from above (god views, the lookout) | look loop TOP-10 #8 |
| F-L4 | Grass trample (Nalati's `GrassTrample` is on main now) | look loop |
| F-L5 | Weather extras: rain on the lens, splashes at the feet, puddles off the trails, the cave mouth masked from rain | weather lane |
| F-L6 | The beaver pool doesn't visibly drain in the dam puzzle (pond and creek share one water level) | quest lane |

## Models and animation (from the creatures, polish, loadout and assets lanes)

| # | Row | From |
|---|---|---|
| F-M1 | The Antler King stands on four legs on the elk rig; the concept is more upright — a rig of his own | creatures lane (`art/pine-hollow/round-9-creature-refs/board-antler-king.jpg`) |
| F-M2 | Both bears carry a small stub-tail flap from the generator; the brown bear reads pinkish, the Grizzled Sow near-white | creatures lane |
| F-M3 | The NPCs: shoulders stretch when Hale lifts his arm; no walk clip | creatures lane |
| F-M4 | A desktop far-distance LOD for the generated creature hulls (desktop animal tris +0.1–0.4 M) | creatures lane |
| F-M5 | Birds: the flying owl's body is flat side-on; the woodpecker clings with standing legs; the raven's phone texture is soft | polish lane (`art/pine-hollow/round-16-birds/`) |
| F-M6 | First-person hands on the crossbow and the lever-action (the knife has a gloved hand; the guns have none) | loadout + polish lanes |
| F-M7 | The mill door is merged into the building mesh: it can't open after the miller's errand | assets + quest lanes |
| F-M8 | The lever-action's case colours read bright / silvery in game — a darker, more mottled finish if Jake wants it | rifle lane (`art/pine-hollow/round-15-rifle/`) |

## Sound, UI, perf

| # | Row | From |
|---|---|---|
| F-A1 | The ambience beds are short loops (8–16 s; the cabin fire 8 s) — longer takes if they read repetitive | sound lane |
| F-U1 | The Explore map's pin tags overlap in the hamlet / Den / pond clusters (the in-game MAP tab is fixed) | verify lane |
| F-P1 | Load: 36.01 MiB phone cold vs the 37 MiB row; the one big lever left is the two unselected music styles (3.85 MiB) — Jake kept them (PH-U33); others: Nalati code out of the main bundle (+0.34 MiB), glTF geometry compression (~0.25 MiB) | verify lane |
| F-P2 | The shared machine was too loaded for a clean desktop 60 fps reading after the render fix — one quiet desktop run | render-fix lane |
