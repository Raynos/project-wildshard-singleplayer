// SHARD-PLATFORM W2a (sp-o288): riggedHulls reads a hull's image-free rig and its separate KTX2 maps from `files`
// (a built product's named blobs), samples the maps as the rig's glTF maps were, and Pine keeps its coat cache identity.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterEach, expect, it, vi } from 'vitest';
import { riggedHullMap, riggedHulls, type RiggedHullFamilyRow } from '@wildshard/sdk/looks/riggedHulls';
import coatPages from '../src/shards/pine-hollow/data/coatPages.generated.json' with { type: 'json' };
import { WILDLIFE_DRAW } from '../src/shards/pine-hollow/generators/wildlifeDraw';
import { PINE_HULLS } from '../src/shards/pine-hollow/generators/creatureHulls';
import { pineCoatUrl, pineRigFiles } from '../src/shards/pine-hollow/runtime/species/rigs';

afterEach(() => { vi.restoreAllMocks(); });

const compressed = (colorSpace: string): THREE.CompressedTexture => {
  const t = new THREE.CompressedTexture([{ data: new Uint8Array(16), width: 4, height: 4 }], 4, 4, THREE.RGBA_ASTC_4x4_Format);
  t.flipY = true; t.colorSpace = colorSpace; t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
};

it('samples a separate base map as the glTF base colour map: unflipped, repeat, anisotropy 4, sRGB', () => {
  const t = riggedHullMap(compressed(THREE.NoColorSpace), 'base', 'deer-hind');
  expect([t.flipY, t.wrapS, t.wrapT, t.anisotropy, t.colorSpace, t.name])
    .toEqual([false, THREE.RepeatWrapping, THREE.RepeatWrapping, 4, THREE.SRGBColorSpace, 'deer-hind-albedo']);
});

it('keeps a separate normal map in its file\'s colour space, as GLTFLoader left it', () => {
  for (const space of [THREE.NoColorSpace, THREE.LinearSRGBColorSpace]) {
    const t = riggedHullMap(compressed(space), 'normal', 'boar');
    expect([t.flipY, t.wrapS, t.wrapT, t.anisotropy, t.colorSpace, t.name])
      .toEqual([false, THREE.RepeatWrapping, THREE.RepeatWrapping, 4, space, 'boar-normal']);
  }
});

it('reads a hull in `files` from its rig URL, never the `rig` callback, and keeps it procedural when a file fails', async () => {
  const row: RiggedHullFamilyRow = { label: 'test', rigs: ['deer-hind'], hulls: { 'deer:hind': 'deer-hind' } };
  const asked: string[] = [];
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation((url: string) => { asked.push(url); return Promise.reject(new Error('no file in Node')); });
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const rig = vi.fn((hull: string) => `/old/${hull}.rigged.glb`);
  const family = riggedHulls(row, {
    rig, files: { 'deer-hind': { rig: '/blob/rig-hash', base: '/blob/base-hash', normal: '/blob/normal-hash' } },
    coat: () => 'key', coatImage: () => undefined,
  });
  await family.preload();
  expect(asked).toEqual(['/blob/rig-hash']);
  expect(rig).not.toHaveBeenCalled();
  expect(warn).toHaveBeenCalledWith('[test] creature rig deer-hind failed', expect.any(Error));
  expect(family.skin('deer', 'hind', [])).toBeNull();
});

it('names Pine\'s rigs and maps as the producer\'s blobs (generators/rigBlobs.mjs), per tier', () => {
  const product = { url: (name: string): string => `/shardfiles/pine-hollow/${name}` };
  for (const tier of ['phone', 'desktop'] as const) {
    const files = pineRigFiles(product, PINE_HULLS.rigs, tier), dot = tier === 'phone' ? '.phone' : '';
    expect(Object.keys(files)).toEqual([...PINE_HULLS.rigs]);
    for (const hull of PINE_HULLS.rigs) {
      expect(files[hull]).toEqual({ rig: `/shardfiles/pine-hollow/models/creatures/${hull}${dot}.rigged.glb`,
        base: `/shardfiles/pine-hollow/models/creatures/${hull}${dot}.base.ktx2`, normal: `/shardfiles/pine-hollow/models/creatures/${hull}${dot}.normal.ktx2` });
    }
  }
});

it('keeps every baked coat\'s cache key on the rig\'s original public path', () => {
  for (const tier of ['phone', 'desktop'] as const) {
    const keys = new Set(Object.entries(PINE_HULLS.hulls).map(([kv, hull]) => { const [kind = '', variant = ''] = kv.split(':'); return pineCoatUrl(hull, kind, variant, tier); }));
    const baked = Object.keys(coatPages.tiers[tier]);
    expect(baked.length).toBeGreaterThan(0);
    for (const key of baked) expect(keys.has(key)).toBe(true);
  }
  expect(pineCoatUrl('bear-black', 'bear', 'black', 'phone')).toBe('procedural:/assets/pine-hollow/creatures/bear-black.phone.bear.black.coat.png');
  expect(pineCoatUrl('boar', 'boar', 'thrall', 'desktop')).toBe('procedural:/assets/pine-hollow/creatures/boar.boar.thrall.coat.png');
});

it('names Pine\'s bird blobs as the producer does (generators/birdBlobs.mjs), per tier', () => {
  expect(WILDLIFE_DRAW.tiers.phone).toEqual({ geometry: 'models/life/birds-rest.phone.glb', atlas: 'models/life/birds.phone.base.ktx2' });
  expect(WILDLIFE_DRAW.tiers.desktop).toEqual({ geometry: 'models/life/birds-rest.glb', atlas: 'models/life/birds.base.ktx2' });
});
