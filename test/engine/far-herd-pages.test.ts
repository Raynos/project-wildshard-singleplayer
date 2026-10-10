import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FarHerd, PAGE_SLOTS, type FarMember } from '../../src/engine/entities/farHerd';
import { noteFrameDrawn, setFramePacing } from '@wildshard/engine/core/framePacing';

// op-hitch47 (E435 frame floor): a paced herd fills fixed pages, opening at most one a drawn frame; unpaced, one batch grows.
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array([0.2, 0.4, 0.6, 0.8, 1, 0.5, 0.3, 0.7, 0.9]), 3));
geometry.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(12), 4));
geometry.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(12), 4));
const material = new THREE.MeshBasicMaterial();

let tints = 0;
function member(): FarMember {
  const bone = new THREE.Bone();
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.add(bone); mesh.bind(new THREE.Skeleton([bone]), new THREE.Matrix4());
  tints++;
  return { mesh, tint: new THREE.Color((tints % 7) / 7, (tints % 5) / 5, (tints % 3) / 3) };
}

const isSkinned = (o: THREE.Object3D): o is THREE.SkinnedMesh => o instanceof THREE.SkinnedMesh;

/** what each member is drawn with: its slot's bone (its rig's own) and its slot's three vertex colours, from every page */
function drawn(herd: FarHerd, members: readonly FarMember[]): string[] {
  const out: string[] = [], pages: THREE.SkinnedMesh[] = [];
  herd.group.traverse((o) => { if (isSkinned(o)) pages.push(o); });
  for (const m of members) {
    const bone = m.mesh.skeleton.bones[0];
    const hits: string[] = [];
    for (const mesh of pages) {
      if (!mesh.visible) continue;
      const count = (mesh.geometry.drawRange.count === Infinity ? 0 : mesh.geometry.drawRange.count) / 3;
      const colour = mesh.geometry.getAttribute('color');
      for (let s = 0; s < count; s++) if (mesh.skeleton.bones[s] === bone) hits.push(Array.from({ length: 9 }, (_, i) => colour.getComponent(s * 3 + Math.floor(i / 3), i % 3).toFixed(5)).join(','));
    }
    out.push(hits.join('|'));
  }
  return out;
}

const at = new THREE.Vector3();
/** one frame: every member offered, the herd flushed; how many it took */
function frame(herd: FarHerd, members: readonly FarMember[]): number {
  herd.begin(null);
  let taken = 0;
  for (const m of members) if (herd.take(m, at, 1)) taken++;
  herd.end();
  return taken;
}

afterEach(() => { setFramePacing(false); });

describe('FarHerd pages', () => {
  it('unpaced: one batch takes every member in its first frame', () => {
    setFramePacing(false);
    const herd = new FarHerd(() => material);
    const members = Array.from({ length: 40 }, member);
    expect(frame(herd, members)).toBe(40);
    expect(herd.pageCount()).toBe(1);
  });
  it('paced: a page a frame, the rest draw their own rigs until a page has room, and a held member keeps its page', () => {
    setFramePacing(true);
    const herd = new FarHerd(() => material);
    const members = Array.from({ length: PAGE_SLOTS * 2 + 3 }, member);
    noteFrameDrawn();
    expect(frame(herd, members)).toBe(PAGE_SLOTS);
    expect(herd.pageCount()).toBe(1);
    noteFrameDrawn();
    expect(frame(herd, members)).toBe(PAGE_SLOTS * 2);
    noteFrameDrawn();
    expect(frame(herd, members)).toBe(members.length);
    expect(herd.pageCount()).toBe(3);
    // members leave and come back: freed slots are reused before any new page opens
    noteFrameDrawn();
    expect(frame(herd, members.slice(0, PAGE_SLOTS))).toBe(PAGE_SLOTS);
    noteFrameDrawn();
    expect(frame(herd, members)).toBe(members.length);
    expect(herd.pageCount()).toBe(3);
  });
  it('paced or not, once grown every member is drawn exactly once, with its own bones and its own tinted colours', () => {
    const members = Array.from({ length: PAGE_SLOTS * 2 + 3 }, member);
    setFramePacing(false);
    const whole = new FarHerd(() => material);
    frame(whole, members);
    setFramePacing(true);
    const paged = new FarHerd(() => material);
    for (let i = 0; i < 3; i++) { noteFrameDrawn(); frame(paged, members); }
    const expected = drawn(whole, members);
    expect(expected.every((row) => row !== '' && !row.includes('|'))).toBe(true);
    expect(drawn(paged, members)).toEqual(expected);
  });
});
