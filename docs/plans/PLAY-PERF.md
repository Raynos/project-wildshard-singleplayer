# Play performance — 60 FPS on the phone tier

**State:** `blocked` 2026-09-22 — levers 1–7 landed; waiting on the iPhone meter line for levers 4–7 (§2) before deciding what is left.

Ruler: `game.lastFrame` (calls / triangles for the whole composer frame) read headless via agent-browser,
`?tier=phone&skipintro=1&nolock=1` at 390×844. Headless frame ms is vsync-pinned (16.7) so **counts are the
ruler**; the user's iPhone meter is the truth for ms. Poses: gate `x=0&z=-200&yaw=3.1416`, cabin
`x=-14&z=-62&yaw=3.1416`, pond `x=-56&z=95&yaw=3.1416`.

## §0 Measured decomposition — before (commit 58ccfe0, phone tier, 390×844)

iPhone in play: **19 fps · 53 / 76 ms · 471 calls · 16.8 M tris**. Headless phone: gate 451 / 17.2 M, cabin
425 / 17.5 M, pond 380 / 24.0 M. Desktop 1600×900: gate 836 / 22.3 M, cabin 903 / 22.8 M, pond 668 / 29.5 M.

Scene pass at the gate (calls / tris), with the 2 shadow cascades → without shadows:

| group | with shadows | no shadows | why |
|---|---|---|---|
| trees | 48 / 9.70 M | 16 / 3.23 M | all 1770 trees drawn every frame (no frustum cull); lo cards ≈ 1 300 tris/tree × 1 560 far trees = 2.0 M; hi 3–4 k tris × 210 |
| grass | 1 / 2.26 M | 1 / 2.26 M | 75 264 slots × 30 tris, every slot goes through the vertex shader (zero-scaled or not) |
| props | 24 / 2.75 M | 8 / 0.92 M | 380 boulders × 1.3 k + 70 stumps × 3.3 k + 55 logs × 3.6 k, chunk-wide, never culled |
| ferns | 3 / 1.30 M | 1 / 0.43 M | 6 000 × 72 tris chunk-wide, cast shadows |
| cabins | 142 / 0.73 M | 78 / 0.26 M | 3 cabins × ~26 meshes, all in both cascades |
| animals | 145 / 0.15 M | 58 / 0.06 M | 24 animals × ~2.4 meshes, all in both cascades |
| water (pond pose) | 75–124 / 7.1 M | same | planar reflection re-renders the WHOLE scene (grass, ferns, props, animals) at 1024×512 |
| terrain | 2 / 0.13 M | 2 / 0.13 M | fine |
| boundary 19 · crossbow 13 · horizon 4 · shrubs/litter/reeds 9 · particles 3 · sky 5 | | | small |
| post: god rays+bloom+grade pass 25 calls · SMAA 3 · volumetrics 1 | | | |

Shadow passes alone: 211 calls / 9.8 M tris (more than the visible scene).
Budget (phone): ≤ 150 calls, ≤ 2.0 M tris, iPhone ≥ 55 fps. Desktop: 60 fps at 1600×900, ≤ 300 calls.

## §1 Levers (whole-frame calls / tris, phone 390×844; gate · cabin · pond)

| # | lever (commit) | gate | cabin | pond |
|---|---|---|---|---|
| 0 | before (58ccfe0) | 451 / 17.2 M | 425 / 17.5 M | 380 / 24.0 M |
| 1 | shadows by tier (1 cascade to 80 m, 1024², PCF; undergrowth / lo trees / far animals cast none) + per-tree frustum culling + far-tree impostor beyond 130 m (f806c4b) | 236 / 5.6 M | | |
| 2 | grass 40 m ring · 72 slots · 3 quads; props per-instance culled; pond reflection skips carpet layers, 512×256; cabin detail LOD 70 m; 4 shared point lights (were 20 in every shader); god rays 24 @ 0.35, volumetrics 8 steps, SMAA low, bloom 5 levels (07f59f9) | 180 / 2.1 M | 210 / 2.4 M | 187 / 2.0 M |
| 3 | undergrowth cell-culled (ferns 0.43 M → 0.01 M), hi trees to 70 m (64b2d22 +) | 179 / 1.9 M | 209 / 2.2 M | 191 / 1.7 M |
| — | iPhone receipt after 1–3 + PCFShadowMap: **30 fps** (iOS pins rAF at 30 when 60 is not sustained) | | | |
| 4 | DPR 1.25 → 1.0, grass 56 slots, hi trees 55 m (3b784c7) | 182 / 1.8 M | 209 / 2.0 M | 191 / 1.5 M |
| 5 | post: SMAA off, volumetrics half-res pre-pass, god rays 0.25, bloom 4 levels (17d105b) | | 205 / 2.0 M | |
| 6 | cabin far LOD + per-cabin props + no detail shadows; boundary → 5 meshes (80fc5bd) | 141 / 1.35 M | 184 / 1.7 M | 169 / 1.3 M |
| 7 | BatchedMesh trees (WEBGL_multi_draw): 24 draws → 4 + 3 shadow (cde3a05) | **115 / 1.34 M** | **155 / 1.6 M** | **126 / 1.2 M** |

Per group at the gate now: trees 6 / 0.33 M · grass 1 / 0.40 M · cabins 23 / 0.02 M · props 16 / 0.38 M · terrain
2 / 0.13 M · post 19 · boundary 10 · crossbow 13 · animals 4 · undergrowth 6. Programs at play: phone 153 → 100.

Desktop 1600×900 (must look unchanged — verified at all three poses after every lever): gate 836 / 22.3 M →
470 / 10.6 M, cabin 903 / 22.8 M → ~540, pond 668 / 29.5 M → ~500. Desktop got the tree culling + impostor
beyond 210 m + BatchedMesh, culled props / undergrowth, the leaner reflection, the cabin LODs at 160 / 320 m and
the merged boundary; everything else is tier-gated in `src/core/tier.ts`.

Headless GPU timer queries (EXT_disjoint_timer_query_webgl2 on the M5 Max) read 1–2 ms for the whole phone frame
and are too noisy to rank passes — the phone's meter is the only ms ruler.

What the phone tier trades away (visible if you look): DPR 1.0 (rendered at 1/3 of the screen's native pixels)
with no SMAA, mid trees are lo cards from 55 m (crowns thinner), impostor cross-cards past 130 m, grass ring 40 m
and ~40 % thinner, ferns fade at 60 m, one 1024² PCF shadow cascade to 80 m (nothing shadows past 80 m), cabin
hardware / lantern / fire pit / crates pop in at 70 m and cast no shadows, log ends / door / woodpile go past
140 m, only the nearest cabin's lights are lit, no beacon lights, no fur shells, animals vanish past 150 m, god
rays quarter-res, volumetrics half-res with 8 steps, bloom 4 levels.

## §2 Left

- Waiting on the phone's meter line for levers 4–7 (target p50 ≤ 14 ms). Check `__world.forest.path` there: iOS
  Safari must expose WEBGL_multi_draw for the batched tree path.
- If still short: near-cabin 34 draws (merge the 12 per-material parts further needs a texture atlas), crossbow
  13 calls and the HUD are outside this brief; grass to 2 quads; volumetrics off on phone (−1 pass); the
  per-frame JS (grass flush, animal skinning ×24, particles) is unmeasured — profile on the phone with Safari's
  timeline before guessing.
