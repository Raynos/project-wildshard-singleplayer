import { expect, test } from 'vitest';
import { Group, Mesh, MeshStandardMaterial } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GeometryPack, packedRows } from '../src/sdk/kit/geometryPack';
import { bakeSignalSkirt } from '../src/shards/sunscar-dunes/generators/skirt';
import { SIGNAL_SKIRT_BLOBS } from '../src/shards/sunscar-dunes/generators/skirtScenes';
import { SIGNAL_WORLD_SCENES } from '../src/shards/sunscar-dunes/generators/worldScenes';
import { parseWorldScenes } from '../src/format/worldScenes';
import { parseWorldScene } from '../src/format/clientChannels';
import { Scope } from '../src/engine/app/scope';
import { AssetService } from '../src/engine/app/assets';
import { WorldRegistry } from '../src/engine/world/registry';
import { emptyShardfile } from '../src/sdk/author';
import { parseShardfile } from '../src/format/shardSchema';
import { lendSceneMaterials, sceneMaterial } from '../src/game/shardfile/lentLooks';
import { installWorldScenes } from '../src/game/shardfile/worldScenes';
import type { ShardContext } from '../src/game/plugin/context';

function geometryMesh(value: unknown): value is Mesh { return value instanceof Mesh; }

test('overlapping residents and products keep their own terrain material', () => {
  const a = new Scope('terrain-a'), b = new Scope('terrain-b');
  const first = new MeshStandardMaterial(), second = new MeshStandardMaterial(), third = new MeshStandardMaterial();
  try {
    lendSceneMaterials(a, 'one', new Map([['pbr', first]]));
    lendSceneMaterials(b, 'one', new Map([['pbr', second]]));
    lendSceneMaterials(a, 'two', new Map([['pbr', third]]));
    expect(sceneMaterial(a, 'one', 'pbr')).toBe(first);
    expect(sceneMaterial(b, 'one', 'pbr')).toBe(second);
    expect(sceneMaterial(a, 'two', 'pbr')).toBe(third);
    a.dispose(); expect(sceneMaterial(a, 'one', 'pbr')).toBeUndefined();
    expect(sceneMaterial(b, 'one', 'pbr')).toBe(second);
  } finally { a.dispose(); b.dispose(); first.dispose(); second.dispose(); third.dispose(); }
});

test('both skirt cuts retain every original vertex channel and index', async () => {
  const source = bakeSignalSkirt(), pack = new GeometryPack(source.bytes, packedRows(source.rows), 'original skirt');
  for (const [index, cube] of ['standalone', 'cell'].entries()) {
    const blob = SIGNAL_SKIRT_BLOBS.find(row => row.file.name === `world/geometry/skirt-${cube}.glb`);
    if (blob === undefined) throw new Error('Missing skirt geometry blob');
    expect(blob.bytes.length).toBeLessThan(1_000_000);
    const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(Uint8Array.from(blob.bytes).buffer, '');
    const mesh = gltf.scene.children[0], original = pack.geometry(index);
    if (!geometryMesh(mesh)) throw new Error('Skirt must remain one native draw');
    try {
      expect(Object.keys(mesh.geometry.attributes)).toEqual(Object.keys(original.attributes));
      for (const name of Object.keys(original.attributes)) {
        const actual = mesh.geometry.getAttribute(name), expected = original.getAttribute(name);
        expect(actual.itemSize, name).toBe(expected.itemSize);
        expect(actual.normalized, name).toBe(expected.normalized);
        expect(actual.array, name).toEqual(expected.array);
      }
      expect(mesh.geometry.index?.array).toEqual(original.index?.array);
    } finally { original.dispose(); mesh.geometry.dispose(); }
  }
});

test.each([false, true])('scene borrows the live sand instance and refuses a missing cut: cell=%s', async cell => {
  const scope = new Scope('skirt-fixture'), material = new MeshStandardMaterial(), assets = new AssetService();
  const files = new Map(SIGNAL_SKIRT_BLOBS.map(row => [row.file.name, row.bytes]));
  const base = emptyShardfile({ slug: 'fixture-sand', name: 'Sand', author: 'Fixture', revision: 1, seed: 1 });
  const source = parseShardfile({ ...base, look: { ...base.look, materials: { pbr: { family: 'pbr' } } } });
  const ctx = { scope, root: new Group(), app: { registry: new WorldRegistry(), assets }, game: {}, cube: cell ? { half: 250 } : null,
    product: { slug: source.identity.slug, shardfile: source, hasFile: (name: string) => files.has(name), url: (name: string) => name,
      file: (name: string) => { const value = files.get(name); return value === undefined ? Promise.reject(new Error('Missing original cut')) : Promise.resolve(value); } },
  } as ShardContext;
  const rows = parseWorldScenes({ ...SIGNAL_WORLD_SCENES, libraries: SIGNAL_WORLD_SCENES.libraries.filter(row => row.id === 'skirt'),
    steps: SIGNAL_WORLD_SCENES.steps.filter(row => row.id.startsWith('skirt-')) });
  lendSceneMaterials(scope, source.identity.slug, new Map([['pbr', material]]));
  try {
    const handles = await installWorldScenes(ctx, rows), cut = cell ? 'cell' : 'standalone';
    const mesh = handles.group(`skirt-${cut}.root`).children[0];
    if (!geometryMesh(mesh)) throw new Error('Missing live skirt');
    expect(mesh.material).toBe(material);
    expect(mesh.renderOrder).toBe(-1);
    expect(() => handles.group(`skirt-${cell ? 'standalone' : 'cell'}.root`)).toThrow();
    const absent = rows.libraries[0];
    if (absent?.kind !== 'owned') throw new Error('Missing skirt library');
    const selected = absent.models.find(row => row.id === `skirt-${cut}`);
    if (typeof selected?.file !== 'string') throw new Error('Missing selected geometry');
    files.delete(selected.file);
    const missing = new Scope('missing-skirt');
    try { await expect(installWorldScenes({ ...ctx, scope: missing }, rows)).rejects.toThrow(); }
    finally { missing.dispose(); }
  } finally { scope.dispose(); for (const row of assets.retained()) assets.evictCached(row.key); material.dispose(); }
});

test('Z2 selects the cube cut and the terrain material without a skirt host', () => {
  const steps = SIGNAL_WORLD_SCENES.steps.filter(row => row.id.startsWith('skirt-'));
  expect(steps.map(row => row.cube)).toEqual(['standalone', 'cell']);
  for (const step of steps) {
    expect(step.registry).toEqual([]);
    expect(step.materials).toEqual({ sand: 'sand' });
    expect(step.geometry).toEqual({ skirt: { library: 'skirt', model: step.id } });
    const blob = SIGNAL_SKIRT_BLOBS.find(row => row.file.name === step.scene);
    if (blob === undefined) throw new Error('Missing skirt recipe');
    const input: unknown = JSON.parse(new TextDecoder().decode(blob.bytes));
    const recipe = parseWorldScene(input);
    expect(recipe.scene.nodes.find(row => row.id === 'skirt')).toMatchObject({ renderOrder: -1, receiveShadow: false, castShadow: false });
  }
  expect(SIGNAL_WORLD_SCENES.materials.find(row => row.id === 'sand')).toEqual({ id: 'sand', kind: 'look', look: 'pbr' });
});
