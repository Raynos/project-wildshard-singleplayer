# Brine Puffer: independent spike-hierarchy study

Status: one unaccepted geometry proposal on retained V71. This is a part study,
not a new numbered creature candidate, accepted remaster, or runtime replacement.
No whole-model resemblance score is assigned.

## Authority and intent

The approved original is `../concepts/lowpoly-revision-2026-10-18/brine-puffer-lowpoly.webp`.
The complete V71 native baseline is `../approved-puffer/unaccepted-native-v71.json`.
Its generator is `../approved-puffer/build_puffer_lowpoly_v71_from_v9.py`.
Baseline SHA256: `e3f5f018bd11c6e58cdbafb5af69440336d257192360d7e46339162a61701338`.
Original SHA256: `01ba7d0fbfb66bbdd929c975eb75729d7b28cd3aa023db0581df94a718e3d028`.
V71 generator SHA256: `653f2be77e3cd2302f7cbd4735e6d957ec97a722edfdf155b2dc659ffc0927ec`.

The original visibly uses chunky cream wedges, one dominant irregular crown,
shoulder supports, and smaller flank accents. Its visible count cannot establish
hidden anatomy. This proposal inherits V71's eight components without adding any
or claiming the count is reference truth. V71's broad left-biased primary wedge
already serves the design well and is preserved exactly, including its tip,
root, winding, colors, skin weights, and asymmetry. The hidden rear accent is also
preserved exactly rather than inventing a new unseen arrangement.

Changes form one coherent hierarchy:

- Rear crown satellite: tip distance 88%, root width 105%.
- Front crown satellite: tip distance 78%, root width 112%.
- Both shoulder wedges: same tips, root width 122%.
- Both flank accents: tip distance 94%, root width 115%.
- Primary crown and hidden rear accent: exact retention.

Each modified cap moves inward only as needed for its four root corners to clear
the actual V71 main hull by at least 2 mm. Closed five-vertex wedge topology,
inherited cream face colors, and weight arrays are preserved. No needle-like
extra apexes or decorative secondary triangles were introduced.

## Editable deliverables and integration

`build_spikes.py` is the normal editable generator. `spikes-indexed.json` stores
actual indexed vertices, triangles, root/tip indices and source triangle ranges.
`spike-native-study.json` is a directly usable full native payload in the existing
schema, in x-right/y-up/z-forward coordinates. Only the positions of six
six-triangle spike components differ from V71. The consolidated part name is
unchanged; no runtime import or asset reference was changed.

All body, face, mouth, eye, pouch, tail, fin, skin-index, skin-weight, color,
skeleton and other-part arrays are exact. Source/native SHA256 pins and bytes are
in `pre-render-source-pins.json`. `structural-audit.json` adds generated pins.

## Verification and limitations

Run from the repository root:

    python art/driftwood-isle/puffer-spike-study/build_spikes.py
    python art/driftwood-isle/puffer-spike-study/check_spikes.py

The tests require finite vertices, nonzero triangle areas, consistently oriented
closed two-face-per-edge components, positive signed volume, exact protected
arrays, exact primary/rear components, and unchanged spike count. Root containment
uses full solid-angle winding and nearest triangle/edge Euclidean distance
against the isolated 1022-triangle V71 main hull. Besides four corners, 30 cap
samples per wedge are tested. Passing samples are not a proof over every possible
point of a continuous nonconvex surface.

Retained exceptions are explicit: the primary has an inherited exposed root corner
of +6.20 mm; the hidden rear accent has +34.43 mm maximum exposure. Exact retention
is intentional. Neither is falsely reported fully buried. The six modified caps
pass all sampled points with at least 2 mm burial. Separate wedge solids overlap
the mantle; this is not a welded or Boolean-integrated new body.

Do not transplant these seated coordinates blindly to the body worker's new cage.
Recheck actual root clearance, silhouette and bind behavior after integration.
There is no animation or gameplay proof in this isolated static study.

## Evidence

`render_comparison.py` reconstructs the actual native V71 and study in Blender,
with identical full-body hero, front and elevated-side cameras per pair, the
established three-light V71 studio setup, unchanged colors, orthographic framing,
AgX, 600×740 portrait frames and 20 samples without denoising. It does not rebuild
or overwrite the retained asset. `prepare_evidence.py` burns labels into six WebP
frames and one portrait comparison board.

Review images remain outside Git in ignored temporary storage for native Site
publication by the coordinator. The source and native geometry are ordinary
repository files. Captures are static Blender evidence, not screenshots of the
playable game and not physical-device performance results.

### Actual visual finding

The six actual frames completed in Blender 4.3.2 with exit 0, and the labelled
portrait board was inspected. The proposal is a restrained local improvement:
the hero's reduced crown satellites leave the unchanged left-biased main wedge
more legible, while broader shoulder wedges still read as supports. The front
remains nearly unchanged, as expected, because the preserved primary dominates
that silhouette. The elevated side shows the subordinate top wedge shortened
without turning the crown into a regular mirrored row. Modified visible roots
remain seated; there is no apparent new floating cap in these three views.

The change is modest, and cannot resolve V71's body, brow, fin or tail problems.
Recommend carrying this one spike hierarchy into the integration comparison,
then rechecking roots against the chosen body and all fixed views. Do not count
it as a complete remaster improvement or a new whole-creature score.

`capture-receipt.json`, `evidence-receipt.json`, and `output-closure.json` record
actual cameras, labelled image hashes and all ignored render artifact bytes.
Source pins were verified again after the render. The six individual WebP frames
and the 300,554-byte portrait board are ready for native Site publication.
