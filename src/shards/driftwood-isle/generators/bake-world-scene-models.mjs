#!/usr/bin/env node
// Preserve the original world bake's 16-bit index streams in named standalone scene sources.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BufferAttribute, Mesh, MeshStandardMaterial } from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { byteWriter } from '../../../../scripts/bake-output.mjs';

const root = new URL('../../../../', import.meta.url), project = new URL('../', import.meta.url);
/** @param {unknown} value @returns {value is import('three').Mesh} */
const isMesh = value => value instanceof Mesh;
const writer = byteWriter(process.argv.includes('--check'), 'driftwood-scene-models'), material = new MeshStandardMaterial();
try {
  for (const [source, name] of [['cove-pools', 'pools'], ['waterfall-rings', 'rings']]) {
    const path = `public/assets/driftwood-isle/baked/fixed-models/${source}.glb`, loaded = await readSourceModel(readFileSync(new URL(path, root)));
    const mesh = loaded.gltf.scene.children[0];
    if (!isMesh(mesh) || loaded.gltf.scene.children.length !== 1) throw new Error('Scene source requires one mesh');
    const geometry = mesh.geometry.clone();
    try {
      const index = geometry.getIndex();
      if (index === null || index.array.some(value => value > 65535)) throw new Error('Scene source requires its original 16-bit indices');
      geometry.setIndex(new BufferAttribute(Uint16Array.from(index.array), 1));
      writer.put(fileURLToPath(new URL(`assets/world-scenes/${name}.glb`, project)), staticGlb([{ geometry, material, compactIndex: true }]));
    } finally { geometry.dispose(); mesh.geometry.dispose(); for (const sourceMaterial of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) sourceMaterial.dispose(); }
  }
  writer.finish();
} finally { material.dispose(); }
