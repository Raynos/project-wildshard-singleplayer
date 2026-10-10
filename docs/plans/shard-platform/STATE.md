# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**2026-10-09 20:00 CT.** Councils done. Part A only.

**Milestones:**
- **M1:** done.
- **M2:** open. SF22 (33 ms crossing) is sp-x5's; the memory verdict is Jake's G269 phone runs.
- **M3:** open. 1 of 7 at 80/20.

**Push / release:**
- Origin is 3e16dd96e; production is 5d4e3b70 (no SF75 yet).
- **SF75** (INFINITE WILDSHARD → legacy Driftwood) is fixed by sp-x5 in `a1731cf57` (on origin). It ships with the first CI-green main.
- **Linux CI reds on 3e16dd96e are fixed locally:**
  - G285 byte-exact bakes and species-clip traces run on darwin only: `e82d9acac`, `56dfb0e59`, `2830e8286`. Linux x64 libm differs in the last ulp; the Mac push gate keeps the stale gates.
  - Nalati camp test timeout: `7a3347f6d`.
  - Nine manifest-map: `148e1be76`.
- Pine witness re-record (a11cce5d2 rebake): `d29a83811`.
- Platform-independent (quantized) bakes are an unowned follow-up.

**80/20 (share · compatible):**

| Shard | Share | Compatible |
|---|---|---|
| Template 1 | 90.4 % | ✓ |
| Nine | 36.3 % (`cb2a03301`) | ✓ |
| Signal | 30.5 % | ✓ |
| Sky | 20.7 % | ✓ |
| Pine | 12.0 % (`8205f028b`) | ✗ |
| Driftwood | 4.1 % (`24769342a`) | ✗ |
| Nalati | 0.4 % | ✗ |

**Floors:** the desktop Pine floor passes on a quiet machine (work p95 9.4 / 11.5 / 8.7 ms, `a6a86b73d`), and so do Driftwood and Nalati. SF67 Nalati longest task is 273 → 127 ms (`b973ea53b`); warm TTP is +1.4 s (op-loading5).

**Codex lanes:**
- **sp-x1:** Nalati witness.
- **sp-x2:** Pine witness.
- **sp-x4:** Driftwood headless.
- **sp-x5:** SF22 (approach P0 fixed in `b6833c9c1`).
- **sp-x6:** Driftwood static bakes.

**Opus lanes:**
- **op-nine5:** Nine view code → SDK.
- **op-pinebake3:** Pine bakes.
- **op-sf63:** grid look parity.
- **op-sf36:** weapon rows.
- **op-loading5:** SF67 residual tasks + TTP.

**Unowned:**
- SF34 player modes; SF24 / SF27 / SF26.
- SF28 RideHUD (E332).
- SF59.
- SF66 map image in the shardfile.

**Jake:**
- **SF67:** the AudioContext constructor is one 130–172 ms task; creating it on the first tap removes it. Pick.
- **G269:** three phone runs.
- **G260:** Blender board.
- **Sky:** the isles are per-session random; baking them fixes one look. Pick.
- **Public Pine and Nalati cards** boot the frozen legacy copies. Recommendation: flip each to shardfile once its entry passes boot, walk and parity.
