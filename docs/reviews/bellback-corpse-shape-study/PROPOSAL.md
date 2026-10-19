# Bellback corpse collision: frozen design study

2026-10-19. Proposal only. No engine, animation, model, product, build or runtime
physics edits. No browser, Mac, Git, publication or child work. Original anatomy3
and the older scoped contact pass remain intact. This study is NOT contact acceptance.

## Decision

Do not implement a fixed full-collapse box, convex hull, or compound envelope as
the claimed fix. Recommend a separately approved, bounded **pose-following compound
convex contract on the existing one rigid corpse body**, with a fixed-step pose
publication prerequisite. Approve its implementation only together with that clock
work and its tests. A static shape-only patch cannot meet the measured requirement.
There is no justified small box substitution that preserves the original anatomy
and both old/new floor-contact behavior.

## Measured result

Sources are the exact original 13,374 vertices, eight native bones, unit rigid skin
weights, 1,001 samples of the actual unchanged numeric collapse program (deathT
0..1, 201 samples in the fast first .2 fold), plus both captured last-living/dead
sequences: 187 observations. A dense sweep is sampled evidence, not continuous
animation proof. Captured states supplement the neutral collapse sweep; this is
not an exhaustive sweep of every live phase/flinch/attack at lethal impact.

Fixed shape / worst recorded support gap / old frozen gap / new frame449 gap:
- Full envelope cuboid: 1.198268 / .122488 / .068814 m
- Eight swept per-bone cuboids: 1.170871 / .122487 / .044879 m
- Exact swept convex hull: .962419 / .122482 / .040402 m
- Eight exact swept per-bone hulls: identical to exact whole hull
- Bounded 48-vertex outer hull (26 support planes): .974417 / .122484 / .061085 m

The exact whole swept hull has 252 vertices. Swept per-part hulls total 11,309
vertices and are inappropriate as runtime payloads. A deterministic 2,006-normal
orientation sweep across 1,001 collapse poses finds up to 1.135203 m gap even for
the exact swept hull; it is a sampled lower bound on worst orientation error.

All gaps mean the mesh minimum minus the collider minimum at the SAME recorded
orientation, assuming vertical translation to put the shape onto a plane. They
are not predicted orientations, landing positions or dynamic outcomes of a new
collider. The worst exact-hull recorded gap is new frame417, deathT .5885, whose
original mesh was airborne .46333 m; the metric does not claim a visible .962 m
float in that original recording. It shows how much empty temporal envelope a
hypothetical supported collider can introduce. The old final frozen pose still
has a .122482 m error, making this more than an airborne transient concern.

A convex hull and a union of convex hulls made from the same points have identical
support against any infinite plane: max(dot(n, union)) = max(dot(n, hull(union))).
Thus compound splitting cannot fix this temporal support gap. It may improve
contacts with corners, stairs and local obstacles, which this plane study does
not simulate.

At each bone's CURRENT pose, eight exact rigid-part hulls have precisely the
original mesh support in every plane direction, by convex-hull support identity.
The recorded check confirms numerical gap 0 for all 187 observations. These
require 435 points total: 86,49,86,29,43,42,50,50. They also contain every original
vertex; the script checks all bind vertices against their hull halfspaces. Rigid
transforms preserve that result at every pose, not only the sampled times. This
proof relies on verified single-bone unit weights and does not generalize to
blended skin. Eight bone-following cuboids still produce .550476 m maximum recorded
gap and .367152 m at the old frozen pose; do not substitute boxes for these hulls.

## Existing API and ownership audit

- `src/engine/physics/ragdoll.ts`: rigid custom rigs create ONE dynamic root body
  and ONE cuboid, mass5, half extents [halfWidth,bodyY/2,max(bodyHalfLen,bodyRadius)],
  center [0,.6*bodyY,0], all scaled once. Same DEBRIS collision and solver groups,
  friction .9, restitution .05, damping .1/.3. Throw/spin already live here.
- `src/engine/physics/pieces.ts`: `ColliderDesc.convexHull(points)` already exists;
  multiple collider descriptors already attach to one rigid body. Do not reuse
  `addPiece`: that path assigns WORLD and kinematic/static ownership, not DEBRIS.
- Installed Rapier0.21 exposes `setTranslationWrtParent`, `setRotationWrtParent`,
  `RigidBodyDesc.setAdditionalMassProperties`; no new collision library needed.
- `AnimalView.startRagdoll` selects quadruped / upright / rigid by custom rig and
  capsuleAxis; it passes model dimensions unscaled plus scale separately.
- `AnimalView.updateRagdoll` currently advances deathT and custom animation only
  in the render update and when near, then poses the root. It is NOT a fixed-step
  pose publication service. Blindly copying its bones in fixed.pre causes stale
  pose contacts; changing collider transforms in render violates moving-collider
  ownership. This is the implementation prerequisite, not an incidental polish.
- `Physics` owns creation/removal scope captures and cascade removal of a body's
  colliders. `Ragdolls` owns 2/6 live-body caps, quiet .5s / speed .12 / max5s freeze.
  Constructor failures currently increment the count before allocation completes;
  a new hull rejection path must not leak count/body/colliders.
- `AnimalDims` is in `entities/species/registry.ts`; `RagdollDims` is independent.
  `AnimalFactory` preserves `sp.dims`; `PracticeCreature` borrows the real model
  and actual AnimalView, so no practice-only corpse branch is needed.
- `game/plugin/geometry.ts` has strict packed metadata admission at PackedBody;
  copy currently spreads dims and copies feet, so a new nested recipe requires an
  owned deep copy rather than shared mutable arrays. Legacy GLB `CreatureDims` /
  bodyExtras is a different, narrower path; do not silently claim its adoption.
- `format/nativePhysics.ts` supplies strict native body dims to
  `sdk/headlessRuntime.nativeBodySpecSchema` and `format/worldPhysics.ts`.
  Native actors use AnimalSim; presentation ragdolls are not native combat bodies.
  Carry the inert optional data losslessly where that body recipe travels; do not
  simulate corpses in native or alter living shape records.
- `format/rows.ts` species dims is another strict producer contract without an
  explicit ragdoll build. Do not loosen it opportunistically: either extend it
  deliberately with the same schema and downstream rig checks, or explicitly
  reject corpse recipes through this unsupported route in this first scope.

## Smallest recommended data contract

Proposed optional `dims.rigidCorpse`:

    { parts: readonly { bone: string;
                        points: readonly (readonly [number,number,number])[] }[] }

Only one shape kind: convex point hull. No discriminator, nesting, scaling,
per-part mass, friction, group, root lift, callbacks, arbitrary property paths,
trimesh, mesh reads or species names. Coordinates are **bone-local bind units**,
not native mesh-root positions: subtract each exact bind joint origin when
baking this rigid-weight asset. The proposed Bellback recipe is included solely
as `posed-parts-proposal.json`; it is not an admitted product.

Bounds: 1..8 parts, 4..128 points/part, <=512 points total; finite triples with
absolute components <=20 model units; bone id 1..64 chars from the admitted
skeleton. Unique bone ids in this smallest contract; no degenerate/coplanar/
collinear hulls or zero-volume hulls. Reject unsupported bones, unsafe transforms,
non-unit bone scales and nonuniform/nonpositive actor scales. Unknown keys and
present undefined reject. This asset needs 8 parts/435 points and fits all limits.
Rig compatibility must be checked where actual custom-rig identity is available:
only rigid; never infer custom from lack of capsuleAxis alone. Upright/quadruped
recipes refuse; absence retains all historical branches exactly.

One root rigid body, 8 colliders, 0 new joints. Bone transform relative to the
root is decomposed into translation and rotation; scale is excluded there.
Apply actor scale exactly once to hull points and relative translation. Runtime
never derives the shape from rendered geometry or computes a fresh convex hull
per frame. Prepare validated Rapier hull descriptors once; update only collider
local rigid transforms in fixed.pre.

Keep the old effective mass5, COM [.6*bodyY] and cuboid inertia tensor fixed on the
root using additional mass properties; collision hulls have mass0. This avoids
both eight-times mass and pose-changing inertia/COM, and keeps no-contact throw
integration comparable. Do NOT leave an invisible old box collider for mass.
Optional-path tests must verify Rapier reports the requested mass/COM/tensor;
default path stays literally the old cuboid construction. This is an explicit
inertial policy, not a claim the new hull is homogeneous material.

## Fixed-step prerequisite and implementation boundary

Use the existing numeric pose program and engine clock ownership, not a second
animation implementation and not a shard callback. For opted-in rigid corpses,
a platform-owned fixed.pre stage must evaluate the actual corpse pose at the
collision time from a stable pose-input snapshot, update its relative collider
transforms, then let existing Physics step. Render must interpolate/publish the
same fixed pose endpoints rather than independently advancing this corpse's
collapse clock. Retain its deathT meaning and .8s duration, hit-stop relationship,
flinch decay and no post-death combat. Living animation/motor/AI are untouched.

This needs explicit review of near/far behavior, catch-up steps, paused updates,
freeze during ongoing collapse, MAX_T freeze, and current render interpolation.
Do not freeze while later visual bone animation changes contact: the fixed and
render endpoints must freeze together. Do not repair a lag by root lifting or
large per-step envelopes. A same-pose support proof cannot certify the solver's
interpolated intermediate contacts. If the clock prerequisite cannot be met in
bounded existing systems, stop and return the blocker instead of silently
shipping render-driven collider motion.

## Exact proposed code areas, after approval only

1. New `src/engine/physics/rigidCorpse.ts`: readonly geometry-only type, bounded
   point/part constants, preparation and transform validation owned by physics.
   Export in `src/engine/package.json`; no engine import of format/game.
2. `src/engine/entities/species/registry.ts` and `src/engine/physics/ragdoll.ts`:
   optional recipe type; branch isolated behind its presence; prepare all hulls
   before allocating; transactional cleanup/count on any failure; retain default.
3. New `src/format/rigidCorpse.ts` + `src/format/package.json`: strict pure-data
   admission reused by packed/native routes. No arbitrary-key relaxation.
4. `src/game/plugin/geometry.ts`, `src/format/nativePhysics.ts`: admit/preserve/
   deep-copy recipe; verify actual skeleton/rig at model boundary in AnimalFactory
   and spawn. `src/format/rows.ts` remains strict unsupported unless separately
   included. `src/format/worldPhysics.ts` / `src/sdk/headlessRuntime.ts` should
   inherit native schema without new executable simulation behavior.
5. `src/engine/entities/AnimalView.ts`, existing numeric pose publication in
   `src/game/plugin/channelPrograms.ts` / `animation.ts`, and the existing Game
   fixed phase composition: implement the reviewed opt-in clock synchronization.
   Prefer a scoped registration in existing ownership; no new global timer.
   These are inspection targets, not permission for an unbounded animation rewrite.
6. `docs/ENGINE.md` manual section and source JSDoc: units, scales, limits,
   compatibility, lifecycle, native preservation, sampling limits and opt-in clock.
7. New candidate admission/metadata generator only after engine + contact gates;
   immutable Frame2 geometry/payload and anatomy3 closures remain unchanged.

This extends existing ragdoll physics, not a new general collision host. Nevertheless
HOST-BAR's two-real-user/platform-approval rule must be addressed honestly before
landing a new authoring API. A fictional regression fixture is not a second user;
do not invent an exemption or unrelated adoption.

## Required tests and acceptance gates

- New `test/rigid-corpse-schema.test.ts`: all count/coordinate/tuple/key limits,
  duplicates, unknown bones, degenerate hull, wrong rig, scales, exact absence
  identity; packed copy mutation isolation; native/world round-trip and rejection.
- New `test/rigid-corpse-physics.test.ts`: actual Rapier flat and sloped floors;
  DEBRIS world-only collision+solver masks for every part; exactly one body,
  bounded 8 colliders; scale .5/1/2 center and vertices exactly once; mass5/legacy
  COM/inertia; zero airborne impulse drift relative to old body absent contacts.
- Default snapshot parity: absence must preserve serialized metadata bytes and
  old collider/rigid-body traces for rigid/upright/full+lite quadruped. No property
  insertion of undefined, reordered retained serialization or broad rebakes.
- Living invariance: byte-identical motor dimensions and capsule endpoints,
  radius, melee reach/hit positions, animation channels, AI/decision memory,
  damage, guard, strike timing and state-store effects, with recipe present.
- Clock fixture: stepped fixed-pre pose matches rendered endpoints across 30/60/
  120Hz, 6Hz observation/catch-up, near/far crossings, hit-stop and pause; clocks
  increment once; no post-freeze bone drift or stale transform penetration.
- Lifecycle: sleep/quiet/MAX_T freeze and dispose/retry/world teardown remove every
  collider exactly once; failure on each preparation/create index cleans ownership
  and count; repeated retire is safe; existing 2/6 cap and no-physics/cap fallback
  remain. No auxiliary body-cap bypass, retained borrowed geometry or timer leak.
- All 13,374 vertices/eight joints included in shape proof, no selected-mesh bias.
  Prove current-pose support and separately measure time/interpolation mismatch.
  Test another differently named/proportioned rigid synthetic fixture with the
  same API, while acknowledging this is regression coverage, not host adoption.
- Fresh pinned product/host actual full collapse and complete settled corpse,
  both old and rolled fall seeds, varied hits/yaws, scales and slopes/uneven ground.
  Record every rendered pose + fixed-step shape poses, minimum original-mesh floor
  distances, support gaps and contact ids. Target <=5mm penetration at settled
  contact, no visible empty support (>35mm is a fail absent explicit review), no
  persistent hover, no frozen fall before support; dynamic spikes separately
  reported. These are proposed review gates, not new user-approved taste thresholds.
- Full actual combat: both damage directions, pulse/echo/stomp, interrupted tell,
  approach-stop-resume after full cooldown, no post-death strike, exactly12 local
  coins, enemy180/player100 retry, empty local/session/state stores.
- Focused existing packed-body/native/admission/practice suites, type/layer guards;
  approved build/collider-change physics walk gate must report 0 stuck. Phone
  performance/visual acceptance remains unproven, never substituted by cloud data.

## Reproduce / freeze

From repository root:

    node --experimental-transform-types --import ./scripts/bake-loader.mjs docs/reviews/bellback-corpse-shape-study/sample-collapse.mjs
    OPENBLAS_NUM_THREADS=1 python docs/reviews/bellback-corpse-shape-study/measure-support.py
    OPENBLAS_NUM_THREADS=1 python docs/reviews/bellback-corpse-shape-study/measure-posed-parts.py

These ran successfully without builds, installs or source mutation. The scripts,
full compact pose measurements, candidate shapes and result rows are ordinary
review files, each below1MB (JSON below5MB); no archives/chunks/base64 payloads.
`manifest.json` pins evidence and proposal. Frozen at this result; implementation,
engine edits and publishing remain pending root/user authorization.
