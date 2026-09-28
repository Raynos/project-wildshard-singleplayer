/** The three local TRELLIS.2 figures, skinned in Blender and shared by the arena and Model Explorer. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { TRAINING_DUMMY_SCALE, type DummyVariant, type TrainingDummyModel } from './TrainingDummy';

const URLS: Record<DummyVariant, string> = {
  wood: '/assets/practice/dummies/wood-wood.glb',
  'straw-cloth': '/assets/practice/dummies/straw-cloth.glb',
  'wood-steel': '/assets/practice/dummies/wood-steel.glb',
};
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const templates = new Map<DummyVariant, Promise<THREE.Group>>();

function template(variant: DummyVariant): Promise<THREE.Group> {
  let promise = templates.get(variant);
  if (!promise) {
    promise = loader.loadAsync(URLS[variant]).then((gltf) => gltf.scene);
    templates.set(variant, promise);
    void promise.catch(() => { templates.delete(variant); }); // a failed fetch can retry on the next open
  }
  return promise;
}

function namedBone(root: THREE.Object3D, name: string): THREE.Object3D {
  const bone = root.getObjectByName(name);
  if (!(bone instanceof THREE.Bone)) throw new Error(`Training dummy GLB is missing ${name}`);
  return bone;
}

export async function loadTrainingDummy(variant: DummyVariant): Promise<TrainingDummyModel> {
  const root = cloneSkeleton(await template(variant)) as THREE.Group;
  root.name = `Training dummy · ${variant}`;
  root.scale.setScalar(TRAINING_DUMMY_SCALE);
  root.traverse((part) => {
    if (!(part instanceof THREE.Mesh)) return;
    part.castShadow = false; part.receiveShadow = false; part.frustumCulled = true;
    if (part.material instanceof THREE.MeshStandardMaterial) {
      const material = part.material.clone(); // the arena and turntable can light their copies independently
      material.emissive.set(0xffffff);
      material.emissiveMap = material.map;
      material.emissiveIntensity = 0.55; // the grid room has no sky probe; preserve the baked armor colour at night
      material.metalness = Math.min(material.metalness, 0.55);
      part.material = material;
    }
  });
  return {
    root,
    torso: namedBone(root, 'Torso'), head: namedBone(root, 'Head'),
    leftArm: namedBone(root, 'LeftArm'), rightArm: namedBone(root, 'RightArm'),
  };
}
