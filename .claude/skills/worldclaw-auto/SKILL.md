---
name: worldclaw-auto
description: DRAFT (E359; plan stage, usable only after GAME-NORMALIZATION is archived and WORLDCLAW-SHARD's rows land). Build a WorldClaw shard ZERO-SHOT from one sentence - the same steps as worldclaw-interactive (pitches, style, concepts, the map from a 3D blockout, the content boards, first-person views, the grey world, the build on every seen band) with the judges deciding every pick and no questions to Jake, under content caps, launched and relaunched across sessions by T18. Jake sees the final (or partial) board and the time-lapse, then walks it. Use for "/worldclaw-auto zero-shot <sentence> [as <slug>] [until P<n>]", "/worldclaw-auto zero-shot <slug> until P<n>", "/worldclaw-auto resume <slug>" (T18's relaunch), and the plan's P18 / P19. Guided runs use worldclaw-interactive.
---

# WorldClaw, auto: a shard from one sentence (zero-shot)

Binding docs: `docs/design/worldclaw/06-shard-flow.md` (§8 zero-shot, §10.7 waiting and resume), the plan
`docs/plans/WORLDCLAW-SHARD.md` (D51, R18, R33, T18), and **`worldclaw-interactive`**, whose steps this skill runs.

## 0. Dispatch, in this order

1. **Launcher:** this session has no `WORLDCLAW_WORKER=1` → don't run the shard here. Take the named shard's slug,
   else pick one from the sentence, start **T18** in a herdr pane or with `run_in_background`:
   `scripts/worldclaw/zero-shot.sh "/worldclaw-auto zero-shot <sentence> as <slug> [until P<n>]" <slug>`
   (P19: `"/worldclaw-auto zero-shot <slug> until P8"`), and report. T18 runs each worker as
   `env -u HERDR_PANE_ID WORLDCLAW_WORKER=1 claude -p --permission-mode bypassPermissions "<invocation>"`; a worker never
   sets the status line and never starts T18.
2. **Zero-shot on an existing shard** (`zero-shot <slug> until P<n>`): set §run's `until` to the new bound, keep
   `mode: zero-shot`, then resume.
3. **Resume** (`resume <slug>`): read §run (`mode`, `until`, `step`, `waitingOn`, `next`) and the last Handoff.
   `waitingOn: codex-quota` before its reset → stop with `stop: quota(<reset>)`; after it → clear and continue.
   Otherwise continue at `next`; at `until`, or after P16's board, stop with `stop: done`.
4. **A new run** (a worker's `zero-shot <sentence> as <slug> [until P<n>]`): check P0's needs (06 §10.2), claim the ask
   (`scripts/ask-new.sh` in the main checkout), create the draft shard and `design/design.md` with §run's
   `mode: zero-shot` and `until` (as `worldclaw-interactive` §0 step 4), then run the steps below.

**Before every exit,** set §run's `stop`: `continue` (unfinished and healthy), `done`, `blocked` (a terminal Handoff) or
`quota(<reset>)`. T18 relaunches `/worldclaw-auto resume <slug>` on `continue` and after a quota reset, stops on
`done` or `blocked`, and stops after two exits at the same `step`.

## The run: worldclaw-interactive's steps, with these changes

- **No questions, ever** (no AskUserQuestion). P1 is the sentence. Every pick of P2–P6 (the pitch, the direction, the
  concepts, the map variant, the journey structure, the content boards, the views) is the **judges'** (interactive §J),
  logged in `decisions.md` with the scores.
- **Existing verbs and controls only:** no P7, no moved toys. **Content caps:** a kit weapon, ≤ 1 new species, the boss
  on a kit stand-in, ≤ +3 agent-days of adds in all; prefer quest-board mechanics the engine already has (D73).
- **The gates:** P8 as interactive; P9 is judged from the route strips and T16's log; P9b as interactive.
- **The build:** no checkpoints per place; the judges decide (06 §5: rungs 3–4 are the judges', logged).
- **Delivery:** nothing goes to Jake until the end, unless the invocation asked to follow along. "until P<n>" stops
  there with a partial board. At P16 the final board and the time-lapse go to Jake as one set; P17 (his first walk)
  and the `experimental` status need him.
- **The gate exemption:** the shard stays hidden until Jake's word and leaves the exemption at P16 (R33). A run bounded
  before P16 (P18, P19) stays exempt; P18's shard is deleted after P19's board.
- **Subagents:** a subagent never runs a zero-shot shard (the judges are subagents, one job each).
