import { Scope } from '../src/engine/app/scope';
import { installGeometrySource } from '../src/engine/models/geometrySources';
import { expect, test } from 'vitest';
import { BoxGeometry, BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { HeldFinishes } from '../src/game/loadout/finishes';
import { heldToolRows } from '../src/game/plugin/heldTool';
import { heldGear } from '../src/game/models/heldGear';
import { HeldPlayback } from '../src/game/plugin/weaponFamily';
import { paintedPrimitives } from '../src/game/plugin/geometry';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { SkinLocker } from '../src/game/cosmetics/locker';
import { saves } from '../src/engine/saves/runtime';
import { appIdentity } from '../src/engine/app/identity';
import { output } from '../src/shards/pine-hollow/generators/output';
import { outputPlatformPayloads } from '../src/sdk/outputProduct';

function product(slug: string, rows: unknown) {
  const shardfile = emptyShardfile({ slug, name: slug, author: 'Fixture', revision: 1, seed: 1 });
  return createShardProduct({ slug, revision: 1, shardfile, sections: new Map([['held/finishes', rows]]), files: new Map(),
    read: () => Promise.reject(new Error('Fixture must not fetch')), check: true });
}

test('harbour finishes loan geometry and bind the first available row material', async () => {
  const rows = { order: ['sea-bone'], rows: { 'sea-bone': { id: 'sea-bone', weapon: 'crossbow', name: 'Sea bone', blurb: 'Coral fittings', mats: { coral: { color: 0xabcdee } } } },
    cards: [{ id: 'sea-bone', name: 'Sea bone', blurb: 'Harpoon', lockedBlurb: 'Find coral', icon: 'crossbow' }],
    extras: { 'sea-bone': [{ name: 'harbour-coral', geometry: 23, materials: ['missing', 'coral'] }] } };
  const requested: number[][] = [], original = new BoxGeometry(1, 2, 3);
  const scope = new Scope('harbour-finishes');
  installGeometrySource(scope, 'fixture-pack', { geometries: indices => { requested.push([...indices]); return Promise.resolve(indices.map(() => original)); } });
  const host = await HeldFinishes.prepare(product('fixture-harbour', rows), scope, 'fixture-pack');
  expect(requested).toEqual([[23]]);
  const root = new Group(), material = new MeshBasicMaterial();
  const extra = host.get('sea-bone').extras?.(root, name => name === 'coral' ? material : undefined)[0];
  if (!(extra instanceof Mesh)) throw new Error('Missing declarative harbour extra');
  const extraGeometry: unknown = extra.geometry;
  if (!(extraGeometry instanceof BufferGeometry)) throw new Error('Missing owned harbour geometry');
  expect(extra.name).toBe('harbour-coral'); expect(extra.material).toBe(material); expect(extra.geometry).not.toBe(original);
  const actualPosition: unknown = extraGeometry.getAttribute('position');
  if (!(actualPosition instanceof BufferAttribute)) throw new Error('Missing owned position buffer');
  expect(actualPosition.array).toEqual(original.getAttribute('position').array);
  expect(host.cards).toEqual(rows.cards); expect(host.has('absent')).toBe(false);
  expect(() => host.get('absent')).toThrow();
  extraGeometry.dispose(); original.dispose(); material.dispose();
});

test('harbour tool and cold gear cards contain no shard callbacks', () => {
  const tool = heldToolRows({ description: 'Marker brush', nodeNames: {}, url: '/fixture/marker.glb', loadedLevel: 'fixture-harbour', loadSystemId: 'shard.harbour.marker',
    pose: [{ id: 'harbour.mark', reads: [], bindings: [{ property: 'x', target: 'root' }], nodes: [{ op: 'constant', value: .2 }], channels: [{ property: 'x', value: 0 }] }],
    look: { name: 'harbour-marker', standIn: { roughness: .8, metalness: .1 }, envMapIntensity: .5, anisotropy: 1, loadDelayMs: 120, renderOrder: 999,
      parts: [{ kind: 'box', args: [1, 2, 3], paint: '#123456' }] } });
  const geometry = paintedPrimitives(tool.parts); geometry.computeBoundingBox();
  expect(geometry.boundingBox?.min.toArray()).toEqual([-.5, -1, -1.5]);
  expect(geometry.boundingBox?.max.toArray()).toEqual([.5, 1, 1.5]);
  const root = new Group(); new HeldPlayback({ pose: tool.playback }, new Map([['root', root], ['pivot', new Group()]])).apply('pose', {});
  expect(root.position.x).toBe(.2); expect(tool.loadDelayMs).toBe(120);
  const entries = heldGear({ slug: 'fixture-harbour', cards: [], variantOrder: [], models: [{ role: 'tool', id: 'harbour/marker', name: 'Marker brush',
    file: 'fixture.json', onceKey: 'harbour:marker', pipeline: 'code', copies: 2 }] });
  expect(entries.map(entry => entry.id)).toEqual(['harbour/marker']); expect(entries[0]?.prepare).toBeTypeOf('function'); geometry.dispose();
});

test('existing Pine v1 skin ownership and worn slots continue through the row host', async () => {
  const rows = outputPlatformPayloads(output.platform, ['held/finishes']).get('held/finishes');
  const scope = new Scope('legacy-skin-save');
  installGeometrySource(scope, 'fixture-pack', { geometries: indices => Promise.resolve(indices.map(() => new BoxGeometry())) });
  const host = await HeldFinishes.prepare(product('pine-hollow', rows), scope, 'fixture-pack');
  const imported = saves.importAll(JSON.stringify({ format: appIdentity().saveFormat, version: 2, docs: { 'pine-hollow': { keys: { skins: { v: 1,
    data: { owned: ['ghost-stag', 'ironhide'], worn: { crossbow: 'ghost-stag', rifle: 'ironhide' } } } } } } }));
  expect(imported.imported).toContain('pine-hollow/skins');
  const resumed = new SkinLocker('pine-hollow', host.list());
  expect([...resumed.owned]).toEqual(['ghost-stag', 'ironhide']);
  expect(resumed.wearing('crossbow')?.id).toBe('ghost-stag'); expect(resumed.wearing('rifle')?.id).toBe('ironhide');
  expect(resumed.cardRows(host.cards).filter(card => card.worn).map(card => card.id)).toEqual(['ghost-stag', 'ironhide']);
});
