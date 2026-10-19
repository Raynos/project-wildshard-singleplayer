# Medusa native death: source-contract audit

2026-10-19. Verdict: **no coordinate-only correction is justified. Stop before edits.**

The current Medusa export is internally coherent. No established consumer contract requires a flying creature's lowest vertex to be at local Y=0. Raising its source/bind frame to make standard flight death clear the floor would change its world-space placement. Compensating that translation everywhere preserves the existing penetration. Compensating only while alive is a death-specific lift, not source normalization.

This is a genuine limitation of the selected existing standard-flight death path for this source and authored death pose, under the no-lift/no-new-physics constraints. It is not proof that every possible authored death animation or physical corpse is impossible. No existing-system physical corpse admission has been established here, and none is proposed as passed.

## Exact evidence and authority

`evidence.json` records SHA-256 provenance, observed source bounds, actual shipping GLB headers, and retained diagnostics. Inspection was read-only except these two review files. No build, browser, simulator, physics run, parameter study, model/runtime edit, Git command or publication occurred.

Read repository AGENTS.md and driftwood-enemies STATE.md. Static likeness remains separate: the coordinator reports complete-character-next 3.2925; this audit does not re-score art or declare it playable.

- v2 retained replay: minimum world vertex Y = -1.1920032153359559, final actor root Y=0.
- complete-character-next retained replay: minimum world vertex Y = -1.1913332079183132, final actor root Y=0.
- These are existing 121-step FlightMotion + weighted THREE pose results, not fresh end-to-end gameplay tests. Their test implements its own Bone hierarchy; it loads actual packed geometry but does not instantiate the full native world/AnimalFactory pipeline. That limits positive admission claims, not the algebraic impossibility of curing penetration while preserving world geometry.

## Actual source and consumer contract

1. `art/driftwood-isle/approved-pearlglass-medusa/complete-character-next/build_medusa.py:19-51,139-149` authors body at construction Y=3.35, then subtracts exactly 3.35 from every native vertex and every absolute bone bind; Blender uses the matching proper rotation `(x,-z,y-3.35)`. Result: native body bind Y=0 and metadata bodyY=0. No rest/bind mismatch was found. v2 uses the same body-origin convention.
2. `src/game/plugin/geometry.ts:1314-1378` decodes the packed typed attributes and returns authored bones/dims. It does not infer floor clearance or normalize coordinates. Its rigid-corpse admission explicitly rejects a packed body combining capsuleAxis=y and rigidCorpse; Medusa currently uses capsuleAxis=y. That is another boundary, not permission to silently change the body's volume model.
3. `src/engine/entities/AnimalFactory.ts:575-615` converts absolute bone binds into local parent differences, attaches the body bone to the mesh, updates world matrices and creates/binds the Skeleton. All native rest positions therefore agree with current vertices.
4. `src/game/plugin/animation.ts:555-635` constructs native local joints from the actual baked recipe, applies the custom animation, publishes the root frame, and computes head/body volumes from solved bone worlds. `src/engine/entities/animalRig.ts`, applyAnimalRoot, copies actor.position; it does not subtract bodyY or a bind-origin offset. Native bodyY does not become automatic ground support.
5. `src/engine/entities/animalPose.ts:152-160` returns through the custom-rig path after timer/terrain work. The quadruped rest-height formula at lines 224ff is not applied to Medusa. Importing its halfWidth/bodyY collapse logic would be a different pose contract.
6. `src/engine/entities/AnimalSim.ts:343-346` delegates flying vertical motion directly to FlightMotion. `src/engine/ai/flight.ts:64` makes dead root Y=max(floor, Y-diveRate*dt), independent of bodyY, bounds, skin, or hit-volume dimensions. `place`, `fly`, and diver home/target-height logic use actor/root positions.
7. Medusa clips rotate body and its ribbon joints, with bell local Y=0.30 plus live motion; they do not provide a world ground solver. Current live root/scale, brain home/target heights and flight altitude are explicit behavioral inputs, not automatically adjusted model origins.

## Real existing flying creatures

These are the current `src/shards/far-reach/generators/creatures.ts` producers and present `public/assets/far-reach/rigs/*.glb` files, connected through `generators/fileInventory.ts`, `creatureLooks.ts`, `rows/species.ts` and `rows/spawns.ts`. They are not invented fixtures or merely legacy stand-ins.

- Gale Wisp: actual GLB body absolute bind [0,0,0]; source mesh Y bounds [-0.3827928603, +0.3827928603]. Current generator bodyY=0. Death clips shrink the body to 0.5 and continue slow swirl; no grounding correction.
- Drift Ray: actual GLB body bind [0,0.3,0]; source mesh minimum Y=-0.1087038666. Generator fits to middle=0.3, not minimum=0; bodyY=0.3. Dead wings fold through existing clips.
- Storm Roc: actual GLB body bind [0,1.6,0]; source mesh minimum Y=-1.7364141941. It also has authored positive bodyY without a universal bottom-origin guarantee.

These admitted roster sources establish flexible absolute rest coordinates and bodyY matching the body pivot. They do **not** establish strict death-contact quality; their existence must not be treated as evidence that Medusa's meter-scale penetration is acceptable. In particular Gale Wisp directly disproves a mandatory ground-based body origin.

## Why translating the export cannot be a behavior-preserving fix

For a hypothetical constant native translation t=(0,h,0):

- Translate every native position, every absolute bone bind, and the matching GLB vertices/edit-bone coordinates by t. Child local translations remain unchanged; the top-level body local translation gains t. Recomputed global rest inverses become B^-1*T(-t); keep the mesh bind conventions consistent.
- Skin indices/weights, indices, normals, colors, UVs and fur lengths remain unchanged. Directions and lengths must not be translated. Dimensions bodyY gains h to match the body pivot; radii, half-lengths, legLen, halfWidth, axis and horizontal feet coordinates do not change. Bone-local attachment offsets remain unchanged; model-space bounds/centers must be recomputed. The packed position bytes and associated metadata/hash must be regenerated; source, GLB and packed body must still agree.
- Absolute body-position animation channels, if any, need the same coordinate transform. Medusa's bell position channel is parent-local and must remain unchanged. Root body rotation remains around the translated body pivot.
- These changes produce the same *shape and relative deformation* shifted by t in actor-local space. They do not preserve world geometry. With actor frame F, original posed vertex u, new vertex world position is F*T(t)*u, versus F*u originally.
- Exact world preservation requires actor-frame compensation F'=F*T(-t). For scale s and root rotation R that is actor translation -s*R*t, including any root tilt/flinch. Actor placement, flight/home/target altitudes, floor-sampling origin, brain distance tests, volumes and snapshot continuation would all need to remain equivalent. No current consumer supplies that origin-compensation contract.
- Applying exact compensation in all states leaves the original world penetration untouched. Leaving death uncompensated changes corpse geometry's world height and effective actor/ground relationship. Raising only bodyY does not move this custom rig; raising binds/vertices without compensation simply raises it. Both ways of obtaining clearance are the forbidden lift in another location.

Even undoing the producer's 3.35 subtraction is not an established fix: it would lift model-relative geometry by 3.35 units (1.1725 m at scale 0.35), change live placement, and is smaller than the recorded 1.191333 m penetration. No value search was performed or is warranted.

## Admission gates if a genuinely different authorized option is later supplied

Do not edit the current model to pursue normalization. First require an actual existing consumer contract or explicitly authorized different death/physical design. A future candidate must pass:

1. Actual packed loader + AnimalFactory/rest-recipe equivalence for every attribute, bind inverse and weighted vertex; source/GLB/native parity and normals/winding.
2. Full NativeCreaturePose world-frame, socket, head/body volume and rendered skin equivalence against the unchanged baseline across idle, movement, burst, flinch, turning, scales and save/restore. No changing flight heights or actor semantics under the name of normalization.
3. Actual native actor death from multiple existing live phases, full animation/fall/settled interval, real floor queries and geometry in world space, measured penetration and contact on representative flat/sloped/edge surfaces. A source-only envelope or root height is insufficient.
4. Settled visual hold, no artificial hovering, real damage/kill/reward/retry/reload behavior and browser/render correspondence. Report strict failure as failure; do not borrow unrelated flyers' admission as approval.

No such candidate is currently established. Preserve both Medusa sources and their negative diagnostics; do not spend the recording lane or launch a compensating sweep.

## Follow-up: existing physical handoff feasibility

The existing physical API is real, but it is not a turnkey admission for this host-native flyer.

- `src/engine/entities/AnimalView.ts:395-398` starts a ragdoll from the view-owned lethal hit. `startRagdoll` at 329-344 selects custom `rigid` unless capsuleAxis=y selects `upright`; it does not exclude flying creatures. A successful ragdoll takes the view's update path at line 409 before normal motion; `updateRagdoll` copies physics root position back for loot/harvest.
- `src/engine/physics/ragdoll.ts:198-245` accepts existing rigidCorpse data, allocates one dynamic root at the *actual lethal mesh world transform*, and attaches the prepared convex colliders to it. Gravity, contact and hit impulse determine root motion. No source offset, initial support-root lift or floor correction is required. This is genuine physical support rather than an arbitrary lift.
- `src/engine/physics/rigidCorpse.ts:55-89` requires custom `rigid`, resolves bone-local hull points through actual root/bone transforms, and applies uniform actor scale once. Limits are eight distinct-bone hulls, at most 128 points each / 512 total. `RigidCorpsePose` already supports the marked numeric Medusa animation, or optional captured lethal local transforms. Captured holds the pose, sacrificing the authored death fold; it does not calculate a new shape from lethal weighted vertices.
- This API does not auto-derive exact collision from skinned geometry. Medusa has 27 bones, eight three-joint ribbons, blended skin and ten mesh parts. A hull attached to one bone does not generally follow a vertex blended across multiple moving joints. An arbitrary all-body convex hull also fills spaces between ribbons. Neither one hull nor eight has been established as an exact/faithful shape set. Source vertices being hull input would not by itself prove that the resulting convex support matches the visible geometry throughout death.
- Current capsuleAxis=y is rejected in packedCreatureBodies and AnimalFactory whenever rigidCorpse is present, and prepareRigidCorpse rejects build=upright. Changing it to z/absent changes living capsule orientation and therefore combat volumes. Keeping the current vertical volume while adding this corpse route would require changing an existing engine admission/selection contract; that is outside this audit and is not authorized by an asset-only plan. A proposed core-volume redesign needs explicit project-owner acceptance before implementation.
- **Crucial ownership distinction:** current declared native creatures are bound at `src/game/shardfile/client.ts:453-455` using AnimalView.bindSimulation. That forwards applyDamage/applyFinalDamage to AnimalSim (`AnimalView.ts:142-166`). AnimalSim.died is an empty hook (`AnimalSim.ts:278`). The view's `readSimulationPose` only observes alive/deathT (`AnimalView.ts:174-186`), not startRagdoll. `NativeCreaturePose` likewise publishes animation/volume frames without a physical-death handoff. Consequently the existing legacy view-owned ragdoll path does not constitute an already-installed native host ownership switch. Adding a damage/death callback or dual-owner glue is specifically outside the allowed scope.
- Even the legacy route can return null at its existing live-ragdoll cap (`ragdoll.ts:510-514`; phone 2 / desktop 6) or when no physics world exists. Its fallback is the keyframed flight death already rejected. Strict admission must include that failure mode rather than assume every death obtains a physical body.

**Bounded conclusion:** a one-body compound corpse service already exists for view-owned custom rigid animals; no new solver/service would be needed for that narrow class. Medusa's current native flight/body contract cannot select it unchanged. The minimum unresolved decisions are (1) accept a changed living volume model or authorize an admission/selection change, (2) establish which existing gameplay owner actually receives the lethal event and owns the corpse, including fallback, and (3) accept and prove a geometry-faithful bounded collision/pose design. The inspected host-native path lacks (2), so this is not presently a data-only implementation option. No handler, exemption, collider approximation, captured-pose change or volume change was made. Keep admission blocked and ask the owner only if such broader work is desired.
