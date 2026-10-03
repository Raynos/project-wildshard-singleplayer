---
name: worldclaw-interactive
description: DRAFT (E359). Its new-shard flow is usable once WORLDCLAW-SHARD's N/F/X/E/T rows land; its existing-shard path (§X: a light front, then checkpoints) is usable now (D86). Build a WorldClaw shard WITH Jake in the loop (guided) - the start questions; the front on images (three pitches, art direction + style bible, concepts, the map in two waves from a 3D blockout, the content boards with a 2x2 board per quest step, first-person views); the verb gate after the mockups; the grey session-slice gate; re-targeting; the build with a checkpoint per place (Frame · Form · Play · Pin), WorldClaw's techniques on every seen band; the final board, Jake's first walk and polish rounds. Also an existing shard's light front and its checkpoints (it absorbed shard-checkpoints, D80), a director's single-stage entry and resume. Use when asked to "make / build / WorldClaw a shard (with me)", to grow an existing shard ("the next slice of Nine Dragon", a light front), "resume <slug>" on a guided shard, or by a director for one stage. Zero-shot runs use worldclaw-auto; fast low-poly big-picture rounds use worldclaw-sketch; single models use mockup-to-model.
---

# WorldClaw, interactive: Jake's vision to a fun, polished shard

Binding docs:
- **the flow and its contracts:** `docs/design/worldclaw/06-shard-flow.md` (§3 the front, §4 the gates, §5 the build,
  §10: paths, the stage-entry table, invalidation and notes, gates and ladders, the slop score, image engines,
  waiting and resume);
- **the techniques:** `04-our-pipeline.md`;
- **the plan:** `docs/plans/WORLDCLAW-SHARD.md` (D1–D74, R1–R33); the pilot is Thin Ice (`docs/plans/THIN-ICE.md`);
- **the tools:** `docs/plans/WORLDCLAW-TOOLS.md` (Draft mode, the drafts site, the Explorers).

Paths target the normalized engine and are re-grounded by row N0.

**The bar** (Jake): a real fun standalone level with its own content, quests, theme and art style; never a cute
diorama. **Less slop:** things sit right; every seen view is composed; no style drift. **The score** is Jake's
first-walk notes (06 §10.5). Content and world are designed together and get equal image effort (D37, D70).

## 0. Dispatch, in this order

1. **Existing shard** (a shard that is already in the game: Nine Dragon, Pine Hollow, Nalati, Driftwood, the Dunes, Sky
   Reach; or a resume of one whose §run `mode` is `existing`) → §X. This comes first: it never starts a new run (MC1).
1b. **Single stage:** a director asked for one stage → §S, even when the shard already has a `design.md`.
2. **Zero-shot** (`zero-shot …`, or `resume <slug>` of a shard whose §run `mode` is zero-shot) → use `worldclaw-auto`.
3. **Resume** (`resume <slug>`, or any invocation naming a shard whose `src/shards/<slug>/design/design.md` exists) →
   read §run (`mode`, P0's answers, `step`, `waitingOn`, `next`) and the last Handoff.
   - `waitingOn: jake`: look for his answer in chat. None → hold: work only on what doesn't depend on it; older than
     48 h with no `resentAt` → re-send the set once and record `resentAt`; `resentAt` older than 48 h → stop with a
     Handoff (`stop: blocked`). An answer clears `waitingOn` and goes into the verdict log before the run advances.
   - `waitingOn: codex-quota`: before its reset → stop (`stop: quota(<reset>)`); after it → clear and continue.
   - Otherwise continue at `next`.
4. **A new run:**
   - check P0's needs (06 §10.2), and stop naming any missing row;
   - claim the ask (`scripts/ask-new.sh "<the user's words>"` in the main checkout; read the id);
   - pick the slug from the sentence (never renamed);
   - create the shard as a draft on the drafts site (WORLDCLAW-TOOLS §2, W13; how-to: `drafts/README.md`):
     `drafts/shards/<slug>/draft.json` (name, one spoiler-free line, `run`) and `content.json` (empty lists), then
     `node drafts/tools/atlas.ts <slug>`; the game's title shows its COMING SOON card from the next game deploy (W9). The
     manifest with `status: 'hidden'`, `bakeWhileHidden` and `gateExempt` arrives at P7 / P8 (E10, R33);
   - create `design/design.md` from T1's template, with §run's `mode: guided`;
   - → P0.

**Every step boundary** (the drafts site is the history, J21, J26; `drafts/README.md` has the details):
- update `design.md` §run (06 §10.7);
- describe the step's new round in `drafts/shards/<slug>/draft.json` (its stage, kinds, statuses, file rules), put
  Jake's answers **verbatim** in its `stages` entry, set `run` (stage · waiting on · next);
- `node drafts/tools/atlas.ts <slug> --publish` (new pictures to Blob once each; `atlas.json` regenerated), commit with
  a pathspec, `scripts/push-main.sh`;
- `bash drafts/tools/deploy.sh` (`run_in_background`) → https://wildshard-drafts.vercel.app;
- republish the draft's read-only artifact page: `node drafts/tools/artifact.ts <slug> <scratchpad dir>`, then the
  Artifact tool on `<dir>/index.html` with `root` = the dir and every `img/` file, to the draft's existing page URL
  (Thin Ice: https://claude.ai/artifact/1v5EE7bt75m3dGFAkVh7P1; J25, J62);
- read Jake's notes from chat; append every answer of Jake's and every note to the **verdict log** (ask id + a
  one-line quote);
- keep the ask's Status and the Handoff current at every commit;
- before the session exits, set §run's `stop`: `continue` / `done` / `blocked` / `quota(<reset>)` (06 §10.7).

**Asking Jake:**
- Every decision is an AskUserQuestion whose **first option is "(skip, I'll answer in chat)"** (nothing is decided)
  and whose recommended answer comes second. Other agents' `herdr agent prompt` broadcasts press Enter in this pane
  and can submit an open question: an answer that comes back within seconds, or as option 1, gets a one-line confirm
  before it binds a decision.
- **Image sets go in one send** (SendUserFile, in order) so Jake can page through them on Claude iOS: the numbered map
  first, then the views in the map's numbering; **every image carries a title strip** (number · name · role) outside
  the frame. Send the full-resolution images when he asks.
- Start every job that doesn't need his answer first; then ask, or post the set and end the turn (06 §10.7).
- Review pages are **read-only** (no buttons, notes or db); Jake answers in chat.

**The status line:** `~/.claude/set-label.sh "WorldClaw <slug>: <stage>" "<≤24 chars>"` once per stage.

**The shared machine:** the model lock (batches < 30 min); the browser lane (≤ 4, close every session); served builds
only; headless muted; JPEG / WebP; codex ≤ 6 at once (T14's `--max-parallel`); pathspec commits.

**Subagents:** ≤ 3 live, ≤ 400 k, ≤ 90 min, ≤ ~200 turns, one job, never recycled, no forks; long waits stay with the
main agent; subagents never set the status line. When Jake asks for one agent, use none.

## P0. Start questions (06 §2)

One AskUserQuestion (skip first):
1. **Follow along:** milestone clips, a daily summary and the final time-lapse? (Recommended: all.)
2. **Run scope:** world + all content / world + one session slice.

**Recording is always on** (T13 → `~/.cache/wildshard-worldclaw/<slug>/frames/`); the answers gate delivery only.

## FRONT: images; Jake decides (06 §3; D15, D46). Inspirational, not pixel-exact (D72)

**Image engines** (06 §10.6): Qwen-Image-2.1 explores (`scripts/mockup-local.sh`, a neutral grey reference, the model
lock); codex makes the finals (`run_codex.py --max-parallel 6`, T14). Read every image; re-roll garbled text, a drifted
HUD, or an invented landmark; log the re-rolls. Every caption and title is drawn by code, never by the image model.

### P1. Vision intake
Jake's sentence, references and voice notes go into `design.md` §vision, verbatim. Ask once whether he has anything to add.

### P2. Three pitches (06 §3.2)
Per pitch, one board panel + text: a sentence and three pillars; **the verb** (existing / a moved toy: E9b, + N days /
new: + N days); **the weapon**; **the enemy roster and its density** (a sparse shard is valid: D73); **the boss and the
antagonist**; **8–12 places** with roles and beats (required: spawn, hub, landmark, arena, boss, secret, vista,
traversal); **2–4 happenings** with signals and `seenFrom`; **the journey structure** (e.g. a loop, hub and keys,
stages that open: D70); **the cost**; one key-art concept (Qwen explore → codex final). A new HUD control gets its own
HUD board. Make the three different in kind; lean on `docs/design/fun-rules.md`.

### P3. Art direction → the style bible (06 §3.3)
1. Three directions on the pick's four key views, prompted as **renderable by a real-time phone game** (codex paints
   "stylized" painterly otherwise). None may reuse a shipped look; a photoreal one must differ from Pine Hollow's.
2. Each states its asset route and **what it costs to build** (lights, materials, effects); offer "the simplest one you
   like" when Jake asks for feasibility. If `scatter-sources.json` lacks a route, run a mini-X1 in the lab shard (R33)
   and append the pick to `scripts/worldclaw/scatter-sources.json`.
3. The pick is redrawn as a real-time look (4 views) and becomes `design/style-bible.md`: palette, light, materials,
   shape language, do / don't, references, **the kit look** (E6), 2–3 anchor-model concepts.

### P4. Concept art (06 §3.4)
Key art, one concept per place, each reveal, the boss, the creatures, the NPCs, the weapon and the traversal toy,
anchored on the approved style views. Boards of ≤ 4 per group; approve / strike per image (≤ 2 loops a group).

### P5. The map, wave 1 (06 §3.5; D66–D69)
1. `design.md` with its machine block and `spec.json` (routes as typed legs); `spec-check` + `twin-check` after every
   edit. Every variant shows **the four edge exits** and a **spawn on land**; the boss sits behind a summon (D67).
2. `schematic.mjs` → **3 map variants that differ in layout** (never repaints of one) → T3's gate.
3. **T19's blockout** per variant (dead-flat ice with marked lanes, open water, the landform's identity, pits, a
   glacier tongue, the spawn beacon, the edge gates, a hub's street plan: D69).
4. **One set:** per variant, the **numbered** illustrated map (labels by code) + **3 World Explorer views** painted over
   the blockout's renders (the blockout is a layout guide only; the approved style views are the fidelity target: D68).
5. Jake picks and revises; **a revision is a new map + one 3-in-1 image** (three views in one generation), never eight
   separate views. ≤ 2 loops, then "go with gaps".

### P5b. The content boards (06 §3.6; D70, D71, D73)
1. **The journey** on the approved map: the structure (A / B / C when not settled), numbered steps, stages, lanes.
2. **One 2x2 board per quest step** (T20): slot 1 the map leg A → B by code with why, what, what you get and the step's
   **mechanics (NEW = engine work, priced)**; slots 2–4 wildcards for what the step means (a first-person moment, a
   second moment, a character or object model sheet, a fight), with the code minimap.
3. **Side content** (side quests, feats, secrets, happenings, enemy pockets) and **the session slice** on the map.
4. One set (overview first). Jake approves or revises a step or a slot (or says "go with gaps"). New
   mechanics he adds (a rope to grab, a tool refused on a surface) go on the boards and into the estimate.

### P6. First-person views, wave 2 (06 §3.7)
1. T19's camera picker places each place's eye-height camera on the approved map (walkable ground, a clear line of
   sight, on the route where the place is revealed) → `design/cams/<place>.json`.
2. Each view: a codex edit of a live portrait capture with the baseline HUD, from the place's approved concept and its
   quest moment; the prompt lists what the camera sees (from the map's coordinates); the blockout render guides the
   composition where it is clear. **The HUD minimap is composited by code** at the camera's spot and heading.
3. One set with the numbered map first, every view titled. **GO / revise** (≤ 2 loops, then "go with gaps" or stop).

### E9b + P7. The verb gate, after the mockups (06 §3.8; D57, R13)
Only for a new verb or a moved toy. A moved toy takes its kit move (E9b). Build the verb in grey in the pilot's
playground (`ctx.playground`) on `verb.1` / `verb.2`, with its leg test on E9's contract (`leg-test.mjs`); deploy (R22)
and send the taps. Jake plays it. Yes → P8. No → P2's verb line; the places, the bible and the map stay; redo the
concepts, boards and views that show the verb. Two "dull" → cut.

## GATES: play in grey (06 §4; D41)

### P8. Grey world + grey content (06 §4.1)
1. **T17** builds the grey world from `spec.json` in the sketch look and kit (E8a): terrain within `heightRange`, water
   bodies, graded routes at one grade, **place pads** (R5), stand-ins, gameplay structures as code. The grey world is
   now the source of truth for space: the front's mockups were inspiration (D72).
2. The weapon live; kit SFX cues. **Content per the run scope:** enemies and elites (grey rows), the boss with its
   phases and its summon, quest steps, happenings (E7), the slice, and the shard's mechanics from the quest boards.
3. The bakes run (E10).
4. **Hard gates (06 §10.4):** T5's walk legs and every other leg's test; `physics-baseline --mode=walk` (and
   `--trails`) 0 stuck; reach; every place ≥ 80 % under 30°; **T16 runs the slice** and beats the boss by real strike
   inputs under `bossGod` when the scope holds it; sightlines; T9.
5. **The judges** (§J): the level rubric on the route strips + T5's numbers + T16's log; report the phone-tier fps.

### P9. The session-slice gate (06 §4.2)
1. Deploy: push → CI and `gpu-gate` green → `gh workflow run deploy` → `version.json` shows the SHA or a newer one
   containing it. The gate-exempt pilot records no gate baseline (R33).
2. Send Jake the taps (Settings ▸ Debug ▸ Developer tools ▸ `showHiddenShards` → the pilot → the slice's start; or
   PLAY from its Atlas, WORLDCLAW-TOOLS) and the frame rate.
3. Yes + one note → P9b. No → 06 §10.3 (≤ 2 nos).

### P9b. Re-target (06 §4.3)
Capture the grey world at every place's camera and T5's route-leg cameras; codex re-edits each place capture to its
approved P6 view and each leg capture to the bible (the nearest place's view as the second input); the stand-dome and
look-dome 3×3 grids; phone copies for the Explorers; each Set gets its `target` (E4); the judges check fidelity.

## BUILD (06 §5): a checkpoint per place (WORLDCLAW-SHARD §2b; D63, D78); the judges decide the rest

- **Polish every seen band** (D60), place by place in golden-path order (D83): `reach --bands` gives each place's close,
  mid and far bands and the cameras.
- **The checkpoint per place** (P12; WORLDCLAW-SHARD §2b, the merged SHARD-CHECKPOINTS loop, D77–D84). Four gates, as many
  boards as the place needs (D78; there is no one-board rule):
  - **Frame:** a live portrait capture with the real HUD, the P9b target, the plausible in-engine next view at the same
    camera; ask for a look direction only when taste is needed.
  - **Form:** only the place's new or changed models, in place, every side (front, sides, back, three-quarter),
    registered in the Model Explorer; the rest were approved in P11's catalog (D82). Never approve from the hero angle.
  - **Play:** a moving capture and a playable build: collisions, controls, hit or miss, landings; World / HUD Explorer
    evidence where it applies. A still frame alone is not a pass.
  - **Pin:** your measurements (D81) against the shard's own gate: `scripts/bench-load.mjs` (phone tier), `scripts/sim-memory.mjs`
    (the 1.8 / 1.0 GB caps), its budget ceilings; the four CI gates; a before / current / target board; Jake approves or
    revises. Commit; the next deploy ships it, hidden in the new shard (D79).
  - Then propose the next place along the golden path (the session slice first) and let Jake pick (D83); inside a place
    its bands go close → mid → far, and the route leg into it is part of its checkpoint. Before his pick, start only
    work that doesn't depend on it (the proposed place's captures).
  - Content that later lands on a pinned place (P13) re-runs its Play and Pin.
  - A rejected variant goes with its Debug row; internal nine-angle sheets are evidence, not nine decisions; a failed
    gate shrinks or polishes the same place, never opens a new one. After the pin, `design.md` records the camera, the
    assets, the evidence, the rejected variants and the next place.
- **Notes** (06 §10.3): apply, log and acknowledge each. Notes override taste, never a hard gate. A one-asset note adds
  a bible exception line. A palette / light / materials note takes the look row. A gate-reopening note **is Jake's
  decision**: apply its 06 §10.3 row; only an ambiguous note gets one clarifying question; a note that breaks a hard
  gate goes back to him with the number.
- **A hard failure** climbs 06 §10.4's ladder; rungs 3–4 by 06 §5's table (guided: Jake before P9; the judges inside the
  approved design from P9 on; beyond that a blocked Handoff before P9, a **blocked branch** from P9 on, asked at P16).
  Post each judges' decision as "decided for you". A required slot never ends empty.
- **Other skills run without their "ask Jake" steps** (R29): mockup-to-model §2–§7 (its asks → the judges, Jake sees
  the place's checkpoint); LOOK-LOOP's sign-off → the judges + a 12-frame orbit strip.

| Step | Do | Done when |
|---|---|---|
| P10 look | the bible as shard data, the kit look (E6), the model post recipe; LOOK-LOOP against the P9b targets on every seen band, close first; two domes; the orbit strip | each target's ΔE00 reported; the judges sign off |
| P11 catalog | 04 §7: anchors first; per place by `catalogMode`; scatter by `scatter-sources.json`; codex refs → TRELLIS **and** Hunyuan3D-2 → the better take → the post recipe; texture caps; walk-inside buildings as code; reuse first; the style check with its ladder; T7 with provenance and phone copies | every placed asset passes |
| P12 places | 04 §8, per place and route leg, close band first: `capture --cam` → codex composition **with the P9b target as the second input** → `objects.json` → new objects re-drawn isolated → P11 → T8 → object pads → the Set's target → T9 → bakes + walk → **the place's checkpoint (Frame · Form · Play · Pin)** | T9 clean; Jake's pin per place (or "go with gaps"); the judges' compare has no must-fix |
| P13 content + audio | 04 §11: creature, NPC and boss models; the weapon's final model; the quest boards' mechanics to final (the NPC moments, the traversal and surface rules); dressing and signals; quest props; the score (MiniMax Music 3), ambience, SFX (MOSS + Stable Audio 3, `sfx_merge.py`), credits; card art | T16 plays the golden path and the slice in the final look |
| P14 budgets | T10 at every place's 9 cameras and every 10 m of every route; a Simulator pre-check | within R28's gate |
| P15 final judges | F1's fun rules, L1–L9, look and slop, on the final strips | the R6 pass mark |

## END

- **P16:** the final board (boards of ≤ 4, one set, every "decided for you" and every blocked branch as one question
  with a recommended answer and its cost; apply each answer by its 06 §10.3 row, re-run P14–P15 on what it touched,
  re-send the changed panels, all before P17); the time-lapse; the gap list; once no blocked branch is open, the shard
  leaves the gate exemption (R33: T5's 3 gate legs, T6's gate poses, the first baseline, `gateExempt` removed; the
  status stays `hidden`); **the physical-iPhone reading** by 06 §7's recipe (`webkit-mem-reading.mjs --url=<prod>/?chunk=<slug>`
  over the Web Inspector bridge; `iphone-mem-reading.sh` reads Nalati only), recorded like
  `docs/audits/physical-shard-memory-baseline-2026-09-28.json`.
- **P17:** Jake's first walk; notes through the inbox; drain-inbox makes one ask per note; size every note L / S / M
  with a reason, freeze the baseline and record the slop score; an over-limit reading reopens P14; fix S / M notes
  ( out of the exemption every fix re-records the gate baseline); **on Jake's word, the status becomes
  `experimental`**.
- **Polish rounds** (the old iterative flow, D62): after P17, Jake picks an area or a note; one place at a time: a
  composition + a built view at the same camera → his GO or revision → bakes + walk + budgets. Leftovers stay asks.

## X. An existing shard: the light front, then checkpoints (WORLDCLAW-SHARD §2c; D85–D87)

For a shard that already exists (Nine Dragon first, then Pine Hollow, Nalati, Driftwood, the Dunes, Sky Reach):
1. **Pause** the slice in flight (record where it stands in the shard's plan and ask file).
2. **The light front** (D85): `src/shards/<slug>/design/design.md` + `spec.json` written from the live shard (places, routes
   as typed legs, the critical path, the verbs, the slice as it stands) in T1's formats (D87; template
   `scripts/worldclaw/design-template.md`, schema `scripts/worldclaw/spec.ts`, §run `mode: existing`); the captures by
   `scripts/worldclaw/capture-front.sh` (the top-down map, the plan's hero cameras, a section view per built level) into
   `art/<slug>/round-<n>-light-front/`. No pitch round, no drafts site (skip the step-boundary drafts steps).
3. **One pass with Jake:** he confirms the pillars and names the next slices; his words go in the verdict log.
4. **Each slice is a checkpoint** (BUILD above) with the existing-shard inputs: Frame's target is the plan's approved
   mockup for the camera or a new mockup edited from a live capture; Form uses the shard's registered models (new ones by
   `mockup-to-model`); Pin re-records the gpu-gate baseline (`node scripts/parity.mjs --rebaseline=<slug>`) and needs a
   physical-iPhone reading when the slice changes rendering, batching or memory policy (AGENTS.md). On a live shard the
   slice in progress is public as it is built (D84); the pin is Jake's approval. A hard failure climbs 06 §10.4's "from
   P9 on" rows, then a question to Jake. The shard's own plan keeps its scope and rows.

## S. Single-stage entry (a director's call; 06 §9, §10.2)

1. **Input:** the slug, the stage, the region or slice.
2. Read the stage's **files** from 06 §10.2. On a director's shard without a `spec.json`, write a slice spec
   (`spec-check --scope slice`) from the director's design and keep the shard's terrain (T17 content-only; no region
   weights); twin-check is skipped, logged, when the design has no machine block. Any other missing file → stop and
   name it.
3. Targets are needed only from P10 on. Write only the stage's outputs, log them, hand back with the evidence.
4. A slice-scoped P8 gates the slice's legs, reach and T16, and logs the rest as untested. Never create a second shard.

## J. The judges (R6; 06 §6)

- **Seats:** J1, a fresh Claude subagent; J2, `codex exec -i`; J3, a fresh Claude, on splits only.
- **They read:** strips, boards, sheets, T5's numbers, T16's log, `design.md`, the bible, the targets,
  `docs/design/fun-rules.md` and the rubric. Never video.
- **Scores:** every judge scores every option on every line (1–10). **Picks:** the J1 + J2 mean wins when both rank it first, else
  the median of three; ties: the first rubric line, then lower cost, then the option id. **Gates:** every line's mean
  passes when J1 and J2 both pass every line (J3 on a split line) and no evidenced must-fix stands (R6). Style checks batched; log everything in `decisions.md`.
