// E314: worn cosmetics (src/player/Cosmetics.ts). Wearing in shadow mode swaps the meshes' materials for a shadow-only
// one; taking the thing off must give it back exactly as it came (materials, shadow flags, pose, parent), so a hat can go
// on and off from the Bag any number of times.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { WEAR_SOCKET, Wardrobe } from '../src/player/Cosmetics';
import { SHADOW_LAYER } from '../src/core/shadowLayer';

function hat(): { root: THREE.Group; brim: THREE.Mesh; crown: THREE.Mesh; brimMat: THREE.Material; crownMat: THREE.Material } {
  const brimMat = new THREE.MeshStandardMaterial(), crownMat = new THREE.MeshStandardMaterial();
  const brim = new THREE.Mesh(new THREE.BoxGeometry(), brimMat), crown = new THREE.Mesh(new THREE.BoxGeometry(), crownMat);
  brim.castShadow = false; brim.receiveShadow = true;
  crown.castShadow = true; crown.receiveShadow = true;
  const root = new THREE.Group();
  root.add(brim, crown);
  root.position.set(3, 0, -2);
  return { root, brim, crown, brimMat, crownMat };
}

describe('Wardrobe', () => {
  it('shadow mode: worn meshes draw shadow only, and come off with their own materials and flags back', () => {
    const w = new Wardrobe('shadow');
    const h = hat();
    const pickup = new THREE.Group();
    pickup.add(h.root);
    expect(w.wear('hat', h.root)).toBeNull();
    expect(w.wearing('hat')).toBe(h.root);
    expect(h.root.parent).toBe(w.root);
    expect(h.root.position.toArray()).toEqual([0, WEAR_SOCKET.hat.y, WEAR_SOCKET.hat.z]);
    for (const m of [h.brim, h.crown]) {
      expect(m.material).not.toBe(h.brimMat);
      expect(m.material).not.toBe(h.crownMat);
      expect((m.material as THREE.Material).colorWrite).toBe(false);
      expect(m.castShadow).toBe(true);
      expect(m.receiveShadow).toBe(false);
      expect(m.layers.mask).toBe(1 << SHADOW_LAYER); // the shadow pass only: no empty draw in the view
    }
    expect(w.wear('hat', null)).toBe(h.root);
    expect(w.wearing('hat')).toBeNull();
    expect(h.brim.material).toBe(h.brimMat);
    expect(h.crown.material).toBe(h.crownMat);
    expect([h.brim.castShadow, h.brim.receiveShadow, h.crown.castShadow, h.crown.receiveShadow]).toEqual([false, true, true, true]);
    expect([h.brim.layers.mask, h.crown.layers.mask]).toEqual([1, 1]);
    expect(h.root.position.toArray()).toEqual([3, 0, -2]);
    expect(h.root.parent).toBe(pickup);
    expect(w.root.children).toHaveLength(0);
  });

  it('on, off, on again is symmetric; swapping a slot restores what came off', () => {
    const w = new Wardrobe();
    const a = hat(), b = hat();
    w.wear('hat', a.root); w.wear('hat', null); w.wear('hat', a.root);
    expect(w.wear('hat', b.root)).toBe(a.root);
    expect(a.brim.material).toBe(a.brimMat);
    expect(b.brim.material).not.toBe(b.brimMat);
    expect(w.root.children).toEqual([b.root]);
    w.wear('hat', null);
    expect(b.brim.material).toBe(b.brimMat);
  });

  it('one object sits in one slot; visible mode leaves materials alone', () => {
    const w = new Wardrobe('visible');
    const c = hat();
    w.wear('cape', c.root);
    expect(c.brim.material).toBe(c.brimMat);
    expect(c.root.position.y).toBe(WEAR_SOCKET.cape.y);
    w.wear('hat', c.root);
    expect(w.wearing('cape')).toBeNull();
    expect(w.wearing('hat')).toBe(c.root);
    expect(w.root.children).toEqual([c.root]);
  });

  it('follow poses the root at the feet, the models facing the way the player looks', () => {
    const w = new Wardrobe();
    w.follow(1, 2, 3, 0);
    expect(w.root.position.toArray()).toEqual([1, 2, 3]);
    w.root.updateMatrixWorld(true);
    const front = new THREE.Vector3(0, 0, 1).transformDirection(w.root.matrixWorld);
    expect(front.z).toBeCloseTo(-1); // Player yaw 0 looks toward −z
  });
});
