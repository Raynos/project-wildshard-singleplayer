# Conch4 tent attempt2: bounded harness correction

Status: source/tests only. Fresh root review, permission pin and GO are required
before any build/browser. Attempt1 source, host, pin and failed evidence remain
unchanged. No promotion or visual acceptance is claimed.

## Scope and corrections

The sibling source folder is
`art/driftwood-isle/approved-conch/public4-tent-attempt2/`.
One paired current-runtime build retains fixed PCF/tent entries, identical native
Conch4 product, geometry, binds, bones, AI/combat clocks, dimensions and rewards.
Only the existing first-use tent filter assignment differs between entry fixtures.
No runtime/model/physics/filter/product source changes. Retained original4 remains
byte-verified reference only: its partial old runtime inventory cannot establish
whole compiled-runtime parity. `runtime-source-comparison.json` retains that caveat.

Attempt1's comparison incorrectly treated attached `bindMatrixInverse` as static.
Three's installed `SkinnedMesh.updateMatrixWorld` computes it from each instance's
current `matrixWorld`. The new observer records bindMode and associated world
matrix alongside the initial inverse, and bindMode alongside every existing
trace/event matrix pair. The installed implementation is checked by the source
closure and its bytes are pinned with installed dependencies. The checker:

- Compares all invariant mesh fields exactly, excluding only world/inverse.
- Requires actual attached mode and finite, non-singular 4x4 world matrices.
- Checks every initial, rendered and event inverse against its own world inverse.
- Checks world × inverse and inverse × world against identity; absolute error
  ceiling 1e-8. Missing or corrupt matrices fail, rather than being waived.
- Keeps all four native skin weights, bone inverses and bind matrix in comparison.

There is no sustained disengaged idle in the unchanged Conch AI: stage0 pursues
or initiates an attack. Distance14 was still pursuit in attempt1. The new protocol
records initial-pursuit honestly, then observes native stationary post-strike
neutral/rest (stage2, strike idle, no flinch, pose attack=-1, speed below .05,
three consecutive frames spanning at least .4 simulation seconds). Both actors
must remain inside the room with a one-metre horizontal safety margin. The actor
must actually remain stationary. This is explicitly not ordinary idle. The original
sustained disengaged idle requirement remains unsupported/unproven and open.
All diagnostic player placement is checked against arena.center ±49 and y900;
no enemy movement/state/time is assigned. Follow camera remains diagnostic and
restored after each render, not ordinary first-person play.

Interruption trial labels never establish damage-at-boundary acceptance. The new
report lists actual pre-presentation positive-damage events, StrikeRunner phase
and elapsed time, behavior clock and previous evaluated pose per intended trial.
Unobserved/missed boundaries are explicit limitations. There is no retry/tuning
inside this correction to manufacture those boundary outcomes.

After comparison, actual reload is mandatory: a later document timeOrigin, fresh
Conch60/player100 entry, separately hashed reload trace/events/geometry/live data,
normal clocks, first-use/native shader proof, actual post-reload player damage,
and empty persistence. Offline verification recomputes the same evidence checks.

`completed` is scoped to supported combat/lifecycle and same-runtime filter parity;
it cannot close ordinary idle or missed interruption-boundary requirements.
`acceptance` remains false. Independent full-cycle movie review is required before
any promotion, and must disclose these open coverage limitations.

## Budget and preservation

Proposed single attempt2 envelope: one paired build, zero product bakes, one muted
browser, PCF short control plus full tent cycle, 600 browser seconds total, at most
600 seconds total portrait movie, 24 screenshots, 192 MiB aggregate new outputs.
Attempt1 remains separately retained. Real wall/engine/fixed-step clocks and full
movies are retained; decoded frame counts and real engine cadence are separate.
Cloud cadence is not phone performance and cannot establish comparative GPU speed.
Use existing heavy/browser locks; preserve failure and close owned resources.
No automatic rerun, repin, source tuning or deletion of either attempt's evidence.

New paths:
- Pin: `tmp/conch-public4-tent-attempt2/reviewed-build-pin.json`
- Host: `tmp/conch-public4-tent-dist-attempt2`
- Capture: `tmp/conch-public4-tent-attempt2/capture`

## Source validation and commands

21 focused tests currently pass, including corrupt/missing/nonfinite/singular
binding matrices, different valid live transforms, rest false positives, mislabeled
interruption events and missing reload evidence. These are source/refusal tests,
not runtime proof. Existing exact native admission and shared-entry tests pass.

Source-only:
```
node --test art/driftwood-isle/approved-conch/public4-tent-attempt2/*.test.mjs
node art/driftwood-isle/approved-conch/public4-tent-attempt2/build.mjs --check-source
```

Only root after complete review:
```
node art/driftwood-isle/approved-conch/public4-tent-attempt2/build.mjs --pin-reviewed "exact root GO reference"
node art/driftwood-isle/approved-conch/public4-tent-attempt2/build.mjs --check-pin
WS_HEAVY_ROOT="$PWD/tmp/heavy-lanes" python3 scripts/heavy-lane.py build -- node art/driftwood-isle/approved-conch/public4-tent-attempt2/build.mjs --build
HOME="$PWD/tmp/dot-audit" PLAYWRIGHT_BROWSERS_PATH="$PWD/tmp/dot-audit/playwright" PATH="$PWD/tmp/dot-audit/bin:$PATH" bash scripts/browser-lane.sh --max 15 node art/driftwood-isle/approved-conch/public4-tent-attempt2/capture.mjs
node art/driftwood-isle/approved-conch/public4-tent-attempt2/verify-capture.mjs
```
