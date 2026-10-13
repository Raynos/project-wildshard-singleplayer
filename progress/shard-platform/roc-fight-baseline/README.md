# Storm Roc fight baseline (G393 clip check, sp-o130)

G393: step 7 moves Sky Reach's Storm Roc and the flock onto shared brain / boss rows (sp-x8, C4), the fight trace is
re-recorded, and an Opus clip check compares the fight with today's longer fight (G354, the 26,469-tick journey) before
it lands. This folder is the BEFORE side of that check, captured on HEAD `6e136f0b1` (a clean export served with
`scripts/serve-build.sh --rev`; its build id reads `6e136f0-m…` in the labels).

## What is here

| file | what |
|---|---|
| `facts.json` | the per-beat facts: `headless` (the canonical witness tape, exact) and `page` (the fight in the served build) |
| `clip.mp4` | the page fight's key beats at 15 fps, iPhone 16 Pro portrait, labels burned in (build SHA, frame, tick, beat, Roc HP) |
| `sheet.jpg` | 12 stills at fixed fight frames (`facts.json` `stills`), 6 × 2, each labelled |
| `frames.json.gz` | the page fight's per-frame log (Roc HP, boss state / phase / attempts, player HP, positions) |
| `repeat.json`, `repeat-diff.md` | the second baseline run's facts and compare.mjs's run 1 vs run 2 diff (the repeatability proof) |

## Baseline facts (6e136f0b1)

**Headless, the canonical tape** (endpoint hash `146505ca…` = `test/proof/far-reach/compatibility.json`):
endpoint tick **26,469**, victory **26,349**, crown reached at **8,888**, fight **17,461 ticks**, 1 attempt, 14 hits
taken in the fight (172 damage; 3 more on the journey), player HP never below 80, 3 stoops (ticks 9,283 · 9,941 ·
17,246). Encounter: fight p1 @8,888 (HP 420) → beat p2 @10,038 (277.2) → fight @10,129 → beat p3 @17,234 (138.6) →
fight @17,325 → victory @26,349.

**Page, the served build** (frames from the staged crown, 30 a second; tick = frame × 2): victory at frame **6,529**
(13,058 ticks, 217.6 s), 1 attempt, 15 hits (182 damage), player HP never below 86, 2 stoops (frames 287, 4,616).
Encounter: intro @1 → fight p1 @46 → beat p2 @454 (277.2) → fight @499 → beat p3 @4,610 (138.6) → fight @4,655 →
victory @6,529. The page fight is shorter than the headless one because it starts at the crown rim with a fresh
encounter and a page-side pilot; compare page with page and headless with headless, never across.

**Repeatability.** Two full baseline runs (four page sessions) give identical headless facts, identical page facts and
an identical per-frame fight log (Roc HP, boss state / phase / attempts, Roc and player positions, wisps) on every one
of 6,680 frames (`repeat.json`, `repeat-diff.md`: compare.mjs exits 0 on run 1 vs run 2). The one column that does not
repeat is the player's HP *between* hits: its regeneration runs on the wall clock, not the capture clock, so it is
kept out of the labels and the compared facts (hits, damage and the minimum still repeat). The stills are not
byte-identical but are the same picture: per-pixel channel difference ≤ 5 on most stills, ≤ 17 on ≤ 3 pixels near the
fan (JPEG and compositor noise).

The clip (25 s) covers the approach, every encounter change ±1–3 s, the first stoops of each phase and the fall; the
long middle of phase 2 (the gale walls, frames 499–4,610) shows only through the sheet's stills at 600–4,200.

## How the fight is driven

- **Headless (authoritative, exact).** `scripts/roc-fight/facts.mjs` boots the tree's own `runtime/headless.ts` plan and
  plays the witness's own `SkyTape` (`test/proof/far-reach/witness.ts`) from the spawn exactly as `run.mjs headless`
  does, observing only. Its endpoint hash equals `compatibility.json`'s headless hash, so it *is* the canonical fight.
  It reads the encounter from the `far.roc.encounter` adapter's continuation (`boss.state / phase / attempts`); if C4
  moves that state, adjust `encounter()` there (one function) and say so in the AFTER report.
- **Page (the look).** The served build has no tape replay, so `scripts/roc-fight/capture.mjs` stages the crown as play
  reaches it (`farReach.stage('quest-crown')`), puts the player on the crown's south rim with the War Fan, and an
  in-page pilot plays the tape's own `crown` leg once per frame (hold the crown under the bird within 17 m, face and aim
  at it, swing and GUST). The page runs on the parity harness (`scripts/parity/init.mjs`): pinned `Math.random`, the
  capture clock (1/30 s a drawn frame), frames released only by the harness. Each capture runs the fight twice in two
  fresh pages (pass A logs, pass B shoots) and records whether the two per-frame logs are identical.

## The AFTER check (sp-x8 / the next Opus lane)

On the candidate commit (landed or not), from your own scratch dir:

```sh
# 1. serve a clean export of the candidate (prints the URL; its export dir is /private/tmp/wildshard-serve/<stamp>/src)
SERVE_OWNER=<lane> scripts/serve-build.sh --rev <candidate-sha> --name roc-after
# 2. capture the AFTER (≈ 15 min; the headless facts come from the export's own witness)
scripts/browser-lane.sh --max 45 node scripts/roc-fight/capture.mjs --url=<preview url> \
  --out=<scratch>/roc-after --label=AFTER --tree=/private/tmp/wildshard-serve/<stamp>/src
# 3. compare against this baseline
node scripts/roc-fight/compare.mjs --before=progress/shard-platform/roc-fight-baseline \
  --after=<scratch>/roc-after --out=<scratch>/roc-compare
```

`compare.mjs` writes `diff.md` / `diff.json` (headline facts before → after with deltas, every encounter change side
by side), `sheets.jpg` (BEFORE sheet over AFTER sheet) and `clips.mp4` (BEFORE | AFTER clips). It exits 0 only when
every fact is identical. A re-recorded trace is *expected* to move ticks; the Opus check is that the fight still reads
the same: three phases at the same HP shares (1, 0.66, 0.33), the stoops of phase 1, the gale walls of phase 2, the dais
fight of phase 3, a fall, no extra deaths, and a fight length in the same range as G354's (headless `fightTicks`).
Open `clips.mp4` and `sheets.jpg` and look before you sign it off; commit the comparison next to the candidate's trace
re-record (`progress/shard-platform/roc-fight-after/`).

Rules: mute browsers (the script launches with `--mute-audio`), one browser lane, never a vite dev server, the
preview through `serve-build.sh` only, stop only your own preview.
