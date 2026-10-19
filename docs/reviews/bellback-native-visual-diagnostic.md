# Bellback V6 native rest-render diagnosis

Status: diagnostic complete; Frame2 recommended as a bounded technical repair candidate for root review. No arena admission or gameplay acceptance.

## Confirmed source defect

The original loft helper recomputes each ring frame against fixed Y. The barrel
hull and lower timber jaw reverse their U axes by exactly 180 degrees between
rings 0 and 1. Their first-span quad correspondences therefore cross the volume.
This accounts for all eight hull and five jaw opposed triangles. These are not
13 independent bad triangle windings.

Read-only reconstruction pins all 14 GLB triangle IDs back to source side polygons:

- Barrel timber hull: polygons 0–7, rings 0→1.
- Lower timber jaw: polygons 0–4, rings 0→1. The reconstruction includes V6's
  existing 0.86 head-depth compression about Y=-0.65.
- Crown tie: polygon 15, rings 2→3, distinct sharp frame change; not covered by
  the hull/jaw repair hypothesis.

`visual/frame-analysis.json` records exact ring axes, adjacent frame dot products,
triangle indices and polygon correspondence. `analyze_frames.py` reproduces it
without Blender or source changes.

## Real renderer observations

The unchanged tested V70 neutral-gray-v2 preview provides the real engine renderer,
compiled creature material, world lighting and postprocessing. Its simulation is
held, its Puffer is hidden, and its first-person viewmodel is hidden for inspection.
The exact Bellback packed payload is decoded by `packedCreatureBodies`, processed
by `mergeAnimalGeometry` → `facetGeometry` → `oneMaterial`, bound to its eight
rest bones, and attached only to this ephemeral diagnostic scene. No catalogue,
engine admission, product or playable app file is changed.

The comparison source is the exact V6 GLB through `GLTFLoader`, with original
material parameters and vertex normals plus the host's normal sky shader setup.
Both variants use identical camera coordinates, world lights and composer.
Native uses the actual host's compiled flat/toon creature material and instance
tint. This intentionally includes the real material pipeline difference; it is
not a claim that glTF Standard and game toon materials should match pixelwise.

Completed final framing run: 48 frames, iPhone 16 Pro portrait emulation, renderer
pixel ratio 2, diagnostic vertical FOV 45. Zero JavaScript or HTTP errors and empty
local/session storage, IndexedDB, CacheStorage and service-worker registrations.
The top camera was above the arena ceiling: those four frames are invalid and
excluded. Eleven valid views remain; corrected top capture is pending.

Front and face closeups show a stable overall silhouette but different facet
shading and small jaw/underface culling changes. Double-sided native and
front-sided source are explicit diagnostic controls only, never proposed engine
settings. Whole-frame pixel differences include all culling/shadow effects and
must not be interpreted as a count of only the 14 suspect triangles.

Raw PNGs and full transient receipts remain outside published evidence. Small
real screenshots under `visual/` retain burned-in rest-diagnostic labels. The
first framing run included arms and is superseded for inspection, not erased.
Cloud software rendering is not physical-phone performance or a human playtest.

## Separate bounded candidate, not selected

`visual/build_bellback_v6_frame1.py` is a separate editable source. The original
source, original GLB and original packed payload are unchanged. Only the first
hull/jaw span's ring correspondence changes: hull shift4, jaw shift3. The
pentagonal jaw cannot represent a half-turn by cyclic relabeling; shift3 retains
36 degrees of twist while maximizing minimum split-triangle alignment among the
two equal-distance candidates. All ring vertices, point sets, palette assignments,
other lofts and the crown remain unchanged in three passing source-level tests.

This candidate still needs an actual Blender export, unaffected-mesh parity,
normal audit and matched real-native renders before root can select any new tuple.
The crown remains an independent caveat. No triangle reversal or engine-sidedness
change is authorized by this diagnostic.

## Frame1 actual export and renderer result (04:14 UTC)

Blender 4.3.2 exported the separate candidate successfully. Decoded GLB comparison
proves all 71 unaffected meshes have identical positions, normals, indices and
materials. Both changed meshes retain exactly the same position sets, materials
and triangle counts. All node transforms and the complete material table match.
The normal audit drops from 14 opposed triangles to one, the unchanged crown.
Three Python source-delta tests and three actual packed-consumer / independent
GLTFLoader / rest-skeleton Vitest tests pass. No full application test is claimed.

The second renderer bundle completed 72 fixed portrait captures across both
original V6 and frame1, including the corrected top and explicitly isolated
hull, jaw and crown node views. The same game renderer, material, lighting,
FOV 45 and ratio 2 were used throughout. Simulation frame count stayed fixed.
Zero JavaScript or HTTP errors; all sampled persistence stores stayed empty.
`visual/frame1-render-receipt.json` pins source inputs, candidate closure, raw
captures and the small labeled screenshots in `visual/frame1-views/`.

Whole-model front/top/side views retain the model's silhouette and identity;
local facet and shadow changes occur around the repaired hull/jaw. These are
technical visual observations, not a new independent likeness score. The
isolated crown exposes the retained folded ribbon and source/native facet
shading difference. The original whole-model crown view was timber-occluded;
it was not proof of defect absence.

The crown quad's source vertices are [15,16,22,21]. Its current split has geometric
normal cosine approximately -0.882; the alternate diagonal gives -0.931. A simple
diagonal swap cannot fix it. Any future crown repair needs its own bounded local
ring-correspondence analysis and source/native visual review, not a global normal
flip or double-sided engine setting. Frame1 remains unselected and unadmitted.

Exact separate candidate pins:
- Source: `8c5f87075b5e4c878b8dc766d09020a80ffb97a4e36e07f7e57ce1b3bebb78a7`
- GLB: `a990dd05e254e35d981c60ebb76b3baf0997a41705b5a35ed145acd9f08ac601`
- Native JSON: `895f3169d27430308a26292e58124fc9eafd13c0d89a9509e93b27d2206f69aa`
- Packed bytes: `78e75381d5c9149691aa2d5eb2e9f1219484eca478819f0e2b32190ba18b3744`

## Final Frame2 result and bounded selection (04:29 UTC)

Root selected the separate Frame2 tuple as the bounded technical fold-repair
candidate for next isolated arena preparation after inspecting the actual
source/native front and isolated Frame1/Frame2 crown captures.
The identified hull/jaw/crown side folds are resolved without moving vertices,
recoloring, decimating, changing the engine or forcing double-sided rendering.
This is not visual/gameplay acceptance or a new likeness score; all runtime
acceptance fields remain false. Root owns approval of the eventual native,
dimensions, animation and product tuple.

The whole-crown study found an additional folded span that a stored-normal-only
opposition test missed. Frame2 changes only crown span 2→3 by cyclic shift 2 and
span 4→5 by shift 5 (12 side quads total). All 30 crown side quads now have positive
triangle-pair alignment on either diagonal; worst cosine 0.7746. The same full
side-quad test passes the hull (worst 0.9967) and jaw (worst 0.4119). Crown remains a
closed, consistently oriented combinatorial mesh. Its original coincident-end
cap overlap is preserved: this is **not** global self-intersection certification.

Actual Blender/GLB checks confirm:
- zero opposed triangles across all 4,458 triangles;
- all 70 unaffected meshes match the original exactly;
- hull/jaw match Frame1 exactly;
- every ring point set, node transform and material assignment is unchanged;
- all 8 crown cap triangles retain exact positions, normals and vertex ordering;
- eight joints/parts and 13,374 native vertices remain unchanged.

Eight Python source/topology tests pass. Frame1 and Frame2 each pass three actual
packed-consumer, independent GLTFLoader and THREE rest-skeleton tests. Three
focused diagnostic Vite bundles built successfully; no full suite, standalone
project typecheck or whole-app gate is claimed. These art paths are ignored by
repo lint; a no-files result must not be described as a lint pass.

Frame2's final run captured 72 real portrait frames: same tested host renderer,
compiled toon material, fixed lights/cameras, FOV 45, render ratio 2, held simulation,
source/native pairs and explicit sidedness controls. It includes all nine whole
model angles, face closeups and isolated hull-side/jaw-side/crown diagnostics.
Zero JS/HTTP errors; all sampled persistence stores empty. All 137 files in the
V70 host match its existing tested inventory after capture. No host file changed.

Visual verdict: the isolated crown now reads as continuous rope surfaces rather
than a folded ribbon. The full-model identity is stable. Frame1→Frame2 native
front is pixel-identical below the label; the other eight whole-model views have
only 21–958 pixels differing by more than 8 gray levels at the raw screenshot
resolution. These are localized crown/shadow changes, not a new likeness score.
The earlier 3.5625 score belongs to the exact original V6, not automatically to
these technically repaired files.

Source/native are still not shading-identical. Frame2 has 596 triangles whose
geometric versus stored-polygon normal cosine is below 0.995 (original 617), with
minimum 0.377. The native path uses per-triangle facets, centroid color jitter,
the actual game's compiled material/instance tint and grading. The comparison
GLB uses its original Standard material parameters and polygon normals. Both
share real world lighting and camera; these intentional pipeline differences
remain visible and documented. Existing stippled shadow artifacts are present
in both source and native views. No phone performance, authored animation,
collider tuning, combat, rewards, persistence gameplay or fun acceptance follows.

Final evidence: `visual/frame2-render-receipt.json`, `visual/frame2-views/`,
`visual/frame2-native/closure.json`, `visual/host-verification.json` and
`visual/normal-deviation-comparison.json`. Earlier sources/candidates/captures
remain preserved. Baseline's above-ceiling top view is invalid; subsequent top
views are corrected and visually verified.

Exact Frame2 pins:
- Source: `68a955915e6836735a0c0df2454c2f168255689f2baf54ef2bea16008a410728`
- GLB: `f8b0d37813279d7ee1c079a2a2b498a05a9a6e4ea751846e4fef036a567596f0`
- Native JSON: `32e78a1677765c511645905ca7c48ad3e60d0cf7fac4a8dbd830d39e9f343d44`
- Packed bytes: `b97a9df5437062aa2eb490340663c2b35ecf22ba83c83b834082d8ffe7ae7e9c`


## Remaining rig, collider and animation contracts

Frame2 preserves the exact eight-joint rigid rig: body root; head, bell and
leg0–leg3 parented to body; clapper parented to bell. Each vertex retains one
influence. Body rest Y is 1.2000000476837158. There are no knee or cradle joints.
Existing `tidalGiantsClips.ts` Bellback clips reference missing `cradle`/`knee0..3`
and hardcode body Y 1.05: they must not be reused unchanged. Rest skeleton and
joint-isolation tests are not authored animation acceptance.

The next bounded lane must produce reviewed numeric poses using the actual rig
bindings and dimensions: gait, windup, pulse→echo, stomp, flinch and death.
Specify root-flinch ownership explicitly and test that engine recoil and authored
recoil do not stack. No Puffer gait adapter. Sample articulated feet/contact,
rig containment, animated reach and corpse ground clearance across each clip.

Current diagnostic dimensions are deliberately conservative and cannot serve as
bout tuning: body radius 2.304098688682005, half-length 1.7766000032424927, head
radius 1.6071624042695387, half-width 1.6799999475479126, leg length
1.2000000476837158, capsule axis Z. They include the tall frame and horns. Measure
and review body contact separately from the high frame, head hit volume, foot
contact, animated envelope, strike reach and corpse clearance before admission.

Keep the proposed closure in `runtime-admission/ADMISSION.md` narrow: Bellback
HP 180, one actor and decision guest, one approach move, three unchanged
pulse/echo/stomp strikes, five explicit `tg-*` aliases, this one packed body,
reviewed dimensions/poses/look sockets, existing sword/materials and a 12-coin
bout-local reward. Compile only that guest and validate a fresh exact product.
Use the real practice consumers with null storage, persistent false and empty
save namespaces; do not change the existing Puffer admission or host.

Required actual arena checks remain: walk-around and articulation/contact,
pulse→echo and stomp, poise interrupt, hit/death, no post-death strike, exactly
one 12-coin local collection, retry to fresh player/enemy health 100/180, empty
persistence stores, and refusal of foreign species/guests. Physical-phone
performance and fun remain untested. Original V6 static-selected evidence and
its 3.5625 score remain intact and distinct from this technical candidate.
