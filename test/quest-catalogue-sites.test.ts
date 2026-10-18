// oxlint-disable-next-line import/no-nodejs-modules -- Resolve generated assets without bundler URL rewriting.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the shipping baked site and geometry products.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Decode the original geometry pack independently of the new scene.
import { inflateSync } from 'node:zlib';
import { expect, test } from 'vitest';
import { Mesh, BufferGeometry, Material } from 'three';
import { floorAtRects } from '../src/engine/physics/box';
import { setTerrainHeight } from '../src/engine/world/terrainHeight';
import { parseItems } from '../src/format/items';
import { parseQuestData } from '../src/format/quests';
import { installQuestCatalogue } from '../src/game/quest/chapter';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { GeometryPack, packedRows } from '../src/sdk/kit/geometryPack';
import { readSourceModel } from '../src/sdk/bake/skinned';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { readNativeTerrain } from '../src/sdk/bake/terrain';
import { hollowLogSite, insideHollowLog } from '../src/shards/pine-hollow-legacy/quest/hollowLog';
import pine from '../src/shards/pine-hollow/shard.config';
import driftwood from '../src/shards/driftwood-isle/shard.config';
import { PINE_FEATS, PINE_BAG_ITEMS } from '../src/shards/pine-hollow/generators/questInventory';
import { DRIFTWOOD_FEATS, DRIFTWOOD_ITEMS } from '../src/shards/driftwood-isle/generators/questInventory';
import { TIMBER_MODEL_ROWS, TIMBER_PLACEMENTS } from '../src/shards/pine-hollow/generators/timberSceneContribution';
import scenes from '../src/shards/pine-hollow/data/timberScenes.generated.json' with { type: 'json' };
import parts from '../src/shards/pine-hollow/data/codeParts.json' with { type: 'json' };

const isGeometry = (value: unknown): value is BufferGeometry => value instanceof BufferGeometry;

test('the existing 26 timber GLBs keep the exact pre-quest hashes', () => {
  const original = Object.fromEntries(Object.entries(scenes.geometryHashes).filter(([path]) => !path.includes('/hollow-log-')));
  expect(Object.keys(original)).toHaveLength(26);
  expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(original)))).toBe('02d3a54716563d0691ba9cd50a76ca441821d8157d4faf8ef795eca121ca66c3');
});

test.each([[pine, PINE_BAG_ITEMS, PINE_FEATS], [driftwood, DRIFTWOOD_ITEMS, DRIFTWOOD_FEATS]] as const)(
  '%s registers the original catalogues through the platform sections without gameplay effects', (source, items, feats) => {
    const product = createShardProduct({ slug: source.identity.slug, revision: source.identity.revision, shardfile: source,
      sections: new Map<string, unknown>([['combat/items', { items: source.items }], ['quests/quests', { quests: source.quests }]]),
      files: new Map(), read: () => Promise.reject(new Error('Catalogue registration never reads blobs')) });
    const registered: unknown[] = [];
    installQuestCatalogue({ product, rows: { item: rows => { registered.push(rows); }, feat: rows => { registered.push(rows); } } });
    expect(registered).toEqual([items, feats]);
    expect(() => parseItems({ ...source.items, catalogue: [...items, items[0]] })).toThrow();
    expect(() => parseQuestData({ ...source.quests, achievements: [...feats, feats[0]] })).toThrow();
    const { catalogue: _catalogue, ...oldItems } = source.items;
    const { achievements: _achievements, ...oldQuests } = source.quests;
    expect(parseItems(oldItems)).toEqual(oldItems);
    expect(parseQuestData(oldQuests)).toEqual(oldQuests);
  });

test('baked hollow floor and mouths preserve the frozen live site and the rifle floor', () => {
  const ground = readNativeTerrain(readFileSync(resolve(import.meta.dirname, '../public/assets/baked/pine-hollow/terrain.bin')));
  setTerrainHeight(ground.heightAt);
  try {
    const old = hollowLogSite(), row = scenes.sites.hollow;
    expect(row.floorY).toBe(old.floorY); expect(row.mid).toEqual(old.mid.toArray());
    expect(row.mouths).toEqual(old.mouths.map(point => point.toArray()));
    for (const dx of [-6, -3, 0, 3, 6]) for (const dz of [-2, 0, 2]) {
      const x = row.x + dx, z = row.z + dz;
      expect(floorAtRects([row.floor], x, z, 'first')).toBe(insideHollowLog(x, z) ? old.floorY : undefined);
    }
    expect(scenes.sites.rifle).toEqual({ x: -13.139577422657654, y: 3.813097448348999, z: -36.01734305173898 });
    expect(TIMBER_PLACEMENTS.find(placement => placement.id === 'quests.hollow-log')?.piece?.floors).toEqual([row.floor]);
    const shelf = TIMBER_MODEL_ROWS.find(model => typeof model === 'object' && model !== null && 'key' in model && model.key === 'token-shelf');
    expect(shelf).toMatchObject({ assembly: 'objects', choices: [{ draws: [{ until: 28 }] }] });
  } finally { setTerrainHeight(() => 0); }
});

test('all five hollow-log GLBs preserve the original packed geometry and native indices', async () => {
  const bytes = inflateSync(readFileSync(resolve(import.meta.dirname, `../public${parts.url}`)));
  const pack = new GeometryPack(bytes, packedRows(parts.rows), 'frozen quest geometry');
  for (const id of ['hollow-log-outer', 'hollow-log-inner', 'hollow-log-rim-0', 'hollow-log-rim-1', 'hollow-log-bed'] as const) {
    const original = pack.geometry(parts.parts[id]), source = await readSourceModel(readFileSync(resolve(import.meta.dirname, `../src/shards/pine-hollow/assets/timber-scenes/${id}.glb`)));
    const meshes: { geometry: BufferGeometry; materials: Material[] }[] = [];
    source.gltf.scene.traverse(node => {
      if (!(node instanceof Mesh)) return;
      const geometry: unknown = node.geometry, material: unknown = node.material;
      if (!isGeometry(geometry)) return;
      const values: readonly unknown[] = Array.isArray(material) ? material : [material];
      const materials = values.filter((value): value is Material => value instanceof Material);
      meshes.push({ geometry, materials });
    });
    try {
      expect(meshes).toHaveLength(1);
      const geometry = meshes[0]?.geometry; if (geometry === undefined) throw new Error('Missing hollow-log draw');
      expect(Object.keys(geometry.attributes).sort()).toEqual(Object.keys(original.attributes).sort());
      for (const key of Object.keys(original.attributes)) expect(Array.from(geometry.getAttribute(key).array)).toEqual(Array.from(original.getAttribute(key).array));
      expect(geometry.index === null ? null : Array.from(geometry.index.array)).toEqual(original.index === null ? null : Array.from(original.index.array));
    } finally {
      original.dispose();
      for (const mesh of meshes) { mesh.geometry.dispose(); for (const material of mesh.materials) material.dispose(); }
    }
  }
});
