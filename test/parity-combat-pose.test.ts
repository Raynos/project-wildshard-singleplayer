// oxlint-disable-next-line import/no-nodejs-modules -- Load committed Rapier bytes without outside-root Vite asset imports.
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { combatSetup } from '../scripts/parity/combat.mjs';
import { Player } from '../src/engine/player/Player';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier } from '../src/engine/physics/rapier';
import { groups } from '../src/engine/physics/groups';
import { overrideTerrain } from '../src/engine/world/Heightfield';
import { legacyDouble } from './fake/FakeGame';

it('grounds a distant firing pose at its own terrain, rather than beneath the hillside at the target height', async () => {
  const rapier = await loadRapier(new Uint8Array(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const physics = new Physics(rapier), restore = overrideTerrain({ heightAt: x => x < -6 ? 10 : -8 });
  physics.world.createCollider(rapier.ColliderDesc.cuboid(6, 0.5, 20).setTranslation(-12, 9.5, 0).setCollisionGroups(groups('WORLD')));
  const player = new Player(new PerspectiveCamera(), physics, legacyDouble<HTMLCanvasElement>({}), { waterLine: { update: () => undefined, setHint: () => undefined } });
  const bow = { id: 'bow' }, weapons = { list: [bow], current: { id: 'sabre' }, unlock: () => undefined };
  const target = { position: new Vector3(0, -8, 0), dims: { bodyY: 0.66 }, scale: 0.85 };
  const game = { level: { ground: { structures: false } } };
  vi.stubGlobal('window', { performance, __wildshard: { requireWorld: () => ({ player, weapons, game }), combat: {
    equip: (id: string) => { weapons.current = { id }; }, target: () => target,
  } } });
  try {
    player.spawn(-12, 0, 0);
    const { pose, aim } = combatSetup({ step: 'shot', weapon: 'bow', target: 'wolf', near: { x: 0, z: 0 }, distance: 12, hit: 20, kill: 20 });
    expect(aim.y).toBeCloseTo(-8 + 0.66 * 0.85);
    // The previous setup started below the solid firing platform and could fall indefinitely.
    player.spawn(pose.x, pose.z, pose.yaw, target.position.y);
    for (let i = 0; i < 60; i++) { player.input(1 / 60); physics.step(); player.step(1 / 60); }
    expect(player.position.y).toBeLessThan(-8);
    player.spawn(pose.x, pose.z, pose.yaw, pose.y);
    for (let i = 0; i < 60; i++) { player.input(1 / 60); physics.step(); player.step(1 / 60); }
    expect(player.position.y).toBeCloseTo(10, 1);
    expect(player.velocity.y).toBe(0);
    expect(weapons.current.id).toBe('bow');
    // Built-floor levels retain their explicit elevation above the terrain datum.
    game.level.ground.structures = true; target.position.y = 10;
    const restoreDatum = overrideTerrain({ heightAt: () => 0 });
    try {
      const built = combatSetup({ step: 'swing', weapon: 'bow', target: 'dummy', near: { x: 0, z: 0 }, distance: 12, hit: 3, kill: null });
      player.spawn(built.pose.x, built.pose.z, built.pose.yaw, built.pose.y);
      for (let i = 0; i < 60; i++) { player.input(1 / 60); physics.step(); player.step(1 / 60); }
      expect(built.pose.y).toBe(10); expect(player.position.y).toBeCloseTo(10, 1);
    } finally { restoreDatum(); }
  } finally { vi.unstubAllGlobals(); restore(); player.motor.dispose(); physics.dispose(); }
});
