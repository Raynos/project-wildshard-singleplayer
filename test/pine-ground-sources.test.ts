import { expect, test } from 'vitest';
import { BufferGeometry, Material, Mesh, type Object3D } from 'three';
import { prepareRigLoader } from '../src/engine/anim/rig';
import { assembleWholeGeometryViews } from '../src/game/plugin/geometry';
import { forestPage } from '../src/shards/pine-hollow/generators/forestPage';
import { timberWorld } from '../src/shards/pine-hollow/generators/timberWorldRows';
import { PINE_ASSETS } from './fixtures/pine-program';
import { PINE_SOURCES } from './fixtures/pine-sources';

function wholeMesh(node: Object3D): node is Mesh {
  if (!(node instanceof Mesh)) return false;
  const geometry: unknown = node.geometry, material: unknown = node.material;
  return geometry instanceof BufferGeometry && (material instanceof Material || Array.isArray(material) && material.every(value => value instanceof Material));
}

test('Pine cover source selection retains every original channel, index and transform', async () => {
  const before = timberWorld(PINE_SOURCES).shardfile.files.filter(row => row.kind === 'glb').map(row => row.hash);
  const rows = forestPage(PINE_SOURCES).FOREST_PAGE.ground, after = rows.sources;
  expect(after.length).toBeLessThan(before.length);
  expect(after.every(hash => before.includes(hash))).toBe(true);
  const loader = (await prepareRigLoader()).createRigLoader();
  const read = async (hashes: readonly string[]) => {
    const meshes: Mesh[] = [], dispose: (() => void)[] = [];
    try {
      for (const hash of hashes) {
        const bytes = PINE_ASSETS.get(hash); if (bytes === undefined) throw new Error('Missing original Pine geometry');
        const gltf = await loader.parseBytesAsync(bytes, '');
        gltf.scene.traverse(node => {
          if (!wholeMesh(node)) return;
          const geometry: unknown = node.geometry; if (!(geometry instanceof BufferGeometry)) throw new Error('Missing original geometry');
          meshes.push(node); dispose.push(() => { geometry.dispose(); for (const material of Array.isArray(node.material) ? node.material : [node.material]) if (material instanceof Material) material.dispose(); });
        });
      }
      return assembleWholeGeometryViews(meshes);
    } finally { for (const release of dispose) release(); }
  };
  const original = await read(before), selected = await read(after);
  try {
    expect([...selected.keys()].sort()).toEqual(rows.kinds.map(row => row.geometry).sort());
    for (const row of rows.kinds) {
      const a = original.get(row.geometry), b = selected.get(row.geometry); if (a === undefined || b === undefined) throw new Error('Missing original cover shape');
      expect(b.matrix).toEqual(a.matrix); expect(Object.keys(b.geometry.attributes)).toEqual(Object.keys(a.geometry.attributes));
      for (const key of Object.keys(a.geometry.attributes)) {
        const x = a.geometry.getAttribute(key), y = b.geometry.getAttribute(key);
        expect(y.array).toEqual(x.array); expect(y.itemSize).toBe(x.itemSize); expect(y.normalized).toBe(x.normalized);
      }
      expect(b.geometry.index?.array).toEqual(a.geometry.index?.array);
    }
  } finally { for (const view of original.values()) view.geometry.dispose(); for (const view of selected.values()) view.geometry.dispose(); }
});
