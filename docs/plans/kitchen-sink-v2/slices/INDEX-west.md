# Kitchen Sink v2: the west slices, in order

The west half (non-combat: town, practice, traversal toys; nothing pays) as **33 small vertical slices**, each run by
the slice rule in [README.md](README.md): the platform work it needs first, every other shard that uses what it
touched migrated and proved unchanged in the same slice, then the showcase piece as data + AssemblyScript, playable and
checked. Researched against the code on 2026-11-03 (HEAD `bf06baccd5`); every slice file names the files and lines.
Hours are estimates; a lane-day is about 8 h.

## The slices

| Id | The piece | Platform work, just in time | Other shards migrated | Hours (eng / mig / shard) | Blockers |
|---|---|---|---|---|---|
| [W0a](W0a-cell-skeleton.md) | Cell, terrain, roads, seam wall, entries | none (Blender cell, toon look) | — | **14** (0/0/14) | — |
| [W0b](W0b-town-shell.md) | Town shell: walls, six gates, plaza, Main Street, 35 houses, obelisk, stable | none | — | **18** (0/0/18) | W0a |
| [W0c](W0c-honest-ruler.md) | (the 0 % custom reading) | HOST-AUDIT HA0 + HA1: the ruler follows declared kinds | every shard's numbers | **22** (20/2/0) | — |
| [W0d](W0d-host-register.md) | (one place for G595 approvals) | HA5: one host register replaces three lists | — | **14** (12/2/0) | W0c |
| [W0e](W0e-shard-cube-and-module-cap.md) | Cube-valid product | cube validator (19ad); decision-module cap 9 → Jake's number | Pine cave, Nine portal, Nalati arena validated | **12** (8/4/0) | — |
| [W1a](W1a-town-npcs-dialogue.md) | Six dev-bot NPCs, dialogue | none (NPC rows exist, 4 users) | Driftwood's stale `install.file` (if Q2) | **17** (1/2/14) | W0b |
| [W1b](W1b-quest-board-markers.md) | Quest board, giver "!" / "?", quest list, the tour quest | quest `giver`, `visibleWhen`, discover-N, checkpoint card, a quest list (HUD, E332) | DW, Nalati, Sky, Signal, templates (parity) | **26** (16/6/4) | W1a |
| [W2a](W2a-currency-pack-owned.md) | Scrip, 20-slot pack, owned rows | currency row; `OWNED` / `ItemId` unions → per-shard rows; save shim first | Driftwood, Pine (saves), Sky/Signal/templates | **38** (16/20/2) | W0a |
| [W2b](W2b-shops.md) | Tinker Rook (UPGRADES, BENCH), the weapons shop | exchange: typed costs and grants (no `{owner, path}`), level gate, tabs; shop off the plugin context | Driftwood (Maren), Pine (Mott) | **40** (18/12/10) | W2a, W1a |
| [W3a](W3a-range-melee-records.md) | Melee yard, range loan, six dummies, PB records | placeable dummies + loan zone (engine practice pieces); **records** host | spear host second user (Nalati) | **36** (22/4/10) | W0b |
| [W3b](W3b-bow-crossbow-ammo.md) | Bow and crossbow lanes, iron / pitch / broadhead | ranged weapon-family rows without reflection; ammo effects (ignite) | Pine crossbow + longbow, Nalati bow | **38** (16/14/8) | W3a |
| [W3c](W3c-lever-rifle.md) | Rifle lane, the lever rifle | `heldFirearm` out of the plugin (N2/N5 slice) | Pine rifle, Nalati roaming firearm | **30** (16/10/4) | W3a |
| [W3d](W3d-parry.md) | Parry dummy, parry and riposte | opt-in `parry` on the melee profile; guard input (HUD pick) | none (opt-in; other shards proved bit-identical) | **18** (12/2/4) | W3a |
| [W4a](W4a-interactables-plates-crates.md) | Plates → gate, crate stacks, balls | `world/interactables` section; plates feel any body; `pushable.as` in commons | Driftwood, Pine, Signal; template scripts | **32** (10/14/8) | W0b |
| [W4b](W4b-seesaws-ball-run.md) | See-saws, ball run, skittles | hinge joint row; tilt query; `skittles.as` | — | **21** (12/1/8) | W4a |
| [W5a](W5a-hover-park-ramps.md) | Hover park ground (kickers, halfpipe, bowl…) | the board's look moves to game (HA4d); the law stays engine | every shard's board look (paths only) | **24** (4/4/16) | W0b |
| [W5b](W5b-tricks-score.md) | Tricks and the trick score | board events; trick rows; `tricks.as`; toy upgrade effects | — | **19** (14/1/4) | W5a, W3a, W2b |
| [W5c](W5c-grind-rails.md) | Grind rails | rail rows + a board rail law | — | **20** (16/0/4) | W5b (soft) |
| [W6a](W6a-movers-out-of-plugin.md) | Sliders, spinner, lift | mover host out of `game/server/plugin/mover.ts` (N2/N5) | Sky, Driftwood, Pine, Signal (replays, saves) | **40** (18/16/6) | W0b |
| [W6b](W6b-conveyor-jump-pad.md) | Conveyors, jump pads | `conveyor` and `launch` traverse rows beside Sky's updraft | Sky (updraft reader) | **22** (14/2/6) | W0b |
| [W6c](W6c-rope-bridges.md) | Five swaying rope bridges | rope deck as a shared row; `bridgeSway.as` to commons | Driftwood | **22** (10/8/4) | W6a |
| [W6d](W6d-world-course-timer.md) | The movers time | the course host in the world, off the plugin context, records | Nalati, Nine (Explore rooms on the same controller) | **26** (14/8/4) | W6a–c, W3a |
| [W7a](W7a-grapple-course.md) | Five hooks, the tower, grapple time | hook rows in the world; Grapple Reel effect; decouple traversal rows from the quest page | Nine (hooks as rows) | **22** (6/4/12) | W6d |
| [W7b](W7b-zipline.md) | The 99 m zip over the wall | cable look baked by the SDK; prompt from the row | Driftwood (generator deleted) | **18** (8/6/4) | W7a |
| [W8a](W8a-ladders-climb-decks.md) | Climb yard decks, seven ladders | first real use of ladder rows | — (no shipped user) | **16** (4/0/12) | W6c |
| [W8b](W8b-scramble-climb.md) | Scramble wall, the Rock's route | a `climb` driven mode, scramble faces | — | **28** (24/0/4) | W8a |
| [W9a](W9a-rock-squeeze-cave.md) | The Rock and the squeeze cave | cave host out of Pine's forest page, two mouths | Pine (cave goldens) | **34** (12/8/14) | W0a |
| [W9b](W9b-vistas-caches-gold-finds.md) | Vistas, caches, Gold 1×1s, FINDS, toy feats | collectible sets (Driftwood's glass generalised), bench views, record feats | Driftwood (glass), Nalati (finds) | **32** (14/8/10) | W5a, W6a, W7a/b, W9a |
| [W10a](W10a-loaner-horse-paddock.md) | Paddock, loaner horse | a `given` mount source (no taming) | Nalati (riding saves) | **22** (10/4/8) | W1a, W0b |
| [W10b](W10b-riding-course.md) | Oval, 8 rings, 4 jumps, lap timer | none (W6d's course host) | — | **15** (2/1/12) | W10a, W6d |
| [W11a](W11a-day-night-weather.md) | 20 + 4 min days, rare storms, night lights | `weather.forest` → `weather.drawn`; rows into `world/weather`; the wind un-named | Pine, Nalati (weather logs, looks, saves) | **30** (10/14/6) | W0a |
| [W11b](W11b-west-audio.md) | Hub and west music, ambience, ~30 SFX | named stings (W19a), one-genre set (W19d) | stings proved on every shard | **26** (6/2/18) | W0b (+ the toys) |
| [W12](W12-west-finish.md) | The whole west on the phone | heavy proofs; the grid swap question | grid neighbours (seams) | **18** (0/2/16) | all |
| | **West total** | | | **810 h** (365 / 181 / 264) | |

Roughly **370 h Opus** (all shard art and feel, the HUD pieces, goldens) and **440 h Codex** (rulers, rows, hosts,
migrations, saves).

## Parallelism: 5 Opus + 5 Codex lanes

Graphical work is Opus-only (G848); a slice with both kinds of work splits its rows across one Opus and one Codex lane.

| Phase (≈ days) | Opus lanes | Codex lanes |
|---|---|---|
| **1** (days 1–3) | O1 W0a → W0b · O2 W9a (Rock, after W0a) · O3 W11b music + ambience briefs | C1 W0c → W0d · C2 W0e · C3 W2a · C4 W11a rename · C5 W6a (the big move, starts on day 1: it needs no town) |
| **2** (days 4–8) | O1 W1a → W1b UI · O2 W3a dummies/boards · O3 W5a park · O4 W4a yard look · O5 W6b/W6a stations | C1 W1b rows · C2 W3a records + loan · C3 W2b · C4 W4a section + migrations · C5 W6a migrations → W6b law |
| **3** (days 9–14) | O1 W3d parry · O2 W3b/W3c goldens · O3 W5b → W5c · O4 W4b · O5 W6c sway + W8a yard | C1 W3b rows · C2 W3c move · C3 W6c rows → W6d · C4 W10a · C5 W9b rows |
| **4** (days 15–19) | O1 W7a tower · O2 W8b climb · O3 W10b course · O4 W9b placing · O5 W11b SFX wiring | C1 W7a rows → W7b · C2 W11a migrations tail · C3 W6d migrations · C4 spare (fixes) · C5 W12 prep |
| **5** (days 20–22) | all: W12 proofs, looks, fixes | W12 checks, docs (W21's west half) |

**Critical path:** W0a → W0b → (W6a on its own from day 1) → W6c → W6d → W7a → W7b → W9b → W12, about 19–22 working
days. **About four and a half weeks** at 5 + 5 with slack for review; the total effort alone (810 h over 10 lanes) is
about two weeks, so the order, not the lanes, sets the pace.

Never run together: W2a and W2b (same save files), W3b and W3c (same `held.ts` dispatch), W6a and W6c (the chain kind),
W1b and W3d / W5b (shared HUD pieces: one E332 notice each, in turn).

## What the research changed from the old rows

1. **The grid slot.** The showcase's hologram plot is `open-plot-showcase-template` at cell **[−1,−1]**
   (`open-plot-sw`), not (0,2); and G972 forbids a Developer-only cell, so the swap is a public change (W0a, W12).
2. **The decision-module cap.** Products admit **at most nine** decision modules (`test/decision-module-cap.test.ts`,
   D59). The west needs about seven, the east far more: it must be raised (W0e).
3. **Courses don't exist in the world.** Nalati's riding and Nine's grapple "courses" are Explore-hub playgrounds at
   **y 3000**, dev rooms; their bests are never saved. The old W8 ("docs and a template example") missed that the
   in-world course host is new work (W6d); the playgrounds are exempt from the cube rule as dev tools (W0e).
4. **Ladders are not shared.** Ladder rows exist but no shipped shard uses them; the showcase is the first user (W8a).
5. **A hidden gate.** Zipline, updraft, ride and grapple rows are refused unless the product declares a quest-host page
   (`format/shardSchema.ts:285`, `runtimeBinds.ts:43`); harmless for the showcase, an accident to remove (W7a).
6. **The board stays in the engine.** Its motor law is a movement mode like swimming; only its look is a Wildshard prop
   to move (W5a, correcting W14 / HA4d).
7. **Sky Reach has no rope bridges.** Its bridges are winch and interact movers; M6.2 is dropped (W6c).
8. **The exchange fails host-bar test 6** (`{owner, path}` calls) and the trader runs on the plugin context (W2b);
   `OWNED` and `ItemId` are closed unions of Driftwood and Pine ids in the game layer (W2a).
9. **Grapple approvals are done** (G478; the old W10 is mostly a second user). **Day clock rows already exist**;
   `world/days` and `world/weather` are empty shells in every product (W11a). **The plate puzzle is already data**,
   shipped three ways (W4a). **Dummies and a weapon loan** already exist in the engine's practice room (W3a).
   **Driftwood's finds `glass` / `next` rows** already are "every N → a perk" (W9b).
10. **Pine's questRuntime** is mostly the lodge contract board, so it moves with the contract board in the east (E1),
    not in the west (W1b Q5).
11. **No parry exists**, and the touch HUD has no guard input: parry needs a HUD pick (W3d).

## The questions that matter most (one recommendation each; all questions are in the slice files)

1. **Decision-module cap** (W0e Q2): raise 9 → 32 per product. *Recommended: yes.*
2. **The range loan** (W3a Q1): the range lends every weapon inside its fence. *Recommended: yes, try before you buy.*
3. **World geometry and look** (W0a Q1, Q3): one Blender script for the cell, toon look. *Recommended: yes.*
4. **The grid swap** (W0a Q2, W12 Q1): out of the grid while built; swap [−1,−1] only after the east is done.
5. **A west tour quest** (W1b Q1): "Shift Orientation", no reward. *Recommended: yes, the only way to check the quest
   path in the west.*
6. **A Developer "Give 1,000 Scrip" row** (W2b Q1) until E1 pays. *Recommended: yes.*
7. **Parry on touch** (W3d Q1): a GUARD button shown only with a parry weapon. *Recommended: yes, board first.*
8. **The halfpipe and ramp heights** (W5a Q1, Q2): launch walls, not vert; kickers 2.4 / 3.6 / 4.8 m.
9. **The grapple from arrival** (W7a Q1) and **decoupling traversal rows from the quest page** (W7a Q2).
   *Recommended: both yes.*
10. **Calibration Chips and caches** (W9b Q1, Q2): chips are toy perks (+5 % board and reel speed), caches give
    cosmetics. *Recommended: yes, the west still pays nothing.*

Also asked: per-shard currency (W2a Q1), Explore playgrounds exempt from the cube (W0e Q1), personal bests per shard
(W3a Q2), storm frequency (W11a Q1), grind rails at all (W5c Q1), Sky's bridges left as movers (W6c Q1), Pine's
questRuntime in E1 (W1b Q5).
