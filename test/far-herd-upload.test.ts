import { expect, test } from 'vitest';
import { Bone, BufferAttribute, BufferGeometry, Color, Float32BufferAttribute, MeshBasicMaterial, Skeleton, SkinnedMesh, Vector3, type Object3D } from 'three';
import { FarHerd } from '../src/engine/entities/farHerd';
import { noteFrameDrawn } from '../src/engine/core/framePacing';

function isSkinnedMesh(object: Object3D | undefined): object is SkinnedMesh { return object instanceof SkinnedMesh; }

function geometry(verts: number, indexed: boolean): BufferGeometry {
  const source = new BufferGeometry();
  for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2], ['skinWeight', 4]] as const) {
    source.setAttribute(name, new Float32BufferAttribute(new Float32Array(verts * size), size));
  }
  source.setAttribute('skinIndex', new BufferAttribute(new Uint8Array(verts * 4), 4));
  source.setAttribute('color', new BufferAttribute(new Uint8Array(verts * 4).fill(255), 4, true));
  if (indexed) source.setIndex(new BufferAttribute(new Uint16Array(verts), 1));
  return source;
}

test.each([[true, 5000, 16], [false, 5000, 8]] as const)(
  'presenting=%s retains capacity for %s vertices', (paced, verts, slots) => {
    noteFrameDrawn(paced ? performance.now() : Number.NEGATIVE_INFINITY);
    const source = geometry(verts, false), material = new MeshBasicMaterial(), mesh = new SkinnedMesh(source, material);
    mesh.bind(new Skeleton([new Bone()])); const herd = new FarHerd(() => material);
    try {
      herd.begin(null); expect(herd.take({ mesh, tint: new Color() }, new Vector3(), 1)).toBe(true); herd.end();
      const page = herd.group.children[0]; if (!isSkinnedMesh(page)) throw new Error('Missing page');
      expect(page.geometry.getAttribute('position').count).toBe(verts * slots);
    } finally { herd.dispose(); mesh.skeleton.dispose(); source.dispose(); material.dispose(); noteFrameDrawn(Number.NEGATIVE_INFINITY); }
  });
