# Optional rigid corpse shape: review proposal only

No implementation authorized or made. Actual original build1 frame evidence is
still required to identify the limiting meshes and bound the candidate shape.

## Existing dimension fit is not legitimate

AnimalDims.bodyY is explicitly the bind body-bone height, 1.2000000477m here.
Bellback numeric clips consume it as the body joint Y; AnimalSim uses it for
body hit positioning and flinch classification. It is not whole-model height.
To merely contain the body's original top in the current cuboid would require
bodyY=3.165591197m at bind, or 2.892863924m after the authored .3m lowering.
That changes the meaning and moves the actual body rig, rather than correcting
an inaccurate dimension. Even then the rigid body group's X requires half1.163
vs current .94, and Z half1.566067457 vs current .950368345. Fitting that Z via
bodyRadius/bodyHalfLen inflates horizontal living hit bounds. Raising bodyRadius
to encompass the tall carrier also increases horizontal hit radius. Changing
capsuleAxis to y changes living hit orientation. None is a vertical-only fix
that accurately preserves the living anatomy/melee contract.

## Smallest bounded generic addition to evaluate

A typed optional `rigidCorpseBox` on packed body dimensions:
- `center: readonly [number, number, number]`, model-root coordinates
- `halfExtents: readonly [number, number, number]`, model units, strictly positive

Only the existing `rigid` ragdoll branch reads it, once on death; omitted means
byte-for-byte equivalent current center/extents calculation. No living motor,
combat reach, animation, guard, quadrant, mass, throw, friction, sleep or collision
group changes. Uniform actor scale applies to both center and extents exactly
once. Upright and quadruped paths ignore it or reject incompatible declarations
at admission. No species-name branch and no root height override.

Author a candidate box from a measured bounded union of exact native vertices
across the admitted collapse animation, with every vertex's containment tested.
A single enclosing cuboid can leave visible gaps for an irregular tall rig.
Therefore it is only the first bounded option, not automatic contact acceptance.
If footage shows unacceptable floating/support, reject rather than silently
expand to hulls/compound shapes. A measured convex hull or bounded compound shape
would need a separate reviewed scope. Likewise do not squeeze geometry into the
box or invent bodyY to hide discrepancies.

## Expected changes if approved

- Engine types: AnimalDims and RagdollDims; the existing rigid cuboid constructor.
- Strict packed-body parser in src/game/plugin/geometry.ts. Carry the optional
  value with dimensions; no loosening arbitrary-key validation.
- Audit native/headless schemas and retained dimension serializers for explicit
  propagation where this recipe can travel (src/format/nativePhysics.ts and
  relevant author product contracts). Do not make unrelated schemas permissive.
- Document API semantics in source and engine manual; production defaults and
  published body catalogues unchanged.
- New Bellback candidate2 metadata/admission only; immutable Frame2 payload,
  native geometry, candidate1 and decision remain unchanged.

## Required checks

- Strict reject nonfinite/missing/wrong tuple sizes, zero/negative or excessive
  extents, excessive offsets, unknown keys and incompatible recipe declarations.
- Exact absence/default parity tests for existing rigid, upright and quadruped.
- Non-unit scale constructor test; verify sole DEBRIS/world-only shape.
- Living capsule endpoints/radius, motor dimensions, melee admission and root
  animation unchanged before/after declaration; no extra living collider.
- Exact full collapse vertex containment with all eight joints and no omitted
  original mesh; current-pose at death vs future authored envelope documented.
- Fresh pinned product/host plus actual every-render full collapse/settle/Retry
  capture, original named-mesh world floor distances, visible support/contact,
  both damage directions, no post-death strike, exactly12coins and empty stores.
- Collider-change physics walk gate as required by repo rules; focused physics,
  schema, packed-body/admission and practice tests, type/layer guards.

Failure of any contact or scope gate keeps candidate2 unaccepted. A core-box
contract limitation cannot be closed with a successful local-space envelope test.
