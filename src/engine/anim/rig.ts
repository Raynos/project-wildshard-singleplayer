import { type AnimationClip, type Object3D, SkinnedMesh } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { labelObjectTree } from '../render/gpuLabels';

export type ClipName = `${'idle' | 'walk' | 'run' | 'attack' | 'hit' | 'die' | 'turn' | 'swim' | 'fly'}${'' | `.${string}`}`;
export type SocketName = string;
export interface RigContract { skeleton: string; clips: readonly ClipName[]; sockets: readonly SocketName[] }
/** Canonical → authored names. Metadata renames clips; the GLB and its tracks remain untouched. */
export interface RigBake {
  skeleton: string;
  clips?: Readonly<Partial<Record<ClipName, string>>>;
  sockets?: Readonly<Record<SocketName, string>>;
  /** Ordered joints per skin, as exported by the bake (never traversal order). */
  joints?: readonly (readonly string[])[];
  /** Procedural poses are declarations, not fabricated AnimationClips. */
  procedural?: readonly ClipName[];
}
export interface RigInstance {
  readonly root: Object3D;
  readonly contract: RigContract;
  readonly clips: ReadonlyMap<ClipName, AnimationClip>;
  readonly sockets: ReadonlyMap<SocketName, Object3D>;
}
export interface RigRef { url: string; contract: RigContract; bake: RigBake }

let loader: GLTFLoader | undefined;
/** Cache/clone policy stays with the owning asset scope. All rig GLBs use this parser. */
export async function loadRigFile(url: string): Promise<GLTF> {
  loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url);
  labelObjectTree(gltf.scene, 'engine/loadRigFile', url);
  return gltf;
}

/** Check authored metadata against the actual loaded scene, without posing or rebinding it. */
export function bindRig(root: Object3D, animations: readonly AnimationClip[], contract: RigContract, bake: RigBake): RigInstance {
  const fail = (detail: string): never => { throw new Error(`[anim] ${contract.skeleton}: ${detail}`); };
  if (contract.skeleton === '' || bake.skeleton !== contract.skeleton) fail(`skeleton mismatch (${bake.skeleton})`);
  const clips = new Map<ClipName, AnimationClip>();
  for (const name of contract.clips) {
    const source = bake.clips?.[name] ?? name;
    const clip = animations.find((candidate) => candidate.name === source);
    if (clip !== undefined) clips.set(name, clip);
    else if (!bake.procedural?.includes(name)) fail(`missing clip ${name} (authored ${source})`);
  }
  const sockets = new Map<SocketName, Object3D>();
  for (const name of contract.sockets) {
    const source = bake.sockets?.[name] ?? name;
    const socket = root.getObjectByName(source);
    if (socket === undefined) fail(`missing socket ${name} (authored ${source})`);
    else sockets.set(name, socket);
  }
  if (bake.joints !== undefined) {
    const skins: string[][] = [];
    root.traverse((node) => { if (node instanceof SkinnedMesh) skins.push(node.skeleton.bones.map((bone) => bone.name)); });
    // Several meshes can share one exported skin; deduplicate by ordered joint array.
    const unique = [...new Map(skins.map((joints) => [JSON.stringify(joints), joints])).values()];
    const expected = [...new Map(bake.joints.map((joints) => [JSON.stringify(joints), joints])).values()];
    if (unique.length !== expected.length || expected.some((joints) => !unique.some((actual) => actual.length === joints.length && actual.every((name, i) => name === joints[i])))) fail('skin joint order differs from bake');
  }
  return { root, contract, clips, sockets };
}
export async function loadRig(ref: RigRef): Promise<RigInstance> {
  const file = await loadRigFile(ref.url);
  return bindRig(file.scene, file.animations, ref.contract, ref.bake);
}
