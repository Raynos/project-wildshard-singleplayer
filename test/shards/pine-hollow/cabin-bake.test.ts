import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate hashes the committed bake's bytes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the page loads.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The committed bake is a zlib stream the page inflates.
import { inflateSync } from 'node:zlib';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { nativeWholeGeometry } from '@wildshard/game/plugin/geometry';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare all native channel bytes without instrumented element matchers.
import { Buffer } from 'node:buffer';
import { PINE_SEED, bakePineCabins, pineCabinBake } from '../../../src/shards/pine-hollow/generators/logCabin';
import { PINE_HOLLOW } from '../../../src/shards/pine-hollow/manifest';
import { CABIN_ROWS, CabinGeometries, LogBuilding, NO_OWNER } from '../../../src/shards/pine-hollow/world/cabinBake';
import type { Mats } from '../../../src/shards/pine-hollow/world/homestead';
import committed from '../../../src/shards/pine-hollow/data/cabins.json' with { type: 'json' };
import { pineCabinHeights } from '../../../src/shards/pine-hollow/generators/bake-pine-cabins.mjs';

const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const packed = (): Uint8Array => new Uint8Array(inflateSync(readFileSync(new URL('../../../public/assets/pine-hollow/baked/cabins.bin', import.meta.url))));

describe('Pine Hollow bakes its log buildings offline (G285)', () => {
  it('the committed bake is byte-exact against its generator (the stale gate: rerun src/shards/pine-hollow/generators/bake-pine-cabins.mjs)', () => {
    const { bin, rows } = bakePineCabins(pineCabinHeights()), shipped = packed();
    expect({ bin: sha(bin), bytes: bin.length, ...rows }).toEqual(committed);
    expect(sha(shipped)).toBe(committed.bin);
    // the buildings' streams are the level seed's, as the page's engine SEED is while the homestead builds
    expect(PINE_SEED).toBe(PINE_HOLLOW.seed);
  });

  it('assembles every building from the binary: its parts, colliders, door and lights where the rows put them', () => {
    const geometries = new CabinGeometries(packed());
    const mat = (name: string): THREE.MeshStandardMaterial => Object.assign(new THREE.MeshStandardMaterial(), { name });
    const shader = (): THREE.ShaderMaterial => new THREE.ShaderMaterial();
    const mats: Mats = { log: mat('log'), endGrain: mat('endGrain'), chink: mat('chink'), roof: mat('roof'), beam: mat('beam'), deck: mat('deck'), door: mat('door'), stone: mat('stone'),
      glass: mat('glass'), bark: mat('bark'), iron: mat('iron'), cloth: mat('cloth'), char: mat('char'), smoke: shader(), flame: shader(), ember: shader(), glow: new THREE.MeshBasicMaterial() };
    const sky = { setupMaterial: (): void => undefined };
    const models = { firePit: new THREE.Group(), lantern: new THREE.Group() };
    expect(CABIN_ROWS.buildings.map((b) => b.id)).toEqual(['cabin-1', 'cabin-2', 'cabin-3', 'hunting-lodge', 'trader-stall', 'millers-house', 'watermill', 'hamlet-shed']);
    for (const row of CABIN_ROWS.buildings) {
      const b = new LogBuilding(NO_OWNER, row, geometries, mats, sky, models, row.hamlet ? 'member' : 'standalone');
      const parts = b.weldParts();
      expect(parts.length).toBeGreaterThan(8);
      for (const p of parts) for (const g of p.geometries) {
        const pos = g.getAttribute('position');
        expect((g.getIndex()?.count ?? pos.count) % 3).toBe(0);
        expect(Array.from(pos.array).every(Number.isFinite)).toBe(true);
      }
      expect(b.colliderDescs().length).toBe(row.colliders.length - (row.nodes.some((n) => n.t === 'door') ? 1 : 0) + row.solids.filter((s) => !s.prop).length);
      expect(b.root.position.toArray()).toEqual([...row.at]);
    }
  });
});


it('authors every native cabin mesh and particle seed through one Scene without changing bytes or owners', async () => {
  const authored = pineCabinBake(pineCabinHeights()), piece = authored.pieces[0];
  if (piece === undefined) throw new Error('Cabin library omitted');
  expect(authored.pieces).toHaveLength(1); expect(piece.name).toBe('pine.cabins');
  expect(authored.shardfile.tiles).toHaveLength(0); // A shape library, never fake static doors or flames.
  expect(piece.rows['buildings']).toEqual(committed.buildings); expect(piece.rows['hamlet']).toEqual(committed.hamlet);
  const loaded = await new GLTFLoader().parseAsync(Uint8Array.from(piece.glb).buffer, '');
  const loadedKinds: THREE.InstancedMesh[] = [];
  const instanced = (node: THREE.Object3D): node is THREE.InstancedMesh => 'isInstancedMesh' in node && node.isInstancedMesh === true;
  loaded.scene.traverse(node => { if (instanced(node)) loadedKinds.push(node); });
  const meshes = new Map(loadedKinds.map((mesh, i) => [piece.kinds[i]?.name ?? '', mesh]));
  const original = new CabinGeometries(packed());
  const seeds = [];
  for (const [ordinal, row] of committed.geometries.entries()) {
    const expected = original.geometry(ordinal);
    if (!row.attrs.some(([name]) => name === 'position')) {
      const attribute = expected.getAttribute('seed');
      seeds.push({ ordinal, width: attribute.itemSize, values: Array.from(attribute.array) }); continue;
    }
    const mesh = meshes.get(`cabin-geometry-${String(ordinal)}`);
    if (mesh === undefined) throw new Error('Cabin author omitted a native geometry');
    expect(mesh.count).toBe(1);
    const actual = nativeWholeGeometry(mesh);
    expect(Object.keys(actual.attributes).sort()).toEqual(Object.keys(expected.attributes).sort());
    for (const name of Object.keys(expected.attributes)) {
      const a = actual.getAttribute(name), b = expected.getAttribute(name);
      expect(a.itemSize).toBe(b.itemSize);
      expect(Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength).equals(new Uint8Array(b.array.buffer, b.array.byteOffset, b.array.byteLength)), `geometry ${String(ordinal)} ${name}`).toBe(true);
    }
    const ai = actual.getIndex(), bi = expected.getIndex();
    expect(ai?.array.constructor).toBe(bi?.array.constructor);
    expect(ai === null && bi === null || ai !== null && bi !== null && Buffer.from(ai.array.buffer, ai.array.byteOffset, ai.array.byteLength).equals(new Uint8Array(bi.array.buffer, bi.array.byteOffset, bi.array.byteLength))).toBe(true);
    actual.dispose(); expected.dispose();
  }
  expect(piece.rows['seeds']).toEqual(seeds);
  expect(meshes.size).toBe(committed.geometries.filter(row => row.attrs.some(([name]) => name === 'position')).length);
});
