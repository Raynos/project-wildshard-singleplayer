// SHARD-PLATFORM G227: a native splat terrain drawn from shardfile props tiles. The tiles cut from the live chunk's own
// ground carry its positions, normals, splat weights and canopy bit for bit through the real GLB writer and loader, and
// draw with the live chunk's own splat material (one program); a missing channel, a mixed-role layer, an unmapped name or a
// mismatched array layer refuses. Forest records round-trip the placed trees exactly.
// oxlint-disable-next-line import/no-nodejs-modules -- the committed native Pine terrain is the test cell's source.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Scope } from '../src/engine/app/scope';
import { parseBakedTerrain, bakedSamplers } from '../src/engine/world/BakedTerrain';
import { canopyChannel, splatTerrainMaterial, terrainChunkGeometry } from '../src/engine/world/Terrain';
import { installDeclaredProps } from '../src/engine/world/declaredProps';
import { decodeTreeRecords, encodeTreeRecords, treeGridOf, type TreeInstance } from '../src/engine/world/forest/placement';
import { sliceNativeLattice } from '../src/sdk/bake/nativeLattice';
import { staticGlb } from '../src/sdk/bake/glb';
import { splatArray, splatSurface, withSplatSurface } from '../src/game/shardfile/clientSplatTerrain';
import { SplatTerrainSchema, checkTileMaterialNames, splatTerrainOf, splatTextureRefs, validateSplatTerrain, type SplatTerrain } from '../src/game/shardfile/splatTerrain';
import { clientForestTrees, validateForestRecords } from '../src/game/shardfile/forestRecords';
import * as v from 'valibot';

const h = (n: number): string => n.toString(16).padStart(64, '0');
function layer(fill: number, edge = 4, format: THREE.CompressedPixelFormat = THREE.RGBA_ASTC_4x4_Format): THREE.CompressedTexture {
  const mips: THREE.CompressedTextureMipmap[] = [];
  for (let e = edge; e >= 1; e >>= 1) mips.push({ data: new Uint8Array(e * e).fill(fill), width: e, height: e });
  return new THREE.CompressedTexture(mips, edge, edge, format);
}
const SPLAT: SplatTerrain = v.parse(SplatTerrainSchema, {
  material: 'native-ground',
  layers: { colour: [h(1), h(2), h(3), h(4)], normal: [h(5), h(6), h(7), h(8)], arm: [h(9), h(10), h(11), h(12)] },
  tints: [[0.86, 0.78, 0.68], [0.72, 0.8, 0.6], [1.0, 0.98, 0.94], [0.95, 0.8, 0.6]],
  boreal: { normalK: [1, 1, 1.6, 1], trailDust: [0.9, 0.82, 0.7, 0.5] },
});
const textures = new Map(splatTextureRefs(SPLAT).map((ref, i) => [ref, layer(i + 1)]));

/** Pine's live chunk ground, from its committed native bake, with a deterministic canopy map. */
function pineChunk(): THREE.BufferGeometry {
  const bytes = readFileSync(new URL('../public/assets/baked/pine-hollow/terrain.bin', import.meta.url));
  const grid = parseBakedTerrain(Uint8Array.from(bytes).buffer); if (grid === null) throw new Error('Pine native bake unreadable');
  const geo = terrainChunkGeometry(bakedSamplers(grid));
  const N = 256, canopy = Float32Array.from({ length: N * N }, (_, i) => ((i * 2654435761) >>> 0) / 2 ** 32);
  geo.setAttribute('canopy', new THREE.BufferAttribute(canopyChannel(geo.getAttribute('position'), canopy, N), 1));
  return geo;
}
const floats = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): Float64Array => Float64Array.from({ length: a.count * a.itemSize }, (_, i) => a.getComponent(Math.floor(i / a.itemSize), i % a.itemSize));

describe('splat terrain tiles (G227)', () => {
  it('a Pine tile carries the live chunk ground bit for bit and draws with the live splat program', async () => {
    const chunk = pineChunk(), pos = chunk.getAttribute('position'), index = chunk.getIndex(); if (index === null) throw new Error('unindexed chunk');
    const tiles = sliceNativeLattice({ resolution: 256, positions: floats(pos), indices: Uint32Array.from(index.array), attributes: {
      normal: { itemSize: 3, values: floats(chunk.getAttribute('normal')) }, splat: { itemSize: 4, values: floats(chunk.getAttribute('splat')) },
      canopy: { itemSize: 1, values: floats(chunk.getAttribute('canopy')) },
    } }, 0);
    // the tile round the crossroads (x 0..62.5, z 0..62.5)
    const tile = tiles.find((t) => t.x === 4 && t.z === 4); if (tile === undefined) throw new Error('no tile 4/4');
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(tile.positions, 3)).setIndex(Array.from(tile.indices));
    for (const [name, a] of Object.entries(tile.attributes)) g.setAttribute(name, new THREE.Float32BufferAttribute(a.values, a.itemSize));
    const source = new THREE.MeshStandardMaterial(); source.name = SPLAT.material;
    const glb = staticGlb([{ geometry: g, material: source, castShadow: false, customAttributes: { _SPLAT: 'splat', _CANOPY: 'canopy' } }], 'pine-tile');
    checkTileMaterialNames(undefined, SPLAT, glb);
    const scope = new Scope('test.splat'), scene = new THREE.Group();
    const surface = splatSurface(SPLAT, { scope, texture: (ref) => { const t = textures.get(ref); if (t === undefined) throw new Error('no layer'); return t; } });
    const installed = await installDeclaredProps({ family: 'pbr', tiles: [{ lod: 0, x: 4, z: 4, file: h(99) }], panels: [], models: [], far: null, textures: [] }, {
      scene, scope, assets: new Map([[h(99), glb]]), materials: new Map([['pbr', new THREE.MeshStandardMaterial()]]),
      surfaces: withSplatSurface({ name: SPLAT.material, binding: surface.binding }, null),
    });
    const meshes: THREE.Object3D[] = []; installed.tiles.get('0/4/4')?.traverse((o) => { if (o instanceof THREE.Mesh) meshes.push(o); });
    expect(meshes).toHaveLength(1);
    const mesh = meshes[0]; if (!(mesh instanceof THREE.Mesh)) throw new Error('no mesh');
    const drawn: unknown = mesh.material, got: unknown = mesh.geometry;
    if (!(got instanceof THREE.BufferGeometry)) throw new Error('no geometry');
    expect(drawn).toBe(surface.material);
    expect([mesh.castShadow, mesh.receiveShadow]).toEqual([false, true]); // the live chunk: receives, never casts
    expect(got.hasAttribute('_splat')).toBe(false);
    // every native chunk vertex inside the tile is in it with the chunk's exact float32 position, normal, splat and canopy
    const live = new Map<string, number>(); for (let i = 0; i < pos.count; i++) live.set(`${pos.getX(i)}/${pos.getZ(i)}`, i);
    const attr = (geometry: unknown, name: string): { count: number; at: (i: number, c: number) => number } => {
      const a: unknown = geometry instanceof THREE.BufferGeometry ? geometry.getAttribute(name) : null;
      if (!(a instanceof THREE.BufferAttribute)) throw new Error(`no ${name}`);
      const count: number = a.count;
      return { count, at: (i, c) => { const value: number = a.getComponent(i, c); return value; } };
    };
    const gp = attr(got, 'position');
    let native = 0;
    for (let i = 0; i < gp.count; i++) {
      const at = live.get(`${gp.at(i, 0)}/${gp.at(i, 2)}`); if (at === undefined) continue;
      native++;
      expect(gp.at(i, 1)).toBe(pos.getY(at));
      for (const [name, size] of [['normal', 3], ['splat', 4], ['canopy', 1]] as const) for (let c = 0; c < size; c++) expect(attr(got, name).at(i, c)).toBe(chunk.getAttribute(name).getComponent(at, c));
    }
    expect(native).toBeGreaterThanOrEqual(31 * 31);
    // the one program: the live chunk's material function and key
    const key = surface.material.customProgramCacheKey();
    expect(key).toBe(splatTerrainMaterial({ map: layer(1), normalMap: layer(1), armMap: layer(1) }, { tints: SPLAT.tints, boreal: SPLAT.boreal }).customProgramCacheKey());
    expect(key).toContain('terrain-splat-boreal');
    scope.dispose();
  });

  it('refuses a tile primitive without its channels, and names it', async () => {
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3)).setIndex([0, 2, 1]);
    const source = new THREE.MeshStandardMaterial(); source.name = SPLAT.material;
    const glb = staticGlb([{ geometry: g, material: source }]);
    const scope = new Scope('test.splat-missing');
    const surface = splatSurface(SPLAT, { scope, texture: () => layer(1) });
    await expect(installDeclaredProps({ family: 'pbr', tiles: [{ lod: 0, x: 0, z: 0, file: h(98) }], panels: [], models: [], far: null, textures: [] }, {
      scene: new THREE.Group(), scope, assets: new Map([[h(98), glb]]), materials: new Map([['pbr', new THREE.MeshStandardMaterial()]]),
      surfaces: withSplatSurface({ name: SPLAT.material, binding: surface.binding }, null),
    })).rejects.toThrow('needs vertex channel _splat');
    scope.dispose();
  });

  it('builds each role array from four same-format layers and refuses a mismatch', () => {
    const t = splatArray('colour', [layer(1), layer(2), layer(3), layer(4)]);
    expect(t.image.depth).toBe(4); expect(t.mipmaps).toHaveLength(3);
    const top = t.mipmaps[0]; if (top === undefined) throw new Error('no mip');
    expect(Array.from(top.data)).toEqual([1, 2, 3, 4].flatMap((k) => Array.from({ length: 16 }, () => k)));
    expect(t.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(splatArray('arm', [layer(1), layer(2), layer(3), layer(4)]).colorSpace).toBe(THREE.NoColorSpace);
    expect(() => splatArray('normal', [layer(1), layer(2), layer(3, 4, THREE.RGBA_ASTC_6x6_Format), layer(4)])).toThrow('one format');
  });

  it('admits layer files only as KTX2 tile dependencies in one role, and checks tile material names', () => {
    const files = [...splatTextureRefs(SPLAT).map((hash) => ({ hash, kind: 'ktx2', dependencies: [] })), { hash: h(99), kind: 'glb', dependencies: splatTextureRefs(SPLAT) }];
    expect(() => { validateSplatTerrain(SPLAT, { look: {}, tiles: [h(99)], propTextures: [], files }); }).not.toThrow();
    expect(() => { validateSplatTerrain(SPLAT, { look: {}, tiles: [], propTextures: [], files }); }).toThrow('KTX2 dependency');
    expect(() => { validateSplatTerrain(SPLAT, { look: {}, tiles: [h(99)], propTextures: [h(3)], files }); }).toThrow('another material');
    const mixed = { ...SPLAT, layers: { ...SPLAT.layers, normal: [h(1), h(6), h(7), h(8)] as const } };
    expect(() => { validateSplatTerrain(v.parse(SplatTerrainSchema, mixed), { look: {}, tiles: [h(99)], propTextures: [], files }); }).toThrow('mix colour');
    expect(splatTerrainOf({ splat: SPLAT })).toEqual(SPLAT);
    expect(splatTerrainOf({})).toBeUndefined();
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3)).setIndex([0, 2, 1]);
    const named = (name: string): THREE.MeshStandardMaterial => Object.assign(new THREE.MeshStandardMaterial(), { name });
    const glb = staticGlb([{ geometry: g, material: named(SPLAT.material) }, { geometry: g.clone(), material: named('cabin-roof') }]);
    expect(() => { checkTileMaterialNames(undefined, SPLAT, glb); }).toThrow('cabin-roof');
    const materials = { 'cabin-roof': { id: 'pbr', colour: null, normal: null, metallicRoughness: null, occlusion: null, emissive: null } };
    expect(() => { checkTileMaterialNames(materials, SPLAT, glb); }).not.toThrow();
    expect(() => { checkTileMaterialNames({ ...materials, [SPLAT.material]: materials['cabin-roof'] }, SPLAT, glb); }).toThrow('both the splat terrain');
  });
});

describe('forest instance records (G227)', () => {
  const variants = [{ name: 'pine-a', trunkRadius: 0.42, height: 22, species: 'pine' }, { name: 'fir-a', trunkRadius: 0.45, height: 24, species: 'fir' }];
  const trees: TreeInstance[] = Array.from({ length: 50 }, (_, i) => ({
    x: Math.sin(i) * 200.123456789, y: Math.cos(i) * 9.87654321 - 0.25, z: Math.cos(i * 1.3) * 200.000001, r: 0.42 * (0.8 + i / 100) + 0.15,
    variant: i % 2, scale: 0.8 + i / 100, rot: (i * 0.731) % (Math.PI * 2), height: 22 * (0.8 + i / 100), tint: new THREE.Color().setHSL(0.27 + i / 1000, 0.2, 0.9), species: i % 2 === 0 ? 'pine' : 'fir',
  }));
  it('round-trip the placed trees exactly and feed the same lookup grid', () => {
    const bytes = encodeTreeRecords(trees, variants.length);
    const back = clientForestTrees({ records: h(7), variants: ['pine-a', 'fir-a'] }, bytes, variants);
    expect(back).toEqual(trees);
    expect(treeGridOf(back).nearby(100, 100, 40).length).toBe(treeGridOf(trees).nearby(100, 100, 40).length);
    expect(() => validateForestRecords({ records: h(7), variants: ['pine-a', 'fir-a'] }, { files: [{ hash: h(7), kind: 'binary' }], assets: new Map([[h(7), bytes]]) })).not.toThrow();
  });
  it('refuse another tree set, a foreign file, a truncated one and a bad variant', () => {
    const bytes = encodeTreeRecords(trees, variants.length);
    expect(() => clientForestTrees({ records: h(7), variants: ['fir-a', 'pine-a'] }, bytes, variants)).toThrow('not the tree set');
    expect(() => decodeTreeRecords(bytes.subarray(0, -8), variants)).toThrow('length');
    expect(() => decodeTreeRecords(new Uint8Array(16), variants)).toThrow('version-1');
    expect(() => decodeTreeRecords(bytes, variants.slice(0, 1))).toThrow('variants');
    const first = trees[0]; if (first === undefined) throw new Error('no tree');
    expect(() => encodeTreeRecords([{ ...first, variant: 2 }], 2)).toThrow('outside');
    expect(() => validateForestRecords({ records: h(7), variants: ['pine-a', 'fir-a'] }, { files: [{ hash: h(7), kind: 'json' }] })).toThrow('binary');
  });
});

describe('hero prop slots keep their anisotropy (G227)', () => {
  it('a slot carries its anisotropy onto the texture, default off, and takes part in the one-sampler-per-file rule', async () => {
    const { applyPropSampler } = await import('../src/game/shardfile/clientPropMaterials');
    const { PropMaterialsSchema } = await import('../src/game/shardfile/propMaterials');
    const rows = v.parse(PropMaterialsSchema, { hero: { id: 'pbr', colour: { file: h(1), anisotropy: 4 }, normal: { file: h(2) } } });
    const colour = rows['hero']?.colour, normal = rows['hero']?.normal;
    if (colour === undefined || colour === null || normal === undefined || normal === null) throw new Error('slots missing');
    expect(applyPropSampler(new THREE.Texture(), colour).anisotropy).toBe(4);
    expect(applyPropSampler(new THREE.Texture(), normal).anisotropy).toBe(1);
    expect(() => v.parse(PropMaterialsSchema, { hero: { id: 'pbr', colour: { file: h(1), anisotropy: 32 } } })).toThrow();
  });
});
