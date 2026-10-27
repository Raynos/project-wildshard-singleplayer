// oxlint-disable-next-line import/no-nodejs-modules -- The real scene bake writes its inspectable intermediate into an isolated test project.
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare every byte natively without Vitest recursively visiting millions of typed-array elements.
import { Buffer } from 'node:buffer';
import { BufferAttribute, BufferGeometry, Material, Mesh, type Object3D } from 'three';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { assembleWholeGeometryViews } from '../src/game/plugin/geometry';
import { driftwoodScene } from '../src/shards/driftwood-isle/generators/scene';

const ordinals = v.union([v.array(v.number()), v.strictObject({ runs: v.array(v.number()) })]);
const partition = v.object({ vertices: ordinals, triangles: ordinals });
const isMesh = (node: Object3D): node is Mesh => node instanceof Mesh;
const bytes = (attribute: BufferAttribute): Buffer => Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength);

test('the compact Driftwood tile bake reconstructs every original world draw bit for bit', async () => {
  mkdirSync('tmp', { recursive: true });
  const project = mkdtempSync('tmp/driftwood-tile-bake-'), meshes: Mesh[] = [];
  const head = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  const { fixed, baked } = driftwoodScene(project, head, new Uint8Array(readFileSync('public/assets/models/driftwood-blender/voxel-ao.bin')));
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  try {
    const parents = baked.shardfile.tiles.filter(tile => tile.lod === 1);
    expect(parents).toHaveLength(7);
    expect(parents.every(tile => tile.files.length === 0 && tile.compressed + tile.decoded + tile.gpu + tile.triangles + tile.draws === 0)).toBe(true);
    const tiles = baked.shardfile.tiles.filter(tile => tile.lod === 0);
    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles) for (const hash of tile.files) {
      const wire = baked.assets.get(hash);
      if (wire === undefined) throw new Error('Missing baked tile');
      const loaded = await new GLTFLoader().parseAsync(Uint8Array.from(wire).buffer, '');
      loaded.scene.traverse(node => { if (isMesh(node)) meshes.push(node); });
    }
    for (const mesh of meshes) {
      const row = v.parse(partition, mesh.userData['wholePartition']);
      expect(Array.isArray(row.vertices)).toBe(false);
      expect(Array.isArray(row.triangles)).toBe(false);
    }
    const assembled = assembleWholeGeometryViews(meshes);
    try {
      expect([...assembled.keys()].sort()).toEqual([...fixed.world.keys()].sort());
      for (const [id, matrix] of fixed.world) {
        const original = fixed.geometries.get(id), actual = assembled.get(id);
        if (original === undefined || actual === undefined) throw new Error(`Missing world draw ${id}`);
        expect(actual.matrix.elements).toEqual(matrix.elements);
        expect(Object.keys(actual.geometry.attributes).sort()).toEqual(Object.keys(original.attributes).sort());
        for (const [name, attribute] of Object.entries(original.attributes)) {
          const channel = actual.geometry.getAttribute(name);
          if (!(attribute instanceof BufferAttribute) || !(channel instanceof BufferAttribute)) throw new Error('Expected exact plain channels');
          expect(channel.array.constructor).toBe(attribute.array.constructor);
          expect([channel.itemSize, channel.normalized]).toEqual([attribute.itemSize, attribute.normalized]);
          expect(bytes(channel).equals(bytes(attribute)), `${id}.${name} bytes`).toBe(true);
        }
        const expectedIndex=original.index,actualIndex=actual.geometry.index;
        expect(actualIndex===null).toBe(expectedIndex===null);
        if(expectedIndex!==null&&actualIndex!==null){
          expect(actualIndex.array.constructor).toBe(expectedIndex.array.constructor);
          expect(bytes(actualIndex).equals(bytes(expectedIndex)), `${id} index bytes`).toBe(true);
        }
      }
    } finally { for (const view of assembled.values()) view.geometry.dispose(); }
  } finally {
    for (const mesh of meshes) {
      mesh.geometry.dispose();
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (material instanceof Material) material.dispose();
    }
    for (const geometry of fixed.geometries.values()) geometry.dispose();
    rmSync(project, { recursive: true });
  }
});
