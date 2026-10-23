/**
 * Tile streaming (G652) on G227 splat terrain: a shard's native ground (its committed WSTR256 bake, as the live chunk draws
 * it with `terrainChunkGeometry`) cut into 64 L0 + 16 L1 render tiles for a `props.splat` row. Each tile is one GLB primitive
 * in the row's material, carrying positions, normals and the `_SPLAT` weights, plus a `_CANOPY` density channel; the drawn
 * openings (a page's terrain cuts) leave the indices as the runtime punch removes them. Physics stays on the native ground.
 *
 *   const source = splatGroundSource(terrainBin, canopyMapOf(trees), hole);   // hole: the page's opening test
 *   const tiles = await bakeSplatGround(source, { material: 'pine.ground', lod1: { targetRatio: 0.25, maxErrorMetres: 1 } });
 *
 * Build time only: geometry and bytes, no textures, renderer, physics or scene.
 */
import { BufferAttribute, BufferGeometry, Float32BufferAttribute, MeshStandardMaterial } from 'three';
import { parseBakedTerrain, bakedSamplers } from '@wildshard/engine/world/BakedTerrain';
import { canopyChannel, terrainChunkGeometry } from '@wildshard/engine/world/Terrain';
import { sliceNativeLattice, type NativeLatticeAttribute, type NativeLatticeSource, type NativeLatticeTile } from './nativeLattice';
import { staticGlb } from './glb';
import { simplifyNativeLatticeTile } from './worldLod';
import { parseGlb, type AssetCost } from '../assets';

const CHANNELS = { normal: 3, splat: 4, canopy: 1 } as const;
const CUSTOM = { _SPLAT: 'splat', _CANOPY: 'canopy' } as const;
export interface SplatGroundTile { tile: NativeLatticeTile; bytes: Uint8Array; cost: AssetCost; geometricError: number }
/** A drawn opening's triangle test (world corners a, b, c), as `punchPageTerrain` applies it. */
export type SplatGroundHole = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number) => boolean;
/** The tiles' material name (the `props.splat` row binds it) and the L1 simplification (`simplifyNativeLatticeTile`). */
export interface SplatGroundOptions { readonly material: string; readonly lod1: { readonly targetRatio: number; readonly maxErrorMetres: number } }

/** The live chunk's ground over the committed bake, `canopy` (a 256² density, `canopyMapOf`) as a channel, the openings cut. */
export function splatGroundSource(bytes: Uint8Array, canopy: ArrayLike<number>, hole?: SplatGroundHole): NativeLatticeSource {
  const grid = parseBakedTerrain(Uint8Array.from(bytes).buffer);
  if (grid?.res !== 256 || grid.size !== 500) throw new Error('Splat ground requires a native WSTR256');
  if (canopy.length !== 256 * 256) throw new Error('Splat ground canopy must be 256²');
  const geometry = terrainChunkGeometry(bakedSamplers(grid));
  try {
    const position = geometry.getAttribute('position'), index = geometry.getIndex();
    if (position.itemSize !== 3 || position.count !== 256 ** 2 || index === null) throw new Error('Chunk geometry changed its native lattice');
    geometry.setAttribute('canopy', new BufferAttribute(canopyChannel(position, canopy, 256), 1));
    const positions = Float32Array.from({ length: position.count * 3 }, (_, i) => position.getComponent(Math.floor(i / 3), i % 3));
    const attributes: Record<string, NativeLatticeAttribute> = {};
    for (const [name, width] of Object.entries(CHANNELS)) {
      const channel = geometry.getAttribute(name);
      if (channel.itemSize !== width || channel.count !== position.count) throw new Error(`Chunk geometry lost channel ${name}`);
      attributes[name] = { itemSize: width, values: Float32Array.from({ length: channel.count * width }, (_, i) => channel.getComponent(Math.floor(i / width), i % width)) };
    }
    const kept: number[] = [];
    for (let t = 0; t < index.count; t += 3) {
      const a = index.getX(t), b = index.getX(t + 1), c = index.getX(t + 2);
      if (hole?.(position.getX(a), position.getY(a), position.getZ(a), position.getX(b), position.getY(b), position.getZ(b), position.getX(c), position.getY(c), position.getZ(c)) === true) continue;
      kept.push(a, b, c);
    }
    return { resolution: 256, positions, indices: Uint32Array.from(kept), attributes };
  } finally { geometry.dispose(); }
}

/** The 64 L0 tiles at native detail, then the 16 L1 tiles simplified; each one primitive that receives shadow, never casts. */
export async function bakeSplatGround(source: NativeLatticeSource, options: SplatGroundOptions): Promise<SplatGroundTile[]> {
  const lod1: { tile: NativeLatticeTile; errorMetres: number }[] = [];
  for (const tile of sliceNativeLattice(source, 1)) lod1.push(await simplifyNativeLatticeTile(tile, options.lod1.targetRatio, options.lod1.maxErrorMetres));
  const material = new MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 1 });
  material.name = options.material;
  try {
    return [...sliceNativeLattice(source, 0).map(tile => ({ tile, errorMetres: 0 })), ...lod1].map(({ tile, errorMetres }) => {
      const geometry = new BufferGeometry();
      let bytes: Uint8Array;
      try {
        geometry.setAttribute('position', new Float32BufferAttribute(tile.positions, 3));
        for (const [name, channel] of Object.entries(tile.attributes)) geometry.setAttribute(name, new Float32BufferAttribute(channel.values, channel.itemSize));
        geometry.setIndex(new BufferAttribute(tile.indices, 1));
        bytes = staticGlb([{ geometry, material, castShadow: false, customAttributes: CUSTOM }], `${options.material}.l${String(tile.lod)}.${String(tile.x)}.${String(tile.z)}`);
      } finally { geometry.dispose(); }
      return { tile, bytes, cost: parseGlb(bytes), geometricError: errorMetres };
    });
  } finally { material.dispose(); }
}
