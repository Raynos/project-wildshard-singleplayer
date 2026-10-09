// oxlint-disable-next-line import/no-nodejs-modules -- The canonical physics state restores native worlds.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import { Physics } from '../../src/engine/physics/Physics';
import { physicsDifference, physicsState } from '../fake/simState';

let R: Rapier;
beforeAll(async () => { R = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });

/** a ball resting on two boxes after a second of steps: a dynamic body with contacts and warm-start impulses */
function world(): Physics {
  const physics = new Physics(R), w = physics.world;
  w.createCollider(R.ColliderDesc.cuboid(1, 0.5, 2).setTranslation(-1, -0.5, 0));
  w.createCollider(R.ColliderDesc.cuboid(1, 0.5, 2).setTranslation(1, -0.5, 0));
  const ball = w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0.01, 1, 0));
  w.createCollider(R.ColliderDesc.ball(0.4), ball);
  for (let i = 0; i < 60; i++) physics.step();
  return physics;
}

it('judges a restore by the world the bytes restore to, exactly: the same world is equal, one float32 ULP of a pose is not', () => {
  const live = world(), bytes = live.snapshot(), restored = new Physics(R, bytes);
  try {
    const state = physicsState(bytes);
    expect(state.values.length).toBeGreaterThan(40);
    expect(physicsDifference(physicsState(restored.snapshot()), state)).toBeNull();
    let ball = null as ReturnType<typeof restored.world.getRigidBody> | null;
    restored.world.forEachRigidBody(rb => { ball = rb; });
    if (ball === null) throw new Error('missing the ball');
    const t = ball.translation(), f = new Float32Array([t.x]), bits = new Uint32Array(f.buffer);
    bits[0] = (bits[0] ?? 0) + 1;
    ball.setTranslation({ x: f[0] ?? t.x, y: t.y, z: t.z }, false);
    expect(physicsDifference(physicsState(restored.snapshot()), state)).toMatch(/^rigid body .*: value 4 is /);
  } finally { restored.dispose(); live.dispose(); }
});
