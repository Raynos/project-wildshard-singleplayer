import { expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three';
import { Scope } from '../src/engine/app/scope';
import { staticGlb } from '../src/sdk/bake/glb';
import { contentHash } from '../src/sdk/project';
import { parseItems } from '@wildshard/format/items';
import { emptyShardfile } from '../src/sdk/author';
import { shardfileRules } from '@wildshard/format/shardSchema';
import { parseShardfile } from '../src/sdk/shardfile';
import { assetCost } from '../src/sdk/assets';
import { loadItemModels } from '../src/game/shardfile/itemModels';

function fixture() {
  const geometry = new BoxGeometry(0.03, 2, 0.03), material = new MeshStandardMaterial();
  const bytes = staticGlb([{ geometry, material }], 'spear'); geometry.dispose(); material.dispose();
  const hash = contentHash(bytes), ref = `commons:${hash}`;
  const attack = { id: 'spear.thrust', damage: 30, cooldown: 0.35, range: 3.2, width: 0.3, tags: ['weapon.spear'], effect: null };
  const items = parseItems({ version: 1, rows: [{ id: 'weapon.spear', kind: 'weapon', family: 'kit.melee',
    slot: 'declared.weapon.spear', context: 'weapon.melee', ui: { name: 'Spear', icon: 'sword', swapIcon: '', blurb: 'Thrust' },
    view: { recipe: 'asset.static', asset: ref, colour: '#ffffff', position: [0.2, -0.2, -0.4], rotation: [0, 0, 0] },
    hook: null, light: attack, heavy: attack, charge: 0.4 }], contexts: [], loadout: { primary: 'weapon.spear', secondary: null, tools: [] } });
  return { bytes, hash, ref, items, assets: new Map([[ref, bytes]]) };
}
function isMesh(value: unknown): value is Mesh { return value instanceof Mesh; }
function meshOf(root: Awaited<ReturnType<typeof loadItemModels>>, ref: string): Mesh {
  const node = root.get(ref)?.children[0];
  if (!isMesh(node)) throw new Error('Missing loaded mesh');
  return node;
}

it('leases one immutable model across two shards, disposes after the last owner, and reparses on a late entry', async () => {
  const f = fixture(), a = new Scope('first'), b = new Scope('second'), c = new Scope('late');
  try {
    const [first, second] = await Promise.all([loadItemModels(f.items, f.assets, a), loadItemModels(f.items, f.assets, b)]);
    const mesh = meshOf(first, f.ref); expect(meshOf(second, f.ref).geometry).toBe(mesh.geometry);
    let disposals = 0; mesh.geometry.addEventListener('dispose', () => { disposals++; });
    const clone = second.get(f.ref)?.clone(true); expect(clone?.position).not.toBe(first.get(f.ref)?.position);
    a.dispose(); await Promise.resolve(); expect(disposals).toBe(0);
    b.dispose(); await Promise.resolve(); expect(disposals).toBe(1);
    const late = await loadItemModels(f.items, f.assets, c); expect(meshOf(late, f.ref).geometry).not.toBe(mesh.geometry);
  } finally { a.dispose(); b.dispose(); c.dispose(); }
});

it('refuses missing bytes, a forged hash and a retired owner before exposing a model', async () => {
  const f = fixture(), scope = new Scope('admission');
  try {
    await expect(loadItemModels(f.items, new Map(), scope)).rejects.toThrow('Missing admitted');
    const corrupted = f.bytes.slice(); corrupted[corrupted.length - 1] = 255;
    await expect(loadItemModels(f.items, new Map([[f.ref, corrupted]]), scope)).rejects.toThrow('hash mismatch');
    scope.dispose(); await expect(loadItemModels(f.items, f.assets, scope)).rejects.toThrow('owner retired');
  } finally { scope.dispose(); }
});

it('requires item model references in the charged library and refuses remote URLs and non-GLB local files', () => {
  const f = fixture(), source = emptyShardfile({ slug: 'spear-owner', name: 'Spear', author: 'Fixture', seed: 1, revision: 1 });
  source.items = f.items; source.requires.commons = [f.hash]; source.requires.commonsWire = { [f.hash]: f.bytes.length };
  source.requires.commonsCosts = { [f.hash]: assetCost('glb', f.bytes) }; source.library = [f.ref];
  expect(parseShardfile(source).items).toEqual(f.items);
  expect(shardfileRules({ ...source, library: [] })).toContain('admitted item model library references');
  expect(() => parseShardfile({ ...source, library: [] })).toThrow('Orphan shardfile asset');
  const row = f.items.rows[0]; if (row === undefined) throw new Error('Missing item');
  expect(() => parseItems({ ...f.items, rows: [{ ...row, view: { ...row.view, asset: 'https://external.test/model.glb' } }] })).toThrow();
  const nonModel = { ...source, library: [f.hash], requires: { ...source.requires, commons: [], commonsWire: {}, commonsCosts: {} }, files: [{ hash: f.hash, kind: 'binary' as const, compressed: f.bytes.length,
    decoded: f.bytes.length, gpu: 0, draws: 0, triangles: 0, dependencies: [], critical: false }],
    items: { ...f.items, rows: [{ ...row, view: { ...row.view, asset: f.hash } }] } };
  expect(shardfileRules(nonModel)).toContain('admitted item model library references');
  expect(() => parseShardfile(nonModel)).toThrow('shardfile semantic rules');
});
