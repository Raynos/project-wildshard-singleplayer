import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Vector3, MeshStandardMaterial, Mesh } from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import { namedBlobOutput } from '../../../../scripts/named-blob-output.mjs';
import { cargoModels } from './cargoCatalogue.ts';
import fixed from '../data/fixedBlobs.generated.json' with { type: 'json' };

const root = new URL('../', import.meta.url), writer = byteWriter(process.argv.includes('--check'), 'cargo-scenes');
const blobs = namedBlobOutput(root, 'cargo-scenes'), models = cargoModels(), templates = new Map(), material = new MeshStandardMaterial();
const library = { id: 'cargo', kind: 'owned', models: [] };
try {
  for (const model of models) for (const choice of model.choices) {
    const p = choice.params;
    const kind = model.key === 'barrel' ? p.lying ? 'barrel-lying' : 'barrel'
      : model.key === 'crate' ? p.broken ? 'crate-broken' : 'crate' : 'coil';
    const scale = model.key === 'crate' ? p.size / (p.broken ? 0.7 : 0.8) : model.key === 'ropeCoil' ? p.r / 0.3 : 1;
    const name = `models/fixed/cargo-${kind}.glb`, source = fixed.blobs.find(row => row.name === name);
    if (source === undefined || !Number.isFinite(scale) || scale <= 0) throw new Error('Missing authored cargo source');
    let template = templates.get(name);
    if (template === undefined) {
      const decoded = await readSourceModel(new Uint8Array(readFileSync(new URL(source.source, root))));
      const meshes = []; decoded.gltf.scene.traverse(node => { if (node instanceof Mesh) meshes.push(node); });
      const mesh = meshes[0];
      if (mesh === undefined || meshes.length !== 1) throw new Error('Cargo template needs one original mesh');
      template = mesh.geometry.clone();
      const index = template.index;
      if (index !== null && index.count === template.getAttribute('position').count && Array.from(index.array).every((value, i) => value === i)) template.setIndex(null);
      for (const part of meshes) { part.geometry.dispose(); for (const surface of Array.isArray(part.material) ? part.material : [part.material]) surface.dispose(); }
      templates.set(name, template);
    }
    const shape = template.clone();
    try {
      if (scale !== 1) shape.scale(scale, scale, scale);
      shape.computeBoundingBox();
      const bounds = shape.boundingBox; if (bounds === null) throw new Error('Missing cargo bounds');
      choice.size = bounds.getSize(new Vector3()).toArray();
      const draw = choice.draws[0];
      const file = scale === 1 ? name : blobs.add(`models/cargo/${draw.model}.glb`, 'glb', staticGlb([{ geometry: shape, material }], `cargo-${draw.model}`));
      library.models.push({ id: draw.model, file, attributes: {} });
    } finally { shape.dispose(); }
  }
  writer.put(fileURLToPath(new URL('data/cargoScenes.generated.json', root)), jsonBytes({ models, library }));
  blobs.finish(new URL('data/cargoBlobs.generated.json', root)); writer.finish();
} finally { for (const shape of templates.values()) shape.dispose(); material.dispose(); }
