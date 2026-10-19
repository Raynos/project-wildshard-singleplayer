# Brine Puffer component assembly gate

Status: prepared and tested harness only. **No final body tuple is authorized,
no assembled final candidate exists, and no runtime file is changed.** Root owns
publication and final tuple approval. Retained tail, terminal-only forefins and
spike pins were confirmed by the coordinator on 2026-10-19. The spike preference
remains weak/bounded; this is not a full-creature score or acceptance.

## Source admission and scope

`source-pins.json` freezes five exact SHA256 inputs: V71, tail part, terminal fin
parts, full spike study, and the editable indexed spike identity source. Files
are read directly, never regenerated or rewritten by this harness. Skeletons,
coordinate conventions and native schema must equal V71. Every per-vertex array
must have the correct length, finite values, valid bone indices and normalized
weights. Duplicate names and unknown attributes fail.

- Tail owns only `Tail root`. Its first 44 retained root triangles must preserve
  positions, linear colors, skin indices, skin weights and fur lengths exactly.
- Fins own only `Volumetric connected finL` and `Volumetric connected finR`.
  Their exact terminal-only payload is pinned. No other study part is admitted.
- Spikes own positions of six named subordinate wedges within `Continuous mantle
  cheek and pouch`. All eight inherited wedges are identified, including the
  exact dominant crown and hidden rear accent. Every other part and every other
  core triangle must equal V71. All core colors, skinning and fur lengths remain
  exact. The audit independently reconstructs the allowed changes and compares
  the complete result with the retained spike payload.

Partial tail/fin payloads cannot carry unrelated changes because additional parts
are rejected. They are not complete enemies. Static study scope is verified;
this does not repeat their complete geometric/manifold tests or imply visual,
intersection, new-cage seating, animation or gameplay acceptance.

## Semantic matching after body retopology

The native schema is nonindexed triangle soup. The harness does **not** use the
indexed spike file's historical `sourceTriangleRange` or old body offsets. Named
spikes supply their original five vertices and six oriented triangles. Each
triangle must have exactly one exact match in the named core part. Cyclic corner
rotations and arbitrary triangle/part reordering are supported; reversed winding,
missing triangles and duplicate candidates fail. Per-corner color, fur and bind
attributes must match after the same cyclic alignment.

New body triangles may be inserted and existing nonspike body triangles changed.
The tail/forefin parts must still equal V71, and all eight spike components must
remain unmodified by the body source. Otherwise two studies claim the same
component and composition stops with an overlap error. No nearest-neighbor,
tolerance, bounding-box or triangle-number fallback exists. A body that renames,
splits, moves or rebinds these components needs a separately reviewed identity or
attachment mapping and revised tests; it must not weaken this gate.

Composition deep-copies the body, replaces tail and forefin whole parts by name,
and updates only matched spike position slots. Unrelated core triangles,
non-position core attributes, unrelated parts, bone definitions and pivots are
preserved. Transforms remain identity in native x-right/y-up/z-forward space.
The skinning is retained study binding, not a claim of a finished remaster rig.

## Eventual final-input workflow

1. Independently review the complete body/facial source. Root supplies its exact
   path and SHA256 and authorizes the complete component tuple after review.
2. Before writing a candidate, produce a pinned **new-cage** attachment audit tied
   to that exact body hash and `componentPins`. The receipt must include measured
   evidence and limitations, `verdict: "PASS"`, and exactly these true `checks`:
   `tailRootBurial`, `forefinRootBurial`, `spikeRootClearance`,
   `inheritedExceptionsReviewed`, `identityTransforms`. Existing V71 clearance
   reports are not new-cage clearance evidence. Primary/rear inherited exposures
   require explicit review; this harness does not assert they are buried.
3. Root replaces the pending admission with status `root-approved-input-tuple`,
   a nonempty `reviewReference`, the exact `body` pin, exact `componentPins` and
   `attachmentAudit` pin. The status is a workflow attestation, not cryptographic
   evidence of human approval; it must only be filled after actual authorization.
4. Run the tests and source audit. Then invoke `assemble.py --admission <approved
   admission.json> --output art/driftwood-isle/puffer-remaster-assembly/<new-name>.json`.
   Creation is exclusive; existing outputs cannot be overwritten. Only an output
   in this owned directory is allowed. The command prints the output SHA256.
5. Capture fixed views, recheck whole-body geometry and bind behavior, and obtain
   independent full-body review before any runtime preparation. Actual breathing,
   brace/release, hit, death, stepping, turns and stop/resume remain separate gates.
   Preserve the tested playable V70 gray-v2 fallback until all required gates pass.

The attachment receipt is checked for exact input tuple and required verdicts,
not recomputed by this component composer. It must be backed by an independent
measured new-cage audit. Current admission stays blocked because the final body
and its new-cage attachment audit are absent. There is no runtime admission code,
engine modification, deploy step or automatic publication here.

## Reproduce

From repository root:

    PYTHONDONTWRITEBYTECODE=1 python art/driftwood-isle/puffer-remaster-assembly/assemble.py
    PYTHONDONTWRITEBYTECODE=1 python art/driftwood-isle/puffer-remaster-assembly/test_assembly.py

The default command audits sources only. Tests compose synthetic in-memory
fixtures, including reordered/expanded body soup, but never save an assembled
model. They cover determinism, immutable inputs, exact replacements, missing and
ambiguous triangles, reversed winding, overlap, binding/material drift, changed
pivots, wrong pins, duplicate parts, nonfinite input and blocked admission.

`source-audit.json` is the audit receipt. `test-receipt.json` records the actual
focused test run. `output-closure.json` hashes every owned ordinary source and
receipt except itself. This closure is ready for coordinator-controlled screening
and publication; no main, remote or production changes were made by this worker.
