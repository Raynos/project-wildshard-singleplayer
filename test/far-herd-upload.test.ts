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

// pages a herd will need open when its animals spawn (shown with an empty range, so the entry warm-up's draws upload
// them), not one a frame after the region activates; a member then takes a reserved page
test('reserved members open their pages ahead and take them later', () => {
  noteFrameDrawn(performance.now());
  const source = geometry(64, true), material = new MeshBasicMaterial(), herd = new FarHerd(() => material);
  const rigs = Array.from({ length: 17 }, () => { const mesh = new SkinnedMesh(source, material); mesh.bind(new Skeleton([new Bone()])); return { mesh, tint: new Color() }; });
  try {
    for (const rig of rigs) herd.reserve(rig);
    const again = rigs[0]; if (again !== undefined) herd.reserve(again); // counted once
    expect(herd.pageCount()).toBe(2);
    const first = herd.group.children[0]; if (!isSkinnedMesh(first)) throw new Error('Missing page');
    expect(first.visible).toBe(true); expect(first.geometry.drawRange.count).toBe(0);
    herd.begin(null);
    for (const rig of rigs) expect(herd.take(rig, new Vector3(), 1)).toBe(true);
    herd.end();
    expect(herd.pageCount()).toBe(2);
    for (const rig of rigs) herd.unreserve(rig);
    herd.begin(null); herd.end();
    expect(herd.pageCount()).toBe(2); expect(first.visible).toBe(false);
  } finally { herd.dispose(); for (const rig of rigs) rig.mesh.skeleton.dispose(); source.dispose(); material.dispose(); noteFrameDrawn(Number.NEGATIVE_INFINITY); }
});
