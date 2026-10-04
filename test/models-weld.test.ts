// E347: place()'s weld (src/engine/models/weld.ts), the merge across several models Pine Hollow's homestead is drawn with — a
// unit merged per material, band and key with its depth proxied per band, the always-drawn meshes welded across the
// copies (one batch, a view per copy), the bands culled by distance and the hosted copies following their unit (WeldCull).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { UnitParts, WeldBatch, WeldView, nearProxy, weldAcross, type WeldPart } from '#engine-internal/models/weld';
import { WeldCull } from '#engine-internal/models/cull';
import { SHADOW_LAYER } from '#engine-internal/core/shadowLayer';

const box = (x: number): THREE.BufferGeometry => new THREE.BoxGeometry(1, 1, 1).translate(x, 0, 0).toNonIndexed();
const count = (m: THREE.Mesh): number => m.geometry.getAttribute('position').count;

describe('welds (E347)', () => {
  it('a unit merges per material, band and key, then proxies its depth per band, the always-drawn set first', () => {
    const log = new THREE.MeshStandardMaterial(), iron = new THREE.MeshStandardMaterial(), glass = new THREE.MeshStandardMaterial();
    const parts: WeldPart[] = [
      { material: log, geometries: [box(0), box(1)], depth: 'proxy', receiveShadow: true },
      { material: iron, geometries: [box(2)], until: 70, depth: 'near', receiveShadow: true },
      { material: log, geometries: [box(3)], until: 140, depth: 'proxy' },
      { material: glass, geometries: [box(4)], until: 70, key: 'a', renderOrder: 2 },
      { material: glass, geometries: [box(5)], until: 70, key: 'b', renderOrder: 2 },
      { material: log, geometries: [box(6)], depth: 'proxy' },
    ];
    const unit = new UnitParts();
    unit.add(parts);
    const root = new THREE.Group();
    const d = unit.draw(root, false);
    const name = (m: THREE.Material): string => (m === log ? 'log' : m === iron ? 'iron' : 'glass');
    expect(d.meshes.map(({ mesh, part }) => [name(part.material), part.until ?? '-', count(mesh)])).toEqual([['log', '-', 108], ['iron', 70, 36], ['log', 140, 36], ['glass', 70, 36], ['glass', 70, 36]]);
    expect(d.meshes.map(({ mesh }) => mesh.receiveShadow)).toEqual([true, true, false, false, false]);
    expect(d.meshes[3]?.mesh.renderOrder).toBe(2);
    expect(d.proxies.map((p) => p.until)).toEqual([undefined, 140]);
    expect(d.proxies.map((p) => count(p.mesh))).toEqual([108, 36]);
    expect(d.proxies.every((p) => p.mesh.castShadow && p.mesh.layers.mask === 1 << SHADOW_LAYER)).toBe(true);
    expect(d.front).toHaveLength(3); // the two log sets and the iron: the glass has no depth
    expect(root.children).toHaveLength(7);
    // the near proxy: every part's depth and the copy's dressing, one draw
    const dressing = new THREE.BoxGeometry(1, 1, 1);
    expect(nearProxy(d.front, [])?.geometry.getAttribute('position').count).toBe(108 + 36 + 36);
    expect(nearProxy([], [dressing])?.geometry.index?.count).toBe(36);
    // with a near proxy the band proxies cast only past it (the caller tags them)
    const u2 = new UnitParts();
    u2.add(parts);
    expect(u2.draw(new THREE.Group(), true).proxies.every((p) => !p.mesh.castShadow)).toBe(true);
  });

  it("a 'whole' unit takes each copy's parts in its own frame", () => {
    const mat = new THREE.MeshStandardMaterial();
    const unitRoot = new THREE.Group(); unitRoot.position.set(10, 0, 0); unitRoot.updateMatrix();
    const copy = new THREE.Group(); copy.position.set(12, 0, 3); copy.rotation.y = 0.5; copy.updateMatrix();
    const g = box(0), expected = g.clone().applyMatrix4(copy.matrix).applyMatrix4(unitRoot.matrix.clone().invert());
    const unit = new UnitParts();
    unit.add([{ material: mat, geometries: [g] }], new THREE.Matrix4().copy(unitRoot.matrix).invert().multiply(copy.matrix));
    const d = unit.draw(unitRoot, false);
    const a = d.meshes[0]?.mesh.geometry.getAttribute('position'), b = expected.getAttribute('position');
    expect(a?.count).toBe(b.count);
    for (let i = 0; i < b.count; i++) expect(a?.getX(i)).toBeCloseTo(b.getX(i), 5);
  });

  it('the always-drawn meshes weld across the copies into one batch, each copy keeping a view of its share', () => {
    const mat = new THREE.MeshStandardMaterial(), other = new THREE.MeshStandardMaterial(), parent = new THREE.Group();
    const copies = [0, 1].map((i) => {
      const root = new THREE.Group();
      root.position.set(i * 10, 0, 0); root.rotation.y = i; root.updateMatrix();
      parent.add(root);
      const mesh = new THREE.Mesh(box(0), mat);
      mesh.receiveShadow = true;
      const lone = new THREE.Mesh(box(1), other);
      root.add(mesh, lone);
      return { root, meshes: i === 0 ? [mesh, lone] : [mesh] };
    });
    const before = copies.map((c) => { const m = c.root.children[0] as THREE.Mesh; return m.geometry.getAttribute('position').clone().applyMatrix4(c.root.matrix); });
    weldAcross(copies, parent);
    const batches = parent.children.filter((c): c is WeldBatch => c instanceof WeldBatch);
    expect(batches).toHaveLength(1); // the material only one copy draws stays its own mesh
    const batch = batches[0];
    expect(batch?.receiveShadow).toBe(true);
    expect(batch?.geometry.getAttribute('position').count).toBe(72);
    copies.forEach((c, i) => {
      const view = c.root.children.find((x) => x instanceof WeldView);
      expect(view).toBeInstanceOf(WeldView);
      // its share is the batch's own buffer, in the parent's frame: where the copy's mesh stood
      const pos = (view as WeldView).geometry.getAttribute('position'), was = before[i];
      expect(pos.count).toBe(36);
      for (let k = 0; k < pos.count; k++) expect(pos.getX(k)).toBeCloseTo(was?.getX(k) ?? Number.NaN, 5);
      expect(pos.array.buffer).toBe(batch?.geometry.getAttribute('position').array.buffer);
    });
  });

  it('bands: an object shows within its reach of its origin, a swap caster casts only past it, hosted copies follow their unit', () => {
    const near = new THREE.Object3D(), far = new THREE.Object3D(), swap = new THREE.Object3D();
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 3);
    const cull = new WeldCull([near, far, swap], Float64Array.from([70 * 70, 140 * 140, 70 * 70]), Uint8Array.from([0, 0, 1]), Uint32Array.from([0, 0, 0]),
      Float64Array.from([0, 0, 0, 500, 0, 0]), Uint32Array.from([0, 1]), Float64Array.from([70 * 70, 70 * 70]));
    const mats = (...xs: number[]): Float32Array => { const out = new Float32Array(xs.length * 16); xs.forEach((x, i) => { new THREE.Matrix4().makeTranslation(x, 0, 0).toArray(out, i * 16); }); return out; };
    cull.host({ meshes: [im], lists: [{ unit: 0, matrices: mats(1, 2) }, { unit: 1, matrices: mats(501) }] });
    const cam = new THREE.PerspectiveCamera();
    const at = (x: number): void => { cam.position.set(x, 0, 0); cam.updateMatrixWorld(); cull.update(cam); };
    at(50);
    expect([near.visible, far.visible, swap.castShadow, im.count, im.visible]).toEqual([true, true, false, 2, true]);
    at(100);
    expect([near.visible, far.visible, swap.castShadow, im.count, im.visible]).toEqual([false, true, true, 0, false]);
    at(460);
    expect([near.visible, far.visible, swap.castShadow, im.count]).toEqual([false, false, true, 1]);
    const m = new THREE.Matrix4();
    im.getMatrixAt(0, m);
    expect(m.elements[12]).toBe(501);
    at(10);
    expect(im.count).toBe(2);
  });
});
