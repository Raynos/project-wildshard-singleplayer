import { BufferAttribute, Mesh, MeshStandardMaterial } from 'three';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { emitNamedBlobs, nameBlob, type EmittedBlobs } from '@wildshard/sdk/blobs';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { driftwoodFixedFiles } from './fixedProgram';

/** the world scenes' standalone models and the fixed model each is cut from */
const SCENE_MODELS = [['cove-pools', 'pools'], ['waterfall-rings', 'rings']] as const;
const isMesh = (value: unknown): value is Mesh => value instanceof Mesh;

/** The cove's pools and the waterfall's rings as standalone scene sources, keeping the original world bake's 16-bit index
 *  streams: built from the owned fixed models at product build (GR7: they were the `driftwood-world-scene-models` job's
 *  GLBs under src). */
export async function driftwoodSceneModelOutput(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<EmittedBlobs> {
  const fixed = await driftwoodFixedFiles(ctx), material = new MeshStandardMaterial();
  try {
    const blobs = [];
    for (const [source, name] of SCENE_MODELS) {
      const bytes = fixed.get(`baked/fixed-models/${source}.glb`);
      if (bytes === undefined) throw new Error(`Missing owned fixed model: ${source}`);
      blobs.push(nameBlob(`models/scene-${name}.glb`, 'glb', await sceneGlb(bytes, material)));
    }
    return emitNamedBlobs(blobs);
  } finally { material.dispose(); }
}

async function sceneGlb(bytes: Uint8Array, material: MeshStandardMaterial): Promise<Uint8Array> {
  const loaded = await readSourceModel(bytes), mesh = loaded.gltf.scene.children[0];
  if (!isMesh(mesh) || loaded.gltf.scene.children.length !== 1) throw new Error('Scene source requires one mesh');
  const source = mesh.geometry, materials = mesh.material, geometry = source.clone();
  try {
    const index = geometry.getIndex();
    if (index === null || index.array.some(value => value > 65535)) throw new Error('Scene source requires its original 16-bit indices');
    geometry.setIndex(new BufferAttribute(Uint16Array.from(index.array), 1));
    return staticGlb([{ geometry, material, compactIndex: true }]);
  } finally {
    geometry.dispose(); source.dispose();
    for (const sourceMaterial of Array.isArray(materials) ? materials : [materials]) sourceMaterial.dispose();
  }
}
