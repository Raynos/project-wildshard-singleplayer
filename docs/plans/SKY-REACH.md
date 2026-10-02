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
