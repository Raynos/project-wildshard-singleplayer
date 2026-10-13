# W1 C2: graph materials on instanced meshes share a program with the wrong instance buffer (sp-o133, 2026-10-13)

Codex spec for the graph back-end. It blocks Sky Reach's trees (5 maps) and sky isles
(6 maps, 2 graphs) moving from hand-written GLSL to SF59 `meshMap` graphs on one
program per graph.

## Root cause (measured in the page, build of d1a578863 + `trees-isles.patch`)

The classic `WebGLRenderer` files a node material's program under its program cache key.
The key is the stock `customProgramCacheKeyCallback`: the material's node hash, the scene,
the renderer and `receiveShadow`, plus the engine's target / tone-map suffix. The key
does not include the drawing object's instancing. three's `createInstanceMatrixNode`
bakes the first built object's instance matrices into the source when they fit a uniform
buffer: `buffer(instanceMatrix.array, 'mat4', count)`. That becomes a std140 block named
`NodeBuffer_<node id>` whose size is that object's count.

`bindMeshMap` variants (clones sharing one graph's nodes) all hash alike. So every
InstancedMesh drawing a variant gets the program the first one built. Its block has the
first mesh's name and size. Each later variant's builder has its own `NodeBuffer_<id>`.
`NodeUniformBuffers.bind` cannot find that name in the shared program, so the block
stays bound to whatever buffer was last at that point, sized for the first count. The
same applies to one graph material drawn by two InstancedMeshes, with or without
`bindMeshMap`.

Page readout (`renderer.properties.get(material).currentProgram`, active uniform blocks):

| meshes | counts | shared program | instance block |
|---|---|---|---|
| far.trees.* (5 maps, `tree-bark`) | 16, 13, 21, 32, 13 | 1 | `NodeBuffer_42107`, 1024 B = 16 mat4 (the first mesh's) |
| far.sky-isles.* (6 maps, `sky-isle`) | 3, 4, 4, 5, 4, 3 | 1 | `NodeBuffer_32747`, 192 B = 3 mat4 |
| keels (5 maps, `sky-isle-keel`) | 3, 1, 2, 1, 1 | 1 | `NodeBuffer_37835`, 192 B |

The result: the oak and bush meshes draw nothing when they are the only meshes drawn, and
in the full frame they draw at another mesh's matrices. Isle instances past the first
count vanish (sp-o131's "an isle vanished"). See [repro-c1-mill.jpg](repro-c1-mill.jpg):
BASE on the left, the graphs on the right with the oak and the bush gone. sp-x4's oracle
(`scripts/graph-mesh-map/run.mjs`) draws plain Meshes, which have no instance buffer, so
it passes on the old code and on the new.

## Spec (graph back-end: `src/engine/render/nodes/engineNodesHandler.ts`, `graph/compile.ts`)

**Repro to add to the GPU oracle.** Make one graph with `meshMap`. Bind two maps with
`bindMeshMap` (red, green). Draw them on two `InstancedMesh`es with counts 3 and 5, every
instance on screen, in one frame. Then add a third InstancedMesh with count 2 that uses the
red variant itself.

**Expected.** All 10 instances draw at their own matrices, in their own map's colour
(exact RGBA centres). The linked program count for the graph stays 1 across all three
meshes and across a second frame with the maps swapped. Instance counts of 1 to the
uniform-buffer limit must all work. A mesh whose count is above the limit (the
interleaved-attribute path) must also draw its own matrices.

**Suggested approach (Codex's call).** For a graph material on an InstancedMesh, make the
instance matrices count-independent in the source and bound per draw:

- either a fixed-name block (`wsInstanceMatrices`) sized to a fixed cap, filled in
  `beforeDraw` from `nodeFrame.object.instanceMatrix`;
- or the instanced-attribute path with fixed attribute names, set on every drawing
  object's geometry, not only the one built.

Do not add `object.uuid` to the key. That gives one program per mesh: +4 programs for the
trees and +9 for the isles, which is what G407 refuses.

## Ready consumer change

`trees-isles.patch` applies on 5dc2dc30e and passes the row-data rule: data/ exports only the graph
rows, and the helpers stay private or in look/mapGraph.ts. It adds the `tree-bark`, `sky-isle` and
`sky-isle-keel` graphs (data/paintLook.ts, data/skyIsleLook.ts), binds them through
`skyMappedLook` in world/trees.ts and world/skyIsleHd.ts, and deletes TREE_BARK_EDITS,
SKY_ISLE_ROCK_EDITS and SKY_ISLE_CLIP_EDITS. On a clean generated export it measures
C2 Sky 764 → 719 and Sky custom 3132 → 3079 lines (42.4 → 41.7 %).

With the bug present, its parity run against d1a578863 shows the following. Draws,
triangles and programs (162 / 163) are equal. Shader sources go up by 4 and GPU bytes go
up by 32 KB on phone and 36 KB on desktop. The isles render about +20/255 brighter (the
painted light, G410), and the instancing bug adds missing trees and isles. Re-run the
parity and make the round-3 board after the back-end fix.

## Step 1 frame floor

[frame-floor-cb9a9ad40-desktop.json](frame-floor-cb9a9ad40-desktop.json) is cb9a9ad40,
`skyMappedLook` on `bindMeshMap`. Desktop far-reach passes on every row: p95 at most
16.8 ms and max 16.8 ms.
