# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**2026-10-09 21:15 CT.** Councils done. Part A only.

**Milestones:**
- **M1:** done.
- **M2:** open. SF22 (33 ms crossing) is sp-x5's. The memory verdict is Jake's G269 phone runs.
- **M3:** open. 1 of 7 at 80/20.

**Push / release:**
- Origin is `662a12434` (green push 21:08), 1 commit behind main. It carries:
  - SF75 `a1731cf57`;
  - the grid-approach fixes `b7126a805`;
  - the legacy copies loading their bakes `d486d5dde` (public Pine / Nalati were silently on analytic terrain);
  - the Linux CI fixes (darwin-only bit-exact gates, timeouts).
- Production is 5d4e3b70. The next CI-green main deploys.

**80/20 (share · compatible):**

| Shard | Share | Compatible |
|---|---|---|
| Template 1 | 90.4 % | ✓ |
| Nine | 50.2 % (`1fa48c663`) | ✓ |
| Signal | 30.5 % | ✓ |
| Sky | 20.7 % | ✓ |
| Pine | 13.3 % (`0d3391e42`) | ✗ |
| Nalati | 5.3 % (`6e91c6c3d`) | ✗ |
| Driftwood | 4.1 % (`24769342a`) | ✗ |

New SDK systems: shaderFamily, signs, magazineFirearm / boltCrossbow / leverFirearm. SF36: the weapon allowlist is empty; Nalati's four remain (op-sf36c).

**Floors:** desktop Pine / Driftwood / Nalati PASS on a quiet machine (`a6a86b73d`). SF67: Nalati warm 16.1 → 13.4 s at load ~35 (`f4c2eadd0`).

**Codex lanes:**
- **sp-x1:** Nalati witness.
- **sp-x2:** Pine witness.
- **sp-x4:** Driftwood headless.
- **sp-x5:** SF22.
- **sp-x6:** Driftwood static bakes.

**Opus lanes:**
- **op-nine8:** Nine passes / viewmodel.
- **op-pine81:** Pine SDK systems.
- **op-nalati81:** Nalati species / dressing.
- **op-sf36c:** Nalati weapons.
- **op-sf63c:** grid look gaps.

**Unowned:**
- SF34 player modes; SF24 / SF27 / SF26.
- SF28 RideHUD (E332).
- SF59.
- SF66 map image in the shardfile.
- Quantized cross-platform bakes.
- SF67: first frame, navmesh decode, shardfile parse ×3.

**Jake:**
- **SF67:** the AudioContext ctor is one 130–172 ms task; creating it on the first tap removes it. Pick.
- **SF63:** Driftwood grid shadows. Debug ▸ Look ▸ "Grid cell shadows" Page / Tight: +25.2 MB GPU, phone only; board `art/sf63/round-1-driftwood-shadows/board-ab.jpg`. Pick.
- **G269:** three phone runs.
- **G260:** Blender board.
- **Sky:** isles are per-session random; baking them fixes one look. Pick.
- **Public Pine / Nalati cards:** they boot the frozen legacy copies. Recommendation: flip each to shardfile once it passes boot, walk and parity.
