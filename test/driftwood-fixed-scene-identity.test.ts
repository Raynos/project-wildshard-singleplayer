import { BufferGeometry, Material, Mesh, type Object3D } from 'three';
import { expect, it } from 'vitest';
import { assembleWholeGeometryViews } from '../src/game/plugin/geometry';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { driftwoodFixedProductRows } from '../src/shards/driftwood-isle/generators/fixedProduct';
import { FIXED_MODEL_FILES } from '../src/shards/driftwood-isle/generators/modelFiles';
import { driftwoodFixedBank } from './fixtures/driftwood-fixed-bank';

const isMesh = (node: Object3D): node is Mesh => node instanceof Mesh;

it('assembles the original fixed model identities from the declared tiles and library', async () => {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('meshoptimizer');
  await MeshoptDecoder.ready;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const meshes: Mesh[] = [];
  const owned = await driftwoodFixedBank(), document = owned.get('data/fixedTiles.generated.json');
  if (document === undefined) throw new Error('Missing owned fixed declaration');
  const input: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(document));
  const product = driftwoodFixedProductRows(input);
  // Whole identities come from exact fine partitions and the whole library.
  // L1 parents are simplified render proxies, without whole-partition metadata.
  const hashes = [...product.tiles.filter(row => row.lod === 0).flatMap(row => row.files), ...product.library];
  try {
    for (const hash of hashes) {
      const bytes = owned.get(`assets/${hash}`) ?? owned.get(`owned/coarse/${hash}.glb`);
      if (bytes === undefined) throw new Error(`Missing owned world bytes: ${hash}`);
      expect(hashImmutableBytes(bytes)).toBe(hash);
      const gltf = await loader.parseAsync(Uint8Array.from(bytes).buffer, '');
      gltf.scene.traverse(node => { if (isMesh(node)) meshes.push(node); });
    }
    const assembled = assembleWholeGeometryViews(meshes);
    try {
      const names = Object.values(FIXED_MODEL_FILES).map(url => url.slice(url.lastIndexOf('/') + 1, -4));
      expect([...assembled.keys()].sort()).toEqual(names.sort());
      for (const view of assembled.values()) {
        expect(view.geometry).toBeInstanceOf(BufferGeometry);
        expect(view.geometry.getAttribute('position').count).toBeGreaterThan(0);
        expect(view.matrix.elements.every(Number.isFinite)).toBe(true);
      }
    } finally { for (const view of assembled.values()) view.geometry.dispose(); }
  } finally {
    for (const mesh of meshes) {
      mesh.geometry.dispose();
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (material instanceof Material) material.dispose();
      }
    }
  }
});

