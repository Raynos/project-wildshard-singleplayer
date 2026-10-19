# Bellback anatomy3: contact passes; attack cycles remain unproven

Independent offline review, 2026-10-19. Candidate remains **runtime-unaccepted WIP**.
This reviews the exact candidate3/build1 capture, not a new browser run, a physical
phone test, a likeness re-score or a human-fun evaluation.

## Verdict

The anatomy-only correction clears the floor throughout the captured collapse and
settles with plausible near-ground feet. Independent reconstruction agrees with
the original report. This is a narrow geometry/contact pass, not planted-foot,
collision, animation-quality or complete combat acceptance.

The capture does **not** contain complete Bellback attack cycles. It contains one
interrupted pulse windup, repeated player sword hits, enemy death, corpse settling,
and one Retry. No pulse active/recovery, echo, or stomp appears in the trace.
Consequently earlier attack evidence cannot be silently promoted to this exact
product/host combination.

## Exact evidence and method

- Product: `1f6d7ce33de9e3f2113fe632ac65c252ceb8953b6b9e0720f40357b268fb1bf3`.
- Practice host: `ee97d17f4e90e7a74454055baefa167006122cd2299b5e614d8ce63603906dec`.
- Source closure: `295e2fa160cd2883be69508c69b88f5525d35cb1795fe95a1f3b38525ab7c712`.
- Build evidence closure: `85b676f9c68a5659bdd4e38a7cc13e244c50c132c918e7ca7d9b592d668839a1`.
- Raw WebM: `ee887ab6e2b09cd21e565633c253774a6e64843f9679576abc3918420bb15809`.
- Every encoded frame 0–1246 was inspected on 21 consecutively numbered sheets;
  frames 750–797 were additionally inspected at larger creature-crop scale.
  Sheets are temporary review material, not replacements for the motion source.
- Independent Python/NumPy reconstruction uses captured world matrices, quaternion
  parent hierarchy, inverse absolute bind translations, and native vertex arrays.
  It verifies all skin weights really are single-joint unit weights before using
  rigid transforms. No Three.js or original measurement implementation is invoked.
- Both supplied closures' listed files matched their hashes. Source inputs and
  review products are pinned in the neighboring independent-review manifest.

The diagnostic camera is offset only during rendering. The recorder also explicitly
repositions the player before sword attacks and hides the viewmodel. This is useful
full-body evidence, but is not ordinary first-person play or a natural approach test.

## Geometry and defeat

13,374 vertices × 449 actual render observations, including 145 dead observations,
were reconstructed against ground Y=900. Minimum is numerical zero
(−1.14e−13 m), with zero observations below −5 mm. After the fold reaches its
endpoint, minimum clearance is **+2.3916565 mm**. Independent per-part minima differ
from the original by at most 1.14e−13 m.

The 92 frozen observations span game time 25.2111–32.6837 s. Settled minima for
leg0/1/2/3 are **19.381 / 2.395 / 18.853 / 26.621 mm**. Three feet fall within the
20 mm near-ground convention; the fourth is 26.6 mm clear. These are nearest
vertices, not proof of broad sole support, friction, a support polygon or zero slip.
All original rigid parts remain above the floor in the supplied per-mesh analysis.

Enemy death begins at observed frame245, game time21.0239; state6 follows at246.
The normalized death clock reaches1 at255; the body continues settling until298.
The original engine-side getVertexPosition envelope provides useful corroboration:
entry/retry minY900; sword-result900.244537; corpse900.002395, each13,374 vertices.
The early collapse visibly folds very quickly, with part of the transition masked
by the white hit flash. It then tips/settles as a fairly rigid assembled object.
The stable final crouch is a meaningful improvement over a buried corpse, but the
one-piece limbs and abrupt tuck still lack articulated weight transfer.

## Actual cycles, cadence and coverage

- Frames5–39: idle/approach. Frames40–46: pulse windup only, game2.7228–3.2795 s.
- Frames47–244: living stagger state4, game3.3795–20.9239 s. The state clock resets
  13 times during repeated hits. This supports repeated interruption behavior;
  it does not establish a clean stagger recovery back into offense.
- Frames245–389: enemy death and settling; frame245 still reports state4, then6.
- Frames390–453: Retry into a fresh living state0 enemy. No second battle completes.
- Encoded video frames758–763 show the lethal hit flash;764 onward exposes the
  crouch/fold. Corpse settling and camera-relative orientation changes continue
  before the long stable hold. Retry is visible around encoded frame1082.

The WebM is402×874 at25 fps with1,247 encoded frames (49.88 s nominal). This is not
25 distinct simulation renders per second. The449 observation timestamps span
45.4328 wall seconds versus37.9524 game seconds: **9.861 observed renders/s**.
Render interval median96.1 ms, p95 178.885 ms, maximum332.5 ms. Positive state-clock
increments are0.1 s. Game-frame deltas are capped at0.1 s in this trace. Repeated
encoded images cannot supply missing intermediate poses; the coarse observed
cadence limits smoothness judgments and can mask short contact excursions between
observations. These are diagnostic cloud-capture measurements, not phone performance.

The report's `actualEnemyDamage` check compares Bellback HP against180: it proves
player damage **to** the enemy. Player HP remains100. The capture cannot establish
successful enemy damage, dodge/block responses or complete pulse/echo/stomp timing.

Verified receipt outcomes: enemy defeated;12 practice-local coins; no observed
post-death strike; Retry restores180 HP enemy and0 coins; local/session storage
remain empty; state-store snapshots remain empty/unchanged. These are one-bout
outcomes. Page reload, persisted-return behavior, player defeat, repeated Retry,
second complete enemy defeat and natural moving-target cycles are not covered.

## Scoped five-point judgments

These are reviewer judgments of this capture, not a combined completion score.
1 means seriously deficient;3 means serviceable prototype;5 means polished in scope.

- **Captured ground-clearance/settle:4.0/5.** Strong exact geometry proof and stable
  hold; fourth foot floats2.66 cm and genuine sole/support contact is unproven.
- **Collapse readability/weight:3.0/5.** Distinct defeated silhouette and stable
  endpoint; snap-fast fold, flash masking and rigid whole-body tip weaken weight.
- **Idle/approach motion:2.5/5.** Recognizable small head/bell motion and short gait;
  low amplitude, rigid torso and coarse capture cadence limit convincing locomotion.
- **Hit/stagger readability:2.0/5.** Hits register strongly through flashes, but
  repeated mostly stationary stagger dominates; little bodily recoil/weight shift.
- **Observed Retry/reward clarity:4.0/5.** One clear reset and consistent local
  reward receipt; reload and repeated-bout robustness remain untested.

Complete attack-cycle animation: **not scored**, because no complete cycle occurs.
No aggregate, likeness promotion, phone-performance or human-fun score is implied.

## Recommended next proof

Keep this contact result. At the next authorized actual capture, allow uninterrupted
pulse→echo and close-range stomp through tell, active and recovery; include moving
approach, an interrupted attack with eventual recovery, player defeat, enemy defeat,
Retry followed by another bout, and reload/empty-store verification. Preserve exact
product/host pins and full-body geometry tracing. Improve the rushed tuck and rigid
stagger motion only after that evidence identifies the real remaining weaknesses.

## Reproduce

From repository root run the neighboring
`art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate3/independent-review/reconstruct.py`
with Python and NumPy. It writes `geometry-and-cadence.json` only. The video ledger
records sheet-generation commands and all inspected encoded-frame ranges.
No game/engine/model, Git, remote or Site changes were made for this review.
