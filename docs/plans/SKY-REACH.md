# SKY-REACH — shard 6's full content (E374)

**State:** `in progress` 2026-10-01 — Jake approved the build-out (E374: "world, content, quests, boss, some models; skip music and SFX; not Driftwood level"). Step 0 (the E357 Z3 round-2 clean-room rebuild) runs first; content rows C1–C6 follow, one fresh subagent per chunk, each with a Handoff in E374.

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
