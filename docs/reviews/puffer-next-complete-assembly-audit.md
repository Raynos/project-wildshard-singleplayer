# Puffer: next complete assembly source audit

2026-10-19. Recommendation for **one substantial complete static candidate**, not
an accepted asset or another isolated attachment study. Owner reopened the five
originals toward separate >=4/5 likeness and animation/readability at 12:32,
as supplied by the coordinator. The old guided-source parked receipt is historical;
it does not override that direction. V70 gait5/authored recoil/gray-v2 remains the
protected tested playable fallback. No runtime promotion follows from this audit.

## Decision

Use **closed-anatomy-study as the whole-character visual comparator**, and use the
**pre-paint guided seated-mouth carrier as the editable face/body starting source**.
Make a single coherent assembled model with a rounded forward pouch, descending
sheltering crown, thick compact fin webs, and stronger shoulder-spike silhouette.
Preserve authored-depth hood, seated beak, diagonal paint semantics, V9-derived eye
and mouth detail, and the selected bordered tail. Do not stack the guided hull on
the pass2 hull or paste its face over the latter's face.

This is a deliberate construction choice, not a claim that the guided model already
beats selected. The first complete tuple was actually assembled and rejected; its
components are retained studies, not undiscovered improvements. Pass2 later started
from V71 again, with V71's four fins and angular brows, plus the retained tail.
Closed anatomy inherits that choice. Thus simply assembling the old tuple again, or
merely closing/reseating it, would repeat work and would not meet this brief.

## Evidence actually inspected

Read AGENTS.md, docs/process/GIT.md, STORAGE.md, current driftwood-enemies STATE,
complete/pass2/pass3/closed-anatomy construction and independent reviews, crossing
diagnosis, local-repair failure, and retained hood/mouth/tail/fin/spike reviews.
Read the actual guided, paint, pass2 and terminal-fin producer code and native
part inventories. Recomputed the source hashes below without running producers.

Opened the authoritative original pixels first:
`art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/brine-puffer-lowpoly.webp`.
Then individually opened the selected **hero and all nine actual PNG views** in
`art/driftwood-isle/puffer-complete-remaster/closed-anatomy-study/captures-final/`:
`closed-anatomy-hero`, `01-front`, `02-left`, `03-right`, `04-back`, `05-top`,
`06-elevated-front`, `07-elevated-left`, `08-elevated-right`, `09-elevated-back`.
Also opened `puffer-complete-remaster/complete-hero.webp` to inspect the earlier
assembled guided/compact-fin combination. No sheet substituted for the nine views.
The selected PNGs retain actual rendered pixels but were losslessly re-encoded;
original encoded PNG bytes were not retained. This audit is not score-blind and
assigns no new score. No new rendering or geometry certification was performed.

Visible complete-model problems, corroborated directly in those images:

- Front/hero: broad angular cream mask crowds the eyes; the concept's lower pouch
  hangs rounder beneath a descending teal roof and has more integrated cheek planes.
- Both side views: horizontal teal courses remain conspicuous; the pouch projects
  with a near-vertical front and an abrupt side join. The next pass must improve
  the actual side envelope, not merely recolor or soften normals.
- Top/elevated sides: shallow long front flippers and narrow steep rear supports
  look mechanically repeated. The original supports broad thick fan webs.
- Back/elevated back: a coherent tail is already present; adding thickness again
  is low value. Repeated diamond-like spike accents and ring-like crown planes
  remain obvious. The original's unseen surfaces are not exact specifications.
- Earlier complete hero: shorter fans alone became narrow supports/scalloped shoes,
  and the hood became a level orange ribbon. Those regressions must be avoided in
  the new integrated model, despite their bounded component-review preferences.

## Exact retained sources

All paths in this section are under `art/driftwood-isle/`.

**Selected complete comparator:**
`puffer-complete-remaster/closed-anatomy-study/closed-anatomy-native.json`,
1,443,054 bytes, SHA-256
`98c4855852fc77ef385b0998e98dc5bdbabf40bb32b815f598c9a922525e5006`.
Exact GLB `closed-anatomy-study.glb` alongside it, 636,280 bytes, SHA-256
`4261180dcd0f9dc7c011f2631a1d0d37cc92ac30dd20f892a2aa1eb39eb8f8ef`.
Seven parts, eight joints, 3,486 triangles. Latest matched review preferred this
at 3.6375 to pass2 at 3.5975, without accepting either. Historical pass2 3.80 and
V71 scores belong to their separate reviews; never average or transfer them.

**Editable guided carrier before semantic partition:**
`puffer-remaster-guided/seated-mouth-diagnostic-native.json`, SHA-256
`030dbb8c40bf2507429b6017ad4c8d36a15eb5f5ca839c630e14189c51c8424b`.
Its part0 has 1,142 triangles; the later diagonal painted part0 has 4,448.
Use its explicit surface geometry and source correspondence, not an inverse
weld of the painted output. Producer references:
`build_guided_surface_supported.py`, `build_integrated_face_baselinehood.py`,
`integrated_orbital_surface_baselinehood.py`,
`build_integrated_face_seated_mouth_buried.py`, `seated_mouth_unit_buried.py`.
These stay immutable; extract needed routines into the new producer with pins.

**Final palette/face semantics:**
`puffer-remaster-guided/semantic-face-diagonal-native.json`, SHA-256
`483b47367ddbad0e4872f357f786fc0cca778380a07bd536428923aadd3046cb`;
`paint_semantic_face_diagonal_robust.py` and its receipt define the diagonal
cream/teal/orange fields. Preserve their visual ownership, not every coplanar cut.
No blanket clean-solid claim is available for this source; audit it independently.

**Tail:** `puffer-tail-study/tail-native-study.json`, SHA-256
`c8f2ef68d0860539b93d3a343a54a05369b3278d239d5e871715a6f3abb17d35`.
One 236-triangle part; carry its full shell, root and pivot unchanged initially.
It is already in selected and pass2. No duplicate fan or new thick rim.

**Compact front-fin reference:** `puffer-fin-study/terminal-fin-native-study.json`,
SHA-256 `755d8e2d7605cfe9331ae064fe6f301602709ed542e8ee73f3d56f6687f0159e`.
Two 360-triangle parts, with editable `terminal-fin-fans-indexed.json`,
`build_fins.py` and `build_terminal_fins.py`. Reuse compact reach/sole/pivots and
coherent web principles; broad shoulder volume and purposeful broad tip masses
must be authored in this complete pass. Do not import the rejected fluted version.

**Spike reference:** `puffer-spike-study/spike-native-study.json`, SHA-256
`f49fb808735792d5945d8ac2991e89c5e8f013b4e4e8dcfe6ee51cfc189e90dd`;
use `spikes-indexed.json`/`build_spikes.py` for semantic identity and hierarchy.
Do not paste its entire part0, which would replace the carrier. Its primary and
rear exposed-root exceptions were never accepted. Pass2's stronger seated wedges
are a separate shape reference, not an instruction to compose raw vertex ranges
from incompatible hulls.

## Topology failures that determine the construction order

Selected/pass2's exact-edge closed hull is not an intersection-free solid. The
independent normalized plane-slice diagnostic found **21 proper crossings in each**,
including twelve hidden by the earlier shared-vertex exclusion. The selected
neighborhoods are left lower flank, positive orbital/mouth wall, negative orbital/
mouth wall. Pass2's nonlinear per-vertex reshape moved already-cut semantic and
Boolean vertices off their carrier planes/segments. Selected repeated nonlinear
motion with a normal limiter; preserving each normal hemisphere did not prevent
surface crossings. V71 itself already has a robust folded lower-flank pair.

The bounded harmonic local repair removed those 21 but introduced/revealed failure
conditions: four coplanar hull overlaps, four nonincident vertex/face contacts at
unchanged faces 1009–1013, nineteen corresponding normal hemisphere reversals,
0.155896% volume loss, and maximum displacement 0.145178. Its three old stencils
cannot fix the outside contact region. It is a failed diagnostic, not a clean base.
Closed head solids also retain two inter-component point contacts in the palate;
classify those explicitly rather than reporting a whole-part welded manifold.

The guided carrier shares V71 ancestry. Therefore these numeric face IDs are
**diagnostic pointers for selected only**, not valid edit indices in guided.
Map corresponding regions by oriented source triangles/semantic geometry and
redetect its full contact set. An exact-edge closure report is insufficient.

## One coherent construction, with bounded edits

Create a new source directory
`art/driftwood-isle/puffer-complete-remaster/next-complete-assembly/` only. Proposed
producer paths: `build_candidate.py`, `carrier-controls.json`,
`surface-ownership.json`, `audit_geometry.py`, `export_glb.py`,
`audit_glb_roundtrip.py`, `render_matched.py`, plus native/GLB and receipts.
No old source, runtime, physics, Site, pin, STATE or admission file is editable.

1. Freeze seven-part/eight-joint identity, native +Y up/+Z forward conventions,
   V9-derived iris/pupil/palate detail, authored hood underside/front/rear anchors,
   seated bill/cavity depth, tail, skin schema and bind pivots. Use a single guided
   carrier, never overlapping complete bodies or a replacement face proxy.
2. Produce an explicit pre-paint indexed carrier and mapped edit manifest. Repair
   local folded/contact sheets by replacing the surface arrangement inside named
   connected patches, including any corresponding 1009–1013 contact neighborhood.
   Keep unaffected vertices/faces exact. Construct each replacement from boundary,
   cavity-depth and cheek anchors; do not repeat a harmonic solve, blanket smoothing,
   global remesh, voxel union, spherical bowl or stereographic pass3 sampling.
3. Within the same complete candidate, author **connected crown/flank patches**
   with broad irregular interlocking planes and a descending roof, and a modest
   continuous lower-front shape correction with central forward support. Keep
   guided pouch depth and full lower closure. No wholesale bowl replacement.
   Author carrier-level macro vertices first; reconstruct dependent cut vertices
   by barycentric/edge interpolation only afterwards. A remaining old course may
   be replaced only in an explicit bounded patch; do not deform the final flat soup.
4. Integrate compact front fans with broad three-dimensional shoulders, a low
   continuous web and a few unequal broad cream tips. Widen rear supports into
   lower broad webs consistent with that same stance. Preserve pivots, sole plane
   and source-scale footprint limits; do not get compactness by turning fins into
   thin legs, scalloped shoes or grooved toes. This is part of the whole-body output,
   never a separately scored toe variant.
5. Keep dominant crown asymmetry and make the shoulder wedges contribute to the
   silhouette; place roots against the final carrier, not V71's cage. Keep the
   retained tail exact unless actual final-hull clearance fails. Reapply diagonal
   semantic paint last with source-face correspondence, flat region colors and
   exact carrier-area conservation. Preserve separate angry orange hood masses;
   avoid the first complete assembly's uninterrupted ribbon.
6. Close any still-open inherited inlays with source-specific caps/walls, preserving
   exposed faces. Selected's closure method is reusable, but its face numbers are
   not portable into the guided part. Resolve point contacts explicitly. Export
   one complete model, not multiple mutually incompatible part studies.

The expected meaningful correction is visible simultaneously in hero/front/side:
rounder hanging pouch under a descending sheltered face, shorter thicker planted
fans rather than long shallow flippers, stronger shoulder wedges, and less regular
teal courses. If only root seating or tiny rim details change, this pass has missed
its purpose. This is a testable expectation, not a predicted >=4 score.

## Mandatory gates before visual judgment

- Pin all input hashes and save the exact edited carrier/part envelopes. Assert
  unchanged geometry outside those envelopes and exact protected detail/bones.
- At carrier, post-paint and exported-float32 stages: finite attributes, nonzero
  areas, closed oriented two-face edge incidence, single-cycle vertex links,
  positive volumes, and full triangle intersection/contact classification.
  Include shared-vertex proper crossings, coplanar overlaps, nonincident vertex/
  face and edge/edge contacts; no blanket adjacency exemption or numerical waiver.
- Keep separate intentionally intersecting closed appendage parts explicitly
  classified; no requirement to union every part, and no self-crossing hull waiver.
  Audit continuous attachment-cap/triangle containment where feasible, plus the
  original finite root samples. Sample success alone is not continuous proof.
- Report full-body bounds, volume, per-region displacement and directional support
  deltas. For changed topology compare surface orientation against its carrier,
  not meaningless old/new face-index normal pairs. Protect the frontal bowl depth
  and silhouette landmarks, not just six-axis extents or aggregate volume.
- Round-trip actual GLB positions, color, skin, names, eight pivots and inverse
  bind matrices with single-sided material. Target GLB <=1,000,000 bytes and native
  JSON <=5,000,000 bytes; no size-limit or culling-policy change.
- Failed construction stays labelled failed. Do not substitute a flattering
  hero, hide a cap, flip normals, lower epsilon until green, or earn art credit
  from technical passing checks. No img2threejs1–8 rerun.

## Matched evidence and storage reservation

One new complete candidate versus the exact selected native: twenty actual renders,
hero plus nine per model. Reuse the selected fixed camera positions, targets,
scales (3.2 hero/4.2 standard), 600×740, 24 samples, seed 0, AgX, no denoising and
three-area-light setup. Freeze source, renderer, settings and camera hashes before
render; toggle complete models only. Preserve raw original PNG bytes and hashes.
Do not silently re-encode files as happened previously. Renderer admission/heavy
lease belongs to the coordinator; this audit starts no job.

Reserve one ignored `tmp/puffer-next-complete-assembly/` capture set up to **24 MiB**
for raw images/receipts, subject to coordinator allocation before execution. If
actual bytes exceed it, report the exact need rather than delete or replace raw
originals. No saved .blend is necessary if scripts recreate the scene. Twenty
labelled full-frame WebP previews <=250 KB each, two portrait boards <=500 KB each,
one GLB <=1 MB: **<=7 MB new binary**, leaving margin under the 10 MB per-push cap.
No videos, image caches, build trees or duplicate native files. Check shared push
headroom; these are proposed caps, not an already granted storage exception.

Fresh independent reviewer sees approved original and every candidate image before
predecessor pixels or prior scores. Same 35/30/20/15 likeness rubric; no averaging
historical judgments or rounding to 4.00. Owner acceptance, animation/readability,
runtime materials, combat and physical-device behavior remain separate gates.
Only after that complete judgment should the coordinator decide any next work.

## Audit closure

Only this Markdown file was created. All source inspection was read-only. No build,
render, browser, runtime, physics, Git, Sites, Mac, label, or child-agent action.
