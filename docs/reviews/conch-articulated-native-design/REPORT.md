# Conch: articulated eight-component design decision

2026-10-20. Read-only design following the independently rejected selected
complete-motion candidate. Only this report is written. No candidate/source
changes, Git, physics, build, parameter search or promotion. The failed candidate
at remote a0489d13c53c460c554605c8d5a5ac4f3a71089a remains exact.

## Recommendation

A genuinely articulated-knee source is plausible within eight components, but a
complete grounded gameplay solution is **not just another clip**. Recommend one
new source variant with six leg components, a fixed braced upper-body/shield
assembly, and a single shoulder-driven rapier assembly. Keep the old selected
source and failed candidate separately. Review the explicit upper-body losses
before implementing. If that braced grouping is not anatomically/visually
acceptable, the eight-component solution is not established; do not quietly
merge unrelated appendages or raise the cap.

### Eight owners, with the costs exposed

1. Body, shell, head, eyes and the entire shield arm: one permanently braced
   guard assembly. No head/eye/independent shield articulation.
2. Whole rapier upper arm and forearm: one shoulder-driven weapon assembly.
   Elbow fixed at its authored bend; shoulder still supplies preparation,
   thrust/guard/recoil and death motion.
3–8. Left/right thigh, shin, foot/toes: three separate rigid components per leg.
   Hip, knee and ankle articulation retained on both sides.

Fresh source-derived convex counts for the two unchanged upper unions are 70
and 40, respectively, using exact selected points without joggling or padding.
The torso/head union alone is 78; separate whole shield arm is 35. Thus point
count is not the apparent obstacle. The torso/head/shield union volume is
6.6954 m³ versus 4.6136 m³ for torso/head and 0.8225 m³ for separate shield: the
broader combined envelope is a **real obstacle-contact tradeoff**, not invisible
free capacity. These volumes are proxy diagnostics, not anatomy volumes.
Freezing the source relationships makes the union mathematically rigid; it does
not automatically make that broad proxy an acceptable anatomical choice.

The tempting eight-owner alternative (torso/head, separate shield arm, separate
rapier upper/forearm, and two thigh+shin/foot legs) has only two components per
leg. It allows knees but locks ankles. On the existing planted-foot design this
cannot promise both fixed stance-foot orientation and arbitrary hip translation.
It would need a deliberately reauthored rolling/rocker-foot contact law and
matching soles. That is a different silhouette/gait choice, not the recommended
shortcut. Keeping separate shield, weapon and torso plus six leg components is
nine owners, even after sacrificing the weapon elbow.

## What must actually change in source

The exact selected JSON remains hash
3dddaf6a2845ffea0c372fe46d8d422baaa2864bfaf5cc5f4c4cd98a9faa0929.
`export_native.py:81–97` deliberately interpolates each continuous hinge along
hip→knee or knee→ankle. Each leg's first 132 expanded corners belong to its
continuous `Leg hinge`; the following 180 are separate armored thigh. The latter
is already rigid, with 30 convex extremes on each side. There are 45/49 blended
corners; 28/32 triangles touch a blended corner. Positive influence coverage is
left hip246/knee69/ankle42 corners, right hip246/knee73/ankle42 (overlapping counts).
This is not a rigid skin that can simply be relabeled.

For the proposed exact-rigid support contract, reauthor only those continuous
hinge meshes into intentional closed upper/lower joint pieces, with explicit
knee and ankle seams/caps and joint collars. Preserve the thigh/shin/foot/toe
armor and all unaffected source geometry/materials as far as the new motion
permits. Assign each newly authored piece one genuine anatomical owner at
creation; do not reassign existing blended vertices by maximum weight, delete
problem corners, or conceal the old source behind a "same geometry" claim.
Choose seam placement and collars against the full articulated range, including
attack interruptions and death, so motion does not expose holes or intersect
visible armor. New topology/normals/colors/weights need their own provenance and
visual review. Final eight hulls must be freshly derived and admitted within
8/128/512; current counts do not certify the not-yet-authored hinge pieces.

This is a sufficient construction direction for genuinely rigid components,
not proof that every possible conservative proxy for the old deforming skin is
impossible. The old 33.197 mm pair-distance witness disproves exact whole-leg
rigidity only. No new deformation-support proof has been supplied for old skin.

## Facing and physical source frame, decided before motion

Bake one explicit proper rotation B=Ry(π), i.e. (x,y,z)→(-x,y,-z), into the new
native asset's positions, normals, bind pivots, sockets, feet and directional
metadata. Transform local rotation frames by B R B⁻¹. This is a documented
coordinate conversion, not a mirrored character, view-only yaw fix or reused
canonical clip. Unchanged vertex colors/weights remain unchanged by the basis
conversion; intentional hinge reauthoring is separately identified. Actor yaw0
then means native +Z forward, exactly as AnimalSim and its damage lanes expect.
The existing physical root quaternion remains authoritative without an extra
render offset. Verify skin/FK/weapon vectors commute with B at nonzero yaw,
not merely that a front screenshot faces the camera.

Reauthor the actual stance soles/toes to a declared support plane in this asset
frame; the existing minimum is -0.009531468 m. Do not insert an unexplained root
lift to accommodate the failed gait's additional 43.462600 mm descent. Recompute
living torso/head capsules and dimensions from the intended anatomical contact
regions, not the full weapon/shield extent. Current diagnostic bodyRadius
2.9507175 and capsuleAxisZ are not accepted living-body dimensions.

## Actual stance-foot and clock contract

On the first supported flat-plane gait, define each stance foot by a fixed world
contact frame: sole support plane at ground, fixed contact X/Z and foot yaw during
stance. In root-local coordinates its target is inverse(actor root transform)
applied to that fixed world frame. Solve thigh/shin IK to the ankle and compensate
with ankle rotation so the sole keeps its stance orientation. Knee bend direction
must preserve the authored splay, not switch the IK branch. Current bind lengths
are left0.533010/0.548999 m and right0.538609/0.548999 m; the right bind reach is
already1.015332 m. Use exact reach feasibility to choose placements/steps, not
root elevation, chain stretching or clipping negative clearances away.

Swing moves the unloaded foot from its prior plant to a reachable next plant;
its entire retained sole/toes must clear the support plane, not only an ankle
point. Land with continuous position/velocity and establish the next contact
frame. Check actual visible triangles and bone-local hull supports through the
whole gait and interpolation. Foot support does not prove body/weapon clearance:
shield edge, rapier and torso need the same full-cycle floor bounds. Define attack
and hit behavior against current plant frames. At lethal entry capture the exact
pose, release living foot constraints, and let the separate physical corpse root
own translation/rotation while joints complete the admitted fold.

There is an important implementation boundary: current stateless numeric ports
provide aggregate unsigned 3D distance, per-step displacement, yaw and hit-entry
history, **not per-foot world plant frames or stance state**. A straight,
constant-heading flat-plane analytic gait can be prototyped without new state;
it cannot honestly cover turns, reverse/strafe, pushes, terrain or arbitrary
stops by substituting motion.total. A full gameplay pass needs an explicitly
reviewed bounded contact-state declaration owned by the existing authoritative
fixed pose owner, exposing read-only plant/phase targets to numeric expressions,
with save/restore/Retry semantics. No render callbacks, duplicate clock,
shard-private physics owner or unreviewed general engine expansion. If that small
state contract is outside the next scope, stop at source/analytic validation;
do not claim a complete gameplay-ready locomotion solution.

## Smallest consequential next pass and stopping gates

Review the eight-owner anatomy/upper-body concession and facing/contact-state
contract first. Then author **one complete new source variant**, not tweak the
failed sine gait: explicit joint seams, actual soles, mapped +Z frame, derived
living dimensions, all phase poses and stance/swing/death ownership. Preserve
likeness with independent nine-angle and articulation review before runtime cost.
Reject immediately if the braced shield proxy or weapon-elbow concession loses
required anatomy/readability. Exact source identity, strict admission, all-weight
support, visible surface continuity, stance/world-foot and weapon-lane bounds
must pass before any physical contact sweep or app build. Runtime
AI/weapons/damage, loot, defeat/Retry/reload and persistence remain separate gates.
