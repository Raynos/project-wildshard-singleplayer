# Bloomthroat Iguana: native contract diagnosis

2026-10-20. Read-only investigation; only this report is authored. **Still rejected.** No app admission, visual/animation approval, contact success, engine implementation or new physics run is claimed.

## Finding

The coherent source fault is **an incomplete geometry-to-physical-owner contract**, not a demonstrated bind/axis conversion error. The sculpted animal, its live hit dimensions and its fallback corpse dimensions are separate authored descriptions that do not describe the same supported anatomy. Live dimensions mean a bone-centred capsule and head sphere; the same scalar fields feed a very different actor-root-centred corpse box. The selected source supplies no explicit corpse recipe, so animated local anatomy has no corresponding physical shape owner.

This distinction matters: do not “repair coordinates” by subtracting body bind twice, moving the actor root, swapping axes or inflating the fallback box. The implemented transforms are internally consistent. The source contract is physically insufficient despite being syntactically valid. A rigid body's successful floor contact does not imply the mesh is supported.

## Read and identity

Read repository AGENTS.md, docs/process/GIT.md, docs/plans/driftwood-enemies/STATE.md, the selected source builder and native metadata, retained clips and new exact-clock clips, strict admission, corrected default-corpse test and raw measurements, independent candidate review, AnimalFactory, AnimalView, Ragdolls, rigidCorpse and RigidCorpsePose. No Bellback architecture or multi-body authorization is used.

Inputs (SHA-256):

- complete-character-next/native-source.json: `3a8c1d134385720d2d77051c8a5aac138a25773cd01771ee6eedc304f5673171`
- complete-character-next/metadata.json: `b1dfd298135f609f01ad8195c242617073f0d184b79be6636bc1a0c961111b14`
- Retained Iguana lifecycle candidate1 default-death-physics.json: `8fece96419498d2be87c43682407ec07e4ed1d557f167fa1786c6d8a5b438b06`

The art prefix for the first two is `art/driftwood-isle/approved-bloomthroat-iguana/`. These match the selected source pins. Prior independent report: `docs/reviews/iguana-native-candidate1-independent/contract-review.md`. No old negative sweep was rerun.

## Actual coordinate and ownership chain

1. Source is metres, +Y up, +Z forward; vertices and bone bind positions share actor space. Blender export uses (x,−z,y), a proper rotation, not the runtime basis. Native runtime does not apply that conversion again. X-left versus X-right prose labels do not change the explicit native data or explain these floor failures.
2. AnimalFactory.instantiate (lines 574–615) subtracts each parent's absolute bind position once, then binds the skeleton. Body's parent is the actor mesh, so body local bind remains (0,.78,−.2). Neck local bind is (0,.14,.62), head local bind (0,.59,.62). Skin vertex world position is W_actor times the weighted sum of G_bone(t) times inverse(G_bone(bind)) times the actor-space bind vertex. Translation, rotation and actor scale occur exactly once.
3. The clip's front-leg local Y=−.04, Z=.82 and back-leg Y=−.12, Z=−.50 are already parent-local: e.g. front bind (.74−.78, .62−(−.2)). They are not accidental world coordinates. Death neck X=.18d, head X=.09d plus the diminishing idle term, and tail Y=.025d plus diminishing wave are rotations around those correct pivots. None writes root position or scale.
4. AnimalView.bodyCapsule (lines 303–317) uses body.matrixWorld, not the actor root: centre (0,.78,−.2), Z half-segment .64, radius .623 at scale 1. headWorld uses head.matrixWorld: centre (0,1.51,1.04), radius .574 at rest. No bodyAt/bodyPitch/fore overrides are supplied.
5. AnimalView.startRagdoll (lines 351–364) chooses `rigid` because this is custom and capsuleAxis is Z. Ragdolls (lines 225–247) creates a dynamic body at **actor mesh root**, not body bone. Without a rigidCorpse recipe, box half-extents are (.55,.39,.64), centre (0,.468,0). Its actor-local bounds are X [−.55,.55], Y [.078,.858], Z [−.64,.64]. Its centre is displaced from live body centre by (0,−.312,+.2); this is the implemented fallback formula, not an accidental matrix omission.
6. AnimalView.updateRagdoll owns render-local death at dt/.8 on the near-custom fallback path. Ragdolls owns root motion, interpolation and freeze. Its fixedPre/fixedPost opted-in corpse pose work is absent without a recipe. Supplying a pose object alone does not opt in. The corrected harness follows this actual ownership. `fixed` in its recorded minimum means root endpoint alpha=1 with render-evaluated local pose, not that fallback local animation has become fixed-owned.

## Live failure: independently recomputed from source

The first construction component has 492 triangle corners, not 492 unique vertices. Direct arithmetic reproduced **54 outside both live shapes**, belonging to **9 unique positions** on Z rings −.43, .31 and .61. Thus the miss is not only the uppermost chest or decoration: multiple real trunk rings exceed the authored live union.

Example corner 350, p=(.381051177665153,1.34,.61):

- Distance to body capsule segment = sqrt(x²+(y−.78)²+max(0,abs(z+.2)−.64)²) = .6983552104767315 m, exceeding .623 by .0753552104767315 m.
- Distance to head centre = .5991660871578096 m, exceeding .574 by .0251660871578096 m.

These are rest-space distances only. The .698355 value is not a recommended radius or an animated support proof. Moving root or changing world placement cannot change these actor-local relative distances. Head animation also makes head-sphere coverage an unsafe substitute for deliberately body-owned trunk support without a full shared-pose proof.

## Corpse failure: independently reconstructed world witnesses

I read the existing four trials, selected the recorded minimum endpoint of each, rebuilt parent-local FK from source, applied the exact idle/death clip arithmetic, performed all four skin influences, and applied that row's stored world matrix. No Rapier step, test harness rerun, parameter search or source write occurred. Each recorded minimum was reproduced within 1e−15 m.

| Hit direction | Tick, seconds, deathT | Lowest weighted corner | World mesh Y (m) | World box minimum Y (m) |
|---|---|---|---:|---:|
| +X | 33, .566666667, .708333333 | tail 362 | −1.451637561087 | −.000377381308 |
| +Z | 32, .55, .6875 | head 35 | −1.129256019252 | +.000102566717 |
| −X | 59, 1, 1 | tail 422 | −1.045699554580 | −.000133031551 |
| −Z | 23, .4, .5 | tail 248 | −1.588589635482 | +.000202809351 |

The box minima are calculated by transforming all eight exact box corners with the recorded actor world matrix, not by presuming local coverage implies world contact. Floor top is Y=0. At the actual worst mesh endpoints the solver-supported box is within .378 mm of that floor, while anatomy is over a metre below it.

Numerical inputs for independent scalar reproduction, Y_world = ax+by+cz+e, using **posed actor-space** vertex coordinates:

- +X p=(1.6272209218233284,1.8307499885559082,−1.4947454835747733); (a,b,c,e)=(−.7439500546670798,−.6682352207459701,−.00007691185410656279,.9821901917457581).
- +Z p=(0,1.451546057919994,1.6011517310470351); (a,b,c,e)=(.00000667262305692776,−.5060811818591737,−.8624858476076565,.9863148331642151).
- −X p=(1.3501878818858806,1.9017802476882935,−.9838513974870324); (a,b,c,e)=(−.0008966686377374224,−.9999947174363766,.0031242734670733703,.8603551387786865).
- −Z p=(.9267786173288927,1.1075929403305054,−2.222050436300471); (a,b,c,e)=(−.000021844062613781886,−.2793858058700207,.9601789265554607,.8544423580169678).

For the exact box, compute e+.468b−.55|a|−.39|b|−.64|c|. This independently yields the table's box minima. The retained interpolated alpha=.5 minima also fail (−1.4517913413, −1.1289105005, −1.0451866012, −1.5865755563 m); those are prior measurements, not new recomputations here.

The native tail alone spans bind X [−.3779624104,1.6544797421], Y [.2543935180,1.9017802477], Z [−2.1950535774,−.8200746775]. Its entire bind Z span is behind the box's rear face. Head bind Z reaches 1.52 versus box front .64. These local bounds explain why a small central box is an inappropriate source description, but the world witnesses above, not those bounds, establish the observed penetration.

## Bounded corrective design, not an accepted fix

Recommended next work is **one source-native support/pose ownership design**, before another app or physics trial:

1. Preserve selected visual source as reference; author a separate, explicit contract linking anatomical components, bind frames, skin ownership, live hit support and corpse support. Keep ground root, units and correct absolute-to-parent-local conversion unchanged. Generate dimensions/support from that anatomy contract rather than inheriting one legacy scalar tuple as both live and dead geometry.
2. Resolve live trunk coverage by deliberate anatomical support and ownership, using existing bodyAt/bodyPitch/fore facilities only if their exact semantics can represent the intended anatomy. A head-owned sphere must not be the unexplained owner of body-owned chest. Produce an independent point/triangle-to-support assignment through all authored poses. No rest-only radius fit, decorative waiver or padding loop qualifies.
3. Explicitly specify death ownership. If the existing **single root rigid body with source-authored bone-local convex parts** can represent the anatomy, use its existing numeric fixed-step pose owner: publish local pose before physics; render only interpolates its endpoints. One root body remains the only dynamic owner. The recipe must come from meaningful anatomical solids, not a padded convex envelope of unrelated appendages. Do not add per-species callbacks or change root impulses/solver settings to make a weak contract pass.
4. Before implementation, prove representability against the existing limits: at most 8 unique bone parts, 128 points per part, 512 total, and exact skin/support ownership. This source has weighted tail/limb spans and 27 bones, so assigning a hull to each render part or copying actor-space vertices into bone-local recipe points is **not** a valid automatic solution. A recipe point must be in its named bone's bind frame, with actor scale omitted; runtime applies bone-to-root translation and actor scale once. A blend-influenced vertex does not follow one bone's rigid transform in general.
5. If bounded source re-authoring cannot satisfy that representation while retaining acceptable anatomy and motion, report the precise unsupported deformation/ownership requirement. That is the point to request a separate generic capability design, not to infer one from this fallback box failure. Captured policy freezes local lethal pose and forfeits the death fold; it does not magically capture weighted geometry into new hulls. Do not silently substitute it for an animated-death requirement.

Existing rigidCorpse.ts already provides bone-local convex parts and fixed-owner integration; therefore “the engine has no native corpse support capability” is false. Conversely it does **not** supply arbitrary continuously skinned collision geometry, independently articulated dynamic bodies, or an unlimited shape budget. Whether this unchanged sculpt and animation fit the bounded existing capability remains unproven. This report authorizes neither a generic expansion nor a new source deformation.

### Admission and stopping condition

Do not remove fail-closed admission for a contract diagram, source pin, local envelope or a well-settled collider. A future coherent candidate needs source/packed parity, explicit live anatomy coverage, matched fixed/render pose ownership, and actual world-space weighted-mesh contact with its chosen real shapes. Only then run a new bounded candidate contact check; do not repeat the completed fallback negative sweeps. Different rates, lethal phases and actor transforms belong in that later candidate's validation, along with actual lifecycle ownership. The page-host dead-owner lookup hazard remains a separate integration issue, not the cause of the reproduced default-corpse minima.

No corrective candidate was implemented or proven here. Current strict rejection is correct. No active Conch files, production assets, Git state, dependencies, Mac tasks or publishing were touched.
