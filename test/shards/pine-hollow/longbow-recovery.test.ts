// oxlint-disable-next-line import/no-nodejs-modules -- This native fixture loads the committed Rapier binary.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost, type SimLevel } from '../../../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { groups } from '../../../src/engine/physics/groups';
import { tagCollider, type Material } from '../../../src/engine/physics/surface';
import { installPineLongbow } from '../../../src/shards/pine-hollow/runtime/weapons/headlessLongbow';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';
import { SIM_LEVEL } from '../../fixtures/sim-level/level';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const level: SimLevel = { ...SIM_LEVEL, ground: { size: 500, height: 0 }, entities: [], quests: [] };

it.each<{ material: Material | undefined; sticks: boolean }>([
  { material: undefined, sticks: true }, { material: 'wood', sticks: true },
  { material: 'stone', sticks: false }, { material: 'rock', sticks: false }, { material: 'metal', sticks: false },
])('uses actual $material world contact provenance for a real loose', ({ material, sticks }) => {
  let held = true;
  const host = createSimHost(level, { rapier });
  const bow = installPineLongbow(host, { heavy: () => held ? {} : null, enabled: () => true, bodies: () => [] });
  try {
    const wall = host.physics.world.createCollider(host.physics.R.ColliderDesc.cuboid(4, 2, 0.1)
      .setTranslation(0, 2, -4).setCollisionGroups(groups('WORLD')));
    if (material !== undefined) tagCollider(wall, material);
    for (let tick = 0; tick < 50; tick++) host.step();
    held = false;
    for (let tick = 0; tick < 6; tick++) host.step();
    expect(bow.state.arrows).toBe(19);
    expect([bow.flying(), bow.stuck.count]).toEqual(sticks ? [0, 1] : [1, 0]);
    for (let tick = 0; tick < 180; tick++) host.step();
    const shaft = bow.stuck.snapshot().stuck[0];
    if (shaft === undefined) throw new Error('The real loose did not stop after its world contact');
    expect(bow.flying()).toBe(0);
    if (sticks) expect(shaft.position[2]).toBeLessThan(-3.8);
    else expect(shaft.position[2]).toBeGreaterThan(-3.8);
  } finally { host.dispose(); }
});

it('lands a real native loose, saves its stopped shaft, and walks into the same pickup on an exact restored suffix', () => {
  let held = true;
  const install = (host: SimHost): ReturnType<typeof installPineLongbow> => installPineLongbow(host, {
    heavy: () => held ? {} : null, enabled: () => true, bodies: () => [],
  });
  const original = createSimHost(level, { rapier }), bow = install(original);
  let restored: SimHost | undefined;
  try {
    for (let tick = 0; tick < 50; tick++) original.step();
    held = false;
    for (let tick = 0; tick < 120; tick++) original.step();
    expect([bow.flying(), bow.state.arrows, bow.stuck.count]).toEqual([0, 19, 1]);
    const target = bow.stuck.snapshot().stuck[0];
    if (target === undefined) throw new Error('The real loose did not leave a shaft');
    expect(target.recoverable).toBe(true);
    const saved = snapshotSimHost(original);
    restored = restoreSimHost(level, { rapier }, saved, fresh => { install(fresh); });
    expectSameSimSnapshot(snapshotSimHost(restored), saved);
    for (let tick = 0; tick < 1600; tick++) {
      const dx = target.position[0] - original.player.position.x, dz = target.position[2] - original.player.position.z;
      const length = Math.hypot(dx, dz);
      const command = { moveX: length > 0.2 ? dx / length : 0, moveZ: length > 0.2 ? dz / length : 0, yaw: 0 };
      original.step(command); restored.step(command);
      if (bow.stuck.count === 0) break;
    }
    expect(bow.stuck.count).toBe(0);
    expect([19, 20]).toContain(bow.state.arrows); // The real gameplay draw decides survival; neither result is fabricated.
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
  } finally { restored?.dispose(); original.dispose(); }
});
