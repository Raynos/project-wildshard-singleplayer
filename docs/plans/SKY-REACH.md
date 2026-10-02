# SKY-REACH — shard 6's full content (E374)

**State:** `in progress` 2026-10-02 — C1–C7 built; polish loops 1–3 landed (subagents); from 2026-10-02 the top-level Claude Opus agent `sky-reach` (herdr, Remote Control on; docs/process/SHARD-AGENT-BRIEF.md) loops on P2–P5 and P8; done = P7, two council rounds judging it against the other four shards (the lead runs them). Jake is asleep: no questions.

Shard 6, slug `far-reach`, Jake's pick **B · Sky Reach** (E364): floating islands above the clouds at golden hour, a
war fan (SWING slashes, GUST blows creatures back and off edges), a flying manta; Jake's rule: **some bridges are
hoverboard-only — on foot you fall through**. Baseline HUD only. Look reference:
`art/far-reach/round-2-build/board-8dbba343.jpg` (Jake: the look stands).

## Scope
In: an archipelago worth crossing (7–9 islands at different heights), rope bridges and hover bridges, 3 creatures, a
quest chain, a boss, a handful of generated models, the fan's full move set, falling as the danger. Out: music and SFX
(silent or kit ambience; no new audio generation), NPC dialogue trees, Driftwood-level density. Phone tier first: 30 fps
hot on the iPhone 17 Pro, the shard's own budgets.

## Rows
| Row | What | State |
|---|---|---|
| 0 | E357 Z3 round 2: a clean-room agent rebuilds the shard from `docs/SHARDS.md`, the template and `docs/ENGINE.md` alone; zero engine edits, API gaps go to the lead | open |
| C1 | **World**: 7–9 islands (home isle, the windmill isle, the roost, the broken bridge isle, a ruin isle, the storm crown for the boss), rope bridges + hover-only bridges (S6-1: a hover deck starts clear of any rim, so on foot you drop straight through), updrafts that lift a hoverboard, the cloud sea below (G3 kill height) | open |
| C2 | **Creatures**: the drift manta (flyer), sky goats (island walkers, GUST-able off edges), a gale wisp (small flyer that pushes the player) — own brains, telegraphs, deaths (falls count) | open |
| C3 | **Fan**: SWING (light), a charged sweep (heavy), GUST (push; G3 impulse), the fan away while riding the board (S6-3); touch on the baseline discs, SWING label (G5) | open |
| C4 | **Quests**: "Raise the fallen bridge to the windmill island" becomes a 4-step chain: find the bridge-keeper's notes → clear the roost of mantas → turn three wind vanes (GUST them) → raise the bridge to the storm crown | open |
| C5 | **Boss**: the Storm Roc on the storm crown — 3 phases (gust walls that push you to the edge, diving strikes, grounded on the crown's last platform), the shared BossBar, a reward | open |
| C6 | **Models**: 4–6 generated or Blender models (the windmill, a rope bridge kit, wind vanes, the manta, the Roc) under the model lock; the rest procedural | open |
| C7 | **Boards for Jake**: a look + play board after C1–C3, a boss clip after C5; iPhone portrait | open |

## How it runs
**Opus 5.5 subagents only, never GPT-6.1 Sol / Codex** (Jake, 2026-10-01). One fresh Opus subagent per chunk (≤ 400k context, ≤ 90 min, ~200 turns), each reading the last Handoff in
`docs/tasks/asks/E374.md`. A subagent never edits `src/engine`, `src/game`, `src/kit`, `lint`, `.github` or `scripts`:
it asks the lead (SendMessage to the main session) for a public-API change, which the lead builds and lands. Commits stay
inside the shard's lock allowlist (`.github/lock.json` reopened `far-reach`), pathspec only; the lead pushes.

## Polish loop (Jake, 2026-10-01)

Jake, 2026-10-01, after playing both on his iPhone: "they look absolutely nothing like the mock-up … an incredibly half-assed implementation … I'm not asking for more content … I'm asking you to fix the presentation and feel of the world as is and to make sure that the quest is planned … look at the Driftwood quest … quest icons on the mini map … we need to do 10x 100x better". Also: flyers must be lockable, with a more generous lock range (engine, sol-lock).

| Row | What | State |
|---|---|---|
| P1 | **Review**: a deep, ranked review of why the shard looks nothing like its mockups and nothing like Nalati / Nine Dragon / Pine Hollow: graphics, lighting and palette, materials, models, composition, sky, effects, first-person hands and weapon, HUD use, and the quest flow against Driftwood's (an NPC who starts it, quest markers on the minimap and world, step guidance). Output: `docs/design/far-reach/review-2026-10-01.md` with a TOP-N routed to owners (shard vs engine) | open |
| P2 | **Four hero scenes** chosen from the review; each gets the LOOK-LOOP (`docs/design/LOOK-LOOP.md`): 9 fixed angles (3×3), image-model targets edited from the captures (keeping camera and HUD), a gap list, ΔE00 per palette region, fixes, re-shoot; loop until each 3×3 reads like its target | open |
| P3 | **Hands and weapon** in the Practice Arena: mockups of how the hands and weapon should look, feel and move (idle, attack, heavy, special), then loop the viewmodel against them | open |
| P4 | **Quest planned like Driftwood's**: a start (an NPC or a found object that names the goal), each step marked on the minimap and in the world, clear prompts, a reward beat; the existing steps re-staged, no new content | open |
| P5 | **Presentation pass**: title card and Explore hero images from the finished hero scenes; loading card; first-minute framing from the spawn | open |
| P6 | **Jake plays it**: a board per loop round and a final 3×3 per hero scene for his sign-off | open |
| P7 | **Done = two council rounds** (Jake 2026-10-02: "keep going autonomously until you're happy … have a council, do two rounds of reviewing it to see if it matches the quality of the other four shards"): `docs/plans/shard-polish-council/` (ledger, battery, brief, register). The builder loops on each round's findings; the shard is done when round 2's seats find it at the bar | open |
| P8 | **Progress photos, clips and time-lapses every loop** (E389): `scripts/shard-progress.mjs` + `scripts/shard-timelapse.py` → `progress/<slug>/` | in progress (the `sky-reach` agent) |

## Loop 5 gap list: council round 1 (seats B and C), form and subject first

The council (`docs/plans/shard-polish-council/round-1-seat-{B,C}.md`) judged the loop-4 capture (`4c39a774`) below the bar:
the loops tuned colour while the forms stayed primitive. Ordered: form and subject before colour (R1C-18). The *form and
subject* column asks the R1C-18 questions of each view: is the hero object in the centre third and lit, does its
silhouette match the target's, is every near and mid element the target shows present?

| # | Findings | Form and subject | Fix | State |
|---|---|---|---|---|
| 1 | R1B-1 | one sun, where the painting has it | hide the engine sun disc and halo (`sky.sun`), aim the key light at the painted sun (heading 351°, 4.3° up) | open |
| 2 | R1C-10, R1B-2 | the hover bridge reads as a built glass object, not a render bug | the bible's glass: one cyan emissive half-transparent slab, a solid glowing edge frame, end pylons; no slat banding | open |
| 3 | R1C-8, R1B-3 | the quest-giver waves inside the first frame; the chip names him with metres | keeper inside the ±18° portrait view, clear of the HOVER tab; "KEEPER n M" from the first frame | open |
| 4 | R1C-9 | islands are crags, not cones on a grid at one height | broken notched rims, craggy keels with spires and roots, rim rocks; centres off the grid and varied deck heights (sloped spans ≤ 40°, navmesh, walk routes via the lead) | open |
| 5 | R1C-11, R1B-2, R1B-4 | H2 / H3 each frame one built subject, nothing within 3 m of the camera | the mill moved off H3's sightline and rebuilt (white stone, slate cap, lattice + cloth sails: R1C-17); H2 aimed at the windmill (camera change: asked the lead) or the Roost + glass bridge as its subject; updraft streaks out of the view's centre at rest | open |
| 6 | R1C-11, R1B-5 | H4 frames the dais, several runed stones and the Roc | the ring round the dais at r 9.5 (3–4 stones in frame); the Roc in view (lower idle orbit) or the bar only once it is | open |
| 7 | R1B-7, R1C-12 | the playable land is the most finished thing in the frame | drop the bare 3-D skyline cones (the painted matte carries the far islands); crisp worn paths | open |
| 8 | R1B-6 | the minimap draws the land | a far-reach minimap painter: island discs, plank bridges solid, hover bridges dashed, the quest diamond | open |
| 9 | R1B-8, R1C-14 | the hand reads as a gloved hand with a bracer, above the buttons | a code glove with fingers on the grip, a tooled bracer, a wrapped sleeve; bronze ribs; the rest pose raised; a Practice Arena board | open |
| 10 | R1C-15, R1C-13 | grass reads as grass; the palette has its own hues (blue zenith, spring green, cyan glass) | three-segment tapered blades, a smaller nearest band, shade-green roots to gold tips (`#a9bb66`); the warm grade pulled off the zenith and grass | open |
| 11 | R1B-9, R1C-16 | the cards show the current shard | re-cut title / loading / Explore cards after 1–10 | open |
| 12 | R1B-10 | the boss fight is shown at the current look | a phase I–III Storm Roc clip at HEAD, iPhone portrait | open |
| 13 | R1B-11 | SWING and GUST carry icons like every other primary / verb | icons within the baseline HUD | open |
