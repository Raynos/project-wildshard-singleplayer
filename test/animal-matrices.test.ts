// src/entities/animalMatrices.ts (E142 aggro-perf): the animals' group skips a still, far animal's world-matrix pass —
// and every matrix it keeps must be exactly what three's own pass would have computed.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AnimalGroup } from '../src/entities/animalMatrices';

interface Fake { mesh: THREE.Object3D; poseFrozen: boolean; lastHitT: number; bones: THREE.Bone[] }

/** a root with a 3-bone chain, like a rig */
function fake(x: number): Fake {
  const mesh = new THREE.Object3D(), b0 = new THREE.Bone(), b1 = new THREE.Bone(), b2 = new THREE.Bone();
  mesh.add(b0); b0.add(b1); b1.add(b2);
  b0.position.set(0, 1, 0); b1.position.set(0, 0, 0.5); b2.position.set(0, 0.3, 0.2); b1.rotation.set(0.2, 0.1, 0);
  mesh.position.set(x, 0, 2);
  return { mesh, poseFrozen: false, lastHitT: 0, bones: [b0, b1, b2] };
}

/** the world matrices three's plain pass gives the same tree (a clone under a plain Group) */
function reference(a: Fake, parentPos: THREE.Vector3): number[][] {
  const g = new THREE.Group(); g.position.copy(parentPos);
  const clone = a.mesh.clone(true); g.add(clone);
  g.updateMatrixWorld(true);
  const out: number[][] = [];
  clone.traverse((o) => { out.push([...o.matrixWorld.elements]); });
  return out;
}
function actual(a: Fake): number[][] { const out: number[][] = []; a.mesh.traverse((o) => { out.push([...o.matrixWorld.elements]); }); return out; }

describe('AnimalGroup', () => {
  it('skips a frozen, still animal and keeps its matrices exact', () => {
    const g = new AnimalGroup(), a = fake(3);
    g.add(a.mesh); g.own(a);
    g.updateMatrixWorld();
    expect(g.last).toEqual({ skipped: 0, updated: 1 });
    a.poseFrozen = true;
    g.updateMatrixWorld();
    expect(g.last).toEqual({ skipped: 1, updated: 0 });
    expect(actual(a)).toEqual(reference(a, g.position));
  });

  it('updates a frozen animal whose root moved, or scaled', () => {
    const g = new AnimalGroup(), a = fake(0);
    g.add(a.mesh); g.own(a); g.updateMatrixWorld();
    a.poseFrozen = true;
    a.mesh.position.x += 0.25; g.updateMatrixWorld();
    expect(g.last.updated).toBe(1);
    expect(actual(a)).toEqual(reference(a, g.position));
    a.mesh.scale.setScalar(0.8); g.updateMatrixWorld();
    expect(g.last.updated).toBe(1);
    expect(actual(a)).toEqual(reference(a, g.position));
  });

  it('updates a posed animal (bones moved) and one that was hit or had something attached', () => {
    const g = new AnimalGroup(), a = fake(1);
    g.add(a.mesh); g.own(a); g.updateMatrixWorld();
    a.poseFrozen = false; a.bones[1]?.rotation.set(0.6, 0, 0.1); g.updateMatrixWorld();
    expect(g.last.updated).toBe(1);
    expect(actual(a)).toEqual(reference(a, g.position));
    a.poseFrozen = true; a.lastHitT = 5; g.updateMatrixWorld();
    expect(g.last.updated).toBe(1);
    const bolt = new THREE.Object3D(); bolt.position.set(0.1, 0, 0); a.bones[2]?.add(bolt);
    g.updateMatrixWorld();
    expect(g.last.updated).toBe(1);
    expect(actual(a)).toEqual(reference(a, g.position));
    g.updateMatrixWorld();
    expect(g.last.skipped).toBe(1);
    // something hung on the attached thing, then the bolt pulled out: both a full pass
    const tip = new THREE.Object3D(); bolt.add(tip); g.updateMatrixWorld();
    expect(g.last.updated).toBe(1);
    bolt.removeFromParent(); g.updateMatrixWorld();
    expect(g.last.updated).toBe(1);
    g.updateMatrixWorld();
    expect(g.last.skipped).toBe(1);
  });

  it('updates everything when the group itself moves; other children always update', () => {
    const g = new AnimalGroup(), a = fake(2), other = new THREE.Object3D();
    g.add(a.mesh, other); g.own(a); g.updateMatrixWorld();
    a.poseFrozen = true;
    g.position.set(0, 1, 0); other.position.set(4, 0, 0);
    g.updateMatrixWorld();
    expect(g.last.updated).toBe(1);
    expect(actual(a)).toEqual(reference(a, g.position));
    expect(other.matrixWorld.elements[12]).toBe(4);
    expect(other.matrixWorld.elements[13]).toBe(1);
  });
});
