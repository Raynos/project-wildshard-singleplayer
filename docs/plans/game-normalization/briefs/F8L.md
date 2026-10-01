# E357 job F8L — the leak test to green (02 F8 step 6; 01 §4; 03 §5.5)

Read `docs/plans/game-normalization/brief-common.md` first: its rules bind you, **except: you run the narrow leak check
in the browser as often as you need** (`scripts/browser-lane.sh --max 15 node scripts/parity.mjs --export=<sha>
--lane=m5 --shards=<slug> --tiers=phone --only=walk+combat+leak --out=/private/tmp/e357-f8l/<n>`; long runs in the
background of your own shell; close what you open).

## The job
F8 is built except its leak test. The last F8 handoff in `docs/tasks/asks/E357.md` (sol-f8) has the diagnosis. On
`c7eaa8b4` / `1bc40056`, Pine Hollow phone: `leak.geometries` 0 → 4, `leak.textures` 0 → 173, `leak.programs` 0 → 10,
`leak.timers.timeouts` 0 → −1; the weather leak the same (4 / 166 / 10 / −1). Everything else is green.
- 01 §4's rule decides what counts: **level-owned** resources must return to B0; **engine-retained** ones (the renderer,
  the sky rig, the composer and its render targets, the title's assets, and acquired assets the engine still references
  — shared texture / model caches included) are not counted. A resource that is level-created and never freed is a real
  leak: free it on unload (decision 4: a found bug, fixed with a test). A resource that is engine-cached must be
  recorded as retained (through `app.assets` / the census's retained set), not hidden.
- Work out, for each of the 173 textures / 10 programs / 4 geometries, which it is (F8's hints: render-target depth /
  colour textures, detached or replaced materials, texture-source variants vs the retained source records; the −1
  timeout is a fixed outside-engine baseline timer expiring). Fix the census or the unload accordingly.
- Then make all four shards green on the narrow leak check (phone), plus Nalati's storm and Pine's rain weather leak.
- **Never clamp or subtract an unexplained count.** Every exclusion names the engine object that retains it.
- Done when: the narrow leak check exits 0 on all four shards on your final SHA; `pnpm run typecheck`, whole
  `pnpm exec oxlint`, `node lint/ratchet.mjs` and `pnpm exec vitest run` exit 0. Report the SHA (the lead then runs the
  full record).
- Owns: `src/**` (the unload paths, the census, the asset service, loaders' cache registration) and `test/**`.
  Not `scripts/parity*` (a harness bug → `queued:` line).
