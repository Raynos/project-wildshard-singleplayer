import { BufferAttribute, BufferGeometry, Float32BufferAttribute, MeshStandardMaterial } from 'three';
import { sliceNativeLattice, type NativeLatticeAttribute, type NativeLatticeSource, type NativeLatticeTile } from '@wildshard/sdk/bake/nativeLattice';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { parseGlb, type AssetCost } from '@wildshard/sdk/assets';
import { parseBakedTerrain, bakedSamplers } from '../../src/engine/world/BakedTerrain';
import { buildPainterlyGeometry } from '../../src/shards/nalati-grasslands/look/terrainPainter';
import { TERRAIN } from '../../src/shards/nalati-grasslands/world/terrain';

const CHANNELS = { normal: 3, color: 3, surf: 4, rdir: 2, zone: 3 } as const;
const CUSTOM = { _SURF: 'surf', _RDIR: 'rdir', _ZONE: 'zone' } as const;
/** Unpacked ground geometry: the shared SDK visitor owns later hash/file/tile row composition. */
export interface NalatiGroundTile { tile: NativeLatticeTile; bytes: Uint8Array; cost: AssetCost }

/** Drain today's unchanged painter over the committed WSTR256 samplers and the actual authored trails.
 * This allocates geometry only: no textures, renderer, physics world, scene or gameplay installer.
 */
export function nalatiGroundSource(bytes: Uint8Array): NativeLatticeSource {
  const grid = parseBakedTerrain(Uint8Array.from(bytes).buffer);
  if (grid?.res !== 256 || grid.size !== 500 || grid.seed !== 0x4a1a) throw new Error('Nalati ground requires the original native WSTR256');
  const sampler = bakedSamplers(grid);
  const step = 500 / 255;
  const heightAt = (x: number, z: number): number => {
    const ix = Math.round((x + 250) / step), iz = Math.round((z + 250) / step);
    // The live bilinear sampler can leave ~1e-14 at a native zero. Read exact source vertices;
    // retain its existing interpolation everywhere else, without resampling the native mesh.
    return ix >= 0 && ix < 256 && iz >= 0 && iz < 256 && x === -250 + ix * step && z === -250 + iz * step ? grid.heights[iz * 256 + ix] ?? 0 : sampler.heightAt(x, z);
  };
  const generator = buildPainterlyGeometry({ ...sampler, heightAt, ready: () => Promise.resolve(true), trails: () => TERRAIN.trails, trailDistance: TERRAIN.trailDistance });
  let result = generator.next();
  while (result.done !== true) result = generator.next();
  const geometry = result.value;
  try {
    const position = geometry.getAttribute('position'), index = geometry.getIndex();
    if (position.itemSize !== 3 || position.count !== 256 ** 2 || index === null) throw new Error('Nalati painter changed its native geometry');
    const positions = Float32Array.from({ length: position.count * 3 }, (_, i) => position.getComponent(Math.floor(i / 3), i % 3));
    for (let i = 0; i < position.count; i++) {
      if (positions[i * 3] !== Math.fround(-250 + i % 256 * 500 / 255) || positions[i * 3 + 2] !== Math.fround(-250 + Math.floor(i / 256) * 500 / 255) || positions[i * 3 + 1] !== grid.heights[i]) throw new Error(`Nalati painter changed native vertex ${i}`);
    }
    const attributes: Record<string, NativeLatticeAttribute> = {};
    for (const [name, width] of Object.entries(CHANNELS)) {
      const channel = geometry.getAttribute(name);
      if (channel.itemSize !== width || channel.count !== position.count) throw new Error(`Nalati painter lost channel ${name}`);
      attributes[name] = { itemSize: width, values: Float32Array.from({ length: channel.count * width }, (_, i) => channel.getComponent(Math.floor(i / width), i % width)) };
    }
    return { resolution: 256, positions, indices: Uint32Array.from(index.array), attributes };
  } finally { geometry.dispose(); }
}

/** Preserve clipped native triangles and all painterly channels in render-only props GLBs.
 * L1 retains native detail until a separately measured simplification is admitted. Physics stays on the native bake.
 */
export function bakeNalatiGround(source: NativeLatticeSource): NalatiGroundTile[] {
  const material = new MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 1 });
  material.name = 'nalati.ground';
  try {
    return [0, 1].flatMap(lod => sliceNativeLattice(source, lod === 0 ? 0 : 1).map(tile => {
      const geometry = new BufferGeometry();
      let bytes: Uint8Array;
      try {
        geometry.setAttribute('position', new Float32BufferAttribute(tile.positions, 3));
        for (const [name, channel] of Object.entries(tile.attributes)) geometry.setAttribute(name, new Float32BufferAttribute(channel.values, channel.itemSize));
        geometry.setIndex(new BufferAttribute(tile.indices, 1));
        bytes = staticGlb([{ geometry, material, castShadow: false, customAttributes: CUSTOM }], `nalati.ground.l${tile.lod}.${tile.x}.${tile.z}`);
      } finally { geometry.dispose(); }
      return { tile, bytes, cost: parseGlb(bytes) };
    }));
  } finally { material.dispose(); }
}
