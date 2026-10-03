# WorldClaw: study, audit and our version (E359)

Branch `worldclaw` (worktree `~/projects/games/wildshard-worldclaw`, from tag `pre-normalization` = `dcd6a29a`, the
parent of GAME-NORMALIZATION F0 and the build production serves). Never pushed; Jake merges.

| Doc | What it holds |
|---|---|
| [01-paper.md](01-paper.md) | The paper studied in full: every stage, equation, figure, skill name, loop budget, the implementation list, results, limitations, conclusion and related work, plus what the paper never reports |
| [02-site-and-repo.md](02-site-and-repo.md) | The GitHub repo (`main` and the `web` branch, which is the site's source), every issue, the project page's data (asset notes, the Sketchfab attributions, 11 worlds), the 91-s reel second by second, and the audit verdict |
| [03-our-primitives.md](03-our-primitives.md) | What a Wildshard shard is made of (a level; models, placements, Sets and World; the Explorers; the shard contract; budgets), and where each WorldClaw piece lands |
| [04-our-pipeline.md](04-our-pipeline.md) | The build techniques: the design (`design.md`) first, the spec, layout, terrain, look, catalog, places, judges, budgets, content slots, loops, tools, cost, failure modes (the flow in 06 and the plan's ledger D1–D74 / R1–R33 override it where they differ) |
| [06-shard-flow.md](06-shard-flow.md) | **The flow** (read this after the README): start questions, the visual front (vision, pitches, art direction + style bible, concepts, the map in two waves from a 3D blockout, the content boards, first-person views), the two play gates in grey, the build with the detail budget, the judges and Jake's fun rules, the final board and the first walk as the slop score, zero-shot, and how it fits the director loop |
| [05-techniques.md](05-techniques.md) | WorldClaw's techniques against our organic shard building (Driftwood, Pine Hollow, Nalati, Nine Dragon), take / drop / decide-by-demo per technique, with the grill's decisions |

**Three plans** (Jake, 2026-10-01: "Workflow and the skills is the same plan. Tools and draft mode are the same plan.
And then the thin ice is a new plan"):
1. **The workflow and its skills:** [WORLDCLAW-SHARD](../../plans/WORLDCLAW-SHARD.md). The skills are its S rows.
2. **The tools and Draft mode:** [WORLDCLAW-TOOLS](../../plans/WORLDCLAW-TOOLS.md) (Draft mode, the drafts site, the
   Explorers).
3. **The pilot shard:** [THIN-ICE](../../plans/THIN-ICE.md).

The three skills (D62, plan 1's S1 / S3) are
[worldclaw-interactive](../../../.claude/skills/worldclaw-interactive/SKILL.md) (guided: the front, the gates, a
checkpoint per place, polish; draft), [worldclaw-auto](../../../.claude/skills/worldclaw-auto/SKILL.md) (zero-shot,
the judges decide; draft) and [worldclaw-sketch](../../../.claude/skills/worldclaw-sketch/SKILL.md) (fast low-poly
rounds; outline).

## The answer in five lines

1. **WorldClaw is not a model.** It is Claude Opus 4.8 running task skills over GPT-Image-2, SAM3, SAM3D,
   Hunyuan3D and Blender 5.1.1 on 4 × H20. No code, weights or licence are released, and the Code button was removed
   before launch.
2. **The method is fully described and rebuildable here.** We have Claude Code, codex `image_gen`, TRELLIS.2,
   Hunyuan3D-2 / 2.1 and Blender 5.2.1. SAM3 / SAM3D (no MPS) are replaced by an isolated re-draw plus placement by a
   ray from the recorded camera through the physics query layer and the baked terrain (plan R3).
3. **Its bar is a pretty orbit render: dense dioramas, cliffs as walls, some stock vegetation.** A Wildshard shard is
   a fun standalone level, so our version starts from **`design.md`** (critical path, places with gameplay roles,
   routes, sightlines, arenas, content slots) and is judged **by walking it on the phone**.
4. **Everything it makes lands in our primitives.** Objects are `defineModel` models, regions are named places and
   Sets, terrain and scatter are World. It is reviewed in the Model, Set and World Explorers and bounded by the phone
   budgets.
5. **Three flows (Jake):** autonomous (planned in full), iterative high-quality (the checkpoint per place; it came from Nine Dragon's loop), and sketch
   (fast low-poly for quick steering). **Plan only: nothing is built until GAME-NORMALIZATION is archived.**
