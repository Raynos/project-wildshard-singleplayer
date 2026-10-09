# Pine runtime-owner parity refresh (SF47-p, E435)

Content pin: `7d731563a2f792ffe01bfe93c4b63b095070d4ed`, including the Pine runtime-owner conversion `627c5edaf` and Progress/RuntimeFacts projection `70e2a5094`.

The three changed exact fields are intended persistence ownership changes:

| Field | Change | Shipping reason |
|---|---|---|
| `boot.saves.read` | adds `local:wildshard.save.v2.profile` | Pine facts bind to the same emitting platform Ledger, whose declared save scope is profile. |
| `boot.saves.written` | adds `local:wildshard.save.v2.pine-hollow` | The runtime-state binding migrates the current lodge / special-ammo / progress state at first boot. |
| `combat.loot.written` | adds `local:wildshard.save.v2.profile` | Combat facts persist through that platform Ledger; Progress is its projection rather than a second counter owner. |

The C26 migration tests in the conversion preserve earned progress, worn title, boss / elite records and item compatibility identities. These baseline updates acknowledge the intended storage keys, not a new gameplay policy.

## Official recordings

- gh-macos15 phone: [gpu-gate run 37864043008](https://github.com/Raynos/project-wildshard-singleplayer/actions/runs/37864043008), `record=true`, three full-profile runs, green and self-consistent. Only its Pine artifact is adopted, unchanged. Comparing against the old fixture gives exactly the three red fields above; no other structural, render, physics, walk, combat, HUD, input, sound or disposal field is red. Gate, cabin and pond old/new captures were inspected and retain the same scene and HUD.
- M5 phone + desktop: official `scripts/parity.mjs --export=7d731563a2f792ffe01bfe93c4b63b095070d4ed --record --runs=3 --jobs=1 --lane=m5 --shards=pine-hollow --tiers=phone,desktop --retry=0 --timeout=400`, wrapped in browser-lane. Both tiers green and self-consistent; minimum self-SSIM 0.9998967 phone / 0.9999406 desktop. Their old/new normalized comparisons also give exactly the same three save-key reds above and no others. All six old/new poses were inspected; scene and HUD are unchanged. The cache-hit retry completed without changing any deadline or assertion.

A first M5 attempt failed before capture with infrastructure exit 3: Vite preview missed its unchanged 30 s readiness deadline. No baseline came from that attempt. The original exit-3 report is committed as `pine-runtime-owner-preview-failure.json`; the retry uses the same content pin and official CLI with the completed build cache, unchanged assertions and deadlines.
