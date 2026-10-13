/** The real crag-face skin shapes, in their native world coordinates and view profiles, through one author Scene. */
import * as THREE from 'three';
import { bake, BakedPiece, type BakedScene } from '@wildshard/sdk/bake';
import type { SkinBake } from './crags';
import type { CragTier } from './cragRows';

function skinGeometry(position: Float32Array, ao: Float32Array, index: Uint16Array): THREE.BufferGeometry {
  const count = ao.length, cd = new Float32Array(count * 4), ct = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) { cd[i * 4] = ao[i] ?? 0; cd[i * 4 + 1] = 1; cd[i * 4 + 3] = 1; ct[i * 2 + 1] = 1; }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('cdata', new THREE.BufferAttribute(cd, 4));
  geometry.setAttribute('ctint', new THREE.BufferAttribute(ct, 2));
  geometry.setIndex(new THREE.BufferAttribute(index, 1)); geometry.computeVertexNormals();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
}

/** Decode the retained raw attribute oracle, retaining both resolution channels without merging or resampling. */
export function pineCragScene(skin: Record<CragTier, SkinBake>): THREE.Scene {
  const scene = new THREE.Scene(); scene.name = 'pine-hollow.crag-skins';
  for (const tier of ['phone', 'desktop'] as const) {
    const data = skin[tier]; let offset = 0;
    const geometry = (vertices: number, indices: number): THREE.BufferGeometry => {
      const position = new Float32Array(data.bin.buffer, data.bin.byteOffset + offset, vertices * 3).slice(); offset += vertices * 12;
      const ao = new Float32Array(data.bin.buffer, data.bin.byteOffset + offset, vertices).slice(); offset += vertices * 4;
      const index = new Uint16Array(data.bin.buffer, data.bin.byteOffset + offset, indices).slice(); offset += Math.ceil(indices * 2 / 4) * 4;
      return skinGeometry(position, ao, index);
    };
    for (const [i, [v0, i0, v1, i1]] of data.tiles.entries()) {
      const meshes = [geometry(v0, i0), geometry(v1, i1)].map((shape, resolution) => {
        const material = new THREE.MeshStandardMaterial({ roughness: 1 });
        const mesh = new THREE.InstancedMesh(shape, material, 1); mesh.setMatrixAt(0, new THREE.Matrix4());
        return [`${tier}-skin-${i}-${resolution === 0 ? 'near' : 'far'}`, mesh] as const;
      });
      scene.add(new BakedPiece(`pine-crag-${tier}-${i}`, meshes, [], { nativeAttributes: true, compactIndex: true }));
    }
    if (offset !== data.bin.byteLength) throw new Error('Pine crag Scene must consume every source byte');
  }
  return scene;
}

/** Compile retained native shapes, not a fake world placement or a different renderer/material. */
export function pineCragBake(skin: Record<CragTier, SkinBake>, project?: string): BakedScene {
  const scene = pineCragScene(skin);
  try { return bake(scene, { slug: 'pine-hollow', name: 'Pine Hollow' }, project === undefined ? {} : { project }); }
  finally {
    scene.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      const geometry: unknown = node.geometry, material: unknown = node.material;
      if (geometry instanceof THREE.BufferGeometry) geometry.dispose();
      if (material instanceof THREE.Material) material.dispose();
    });
  }
}
