# C3 building survey and build-only authoring

The cabin-look module has no play-time importer: the existing generator emits
its constants into admitted `world/cabins.json`, and the page reads that blob.
Move the author verbatim from `data/cabinLook.ts` to `generators/cabinLook.ts`,
repoint its producer and tests, and delete the old module. Runtime values,
materials, seeds, clocks, door/floor/audio loans and save formats are unchanged.
Under G467 this is net −11 Pine custom lines; Driftwood and Sky are unchanged.
Matched source ruler on parent `c280fbe49`: Pine 12,086 → 12,075; Driftwood
7,935 → 7,935; Sky 1,789 → 1,789. This is source-basis progress, not output %
credit. All primary consumers are counted before filtering.

## H4 draft outcome

Existing H4 Object3D ports already write Euler rotation setters correctly,
including quaternion notifications. Direct Three Material roots currently
refuse. Sky's hover-deck emissive intensity is a real second candidate for that
writer alongside Pine glass.

A private draft compiled night gains, glass and baked-seed swings into H4 rows
and adopted the Sky deck. Its exact arithmetic replay passed 400 Pine and 800
Sky samples. However, the official runtime guard correctly refused new per-frame
observations and changed unbounded roster loops. Reusing frames and bounding
those loops consumes the tiny adapter saving. The writer and all runtime/H4
drafts were deleted, with no guard increase, new host or rendered change.

## Retained C3 census

At that measured parent, Pine C3 remains
104 custom lines; Driftwood C3 remains zero. These are retained code, not data
credit or a claim that C3 is closed:

- `runtime/combat/fxKit.ts`: 36 lines of pooled shimmer mesh/burst lifecycle.
- `runtime/props/buildingLife.ts`: 67 lines in the mixed building owner: native
  door/floor/wheel loans, view registration, night gains, glass and seeded sway.
- `runtime/props/bakedBuilding.ts`: one light import.

The building owner cannot disappear while its C7 and audio loans remain. The
night/glass/sway formulas stay view code; no generic roster host was added just
to move their lines. C7 owns the next door slice and must rebase on this commit.

Parity: cabin authoring bytes and emitted values are identical. No board is
needed under G468. The related cabin tests, Pine fixtures, Template and 17
headless cases, official outputs, root/layer types and typed lint qualify the
unchanged data path. Final result: all ten outputs and 24 selected tests pass,
including all 17 headless cases; root/layer types and typed lint pass.
