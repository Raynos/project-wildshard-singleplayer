# Independent challenge review: Iguana support and ownership

2026-10-20. Design review only. Current candidate remains rejected. No implementation, admission change, physics run, Git operation, publication, package installation, Mac task or active Conch edit occurred. Only this file was written.

## Verdict

The native-contract diagnosis in REPORT.md is substantially sound: the selected fallback box does not support the animated mesh, and the live trunk misses its declared hit union. The proposed remedy in SOURCE-OWNERSHIP-DESIGN.md unnecessarily strengthens that diagnosis into a requirement that every rendered surface be the convex collision surface. Neither the inspected engine contract nor the retained candidate admission requires this. No user-authored requirement imposing that equality was supplied to this review; the source-design document's own assertion is not independent user authorization.

A source-derived convex proxy of one explicitly rigid, meaningful anatomical component can preserve that component's concave rendered anatomy exactly. In particular, a curled tail need not become a straight convex leaf, and toes need not become painted-on mitten markings solely because the collider is convex. The real tradeoff is ownership and motion, plus conservative collision against finite obstacles, not an automatic need to erase the sculpt.

An eight-owner, bind-anatomy-preserving candidate is mathematically possible if independent articulation is deliberately re-authored. That is not a claim that its motion, anatomical grouping, live-hit coverage or runtime contact has passed. It does not justify keeping the original animated skin while attaching an unrelated envelope, categorically assigning each old vertex to its largest weight, or enlarging engine limits.

## What the actual code admits

Read AGENTS.md and docs/process/GIT.md before inspection. Relevant executable sources:

- src/engine/physics/rigidCorpse.ts: RigidCorpsePart is a convex point hull in a named bone's local bind units. validateRigidCorpse checks shape, unique names, finite bounded points and budgets, not triangle-to-boundary equality or matching skin weights. prepareRigidCorpse checks rig, transforms and volumetric points, then calls Rapier's convexHull.
- src/format/rigidCorpse.ts independently applies strict schema, noncoplanarity, uniqueness and budgets.
- src/engine/entities/AnimalFactory.ts:366–369 requires a custom non-Y rig, registered numeric animation and existing named bones. It does not require the visible mesh to be convex.
- src/engine/physics/ragdoll.ts:198–246 requires fixed pose ownership for a recipe and attaches its colliders to one root dynamic body. fixedPre updates bone-relative collider transforms; fixedPost records physical endpoints. These are not eight independently simulated bodies or joints.
- src/engine/entities/rigidCorpsePose.ts publishes fixed numeric local endpoints and interpolates them for rendering. AnimalView.ts:350–379 uses that owner only when a recipe is present and avoids the fallback render-owned animation path in that case.
- scripts/bloomthroat-iguana-native-admission.mjs pins the selected source, explicitly requires its current absent recipe, and unconditionally refuses runtime admission. Its blocker forbids hull padding/root lifts but does not define all concave rendered surfaces as invalid. A different candidate does not pass this pinned gate merely by satisfying the generic schema.

Thus syntactic admission is weaker than a useful physical contract. Exact ownership, anatomical provenance and real contact remain necessary design/validation work even where the engine does not mechanically enforce them. Conversely, a reviewer cannot turn an additional aesthetic/geometric restriction into an engine requirement.

Actual limits are 1–8 parts, a unique existing bone name per part (1–64 characters), 4–128 finite points per part, at most 512 total, each coordinate within ±20 bind units, and nonzero volume. Actor scale must be positive and uniform; bone ancestry must have unit scale, the root's parent world matrix must be identity, and derived transforms must be finite and rigid. Actor scale is applied once. The only optional policy is captured; omission retains fixed numeric animated death. Captured does not bake weighted geometry into fresh hulls.

## Why boundary equality is not necessary: exact support argument

Let V be all vertices of one component in its owner's local coordinates, M its triangulated rendered surface, and H = conv(V) its exact convex hull. For any direction n, the support function is h(S,n) = max(x in S) n·x. A linear function reaches its maximum over a triangle at a vertex and over a convex hull at an original vertex. Therefore:

    h(M,n) = h(V,n) = h(H,n).

The same holds for minima. Under an identical affine transform T(x)=Ax+t applied to both representations:

    min(x in M) e_y·T(x) = t_y - h(V,-A^T e_y)
                            = min(x in H) e_y·T(x).

This is stronger than local containment: it establishes equality of the world's lowest height for that component, for any shared rigid pose, translation and uniform scale, relative to an infinite horizontal floor. Rotated planar floors follow by replacing e_y with the plane normal. For multiple independently posed rigid components, taking the minimum across their union preserves the equality, provided each hull is the exact hull of its own currently rigid component.

Consequences:

- Concave recesses, toe gaps and tail curls can remain rendered. A triangle being interior to its component hull does not make it unsupported against a plane.
- The reported 3,621 triangles not on the hull boundary measure surface nonidentity, not a failure of directional support. The tail's 1.86 hull/mesh volume ratio measures enclosed concavity, not added plane-support extent. Neither number proves that its bind sculpt must change.
- A minimum on a hull face bridging a concavity need not be physically on visible tissue at the solver's chosen contact location. Nevertheless at least one original vertex attains the same supporting-plane height. Height equivalence is not manifold/contact-point equivalence.
- An arbitrary larger hull generally has h(H,n) > h(M,n) for some n and can hold the visible mesh above the plane. Undercoverage can instead let it penetrate. Those failures differ from an exact component hull.

This is not a runtime pass. It is conditional on identical geometry ownership and transforms, exact retained extreme points, and a known world pose. Float32 construction introduces numerical differences. A solver can penetrate, overshoot or tunnel; changing animated local shapes can generate difficult contacts; interpolation between nonpenetrating endpoints can penetrate. The proof does not establish that actual physics produced a nonpenetrating root trajectory, nor that interpolated world poses are collision-free. Measure actual weighted rendered world vertices and actual collider support at fixed endpoints and rendered intermediate poses. A settled collider or a local-envelope screenshot remains insufficient.

For finite platforms, walls with openings, steps and other nonplanar terrain, an exact hull can bridge empty concavity and collide where the mesh would not. That is a genuine approximation/contact-readability cost and must be inspected, not concealed by the plane theorem. Mass/inertia and contact response are not proved accurate by equality of support functions; the current root mass properties are separately authored from dimensions.

## Meaningful anatomy versus an arbitrary enclosure

A permissible design proposal starts with a source component and an explicit rigid transform, then derives the proxy from that component's actual points. It never chooses a large collider first and invents a tissue label afterward. A single curled tail or one complete limb/paw is a plausible anatomical unit despite concavity. Its exact hull is not radius padding merely because it fills that unit's own concavities.

Taking one hull around torso, four legs and tail would also preserve whole-set planar extrema if all were made rigid, but that mathematical observation does not authorize the prohibited grouping of unrelated appendages. Likewise, treating seven petals as one flower assembly is an anatomical proposal requiring honest review of their relationship and motion, not automatically legitimate because the point budget fits. A collision bridge between unrelated parts remains disallowed. No convex hull may be derived from a union of future poses as a substitute for correct current ownership.

The eight groups in the earlier design are therefore useful budget diagnostics, but their jaw-plus-flower grouping should be justified rather than presumed. Neither their 463 total points nor the alternate 457-point grouping below supplies that anatomical approval.

## Preserve bind anatomy, explicitly change ownership/motion

Bind geometry and animated deformation are different invariants. At bind, every valid bone skin matrix G_b(bind)·inverse(G_b(bind)) is identity. Consequently a newly authored rigid component can reproduce the exact original bind positions, triangle topology and vertex colors while using a new coherent owner. For an actor-space bind point v assigned deliberately to owner b, derive the proxy point as inverse(G_b(bind))·v. Do not bake actor scale into it.

A clean source re-authoring specifies complete anatomical components, binds all vertices within each component coherently, authors matching numeric motion and derives collision from the same immutable geometry. It is not a largest-influence conversion. Changing weights to one coherent owner necessarily changes motion wherever old influences had different skin transforms; this must be declared and evaluated as a new source variant, not sold as preservation of the old skinning. Merely attaching new hulls while retaining the old mixed weighted tail fails that ownership condition.

Existing leg descendants reportedly remain fixed relative to their leg root in the current clips. When that is exactly true, their skin matrices are identical to that root's and mixed weights can collapse without changing motion. Mixed weights alone are not proof of a rigid-ownership mismatch. The moving multi-bone tail is different. The separately moving petals and head/neck likewise cannot keep all their original independent transforms under a single owner.

The earlier ten-owner argument is a conditional count for its chosen decomposition and unchanged independent motions, not an impossibility theorem for every eight-owner source. Coincident/redundant support or alternative decomposition would need separate proof. More importantly, once motion may change, that unchanged-motion lower bound cannot require destructive geometry changes or a higher engine budget.

### One concrete bounded candidate to specify, not implement

Consider eight declared assemblies while retaining every existing bind vertex/triangle/color:

| Owner | Source geometry | Explicit motion tradeoff |
|---|---|---|
| body | Body and its existing ridge detail | Retain one trunk owner. |
| head | Neck, skull and jaw as one cranio-cervical assembly | One nod/bite-thrust transform instead of independent neck/head/jaw articulations; mouth-opening loss must be judged honestly. |
| bloom0 | All seven petals as one flower assembly | Keep layered bind petal geometry; replace independent petal flutter with one flower sway/droop. This grouping needs anatomical review. |
| tail0 | Entire existing curled tail | Keep bind curl; replace blended four-bone flex with one explicit tail sweep/sag. |
| legFL, legFR, legBL, legBR | Each complete existing limb/paw | Keep bent shapes, toes and claws; one owner per limb. |

These are candidate owner names, not a modified skeleton or runnable recipe. Root remains ground-based and exclusively physical after death. Bone pivots and parent transforms must be authored coherently, with exactly one absolute-to-local conversion. Seams and intersections between independently moving assemblies may become visible even with identical bind anatomy. Bite readability and the flower's character may fail. Such failures are source/motion issues to judge, not reasons to silently restore unsupported old deformation.

A read-only calculation in this review loaded complete-character-next/native-source.json and used the already installed THREE ConvexHull over each exact proposed group's bind positions. Distinct hull extreme-point counts were:

| Group | Extreme points |
|---|---:|
| body | 79 |
| neck + head + jaw | 72 |
| seven blooms | 44 |
| tail | 46 |
| legFL | 55 |
| legFR | 54 |
| legBL | 54 |
| legBR | 53 |
| Total | **457** |

All are below 128 and the total is below 512, with 55 points of headroom. This calculation creates no source/collider file and runs no physics. A rigid change of bind frame preserves these mathematical hull counts, although final float32/native hull validity must still be verified. Counts show this particular bind partition is not ruled out by the existing point budget. They do not demonstrate acceptable grouping, final animation, live damage coverage or engine admission. No convexification of the rendered geometry was performed or is necessary to obtain these counts.

## Live hit coverage is a separate unresolved gate

Corpse hulls do not add living hit volumes. AnimalView.bodyCapsule uses the body bone, optional body-local bodyAt and pitched local-Z axis; fore is one named-bone local-X capsule, and headAt/headRadius define a head-owned sphere. The old source's continuous trunk misses remain a real blocker. Neither an exact corpse hull nor grouping the neck/skull repairs this.

For the one proposed source contract, derive the live trunk/shoulder/head assignment from actual anatomy, respecting those exact shape axes and owners. Verify continuous triangles, not just separately classified vertices: vertices split between two convex shapes do not prove the connecting triangle lies in their union. Check all authored poses and the new motion, not only bind. Full independent live coverage of tails, paws and flower is not automatically supplied by this API; do not invent decorative exemptions or falsely claim a proof for all anatomy.

No radius/solver sweep, root lift, cap/schema change or broader capability is recommended. A single anatomically justified live-support specification may still fail. If it does, report the precise required tissue/pose and unsupported shape/owner rather than assuming a larger engine is authorized or necessary.

## Recommended next step and stopping condition

Replace the overly strict boundary-equality premise with one explicit eight-owner anatomy/motion specification for review, preserving the selected source as reference. The concrete grouping above is a feasible budgeted candidate to assess, not permission to implement it. Record every source part and triangle's owner, intended pivot, lost independent motion, and component-derived hull provenance. Reject an unjustified anatomical grouping rather than surrounding unrelated appendages. Resolve the live trunk/shoulder/head contract analytically before any fresh contact run.

If that single specification has coherent anatomy, motion and live coverage, the later authorized candidate validation must establish source/packed parity, registered fixed/render pose ownership, all actual world-space weighted-mesh minima and matching shape support at endpoints/interpolation, lethal phases/transforms/rates, and lifecycle integration. Keep the existing fail-closed candidate admission intact until the actual candidate is reviewed. No old fallback sweep need be repeated.

If the source/motion tradeoffs are unacceptable or a precise representational requirement cannot fit, report that exact limitation and stop the candidate. Do not substitute convex-rendered wedges by necessity, waive appendages, default to captured death, or infer approval for a generic expansion. This review corrects an unsupported restriction; it grants no visual, runtime or contact acceptance.
