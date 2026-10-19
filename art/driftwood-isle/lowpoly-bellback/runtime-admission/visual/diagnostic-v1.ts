/** Rest-only diagnostic, never an admitted opponent or gameplay capture. */
import { Bone, Skeleton, SkinnedMesh, Mesh, Object3D, Vector3, DoubleSide, FrontSide } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { packedCreatureBodies } from '../../../../../src/game/plugin/geometry';
import { mergeAnimalGeometry } from '../../../../../src/engine/models/animalGeometry';
import { facetGeometry, oneMaterial } from '../../../../../src/engine/entities/lowpoly';

export async function prepare(referenceMaterial: Mesh['material']) {
  const metadata: unknown = await (await fetch('/diagnostic/metadata.json')).json();
  const bodies = packedCreatureBodies(metadata, undefined, async () => new Uint8Array(await (await fetch('/diagnostic/payload.bin')).arrayBuffer()));
  await bodies.preload();
  const body = bodies.copy('bellback', 'bellback');
  const geometry = facetGeometry(mergeAnimalGeometry(body.furParts, body.hardParts, body.eyeParts));
  oneMaterial(geometry, null);
  const native = new SkinnedMesh(geometry, referenceMaterial);
  const bones = new Map<string, Bone>();
  for (const def of body.bones) {
    const bone = new Bone(); bone.name = def.name; bone.position.fromArray(def.pos);
    const parent = def.parent === null ? undefined : bones.get(def.parent);
    const parentDef = body.bones.find(row => row.name === def.parent);
    if (parentDef !== undefined) bone.position.sub(new Vector3(...parentDef.pos));
    if (parent !== undefined) parent.add(bone);
    bones.set(def.name, bone);
  }
  const root = bones.get('body'); if (root === undefined) throw Error('Missing root');
  native.add(root); native.updateMatrixWorld(true); native.bind(new Skeleton([...bones.values()]));
  native.castShadow = true; native.receiveShadow = true; native.frustumCulled = false;
  const gltf = await new GLTFLoader().loadAsync('/diagnostic/source.glb');
  gltf.scene.traverse(o => { if (o instanceof Mesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  const nodes = new Map<number, Object3D>();
  for (const [o, association] of gltf.parser.associations) if (o instanceof Object3D && association.nodes !== undefined) nodes.set(association.nodes, o);
  const setSide = (object: Object3D, double: boolean) => object.traverse(o => {
    if (o instanceof Mesh) for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
      material.side = double ? DoubleSide : FrontSide; material.needsUpdate = true;
    }
  });
  return { native, source: gltf.scene, nodes, setSide, stats: { vertices: geometry.getAttribute('position').count,
    bones: [...bones.keys()], facetJitter: .12, sourceMaterialsUntouched: true } };
}
