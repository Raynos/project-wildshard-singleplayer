# Bloomthroat Iguana: complete-character-next

Unaccepted complete source correction for DI-N10. No likeness score, native
promotion, gameplay acceptance, or independent-review verdict is asserted.
The original hero is authoritative. World and Explorer AI sheets support
approximate hidden anatomy only.

## Editable source and intended corrections

`build_iguana.py` produces the whole character, 27-joint skinned GLB, native
source JSON and typed packed payload. It replaces the separate upright neck
oval with longitudinal trunk/chest lofts and a sloping cervical mantle,
broadens the angular skull, gives the eye a larger amber area, replaces cheek
beads with varied overlapping plate solids, adds larger shoulder/wrist plates,
rebuilds the four legs and five-toed feet with stout hooked dark claws,
anchors chunky alternating ridge plates, and builds seven broad overlapping
coral/pink throat lobes and a flattened expanded terminal tail paddle.
These are intended construction corrections, not evidence of a quality score.

The model is 3,870 triangles in 16 native parts. Geometry uses single-sided
materials and closed outward-oriented individual components. The main trunk
is continuous, but the whole animal is not a single watertight surface: jaw,
plates, eyes, limbs and petals overlap. Producer/native rest coordinates are
+Y up/+Z forward; Blender uses the proper rotation (x,-z,y).

## Checks and honest limits

- `surface-audit.json`: independent GLB manifold edge incidence, opposite
  directed edges, positive signed volume, nondegenerate triangles and actual
  single-sided view-culling counts. No repair is performed by that audit.
- `normals-audit.json`: real GLB NORMAL attributes compared with each oriented
  triangle; unit length and finite values strictly checked without repair.
- `glb-equivalence.json`: actual GLB/native oriented triangle, linear paint,
  and skin equivalence within float32 tolerances.
- `native.test.ts`: four focused tests of the actual packedCreatureBodies
  consumer, fresh buffer ownership, exact typed attributes/binds, normalized
  skin, finite numeric pose evaluation and strict finite/rest-ground/joint
  validity. Tests pass. This is not an animation-quality test.
- `weighted-pose-contact.json`: 192 sampled legacy numeric poses. Sampled
  minimum vertex Y is 0 and head-source vertices fit the retained head sphere.
  2,688 of 14,688 sampled body corners per state lie outside the retained
  torso core capsule. This is a measured diagnostic, not a waived gate or
  a claim that a living core must enclose every decorative/upper-chest corner.
  The third test asserts finite evaluation and records these counts; it does
  not assert core coverage or grant contact acceptance.

Existing v3 living core dimensions are retained (body radius 0.623, head
radius 0.574). No new physics shapes, root lift, contact fitting or runtime
changes were made. An intermediate whole-body-envelope fit produced a capsule
bottom below ground, was not adopted, and is preserved with the first attempt
in ignored evidence. Physical death, impulses, settle, combat, hit registration,
attack reach, world/Explorer runtime captures and phone performance remain
untested. Runtime admission is blocked pending independent visual and motion /
contact work.

## Actual comparisons

Ten source captures use exactly the v3 camera azimuth/elevation, target,
orthographic scale, output dimensions, lighting, samples and exposure. The
hero and nine views are fresh actual Blender renders of the final source.
Original PNGs remain in ignored evidence. WebPs and boards are review-sized
copies. `capture-provenance.json` pins the original captures; `checkpoint.json`
pins deliverables, relevant source dependencies and original references.

`paired-hero-board.webp`, `world-paired-nine-board.webp` and
`explorer-paired-nine-board.webp` compare with approved original references.
`v3-paired-hero-board.webp` and `v3-paired-nine-board.webp` compare the preserved
actual v3 captures against this fresh candidate, using identical source camera
settings. V3 is historical evidence, not a new baseline rerender.
Side names describe observer azimuth; reference boards pair sides by visible
facing direction, as v3 did. AI top orientation and subject size are not
calibrated. No generated reference is presented as an actual game capture.

Remaining visible issues include the flat-ended snout, angular/pillar-like
forelegs, faceted petal slab appearance, repeated wrist shapes and simplified
large planes on the trunk and tail. Both sides and all hidden views must be
judged independently. No builder self-acceptance is offered.

## Reproduction and preservation

From repository root, run Blender with `-b -t 2 --python` pointing to this
producer, followed by `-- --out` this folder and `--render-dir` the fresh
ignored final-render folder. Use the shared heavy build lease. Then run the
parent folder's `audit_surface.py` and `audit_glb.py`, this folder's
`audit_normals.py`, and installed Vitest with this folder's explicit test path
and config. `make_review.py` generates the approved-reference boards from
preserved originals and fresh PNG captures.

All v1-v3 sources, models and captures remain unchanged. The complete first
attempt and captures are preserved under the task's ignored intermediate
folder, not an archive. Final source and evidence were frozen at a natural
render boundary. No app build, browser, Mac, Git write, site update or
publication was performed by this lane.
