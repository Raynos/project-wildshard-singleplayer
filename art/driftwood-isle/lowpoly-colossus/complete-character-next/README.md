# Colossus complete-character next

One unaccepted complete-character correction from retained pass4. No author
likeness score, promotion, gameplay or animation/readability acceptance.

## Reference and construction

Before editing, opened the full original approved PNG, both World/Explorer
nine-angle reference sheets, and all ten actual retained pass4 frames.
The original large catalogue hero is authoritative. AI hidden views remain
approximate. Read the pass4 independent review and prior construction audit.
Retained pass4 and public motion2 are unchanged.

The continuous beak mask is replaced with a short central nasal keel, separate
long pale cheek/jaw blades, and recessed dark backing. Existing eye/socket
positions remain. Fingers and opposed thumbs gain substantial cross-sectional
volume while shortening slightly; the outer hand root gains thickness locally.
Upper ribs and lower cradle follow unequal oblique routes with a new abdominal
braid. A rear heart-cover root closes the cyan rear opening. Smaller growth
cores carry unequal cascading leaves across shoulder/back, arms and legs.
These changes are real shared geometry, not camera-specific silhouettes.

Visible limitations remain: chest roots are still strongly layered, hands are
still separated hooked digits, and foliage includes repeated blade construction.
The changed face can lose pale continuous mask area. Only independent review
can determine whether these tradeoffs improve original likeness.

## Strict geometry and the preserved failed construction

Initial closed geometry passed edge/volume checks but failed a stronger normal
audit: 12 opposed and 9,513 deviating exported vertex normals. The exact initial
producer, validation and labelled hero are preserved in failed-initial/; all
raw frames/GLB/logs are preserved at the receipt paths. No initial failure was
silently overwritten. The correction triangulates after the common shape-space
bend and recalculates actual triangle normals, rather than relaxing the test.

Final GLB: 269 meshes, 959 material primitives, 6,002 triangles. Finite attributes,
indices, quantized-weld boundary/nonmanifold edges, winding conflicts, zero-area
triangles, aggregate and connected-component signed volumes, unit normals and
normal/winding agreement pass. Minimum normal cosine is 0.9999999964620283.
No inter-component intersection or union-watertightness claim follows.

The triangulated export initially exceeded 1 MB by 4,572 bytes. Final packaging
removes only redundant mesh labels, keeping exact node names. Final is 993,940
bytes. render-equivalence.json verifies exact BIN equality and exact JSON equality
after this one metadata deletion; geometry/materials/transforms match captures.
The pre-strip producer and rendered GLB are preserved. No visual change followed
capture.

## Editable/native preparation and actual consumer

build_colossus_complete.py is self-contained editable Blender source.
construct_source.py derives it from SHA-pinned retained pass4.
editable-native.json retains exact named editable vertices, triangles, palette,
face materials and edit pivots. Native packed preparation separately contains
22 derived anatomical bones, normalized skin weights and 11 semantic batches.
It uses the existing codec, and does not modify a runtime catalogue.

Four focused tests passed through the real packedCreatureBodies consumer and
THREE GLTFLoader: exact positions/colors and fresh geometry; every ordered GLB
triangle with matching normal; analytic THREE skin/rest and joint isolation;
rejection of pre-load, foreign identity and truncated data. Run command:

    HOME="$PWD/tmp/home" node node_modules/vitest/vitest.mjs run art/driftwood-isle/lowpoly-colossus/complete-character-next/native-consumer.test.ts --config art/driftwood-isle/lowpoly-colossus/complete-character-next/vitest.config.ts

This is executable rig preparation, not a usable-animation or contact acceptance.
The derived skin fields and conservative test-only dimensions need motion and
contact review. Source GLB has zero skins/animations; the native package carries
separate weights/bones. Packed native color does not reproduce source emission.
No native render, game browser, app build, phone or physics test was run.
The first pnpm invocation failed during its automatic dependency check; direct
installed Vitest with an explicit focused file succeeded. Both logs are retained.

## Matched evidence and reproduction

Candidate hero plus nine actual full PNG captures use the unchanged pass4
protocol: 525x700, 16 Cycles samples, no denoising, Standard transform, target
(0,0,2.9), ortho7.7, identical world lights/floor. Retained pass4 actual captures
are reused by exact hash. Both sets were individually inspected. The full mesh
projection lies inside every frame; framing-check.json records margins.

Generate with construct_source.py, then render_matched.py through the shared
heavy build lease using Blender4.3.2 -b -t2 --python-exit-code1, -- --out pointing
to a new ignored evidence directory. Validate with validate_glb.py. Run
export_native.py after the final GLB is placed beside it. package_evidence.py
checks hashes, matching cameras, export equivalence and storage budgets.

Ten labelled candidate WebPs and one matched portrait hero board are provided.
Full raw images, failed outputs and execution logs stay ignored with hashes.
Only this new asset directory and its own ignored evidence were written. No Git,
Site, runtime, production asset, Mac or shared State changes were performed.
