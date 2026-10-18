# Painted look rows

Sky and Signal retain their original painted numbers, image samplers,
geometry, graph programs and draw order in admitted product rows. Their
manifest render bindings use `productPaintedLook`. Signal declares that its
native terrain is already supplied; this awaits the field without building
an engine slab. Material-scoped lighting reads the same product row.

The old SDK card-field module is deleted. The shared instanced-quad primitive
keeps the original index and attribute storage; both Sky's painted dressing
and Nalati's existing plume fields use it. Sky's Roc colour transform and
Nalati's live terrain olive transform use pure colour graphs. Nalati retains
its original terrain function and call sites byte for byte after lowering.

## Host bar

All three hosts score **6/6** under `docs/HOST-BAR.md`:

| Test | Painted product look | Material colour graph | Instanced quad |
| --- | --- | --- | --- |
| Two real users | `src/shards/far-reach/generators/paintedLook.ts:14`, `src/shards/sunscar-dunes/generators/paintedLook.ts:21` | `src/shards/far-reach/generators/creatureLooks.ts:15`, `src/shards/nalati-grasslands/look/terrainPainter.ts:59` | `src/game/looks/paintedLook.ts:68`, `src/shards/nalati-grasslands/world/index.ts:178` |
| No shard nouns | `src/game/looks/paintedLook.ts:15` | `src/engine/render/graph/colourFunction.ts:8` | `src/engine/render/instancedGeometry.ts:8` |
| Data-driven | `src/format/paintedLook.ts:35` | `src/format/colourFunction.ts:14` | `src/engine/render/instancedGeometry.ts:8` |
| Server-safe or labelled | `src/game/looks/paintedLook.ts:13` labels client presentation | `src/engine/render/graph/colourFunction.ts:6` labels client presentation | `test/painted-look-rows.test.ts:68` constructs it without a browser |
| Deletion test | Signal still needs the look/light/terrain policy if Sky vanishes | Nalati still needs its original terrain colour if Sky vanishes | Nalati still needs its plume fields if Sky vanishes |
| Data-only API | `src/game/looks/paintedLook.ts:15`, `src/format/paintedLook.ts:35` | `src/engine/render/graph/colourFunction.ts:8`, `src/format/colourFunction.ts:14` | `src/engine/render/instancedGeometry.ts:8` |

The public inputs are product rows, material/geometry resources, ids and
scalar policy values. There are no per-shard callbacks or new pending-user
exceptions. Removing Sky leaves real Signal and Nalati uses.

## Validation

The existing painted-row test covers preserved numeric rows, declared graph
and image references, callback rejection, shared quad storage, original
colour program text, Signal's terrain-readiness policy, and Nalati's actual
patched terrain shader. All eight cases pass with typed lint.

The isolated corrected-Z8 overlay `79fcc2d855f244af237c65cc787fde5181fb88f3`
passed generation, root and layer types, typed lint, 25 focused cases, all 17
headless cases and all ten products in the build mirror. Source-only map
refresh belongs to the fourteenth canonical map batch (G490).

Sky's 20 phone/desktop poses are pixel-exact against the original look.
Draws, triangles, GPU bytes, programs, shader sources and colliders also
match. The baseline is `a7a1116-mvdqfhqy`; the candidate is
`79fcc2d-mvdr8hvr`.

Signal's 18 day/creature poses and 24 quest/night/creature poses are also
pixel-exact, including the same resource and program checks. The corrected
Z8 baseline is `5b56866-mvdr9g6l`. `look-parity.json` retains the compact
pose hashes and renderer census; every harness browser closed naturally.

## Measured landing

The actual-parent tree `0da09fc8f68e7ceac1164bc32bb1161d02fb0ac6` passed
all ten products, root/layer types, typed lint, 27 focused cases and all 17
headless cases. Generation was previously proven on the same look source;
the final tree refreshed native discovery and product compilation.

The post-generation source inventory is Sky 419 → 313, Signal 164 → 143
and Nalati 20,313 → 20,305: **net -135 shard lines**. Platform source
TypeScript is **+158** (including the SDK module deletion). The pure colour
lowerer preserves exact shader text; product admission and construction are
shared by real current users. This cost exceeds the custom-line cut and is
called out in the G500 Builder-Call trailer. `source-ruler.json` records the
component changes and platform calculation, plus generator changes reported
separately from custom code. AssemblyScript lines are unchanged.

Deleted runtime modules: the Sky and Signal render modules, Sky discLayer,
Signal light, SDK cardField and Nalati lightGlsl. The unused old Signal fire
fixture is also deleted. No approvedFeature tag or budget is added.

Source-only G490: the canonical map owner receives the actual SHA and exact
changed inputs after landing in the fourteenth window. The build warnings
for Sky, Signal and Nalati maps are expected until that canonical refresh.
The exact-landed muted iPhone 16 Pro tail is reported after the commit.
