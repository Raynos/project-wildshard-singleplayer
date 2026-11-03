# OP26 billboard re-shoot

In flight, sp-x6, 2026-11-03. Capture only; no visual source changes.
The original review is `8d810f14d7`; the fix is `e0cc0a074b`.

The original raw frames and exact camera inputs were deleted. These
camera manifests reconstruct the review's listed distances and board
geometry, with eye heights and three-quarter angles inferred from its
images. They are **not recovered original camera bytes**, and the old
review-sheet crops are not a pixel-parity baseline.

The persisted `cameras.json` names every original board/row/view and
baseline image hash. Per-board manifests retain the original board
centres and heights, including the old Frostline plaza position. New
board offsets/heights do not silently reframe the cameras. Inferred
values are stated in each manifest's convention. Every physical anchor
stays nine metres behind its board so shipping L0 residency remains live.

First capture the **51 red-tagged panels**, then the other **192**;
all **243 panels / 27 boards / six plots** remain required. Frostline's
plaza view 5 is green in the actual original sheet despite the review's
prose table listing it; the six red plaza tags are 1, 3, 4, 6, 8 and 9.
This selection follows the actual sheets and preserves their 51 total.

`capturePlotDomes` takes the explicit subset in `viewSelection` (keys
`<slug>/<A1..D2>`), preserving camera numbers, phone profile, normal grid
entry, residency, document, source, frame and image guards. A partial
run records requested/completed views and defers boards. The maintained
board maker still refuses anything except all nine hash-bound views.

Final labelled before/after boards and their by-eye verdicts will follow
here. No capture, clipping-clearance or full-nine-view pass is claimed by
these camera inputs alone.

Night Market plaza requested view 7 (12 m behind) is retained with its
occluded flag. sp-o3 traces its eye (-22,1.7,-28) to the retained stall
at (-22,-27.5), outside the keep-out. The coordinator rules this is not
a clipping defect unless an 8 m-behind diagnostic finds intersection.
The separate supplemental D1 manifest selects only view 7 from
(-22,1.7,-32), inside the cleared strip; it never replaces the core frame.
Its capture and result remain pending.

Frostline's intentionally moved plaza board (z -54 to -62) places the
fixed-original front 8 m eye under its new plane. Those original frames
remain flagged as unable to prove clearance. The separately approved
D1 plaza-follow manifest translates all nine views and their physical
anchor 8 m south, keeping every relative distance and angle. Its result
is supplementary and never replaces the core set. Capture pending.
