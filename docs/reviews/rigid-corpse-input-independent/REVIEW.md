# Independent current-input repair review

Reviewed source tree: `444a3206c20fcd3b1aa61dacd9084a373109c810`.
Manifest base: `6f1a7daec2b12572fe4499704ea79e0502daef0e`.
Date: 2026-10-19 UTC.

**Verdict: safe to proceed with a bounded isolated actual preview. The prior
P1 permanent pre-death-memory defect is fixed. No new correctness blocker was
established in this review. This is not product adoption, ground/contact
acceptance, a physics-walk result, or phone visual/performance acceptance.**
Keep the production recipe disabled while obtaining that evidence.

## Independent evidence

All 14 entries of `combined0710-manifest.json` matched working SHA-256 bytes
before testing. [Source hashes](source-hashes.json) pin the manifest, 33 reviewed
source/evidence files and all 46 existing product-fixture files. The runtime
repair hashes are:

- `AnimalView.ts`: `e1fd783f39c14ccd17914ff3205ce69f883d9808bd86ac4e4c6149fb86883453`
- `rigidCorpsePose.ts`: `4334277f9a061f8fa0a19e7d512f12d219d62878d5761dede8716ccbe0fed375`

The unchanged prior auditor's `reproduce-stale-death-input.mjs` was rerun
against these bytes. All 15 pulse/echo/stomp checkpoints have exact zero bell,
clapper and foreleg deltas. [Raw result](reproduction.json) deliberately retains
the script's hardcoded `recipeTree` label naming the original broken tree;
that label is historical, not the tree executed in this repair review. The
source hashes here identify the actual inputs.

The independent one-worker, 4 GB run passed **128 tests / 5 files in 33.36 s**:
76 repair/input-order/clock/schema/physics cases and 52 default-parity cases.
[Test output](test-run.log) records the complete result. Focused type-aware
oxlint exited 0 with no diagnostics; [receipt](checks.json) records that result.
All 33 pinned source/evidence files were rechecked unchanged after both checks.
The runner's displayed
start time reflects its host clock; the review date follows the session UTC.

## Why the P1 is closed

`AnimalSim.applyFinalDamage` still creates the corpse through `died` before
`damaged`; no combat or event order was changed. `corpseInputs` now exposes only
current memory, gait phase, state and yaw through a trusted engine-owned view.
Each fixed evaluation copies that current memory, including replacement of the
entire actor record, and freezes both it and the evaluation context. The
admitted numeric evaluator receives neither the actor nor its live memory.
The earlier permanent constructor snapshot is therefore no longer authoritative.

The integration test executes the real Animal death hook, admitted Bellback
Wasm, PracticeCreature update and Game fixed scheduler/phase methods. It uses
native Rapier and the actual eight-bone pose, while bypassing browser/model
constructors. Practice delivers the queued hit and commits guest commands before
the next fixed pre. The retained-body fixed-post case correctly preserves the
10 Hz guest staging boundary: a call stages commands, the following guest tick
commits them, and the next fixed pre observes the reset. This matches
`DecisionHost.step` in `src/engine/script/decision.ts`; the test does not assume
that queuing a death event immediately writes actor memory.

The live guest integration starts from pulse. Echo and stomp reset correctness
is independently covered by the unchanged numeric differential and 48-step
numeric comparisons, not by three separate live-guest combat integrations.
Actual page-world authority remains alive-only and can retire its guest before
death callbacks. The test explicitly uses retained-body ownership and does not
claim to change or prove page-world death delivery.

## Boundaries preserved

- Structural dimensions, uniform scale, seed, position and look target remain
  detached construction inputs. Fixed evaluation owns t, deathT and flinch;
  render interpolation does not refresh inputs or advance those clocks.
- Invalid consumed numeric memory is rejected. Failed evaluation restores the
  last bone endpoint and leaves the pose clocks uncommitted; a corrected direct
  pose retry succeeds. In the owning ragdoll, fixed-pre failure retires the body
  rather than leaving an active partially published compound. This does not
  promise that an invalid owning ragdoll is automatically resurrected.
- Current scalar fields are copied; the compiler validates the numeric scalar
  observations it consumes. This is not blanket validation of every unused
  entry in arbitrary actor memory. Nested structural data is detached by clone;
  the inert admitted program remains the trust boundary.
- The registration check still refuses an arbitrary unregistered animation
  callback. Numeric programs with squash/scale outputs remain ineligible.
  Engine-owned test registration is not an authored callback admission route.
- Scope retirement, world teardown, repeated retirement and fresh bouts release
  the body. The integration fixture replaces retired actor memory with a
  throwing getter and verifies later fixed phases never read it.
- Actual Game pause/resume, three-step catch-up cap and dropped-backlog behavior
  are exercised; this is stronger than a hand-written accumulator, but does not
  boot the complete browser application.
- No-recipe rigid/upright/full-and-lite quadruped paths pass 52 exact exposed
  state comparisons against the pinned historical ragdoll source, including
  native physics, scale/cadence, freeze, cap and disposal cases. This closes the
  prior specific sampled default-path parity gap; it does not establish whole
  mounted AnimalView/gameplay parity or all-world/cross-device equivalence.

## Still required for acceptance

An isolated preview is the next evidence-gathering step, not acceptance itself.
Still missing are actual original-mesh varied-hit/yaw/scale/terrain contact and
interpolated support observations, exact-build 0-stuck physics walk where
applicable, full gameplay/loot/retry/storage lifecycle acceptance, and physical
phone performance/visual evidence. The live-guest integration checks collider
local translations; it does not independently compare every native collider
rotation/support point against rendered interpolation. These are coverage
limits, not newly demonstrated defects.

## Reproduction

From the repository root:

```sh
node --experimental-transform-types --import ./scripts/bake-loader.mjs \
  docs/reviews/rigid-corpse-contract-audit/reproduce-stale-death-input.mjs
NODE_OPTIONS=--max-old-space-size=4096 WS_VITEST_MAX_WORKERS=1 \
  node node_modules/vitest/vitest.mjs run \
  test/rigid-corpse-input-order.test.ts test/rigid-corpse-clock.test.ts \
  test/rigid-corpse-physics.test.ts test/rigid-corpse-schema.test.ts \
  test/rigid-corpse-default-parity.test.ts --maxWorkers=1
NODE_OPTIONS=--max-old-space-size=4096 node node_modules/oxlint/bin/oxlint --type-aware \
  src/engine/entities/rigidCorpsePose.ts src/engine/entities/AnimalView.ts \
  test/rigid-corpse-input-order.test.ts test/rigid-corpse-clock.test.ts \
  test/rigid-corpse-default-parity.test.ts
```

No production or test source was edited. No Git operation, build, install,
product enablement, browser, remote environment or Mac operation was performed.
