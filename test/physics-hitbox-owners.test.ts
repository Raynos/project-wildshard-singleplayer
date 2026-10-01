// E300: the practice dummies' hit volumes share the HITBOX group with the animals'. CreatureBodies.cast must never
// hand a dummy back as an animal (it came back as `creature: undefined`, and the crossbow's aim readout threw on
// `.alive`), and a dummy's colliders are off while its room is closed.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { loadRapier } from '#engine/physics/rapier';
import { Physics } from '#engine/physics/Physics';
import { CreatureBodies, type Creature } from '#engine/physics/creatures';
import { addTrainingTarget, trainingTargetRaycast } from '#engine/physics/trainingTargets';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const rapier = async () => loadRapier(await (await fetch(wasmInline)).arrayBuffer());

function deer(x: number, z: number): Creature {
  const position = new THREE.Vector3(x, 0, z);
  return {
    position, alive: true, hidden: false, scale: 1, motor: null, driven: true,
    dims: { headRadius: 0.2, bodyRadius: 0.35, bodyHalfLen: 0.5, bodyY: 0.9 },
    headWorld: (out) => out.set(position.x, 1.3, position.z + 0.7),
    bodyCapsule: (a, b) => { a.set(position.x, 0.9, position.z - 0.5); b.set(position.x, 0.9, position.z + 0.5); },
  };
}

describe('creature hitboxes vs other HITBOX colliders', () => {
  it('cast() skips a practice dummy and answers with the animal behind it, never an undefined creature', async () => {
    const R = await rapier();
    const physics = new Physics(R);
    const bodies = new CreatureBodies(physics);
    const animal = deer(0, -6);
    const player = new THREE.Vector3(0, 0, 10);
    bodies.sync([animal], player);
    addTrainingTarget(physics, {}, 0, 0, 0); // the dummy stands between the shooter and the animal
    physics.step();
    const origin = new THREE.Vector3(0, 0.9, 4), dir = new THREE.Vector3(0, 0, -1);
    const hit = bodies.cast(origin, dir, 20);
    expect(hit?.creature).toBe(animal);
    expect(hit?.distance).toBeGreaterThan(8);
    // with no animal on the line, the dummy alone is no hit at all
    const miss = bodies.cast(new THREE.Vector3(5, 0.9, 4), dir, 20);
    expect(miss).toBeNull();
    physics.dispose();
  });

  it('a dummy switched off is invisible to shots; switched on, it takes them again', async () => {
    const R = await rapier();
    const physics = new Physics(R);
    const dummy = {};
    const colliders = addTrainingTarget(physics, dummy, 0, 0, 0);
    colliders.setEnabled(false);
    physics.step();
    const origin = { x: 0, y: 0.92, z: 2 }, dir = { x: 0, y: 0, z: -1 };
    expect(trainingTargetRaycast(physics, origin, dir, 4)).toBeNull();
    colliders.setEnabled(true);
    physics.step();
    expect(trainingTargetRaycast(physics, origin, dir, 4)?.target).toBe(dummy);
    physics.dispose();
  });
});
