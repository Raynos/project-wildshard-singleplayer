// The data client's generic draw knobs: a look texture's sampler row (wrap, anisotropy, filter, GPU mips), the terrain's
// shadow flags and its residency follow distance. Absent, each keeps the draw every shard had before the row.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as v from 'valibot';
import { emptyShardfile } from '../src/sdk/author';
import { bakeTerrain } from '../src/sdk/bake/terrain';
import { contentHash } from '../src/sdk/project';
import { parseShardfile, type Shardfile } from '@wildshard/format/shardSchema';
import { TextureSamplersSchema, textureSamplerRules } from '@wildshard/format/materials';
import { parseFamilyMaterial } from '@wildshard/format/materialFamilies';
import { TerrainSchema } from '@wildshard/format/terrain';
import { validateShardfileAssets } from '@wildshard/format/assetAdmission';
import { App } from '../src/engine/app/app';
import { createLevelInstallation } from '../src/engine/level/installation';
import { Game } from '../src/engine/core/Game';
import { shardContext, sourceManifest } from '../src/game/plugin/context';
import type { ShardRuntime } from '../src/game/shard/runtime';
import type { ShardWorld } from '../src/game/shard/world';
import { ClientAssets } from '../src/game/shardfile/clientAssets';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { ShardfileClient } from '../src/game/shardfile/client';
import { applyTextureSampler } from '../src/game/shardfile/clientMaterials';
import template from '../src/shards/_template/shard.config';
import ink from '../src/shards/ink-cel-valley/shard.config';
import { fakeWorld } from './fake/world';

const RAW = 'a'.repeat(64), PACKED = 'b'.repeat(64);
/** A PBR look material over a map, the template's look otherwise, with the given sampler rows. */
function mapped(samplers: Shardfile['look']['samplers']): Shardfile {
  const entry = parseFamilyMaterial({ family: 'pbr', vertexColours: true, metalness: 0, maps: { colour: RAW, normal: null, orm: null } });
  return { ...template, look: { ...template.look, materials: { sand: entry }, ...(samplers === undefined ? {} : { samplers }) } };
}
/** What three's KTX2 loader hands back for a raw (uncompressed) RGBA8 file with a two-level chain: a data texture, nearest. */
function rawFile(): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array(16), 2, 2);
  texture.minFilter = THREE.NearestMipmapNearestFilter; texture.magFilter = THREE.NearestFilter; texture.generateMipmaps = false;
  texture.mipmaps = [{ data: new Uint8Array(16), width: 2, height: 2 }, { data: new Uint8Array(4), width: 1, height: 1 }];
  return texture;
}
/** And for a transcoded one-level file: a compressed texture, linear. */
function packedFile(): THREE.CompressedTexture {
  const texture = new THREE.CompressedTexture([{ data: new Uint8Array(16), width: 4, height: 4 }], 4, 4);
  texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
  return texture;
}
const sampled = (t: THREE.Texture): unknown[] => [t.wrapS, t.wrapT, t.anisotropy, t.minFilter, t.magFilter, t.mipmaps.length, t.generateMipmaps];

describe('look texture samplers (look.samplers)', () => {
  it('admits a bounded row per catalogue texture and refuses one for any other ref', () => {
    expect(v.parse(TextureSamplersSchema, { [RAW]: { wrap: 'repeat', anisotropy: 8, filter: 'linear', mips: 'gpu' }, [`commons:${PACKED}`]: {} })).toEqual({ [RAW]: { wrap: 'repeat', anisotropy: 8, filter: 'linear', mips: 'gpu' }, [`commons:${PACKED}`]: {} });
    for (const row of [{ wrap: 'border' }, { anisotropy: 0 }, { anisotropy: 17 }, { anisotropy: 2.5 }, { mips: 'driver' }, { extra: 1 }]) expect(v.safeParse(TextureSamplersSchema, { [RAW]: row }).success).toBe(false);
    expect(textureSamplerRules(mapped({ [RAW]: { wrap: 'repeat' } }).look)).toEqual([]);
    expect(textureSamplerRules(mapped({ [PACKED]: { wrap: 'repeat' } }).look)).toEqual([`samplers ${PACKED}: not a texture of the look's material catalogue`]);
    // the template's catalogue names no texture, so any row is refused at admission
    expect(() => parseShardfile({ ...template, look: { ...template.look, samplers: { [RAW]: { wrap: 'repeat' } } } })).toThrow('shardfile semantic rules');
  });

  it('changes nothing an empty row leaves out', () => {
    const raw = rawFile(), packed = packedFile(), before = [sampled(raw), sampled(packed)];
    applyTextureSampler(raw, {}); applyTextureSampler(packed, { mips: 'file' });
    expect([sampled(raw), sampled(packed)]).toEqual(before);
    expect(before[0]).toEqual([THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, 1, THREE.NearestMipmapNearestFilter, THREE.NearestFilter, 2, false]);
  });

  it('repeats a raw map and lets the GPU mip it from level 0, trilinear (a data texture\'s driver mips)', () => {
    const raw = rawFile();
    applyTextureSampler(raw, { wrap: 'repeat', anisotropy: 8, mips: 'gpu' });
    expect(sampled(raw)).toEqual([THREE.RepeatWrapping, THREE.RepeatWrapping, 8, THREE.LinearMipmapLinearFilter, THREE.LinearFilter, 0, true]);
    const clamped = rawFile();
    applyTextureSampler(clamped, { filter: 'linear' }); // the file's own chain, filtered linearly
    expect(sampled(clamped)).toEqual([THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, 1, THREE.LinearMipmapLinearFilter, THREE.LinearFilter, 2, false]);
  });

  it('mirrors and filters a transcoded map, and refuses GPU mips on it', () => {
    const packed = packedFile();
    applyTextureSampler(packed, { wrap: 'mirror', anisotropy: 4, filter: 'nearest' });
    expect(sampled(packed).slice(0, 5)).toEqual([THREE.MirroredRepeatWrapping, THREE.MirroredRepeatWrapping, 4, THREE.NearestFilter, THREE.NearestFilter]);
    expect(() => { applyTextureSampler(packedFile(), { mips: 'gpu' }); }).toThrow('GPU mips need a raw (uncompressed) KTX2');
  });
});

const entry = 'runtime/index.ts';
/** A presentation-only hybrid (a baked terrain in one PBR look material) standing at x 38, with the given terrain rows. */
function fixture(rows: { shadow?: { cast: boolean; receive: boolean }; follow?: number }): { source: Shardfile; bytes: ReadonlyMap<string, Uint8Array> } {
  const baked = bakeTerrain({ heightAt: (x, z) => Math.max(0, 6 - Math.hypot(x - 40, z + 30) / 10), colourAt: () => [0.6, 0.5, 0.4], family: 'pbr' });
  const data = emptyShardfile({ slug: 'knob-fixture', name: 'Knob fixture', author: 'Fixture', seed: 1, revision: 1 });
  Object.assign(data, { terrain: { ...baked.terrain, ...rows }, tiles: baked.tiles, files: baked.files, critical: baked.critical, edge: baked.edge, runtime: { entry }, spawn: { x: 38, y: 2, z: 10, yaw: 0 } });
  Object.assign(data, { look: { ...data.look, families: ['pbr'], materials: { pbr: { family: 'pbr', vertexColours: true, metalness: 0, roughness: 0.5 } } } });
  data.budgets.sim = { resident: 16_000_000, compressed: 2_000_000 };
  return { source: validateShardfileAssets(data, baked.assets, contentHash), bytes: baked.assets };
}
function isMesh(node: THREE.Object3D): node is THREE.Mesh { return node instanceof THREE.Mesh; }
interface Drawn { meshes: () => THREE.Mesh[]; walk: (x: number) => Promise<void> }
/** Draw the fixture's world stage over a fake game; `run` reads the terrain meshes and walks the viewer (stepping the residency). */
async function drawn(source: Shardfile, bytes: ReadonlyMap<string, Uint8Array>, run: (world: Drawn) => Promise<void>): Promise<void> {
  const critical = new Map([...bytes].filter(([hash]) => source.critical.includes(hash)));
  const reader = new ClientAssets(source, critical, { base: 'https://fixture.test/', firstParty: true, offline: true,
    fetch: () => Promise.reject(new Error('No network')), hash: (wire) => Promise.resolve(contentHash(wire)),
    cache: { product: () => Promise.resolve(null), asset: (_base, hash) => Promise.resolve(bytes.get(hash) ?? null), putAsset: () => Promise.resolve(), putProduct: () => Promise.resolve() } });
  const client = new ShardfileClient(source, reader, { trustedRuntime: true, instance: source.identity.slug, allocator: new ResidencyAllocator(), catalogue: [], items: new Map(), recipes: new Map(), icon: () => 'glyph', voices: () => new Map() });
  const app = new App(), scope = app.engineScope.child('knobs'), noop = (): undefined => undefined;
  const installation = createLevelInstallation(app, scope, {}, () => ({ set: noop, detail: noop }));
  const game: unknown = Object.create(Game.prototype); if (!(game instanceof Game)) throw new Error('Missing Game prototype');
  const manifest = sourceManifest(source), { player, sky, forest, registry } = fakeWorld(), viewer = new THREE.Vector3(source.spawn.x, 0, source.spawn.z);
  const world = { game, player, sky, forest, registry, chunk: manifest } as ShardWorld;
  const runtime: ShardRuntime = { world, play: null, step: null, hooks: {}, objects: {}, interactables: [], overhead: [], viewer: () => viewer, horizonVeil: null };
  const ctx = shardContext(installation.context, manifest, { shard: manifest, runtime, rows: new Map(), bag: { tab: () => noop, fragment: () => noop } });
  try {
    await client.world(ctx);
    const meshes = (): THREE.Mesh[] => { const out: THREE.Mesh[] = []; ctx.root.traverse((node) => { if (isMesh(node) && node.name.startsWith('terrain:')) out.push(node); }); return out; };
    const walk = async (x: number): Promise<void> => {
      viewer.x = x;
      const system = app.systemsByPhase()['fixed.post'].find((row) => row.id === 'game.shardfile.residency'); if (system === undefined) throw new Error('No residency system');
      system.run(1 / 60, 0);
      await new Promise((resolve) => { setTimeout(resolve, 100); });
    };
    await run({ meshes, walk });
  } finally { app.engineScope.dispose(); }
}
/** Does the fine tile at x 125 (z 0 … 62.5) cast? It enters the 80 m shadow disc once the viewer passes x 45. */
const edgeCasts = (meshes: readonly THREE.Mesh[]): boolean => meshes.some((mesh) => mesh.name === 'terrain:125,0' && mesh.castShadow);

describe('terrain draw rows (terrain.shadow, terrain.follow)', () => {
  it('admits the rows, leaves them absent when undeclared, and the templates write the defaults out', () => {
    const { source } = fixture({});
    expect(source.terrain === null ? null : ['shadow' in source.terrain, 'follow' in source.terrain]).toEqual([false, false]);
    expect(v.safeParse(TerrainSchema, { ...source.terrain, shadow: { cast: false, receive: true }, follow: 8 }).success).toBe(true);
    for (const follow of [0.5, 63, Number.NaN]) expect(v.safeParse(TerrainSchema, { ...source.terrain, follow }).success).toBe(false);
    expect(v.safeParse(TerrainSchema, { ...source.terrain, shadow: { cast: false } }).success).toBe(false);
    for (const shard of [template, ink]) expect([shard.terrain?.shadow, shard.terrain?.follow]).toEqual([{ cast: true, receive: true }, 5]);
  });

  it('keeps today\'s tiles without the rows: all receive, the disc\'s L0 tiles cast, the residency follows past 5 m', async () => {
    const { source, bytes } = fixture({});
    await drawn(source, bytes, async ({ meshes, walk }) => {
      expect(meshes().length).toBeGreaterThan(16);
      expect(meshes().every((mesh) => mesh.receiveShadow)).toBe(true);
      expect(meshes().some((mesh) => mesh.castShadow)).toBe(true);
      expect(edgeCasts(meshes())).toBe(false);
      await walk(46.5); expect(edgeCasts(meshes())).toBe(true); // 8.5 m: re-centred
    });
  });

  it('draws tiles that neither cast nor receive', async () => {
    const { source, bytes } = fixture({ shadow: { cast: false, receive: false } });
    await drawn(source, bytes, async ({ meshes, walk }) => {
      expect(meshes().length).toBeGreaterThan(16);
      await walk(46.5);
      expect(meshes().some((mesh) => mesh.receiveShadow || mesh.castShadow)).toBe(false);
    });
  });

  it('re-centres the residency only past the declared follow', async () => {
    const { source, bytes } = fixture({ follow: 9 });
    await drawn(source, bytes, async ({ meshes, walk }) => {
      await walk(46.5); expect(edgeCasts(meshes())).toBe(false); // 8.5 m: past today's 5 m, inside the declared 9 m
      await walk(47.5); expect(edgeCasts(meshes())).toBe(true); // 9.5 m
    });
  });
});
