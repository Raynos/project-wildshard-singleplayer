# Far Reach regressions 10-28: SHARDFILE against LEGACY, one buildable list (G834)

**State:** `open` 2026-10-28 ~15:30 Cancun. Spike by a wildshard-v subagent for wildshard-new, which hands the rows to
lanes. Jake (10-28): *"The floating island Far Reach looks like absolute dog shit in the shard file. It's a really
obvious visual regression."* Part of [close-out](close-out-mini-plan.md) after CO6; archives with SHARD-PLATFORM (CO8).
Start board: [CO6 Sky sheet](../../../art/legacy-vs-shardfile/round-1-2026-10-28/far-reach-board.jpg) (`93eb52800f`).
Captured on `4990c215fb` (before the fix) and HEAD `30388a573b`; boards:
[round-43](../../../art/far-reach/round-43-shardfile-regressions/).

## Summary

1. The CO6 damage (bare islet slabs, no keels, trees or decorative isles, a thin windmill) had one cause and is
   **fixed at `18aaab1583`**: Far Reach's tiled scene parts drew nothing because no tile driver attached them.
2. What is left is the **5 × 5 ring**: in an open-sky shard everything is on screen, and past the ring Sky shows coarse
   blobs (the 4 gate isles, the crown) and drops 2 decorative isles, the crown keel and 9 trees.
3. Sunrest seen from below has lost its dense sward disc and its keel reads darker than LEGACY.
4. Every CO6 camera, the Keeper, the windmill close-up and a 5 s hover clip now match LEGACY, on Chromium and WebKit.
5. No look pick is needed to fix these: every fix restores LEGACY. The one question below is optional.

## Regressions

| # | What | Where (board) | Cause | file:line | First bad |
|---|---|---|---|---|---|
| R1 | Islet keels, all trees, all decorative isles, the mill tower and foot not drawn (**fixed**) | [fr1](../../../art/far-reach/round-43-shardfile-regressions/fr1-hidden-tiled-parts-board.jpg): hover, mill, below, aerial | T3: a scene's tiled parts draw nothing until a tile driver attaches them. Only world.assembly and forest-page drive tiles; Sky's plan has world.scenes alone. Census on `4990c215fb`: every `far.trees.*` and `far.sky-isles.*` had `count 0` except the 3 single-instance keels (a 1-instance mesh is never tiled). `far.mill.tower` and `far.mill.foot` had `drawRange [0, 0]`: x = 0 is a tile edge, so they spanned 2 tiles | `src/game/shardfile/tiledMesh.ts:135` (instances), `:92` (merged); `src/game/shardfile/worldScenes.ts:662`; fix `src/game/shardfile/clientPlan.ts:289` | instanced parts `06d63e5b21` (10-26), merged meshes `4bfd46de4e` (10-23); from code, not bisected by preview. Fixed `18aaab1583` |
| R2 | Past the ring: isles l5 (-130, -170) and o3 (-40, -214), the crown keel and 9 trees missing at spawn | [fr2](../../../art/far-reach/round-43-shardfile-regressions/fr2-beyond-ring-board.jpg): crown from the air (Chromium, WebKit) | The decorations scene (sky isles, keels, trees) tiles with the 5 × 5 ring like ground props and has no coarse stand-in (T11). Spawn counts at HEAD against the LEGACY cell: isles 16 / 18, keels 7 / 8, trees 69 / 78 | `src/shards/far-reach/generators/staticScene.ts:31` (mesh nodes); `src/game/shardfile/worldScenes.ts:662` | became visible with `18aaab1583`, which drives the ring only; tiling from `06d63e5b21` |
| R3 | Past the ring the 4 gate isles and the crown deck are faceted olive blobs, with no trees and no keel | [fr2](../../../art/far-reach/round-43-shardfile-regressions/fr2-beyond-ring-board.jpg): west gate isle | T8.S3 moved Sky's island draws to fine L0 tiles; past the ring only the L1 parent draws, a 1.5 % meshopt sloppy copy (D76, 809 triangles for all 11 squares) | `src/shards/far-reach/generators/isleProps.ts:28` | `8bf41b2b33` (T8.S3) with `60535f5995` (L1) and `61ea0216c8` (1.5 %) |
| R4 | Sunrest from below: LEGACY's dense sward disc is gone (see-through, scattered cards) and the mass keel is darker, with less haze | [fr4](../../../art/far-reach/round-43-shardfile-regressions/fr4-sunrest-underside-board.jpg); Roost (no meadow) is the control and matches | **Not isolated.** The meadow is `doubleSided` in both, so check the blade count (`far.meadowBlades` knob, `below: phone`), the chunk spheres from below, and the `sky-isle-keel` look port's haze (`SKY_ISLE_HAZE`) | `src/shards/far-reach/generators/meadowScene.ts:36`; `src/shards/far-reach/generators/worldScenes.ts:153` | not bisected |
| — | Keeper missing at spawn (CO6) | CO6 camera 1 | Missing on `93eb52800f`, but present on `4990c215fb` and HEAD; not isolated. No row | — | gone by `4990c215fb` |
| — | 5 isles (o2, n1–n3, b4) and their 17 trees beyond the 500 m cube | fr2 footer | G99, by design: a grid cell leaves them to its neighbours; LEGACY standalone draws them. Not counted | `generators/placements.ts:175` | — |

Not regressed (HEAD, every capture): sky, fog, cloud sea, sun and grade at the 4 CO6 cameras, the hover view and the
5 s hover pan; the windmill sails, tower and foot; the Keeper; bridges and docks; the rising islets near their entry;
grove, roost and windmill keels. WebKit hover and aerial match Chromium.

## Rows

| Row | What | Owner | Size | Done when |
|---|---|---|---|---|
| FR1 | Guard R1. Add a focused test that a world.scenes-only plan attaches its tiled parts on the spawn ring, and that Far Reach's spawn census has every `far.trees.*` / `far.sky-isles.*` count > 0 and the mill drawRange whole. The `18aaab1583` fix landed with no Sky case | Codex (test only, no visual change) | S | The test fails with `clientPlan.ts` as on `4990c215fb` and passes at HEAD; the fr1 board stands as the visual proof (LEGACY = HEAD on the same cameras, Chromium and WebKit) |
| FR2 | Sky's tile ring covers its whole cell, declared as data in Sky's product (host bar; no shard branch). Sky is open sky, so every tile is on screen from a hover. This fixes R2 and R3 together: every decoration and fine island tile attaches. Measure the phone tier (≤ 1.2 GB per shard) and the phone wire (unchanged: the fine files already ship). If the reading refuses, fall back to the decorations scene drawn whole plus a 10 % coarse L1 | Opus | M | Spawn counts equal the LEGACY cell (isles 18, keels 8, trees 78); the islet-west, aerial, crown-side and look-west cameras match LEGACY on a labelled Chromium + WebKit board; physics walk 0 stuck |
| FR3 | Find and fix R4: Sunrest's sward from below and the mass keel's haze and tone | Opus | S–M | sunrest-below and roost-below match LEGACY on a labelled Chromium + WebKit board; the spawn and hover cameras are unchanged |
| FR4 | Close the CO6 Sky gap: point the round-1 README's "VISIBLE GAP" and the BURN-DAMAGE-LIST Sky row at `18aaab1583` and this plan's boards | coordinator (docs) | XS | Both say fixed at `18aaab1583`, with the remainder in FR2 and FR3 |

## Order

FR1 (independent, Codex, start now) ∥ FR2 → FR3 → FR4. FR2 first among the visual rows because it is the remaining
"obvious" damage (gate isles and the crown read as blobs from every hover). FR3 shows only from under Sunrest.

## Capture recipe (for FR2 / FR3 boards)

`tmp/far-reach-regressions/capture.mjs` (through `scripts/browser-lane.sh`; `--engine=webkit`, `--cams=`, `--base=`)
captures the 4 CO6 cameras plus 17 free cameras both ways on a shared `serve-build.sh --head` preview, muted, as
iPhone 16 Pro, phone tier, 2×. `probe.mjs` dumps each instanced mesh's count, drawRange and instance positions.
`board.py` builds the labelled boards. The hover clips are in `tmp/far-reach-regressions/hover5s-{legacy,shardfile}.mp4`
(the pan was captured with the player at the crown; it matches).

## Questions for Jake

None blocks a row. Optional, and only if Jake wants the standalone horizon back: LEGACY's horizon shows 5 more isles
past the 500 m cube, which a grid cell leaves to its neighbours (G99). Recommended: **keep G99** (Skip).
