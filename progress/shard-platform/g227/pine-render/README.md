# G227 — Pine's baked world tiles drawn like Pine (client side, E435)

State: client seam built and Node-proven; nothing switches live (no admitted Pine product yet). The browser parity pass
(tiled cell vs today's Pine, both tiers, `scripts/parity/compare.mjs`) waits on sp-x5's admitted product.

## What the client does now

- **Terrain tiles: the live splat program.** `splatTerrainMaterial(layers, ground)` (`src/engine/world/Terrain.ts`) is the
  chunk's own material, moved out of the `Terrain` class unchanged. A probe hashed the patched vertex + fragment text of
  both variants on clean HEAD `8682e9be1` and on the change: identical (`terrain-splat-boreal` `1c443144…f933`,
  `terrain-splat` `f8040c64…3529`, the same 13 uniforms). The chunk and every tile share one program.
- **`props.splat`** (`src/game/shardfile/splatTerrain.ts`, sp-x5 wires it into `PropsSchema`): the tile GLB material name,
  the 3 × 4 KTX2 layer files (unflipped `#layer` twins), the tints and the boreal extras. The client
  (`clientSplatTerrain.ts`) concatenates each role's four transcoded layers into a `CompressedArrayTexture` with the live
  terrain's own mip concatenation (`layerArrayMips`, factored out of `ktx2Layers`) and draws the name with the splat material.
- **Channels.** `PropSurfaceBinding` takes `compiled` (draw as compiled, shared) and `channels` (GLB `_splat` / `_canopy`
  renamed onto the `splat` / `canopy` attributes, refusing a missing or malformed one): generic, the same seam Nalati's
  `surf` / `rdir` / `zone` can use.
- **Bake inputs, pure.** `terrainChunkGeometry(field)` and `canopyChannel(positions, map, N)` are the chunk's own geometry
  and canopy code, exported so the bake slices exactly what the chunk draws.
- **Forest.** Engine tree records (`encodeTreeRecords` / `decodeTreeRecords`, float64, exact) and
  `Forest.build({ instances })`: the declared forest draws through the existing `Forest` + Pine's tree model and culler
  (instanced; no facade multi-draw). `props.forest` = `{ records, variants }` (`src/game/shardfile/forestRecords.ts`).
- **Heroes.** `props.materials` slots take `anisotropy` (Pine's heroes set 4 on colour + normal); the rest of a hero
  (envStrength 0.8, smooth) is a `look.materials` PBR entry.

## Proof (`test/shardfile-splat-terrain.test.ts`, 7 tests)

- A Pine L0 tile (x 4, z 4) cut by the shared slicer from `terrainChunkGeometry(bakedSamplers(pine terrain.bin))`, written
  by the real `staticGlb` with `_SPLAT` / `_CANOPY`, installed by the real `installDeclaredProps` through the splat
  surface: one mesh, drawn with the splat material, receiving but never casting shadows (bake `castShadow: false`, as the chunk), and every one of the ≥ 31² native chunk vertices in it carries the
  chunk's exact float32 height, normal, splat and canopy (`toBe`, no tolerance).
- A primitive without `_splat` refuses, naming the channel; mismatched layer formats refuse; layer files must be KTX2 tile
  dependencies in one role, owned by the arrays; a GLB name neither the splat nor `props.materials` maps refuses.
- Tree records round-trip 50 placed trees `toEqual`; another variant order, a truncated or foreign file and a bad index refuse.

## Left (needs the product)

- Browser parity, both tiers, fixed seeded poses, no rebaseline; frame floor.
- The chunk's rock slab skirt (its own depth-darkened slab shader) is not a tile surface: it stays in Pine's runtime or
  gets its own surface.
- A shardfile-only tree model (trunk / leaf GLB parts with wind) for a world without Pine's runtime: the hybrid keeps
  Pine's `PineTreeFactory` as the variants' source.
