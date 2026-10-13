import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the page loads.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The committed bake is a zlib stream the page inflates.
import { inflateSync } from 'node:zlib';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate runs on the platform the bake was recorded on.
import { platform } from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete native bytes without deep array traversal.
import { Buffer } from 'node:buffer';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CRAG_ROWS, CragSkin } from '../../../src/shards/pine-hollow/world/cragBake';
import { nativeWholeGeometry, unshuffleLanes } from '@wildshard/game/plugin/geometry';
import committed from '../../../src/shards/pine-hollow/data/crags.json' with { type: 'json' };
import { bakeCragRows } from '../../../src/shards/pine-hollow/generators/bake-pine-crags.mjs';
import { pineCragBake } from '../../../src/shards/pine-hollow/generators/cragScene';

const shipped = (tier: 'phone' | 'desktop'): Uint8Array => unshuffleLanes(new Uint8Array(inflateSync(readFileSync(new URL(`../../../public/assets/pine-hollow/baked/crags.${tier}.bin`, import.meta.url)))));

describe('Pine Hollow bakes its crags offline (G285)', () => {
  // Byte-exact against a bake recorded on the Mac; Linux's libm differs in the last ulp (CI 38008817381: tiltX …043 vs …046),
  // so the stale gate runs where bakes are made (the local push gate), not on the Linux runners.
  it.runIf(platform === 'darwin')('the committed bake is byte-exact against its generator (the stale gate: rerun src/shards/pine-hollow/generators/bake-pine-crags.mjs)', async () => {
    // the ground the crags stand on is the level's: its baked grid carries the level seed (1337)
    const { rows, bins } = await bakeCragRows();
    expect(rows).toEqual(committed);
    for (const tier of ['phone', 'desktop'] as const) expect(Buffer.from(shipped(tier)).equals(bins[tier])).toBe(true);
  }, 30_000);

  it('decodes every tier\'s skin into the page\'s tiles: a near and a far geometry each, finite, indexed, bounded', async () => {
    expect(CRAG_ROWS.places.filter((p) => p.id === 'hero')).toHaveLength(1);
    for (const tier of ['phone', 'desktop'] as const) {
      const tiles = await new CragSkin(shipped(tier), CRAG_ROWS.skin[tier]).tiles(() => Promise.resolve());
      expect(tiles.length).toBe(CRAG_ROWS.skin[tier].tiles.length);
      for (const [near, far] of tiles) for (const g of [near, far]) {
        expect(Object.keys(g.attributes)).toEqual(['position', 'cdata', 'ctint', 'normal']);
        expect(Array.from(g.getAttribute('position').array).every(Number.isFinite)).toBe(true);
        expect((g.getIndex()?.count ?? 0) % 3).toBe(0);
        expect(g.boundingSphere?.radius ?? 0).toBeGreaterThan(1);
      }
      expect(tiles.reduce((n, [near]) => n + near.getAttribute('position').count, 0)).toBeGreaterThan(tiles.reduce((n, [, far]) => n + far.getAttribute('position').count, 0));
    }
  }, 30_000);

  it('authors both native resolutions through one Scene with every attribute and triangle byte unchanged', async () => {
    const authored = pineCragBake({
      phone: { bin: shipped('phone'), tiles: CRAG_ROWS.skin.phone.tiles },
      desktop: { bin: shipped('desktop'), tiles: CRAG_ROWS.skin.desktop.tiles },
    });
    expect(authored.shardfile.tiles).toHaveLength(0);
    expect(authored.pieces).toHaveLength(36);
    let pieceIndex = 0;
    for (const tier of ['phone', 'desktop'] as const) {
      const original = await new CragSkin(shipped(tier), CRAG_ROWS.skin[tier]).tiles(() => Promise.resolve());
      for (const pair of original) {
        const piece = authored.pieces[pieceIndex++];
        if (piece === undefined) throw new Error('Native skin piece missing');
        const loaded = await new GLTFLoader().parseAsync(Uint8Array.from(piece.glb).buffer, '');
        const meshes: THREE.Mesh[] = [];
        const isMesh = (node: THREE.Object3D): node is THREE.Mesh => node instanceof THREE.Mesh;
        loaded.scene.traverse(node => { if (isMesh(node)) meshes.push(node); });
        expect(meshes).toHaveLength(2);
        for (const [resolution, expected] of pair.entries()) {
          const mesh = meshes[resolution]; if (mesh === undefined) throw new Error('Native skin resolution missing');
          const actual = nativeWholeGeometry(mesh);
          expect(Object.keys(actual.attributes).sort()).toEqual(Object.keys(expected.attributes).sort());
          for (const name of Object.keys(expected.attributes)) {
            const a = actual.getAttribute(name), b = expected.getAttribute(name);
            expect(a.itemSize).toBe(b.itemSize);
            expect(a.array.constructor).toBe(b.array.constructor);
            expect(Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength).equals(new Uint8Array(b.array.buffer, b.array.byteOffset, b.array.byteLength)), name).toBe(true);
          }
          const a = actual.getIndex(), b = expected.getIndex();
          if (a === null || b === null) throw new Error('Native skin triangles missing');
          expect(a.array.constructor).toBe(b.array.constructor);
          expect(Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength).equals(new Uint8Array(b.array.buffer, b.array.byteOffset, b.array.byteLength))).toBe(true);
          actual.dispose(); expected.dispose();
        }
      }
    }
  }, 30_000);
});
