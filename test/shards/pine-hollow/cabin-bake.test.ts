import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate hashes the committed bake's bytes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the page loads.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The committed bake is a zlib stream the page inflates.
import { inflateSync } from 'node:zlib';
import * as THREE from 'three';
import { PINE_SEED, bakePineCabins } from '../../../src/shards/pine-hollow/generators/logCabin';
import { PINE_HOLLOW } from '../../../src/shards/pine-hollow/manifest';
import { CABIN_ROWS, CabinGeometries, LogBuilding, NO_OWNER } from '../../../src/shards/pine-hollow/world/cabinBake';
import type { Mats } from '../../../src/shards/pine-hollow/world/homestead';
import committed from '../../../src/shards/pine-hollow/data/cabins.json' with { type: 'json' };
import { pineCabinHeights } from '../../../scripts/bake-pine-cabins.mjs';

const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const packed = (): Uint8Array => new Uint8Array(inflateSync(readFileSync(new URL('../../../public/assets/pine-hollow/baked/cabins.bin', import.meta.url))));

describe('Pine Hollow bakes its log buildings offline (G285)', () => {
  it('the committed bake is byte-exact against its generator (the stale gate: rerun scripts/bake-pine-cabins.mjs)', () => {
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
