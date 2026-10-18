import { expect, test } from 'vitest';
import { Bone, BufferAttribute, BufferGeometry, Color, Float32BufferAttribute, MeshBasicMaterial, Skeleton, SkinnedMesh, Vector3, type Object3D } from 'three';
import { FarHerd, type FarMember } from '../src/engine/entities/farHerd';
import { noteFrameDrawn, setFramePacing } from '../src/engine/core/framePacing';
import { isDev, setDev } from '../src/engine/core/devMode';
import { overrideSetting } from '../src/engine/ui/Settings';

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

test.each([false, true])('bounded pages retain deferred rigs, skinning, tint and packing (indexed %s)', indexed => {
  const developer = isDev(); setDev(true); overrideSetting('buildPacing', 'links'); setFramePacing(true);
  const source = geometry(5000, indexed), material = new MeshBasicMaterial();
  const members: FarMember[] = Array.from({ length: 5 }, (_, index) => {
    const mesh = new SkinnedMesh(source, material), bone = new Bone(); bone.position.x = index; bone.updateMatrixWorld(true);
    mesh.bind(new Skeleton([bone]));
    return { mesh, tint: new Color(0.2 + index / 10, 0.5, 0.8) };
  });
  try { for (const shadow of [false, true]) {
    const herd = new FarHerd(() => material, { shadow });
    const slots = shadow ? 3 : 2, position = new Vector3();
    const page = (at: number): SkinnedMesh => {
      const result = herd.group.children[at]; if (!isSkinnedMesh(result)) throw new Error('Missing herd page'); return result;
    };
    const frame = (live: readonly FarMember[], stalled = false): boolean[] => {
      noteFrameDrawn(stalled ? performance.now() - 300 : undefined); herd.begin(null); const taken = live.map(member => herd.take(member, position, 1)); herd.end(); return taken;
    };
    try {
      expect(frame(members)).toEqual(members.map((_, i) => i < slots));
      expect(herd.pageCount()).toBe(1);
      const first = page(0), destination = first.geometry;
      expect(destination.getAttribute('position').count).toBe(slots * 5000);
      expect(destination.getAttribute('skinIndex').array).toBeInstanceOf(Uint16Array);
      expect(destination.index?.array).toBeInstanceOf(Uint32Array);
      const bytes = Object.values(destination.attributes).reduce((sum, a) => sum + a.array.byteLength, destination.index?.array.byteLength ?? 0);
      expect(bytes).toBeLessThanOrEqual(1024 * 1024);
      // The construction cadence can expire after a long native call. Existing bounded pages must never grow.
      expect(frame(members, true)).toEqual(members.map((_, i) => i < slots * 2)); expect(herd.pageCount()).toBe(2);
      expect(frame(members)).toEqual(members.map(() => true));
      expect(herd.pageCount()).toBe(Math.ceil(members.length / slots));
      for (const member of members.slice(0, slots)) expect(first.skeleton.bones).toContain(member.mesh.skeleton.bones[0]);
      const remaining = members.slice(1); frame(remaining);
      expect(first.geometry.drawRange.count).toBe((slots - 1) * 5000);
      const packed = members[slots - 1]; if (packed === undefined) throw new Error('Missing member');
      expect(first.skeleton.bones[0]).toBe(packed.mesh.skeleton.bones[0]);
      if (!shadow) {
        packed.tint.setRGB(0.9, 0.1, 0.3); frame(remaining);
        const colors = first.geometry.getAttribute('color');
        expect(colors.array).toBeInstanceOf(Float32Array);
        expect(colors.getX(0)).toBeCloseTo(0.9); expect(colors.getY(0)).toBeCloseTo(0.1); expect(colors.getZ(0)).toBeCloseTo(0.3);
      } else expect(first.geometry.hasAttribute('color')).toBe(false);
    } finally { herd.dispose(); }
  }
  } finally {
  for (const member of members) member.mesh.skeleton.dispose();
  source.dispose(); material.dispose(); setFramePacing(false); overrideSetting('buildPacing', null); setDev(developer);
  }
});

test.each([['links', true, 20000, 1], ['links', true, 3, 16], ['on', true, 5000, 16], ['links', false, 5000, 8]] as const)(
  '%s pacing=%s retains capacity for %s vertices', (mode, paced, verts, slots) => {
    const developer = isDev(); setDev(true); overrideSetting('buildPacing', mode); setFramePacing(paced); noteFrameDrawn();
    const source = geometry(verts, false), material = new MeshBasicMaterial(), mesh = new SkinnedMesh(source, material);
    mesh.bind(new Skeleton([new Bone()])); const herd = new FarHerd(() => material);
    try {
      herd.begin(null); expect(herd.take({ mesh, tint: new Color() }, new Vector3(), 1)).toBe(true); herd.end();
      const page = herd.group.children[0]; if (!isSkinnedMesh(page)) throw new Error('Missing page');
      expect(page.geometry.getAttribute('position').count).toBe(verts * slots);
    } finally { herd.dispose(); mesh.skeleton.dispose(); source.dispose(); material.dispose(); setFramePacing(false); overrideSetting('buildPacing', null); setDev(developer); }
  });
