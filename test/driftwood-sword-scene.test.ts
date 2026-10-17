import { afterEach, expect, test, vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture decodes the shipped owned geometry through its native intake.
import { readFileSync } from 'node:fs';
import { BufferAttribute, BufferGeometry, InterleavedBufferAttribute, Mesh, MeshBasicMaterial } from 'three';
import { ToonLook } from '@wildshard/engine/render/families/toon';
import { Scope } from '@wildshard/engine/app/scope';
import { createOwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import { parsePrivateScene } from '@wildshard/format/clientChannels';
import { HeldArmsSchema } from '@wildshard/format/heldArms';
import * as v from 'valibot';
import { HeldClaims, HeldClaimGuard } from '../src/game/loadout/claims';
import * as compiler from '../src/game/shardfile/runtimeProduct';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import type { ShardContext } from '../src/game/plugin/context';
import { emptyShardfile } from '../src/sdk/author';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { HELD_ARMS } from '../src/shards/driftwood-isle/generators/heldArms';
import { DRIFTWOOD_OUTPUT } from '../src/shards/driftwood-isle/generators/assets';
import recipe from '../src/shards/driftwood-isle/data/ironSwordScene.json' with { type: 'json' };

afterEach(() => { vi.restoreAllMocks(); });
function ownedGeometry(value: unknown): value is BufferGeometry { return value instanceof BufferGeometry; }
type Looks = Awaited<ReturnType<typeof compiler.runtimeLookMaterials>>;
function looks(materials: ReadonlyMap<string, MeshBasicMaterial>): Looks {
  return { toon: new ToonLook(), materials, setParam: vi.fn<Looks['setParam']>(), setTexture: vi.fn<Looks['setTexture']>(),
    textures: new Map(), compile: () => new MeshBasicMaterial(), bindMeshMap: () => new MeshBasicMaterial(), tick: () => undefined,
    outline: () => [], graphs: { bind: () => undefined, readout: { compiled: 0, fallback: 0, reasons: [] } }, surfaces: null };
}

test('a second shard drives held claim geometry, materials and cards entirely from rows', async () => {
  const rows = v.parse(HeldArmsSchema, { ...HELD_ARMS, slug: 'fixture-harbour', look: { ...HELD_ARMS.look, id: 'harbour.claim-arms',
    materials: { arms: 'linen', wood: 'oak', iron: 'steel', swim: 'wet', pickupBlade: 'coral', pickupFittings: 'brass' } },
    weapons: [{ item: 'harbour.sabre', blade: 'iron' }], cards: [{ id: 'harbour/sabre', name: 'Harbour sabre', file: 'harbour.json', kind: 'iron', size: [1,2,3], copies: 2 }],
    claims: HELD_ARMS.claims.map(row => Object.assign(structuredClone(row), { id: 'sabre', item: 'harbour.sabre', materials: { blade: 'coral', fittings: 'brass' } })) });
  const files = new Map<string, { hash: string; url: string }>(), bytes = new Map<string, Uint8Array>();
  const claim = rows.claims[0]; if (claim === undefined) throw new Error('Missing fixture claim');
  for (const name of Object.values(claim.geometries)) {
    const source = DRIFTWOOD_OUTPUT.blobs.find(row => row.name === name); if (source === undefined) throw new Error('Missing shipped claim geometry');
    const buffer = new Uint8Array(readFileSync(`src/shards/driftwood-isle/${source.source}`)), hash = hashImmutableBytes(buffer);
    bytes.set(hash, buffer); files.set(name, { hash, url: `/fixture/${hash}` });
  }
  const product = createShardProduct({ slug: rows.slug, revision: 1, shardfile: emptyShardfile({ slug: rows.slug, name: 'Harbour', author: 'Fixture', revision: 1, seed: 17 }),
    sections: new Map([['held/arms', rows]]), files, check: true, read: hash => {
      const buffer = bytes.get(hash); return buffer === undefined ? Promise.reject(new Error('Unexpected file')) : Promise.resolve(buffer);
    } });
  const materials = new Map(Object.values(rows.look.materials).map(id => [id, new MeshBasicMaterial()]));
  vi.spyOn(compiler, 'runtimeLookMaterials').mockResolvedValue(looks(materials));
  const scope = new Scope('harbour-claims'), context = { scope, product } as ShardContext;
  const host = await HeldClaims.prepare(context), first = host.display('sabre'), second = host.display('sabre');
  expect(claim.scene).toEqual(parsePrivateScene(recipe)); expect(first.children).toHaveLength(2);
  for (const [i, child] of first.children.entries()) {
    const copy = second.children[i]; if (!(child instanceof Mesh) || !(copy instanceof Mesh)) throw new Error('Held claim requires two mesh draws');
    const geometry: unknown = child.geometry, other: unknown = copy.geometry;
    if (!ownedGeometry(geometry) || !ownedGeometry(other)) throw new Error('Missing owned claim buffer');
    expect(child.position.toArray()).toEqual([0,-.36,0]); expect(child.castShadow && child.receiveShadow).toBe(true);
    expect(child.material).toBe(materials.get(i === 0 ? 'coral' : 'brass'));
    const name = Object.values(claim.geometries)[i]; if (name === undefined) throw new Error('Missing fixture geometry slot');
    const original = createOwnedGeometry('fixture'); await original.load(await product.file(name)); const expected: BufferGeometry = original.take();
    expect(Object.keys(geometry.attributes)).toEqual(Object.keys(expected.attributes));
    for (const key of Object.keys(expected.attributes)) {
      const actual: unknown = geometry.getAttribute(key), source: unknown = expected.getAttribute(key), copied: unknown = other.getAttribute(key);
      if (!(actual instanceof BufferAttribute || actual instanceof InterleavedBufferAttribute)
        || !(source instanceof BufferAttribute || source instanceof InterleavedBufferAttribute)
        || !(copied instanceof BufferAttribute || copied instanceof InterleavedBufferAttribute)) throw new Error('Missing claim attribute');
      expect(actual.array).toEqual(source.array); expect(actual.array.buffer).not.toBe(copied.array.buffer);
    }
    expect(geometry.index?.array ?? null).toEqual(expected.index?.array ?? null);
    geometry.dispose(); other.dispose(); expected.dispose();
  }
  expect(HeldClaims.gear(rows).map(row => row.id)).toEqual(['harbour/sabre']);
  expect(() => host.display('missing')).toThrow(); expect(() => v.parse(HeldArmsSchema, { ...rows, look: undefined })).toThrow();
  scope.dispose(); expect(() => HeldClaims.current(rows.slug)).toThrow(); for (const material of materials.values()) material.dispose();
});

test('claim guard facts preserve live deaths and existing absent-roster saves', () => {
  const guard = new HeldClaimGuard({ id: 'harbour-rack', actor: 'reef-guard', message: 'Guarded', absentUnless: 'guard-defeated' });
  expect(guard.reason()).toBe(null); guard.bindFacts({ flags: [] }); expect(guard.reason()).toBe('Guarded');
  guard.bindFacts({ flags: ['guard-defeated'] }); expect(guard.reason()).toBe(null);
  const actors = [{ kind: 'reef-guard', alive: true }]; guard.bindFacts({ flags: ['guard-defeated'], actors });
  expect(guard.reason()).toBe('Guarded'); if (actors[0] !== undefined) actors[0].alive = false;
  expect(guard.reason()).toBe(null);
});
