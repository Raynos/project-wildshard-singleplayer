# SIGNAL-DUNES — shard 5's full content (E374)

**State:** `in progress` 2026-10-01 — C1–C7 built (a thin slice of content, by design); Jake judged the look and feel far below the mockups and the other shards, so the polish loop P1–P6 runs now: a review, then a fresh Opus builder looping on four hero scenes, hands/weapon and the quest flow. No new content.

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

## Polish loop (Jake, 2026-10-01)

Jake, 2026-10-01, after playing both on his iPhone: "they look absolutely nothing like the mock-up … an incredibly half-assed implementation … I'm not asking for more content … I'm asking you to fix the presentation and feel of the world as is and to make sure that the quest is planned … look at the Driftwood quest … quest icons on the mini map … we need to do 10x 100x better". Also: flyers must be lockable, with a more generous lock range (engine, sol-lock).

| Row | What | State |
|---|---|---|
| P1 | **Review**: a deep, ranked review of why the shard looks nothing like its mockups and nothing like Nalati / Nine Dragon / Pine Hollow: graphics, lighting and palette, materials, models, composition, sky, effects, first-person hands and weapon, HUD use, and the quest flow against Driftwood's (an NPC who starts it, quest markers on the minimap and world, step guidance). Output: `docs/design/sunscar-dunes/review-2026-10-01.md` with a TOP-N routed to owners (shard vs engine) | open |
| P2 | **Four hero scenes** chosen from the review; each gets the LOOK-LOOP (`docs/design/LOOK-LOOP.md`): 9 fixed angles (3×3), image-model targets edited from the captures (keeping camera and HUD), a gap list, ΔE00 per palette region, fixes, re-shoot; loop until each 3×3 reads like its target | open |
| P3 | **Hands and weapon** in the Practice Arena: mockups of how the hands and weapon should look, feel and move (idle, attack, heavy, special), then loop the viewmodel against them | open |
| P4 | **Quest planned like Driftwood's**: a start (an NPC or a found object that names the goal), each step marked on the minimap and in the world, clear prompts, a reward beat; the existing steps re-staged, no new content | open |
| P5 | **Presentation pass**: title card and Explore hero images from the finished hero scenes; loading card; first-minute framing from the spawn | open |
| P6 | **Jake plays it**: a board per loop round and a final 3×3 per hero scene for his sign-off | open |
