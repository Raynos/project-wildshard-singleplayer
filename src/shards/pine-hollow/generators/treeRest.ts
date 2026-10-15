import * as THREE from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { NodeIO, VertexLayout } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

type TreeSetPart = 'trunk' | 'trunkLo' | 'hi' | 'lo' | 'twigs' | 'far';
const PARTS = ['trunk','trunkLo','hi','lo','twigs','far'] as const;
const isMesh = (node: THREE.Object3D): node is THREE.Mesh => node instanceof THREE.Mesh;

function plain(mesh: THREE.Mesh, height: number, part: TreeSetPart): THREE.BufferGeometry {
  mesh.updateWorldMatrix(true, false);
  const src = mesh.geometry;
  const g = new THREE.BufferGeometry();
  const copy = (name: string, size: number): Float32Array | null => {
    const a = src.getAttribute(name) as THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined;
    if (!a) return null;
    const out = new Float32Array(a.count * size);
    for (let i = 0; i < a.count; i++) {
      out[i * size] = a.getX(i);
      if (size > 1) out[i * size + 1] = a.getY(i);
      if (size > 2) out[i * size + 2] = a.itemSize > 2 ? a.getZ(i) : 0;
    }
    return out;
  };
  const need = (name: string, size: number): Float32Array => {
    const a = copy(name, size);
    if (!a) throw new Error(`[trees] ${mesh.name}: no ${name}`);
    return a;
  };
  g.setAttribute('position', new THREE.BufferAttribute(need('position', 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(need('normal', 3), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(need('uv', 2), 2));
  const col = copy('color', 3);
  g.setAttribute('color', new THREE.BufferAttribute(col ?? new Float32Array(src.getAttribute('position').count * 3).fill(1), 3));
  const idx = src.getIndex();
  if (!idx) throw new Error(`[trees] ${mesh.name}: not indexed`);
  g.setIndex(new THREE.BufferAttribute(idx.array.slice(), 1));
  g.applyMatrix4(mesh.matrixWorld);
  const bark = part === 'trunk' || part === 'trunkLo';
  const pos = g.getAttribute('position');
  const wind = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) wind[i] = (pos.getY(i) / height) * (bark ? 0.35 : 1);
  g.setAttribute('aWindWeight', new THREE.BufferAttribute(wind, 1));
  if (bark) {
    const layer = copy('uv1', 1);
    g.setAttribute('aBarkLayer', new THREE.BufferAttribute(layer ?? new Float32Array(pos.count), 1));
  }
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}


/** Final identity-space Float32 channels, with lossless meshopt only: no quantisation/reordering transform. */
export async function bakeTreeRest(bytes: Uint8Array, variants: readonly { name: string; height: number }[]): Promise<Uint8Array> {
  const source = await readSourceModel(bytes), meshes = new Map<string, THREE.Mesh>(), geometry: THREE.BufferGeometry[] = [];
  source.gltf.scene.traverse(node => { if (isMesh(node)) meshes.set(node.name, node); });
  const material = new THREE.MeshStandardMaterial();
  try {
    const primitives = variants.flatMap(variant => PARTS.map(part => {
      const name = `${variant.name}__${part}`, node = meshes.get(name);
      if (node === undefined) throw new Error(`Missing authored tree part ${name}`);
      const g = plain(node, variant.height, part); geometry.push(g);
      const sphere = g.boundingSphere, box = g.boundingBox;
      if (sphere === null || box === null) throw new Error('Missing authored tree bounds');
      return { name, geometry: g, material, compactIndex: true as const,
        customAttributes: { _WIND_WEIGHT: 'aWindWeight', ...(g.hasAttribute('aBarkLayer') ? { _BARK_LAYER: 'aBarkLayer' } : {}) },
        extras: { restGroups: g.groups.map(group => [group.start, group.count, group.materialIndex ?? 0]),
          restSphere: [sphere.center.x,sphere.center.y,sphere.center.z,sphere.radius], restBox: [box.min.x,box.min.y,box.min.z,box.max.x,box.max.y,box.max.z] },
      };
    }));
    await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
    const io = new NodeIO().setVertexLayout(VertexLayout.SEPARATE).registerExtensions([EXTMeshoptCompression])
      .registerDependencies({'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder});
    const document = await io.readBinary(staticGlb(primitives, 'pine-tree-rest'));
    await document.transform(dedup());
    document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method: EXTMeshoptCompression.EncoderMethod.QUANTIZE});
    return await io.writeBinary(document);
  } finally { material.dispose(); for (const g of geometry) g.dispose(); for (const mesh of meshes.values()) mesh.geometry.dispose(); }
}
