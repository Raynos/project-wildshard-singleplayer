# 06 · The WorldClaw shard flow: vision → images → play gates → build → first walk

The flow the plan ([WORLDCLAW-SHARD](../../plans/WORLDCLAW-SHARD.md), ledger D1–D74, resolutions R1–R33) and the
three skills (`worldclaw-interactive`, guided; `worldclaw-auto`, zero-shot; `worldclaw-sketch`: D62) execute. It comes from:
- Jake's grill (2026-10-01);
- the GW2 content audit's play-first director loop ([GW2-ZONES](../../plans/GW2-ZONES.md) §4.3, first written as CONTENT-GAP);
- council rounds 1–4 (finding IDs in the [register](../../plans/worldclaw/reviews/register.md));
- the fjord dry run (Thin Ice, now the pilot: D74), which added the map waves, the blockout, the content boards and the
  mechanics lists (D66–D73).

[04](04-our-pipeline.md) explains the techniques this flow calls, and defers to this doc and the plan. Every path
targets the normalized engine and is re-grounded by plan row N0.

## 1. Why this shape

- **The problem** (Jake): an agent left to build a shard makes 250,000 m² that all need polish, and the result feels
  like slop.
- **The slop** (D39): things don't sit right, nothing is composed, the style drifts.
- **WorldClaw's answer:** coherence first, then detail only where it matters; the image model composes, solvers seat
  the objects.
- **The director loop's answer:** design content and world together, and **play** before the art. A place with no beat
  is forbidden, and so is a beat with no place.
- **Jake's answer:** decide on images first, play two grey gates, let the build run with only his notes coming in, and
  judge it by his first walk.

The order:
1. a **front** of images (Jake decides): pitch, style, concepts, **the map** (wave 1), **the content boards**, the
   **first-person views** (wave 2). They are inspirational, not pixel-exact; the grey world settles the space (D72);
2. the **verb gate**, after the mockups, when the pitch needs one (D57);
3. the **slice gate** in grey;
4. **re-targeting** onto the grey world;
5. the **build** (`worldclaw-auto`: the judges decide; `worldclaw-interactive`: a checkpoint per place, Frame · Form · Play · Pin, D63, D78 (WORLDCLAW-SHARD §2b);
   WorldClaw labours on every seen band, close first, D60);
6. the **end** (Jake walks; his notes are the score).

## 2. Start (P0)

**The mode comes from the skill** (D62): `worldclaw-auto` is zero-shot ("zero-shot …", optionally "… until P<n>", §8);
`worldclaw-interactive` is guided. **The mode, the `until` bound and P0's answers are saved in §run** (§10.7), so a resumed run keeps them;
a new invocation on a zero-shot run's shard (P19's "until P8" on P18's shard) updates the bound and continues.

**The slug** is picked from the vision's sentence at P0 and never renamed.

One AskUserQuestion (guided):

| Question | Options | Default |
|---|---|---|
| Follow along? (D16, D35) | the live page + milestone clips + a daily summary + the final time-lapse; any subset; none | all |
| Run scope? (R17) | **world + all content** (grey, then final); **world + one session slice** (the world complete, content = the slice) | world + all content |
| Build steering? (D63, D78) | a checkpoint per place (interactive: Frame · Form · Play · Pin, boards as needed, the next place Jake's pick along the golden path, D83); the judges decide, notes only | a checkpoint per place |

- Recording is always on (§10.1's frames folder); the answer gates delivery only.
- Zero-shot asks nothing and delivers only the final board + time-lapse, unless the invocation asks to follow along.
- The run's state lives in `design.md` §run (§10.7).

## 3. The front: images, Jake decides (D15, D46–D50)

- **The live page** (R20) keeps every approved image and the latest progress frame per stage, paginated per stage.
- **Each decision** arrives as **boards of ≤ 4 images** (T11) and one question (D49), by §10.7's waiting rule: start
  the independent work first, then ask.

### 3.1 Vision intake (P1, D47; guided only)

Jake's sentence, references and voice notes or long description go into `design.md` §vision, verbatim. Nothing is
invented there.

### 3.2 Three pitches (P2, D11, D53, D34)

Each pitch is one board panel:
- a sentence and **three pillars** (moment, session, return; the return is a note only);
- **the verb**, one of:
  - **existing**: in `#engine` / `#kit`, including the zipline and rope bridge after E9;
  - **a moved toy**: still another shard's code, e.g. the grapple or riding. A kit move, row E9b, + N days;
  - **new** (+ N days);
- **the weapon**: a kit family, or custom (+ N days);
- **the enemy roster**: kit species, or new (+ N days each);
- **the boss and the antagonist**;
- **8–12 places** with roles: `spawn · hub · landmark · objective · arena · boss · secret · vista · traversal · camp`.
  The required roles are spawn, hub, landmark, arena, boss, secret, vista and traversal. Every place has a beat. A
  *discovery place* is a place with a map pin and a discovery event (D25);
- **2–4 happenings** (D44), each with its signal and `seenFrom`;
- **the critical path** as a gated loop with walk times;
- **its cost**: the base plus its adds (the pitch rubric scores cost);
- **one key-art concept**: Qwen explores 4–6, codex makes the final.

A new HUD control is shown as its own HUD board here (AGENTS.md ▸ HUD).

**Answers:** Jake picks one, or a mix (redrawn and asked again). Rejecting all three → three new pitches once, then
stop (§10.3).

### 3.3 Art direction and the style bible (P3, D12, D32, D48)

1. **Three directions** on the pick's four key views (spawn, hub, landmark from afar, the boss approach). No direction
   may reuse a shipped shard's look. A photoreal direction must differ from Pine Hollow's in palette and light.
2. Each direction states its asset route (D32). If `scatter-sources.json` (X1) has no row for that route, the
   buildability screen runs a mini-X1 for it: one family per scatter kind (tree, bush, rock) on that route; the judges
   pick, and in guided mode the pick is shown on P3's board. The mini-X1 runs in the lab shard (R33), and its pick is
   appended to `scatter-sources.json`, one row per kind × route [R4-B11].
3. **The judges screen buildability** first.
4. **The pick becomes `style-bible.md`:**
   - palette;
   - light;
   - materials;
   - shape language;
   - a do / don't sheet (6 + 6);
   - references;
   - the **kit look** (E6);
   - **2–3 anchor-model concepts**.

### 3.4 Concept art (P4)

In the bible:
- key art;
- one concept per place;
- each reveal;
- the boss;
- the creatures;
- the NPCs;
- the weapon.

Qwen explores, codex makes the finals. Jake approves the set, striking or re-asking per image (≤ 2 loops a group).

### 3.5 `design.md`, the spec and the map, wave 1 (P5, D52, R15, D66–D69)

1. **`design.md`** has:
   - vision, pitch, pillars, verb, weapon, roster and its density, boss;
   - the three loops;
   - places with roles, beats and content;
   - happenings;
   - the journey structure and the critical path;
   - routes as typed legs;
   - the session slice;
   - §run;
   - **the verdict log**;
   - **one machine block** (` ```yaml worldclaw `).
2. **`spec.json`** is the twin (04 §3).
3. **Checks:** `spec-check` (§10.2) and `twin-check` (ids and values) after every edit.
4. **The layouts:** the schematic, then **3 map variants that differ in layout** (not repaints of one), T3's gate
   (04 §4). Every variant shows the **four edge exits** to the neighbouring shards and a **spawn on land**, and keeps
   the boss behind a summon (D67).
5. **The blockout** (T19): one smooth Blender blockout per variant that encodes what a painter must not misread
   (dead-flat ice with marked lanes, open water, the landform's identity, pits, a glacier tongue, the spawn beacon,
   the edge gates, a hub's street plan: D69).
6. **Wave 1, sent as one set:** per variant, the **numbered** illustrated map (labels by code) + **3 World Explorer
   views** painted over the blockout's renders (the blockout as a layout guide, the approved views as the fidelity
   target: D68). Every image is titled.
7. Jake picks and revises; **a revision is a new map + one 3-in-1 image** (three views in one generation), never eight
   separate views (D68). ≤ 2 loops, then "go with gaps".

### 3.6 The content boards (P5b, D70, D71, D73)

Content gets the same image effort as the world, and is shown before the first-person views:
1. **The journey structure**, A / B / C (from the pitch: e.g. one loop, hub and keys, stages that open), drawn on the
   approved map with numbered steps.
2. **One 2x2 board per quest step** (T20): slot 1 is the step's leg A → B on the map (by code) with why, what and what
   you get, and the step's **mechanics, NEW marking engine work** (each a cost: D73); slots 2–4 are wildcards for what
   the step means (a first-person moment, a second moment, a character or object model sheet, a fight).
3. **Side content:** side quests, feats, secrets and keepsakes, happenings, the enemy pockets (a sparse shard is a valid
   choice: D73).
4. **The session slice** on the map, with its timeline.

Sent as one set (the overview, then the step boards). Jake approves the content or revises a step or a slot (≤ 2
rounds, then "go with gaps").

### 3.7 First-person views, wave 2 (P6, R27, D66)

- Each place's **camera** is placed on the approved map by T19's picker: eye height, walkable ground, a clear line of
  sight, on the route where the place is revealed. Write `design/cams/<place>.json`.
- Its view is a codex edit of a live portrait capture with the baseline HUD, from the place's approved concept and its
  quest moment; the prompt lists what the camera sees (from the map's coordinates), and the blockout render guides the
  composition where it is clear. The HUD minimap is composited by code at the camera's spot and heading.
- **These are approvals**; P9b makes the build's targets.
- Sent as one set with the numbered map first, each view titled. **GO / revise** (≤ 2 loops, then "go with gaps" or
  stop).

### 3.8 The verb gate (P7), after the mockups, when the pitch has a new verb or a moved toy (D57, R13)

1. A moved toy first takes its kit move (E9b).
2. The verb runs in grey in the pilot's playground (`ctx.playground`), mapped onto `verb.1` / `verb.2`, with **its leg
   test written to E9's leg contract** (`scripts/worldclaw/leg-test.mjs`: launch → landing inside the target's radius → a clear exit, headless), which T5 partitions and P8's gates run.
   The pilot is still `hidden`; Jake reaches it by R22's taps → the pilot's playground card.
3. Jake plays it. Yes → P8. No → P2's verb line with the verb changed or cut; the places, the bible and the
   map stay; the concepts, content boards and views that show the verb are redone (D57). His answer
   goes into the verdict log (ask id + a one-line quote).
4. **The kill rule:** a verb called dull twice is cut.
5. Report the phone-tier frame rate.


## 4. The gates: play in grey (D41)

### 4.1 The grey world and grey content (P8)

- **T17 builds the grey world from the spec** in the sketch look and kit (E8a): Eq. 6 terrain within `heightRange`,
  water bodies, graded routes (one grade, R31), **place pads** (R5), sketch stand-ins at their footprints, gameplay
  structures as code.
- **The weapon live**, kit SFX cues.
- **Content** (per the run scope):
  - enemies and elites as grey rows with stand-in brains and strikes (the fight rules);
  - the boss with its phases;
  - quest steps;
  - happenings (E7);
  - the slice's route and payoff.
- The bakers run because the pilot opts in while hidden (E10).
- **Hard gates:**
  - walk legs 0 stuck (non-empty);
  - every non-walk leg's test passes;
  - reach for every place, slot and happening;
  - every place's pad walkable (R5), its gentle-ground share reported;
  - **T16 runs the slice**, and **beats the boss by real strikes** (04 §11) when the run scope holds the boss (all
    content, or a slice that contains it; otherwise logged as out of scope);
  - sightlines;
  - T9's play checks.
- **Judged:** the level rubric on the route **frame strips** + T5's numbers + T16's log.
- **Reported:** the phone-tier frame rate.

### 4.2 The session-slice gate (P9)

- **Deploy** (R22): push → CI and `gpu-gate` green → `gh workflow run deploy` → `version.json` shows the SHA, or a newer
  one that contains it. While the pilot is gate-exempt (R33) its commits record no gate baseline.
- **The taps:** Settings ▸ Debug ▸ Developer tools ▸ `showHiddenShards` on → the pilot's card → the slice's start.
- **Jake plays** 10–15 min. Yes + one note → P9b. No → §10.3 (≤ 2 nos). His answer goes into the verdict log.
- **Zero-shot:** the judges decide from the strips and T16's log.

### 4.3 Re-target onto the grey world (P9b)

1. Capture the grey world at every place's planned camera, and at the **route-leg cameras** T5 picks at crests and
   turns on every seen band, the close band first (`design/cams/leg-<id>.json`) (T6, D60).
2. Codex re-edits each place capture to its approved P6 mockup (the mockup as the second input). A route-leg capture
   is re-edited to the bible with the nearest place's mockup as the second input; the judges check it against the
   bible.
3. Per hero view, make **a stand-dome and a look-dome 3×3 grid**.
4. Publish phone copies for the Explorers (§10.1).

These are **the build's targets** (E4). The judges check fidelity (R6 pass mark). Jake isn't asked.

## 5. The build: judges decide, WorldClaw labours (D27, D36)

**Banded polish** (R11, plan §10 PB2), along every enabled movement mode's eye path:

| Band | Share of a 500 m shard | Gets |
|---|---|---|
| close, ≤ 30 m | ~35 % (~90,000 m²) | full polish, first: paint-then-lift, LOOK-LOOP cameras, hand fixes |
| mid, 30–80 m | ~35 % | full polish, second (D60): compositions from crests and vistas |
| far, > 80 m | ~22 % | full polish, third (D60): compositions from crests and vistas |
| never seen | ~6 % | nothing |

The bands set the order inside a place and plan the cameras; every seen m² gets full polish (D60); the places go in golden-path order, Jake picking the next (D83). In `worldclaw-interactive` each place
is a **checkpoint** (WORLDCLAW-SHARD §2b: Frame · Form · Play · Pin, as many boards as needed; D63, D78): the agent measures it (D81), Jake pins it, the next deploy ships it hidden (D79), and Jake picks the next place along the golden path (D83).

**Jake's notes** (D36, R21; §10.3 for precedence) are read at every step boundary from chat (the pages are read-only:
WORLDCLAW-TOOLS J17, J21), then applied, logged and acknowledged.

**Who decides a hard failure** (§10.4's rungs 3–4), by mode and phase [R4-A4, R4-B3, R4-C4]:

| | Rung 3: the decision | Rung 4: a fix beyond rung 3's bounds |
|---|---|---|
| guided, before P9 | Jake | a blocked Handoff (the waiting rule, §10.7) |
| zero-shot, before P9 | the judges, who may also move a place inside its region (logged) | the judges, logged |
| from P9 on, both modes | **the judges, inside the approved design**: they may resize, re-seat, re-dress, swap a model or move an object; never cut a D25 must, a pillar, a place, a beat or a happening, change a place's role or the critical path, or force a P9 replay | guided: a **blocked branch**; zero-shot: the judges, logged |

**A blocked branch** [R4-C11] (guided, from P9 on; before P9 a rung-4 failure is a blocked Handoff that holds the
work depending on it): a stage whose only failures are blocked branches is `done (blocked: <ids>)`, and the
run goes on. At P16 each branch is one question on the final board, with a recommended answer and its cost. The
answer is applied by its §10.3 row; then P14–P15 re-run on the places and poses it touched and the changed board
panels are re-sent, all before P17.

Each judges' decision is posted as "decided for you" on the live page, or, with the page off, in the daily summary
and on the final board; Jake can overturn it with a note.

| Step | What | Done when |
|---|---|---|
| P10 look | the bible as shard data (ground, sky, fog, grade, light, `LookStrategy`, the kit look, the model post recipe); LOOK-LOOP against the targets on every seen band, close first (D60); two domes; a 12-frame orbit strip | each target's ΔE00 reported; the judges sign off (R29) |
| P11 catalog | 04 §7: anchors first; per place by `catalogMode`; scatter by `scatter-sources.json`; texture caps; walk-inside buildings as code; the style check (an asset that fails its ladder is not placed); provenance | every placed asset passes the style check |
| P12 places | 04 §8: per place and per route leg on every seen band, close first (D60); in interactive, a checkpoint per place (§2b of the plan; D63, D78); compositions conditioned on the P9b target; T8 placement through the physics query layer with support binding; object pads; T9; Sets with targets | T9 clean; judges' must-fix empty (one that stays climbs §10.4's ladder) |
| P13 content + audio | 04 §11: creature, NPC and boss models; the weapon's final model; dressing and signals; quest props; **score, ambience, SFX, credits**; card art | T16 plays the golden path and the slice in the final look |
| P14 budgets | T10 at every place's 9 cameras and every 10 m of every route; a Simulator **pre-check** | within R28's gate |
| P15 final judges | F1's fun rules, L1–L9, look and slop, on the final strips | the R6 pass mark; no must-fix |

## 6. The judges (R6)

- **Seats:** J1, a fresh Claude subagent; J2, Codex with images; J3, a fresh Claude, on splits only.
- **They read only:**
  - frame strips, boards and sheets;
  - T5's numbers and T16's log;
  - `design.md`;
  - the bible;
  - the targets;
  - **F1's fun rules**;
  - the rubric.

  Never video.
- **Scores:** every judge scores every option on every rubric line, 1–10. An option's score is the mean of its lines.
- **Picks:** the option with the highest J1 + J2 mean wins when both judges rank it first. Otherwise J3 scores
  every option and the median of three wins. **Ties**, in order:
  1. the higher score on the rubric's first line (fun rules first);
  2. the lower cost;
  3. the earlier option id.
- **Pass / fail gates** (one option: P8, P9b fidelity, P10, P15): pass when **J1 and J2 both pass every line and no
  evidenced must-fix stands**. A line one passes and the other fails gets J3 on that line, and its call counts.
- **Must-fixes:** one backed by a frame and a number blocks until fixed or disproved by a re-measure.
- **Log:** everything goes in `decisions.md`.

**Rubrics** (T12): pitch, direction, concept, map, mockup / target, level, and look and slop.

| | Level rubric: pass |
|---|---|
| L1 | from spawn you can tell where to go first |
| L2 | places adjacent on the route graph differ in role and silhouette |
| L3 | the critical path is a gated loop; walk times measured beside the design's |
| L4 | arenas read as arenas: clear ground, cover, exits |
| L5 | secrets have hints |
| L6 | pacing alternates; no enemy zone within 40 m of spawn |
| L7 | every crest shows somewhere new |
| L8 | every happening's signal is seen from its `seenFrom` |
| L9 | every beat has a place and every place a beat |

## 7. The end (P16–P17)

- **The final board**, in boards of ≤ 4:
  - the illustrated map;
  - the spawn, hub, landmark and boss frames beside their targets;
  - two Set Explorer target-vs-built shots;
  - a World Explorer instance-channel frame;
  - the budget table;
  - **every logged gap** and every "decided for you";
  - **every blocked branch** as one question, with a recommended answer and its cost (§5).

  It goes out with the time-lapse.
- **The gate exemption ends** (R33) once no blocked branch is open: T5 marks the 3 `gate` legs, T6 adds the gate
  poses, the first baseline is recorded and `gateExempt` is removed. The status stays `hidden` until Jake's word.
- **The physical-iPhone reading** (E263's method; `scripts/webkit-mem-reading.mjs`) [R4-A3, R4-B1, R4-B2, R4-C2]:
  1. **Jake:** the iPhone on USB, unlocked and trusted; Safari ▸ Settings ▸ Advanced ▸ Web Inspector on; Low Power
     Mode off; one Safari tab in front on `<prod>/version.json`.
  2. **The agent** starts the Web Inspector bridge as `scripts/iphone-mem-reading.sh` does (its lines 21–31:
     `pymobiledevice3 webinspector cdp` on port 9231) and reads that tab's socket from `/json/list`. The script
     itself reads Nalati only: never run it for the pilot.
  3. `node scripts/webkit-mem-reading.mjs --ws=<the socket> --blank-first --url=<prod>/?chunk=<slug> --fps=150
     --tag=<slug>-p16-<sha> --out=<evidence dir>`: the loading, Explorer and world peaks, and the frame rate.
  4. Record the URL, the build, the sample counts and the peaks in the ask file, like
     `docs/audits/physical-shard-memory-baseline-2026-09-28.json`. N0 re-grounds the reader's probes.
- **The first walk** (the director loop's arc gate):
  - Jake plays once and files notes through the in-game inbox;
  - drain-inbox makes one ask per note, linked from the run's ask (which E359 links);
  - each note is sized (§10.5) before the baseline freezes;
  - the slop score and the reading are recorded. An over-limit reading reopens P14;
  - S and M notes are fixed in this run. Leftovers stay asks.
- **On Jake's word after the walk**, the status becomes `experimental`, in either mode.

## 8. Zero-shot (D51, R18)

**The invocations** name the skill, so a fresh session finds it [R4-B7, R4-C8]:
- a new run: `/worldclaw-auto zero-shot <sentence> [as <slug>] [until P<n>]`;
- a zero-shot run, a new bound (P19): `/worldclaw-auto zero-shot <slug> until P<n>`;
- a relaunch: `/worldclaw-auto resume <slug>`.

No questions.
- **The front:** the judges take P2–P6, all judged and logged. **Existing verbs and controls only**, so no P7 and no
  moved toys.
- **Content caps:** a kit weapon; ≤ 1 new species; the boss built on a kit stand-in; ≤ +3 agent-days of adds in all.
- **The gates:** P8–P9 are judged from strips + T16's log; rungs 3–4 are the judges' (§5).
- **The build** runs as in guided mode, including P16's exit from the gate exemption (R33). The status stays
  `hidden` until Jake's word.
- **"until P<n>"** stops after that step with a partial board. P18 uses "until P5"; P19 continues P18's shard "until
  P8"; P18's shard is deleted after P19's board.
- **Jake** sees the final (or partial) board and the time-lapse.
- **Launching** [R4-K2, R4-K3]: a session without `WORLDCLAW_WORKER=1` that receives a zero-shot invocation (Jake's,
  or P18 / P19) is the **launcher**. It picks the slug from the sentence (or takes the named shard's) and starts
  **T18** (`scripts/worldclaw/zero-shot.sh "/worldclaw-auto zero-shot <sentence> as <slug> [until P<n>]" <slug>`)
  in a herdr pane or with `run_in_background`, and runs nothing itself. T18 runs each session, a **worker**, as
  `env -u HERDR_PANE_ID WORLDCLAW_WORKER=1 claude -p --permission-mode bypassPermissions` (a worker never sets the
  status line and never starts T18). On each exit T18 reads §run's `stop`: `continue` → relaunch
  `/worldclaw-auto resume <slug>`; `quota(<reset>)` → wait for the reset, then relaunch; `done` or `blocked` →
  stop and report; two exits at the same `step` → stop and report. A subagent never runs a zero-shot shard.

## 9. With the director loop and the other flows (D42)

- **The director loop:** a director calls one stage through `worldclaw-interactive`'s **single-stage entry**, which is
  checked **before** resume (§10.2's inputs).
- **Iterating and polish:** `worldclaw-interactive`'s checkpoint per place (D63, D78) and its polish rounds after P17 (the old
  iterative outline, absorbed: D62).
- **The sketch flow** (`worldclaw-sketch`): the grey part as fast rounds with Jake.

## 10. Contracts

### 10.1 Paths

| What | Path |
|---|---|
| The director's design (the human twin) | `src/shards/<slug>/design/design.md` (§run, the verdict log, the machine block) |
| The machine twin | `src/shards/<slug>/design/spec.json` |
| The style bible | `src/shards/<slug>/design/style-bible.md` (+ sheets in `art/<slug>/round-<n>-bible/`) |
| Decisions and judgings | `src/shards/<slug>/design/decisions.md` |
| Cameras | `src/shards/<slug>/design/cams/<place>.json` (position, yaw, pitch, vfov, aspect) |
| Object lists | `src/shards/<slug>/design/objects/<place>.json` |
| World data | `src/shards/<slug>/world/*.json` (placements, Sets, scatter, pads, happening spots: E2) |
| Models | `src/shards/<slug>/models/*.ts`; GLBs in `public/assets/models/<slug>/` |
| Images the Explorers show (provenance, targets) | phone copies in `public/assets/explore/<slug>/{refs,compositions,targets}/*.webp` made by T7 / P9b from the art sources [R2-A11] |
| Art (sources) | `art/<slug>/round-<n>-<label>/`: pitches, bible, concepts, maps, mockups, targets, compositions, refs, boards, milestone frames |
| Progress frames | **`~/.cache/wildshard-worldclaw/<slug>/frames/`** (durable, uncommitted; its path is in §run); copied to the scratchpad only to publish |
| Scatter sources | `scripts/worldclaw/scatter-sources.json` (X1) |
| Fun rules | `docs/design/fun-rules.md` (F1) |

The shard's `docs/SHARDS.md` section links `design.md` (plan §7 Q2).

### 10.2 Stage-entry table

| Stage | Rows done | Files it reads | Writes |
|---|---|---|---|
| P0–P1 | N0, F1, E10, T13, WORLDCLAW-TOOLS W16, W15, W1–W5, W8, W9, W17, W13 (replace T15) | — | design.md §run (mode, until, answers), §vision |
| P2–P3 | E3, T7, T10, T11, T12, T14, X1 | design.md §vision, fun-rules.md, scatter-sources.json | the pick, style-bible.md |
| P4–P5 | E1, T1, T2, T3, T19 | style-bible.md, the pick | concepts, design.md, spec.json (spec-check clean), map variants, the blockout, World Explorer views |
| P5b | T20 | the approved map, design.md, spec.json | the journey board, the step boards (with mechanics), side content, the slice |
| P6 | T6, T19 | the approved map, cams, the concepts, the step boards | first-person views |
| E9b + P7 (after P6: D57) | E8a, E9 | the pick's verb | the kit move, the playground |
| P8 | E2, E7, E8a, E10, T4, T5, T9, T16, T17 | spec.json, the region weights, design.md's slice | grey world data, content rows, walk legs |
| P9 | P8 done; R22's deploy | the build SHA | Jake's answer |
| P9b | E4, T6, T12, T14 | cams, the P6 mockups | targets, grids, phone copies |
| P10–P13 | E3, E5, E6, T7, T8, T9, T11, T12, T13, T16 | style-bible.md, targets, spec.json | look, models, final world data, audio |
| P14–P17 | T10, T11, T12, T13, drain-inbox | the build | board, time-lapse, reading, score |
| P18 | S1's draft, T12, T18 | a sentence | a judged front ("until P5") |
| P19 | P18's shard, T18 | P18's design.md | a P8-clean grey shard + board ("until P8") |
| **Single stage** (any shard, D91) | the stage's rows | **the stage's files**. On a director's shard without a `spec.json`: write a **slice spec** (`spec-check --scope slice`, T1) from the director's design, and **keep the shard's existing terrain** (T17 runs content-only). A content-only P8 reads the slice spec and the shard's existing terrain (no region weights); twin-check is skipped, logged, when the design has no machine block [R4-B8, R4-C10]. Any other missing file → stop and name it. Targets are needed only from P10 on | the stage's writes only, logged in the verdict log; a slice-scoped P8 gates the slice's legs, reach and T16, and logs the rest as untested |

**spec-check's rules** (T1):
- the required roles;
- 8–12 places;
- the four entry roads joined, **one at each edge (N, E, S, W), gated to the neighbouring shards** (D67);
- the spawn on land, with a clear way out (never a bridge or the ice: D67);
- the boss place behind a summon (a quest step wakes the boss), and no through-route crosses its arena before it (D67);
- every place inside a walkable region;
- heights within `heightRange`;
- the summed triangle and GPU-MB estimate within the budget gate (R28);
- `catalogMode ∈ { kit, generated, mixed }`;
- `scatter-sources.json` obeyed;
- id prefixes `<slug>/…`;
- every happening with a signal and `seenFrom`;
- every traversal slot with approach views;
- every route as typed legs.

### 10.3 Invalidation, notes and caps

| Change | Redo | Keep | Hold |
|---|---|---|---|
| A place moves **before P8** | P5 maps + twins; the mockups of every camera that sees the place (the schematic's sightlines) | other places, the bible, concepts | — |
| A rung-2 move **while P8 is open** (the slope fallback, inside its region; also zero-shot's rung 3) [R4-A5, R4-C3] | `design.md` + `spec.json` (twin-check), its region disc, pad, routes, camera, T5's bands, stand-ins and content anchors, the bakes, walk legs + reach | the approved mockups (P9b re-targets from the moved place), other places | — |
| A place moves **after P8** (only by Jake's note: from P9 on, neither the judges nor a gate's fallback move a place) | `design.md` + `spec.json` (twin-check), the painted map (its region disc stamped at the new spot, T3), the region bake, terrain (T4), its pad and the graded routes to it, its camera, the polish bands (T5), its stand-ins, content anchors and happening spots, the bakes, walk legs + reach + T16, its P9b target and every target whose camera sees it, its placements. **Neighbours** = places sharing a route leg with it. On the critical path → Jake replays P9 (his note asked for it) | other places' finished work | that place's and its neighbours' P10–P13 work |
| A place is added or cut | as "moves", plus spec-check's role and count rules; an **added** place also gets its concept (P4, judged) and its mockup (P6, judged), then its P9b target | — | as "moves" |
| A beat or the slice changes | design.md, spec.json, P8 content rows, T16; P9 replay when the slice changes | the world, the bible | P10–P13 for the beat's places |
| The verb is cut (P7) | P2's verb line, the slice, and the concepts, content boards and views that show the verb (D57) | places, the bible, the map, the other concepts | — |
| **The look changes**, **before P9b** (a palette / light / materials note) | bible v2 (an edit of the bible, not a new P3); the concepts and mockups already made, re-edited in v2 (judged); later stages simply use v2 | layout, content, the design | — |
| **The look changes**, **after P9b** (such a note, or a re-look at P16 / P17) | bible v2 → **P9b targets re-edited in the new look** (the old target as input) → re-post generated models → restyle code models' materials and the kit look (E6) → P13 models' post → card art → the style check → P10 → P12 compares → P14 → P15 → P16 (a new board and a new physical reading); only what exists is redone, later stages use v2 [R4-C15] | layout, colliders, content logic, world data | P11–P12 sign-offs |
| A note naming one asset | that asset; a bible **exception line** (no re-check of others) | everything else | — |
| A note (anything else: tuning, audio, a quest step, a chest, wording) | the named thing; its checks re-run (T9 / T16 / the budget) | everything else | — |

**A note reopens a gate** when it moves, adds or cuts a place, or changes a route, a beat or the slice. Jake's note is
itself the decision, so it is applied (the rows above), not asked back; only a note that is ambiguous gets one
clarifying question. A palette, light or materials note is **taste**: it takes the look rows directly.

**Notes override taste** (the bible, the judges), **never a hard gate**. A note that would break one (a budget, walk 0
stuck, T9) goes back to Jake with the number.

| Question | Answer | Cap |
|---|---|---|
| P2 pitches | a pick, or a mix | reject-all → three new pitches once, then stop |
| P3 directions | a pick | reject-all → three new once, then stop |
| P4 concepts | approve / strike per image | ≤ 2 loops a group |
| P5 map | approve / revise one thing | ≤ 2 loops |
| P6 mockups | GO / revise one thing | ≤ 2 loops, then "go with gaps" or stop |
| P7 verb | yes / no | 2 "dull" → the verb is cut |
| P9 slice | yes + one note / no | ≤ 2 nos, then the beat's kill rule |

### 10.4 Hard gates, soft gaps, and the ladders

**Hard** (never marked done while failing):
- walk legs 0 stuck (non-empty) and every non-walk leg's test;
- every place's pad walkable (R5), its gentle-ground share reported;
- sightlines;
- T9's checks (sits right, clear zones, signals, traversal views, D25 musts);
- places-in-region;
- reach of every place, slot and happening;
- the budget gate (R28);
- **no off-style asset placed**;
- colliders present;
- T16's slice and golden path, and the boss when the scope holds it;
- any confirmed must-fix.

**Soft** (logged, then on the gap board):
- ΔE above target after 3 rounds;
- judge preferences;
- minor look defects.

**The hard-failure ladder:**
1. a local fix;
2. **the gate's fallback** (below);
3. a decision, by §5's table: guided before P9 → Jake; zero-shot before P9 → the judges (a place may move inside its
   region); from P9 on → **the judges, inside the approved design**, posted as "decided for you";
4. a fix beyond those bounds: guided → a blocked Handoff before P9, a **blocked branch** from P9 on (asked at P16);
   zero-shot → the judges, logged.

| Gate | Fallback |
|---|---|
| budget | 04 §10's seven levers in order; a round applies the next lever(s); ≤ 4 rounds |
| slope | the place-pad ladder (R5): raise the region's edge ramp; while P8 is open, move the place inside its region (§10.3's rung-2 row); from P9 on, re-grade or bench within R5's limits, never move the place; else rung 3 |
| sightlines | move the blocking dressing; raise the landmark or the signal until the line is clear; else rung 3 |
| T9 | per check: re-seat (pad), trim dressing, move along the ray, or swap the model |
| walk / reach | re-grade or bench the leg, then move the blocking dressing |
| places-in-region | stamp the place discs (T3) |
| T16 | fix the content row or the anchor |
| colliders | a box collider from the bounds |
| style | rungs 1–3 are rounds: (1) re-post; (2) a new reference conditioned on an anchor; (3) the other engine. Then, once each: (4) a kit or code model. (5) **Dressing or scatter** that still fails is **not placed** (logged). A **required** slot (a D25 must, the landmark, a vista's hero, the boss, an NPC or prop on a quest step) never stays empty: it takes the sketch kit's stand-in restyled to the bible's palette, which the judges accept as a logged gap; T9's sketch check exempts it; a quest prop takes E8a's prop block [R4-B10] |

### 10.5 The slop score

| Size | Means (first match wins) |
|---|---|
| L | it reopens a gate |
| S | a fix at one spot |
| M | anything else |

- **Each note** gets its size and a one-line reason before the baseline freezes.
- **The score** is the counts per size.
- **The baseline** (the note ids + the build SHA) is frozen in `design.md`. Fixes are recorded beside it.
- **The target:** none L.

### 10.6 Image engines per kind, and counts

| Kind | Engine | Count (a full shard) |
|---|---|---|
| Pitch and concept explorations, do / don't drafts | Qwen (local, a neutral grey reference) | ~200 |
| Key art, final concepts, direction views | codex | ~40 |
| Layout maps, the illustrated map | codex | ~4–8 |
| Map waves (P5): 3 maps + 3 views each, a revision's map + one 3-in-1 | codex | ~15–25 |
| Content boards (P5b): 3 wildcards × ~12 steps, two rounds | codex | ~50–80 |
| First-person views (P6) | codex | ~12–20 |
| Targets (places + close-band route legs) + two 3×3 grids per hero view (P9b) | codex | ~50–80 (+ tile upscales ~100–200) |
| Compositions (places + route legs, P12) | codex | ~30–50 |
| Isolated references (P11, P12) | codex | ~40–60 |
| **Total** | | **codex ~400–600; Qwen ~200** |

codex runs 4–6 at once (AGENTS.md ▸ Mockups): T14 adds `--max-parallel` to `scripts/horizon-matte/run_codex.py`, which today launches every
job at once and ignores unknown flags.

### 10.7 Waiting and resume (R23)

- **`design.md` §run holds:**
  - `mode` (guided / zero-shot), `until` (the bound, if any), and P0's answers;
  - `step`, `waitingOn` (with its time) and `resentAt`, `next`;
  - `stop`, set before a session exits: `continue` (unfinished and healthy) / `done` (the bound or P16's board
    reached) / `blocked` (a terminal Handoff) / `quota(<reset>)`; T18 reads it, and a resume after the reset clears
    a consumed `quota` [R4-C8, R4-C9, R4-K3];
  - the last build SHA;
  - the live page's URL;
  - the frames folder;
  - the pending board and question;
  - queued commands.

  Update it at every step boundary. Keep the ask's Status line and the Handoff current at every commit.
- **Before asking Jake**, start everything that doesn't need his answer (background jobs, subagent briefs). Then
  either ask (AskUserQuestion blocks the session), or post the board to the live page + chat and end the turn, taking
  the answer at the next step boundary like a note. The ask's Status reads `needs pick`.
- **The wake-up:** every session's start reads §run.
  - **A pending Jake decision** (`waitingOn: jake`): look for his answer in chat (the pages are read-only). No answer → hold
    (don't advance; work only on what doesn't depend on it); older than 48 h with no `resentAt` → re-send the board once and record
    `resentAt`; `resentAt` older than 48 h → stop with a Handoff (`stop: blocked`). An answer clears `waitingOn` and goes into the verdict log (ask id + a one-line quote) before
    the run advances.
  - Anything else: continue at `next`, within `until`.
- **A codex quota stop** records the reset time in §run (`waitingOn: codex-quota`, `stop: quota(<reset>)`) and stops. The next session resumes
  after the reset.

