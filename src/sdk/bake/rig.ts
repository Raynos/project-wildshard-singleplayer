import { NodeIO, type Accessor } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import * as THREE from 'three';

/** Authoring rest data from a retained skinned GLB; no animation, renderer, scene service or game is installed. */
export interface RigRest {
  readonly geometry: THREE.BufferGeometry;
  readonly bones: readonly { readonly name: string; readonly pos: readonly [number, number, number] }[];
  readonly colourImage: Uint8Array;
}
/** Normalize quantized GLTF channels into the Float32 geometry the Three loader supplies to authoring tools. */
function attribute(accessor: Accessor | null, label: string): THREE.BufferAttribute {
  if (accessor === null) throw new Error(`Rig lacks ${label}`);
  const size = accessor.getElementSize(), array = new Float32Array(accessor.getCount() * size), element: number[] = [];
  for (let index = 0; index < accessor.getCount(); index++) {
    accessor.getElement(index, element);
    for (let channel = 0; channel < size; channel++) array[index * size + channel] = element[channel] ?? 0;
  }
  return new THREE.BufferAttribute(array, size);
}
/** Read one triangle skin's rest geometry, ordered world-space joints and embedded colour atlas in plain Node.
 * Meshopt and embedded WebP are admitted through their GLTF extensions. Multi-skin/multi-primitive input refuses;
 * callers that need a composed rig must author that composition explicitly. UVs and mesh-local positions stay unchanged. */
export async function readRigRest(glb: Uint8Array): Promise<RigRest> {
  if (glb.length < 20 || glb.length > 64_000_000) throw new Error('Rig requires bounded GLB bytes');
  await MeshoptDecoder.ready;
  const document = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).readBinary(glb);
  const nodes = document.getRoot().listNodes().filter(node => node.getSkin() !== null && node.getMesh() !== null);
  if (nodes.length !== 1) throw new Error('Rig requires one skinned node');
  const node = nodes[0], skin = node?.getSkin(), primitives = node?.getMesh()?.listPrimitives();
  if (skin === undefined || skin === null || primitives?.length !== 1) throw new Error('Rig requires one skinned primitive');
  const primitive = primitives[0];
  if (primitive?.getMode() !== 4) throw new Error('Rig requires triangles');
  const geometry = new THREE.BufferGeometry();
  for (const [name, channel] of [['position', 'POSITION'], ['normal', 'NORMAL'], ['uv', 'TEXCOORD_0']] as const) geometry.setAttribute(name, attribute(primitive.getAttribute(channel), channel));
  const array = primitive.getIndices()?.getArray();
  if (array?.length === undefined) throw new Error('Rig requires triangle indices');
  geometry.setIndex(Array.from(array));
  const colourImage = primitive.getMaterial()?.getBaseColorTexture()?.getImage();
  if (colourImage === undefined || colourImage === null) throw new Error('Rig requires embedded colour atlas');
  const bones = skin.listJoints().map(joint => ({ name: joint.getName(), pos: joint.getWorldTranslation() }));
  return { geometry, bones, colourImage: new Uint8Array(colourImage) };
}
