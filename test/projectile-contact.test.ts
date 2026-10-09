import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { projectileBury, projectileContactTip, projectileDrop, projectileGlance, projectileRest, projectileWithinReach } from '../src/engine/combat/projectileContact';

// Frozen arithmetic from combat/view/projectile.ts. Equality is exact, including grazing and axial contacts.
it('preserves shipping contact, glance, rest and detachment arithmetic', () => {
  const yAxis = new Vector3(0, 1, 0), xAxis = new Vector3(1, 0, 0);
  for (let i = 0; i < 256; i++) {
    const normal = i % 4 === 0 ? yAxis.clone() : new Vector3(Math.sin(i), Math.cos(i), 0.3).normalize();
    const dir = i % 8 === 0 ? normal.clone().negate() : new Vector3(Math.cos(i), -0.5, Math.sin(i)).normalize();
    const point = new Vector3(i / 8, i / 32, -i / 5), radius = 0.02, length = 0.76, bury = 0.09;
    const at = point.clone(), expected = point.clone();
    expected.addScaledVector(dir, radius / Math.max(0.25, -normal.dot(dir)));
    projectileContactTip(at, dir, normal, radius); expect(at.toArray()).toEqual(expected.toArray());
    const velocity = dir.clone().multiplyScalar(i), oldVelocity = velocity.clone();
    expected.addScaledVector(normal, 0.03);
    const vn = oldVelocity.dot(normal);
    oldVelocity.addScaledVector(normal, -vn).multiplyScalar(0.35).addScaledVector(normal, -vn * 0.25);
    if (oldVelocity.length() > 9) oldVelocity.setLength(9);
    projectileGlance(at, velocity, normal, { lift: 0.03, keep: 0.35, bounce: 0.25, maxSpeed: 9 });
    expect(at.toArray()).toEqual(expected.toArray()); expect(velocity.toArray()).toEqual(oldVelocity.toArray());
    const along = new Vector3(), oldAlong = dir.clone().addScaledVector(normal, -dir.dot(normal));
    if (oldAlong.lengthSq() < 1e-6) oldAlong.crossVectors(normal, Math.abs(normal.y) < 0.9 ? yAxis : xAxis);
    oldAlong.normalize(); expected.addScaledVector(normal, -radius * 0.8).addScaledVector(oldAlong, length * 0.5);
    projectileRest(at, dir, normal, radius, length, along, yAxis, xAxis);
    expect(at.toArray()).toEqual(expected.toArray()); expect(along.toArray()).toEqual(oldAlong.toArray());
    const inserted = projectileBury(point, dir, bury * 2.2, new Vector3());
    expect(inserted.toArray()).toEqual(point.clone().addScaledVector(dir, bury * 2.2).toArray());
    const dropped = at.clone(), dropDir = along.clone();
    const oldDropDir = along.clone().set(along.x * 0.35, -1, along.z * 0.35).normalize();
    const oldDropped = at.clone().set(at.x, -3, at.z).addScaledVector(oldDropDir, bury * 1.5);
    projectileDrop(dropped, dropDir, -3, bury);
    expect(dropped.toArray()).toEqual(oldDropped.toArray()); expect(dropDir.toArray()).toEqual(oldDropDir.toArray());
  }
});

it('keeps inclusive pickup boundaries and leaves capacity and survival RNG to the owner', () => {
  const feet = new Vector3(), direction = new Vector3(0, 0, 1), reach = { radius: 1.25, up: 2.1, down: 1.2 };
  for (const x of [0, 1.25, 1.25000001]) for (const y of [-1.20000001, -1.2, 0, 2.1, 2.10000001]) {
    const position = new Vector3(x, y, 0.38);
    expect(projectileWithinReach(position, direction, 0.76, feet, reach)).toBe(!(Math.hypot(x, 0) > 1.25 || y > 2.1 || y < -1.2));
    expect(position.toArray()).toEqual([x, y, 0.38]);
  }
});
