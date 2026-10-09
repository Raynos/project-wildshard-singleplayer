# M3 hybrid tiles, part 2: Signal Dunes draws and stands on its own tiles (G227, E435)

Code: `b15cb7d06`. A default-off **Developer tool**, "Signal Dunes ground tiles" (`look/groundTiles.ts`, purpose developer,
reload; the coordinator ruled Developer tool, not a sixth comparison row, E451). Off is byte-identical to before.

## What it does when on

- **One product reader in both modes** (`src/game/shardfile/runtimeProduct.ts`): in a grid cell the regional world hands its
  resident runtime the admitted product (`provideRuntimeProduct`); standalone, a streaming `ClientAssets` over
  `/shardfiles/sunscar-dunes/` reads each declared file on demand (hash and size checked, cached).
- **The ground swap** (`look/render.ts` `buildTiledSand`): no code-built 257² mesh; the 16 L1 tiles and the fine L0 tiles
  inside the 150 m disc stream through the shardfile residency (`bindRuntimeTerrain`), each drawn with the engine tile view in
  the same sand family material. The vertex tint is the painter's own hollow / crest tint, computed per tile vertex (the
  bake's map-ramp colours feed the grid seams and are left alone). The baked dune-shadow and trail maps are made from the
  same 257-sample grid as before, so they are the same texels; the skirt is unchanged. The dusk system moves the fine ring
  with the player.
- **Queries and collision from the tiles' collider**: the painter binds the compiled 257² collider into its frame's
  heightfield (`PainterField.bindGround`, engine); standalone the collider is then built from it, and in a grid cell (whose
  collider is built before the painter runs) `resampleTerrain` rebuilds it (`Terrain.groundBound`).

## Parity (served candidate `f06568be0` = the same code with the row's purpose not yet developer; muted Chromium, iPhone 16 Pro, Developer on)

`capture.mjs` (standalone, the manifest's dev poses, off twice for the noise floor, then on), `diff.py`:

| pose | noise off / off2: mean abs · px > 8 | swap off / on: mean abs · px > 8 · px > 24 |
|---|---|---|
| spawn | 0.009 · 0.00 % | 0.91 · 4.8 % · 0.24 % |
| whip | 0.05 · 0.00 % | 0.31 · 0.84 % · 0.03 % |
| ray | 0.045 · 0.32 % | 0.51 · 1.6 % · 0.20 % |
| quest | 0.023 · 0.04 % | 0.48 · 2.5 % · 0.33 % |
| centre | 0.034 · 0.24 % | 1.14 · 5.5 % · 0.52 % |

`pair-<pose>.jpg`: off | on | |diff| × 4. The difference is grain-level shimmer on the near sand (the tiles' lattice is
500 / 256 = 1.953 m against the mesh's 480 / 256 = 1.875 m, so vertex normals and the tint sample shift a little) and the
far dunes past the fine disc on the 7.8 m L1 lattice; no visible change in the frames. The player's feet at the poses move
by at most 6.4 cm (spawn 21.367 → 21.303 m).

- Witness (on): 48 terrain tiles in the ground group (16 L1 + 32 L0 after the pose walk), 61 product reads, 0 page errors (the
  `brazier-hd` warning is in every run, off too).
- Memory at the centre (the in-page SF64 allocation ledger, `__wildshard.memory().totals`): GPU 127.9 MB off → 124.7 MB on
  (−3.2 MB); RAM 67.7–73.1 MB off, 68.1 MB on (within the off runs' spread).
- Cold load (fresh context, unthrottled, to playable): off 3.42 s / 3.13 s, on 3.10 s.

## Original follow-up list (before the proof below; the heavy lane queued the candidate build ~25 min)

- The grid off / on pair: `grid-run.mjs` here is sf50-close's run with the row fixture (`ROW=on|off`) and a terrain-tile witness.
- `physics-baseline.mjs --no-build --mode=walk --device-save=debug.plugin.sunscar-dunes.groundTiles=on` (0 stuck), the four
  midpoint entries, and `scripts/loading-benchmark/` with the row on (it has no device-fixture flag; the cold load above is
  the unthrottled stand-in). The physics-baseline with the row off is unchanged by construction.
- Static dressing as props tiles (optional) not started.

## Follow-up measurement: default remains off

The [pinned grid / collision proof](proof-5b2e86cf7/README.md) completes the OFF/ON grid visits, the ON canonical walk (7 legs, 0 stuck), and all four midpoint entries both ways (8 legs, 0 stuck; 7,680 flat/dry footprint rays). Frame-floor commands are recorded rather than run because the Simulator was occupied and machine load stayed above 12.

**Do not flip yet:** a separate matched centre pair (OFF repeated for noise) reveals an ON-only hard tonal boundary across the sand. The original north-entry shots alone concealed it. The default can be reconsidered after the rendering owner fixes that visible difference and repeats the centre pair. No source/default change is part of this receipt; the loading benchmark and optional props conversion remain open.
