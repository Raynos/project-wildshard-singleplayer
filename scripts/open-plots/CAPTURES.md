# Plot captures and boards

OP3 owns `plots.json` and the eight `art/open-plots/<idea>/domes/*/cameras.json`
files per plot. OP4 reads those inputs; it does not choose new art or lenses.
The registry and camera bytes are read from the exact `--pin` commit, so a
loose manifest edit cannot change a pinned reading. The camera schema is the maintained `parseDomeCameras` schema: nine ordered
views per dome. `convention` records approved versus TEMPLATE provenance.

After the normal pinned preview is READY and the machine turn is granted:

```sh
scripts/browser-lane.sh --max 45 node scripts/open-plots/capture.mjs \
  --base=http://127.0.0.1:4400 --pin=FULL_40_CHARACTER_SOURCE_SHA \
  --plots=open-plot-night-market,open-plot-lantern-bayou,open-plot-showcase-template \
  --junction=-0.5,1.5 --out=tmp/open-plots-capture
```

One Chromium process captures 3 × 8 × 9 live views, creates 24 labelled 3×3
sheets, and makes the junction reading. All eight domes are required by the
batch command. A plot or dome failure stops the command and retains the partial
receipt. Existing output refuses, so a partial run cannot silently gain stale
screenshots. No automatic rerun or continuation changes the source boundary.
After a refusal, `--domes=B1,B2,C1,C2,D1,D2` explicitly selects only the
unfinished domes into a new output directory. `requestedDomes` records that
scope; the old refused batch stays unchanged. Combining qualified receipts
requires the identical full source pin and admitted camera/image hashes, with
their original paths and refusals retained as provenance. If the same source
must be rebuilt after normal preview teardown, retain both actual build IDs
and versions separately; never present them as one running build.

The protocol retains normal title/grid entry, declared entry routes, physical
streaming anchors, shipping tiles/LOD/far plane, phone tier, 2× render scale,
62° horizontal cameras, 402×603 portrait viewport and 120 real drawn frames per
view. Before sampling and before accepting each image, the normal grid pending
list, crossing and ring queues must settle within the existing 180-second
readiness bound. The original post-sample anchor, residency, camera and document
guards still run; the 120-draw sample keeps its original 15-second cap.
The readiness predicate returns the actual grid/camera/residency snapshot in
one synchronous browser task. A second CDP read cannot race a newly started
neighbour admission between the wait and the unchanged anchor assertion.
Samples may include admission work that begins during their window; they are not a
steady-state performance claim. Each dome has its own context and a separate page-wide Chromium memory
sample. Counts and memory are descriptive, not an official frame-floor pass.

`--junction=x,z` names half-integer lattice coordinates between four actual
assembled cells. The player stays at that road anchor. Four fixed standing-eye
views retain the 62° lens; each records actual drawn-layer, residency and cell
centre-frustum evidence. Coverage is across those four views. It is not a claim
that four surrounding cells fit in one frame, or that a frustum test proves
occlusion-free geometry. The receipt preserves this distinction.

Each plot writes `capture.json`, all camera source hashes, nine source-bound
JPEG hashes per dome, `boards.json` and the labelled sheets. `batch.json` binds
the full source and completion of the requested plot list. Junction raw frames,
state, images and process memory are saved separately under `junction/`.

The independent board maker never launches a browser:

```sh
node scripts/open-plots/boards.mjs \
  --captures=tmp/open-plots-capture/open-plot-night-market,tmp/open-plots-capture/open-plot-lantern-bayou
```

It refuses incomplete/error receipts, duplicate/reordered views, changed image
bytes or dimensions. Each sheet is at most 500 KB and burns in plot, dome,
source and view labels. The historical `capture-night-market-domes.mjs` CLI
keeps its RM2/RM3/END selection and flat output layout through the same loop.
