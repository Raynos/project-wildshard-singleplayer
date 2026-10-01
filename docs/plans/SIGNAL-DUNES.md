# SIGNAL-DUNES — shard 5's full content (E374)

**State:** `in progress` 2026-10-01 — Jake approved the build-out (E374: "world, content, quests, boss, some models; skip music and SFX; not Driftwood level"). Step 0 (the E357 Z3 round-2 clean-room rebuild) runs first; content rows C1–C6 follow, one fresh subagent per chunk, each with a Handoff in E374.

Shard 5, slug `sunscar-dunes`, Jake's pick **C · Signal Dunes** (E363 round 2): realistic dusk dunes, an orange band under
indigo, first stars, cool blue hollows; a braided leather bullwhip; a ray-like flyer; "Light the signal fire". No
glass, no crystals, no mirrors, no glowing magic. Baseline HUD only. Look reference:
`art/sunscar-dunes/round-3-build/board-c2fdc72d.jpg` (Jake: the look stands).

## Scope
In: a world worth walking (≈ 400 × 400 m of dunes with 4–5 places), 3 creatures, a quest chain, a boss, a handful of
generated models, the whip's full move set. Out: music and SFX (the shard stays silent or reuses kit ambience; no new
audio generation), NPC dialogue trees, Driftwood-level density. Phone tier first: 30 fps hot on the iPhone 17 Pro,
the shard's own budgets.

## Rows
| Row | What | State |
|---|---|---|
| 0 | E357 Z3 round 2: a clean-room agent rebuilds the shard from `docs/SHARDS.md`, the template and `docs/ENGINE.md` alone; zero engine edits, API gaps go to the lead | open |
| C1 | **World**: the dune field graded for walking, 4–5 places (the spawn crest, a half-buried caravan, a dry well, the signal tower ridge, the boss basin), wind-cut ridges, a few rocks and scrub, the far horizon | open |
| C2 | **Creatures**: the dune ray (flyer, G2 flight), a sand skitterer (small, packs, burrows), a dune strider (large, slow, charges) — each with its own brain, telegraphs and death | open |
| C3 | **Whip**: light crack, heavy double crack, a pull (yank a small creature / a lever), a crack that lights a brazier; touch on the baseline discs | open |
| C4 | **Quests**: "Light the signal fire" becomes a 4-step chain: find the caravan's logbook → fetch oil from the dry well → light three braziers on the way → light the signal fire (which summons the boss) | open |
| C5 | **Boss**: the Dune Matriarch — a huge ray that rises from the basin at the fire's signal; 3 phases (sweeping dives, a sand-storm cover phase, grounded and whippable), the shared BossBar, a reward | open |
| C6 | **Models**: 4–6 generated or Blender models (the caravan wagon, the well, braziers, the tower, the strider, the Matriarch) under the model lock; the rest procedural | open |
| C7 | **Boards for Jake**: a look + play board after C1–C3, a boss clip after C5; iPhone portrait | open |

## How it runs
**Opus 5.5 subagents only, never GPT-6.1 Sol / Codex** (Jake, 2026-10-01). One fresh Opus subagent per chunk (≤ 400k context, ≤ 90 min, ~200 turns), each reading the last Handoff in
`docs/tasks/asks/E374.md`. A subagent never edits `src/engine`, `src/game`, `src/kit`, `lint`, `.github` or `scripts`:
it asks the lead (SendMessage to the main session) for a public-API change, which the lead builds and lands. Commits stay
inside the shard's lock allowlist (`.github/lock.json` reopened `sunscar-dunes`), pathspec only; the lead pushes.
