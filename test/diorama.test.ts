// E315 M7: the Set Explorer's diorama (src/explore/diorama.ts) — the cut round an opened set: a circle (a vertical
// cylinder) or a dome. The planes keep what is inside and cut what is outside; a thing wholly outside is left out.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { cutPlanes, dioramaVolume, outside } from '../src/explore/diorama';

const bounds = new THREE.Box3(new THREE.Vector3(-20, 2, -10), new THREE.Vector3(20, 14, 10)); // a 40 × 20 m set, 12 m tall
const flat = (): number => 0;
const kept = (planes: THREE.Plane[], p: THREE.Vector3): boolean => planes.every((pl) => pl.distanceToPoint(p) >= 0);

describe('the diorama cut', () => {
  it('stands on the set\'s ground, a quarter wider than the set, at least 12 m', () => {
    const v = dioramaVolume(bounds, 'circle', flat);
    expect(v.radius).toBeCloseTo(Math.hypot(40, 20) * 0.5 * 1.25, 6);
    expect(v.centre.toArray()).toEqual([0, 2, 0]);
    expect(v.floor).toBeLessThan(0); // under the lowest ground on the rim
    expect(dioramaVolume(new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1)), 'circle', flat).radius).toBe(12);
  });

  it('circle: keeps everything within the radius at any height, cuts what is outside it or under the floor', () => {
    const v = dioramaVolume(bounds, 'circle', flat), planes = cutPlanes(v);
    expect(planes).toHaveLength(33);
    expect(kept(planes, new THREE.Vector3(0, 300, 0))).toBe(true);
    expect(kept(planes, new THREE.Vector3(v.radius * 0.97, 5, 0))).toBe(true);
    expect(kept(planes, new THREE.Vector3(0, 5, -v.radius * 0.97))).toBe(true);
    expect(kept(planes, new THREE.Vector3(v.radius * 1.05, 5, 0))).toBe(false);
    expect(kept(planes, new THREE.Vector3(0, v.floor - 1, 0))).toBe(false);
  });

  it('dome: keeps the set\'s whole box, cuts what rises past the dome', () => {
    const v = dioramaVolume(bounds, 'dome', flat), planes = cutPlanes(v);
    for (let i = 0; i < 8; i++) expect(kept(planes, new THREE.Vector3(i & 1 ? 20 : -20, i & 2 ? 14 : 2, i & 4 ? 10 : -10))).toBe(true);
    expect(kept(planes, new THREE.Vector3(0, 2 + v.dome * 1.05, 0))).toBe(false);
    expect(kept(planes, new THREE.Vector3(v.radius * 0.9, 2 + v.dome * 0.8, 0))).toBe(false); // the shoulder
    expect(kept(planes, new THREE.Vector3(v.radius * 1.05, 3, 0))).toBe(false);
  });

  it('on a stacked shard the circle has a lid just over the set, and the dome is squashed to the set\'s height', () => {
    const c = dioramaVolume(bounds, 'circle', flat, true), d = dioramaVolume(bounds, 'dome', flat, true);
    expect(c.top).toBe(14 + 6);
    expect(cutPlanes(c)).toHaveLength(34);
    expect(kept(cutPlanes(c), new THREE.Vector3(0, 19, 0))).toBe(true);
    expect(kept(cutPlanes(c), new THREE.Vector3(0, 21, 0))).toBe(false);
    expect(outside(new THREE.Sphere(new THREE.Vector3(0, 40, 0), 5), c)).toBe(true); // a tower's upper floors
    expect(d.dome).toBeCloseTo(12 * 1.75, 6);
    expect(dioramaVolume(bounds, 'circle', flat).top).toBe(Infinity);
  });

  it('a thing wholly outside is left out; one crossing the rim or inside stays', () => {
    const c = dioramaVolume(bounds, 'circle', flat), d = dioramaVolume(bounds, 'dome', flat);
    expect(outside(new THREE.Sphere(new THREE.Vector3(c.radius + 10, 0, 0), 5), c)).toBe(true);
    expect(outside(new THREE.Sphere(new THREE.Vector3(c.radius + 3, 0, 0), 5), c)).toBe(false);
    expect(outside(new THREE.Sphere(new THREE.Vector3(0, 500, 0), 5), c)).toBe(false); // the circle is open upward
    expect(outside(new THREE.Sphere(new THREE.Vector3(0, 500, 0), 5), d)).toBe(true);
    expect(outside(new THREE.Sphere(new THREE.Vector3(0, 5, 0), 2), d)).toBe(false);
  });
});
