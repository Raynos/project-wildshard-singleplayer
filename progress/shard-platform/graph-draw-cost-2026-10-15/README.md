# Why a shader-graph draw costs more CPU than a classic one (2026-10-15)

For Jake (G436, G437 / NEXT N3). A read-only study with one throwaway micro-benchmark. No source changed.
Numbers are in [data.json](data.json).

## The short answer

A classic three.js material (hand-written GLSL through `ShaderMaterial` or `onBeforeCompile`) has almost
nothing to do per draw. Three sets one matrix (`uniformMatrix4fv`) and draws. Its other uniforms upload only
when the material changes.

A graph material is a three **node material** running on the classic `WebGLRenderer` through three's
compatibility adapter (`WebGLNodesHandler`). That adapter was built for correctness, not speed. Before every
single draw it runs a JavaScript hook. The hook re-evaluates ~25 small "update nodes" in JS, compares and
rewrites a uniform buffer (UBO), and rebinds it. Classic materials do none of this. So each graph draw costs
about **4–5× the CPU of a classic draw**. That is ~2.2–2.8 µs against ~0.5 µs on this Mac, and ~45 µs against
~8 µs on the phone tier (b08b8ffa9). The GPU work, the shader size and the draw count all stay about the same.
The extra cost is JavaScript and WebGL calls.

## The reasons, one by one (file:line at d449ca9cc; three 0.186)

1. **A JS hook on every draw.** three calls `material.onBeforeRender` for every object
   (`three/src/renderers/WebGLRenderer.js:2157,2163`), and the engine handler installs `beforeDraw` there
   (`src/engine/render/nodes/engineNodesHandler.ts:271,560`). Classic materials have an empty hook. In the
   bench, skipping only this hook made graph draws cheaper than classic. **It is ~85 % of the gap.**
2. **~25 node updates per draw, about half the hook.** `updateNodeList` (`engineNodesHandler.ts:577`) →
   `NodeFrame.updateNode`. Every OBJECT-type node runs on every draw (`three/src/nodes/core/NodeFrame.js:294`).
   That covers the model matrix, the normal matrix (an inverse each time, `ModelNode.js:112`), the
   material's own opacity / metalness / roughness / emissive references, each texture's flip
   (`TextureNode.js:390`) and every `reference('value', …)` the toon look and the params read. `renderId++` on
   every call (`textureUpdates.ts:44`) makes even the camera uniforms ("once per render") rerun per draw.
   A graph toon measured 17 object + 6 render + 2 frame nodes.
3. **The UBO rewrite and rebind, the other half.** Node programs keep their non-texture uniforms in std140
   blocks (`object`, `render`). The engine binds them itself (`nodeUniformBuffers.ts:129-133`, called from
   `engineNodesHandler.ts:553,581`): two `bindBufferBase`, a `bindBuffer` pair and a `bufferSubData` per
   draw, after a JS compare of all 24 slots (`nodeUniformBuffers.ts:167-171`). That makes **5 GL calls per
   draw against 1 classic** (counted: 600 draws → 1202 + 1200 + 600 calls vs 600). The block belongs to the
   material and every object rewrites the same buffer. That is the slow pattern on ANGLE / Metal, where an
   in-flight buffer has to be copied.
4. **A program-switch cliff.** The hook hashes `receiveShadow` and Mesh / Instanced / Batched
   (`engineNodesHandler.ts:579-580`, as stock `WebGLNodesHandler.js:333-338`). When the hash changes it sets
   `material.needsUpdate`. So one graph material shared by objects that differ in `receiveShadow` or
   instancing re-picks its program (`getProgram`, cache key, `onUpdateProgram`) on every switch. Measured:
   **13 µs per draw against 0.66 µs classic** with alternating `receiveShadow` (20×). The instancing half
   of the hash is the same mechanism, but I didn't measure it.
5. **Shadow receivers cost more.** With shadows on, a graph draw is 3.2–4.8 µs against 0.9–1.1 µs. The graph
   pays +1.0–1.6 µs for shadows against classic's +0.5. I didn't split this further. Casters with
   `vertex.shadow` also run the whole hook again in the shadow pass (`engineNodesHandler.ts:416`) through the
   `renderBufferDirect` wrapper (`:355`).
6. **Small per-draw garbage.** There is a template-string hash and a `filter()` array on every draw
   (`:579`, `:553`), and `Reflect.get` / `Reflect.apply` everywhere in the hot path. This is minor, but it
   adds GC on the phone.
7. **Ruled out: bigger shaders, more programs, lost batching.** The linked graph shaders are smaller (toon
   20 K characters against classic toon 59 K; standard 16 K against 98 K). Programs follow the graph, not the
   mesh (`nodeInstanceKey`, 233fc0aa6). Instancing and BatchedMesh still draw once (50006f90d): one instanced
   draw of 600 boxes costs 3–4 µs total. **The cost is per draw call, not per instance or per triangle.**
   meshMap (6b5263f2b) and the instance work only add an OBJECT reference per draw (`compile.ts:821`).

## Measured (this Mac, headless Chrome 153, ANGLE Metal, 600 boxes, three runs)

| per draw, µs | classic toon | graph toon | graph unlit | graph standard |
|---|---|---|---|---|
| plain | 0.47–0.56 | 2.2–2.8 | 2.0–3.4 | 2.1–2.8 |
| shadows on | 0.9–1.1 | 3.2–4.8 | | |
| alternating receiveShadow | 0.66 | **13.0** | | |

Graph toon with parts switched off: node updates skipped 1.2–1.6, UBO binds skipped 1.2–1.4, the whole hook
skipped 0.3–0.4. sp-x8's texture grouping (8b0436fdd) gave 0–34 % here (one texture). On the cove oracle it
took CPU submit from 5.5–6.1 ms to 2.9–3.5 ms. Field readings: the cove port's frame went from 4.2 to 7.5 ms
(b08b8ffa9), and the kit rocks added 1.3–1.8 ms (dcd0a8cc6).

## Optimisations for the engine pass (gain is per graph draw; effort S / M / L)

1. **Skip the program re-pick when only the hash flips (S, removes the 13 µs cliff).** Key the
   receive-shadow / instancing variant per program, not per material. Or split such materials at bind time.
   First, add a counter for `onUpdateProgram` calls per frame and check the live shards for the cliff.
2. **Run node updates only when an input changed (M, ~1 µs, ~40 %).** Run RENDER nodes once per render
   (don't bump `renderId` per draw). Run material references only when the material changes. Run
   object-matrix nodes only when the object's `matrixWorld` version changes. Freeze constant `reference()`
   params into the frame update.
3. **Stop rewriting one shared object UBO per draw (M, ~1 µs, ~40 %).** Bind the `render` group once per
   render. Feed the per-object matrices the classic way: plain `uniformMatrix4fv` for `modelMatrix` /
   `modelViewMatrix`, which is what classic does. Or use one big per-frame ring buffer with
   `bindBufferRange` offsets.
4. **Cut the hook's overhead (S, ~0.2 µs).** Cache the program entry on the material and drop the
   per-draw string / array allocations and `Reflect` calls.
5. **Fewer draws (M–L, the biggest lever where it applies).** Merge static graph meshes or use instancing /
   BatchedMesh at bake time. Each draw saved removes the whole per-draw cost.
6. **Later: WebGPURenderer (L).** Node materials are native there: per-object data goes through bind groups
   with the update caching built in. This is a big migration, not a fix.

Doing 1–4 should bring a graph draw to ~1.5× classic (about 0.7–0.9 µs here, ~12–15 µs on the phone).

## Method

A throwaway Vite page in `./tmp/graph-cost/`, deleted afterwards and not committed. It used `clientMaterials`
with three catalogue graphs (unlit / standard / toon) against `MeshToonMaterial` and a patched
`MeshStandardMaterial`. It drew 600 boxes sharing one material, frustum culling off, at 512². It timed 60
`renderer.render` calls × 5–7 interleaved rounds, minus an empty scene, cross-origin isolated (5 µs timer).
The ablations overrode the handler's `updateNodes` / `bindBlocks` / `beforeDraw` on the instance. GL calls
were counted by wrapping the context's methods for one frame. These are desktop numbers. The phone ratio
comes from the field readings above.
