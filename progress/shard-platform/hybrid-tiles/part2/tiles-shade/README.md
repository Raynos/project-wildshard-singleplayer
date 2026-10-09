# Signal Dunes ground tiles: the shading boundary (tiles-shade, G227, E435)

sp-x2's matched grid-centre capture on `5b2e86cf7` showed a hard straight tonal line across the dune with the "Signal
Dunes ground tiles" tool on (`../proof-5b2e86cf7/pair-matched-centre.jpg`). This is the cause, the fix and the proof.

## Cause: the tiles' edge normals

The pose stands on the corner of four L0 tiles, looking north along the x = 0 tile edge, with a knife-edge dune crest
about 2–4 m west of it. The engine tile view (`src/engine/world/terrainTileView.ts`) took each tile's normals from its own
33² grid, which means central differences inside but second-order one-sided differences on the tile's edge. On a smooth
surface the two tiles agree to O(h²). Across a crest's slope break they do not: at x = 0 the west tile's stencil reaches
back over the crest (slope −0.143) while the east tile's stays on the lee face (−0.115). That step in the normal runs the
whole length of the edge as a straight line, and the daylight sun in the grid look makes it a hard one.

How it was found: in-page debug views of the same frame (`vFamGN` world normal, `vColor`, `vFamGPos`). Heights matched the
code-built mesh to the centimetre and the vertex tint matched. Only the normal view changed, in one tile column: the mean
normal-x moved +0.028 on the west side of the x = 0 edge and 0.00 on the east side. The other suspects were ruled out:
the triangle split is Rapier's on both meshes, the vertex tint is the same function, the shadow and trail maps sample by
world rect (they have no per-tile UVs), and at this pose every visible ground tile was L0.

## Fix (engine + game, generic for every hybrid shard)

- `installTerrainTile(…, { lattice })`: given the shared lattice the tiles were cut from (the 257² collider), each vertex's
  normal is the lattice's central difference at that vertex's world position. Tiles that share a point (two L0 neighbours,
  or an L1 / L0 seam at every fourth L0 vertex) now agree exactly. Inside an L0 tile the result equals its old normals to
  1e-6 rad. A tile whose vertices are not lattice samples falls back to its own grid.
- `bindRuntimeTerrain` (the M3 hybrid path) decodes the collider once and hands it to the runtime's tile view as a fourth
  argument. Signal Dunes passes it through. The data client is unchanged.
- `test/shardfile-terrain-view.test.ts` puts a knife edge 1.5 cells from a tile edge: with the lattice, the shared-edge
  normals and the L1 / L0 shared vertices agree below 1e-6 rad; without it they differ by more than 1°.

## Proof (candidate `e97c33cad` = HEAD `0f82dbeb8` + the fix; served builds, muted Chromium / Metal, iPhone 16 Pro, Developer on)

**Grid matched centre** (grid-run.mjs `MATCHED=on`, local (0, 0), yaw 0, pitch −0.12; off twice for the noise floor).
`grid-centre-off-before-after.jpg` shows off | on before the fix (HEAD `0f82dbe`) | on after: the line is gone.
Ground band y 460–740 of 402 × 874:

| centre, ground band | noise off / off2 | before: off / on (HEAD) | after: off / on (fix) |
|---|---|---|---|
| raw: mean · % > 8 · % > 24 | 0.86 · 0.49 · 0.08 | 7.53 · 45.8 · 13.7 | 7.04 · 42.1 · 10.5 |
| low-pass 3 px: mean · % > 8 · % > 24 | 0.34 · 0.21 · 0.00 | 3.30 · 19.2 · 4.06 | 1.90 · 4.19 · 0.13 |

Entry pose, ground band, raw: noise 0.95 · 1.43 %, before 1.36 · 3.87 %, after 1.04 · 1.29 % (the after pair is inside the noise floor).

**What is left** is grain-level shimmer, which a 3 px low-pass removes, and a slight ripple-phase shift. There is no line
and no tonal step. It comes from the lattice change itself: the code-built mesh is 480 m / 256 = 1.875 m from −240, the
compiled tiles are 500 m / 256 = 1.953 m from −250. At a grazing view a centimetre of height moves the ground's world
position by decimetres, and the procedural grain and ripples are keyed to world position. Feet differ by 1.75 cm at the
centre. Only a code-built path on the compiled lattice could remove that residue, and the flip deletes that path anyway.

**Standalone (dusk), the 5 dev poses** (`capture.mjs`, off / off2 / on), raw mean · % > 8: spawn 0.91 · 4.8, whip 0.29 · 0.83,
ray 0.46 · 1.3, quest 0.47 · 2.5, centre 1.03 · 5.0 (before the fix, tiles-swap's README: centre 1.14 · 5.5). The noise floor is
≤ 0.02 · 0.02 at every pose. The low dusk key hid the seam here, so the standalone numbers barely move.

- Physics walk, tool on (`physics-baseline.mjs --no-build --mode=walk --device-save=…groundTiles=on`, sp-x2's boolean
  Developer harness patch): 7/7 legs, 0 stuck, 0 air / swim / slide frames, Developer true, 48 terrain tiles
  (`physics-walk-on.json.gz`).
- Clean export of the candidate: full vitest 987 files / 5,515 tests green. tsc (root, layers, scripts) clean. oxlint on the
  changed files clean. The ratchet, shard-coupling and check-graph pass. The tile bake's byte-exact stale gate passes:
  `test/shards/sunscar-dunes/tiles.test.ts`, 4/4, and nothing is rebaked because the tiles and map-hash inputs are unchanged.
  Regenerated in the export only: layer-edges game → engine 802 → 803 (`runtimeWorld.ts` now decodes the collider).
- Boot smoke (`scripts/parity/boot-smoke.mjs`): standalone Driftwood, standalone Pine and grid all PASS, 0 faults.
  WebKit render smoke: pass.

`pixel-diff.json` holds every number above.
