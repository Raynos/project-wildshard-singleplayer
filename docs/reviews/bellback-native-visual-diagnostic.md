# Bellback V6 native rest-render diagnosis

Status: in progress, rest-render diagnostic only. No arena admission or gameplay acceptance.

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
pixel ratio 2, diagnostic vertical FOV45. Zero JavaScript or HTTP errors and empty
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
FOV45 and ratio2 were used throughout. Simulation frame count stayed fixed.
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
