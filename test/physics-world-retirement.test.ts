// oxlint-disable-next-line import/no-nodejs-modules -- The lifetime witness uses the production native engine.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { withOwner } from '../src/engine/app/ownership';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier } from '../src/engine/physics/rapier';

it.each(['world-first', 'scope-first'])('retires one native world without leaving callbacks into freed handles (%s)', async order => {
  const R = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const page = new Scope('page'), retired = page.child('retired'), surviving = page.child('surviving');
  const a = new Physics(R), b = new Physics(R);
  const handles = (physics: Physics, scope: Scope) => withOwner(scope, () => {
    const body = physics.world.createRigidBody(R.RigidBodyDesc.fixed());
    const attached = physics.world.createCollider(R.ColliderDesc.ball(1), body);
    const detached = physics.world.createCollider(R.ColliderDesc.ball(1));
    return { body, attached, detached };
  });
  handles(a, retired); const kept = handles(b, surviving);
  expect(page.census.bodies).toBe(2); expect(page.census.colliders).toBe(4);
  if (order === 'scope-first') retired.dispose();
  a.dispose();
  // Whole-world retirement owns every native allocation, even when an allocation scope outlives it.
  expect(retired.census.bodies).toBe(0); expect(retired.census.colliders).toBe(0);
  expect(a.scopedCensus(page)).toEqual({ bodies: 0, colliders: 0 });
  expect(b.scopedCensus(page)).toEqual({ bodies: 1, colliders: 2 });
  expect(kept.body.isValid()).toBe(true); expect(kept.attached.isValid()).toBe(true); expect(kept.detached.isValid()).toBe(true);
  expect(() => page.dispose()).not.toThrow();
  expect(b.world.bodies.len()).toBe(0); expect(b.world.colliders.len()).toBe(0);
  expect(page.census.bodies).toBe(0); expect(page.census.colliders).toBe(0);
  b.dispose();
});
