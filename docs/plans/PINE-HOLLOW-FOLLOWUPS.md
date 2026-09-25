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
| F-J4 | **The app icon + splash from the new art**: the hero lane re-made the native icon (the Antler King's skull + ribcage, was the painted cabin / sunset) and splash screens in 7dbbf32 — reverted in 02ae476 because it changes the whole app, not just Pine Hollow (Jake's taste call). `git revert 02ae476` brings it back; it also fixes scripts/native-icons.py's moved source paths |

## Look (from the look loop, crags, trees and water lanes)

| # | Row | From |
|---|---|---|
| F-L1 | Per-zone ΔE00 misses left after round 3: the Ridge's rock 8.8 (the crag meshes' dark, stretched granite), the Ridge / Den sky 6.7 / 7.0 (codex painted paler skies there), the Hollow's far rock 6.2 | look loop round 3 (`art/pine-hollow/round-17-look-loop-3/README.md`) |
| F-L2 | Crags up close: the kit modules read as stacked blocks; the face skin's ledges stretch on near-vertical faces; a sculpted hero crag for the lookout's own view | crags lane (`art/pine-hollow/round-13-crags-cave/`) |
| F-L3 | Tree crowns read near-black from above (god views, the lookout) | look loop TOP-10 #8 |
| F-L4 | Grass trample (Nalati's `GrassTrample` is on main now) | look loop |
| F-L5 | Weather extras: rain on the lens, splashes at the feet, puddles off the trails, the cave mouth masked from rain | weather lane |
| F-L6 | The beaver pool doesn't visibly drain in the dam puzzle (pond and creek share one water level) | quest lane |
| F-L7 | Under `weather=fog` the Antler King turns pale ghost-white (the fog laid over his material) — likely a bug in the fog / selfLight mix | hero lane (`art/hero-images/round-4-pine-hollow-in-engine/README.md`) |

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
| F-U2 | Touch HUD: on Pine Hollow with the crossbow the AIM disc overlaps DODGE (main's layout after E119) — main's own ask **N25** (`docs/tasks/asks/N25.md`) | the Nalati HUD agent |
| F-P1 | Load: 36.01 MiB phone cold vs the 37 MiB row; the one big lever left is the two unselected music styles (3.85 MiB) — Jake kept them (PH-U33); others: Nalati code out of the main bundle (+0.34 MiB), glTF geometry compression (~0.25 MiB) | verify lane |
| F-P2 | The shared machine was too loaded for a clean desktop 60 fps reading after the render fix — one quiet desktop run | render-fix lane |
| F-P3 | E142 levers measured, not applied (fix lane; `docs/tasks/asks/E142.md` "Fix lane"). ~~A static phone render scale of 1.5 on Pine Hollow is −34 % GPU at the stones and in the grove … it waits on the heavy lane's dynamic resolution.~~ **Struck (2026-09-25): resolution is not a lever.** Jake: "Dynamic resolution is a hack … a complete bullshit hack. We should not be going back from 2 to 1.25. We should just be doing performance optimizations necessary for hitting 30 FPS at 2." The phone stays at 2×; the dynamic resolution (4b87508) is removed. Others: re-draw the shadow map every 2nd frame or cache the static casters (the shadow draw is −13–19 %); SMAA off (−4 %, but the foliage aliases); bloom / god rays / volumetric march off (−3 % each). A `?forest=dense` switch back to the look-loop forest was not built: `terrain.bin`'s placement log is baked for one forest | E142 fix lane |
| F-P4 | E143 thinned the forest by hand (`FOREST_KEEP` 0.7, old-growth × 1.6, shrubs × 2.5, ferns × 1). If a zone now reads bare on Jake's walk, tune it per zone (the grove's keep, the old-growth multiplier) rather than bringing the round-2 grid back | E143 |

## GPU levers not taken (E142 heavy lane, 2026-09-25 — measured with scripts/pine-hollow-gpu.mjs, M5 at 1206×2622)

The frame after the density cut + the shipped levers: 2.0–2.65 ms. Each row: what it saves, why it was not shipped.

| # | Row | Measured | Why not yet |
|---|---|---|---|
| F-G1 | Terrain splat on the phone: no normal / ARM fetch (flat normal, constant roughness) | −0.10…−0.22 ms (the terrain is 0.37–0.85 ms, the dearest single thing) | a look change (lighting detail on the ground): a variant for Jake's pick |
| F-G2 | Terrain: splat layers under 8 % weight skipped | −0.01…−0.16 | harder layer edges (trails) — a variant |
| F-G3 | Terrain: one near sampling (no rotated second tile) + a hard 40 m near / far switch | −0.02…−0.16 | tiling shows / a seam line — a variant |
| F-G4 | Terrain: no open-floor grass / moss extra fetches | −0.06…−0.14 | loses the moss drifts — a variant |
| F-G5 | Foliage depth pre-pass (alpha-tested depth only, then colour at EQUAL) | cards cost 0.12–0.92 ms (old-growth 9 alpha layers kept, 20 rasterised per px) | needs a wind + fade-patched cheap depth material per batch; front-to-back sort shipped instead (−0.08…−0.12) |
| ~~F-G6~~ | ~~World-depth copy at half res for the depth readers (march, god rays)~~ | — | **struck: a resolution trick** (Jake: "we should just be doing performance optimizations necessary for hitting 30 FPS at 2") |
| F-G7 | Cheaper IBL specular for rough materials (radiance ≈ irradiance / π over roughness 0.85) | −0.01…−0.09 | not worth a look risk; all IBL is only 0.14–0.21 |
| ~~F-G8~~ | ~~Volumetric march quarter-res + bilateral up~~ | the march is 0.04–0.06 ms (2 %) | **struck: a resolution trick** (Jake, above); the march stays as it is |
| F-G9 | HUD glass blur off on the phone (the build keeps only `-webkit-backdrop-filter`, so only Safari draws it) | Simulator: opacity-0 overlays cost nothing; ~7 small visible layers | wait for the probe's `no HUD blur` row on Jake's phone |
| F-G10 | The CSS minifier drops unprefixed `backdrop-filter` (esbuild target): Chrome / Android draw no HUD glass at all | — | a look bug on Android, not perf — its own ask |
