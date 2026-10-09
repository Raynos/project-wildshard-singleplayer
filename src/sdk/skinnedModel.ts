import { Bone, FileLoader, Float32BufferAttribute, SkinnedMesh, type AnimationClip, type BufferGeometry, type Object3D, type Texture } from 'three';

/** A baked joint: its name, its parent's name (null for a root) and its exact bind position (BoneDef's shape). */
export interface SkinnedJoint { readonly name: string; readonly parent: string | null; readonly pos: [number, number, number] }
/** One skinned part: an independent geometry copy (skinIndex / skinWeight over `bones`) and its shared base-colour map. */
export interface SkinnedAssetPart { readonly name: string; readonly geometry: BufferGeometry; readonly map: Texture | null }
export interface SkinnedAsset {
  readonly bones: readonly SkinnedJoint[];
  readonly parts: readonly SkinnedAssetPart[];
  /** The baked animations (shared, never mutated). */
  readonly clips: readonly AnimationClip[];
  /** The shard's own JSON the generator wrote beside the model. */
  readonly extras: unknown;
}
/**
 * An offline skinned model (`@wildshard/sdk/bake/skinned`): load once behind the loading screen, then take copies. Each
 * `copy()` hands out independent geometry (safe to merge, scale or dispose) bit-exact to what the generator baked: every
 * channel as written, the weights never renormalized, an authored triangle soup restored, the joints' exact bind
 * positions. The maps, clips and extras are shared. No services are installed on import.
 */
export interface SkinnedModel {
  /** Load the GLB through three's loading manager (the engine's tier / KTX2 / version URL policy applies, as to any
   * three loader); explicit bytes let a Node baker or test use the identical intake. */
  load: (bytes?: Uint8Array) => Promise<void>;
  loaded: () => boolean;
  copy: () => SkinnedAsset;
  /** The shared maps every copy draws with (for the owner's cache and upload policy). */
  textures: () => readonly Texture[];
}

const isSkinnedMesh = (node: Object3D): node is SkinnedMesh => node instanceof SkinnedMesh;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const numbers = (value: unknown): number[] | null => Array.isArray(value) && value.every((n: unknown) => typeof n === 'number') ? value : null;

/** Read the GLB's JSON chunk and each primitive's raw WEIGHTS_0 floats (three's loader renormalizes them in place). */
function rawWeights(bytes: Uint8Array): Map<string, Float32Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), length = view.getUint32(12, true);
  const doc: unknown = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + length)));
  const out = new Map<string, Float32Array>();
  if (!isRecord(doc) || !Array.isArray(doc['meshes']) || !Array.isArray(doc['accessors']) || !Array.isArray(doc['bufferViews'])) return out;
  const accessors: unknown[] = doc['accessors'], views: unknown[] = doc['bufferViews'], bin = 28 + length;
  doc['meshes'].forEach((mesh: unknown, m) => {
    if (!isRecord(mesh) || !Array.isArray(mesh['primitives'])) return;
    mesh['primitives'].forEach((primitive: unknown, p) => {
      const attributes = isRecord(primitive) && isRecord(primitive['attributes']) ? primitive['attributes'] : {}, id = attributes['WEIGHTS_0'];
      const accessor = typeof id === 'number' ? accessors[id] : undefined, bufferView = isRecord(accessor) && typeof accessor['bufferView'] === 'number' ? views[accessor['bufferView']] : undefined;
      if (!isRecord(accessor) || !isRecord(bufferView) || accessor['componentType'] !== 5126 || typeof accessor['count'] !== 'number') return;
      const start = bin + (typeof bufferView['byteOffset'] === 'number' ? bufferView['byteOffset'] : 0) + (typeof accessor['byteOffset'] === 'number' ? accessor['byteOffset'] : 0);
      const weights = new Float32Array(accessor['count'] * 4);
      for (let i = 0; i < weights.length; i++) weights[i] = view.getFloat32(start + i * 4, true);
      out.set(`${String(m)}/${String(p)}`, weights);
    });
  });
  return out;
}

export function skinnedModel(url: string): SkinnedModel {
  let template: SkinnedAsset | undefined, pending: Promise<void> | undefined;
  const load = async (bytes?: Uint8Array): Promise<void> => {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    let input = bytes;
    if (input === undefined) {
      const response: unknown = await new FileLoader().setResponseType('arraybuffer').loadAsync(url);
      if (!(response instanceof ArrayBuffer)) throw new Error(`Skinned model load failed: ${url}`);
      input = new Uint8Array(response);
    }
    const weights = rawWeights(input);
    const gltf = await new GLTFLoader().parseAsync(Uint8Array.from(input).buffer, '');
    const meshes: SkinnedMesh[] = [];
    gltf.scene.traverse((node: Object3D) => { if (isSkinnedMesh(node)) meshes.push(node); });
    const first = meshes[0];
    if (first === undefined) throw new Error(`Skinned model has no skinned mesh: ${url}`);
    const joints = first.skeleton.bones;
    const bones: SkinnedJoint[] = joints.map((bone) => {
      const extras: unknown = bone.userData['wildshard'], bind = isRecord(extras) ? numbers(extras['bind']) : null;
      if (bind?.length !== 3) throw new Error(`Skinned joint ${bone.name} has no bind position: ${url}`);
      return { name: bone.name, parent: bone.parent instanceof Bone ? bone.parent.name : null, pos: [bind[0] ?? 0, bind[1] ?? 0, bind[2] ?? 0] };
    });
    const parts = meshes.map((mesh) => {
      if (mesh.skeleton.bones.length !== joints.length || mesh.skeleton.bones.some((bone, i) => bone.name !== joints[i]?.name)) throw new Error(`Skinned parts must share one skeleton: ${url}`);
      const association = gltf.parser.associations.get(mesh), exact = weights.get(`${String(association?.meshes ?? -1)}/${String(association?.primitives ?? 0)}`);
      let geometry = mesh.geometry.clone();
      const extras: unknown = geometry.userData['wildshard'];
      geometry.userData = {};
      if (exact === undefined || exact.length !== geometry.getAttribute('skinWeight').count * 4) throw new Error(`Skinned part has no float weights: ${url}`);
      geometry.setAttribute('skinWeight', new Float32BufferAttribute(exact, 4));
      if (isRecord(extras) && isRecord(extras['attributes'])) for (const [from, to] of Object.entries(extras['attributes'])) {
        const channel = from.toLowerCase();
        if (typeof to !== 'string' || !geometry.hasAttribute(channel)) throw new Error(`Skinned part is missing ${from}: ${url}`);
        geometry.setAttribute(to, geometry.getAttribute(channel)); geometry.deleteAttribute(channel);
      }
      if (isRecord(extras) && extras['soup'] === true) { const soup = geometry.toNonIndexed(); geometry.dispose(); geometry = soup; }
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material, map = material !== undefined && 'map' in material && material.map !== null && typeof material.map === 'object' ? material.map as Texture : null;
      return { name: mesh.name, geometry, map };
    });
    for (const mesh of meshes) {
      mesh.geometry.dispose();
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
    }
    const extras: unknown = isRecord(gltf.asset.extras) ? gltf.asset.extras['wildshard'] : null;
    template = { bones, parts, clips: gltf.animations, extras };
  };
  const start = async (bytes?: Uint8Array): Promise<void> => {
    try { await load(bytes); } catch (error: unknown) { pending = undefined; throw error; }
  };
  return {
    load: (bytes) => { pending ??= start(bytes); return pending; },
    loaded: () => template !== undefined,
    textures: () => template === undefined ? [] : [...new Set(template.parts.flatMap((part) => part.map === null ? [] : [part.map]))],
    copy: () => {
      if (template === undefined) throw new Error(`Skinned model was not loaded: ${url}`);
      return { clips: template.clips, extras: template.extras, bones: template.bones.map((bone) => ({ name: bone.name, parent: bone.parent, pos: [bone.pos[0], bone.pos[1], bone.pos[2]] })),
        parts: template.parts.map((part) => ({ name: part.name, map: part.map, geometry: part.geometry.clone() })) };
    },
  };
}
