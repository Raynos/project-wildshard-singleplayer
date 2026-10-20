# Selected Conch complete-motion candidate 1

2026-10-20. Bounded editable numeric candidate, not motion-quality acceptance,
contact acceptance, actor handoff acceptance or permission to build/publish.
Original selected rest and all prior failures remain unchanged. No engine files,
production selections, payloads, geometry, colors, normals or weights were edited.

## Exact source and anatomy concession

`source-pins.json` pins the actual selected 6,570-corner, 15-bone, 94-blended-corner
source and authored-color payload. `admission.mjs` first executes the existing
selected authored-color and normal source admission, not the old 7,338-corner
canonical fixture. It clones metadata only to attach `dims.rigidCorpse`; the packed
payload is unchanged. No asset copy or old animation is used.

The audit's eight anatomical owners are body+shell, head+both eyes, two separate
upper arms, two separate forearms, and two complete legs. `recipe.json` contains
361 original source extreme points transformed into the owner bind frame; maximum
84 per group. No decimation, invented/padded points or dominant-weight assignment.

Explicit concession: shell keeps its bind transform relative to body; eyes keep
bind transforms relative to head; knees and ankles keep bind transforms relative
to each hip. All joint positions and scales stay at original bind values, all
scales one. This is a rigid-leg gait, not knee articulation. Body local rotation
also remains zero. These restrictions apply during idle, strikes, hits, repeated
interruptions and death, including every interpolated endpoint. They retain the
source anatomy but sacrifice knee/ankle/eye/shell articulation. Artistic adequacy
and planted-foot quality remain unreviewed; no unilateral quality claim is made.

## Complete numeric motion contract

`prepare.py` is editable source. It emits 135 explicit channels, all nine local
position/rotation/scale coordinates for every joint. Maximum DAG size is72 nodes,
below unchanged128; no stateful locals, callbacks, root channels or new clocks.

- Idle: modest head breathing and ready arm pose. No root bob/lift.
- Locomotion: opposed whole-leg hip swings from the actual measured root-distance
  accumulator, 0.65m cycle. Stopping holds the reached phase instead of snapping
  because an AI stage/speed boolean changed. No claimed foot contact or slip fix.
- Thrust and counter: existing authoritative strike `phase`, `elapsed`, `index`
  ports, durations0.60/0.45s windup,0.10s active,0.90s recovery. Preparation,
  extension before active, active hold, recovery brace and ready pose join at the
  exact phase boundaries. No `regular-clock` or `conch-st` animation clock.
- Hit: existing native `transition.entry`/kind/elapsed starts exactly at the prior
  published pose, adds a bounded recoil, then joins the ongoing living target by
  0.32s. Another hit captures the actual reached pose, not an assumed phase.
- Death: existing lethal entry starts exactly at that publication, then blends
  each movable joint to its terminal fold with authoritative normalized `deathT`.
  At deathT1 all locals are fixed independent of later strike/distance/time reads.
  The physical root is exclusively the separate native corpse owner, never this
  candidate. No terrain height curve, root lift or corpse-pose callback.

The source faces-Z. During authoring, rapier Y signs were corrected against this
source's blade direction, rather than copying the older canonical+Z clips. The
initial wrong-sign test draft is not a quality comparison or threshold search.
No weapon alignment, reach, or damage correspondence is claimed without capture.

## Gates and exact limits of evidence

Existing selected source admission passes. First focused test run5/5 and the
expanded run6/6 passed. These exercise strict `numericCreaturePose`, packed source
loading, strict corpse schema and real Rapier convex construction (no world step),
both strike phase joins, hit/re-hit/lethal entry continuity, terminal death,
finite outputs, all135 unique channels and immutable relative-transform locks.
They also check unchanged input payload and all retained packed skin influences.
The final rapier-axis authoring correction requires the final focused rerun below.

`support.json`: all6,570 source corners lie within the eight float32 hulls up to
maximum positive plane residual5.687476001270397e-8m at scale1. Convexity therefore
includes every triangle under the declared rigid-owner condition. This records
rounding residual, not an introduced collision allowance or padding. This SciPy
plane computation is not a terrain-contact sweep.

`weight-support.json`:25 sampled numeric poses, all94 blended corners included,
maximum all-weight skin-versus-owner residual2.5421520283296383e-8m in the first
complete draft. No influence is dropped or normalized. The invariant is stronger
than sampling: all influencing leg skin matrices coincide when relative joints
stay at bind, so weighted sums remain the common rigid transform apart from
stored floating-point weight sums. Render interpolation preserves the locks.
Native physical-root/view cadence still belongs to the integration gate.

Initial test launch without an explicit file filter was refused as a full suite;
no tests executed then. `test-launch-refusal.log` retains that refusal. First strict
TypeScript run reported a missing imported prefetch ambient declaration (test
configuration now includes its defining source) and a concurrent engine-owner
TS2367 narrowing error (owned/fixed by its writer, never edited here). Final strict
check waits for the writer's lint to finish to avoid overlapping memory-heavy work.
Default lint ignored art files; that is not a lint pass. Explicit nonignored
focused lint remains required. Logs are local diagnostics, not public deliverables.

Still unpassed: actual actor fixed/render interpolation with this selected model,
physical support/contact/finite-terrain sweep, visual motion/readability including
rigid-leg concession, AI/weapons/damage, loot/rewards, defeat/Retry/reload,
persistence, independent review and physical phone performance. Do not substitute
old canonical lifecycle tests for any of these. `buildAllowed` remains false.
