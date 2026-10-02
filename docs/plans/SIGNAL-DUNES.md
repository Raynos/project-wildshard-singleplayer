# SIGNAL-DUNES — shard 5's full content (E374)

**State:** `in progress` 2026-10-02 — C1–C7 built; polish loops 1–4 and the council's round-1 fixes landed (the `signal-dunes` top-level Opus agent, docs/process/SHARD-AGENT-BRIEF.md); round 1 judged it below the bar (forms, subjects, the arrival hit); every Signal Dunes must-fix is in (`12af466e`); round 2, the last, waits on the lead.

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
| 0 | E357 Z3 round 2: a clean-room agent rebuilds the shard from `docs/SHARDS.md`, the template and `docs/ENGINE.md` alone; zero engine edits, API gaps go to the lead | done (round-4 rebuild `53ce5156`, E363) |
| C1 | **World**: the dune field graded for walking, 4–5 places (the spawn crest, a half-buried caravan, a dry well, the signal tower ridge, the boss basin), wind-cut ridges, a few rocks and scrub, the far horizon | done (C1 agent; places, ridges, dressing in loop 4 `28d5ce4e`) |
| C2 | **Creatures**: the dune ray (flyer, G2 flight), a sand skitterer (small, packs, burrows), a dune strider (large, slow, charges) — each with its own brain, telegraphs and death | done (ray, skitterer packs, striders; the ray is the generated manta since `12af466e`) |
| C3 | **Whip**: light crack, heavy double crack, a pull (yank a small creature / a lever), a crack that lights a brazier; touch on the baseline discs | done (light, heavy double crack, pull, brazier crack; arena board `be2f6b36`) |
| C4 | **Quests**: "Light the signal fire" becomes a 4-step chain: find the caravan's logbook → fetch oil from the dry well → light three braziers on the way → light the signal fire (which summons the boss) | done (six steps from Sefa to the Matriarch; Driftwood-style start since loop 2) |
| C5 | **Boss**: the Dune Matriarch — a huge ray that rises from the basin at the fire's signal; 3 phases (sweeping dives, a sand-storm cover phase, grounded and whippable), the shared BossBar, a reward | done (three phases; the storm fog E390 `ddd4c53d`; clip `art/sunscar-dunes/round-14-council-r1/boss-3-phase.mp4`) |
| C6 | **Models**: 4–6 generated or Blender models (the caravan wagon, the well, braziers, the tower, the strider, the Matriarch) under the model lock; the rest procedural | done (caravan, well, brazier, glove, Matriarch, scout: Hunyuan3D-2) |
| C7 | **Boards for Jake**: a look + play board after C1–C3, a boss clip after C5; iPhone portrait | done (play board round 6, boss clip round 6, refreshed in round 14) |

## How it runs
**Claude Opus only, never GPT-6.1 Sol / Codex** (Jake, 2026-10-01). Since 2026-10-02 one top-level Opus agent (`signal-dunes`, docs/process/SHARD-AGENT-BRIEF.md) builds it, engine requests to the lead over herdr; before that, fresh Opus subagents per chunk, each reading the last Handoff in
`docs/tasks/asks/E374.md`. A subagent never edits `src/engine`, `src/game`, `src/kit`, `lint`, `.github` or `scripts`:
it asks the lead (SendMessage to the main session) for a public-API change, which the lead builds and lands. Commits stay
inside the shard's lock allowlist (`.github/lock.json` reopened `sunscar-dunes`), pathspec only; the lead pushes.

## Polish loop (Jake, 2026-10-01)

Jake, 2026-10-01, after playing both on his iPhone: "they look absolutely nothing like the mock-up … an incredibly half-assed implementation … I'm not asking for more content … I'm asking you to fix the presentation and feel of the world as is and to make sure that the quest is planned … look at the Driftwood quest … quest icons on the mini map … we need to do 10x 100x better". Also: flyers must be lockable, with a more generous lock range (engine, sol-lock).

| Row | What | State |
|---|---|---|
| P1 | **Review**: a deep, ranked review of why the shard looks nothing like its mockups and nothing like Nalati / Nine Dragon / Pine Hollow: graphics, lighting and palette, materials, models, composition, sky, effects, first-person hands and weapon, HUD use, and the quest flow against Driftwood's (an NPC who starts it, quest markers on the minimap and world, step guidance). Output: `docs/design/sunscar-dunes/review-2026-10-01.md` with a TOP-N routed to owners (shard vs engine) | done (`docs/design/sunscar-dunes/review-2026-10-01.md`) |
| P2 | **Four hero scenes** chosen from the review; each gets the LOOK-LOOP (`docs/design/LOOK-LOOP.md`): 9 fixed angles (3×3), image-model targets edited from the captures (keeping camera and HUD), a gap list, ΔE00 per palette region, fixes, re-shoot; loop until each 3×3 reads like its target | in progress (loops 1-4, council round-1 fixes; the four hero views re-aimed on their subjects) |
| P3 | **Hands and weapon** in the Practice Arena: mockups of how the hands and weapon should look, feel and move (idle, attack, heavy, special), then loop the viewmodel against them | in progress (rest pose, rim, coil; `art/sunscar-dunes/round-14-council-r1/whip-arena.jpg`) |
| P4 | **Quest planned like Driftwood's**: a start (an NPC or a found object that names the goal), each step marked on the minimap and in the world, clear prompts, a reward beat; the existing steps re-staged, no new content | done (Sefa names the goal, chip, minimap / world markers, reward beat; R1C-7 in `12af466e`) |
| P5 | **Presentation pass**: title card and Explore hero images from the finished hero scenes; loading card; first-minute framing from the spawn | done (cards from the scenes `a3368824`, re-cut `2c917ef7`) |
| P6 | **Jake plays it**: a board per loop round and a final 3×3 per hero scene for his sign-off | open (Jake, after the council) |
| P7 | **Done = two council rounds** (Jake 2026-10-02: "keep going autonomously until you're happy … have a council, do two rounds of reviewing it to see if it matches the quality of the other four shards"): `docs/plans/shard-polish-council/` (ledger, battery, brief, register). The builder loops on each round's findings; the shard is done when round 2's seats find it at the bar | in progress (round 1 judged `eaeb401f`: below the bar; fixes landed; round 2 next) |
| P8 | **Progress photos, clips and time-lapses every loop** (E389): `scripts/shard-progress.mjs` + `scripts/shard-timelapse.py` → `progress/<slug>/` | in progress (the `signal-dunes` agent) |
