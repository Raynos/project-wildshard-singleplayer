# EP6: baked static batches per cell (design)

Owner of the design: sp-o3 (G943). The bake half (NF10 tile slabs, the format rows, the partition and join invariant
tests) is sp-x1's; the run-time half (NF11 slab library, culling, the draw and memory readings, the look board) is
sp-o3's. Plan rows: [engine-performance](engine-performance-mini-plan.md) EP6, [nine-fix](nine-fix-mini-plan.md)
NF10–NF12. Research: `tmp/wildshard-v-nine-plan/streaming.md` §4a (tile slabs).

## 1. What it is

Every static draw that today has one copy per tile (Nine's 22 refine unions first, later one-copy placements and
`whole` welds) is merged **at bake time** into a few **slabs** per tile: one geometry per *draw key* (below), posed in
the weld's frame, split into **chunks** of at most 4 MB with their own bounds. At run time a tile's attach adds its
chunks as plain meshes (one chunk a frame inside the existing 4 MB upload budget); a retire removes them. No join, no
clone, no CPU transform, no re-upload of other tiles. Repeats (trees, crowd, facade kits) stay instanced (EP8); facades
never multi-draw (E271 / E272).

## 2. The draw key (what may share a slab)

Two source draws share a slab only when everything three or the engine reads per draw is equal. From the weld node
(`format/worldSceneWeld.ts` `common` + `draw`):

| field | why it is in the key |
|---|---|
| `material` (scene material id) | one program, one uniform set |
| `castShadow`, `receiveShadow`, `castFrom` | PF1 (9b649a9b01): merging a casting near level with a non-casting far level made 485 far trees cast |
| `until` (number **or** knob row) | the band: a slab is drawn while the viewer is nearer than it; knob rows stay live, so equal means the same row |
| `renderOrder`, `layers`, `frustumCulled`, `visible` | draw order, passes, culling |
| the parent chain's world transform | pieces are posed into one frame; nodes under differently posed parents never merge |

The key is computed by the bake from the section's weld rows; the run time never regroups. A key with a single source
draw still becomes a slab (it gains chunking and per-chunk bounds).

## 3. Chunking

- Budget: vertex + index bytes ≤ 4 MB per chunk (the run time uploads one chunk a frame).
- Split order: by sub-tile quadrant (31.25 m), then by height band of ≤ 62.5 m (sp-x1's NT3; Nine's tiles span ~500 m of
  height, so this also makes each chunk's box tight), then by source order until under budget.
- A triangle goes to the chunk holding its centroid; shared vertices are duplicated across chunks bit-exactly.
- Each chunk records its AABB and bounding sphere in the weld frame (the run time uses them as-is, frozen).

## 4. Format

A new library kind beside `whole` in `format/worldScenes.ts` (strict, bounded like its siblings):

```
{ id, kind: 'slabs', of: <whole library id>,
  keys: [{ id, node: <weld node id whose anchor owns it>, material, castShadow, receiveShadow, castFrom?, until?,
           renderOrder, layers, frustumCulled, sources: [<refine model ids>] }],          // ≤ 64
  tiles: [{ tile: z * 8 + x, file: <asset hash>,
            chunks: [{ key: <keys[].id>, bytes, box: [6], sphere: [4] }] }] }               // ≤ 64 tiles, ≤ 64 chunks
```

- One GLB per tile (`file`), one glTF node per chunk, written in `chunks` order. Channels are **exactly** today's whole
  pieces' (same attributes, same quantization, same `nativeAttributes` / `quantizedChannels` / `compactIndex` /
  `meshoptReady` choices), so materials and programs do not change and nothing re-links.
- Node extras: `{ slab: { key, tile, chunk } }` only. The partition ordinals (`extras.wholePartition`) leave the
  slab GLBs; the bake check keeps them (below).
- The `whole` library stays declared (the Explorer's cold specimens and the coarse cover still read it); `load:
  'refine'` models that a `slabs` library covers are drawn only through it.

## 5. The encoder seam

`sdk/bake/glb.ts` `staticGlb(primitives, name)` with one `GlbPrimitive` per chunk: `geometry` (the merged chunk),
`material` (a placeholder: materials bind at run time by key), `name` = `<key>-<chunk>`, `extras` = the node extras
above, and the same channel options the whole pieces use today. No new encoder; if a needed option is missing,
sp-x1 adds it to `GlbPrimitive` with its absent value keeping the old bytes.

## 6. Invariants (bake checks + focused tests, sp-x1)

1. **Partition**: every source triangle of every covered refine model lands in exactly one chunk of its tile; none
   is added or dropped.
2. **Join equality**: for each tile and key, the chunks' triangles, posed, equal `joinWholePieces` of the same sources
   (`game/shardfile/refiningWholeLibrary.ts`) as a multiset of position / normal / channel tuples (the run-time union
   is the oracle until NF12 deletes it).
3. **Key equality**: every source in a key has the key's material and flags (a mismatch is a build error, never a
   silent merge).
4. **Budget**: every chunk ≤ 4 MB; every box contains its vertices.
5. Determinism: the same inputs give the same bytes.

## 7. Run time (sp-o3, NF11)

`SlabLibrary` beside `RefiningWholeLibrary`, chosen per refine library when its `slabs` row exists:
`attach(tile)` reads the tile's slab GLB under `SharedTileBuilds` / `ControlRefinement` and adds one `Mesh` per chunk
(the key's material, flags, render order, layers; the chunk's frozen box; `matrixAutoUpdate` off) under a group in the
key's anchor, one chunk a frame; `retire(tile)` removes and disposes them (0 bytes uploaded). The anchors keep their
names, frozen bounds and handles (weld graph, Explorer, coarse-cover hand-off) and draw nothing. MF13's dither, if
on, becomes a per-mesh uniform. Behind no row: a slab draws the same triangles with the same programs; the proof is
§8.

## 8. Done when (EP6 / NF10–NF11 bars)

- Nine P4 main draws ≤ 110 (155 today); Pine Q4 ≤ 120 (162); GPU memory at spawn ≤ today's.
- No frame ≥ 50 ms from a tile attach or retire on the Nine route (today 132–389 ms), Chromium 4x.
- Captures at P1–P5 / Q1–Q4 within the run-to-run floor of the parent build (G415); else a G844 board.

## 9. Order

1. sp-x1: format row + Nine's slab writer + §6 checks, landed with the run time still on `RefiningWholeLibrary`
   (the new row is unread: no behaviour change).
2. sp-o3: `SlabLibrary` reads it; readings and captures; then NF12 deletes the run-time join.
3. Later keys: one-copy placements and `whole` welds of every shard through the same writer (EP6 generalized).
