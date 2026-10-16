# KR1: net lines and scenario metrics

The output ruler keeps its custom percentage, AS budget, M3 and M2 rules.
KR1 adds report-only observations; it supplies no sharing credit or waiver.

`_summary.netLines` reports each wave's historical M0 custom counts and
current counts (explicitly labelled output or source), beside engine,
game and SDK line growth since that M0. `netCut = customCut -
platformGrowth`. Platform growth is counted once per wave, includes all
concurrent work and build tools, and is not allocated to individual shards.
Negative cuts remain negative; missing shard evidence leaves the net unknown.

This is an accounting comparison, not a physical repository shrink claim:
the custom numerator includes G294 sole-user platform charges, and the
historical source rule differs from today's output rule. The report prints
those limitations rather than silently treating a rule change as deletion.

The immutable reference points are in `scripts/wave-line-baselines.json`:

- W1: `adb48b6a0`, custom totals 3,158 Sky and 1,841 Signal, the sum of the
  nine component pairs recorded in `b9fb99185`'s coordinator State.
- W2: `68e7257951`, custom totals 22,996 Pine and 18,015 Driftwood, from
  `docs/plans/shard-platform/w2-m0-inventory.md`.

Platform totals at both dates use the ruler's comment-free, nonblank
physical-line unit: TS/TSX and standalone GLSL under engine/game/SDK,
excluding declaration files and tests. Generated source and build tools
remain included. Baseline bytes were read directly with `git cat-file`,
without exporting a checkout; current totals read the measured checkout.

Each shard also reports `scriptMetrics` beside its AS lines. The
`script-scenario/1` receipt records calls, total coarse fuel, maximum fuel
per call and refusals from real DecisionHost trace entries. It is bound
to the exact emitted `sim/scripts` hash and to the defining host/module/ABI
source bytes. Changed bytes, a wrong script id or a failed receipt cannot
supply observations. Missing matching receipts are unknown; absent v1
sections are not applicable. Separate scenarios remain separate rows;
these are scenario costs, not per-frame predictions or CPU milliseconds.

The qualified census at source `f23a82d97` is in `summary.json`. W2 custom
cut is 8,382 lines against platform growth of 20,356: net **−11,974**.
W1's historical comparison is −2,852 custom cut against 23,273 platform
growth: net **−26,125**. These negative values remain visible, with the
counting-basis limits above; no new regression or causal deletion claim
is inferred from them.

The Template observation has 13 calls, 4,113,830 total coarse fuel,
391,906 maximum fuel per call and zero refusals. The other products have
no v1 scenario metric credited in this receipt. One official ten-product
build and a subsequent no-build reread verified the report against actual
output; six focused checks, root TypeScript and typed lint passed.

The Template's existing seeded boss/save scenario optionally writes one
receipt after its assertions pass:

```sh
WS_SCRIPT_SCENARIO_RECEIPT=<owned-scratch>/script-scenario.json \
  pnpm exec vitest run test/scripts/_template-boss.test.ts
node scripts/shard-platform.mjs --json \
  --script-receipt=<owned-scratch>/script-scenario.json
```

Run these in the build mirror on the same immutable tree. A normal report
discovers committed `progress/shard-platform/**/script-scenario.json`
receipts; repeat `--script-receipt` to supply explicit paths in a mirror
that excludes progress files. The receipt here comes from the actual
Template scenario, seed 437, including logical save continuation.

Focused tests cover section corruption, stale section/host hashes, wrong
script identities, failed/empty receipts, negative cuts and absent shard
evidence. No fixture ceiling or product admission was weakened.
