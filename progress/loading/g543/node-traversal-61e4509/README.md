# O5 node traversal allocation cut

Source `61e45099ae3afba4bd35261ebb0a9be92bc36128`, API note `b68a48cf79`.
These are baseline attribution and focused correctness receipts, not a served
candidate performance verdict.

The exact `f8f5ee9a9d` cold CPU-4x phone profiles charge 5.917 / 2.665 s
of exclusive samples to the complete SHARD SELECT/grid node-build subtrees.
Within those subtrees, stock `_getChildren` plus `getChildren` contribute
558 / 291 ms. Entries in each table are exclusive and may be added; the
subtree totals must not be added to inclusive node-build timing.

The cut snapshots immediate child nodes without property/index descriptor
objects or the fresh self-ignore Set. It retains stock own-property order,
duplicates, eager snapshot timing and custom child collectors. Only one
synchronous engine build uses the replacement; success and failure restore
the original method. No graph snapshot remains after a build. Existing
node build counts and timing stay inside the wrapper.

Strict type-aware lint and 17 focused tests pass. Mesh and instanced unlit,
standard and toon graphs produce byte-identical vertex/fragment shaders
and uniform declaration keys. Stock shared camera globals are initialized
before comparing fresh independent materials: a stock-to-stock control
reproduced the initial first-use uniform ordering difference. Traversal,
shadow-depth, raw-output and program-key regressions also pass.

A separate earlier prototype micro run suggested lower median build cost,
but it is not a whole-entry measurement and is not used for acceptance.
One combined Driftwood/Nine/Pine source batch and an exact served-build
phone, desktop-AO and native entry matrix follow this source landing.
The previous 1,943 ms native post-chain pause remains in `diagnostic-f8f5ee9`;
this allocation cut does not claim to repair or explain that pause.
