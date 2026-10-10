# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**2026-10-09 22:55 CT.** Councils done. Part A only.

**Milestones:**
- **M1:** done.
- **M2:** open. SF22: the first full circuit (6 entries + home) has zero errors (`690ac390e`), but Pine departure is 39.3 ms and drawn p95 33.4 ms under load 20–38. The env-map warm-up `1112e45b3` is under test. The memory verdict is Jake's G269 phone runs.
- **M3:** open. 1 of 7 at 80/20.

**Live:** production `7e1f3d40` (02:52 UTC), with SF75, the grid-approach fixes and the legacy copies' bakes `d486d5dde`. Origin `9f2dd6d0e`.

**80/20 (share · compatible):**

| Shard | Share | Compatible |
|---|---|---|
| Template 1 | 90.4 % | ✓ |
| Nine | 63.7 % | ✓ |
| Signal | 30.5 % | ✓ |
| Sky | 20.7 % | ✓ |
| Pine | 18.1 % | ✗ |
| Nalati | 12.9 % | ✗ |
| Driftwood | 10.3 % | ✗ |

**Generic SDK / game systems built tonight:**
- Looks: shaderFamily, renderPass, keyedSky, facetedSky, cascade, gullFlock, strandCloth, signs, canvasAtlas.
- Kits: kit/*, cull/*.
- Species: riggedHulls, limbRig.
- Weapons: magazineFirearm, boltCrossbow, leverFirearm, mountedSword, rewardBow, javelinSpear, weaponHooks (AS).
- Player modes (SF34, browser + headless + water).

**Rows:**
- **SF36:** done. Allowlist empty, every G140 weapon a row, first admitted AS hook (sabre); javelin stick bug fixed `91d748a7d`.
- **SF34:** engine done. Shard wiring is with the owners; template / headless traversal still left.
- **SF63:** grid parity: Pine clouds and Nalati daylight fixed `c784f7151`; the point-light-count program variants are the open trade.

**Codex lanes:**
- **sp-x1:** Nalati witness.
- **sp-x2:** Pine witness.
- **sp-x4:** Driftwood headless + water.
- **sp-x5:** SF22.
- **sp-x6:** Driftwood static bakes.

**Opus lanes:**
- **op-nine12:** Nine.
- **op-pine84:** Pine.
- **op-nalati85:** Nalati.
- **op-drift81:** Driftwood.
- **op-sf59:** material graphs.

**Unowned:**
- Sky / Signal M3.
- SF24 / SF27 / SF26.
- SF28 RideHUD (E332).
- SF66 map image in the shardfile.
- Quantized cross-platform bakes.
- SF67 residuals.

**Decisions (coordinator):**
- Nalati's dressing-plan bake was refused: 3.2 MB for 2.2 points is a net loss on phone loads.
- Weapon hooks share the "Shard directors (data)" row.

**Incident:** a bake run in the shared tree overwrote the foreign jian WIP's uncommitted Nine `physics.baked.json`. It's regenerable; the jian work must rebake.

**Jake:**
- **SF67:** create the AudioContext on the first tap? Pick.
- **SF63:** Driftwood grid shadows: Debug ▸ Look ▸ "Grid cell shadows" Tight, +25 MB; board `art/sf63/round-1-driftwood-shadows/board-ab.jpg`. Pick.
- **G269:** phone runs.
- **G260:** Blender board.
- **Sky:** isles are random per session. Pick.
- **Public Pine / Nalati:** they still boot the legacy copies. Recommendation: flip each to shardfile once it passes boot / walk / parity.
