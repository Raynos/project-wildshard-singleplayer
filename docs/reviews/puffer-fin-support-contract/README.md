# Puffer fin support contract audit

2026-10-19. Read-only diagnosis. **Blocked under unchanged authored animation.**
No implementation, physics run, build, browser, public host, Git or Site change.
Only this review directory is authored. Exact source/telemetry excerpts and SHA256
pins are in `evidence.json`. This is not physical or animation acceptance.

## Actual cause

The isolated source identity is `puffer-closed-anatomy-98c4855852fc`, rig
`closed-anatomy-rig1`, product sourceHash
`99a69f9d3fc61912beaf08db8e7d67456756773976bb9a199dbd033910d610ed`.
The retained app is `tmp/puffer-closed-anatomy-rig1-app-attempt1`.

`AnimalView.startRagdoll` (src/engine/entities/AnimalView.ts:330–344) selects
`rigid` for this custom rig. Its dimensions omit both capsuleAxis and rigidCorpse.
`Ragdoll.constructor` (src/engine/physics/ragdoll.ts:225–245) therefore creates
one root body with one cuboid, not a fin support shape:

- Half extents: (0.9789999723434448, 0.30000001192092896,
  0.8693322053090293), actor scale1.
- Root-relative center: (0, 0.36000001430511475, 0).
- It has no bone-follow transform and no finR collider to become stale.
- Root frozen Y899.9400024414062 puts the almost-upright box lower face about
  floorY900. This is consistent with the recorded root settlement; it is not a
  replacement world-contact calculation or a proposal to move the root.

`AnimalView.updateRagdoll` (349–357) continues numeric authored limb/body posing
when custom, near and !fixedPose, including after the legacy root freezes.
`pufferNativeClips` emits body Y=bodyY+0.09 at full death, rollZ=0.35 and
scaleY=1−0.40*deathT. Fin channels return to zero rotation. The fin inherits the
body's deformation; its own local scale1 does not make its world transform rigid.

Retained exact rows:
- f609 lethal: deathT0, bodyY0.6198077804112894, scaleY1, body rotationX
  −0.0029506533920991996, finR rotationY−0.0022388796586148394.
- f610: deathT0.125, body scaleY0.95, rollZ0.04375.
- f639 frozen: age2.7845000000000013, bodyY0.6900000238418579,
  scaleY0.6, rollZ0.35. finR local position
  [−0.4300000071525574,−0.10000002384185791,0.16], rotation[0,0,0].
  Its world origin is [−1.2871731537670725,900.4262006503724,−6.278211297855813].
- f666 has the same body/fin/root transforms. The evaluator's time continues,
  but the fully dead pose has reached constant channels. There is no evidence
  that continuing post-freeze pose drift causes this endpoint defect.

The existing `world-contact.json` reports the actual persistent frozen defect;
parent independently localizes all43 >1mm penetrations to the connected finR,
worst local292/runtime9466, weight1 to finR, 41.585511mm below slabY900.
No all-vertex rerun was performed here. The result is missing actual fin support
combined with continuing authored collapse relative to a root-only box, not a
wrong-transform bug in an existing fin-follow collider.

## Exact source and retained public70 comparison

The five inspected runtime files (AnimalView, ragdoll, rigidCorpse,
rigidCorpsePose, pufferNativeClips) exactly match the isolated app's retained
source-freeze hashes. The compiled practiceBoot-C18tnPKY.js SHA256 is
`1fbcd54c031a6374548f8cd3ee2cc59edf4a21d140a6b3953486fc14c327f246`;
it contains the same root-box branch, updateRagdoll ownership and rigid-corpse
scale guards. No inference from a different current build is needed for these behaviors.
The current channelPrograms.ts hash differs from its recorded build-source
pin (9a345126cbc74cac7a07eda3286dfe4957891f21b6d1a47ff75dab9f8dc6fc2d);
its no-scale admission rule was therefore checked directly in the exact compiled
practiceBoot bytes: `t.squash===void 0&&t.programs.every(e=>e.numeric?.outputs.every(e=>e.path[0]!==`scale`)===!0)`
precedes registration. No whole-file source-parity claim is made for that file.

Retained public70 rig1 native SHA256
`b985594b98035df3a006464d5af76b0f2b10eca076fa3366b9d94bc325ba1762`
and candidate native
`38e0ad4de8a25827ace7a366e70c3c21a860ce9221de64f4b4afaf0c27ec2b61`
have exactly equal complete ordered bone tables and all four complete connected
fin part payloads, including position, skin, color and fur arrays. Their gait5
dimensions files are byte-identical SHA256
`aac576c8ab54b45ef2beff42ceee591aeb41e70ac764fb1911bc51f7e59fd39e`,
with no compound recipe. This is source/shape parity, not a new public70 death
recording or a claim that the rest of either model is identical.

## Why adding a hull cannot satisfy the current pose

1. `src/game/plugin/channelPrograms.ts:154–156` registers fixed corpse animation
   only if squash is absent and every numeric output avoids the scale path.
   Puffer currently has three belly scale outputs and body scaleY. A conditional
   expression returning1 after death still fails this structural admission.
   `AnimalFactory.ts:366–369` rejects a compound recipe without this registration.
2. `rigidCorpseTransform` (rigidCorpse.ts:32–49) rejects any non-unit bone or
   ancestor scale. `prepareRigidCorpse` runs before body allocation, on the
   existing lethal pose. `RigidCorpsePose.step` independently rejects bone scale.
3. Existing compound geometry is constructed once in bone-local bind units.
   `Ragdoll.fixedPre` updates only translation/rotation; it cannot represent
   time-varying flattening or inherited affine shear. Removing a guard does not
   add that missing geometry representation.
4. `posePolicy: captured` is an existing alternative, but holds the lethal pose
   instead of the collapse and still requires admitted numeric animation and
   unit scales. A lethal attack-inflated belly can fail immediately. It is not
   an unchanged-animation fix, and was not requested or executed.

No padding, root lift, larger box, contact margin, solver/CCD/timing retry,
vertex exemption, scale-guard removal or freeze-rule change is justified.

## Conditional source-only redesign, for recommendation only

A new source animation and geometry-derived compound dataset could potentially
use the existing one-body contract without adding a bone, body, joint, service or
runner. It is **not yet proven feasible** for the full source geometry/budgets.
It is not enough to author a new death clip alone:

- Author a distinct candidate numeric animation with NO scale output channels
  and no squash, throughout living, attacks, flinch, transition and death.
  All bones and ancestors must already have unit scale at every possible lethal
  instant. Existing belly inflation must be redesigned using allowed rigid
  position/rotation channels or separately approved source anatomy/rig work;
  unchanged living inflation is incompatible. Death can have genuine articulated
  folding/rolling, but cannot retain the current scaleY0.6 flattening.
- Preserve original sources and public host; use a distinct identity, admission
  hashes and new dimensions data containing rigidCorpse. Keep existing numeric
  dimensions, behavior clocks, body count and runner unchanged. No parameter
  lift/shape inflation masquerading as measured support.
- Derive support points from actual geometry in actual named bone bind frames.
  Current fin caps mix fin/belly influences (for example0.8/0.2); a whole fin is
  not globally rigid to finR. Prove that all mixed-weight surface points retain
  exact hull containment/support over the new motion, or genuinely redesign
  those source weights/relative motion. If exact representation needs dynamic
  skin hulls or extra bones, report a blocker rather than extending the contract.
- Existing limits: <=8 unique named-bone hulls, <=128 points each, <=512 total,
  finite noncoplanar points. Hulls generated from actual vertices are materially
  different from padding, but convexification can bridge real concavities.
  Count exact support vertices, identify any filled concavity, and prove that
  source-derived support is representable within these unchanged limits. Do not
  drop extreme vertices, enlarge bounds, or claim an approximate hull is exact.
- Keep death pose under existing fixed-pre numeric owner and render
  interpolation. No authored callback, render-time collider motion or alternate
  clock. Existing captured policy would be a separate semantic choice, not the
  recommended substitute for authored death motion.

Required gates before any implementation/promotion claim: exact source/codec
parity and immutable predecessor hashes; numeric admission/no-scale proof over
all reachable lethal states; all-part skin membership and geometry-support
proof, actual hull-budget validation; normal-clock actual weighted-world contact
through multiple lethal phases, directions, turns and full settling; per-step
shape/pose agreement and frozen endpoints; no new gaps/penetration or unintended
convex bridges; full functional damage, player defeat, kill/rewards, Retry and
reload; complete encoded-frame independent animation/readability review. A
static support proof cannot replace the real physics and motion checks.

Recommendation: report this contract blocker now. If authorized later, scope a
new rigid-transform-only source animation/skin/support feasibility study first.
Do not implement a fin collider on the current animation or run a parameter
search. Existing public70 and the isolated failed candidate remain untouched.
