// E315 M7: the Set Explorer's diorama (src/engine/explore/diorama.ts) — the cut round an opened set: a circle, a vertical cylinder
// (Jake's pick, A; the dome and the whole world are gone). The planes keep what is inside and cut what is outside; a thing
// wholly outside is left out.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { cutPlanes, dioramaVolume, outside } from '../src/engine/explore/diorama';

const bounds = new THREE.Box3(new THREE.Vector3(-20, 2, -10), new THREE.Vector3(20, 14, 10)); // a 40 × 20 m set, 12 m tall
const flat = (): number => 0;
const kept = (planes: THREE.Plane[], p: THREE.Vector3): boolean => planes.every((pl) => pl.distanceToPoint(p) >= 0);

describe('the diorama cut', () => {
  it('stands on the set\'s ground, a quarter wider than the set, at least 12 m', () => {
    const v = dioramaVolume(bounds, flat);
    expect(v.radius).toBeCloseTo(Math.hypot(40, 20) * 0.5 * 1.25, 6);
    expect(v.centre.toArray()).toEqual([0, 2, 0]);
    expect(v.floor).toBeLessThan(0); // under the lowest ground on the rim
    expect(dioramaVolume(new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1)), flat).radius).toBe(12);
  });

  it('keeps everything within the radius at any height, cuts what is outside it or under the floor', () => {
    const v = dioramaVolume(bounds, flat), planes = cutPlanes(v);
    expect(planes).toHaveLength(33);
    expect(kept(planes, new THREE.Vector3(0, 300, 0))).toBe(true);
    expect(kept(planes, new THREE.Vector3(v.radius * 0.97, 5, 0))).toBe(true);
    expect(kept(planes, new THREE.Vector3(0, 5, -v.radius * 0.97))).toBe(true);
    expect(kept(planes, new THREE.Vector3(v.radius * 1.05, 5, 0))).toBe(false);
    expect(kept(planes, new THREE.Vector3(0, v.floor - 1, 0))).toBe(false);
  });

  it('keeps the set\'s whole box', () => {
    const planes = cutPlanes(dioramaVolume(bounds, flat));
    for (let i = 0; i < 8; i++) expect(kept(planes, new THREE.Vector3(i & 1 ? 20 : -20, i & 2 ? 14 : 2, i & 4 ? 10 : -10))).toBe(true);
  });

  it('on a stacked shard the circle has a lid just over the set', () => {
    const c = dioramaVolume(bounds, flat, true);
    expect(c.top).toBe(14 + 6);
    expect(cutPlanes(c)).toHaveLength(34);
    expect(kept(cutPlanes(c), new THREE.Vector3(0, 19, 0))).toBe(true);
    expect(kept(cutPlanes(c), new THREE.Vector3(0, 21, 0))).toBe(false);
    expect(outside(new THREE.Sphere(new THREE.Vector3(0, 40, 0), 5), c)).toBe(true); // a tower's upper floors
    expect(dioramaVolume(bounds, flat).top).toBe(Infinity);
  });

  it('a thing wholly outside is left out; one crossing the rim or inside stays', () => {
    const c = dioramaVolume(bounds, flat);
    expect(outside(new THREE.Sphere(new THREE.Vector3(c.radius + 10, 0, 0), 5), c)).toBe(true);
    expect(outside(new THREE.Sphere(new THREE.Vector3(c.radius + 3, 0, 0), 5), c)).toBe(false);
    expect(outside(new THREE.Sphere(new THREE.Vector3(0, 500, 0), 5), c)).toBe(false); // the circle is open upward
    expect(outside(new THREE.Sphere(new THREE.Vector3(0, 5, 0), 2), c)).toBe(false);
  });
});
