// oxlint-disable-next-line import/no-nodejs-modules -- Initialize the real Rapier WASM in Node.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { createSimHost, type SimCommand, type SimHost, type SimLevel } from '../../src/engine/sim';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import { groups } from '../../src/engine/physics/groups';
import { Physics } from '../../src/engine/physics/Physics';
import { Bodies } from '../../src/engine/physics/bodies';
import { PLAYER_BODY } from '../../src/engine/physics/CharacterMotor';
import { BARREL_BODY, BARREL_HALF } from '../../src/engine/world/interact/barrel';
import { Player } from '../../src/engine/player/Player';
import type { PlayerCommand } from '../../src/engine/input/commands';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { legacyDouble } from '../fake/FakeGame';
import { SIM_LEVEL } from '../fixtures/sim-level/level';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const restoreTerrain = overrideTerrain({ heightAt: () => -1000 });
afterAll(restoreTerrain);

/** A 60 m slab (top y = 0) and nothing else; the barrel stands upright 3 m north (-z) of the player. */
const FLAT: SimLevel = { ...SIM_LEVEL, id: 'sim-items', entities: [], quests: [], player: { at: { x: 0, y: 0, z: 0 }, yaw: 0, speed: 4 } };
const BARREL_AT = { x: 0, y: BARREL_HALF + 0.01, z: -3 };
const north: SimCommand = { moveX: 0, moveZ: -1, yaw: 0 };
function slab(physics: Physics): void {
  physics.world.createCollider(rapier.ColliderDesc.cuboid(30, 1, 30).setTranslation(0, -1, 0).setCollisionGroups(groups('WORLD')));
}

it('the page\'s Player and the SimHost player share one body law: stopped by WORLD, CREATURE and ITEM, 80 kg on a riding body', () => {
  const host = createSimHost(FLAT, { ground: false, heightAt: () => -1000, rapier });
  const physics = new Physics(rapier);
  const player = new Player(new PerspectiveCamera(), physics, legacyDouble<HTMLCanvasElement>({}), { waterLine: { update: () => undefined, setHint: () => undefined } });
  try {
    const law = (o: { group: string; blockedBy: readonly string[]; weight?: number }): unknown => ({ group: o.group, blockedBy: [...o.blockedBy], weight: o.weight });
    expect(law(host.player.motor.opts)).toEqual(law(player.motor.opts));
    expect(law(host.player.motor.opts)).toEqual({ group: 'PLAYER', blockedBy: ['WORLD', 'CREATURE', 'ITEM'], weight: 80 });
    expect(PLAYER_BODY.blockedBy).toContain('ITEM');
  } finally { player.motor.dispose(); physics.dispose(); host.dispose(); }
});

it('the SimHost player walks into the puzzle barrel and pushes it, as the page\'s Player does on the same world', () => {
  // the host: its player walks north into the barrel for 2 s
  const host: SimHost = createSimHost(FLAT, { ground: false, heightAt: () => -1000, rapier });
  slab(host.physics); host.setFloorQuery(() => undefined);
  const hostBodies = new Bodies(host.physics, host.player.position);
  const hostBarrel = hostBodies.spawn({ ...BARREL_BODY, owner: 'barrel' }, BARREL_AT);
  // the page: the client Player on the same slab and barrel, on the same input
  const physics = new Physics(rapier); slab(physics);
  const player = new Player(new PerspectiveCamera(), physics, legacyDouble<HTMLCanvasElement>({}), { waterLine: { update: () => undefined, setHint: () => undefined } });
  player.spawn(0, 0, 0, 0);
  const pageBodies = new Bodies(physics, player.position), pageBarrel = pageBodies.spawn({ ...BARREL_BODY, owner: 'barrel' }, BARREL_AT);
  const command: PlayerCommand = { moveX: 0, moveY: 1, yaw: 0, pitch: 0, crouch: false, sprint: false, jump: false, dodge: false, dive: false, surface: false,
    aim: { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: -1 } } };
  try {
    for (let tick = 0; tick < 120; tick++) {
      hostBodies.pre(); host.step(north); hostBodies.post(1 / 60);
      pageBodies.pre(); physics.step(); player.step(1 / 60, command); pageBodies.post(1 / 60);
    }
    const hostMoved = BARREL_AT.z - hostBarrel.curr.z, pageMoved = BARREL_AT.z - pageBarrel.curr.z;
    // both capsules stop at the barrel instead of passing through it, and both shove it north
    expect(hostMoved).toBeGreaterThan(1); expect(pageMoved).toBeGreaterThan(1);
    expect(host.player.position.z).toBeGreaterThan(hostBarrel.curr.z);
    expect(player.position.z).toBeGreaterThan(pageBarrel.curr.z);
  } finally { hostBodies.dispose(); pageBodies.dispose(); player.motor.dispose(); physics.dispose(); host.dispose(); }
});
