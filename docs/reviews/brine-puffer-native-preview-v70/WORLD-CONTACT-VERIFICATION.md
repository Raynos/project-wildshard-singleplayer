# Verified world-space hit contact failure

The isolated arena has three distinct heights in the pinned engine source: collider top900, floor registry900, rendered floor899.97, and decorative grid900.015. `TrainingArena.ts` sets rootY900, rendered floor localY−0.03, and a collider centered atY−2 with half-height2. `PracticeCreature` also passes the actor placementY into its ground queries. Thus the failing point is below both collision and visible floors.

The independent verifier uses the installed Three.js `SkinnedMesh.applyBoneTransform`, not the earlier NumPy formula. It reproduces `AnimalFactory.instantiate`: named bones, parent-relative bind positions, identity mesh bind matrix, calculated bone inverses. It checks every inverse equals translation by the negative absolute bind position. It checks every position, skin index and weight against the actual decompressed packed V70 payload and exact metadata pins. Capture names/order must match all eight runtime bone slots.

Attached-mode skinning in world space is meshWorld × bindMatrixInverse × Σ(weight × boneWorld × boneInverse × bindMatrix × point). The first pair cancels; the factory bind matrix is identity. Copying the captured boneWorld matrices into this identity-root verifier therefore reproduces the actual rendered world skinning without applying actor/world translation twice. Source pins and exact calculation output are in `world-contact-verification.json`; three complete failing-frame samples are retained alongside it.

Result: V70 minimum fin clearance−0.13897924488662738m from the collider, or−0.10897924488662739m from the visible floor, at overlay36.8172s during a living9HP hit. Existing `applyAnimalRoot` adds directional root flinch tilt after custom local posing; this is beyond the previously stated local-pose test scope.

Frozen V57 rig1 was evaluated with its own exact Float32 rest geometry/weights/bind inverses under the same captured actor and bone world transforms. Every one of211 per-frame minimum fin clearances is identical to V70 (maximum difference0). This comparison isolates the fin-geometry effect; it is not a separate V57 browser playtest or a full tail/whole-body equivalence claim. The failure is inherited from the existing root-hit behavior, not introduced by the V70 geometry transfer.

The earlier failed normal contact audit remains preserved. No actor, pose, camera, gate or engine mutation was used. Independent rendered-frame review remains separate; this calculation does not establish visible severity through foreground weapon occlusion.
