# Independent captured-pose admission review

2026-10-19. **Scoped GO for an isolated actual candidate evaluation only.** No
source blocker found. No product adoption, contact-quality, visual, terrain,
phone-performance, or full-build acceptance is granted.

## Independent result

- Re-ran all five focused suites independently, one worker: **157/157 passed**,
  including **52 unchanged exact no-recipe legacy parity cases**. The combined
  first run also included three new diagnostic tests which initially failed;
  `test-run.log` preserves both facts rather than presenting it as a green run.
- After correcting the diagnostic method, **3/3 additional native tests passed**;
  see `native-probe.log`. This totals 160 successful assertions across the final
  applicable runs, not one all-green 160-test invocation.
- All 14 producer-manifest entries verified unchanged after its log normalization;
  exact hashes are in `source-freeze.json`. Source review covered the five edited
  runtime/schema files, manual contract and four edited focused test files.
- Producer's focused type-aware lint is green. This reviewer did not duplicate
  it, run full-root tsc, build, browse, write product/engine code or operate Git.
  Earlier full-root tsc exit 137 remains a failure to establish a typecheck.

## Source findings

Strict schema and native validation admit only absent policy or `captured`;
unknown values, extra keys and present undefined refuse. Nested copying preserves
policy and detached points. Captured mode retains numeric evaluator admission,
so it is not an arbitrary authored callback escape. Publication-policy mismatch
refuses before native allocation.

Every supplied bone, including non-collider bones, gets detached frozen local
position/quaternion endpoints. Captured fixed pre and render restore those exact
values; they do not read live pose inputs, evaluate animation or advance private
clocks. Scale is validated at capture and no supported subsequent corpse owner
writes bone scale. This is not a defensive reset against arbitrary outside scale
mutation. Root and child ownership remain separate; child publication does not
write the root and root publication does not animate children.

Prepared collider-local transforms remain unchanged, removing the animated
moving-contact surface rather than inventing its normal velocity. No root lift,
collider padding, delayed physics, extra body, final-pose jump, global switch,
new living behavior or product opt-in appears in this change. Existing cap and
missing-physics fallbacks remain; the captured promise applies to successfully
admitted corpse ownership, not a cap-rejected fallback.

The unchanged initial throw/spin, damping, mass 5, COM, physical inertia tensor,
world-only DEBRIS masks and one-body construction are covered by native tests.
Initial velocities compare exactly; integrated explicit-inertia results retain
existing floating-point tolerances. Immediate local completion permits ordinary
sleep/quiet settling without suppressing root motion. Fixed root endpoints,
MAX_T, pause, dropped backlog, scope/world retirement, per-part allocation
rollback, cap reuse and repeated bouts retain their existing owners and pass.

The actual Animal/Game composition tests exercise the lethal boundary before
later death decisions, both practice-update and retained-fixed-post deliveries,
near/far renders and repeated retirement. The absent-policy branch retains its
prior input-copy/evaluation/publication sequence. The no-recipe paths remain
outside the fixed corpse collection and all 52 old native traces remain exact.

## Stronger actual geometry diagnostic

The additional probe uses the committed actual 13,374 vertices, eight bones and
435-point recipe at scales 0.5, 1 and 2, with a nonzero root yaw/translation and a
different authored attack pose. It checks absent/captured prepared native shapes
for exact equality, 64 support directions per part, every original vertex against
every actual native convex triangle plane, and 100 fixed/render observations
with throwing live-input getters. Root transforms remain unchanged by child
publication; all local position/quaternion/scale values remain exact.

Maximum outward triangle-plane distance (meters):
- scale 0.5: 0.000000188740
- scale 1: 0.000000377480
- scale 2: 0.000000754960

Maximum sampled support difference is 0.000000096218 meters (scale 2).
These are sub-micrometer floating-point bounds, not mathematical zero.

The first diagnostic incorrectly required Rapier `projectPoint` distance below
2 micrometers. It instead reports up to 0.253377 millimeters at scale 2 for the
same unchanged convex input. Actual collider triangle-plane checks resolve this
as projection-query numerical behavior rather than evidence of a new captured
hull mismatch. The original failing output remains. Two intermediate attempts
used descriptor/cached-shape indices, which are null; those failures also remain.
The final probe obtains real indices from collider.indices() and vertices from
collider.vertices(). No implementation, geometry, production bound or guard was
changed to make the diagnostic pass.

## Reproduction and limits

Diagnostic source and config are preserved as `independent.test.ts.txt` and
`vitest.config.ts.txt`, intentionally outside the permanent production test
suite. To reproduce, copy each to its corresponding filename without `.txt` in
this same directory, then run from the project root:

```
WS_VITEST_MAX_WORKERS=1 node node_modules/vitest/vitest.mjs run --config docs/reviews/rigid-corpse-captured-independent/vitest.config.ts docs/reviews/rigid-corpse-captured-independent/independent.test.ts --maxWorkers=1 --reporter=verbose
```

The independent 157-case run used that config plus the five explicit filters
`test/rigid-corpse-{clock,schema,physics,input-order,default-parity}.test.ts`.
Logs retain tool-provided run time strings, which differ from the coordination
clock. Only workspace-prefix redaction and trailing blank-line normalization
were applied to log text.

Still required: exact candidate opt-in admission, actual varied lethal poses and
root contacts through complete settling, varied terrain, complete combat/retry
cycles, collision walk, full encoded-frame review and performance/phone evidence.
Frozen attack or gait silhouettes can look poor. This review approves testing
that tradeoff, not its taste or release quality. Preserve candidate4 and other
published hosts until a replacement earns its separate gates.
