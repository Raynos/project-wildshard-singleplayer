// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the generated product with its real local assets.
import { readFileSync } from 'node:fs';
import { BufferGeometry, Material, Mesh, type Object3D } from 'three';
import { expect, it } from 'vitest';
import { assembleWholeGeometryViews } from '../src/game/plugin/geometry';
import { validateShardfileAssets } from '../src/format/assetAdmission';
import { contentHash } from '../src/sdk/project';
import { FIXED_MODEL_FILES } from '../src/shards/driftwood-isle/data/modelFiles';
import product from '../src/shards/driftwood-isle/data/fixedTiles.generated.json' with { type: 'json' };
import source from '../src/shards/driftwood-isle/shard.config';

const isMesh = (node: Object3D): node is Mesh => node instanceof Mesh;

it('assembles the original fixed model identities from the declared tiles and library', async () => {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const meshes: Mesh[] = [];
  const hashes = [...product.tiles.flatMap(row => row.files), ...product.library];
  try {
    for (const hash of hashes) {
      const bytes = readFileSync(`src/shards/driftwood-isle/assets/${hash}`);
      const gltf = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '');
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

it('admits the real generated ground, tile and library assets for the trusted world', () => {
  const assets = new Map(source.files.map(file => [file.hash, Uint8Array.from(readFileSync(`src/shards/driftwood-isle/assets/${file.hash}`))]));
  expect(validateShardfileAssets(source, assets, contentHash)).toEqual(source);
  expect(source.runtime?.binds).toContain('props');
  expect(source.runtime?.binds).toContain('terrain');
});
