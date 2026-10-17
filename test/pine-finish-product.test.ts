import { Scope } from '../src/engine/app/scope';
import { installGeometrySource } from '../src/engine/models/geometrySources';
import { expect, test } from 'vitest';
import * as THREE from 'three';
import * as v from 'valibot';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { HeldFinishes } from '../src/game/loadout/finishes';
import { WEAPON_FINISHES } from '../src/shards/pine-hollow/generators/weaponFinishes';
import { HELD_GEAR } from '../src/shards/pine-hollow/generators/heldGear';
import packed from '../src/shards/pine-hollow/data/codeParts.json' with { type: 'json' };
import { output } from '../src/shards/pine-hollow/generators/output';
import { outputPlatformPayloads } from '../src/sdk/outputProduct';
import { HeldFinishesSchema } from '../src/format/heldFinishes';
import { GeometryPack, packedRows } from '../src/sdk/kit/geometryPack';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare actual shipped geometry bytes, not a regenerated substitute.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The original code-parts bake is zlib compressed.
import { inflateSync } from 'node:zlib';

const shardfile = emptyShardfile({ slug: 'pine-finish-test', name: 'Finish test', author: 'Wildshard', revision: 1, seed: 1 });
function product(rows: unknown) {
  return createShardProduct({ slug: shardfile.identity.slug, revision: 1, shardfile, sections: new Map([['held/finishes', rows]]),
    files: new Map(), read: () => Promise.reject(new Error('Finish rows must already be admitted')), check: true });
}

test('finish admission preserves orders/materials/drops and exact extra buffers, with atomic refusal', async () => {
  expect(() => HeldFinishes.current(shardfile.identity.slug)).toThrow('not admitted');
  const rows = v.parse(HeldFinishesSchema, outputPlatformPayloads(output.platform, ['held/finishes']).get('held/finishes'));
  const pack = new GeometryPack(inflateSync(readFileSync(`public${packed.url}`)), packedRows(packed.rows), 'finish parity');
  const source = { geometries: (indices: readonly number[]) => Promise.resolve(indices.map(index => pack.geometry(index))) };
  const scope = new Scope('finish-parity'); installGeometrySource(scope, 'fixture-pack', source);
  const host = await HeldFinishes.prepare(product(rows), scope, 'fixture-pack');
  expect(host.list().map(row => row.id)).toEqual(Object.keys(WEAPON_FINISHES));
  expect(HELD_GEAR.variantOrder.map(id => { const row = host.get(id); return { id, name: row.name, weapon: row.weapon }; }))
    .toEqual(Object.values(WEAPON_FINISHES).map(({ id, name, weapon }) => ({ id, name, weapon })));
  for (const row of host.list()) expect({ ...row, extras: undefined }).toEqual({ ...Object.entries(WEAPON_FINISHES).find(([id]) => id === row.id)?.[1], extras: undefined });
  const root = new THREE.Group(), material = new THREE.MeshBasicMaterial();
  const extra = host.get('ghost-stag').extras?.(root, name => name === 'xbow-prod' ? material : undefined)[0];
  if (!(extra instanceof THREE.Mesh)) throw new Error('Missing actual finish extra');
  const extraGeometry: unknown = extra.geometry;
  if (!(extraGeometry instanceof THREE.BufferGeometry)) throw new Error('Missing actual finish geometry');
  expect(extra.name).toBe('skin-antlers'); expect(extra.material).toBe(material);
  const original = pack.geometry(packed.parts['ghost-stag-tines']);
  for (const key of Object.keys(original.attributes)) {
    const actual: unknown = extraGeometry.getAttribute(key);
    if (!(actual instanceof THREE.BufferAttribute)) throw new Error('Missing actual finish attribute');
    expect(actual.array).toEqual(original.getAttribute(key).array);
  }
  expect(extraGeometry.index?.array).toEqual(original.index?.array); expect(extraGeometry.groups).toEqual(original.groups);
  extraGeometry.dispose(); original.dispose(); material.dispose();
  await expect(HeldFinishes.prepare(product({ ...rows, rows: { ...rows.rows, extra: true } }), scope, 'fixture-pack')).rejects.toThrow();
  await expect(HeldFinishes.prepare(product({ ...rows, rows: { ...rows.rows, ironhide: { ...rows.rows['ironhide'], id: 'warden' } } }), scope, 'fixture-pack')).rejects.toThrow('identity');
  expect(HeldFinishes.current(shardfile.identity.slug)).toBe(host);
});
