# E357 job F2c — make the parity record green (03-harness-gate.md §0–§12; 02 F2 steps 7–8)

Read `docs/plans/game-normalization/brief-common.md` first: its rules bind you, **except: this job is the harness, so
you run the harness in the browser as often as you need** (always through `scripts/browser-lane.sh`, `--mute-audio`,
never a vite dev server; close what you open). Long runs (> ~4 min) go in the background of your own shell, not a
blocking wait.

## The job
The lead ran the first full record, `scripts/browser-lane.sh --max 150 node scripts/parity.mjs --record --runs=3
--lane=m5 --tiers=phone,desktop --export=891d31f1bb0f4e3c9f63f4f9ed721e212148d0c6`, and it went **red with 45 rows**
(the record's run-to-run comparison and its absolute rules). The report is
`progress/parity/891d31f/report.md`, the per-run JSON in `progress/parity/891d31f/run-{1,2,3}/`. The rows fall in four
kinds; fix each at its cause so the record is green and the baselines are trustworthy:
1. **Compare bugs**: equal values shown red (`boot.scene.totals.batched` 2 vs 2, band `0`; `walk.legs.*.out` 838 vs
   838; `walk.stuck` 1 vs 1). Fix `scripts/parity/compare.mjs` and add the case to `test/parity-compare.test.ts`.
2. **Non-deterministic fields** (event sound multisets, `combat.kills`, `combat.loot.written`, `walk.touch.dodged`,
   `boot.audio.requests`, `pauseResume` details): first make the run deterministic where 03 §6 says it must be (the
   seed, the pins, `harnessHold`, the clock); only a field that is noisy **by nature** gets a band or a set compare, and
   03 decides which (§2 field classes, §7). Never widen a band to hide a real difference.
3. **Broken scripted steps**: Nine Dragon's pause/resume state has the player falling (`vel.y` ≈ −70, `y` ≈ −106):
   the harness posed it off the ground or the fall leg ran into it; its escape leg goes out of bounds (`out` 838 / 425);
   its swing hits the training dummy 0 times; Nalati's bow shot hits the wolf 0 times; Nalati's `leopard-cave` leg is
   stuck at waypoint 0 on both tiers (check `scripts/physics-route.json` — the start may be inside geometry). Fix the
   harness side (poses, routes in `scripts/physics-route.json`, the scripted steps) so each step does what 03 §3–§5
   says. If a step fails because the **game** has a real bug (not the harness), don't fix the game: record it in your
   report with evidence, quarantine that field per 03 §12 with an owner note (`test/parity/quarantine.json`), and the
   lead files the ask.
4. Anything else red.
- Iterate with narrow runs (`--shards=<slug> --tiers=<tier> --runs=1 --out=/private/tmp/e357-f2c/<n>`, `--only=…`),
  then finish with the full record on the newest commit that holds your fixes:
  `scripts/browser-lane.sh --max 150 node scripts/parity.mjs --record --runs=3 --lane=m5 --tiers=phone,desktop
  --export=<that sha>` — green. **Don't commit the baselines** (the lead does, after checking them); leave them in the
  working tree and give the SHA you recorded on.
- Owns: `scripts/parity.mjs`, `scripts/parity/**`, `scripts/physics-route.json`, `test/parity/**` (except baselines),
  `test/fixtures/parity/**`, `test/parity-compare.test.ts`, and the parity sections of 03 when 03 itself is wrong (one-
  line fixes citing this job). **Not `src/`**: sol-f8 is rewiring it right now. If the probe (`src/engine/debug/probe.ts`)
  or a tap must change, write exactly what and why as a `queued:` line; the lead routes it.
- Done when: the full record exits 0 on your final SHA; `test/parity-compare.test.ts` passes; tsc (`-p .`, `-p
  scripts`) and oxlint clean on your files.
