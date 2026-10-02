# Thin Ice: the frozen fjord, WorldClaw's pilot shard

**State:** `draft` 2026-10-01 — a plan only; the pilot of [WORLDCLAW-SHARD](WORLDCLAW-SHARD.md) (D74). GAME-NORMALIZATION is archived (2026-10-01); the rows start with WORLDCLAW-SHARD N0 on Jake's go, and TI0 waits for WorldClaw's N / F / X / E / T rows. Done: the fjord dry run's front, reviewed by Jake (pitch C · Thin Ice, "Aurora, kept simple", 18 concepts, map A revision 2, 11 first-person views, content rounds 1–2: `worldclaw@aebb69d8:prototypes/worldclaw/front/`). The slug is `thin-ice` (Jake). Open: the wave-2 view fixes (redone at the real P6); Jake's go with WORLDCLAW-SHARD's ("Not yet, I'll review the pages"). Page: [Thin Ice](https://claude.ai/artifact/1v5EE7bt75m3dGFAkVh7P1) (the plan and the dry run). On `main` since 2026-10-01 (merged from branch `worldclaw`; the prototypes and the review copies at the local tag `worldclaw-archive`, D76).

## 0. Why

Jake (2026-10-01), after the dry run: "I'm not going to put this much effort into a dry run and then not build the
shard. Whatever this ice shard is, we're going to eventually build it." → "Yes, Thin Ice is the pilot."

The vision (P1): "a frozen fjord where you are the last ferryman". The pick (P2): **C · Thin Ice**: "The ferry is gone
and the fjord has frozen. Race the ice on a sled-board, fast and fragile, and find the village that drowned beneath it."

## 1. The shard on one page

| | |
|---|---|
| **Pillars** | moment: skating over clear black ice and seeing the drowned roofs below · session: chart a new route across the ice · return (note): new cracks each visit |
| **Look** | **Aurora, kept simple** (the easiest to build that Jake likes): clean faceted stylized 3D, matte materials, an animated aurora sky that tints the light, one moon light, ≤ 6 real lamps (windows emissive), one see-through ice surface over a dim low-detail drowned village (only around the spire), bloom only, height fog. Palette: night navy `#0b1626`, ice teal `#2fb7a8`, aurora green `#4cf2a0`, magenta accents `#c04cf2`, snow `#e8f1f5`, timber `#5b3a26`, window amber `#f2a640` (`design/style-bible.md`) |
| **Map** | A revision 2: a straight fjord north → south, a frozen bay in the middle with open dark water at both mouths; the four edge exits (N, E, S, W) gated; spawn on land at South Landing; the village on the south-west shore; the quarry a terraced pit; a glacier tongue in the north-east; the lighthouse on its rock point at the north mouth |
| **Verb and tools** | walk; **the rope grab** (the only safe way over unlit ice); **the sled-board** (fast, rides lit lanes only); the kit hoverboard is refused on ice |
| **Weapon** | the harpoon (light jab, heavy throw-and-reel) |
| **Enemies (sparse)** | ice crawlers (the quarry pit, glacier crevasses), the crawler queen (mini boss), ice bears (the forests); few pockets: the content is traversal and discovery (D73) |
| **Boss** | the Bellkeeper, a huge armoured eel asleep under the ice round the cathedral-scale drowned spire (~40 m); ringing the drowned bell summons it; the arena is a ~60 m ring of cracked ice, the lit lanes safe ground |
| **Structure** | **C · lights open the ice**: three beacons, each lighting a lane and a region (south → north-east → west), then the centre lane to the spire |
| **Unsafe ice** | thin-ice cracks (Jake): unlit ice is walkable but starts a crack timer; ~3 s → fall through → respawn at the last safe point; lantern radii and lit lanes are safe; a beacon flips its lane to safe |

**Places** (map A revision 2; x east, z south, metres from the centre):

| # | Place | Role | Where |
|---|---|---|---|
| 1 | South Landing | spawn | (−70, 215), the stone plaza and the spawn beacon |
| 2 | Ferryman's Village | hub | (−40, 110): a main street to the pier, the square and well, Sigrun's lantern house, the trader, the ferry winch |
| 3 | The Lighthouse | landmark, beacon 3 | (−11, −214), on its rock point by a causeway; a spiral stair to the gallery |
| 4 | The Old Quarry | arena | (−150, 120), a terraced pit with a ramp and a crane |
| 5 | The Drowned Spire | boss | (37, −43), cathedral scale, the drowned village around it under the ice |
| 6 | The Ice Cave | secret | (−170, −60), a big cave mouth in the west cliffs; the frozen chapel |
| 7 | Cliff Overlook | vista, survey | (200, −20), the cairn and bench |
| 8 | The Bay Run | traversal | the lit sled lanes across the bay |
| 9 | Signal Tower | objective, beacon 1 | (175, 60), timber, on the east headland |
| 10 | Glacier Mouth | objective, beacon 2 | (140, −110): the ice cliff; the switchback trail and rope ladders up; the cairn fire on top |
| 11 | Hot Spring | camp | (−200, −190), the steaming pool and the hunter's camp |

## 2. Content (P5b round 2, Jake: "looks reasonable to me. It's like a start")

**The main quest, "The Drowned Bell":**

| # | Step | Why / what | Gets |
|---|---|---|---|
| 1 | South Landing | arrive at the spawn beacon; a lantern burns in the village | |
| 2 | Ferryman's Village | Sigrun, the last lamp-keeper: the ice took the ferry, the bell tolls each night and the ice cracks more; the old beacons kept the lanes safe. She hands you the harpoon (an NPC moment) | the harpoon |
| 3 | The Old Quarry | the beacon oil is stored in the pit; crawlers nest there. The first fight | lamp oil |
| 4 | The Old Ferry Line | grab the ferry rope (GRAB / LET GO on the attack disc) and haul across unlit ice | |
| 5 | Signal Tower · beacon 1 | relight the brazier: the south lane glows | the sled-board |
| 6 | Cliff Overlook | survey: the two dark beacons, the spire and the frozen ferry wreck are marked on the map | |
| 7 | Glacier Mouth | climb onto the glacier: the trail, rope ladders, crevasses | |
| 8 | The glacier beacon · beacon 2 | the crawler queen guards the clapper in a crevasse; light the cairn fire: the north-east lane glows | the clapper |
| 9 | The Lighthouse · beacon 3 | sled the lane, climb the spiral stair, relight the lamp: the west lane glows; the beam shows the drowned streets | |
| 10 | The Ice Cave | the frozen chapel | the bell rope |
| 11 | The Drowned Spire | the centre lane opens; ring the bell; the Bellkeeper breaks the ice. Boss fight | |
| 12 | Home | the bell is silent, the ice holds; Sigrun lights the ferry lantern at dawn | |

**Side content:** S1 the hunter at the hot spring (3 crawler shells → a fur cloak: slower cold on the ice); S2 the
lost ferry under the north mouth (seen only in the lighthouse beam → the ferryman's lantern, wider light); S3 the
quarry ledger (how the church was drowned for its stone). **Feats:** the bay run under 60 s; all three beacons without
falling through; 20 crawlers. **Secrets:** 8 drowned keepsakes round the spire (lit only by the beam); a cache under the
overlook. **Happenings:** the bell tolls at night (rings of cracks from the spire); a crack races across the bay.

**The session slice (P9, ~14 min):** South Landing → the village (Sigrun, the harpoon) → the quarry (fight, oil) → the
ferry line → the signal tower (beacon 1, the sled-board) → the bay run back to the pier.

## 3. Mechanics and engine needs (D73)

| Mechanic | Where | Engine / kit today | Row |
|---|---|---|---|
| The harpoon (weapon) | 2–11 | new | TI-W1 |
| Ice crawlers + the crawler queen | 3, 8 | new species + an elite | TI-C1, TI-C2 |
| Ice bears | forests | the kit bear, restyled (E6) | TI-C3 |
| The Bellkeeper: asleep, summoned, breaches the ice, the ring arena | 11 | a new boss + a summon | TI-C4 |
| **The NPC moment**: a scripted gesture, the camera holds, an item lands in your hands | 2, 12 | new, engine-wide (every shard reuses it) | TI-E1 |
| **Thin ice**: the mask, the crack timer, fall-through and respawn | the bay | new | TI-E2 |
| **The rope grab**: attach to a rope line, move along it, safe over thin ice | 4 | the attack-disc relabel exists (E357 G5 `6eeca4e3`); the traverse is new (close to the kit zipline, E9) | TI-E3 |
| **A tool refused on a surface** (the hoverboard on ice, with a message) | everywhere on ice | new rule | TI-E4 |
| **Beacons light lanes**: a world-state flag lights a lane's lanterns and flips its thin-ice cells to safe | 5, 8, 9 | new | TI-E5 |
| **The sled-board**: fast, lit lanes only | 5 → | new tool (the hoverboard's controls) | TI-E6 |
| **The survey**: marks map and minimap pins | 6 | new | TI-E7 |
| Rope ladders / the climb | 7 | new | TI-E8 |
| **The lighthouse beam reveal** (the drowned streets, the keepsakes, the lost ferry) | 9 | new | TI-E9 |
| The aurora sky shader; the see-through ice over the drowned village | everywhere | new look pieces (P10) | TI-L1 |

## 4. What carries over from the dry run (inspirational, D72)

The dry run's design docs are in [thin-ice/dry-run/](thin-ice/dry-run/): `design.md` (the verdict log and every note),
`style-bible.md`, `p2-pitches.md`, `content_c.py` (the quest data). Its original images are in `art/thin-ice/`, by stage
(the approved map's blockout renders and data in `round-6-map-revision-2/blockout/`); its scripts and the review copies
are at the tag `worldclaw-archive`. The grey world (P8) is the source of truth for space; the images are references.

**Wave-2 notes still open** (redone at the real P6 on the built tools): the village view flipped the lighthouse; the
lighthouse's spiral stair; a bigger cathedral spire as the arena; the glacier climb; a bigger hot spring.

### 4.1 The images: what Thin Ice's draft keeps (Jake: "I'll keep those for now")

Moved at the merge (2026-10-01, D76): the originals are in `art/thin-ice/`; the copies stayed at the tag. The ~200 MB is two
halves:

- **Originals, ~100 MB:** the pictures codex (or Blender) made. Every one is a decision's evidence, so Thin Ice's
  draft keeps them all, rejected options included, so the history of each pick stays readable. At the merge they go to
  `art/thin-ice/round-<n>-<stage>/` (the art rule), and the drafts site shows them through the Atlas (W2 makes the phone
  copies).
- **Copies, ~100 MB:** what code made from the originals for review: the title strips, the boards, the numbered maps,
  the minimap tiles, the sets sent to chat. Nothing in them is new; the tools (T11, T19, T20) re-make any of them from the
  originals. They stay at the `worldclaw-archive` tag, off `main`.

| Stage | Originals (→ `art/thin-ice/`) | MB | Verdict | Copies (stay at the tag) | MB |
|---|---|---|---|---|---|
| P2 pitches | `p2-{a,b,c}-*` (3) | 1.8 | C picked | `p2-board` | in boards |
| P3 directions | `p3-{ink,glass,sodium}-*` (12) | 8.5 | glass → kept simple | the three boards | in boards |
| P3 the pick | `p3s-aurora-*` (4), `p3m-*` in-game (2) | 2.6 | approved | `p3s-aurora-board` | in boards |
| P4 concepts | `p4-*` (18) | 7.9 | all approved | `p4-board-1…5` | in boards |
| P5 wave 1 | `p5-map-{a,b,c}` (one layout, 3), `p5-map2-{b,c}` (2), `p5w2-*` B / C views (6), `p5w-*` A from 8 angles (8) | 13.4 | A | `wave1/`, `p5-var-*`, numbered / labelled maps | 6.2 + 4.2 + 7.9 |
| P5 revision 1 | `p5b-*` painted over the blockout (10: "lost all of the graphical fidelity"), `p5c-*` repainted (9: the 8 reviewed) | 11.2 | notes → rev 2 | `wave1b/`, `wave1c/`, `p5-rev-*` | 3.3 + 4.9 |
| P5 revision 2 | `p5r2-map`, `p5r2-3in1` (2) + `blockout/` (the map's data, 7.3) | 9.0 | **approved** | `rev2/`, `p5r2-map-numbered` | 1.4 |
| P6 try 1 | `p6-*` (11, before the two waves) | 4.9 | superseded | `titled/`, `p6-board-*` | 3.7 |
| P6 wave 2 | `w2-*` (11) | 5.5 | reviewed, notes open | `wave2/` | 4.8 |
| P5b content | `content-*` (5), `steps/step*` wildcards (36; round 2 replaced some round-1 ones, which come back from commit `c6a2d015`) | 20.4 | "It's like a start" | `send/`, `send2/`, `steps/board-*`, `steps/mm-*` | 14.4 + 12.2 + 14.3 + 12.1 |
| References | `refs/` (the live HUD capture and others) | 3.0 | — | — | — |

Not Thin Ice's: the tool mockups (16, 7.4 MB) are in `art/worldclaw-tools/round-1-draft-and-explorers/` (WORLDCLAW-TOOLS), and the early
prototypes' images are in `art/worldclaw/round-1-prototypes/` as WORLDCLAW-SHARD §10's evidence.

## 5. Rows (after GAME-NORMALIZATION is archived and WorldClaw's tool rows land)

| Row | What | Done when | State |
|---|---|---|---|
| TI0 | **Re-run the front on the built tools** (WORLDCLAW-SHARD P0–P6 with `worldclaw-interactive`): P0; P1–P4 carried over and re-confirmed; P5 the map with T19 on the real spec; P5b the content boards with T20; P6 the views on the real cameras, fixing the wave-2 notes | Jake's GO on the views | todo |
| TI-W1 | The harpoon: light jab, heavy throw-and-reel, its model (mockup-to-model) and SFX | the weapon passes the kit weapon tests | todo |
| TI-C1 … C4 | The crawlers, the queen (elite), the restyled bears, the Bellkeeper (asleep → summoned → breach → phases) on EncounterService | T16 beats the queen and the boss by real strikes | todo |
| TI-E1 | The NPC moment (engine-wide; with the other-shards proof) | Sigrun hands over the harpoon in first person; a second shard can reuse it | todo |
| TI-E2 … E9 | Thin ice, the rope grab, the surface rule, beacons → lanes, the sled-board, the survey, ladders, the beam reveal | each has a headless test (walk / leg tests, T16 steps) | todo |
| TI-L1 | The aurora sky shader and the see-through ice (phone tier) | within R28's budget at every place's 9 poses | todo |
| TI-P8 … P17 | WORLDCLAW-SHARD P8 → P17 on Thin Ice | WORLDCLAW-SHARD's Done-when 1–2 | todo |

## 6. Order and size

1. WORLDCLAW-SHARD §5 steps 1–5 (the tools), then **TI0** (the front on the built tools).
2. TI-E3 and TI-E6 (the rope grab and the sled-board, the new verbs) in grey, then **P7** (Jake plays them, ≤ 10 min).
3. TI-E2, E4, E5 (thin ice, the surface rule, the beacons): the slice needs them. Then TI-W1, TI-C1, TI-E1, and the
   **grey logic** of everything P8 needs: the queen (TI-C2) and the Bellkeeper (TI-C4) as grey rows with their phases, the
   survey (TI-E7), ladders (TI-E8) and the beam (TI-E9) working in grey.
4. P8 → P9 (the slice) → P9b; then the final models and look of the crawlers, the queen, the boss and the mechanics, and
   TI-L1, with P10 → P15; P16 → P17.

**Size on top of WORLDCLAW-SHARD's base:** a custom weapon +2–4; new species and an elite +2–4; the boss +2–3; the
mechanics ≈ +8–14 (the NPC moment ~2, thin ice ~1, the rope grab ~1, the surface rule ~0.5, beacons and lanes ~1.5,
the sled ~1, the survey ~0.5, ladders ~1, the beam ~1); the look pieces +1–2. **≈ +15–27 agent-days.**

## 7. Questions for Jake

Answered 2026-10-01:
1. **The slug:** `thin-ice` (Jake), over the rule's "last-ferryman": `src/shards/thin-ice/`.
2. **Where the content boards sit:** P5b, after the map and before the first-person views (WORLDCLAW-SHARD D75).

Open (Jake re-reviews all three plans):
3. **Jake's go** on this plan, with WORLDCLAW-SHARD's: "Not yet, I'll review the pages".
4. **TI0's scope.** As written, TI0 re-runs the whole front on the built tools. *Recommended: keep every approved pick
   (the pitch, the look, the concepts, map revision 2, content round 2); check the map against the real spec (T1's
   twin-check) and redraw only the first-person views with the wave-2 notes (the lighthouse flip, the stair, a bigger
   spire and spring, the glacier climb, the minimap by code, lanes on the ice). Saves ~2 days.*

## 8. Risks

| Risk | Mitigation |
|---|---|
| See-through ice with a drowned village under it costs draws and memory on the phone | the village only around the spire, low detail, fogged, no shadows; one ice surface; measured at P14 and the physical reading |
| Night readability (an aurora night, few real lights) | the aurora bright enough to read the ice; emissive windows; a readability check in the judges' look rubric |
| Thin-ice frustration (falling through) | a visible crack warning, ~3 s grace, respawn at the last safe point, lanterns and the rope as clear safe lines |
| Sparse enemies feel empty | traversal, beacons and discovery carry the pacing; the slice gate (P9) tests it on Jake's phone |
