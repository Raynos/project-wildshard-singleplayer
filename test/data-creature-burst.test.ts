// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual shared Rapier/player impulse owners.
import { readFile } from 'node:fs/promises';
import { beforeAll, expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { creaturesExample } from '../scripts/docs/authoring/creatures';
import { loadRapier } from '../src/engine/physics/rapier';
import { restoreSimHost, snapshotSimHost } from '../src/engine/sim/snapshot';
import { bindShardfileSim, createShardfileSim } from '../src/game/plugin/simulation';
import { expectSameSimSnapshot } from './fake/simSnapshot';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(Uint8Array.from(await readFile('public/assets/physics/rapier.wasm')).buffer); });
function burstExample() {
  const source = creaturesExample();
  source.creatures.groups = [];
  source.creatures.spawns = source.creatures.spawns.filter(row => row.species === 'hawk');
  for (const row of source.creatures.spawns) row.at = [0, 3.2, 1];
  source.creatures.brains = [{ id: 'hawk', kind: 'diver', pattern: 'burst', thinkDivisor: 6,
    strike: 'hawk.dive', home: { x: 0, z: 0, r: 10, y: 8 }, circleSpeed: 3, dartSpeed: 12,
    noticeRadius: 35, shoveSpeed: 3, liftSpeed: 1, targetHeight: 1.2 }];
  return parseShardfile(source);
}

it('lands a real burst hit and restores the owned player impulse and flyer clock exactly', () => {
  const source = burstExample(), sim = createShardfileSim(source, new Map(), { rapier });
  try {
    const initial = sim.host.player.health.attributes.health;
    for (let tick = 0; tick < 180 && sim.host.player.health.attributes.health === initial; tick++) sim.host.step();
    expect(sim.host.player.health.attributes.health).toBeLessThan(initial);
    expect(sim.host.playerImpulse.length()).toBeGreaterThan(0);
    const saved = snapshotSimHost(sim.host);
    const restored = restoreSimHost(sim.host.level, { rapier }, saved,
      fresh => { bindShardfileSim(fresh, source, new Map(), { rapier, restoring: true }); });
    try {
      expectSameSimSnapshot(snapshotSimHost(restored), saved);
      for (let tick = 0; tick < 600; tick++) { sim.host.step(); restored.step(); }
      expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(sim.host));
      expect(sim.host.player.position.distanceToSquared({ x: 0, y: 2, z: 0 })).toBeGreaterThan(0.01);
    } finally { restored.dispose(); }
  } finally { sim.dispose(); }
});

it('refuses borrowed impulse authority before registration and then uses the real owning player', () => {
  const source = burstExample(), owner = createShardfileSim(emptyShardfile(source.identity), new Map(), { rapier });
  const player = owner.host.player;
  const ports = { rapier, physics: owner.host.physics,
    fixedStep: (run: () => void) => owner.host.onStep('data-host.embedded', run),
    events: owner.host.events, clock: owner.host.clock, combat: owner.host.combat,
    player: { id: player.id, position: player.position, yaw: player.yaw, health: player.health, motor: player.motor } };
  try {
    expect(() => createShardfileSim(source, new Map(), ports)).toThrow('borrowed data-host player impulse');
    let impulses = 0;
    const sim = createShardfileSim(source, new Map(), { ...ports, creatureImpulse: velocity => {
      impulses++; owner.host.impulsePlayer(velocity);
    } });
    try {
      for (let tick = 0; tick < 180; tick++) owner.host.step();
      expect(impulses).toBeGreaterThan(0);
      expect(player.position.distanceToSquared({ x: 0, y: 2, z: 0 })).toBeGreaterThan(0.01);
    } finally { sim.dispose(); }
  } finally { owner.dispose(); }
});

it('produces no contact damage or player impulse when the real attack claim denies it', () => {
  const sim = createShardfileSim(burstExample(), new Map(), { rapier });
  try {
    const health = sim.host.player.health.attributes.health, start = sim.host.player.position.clone();
    sim.host.events.answer('ai.claim', () => false, sim.host.scope);
    for (let tick = 0; tick < 180; tick++) sim.host.step();
    expect(sim.host.player.health.attributes.health).toBe(health);
    expect(sim.host.player.position.toArray()).toEqual(start.toArray());
  } finally { sim.dispose(); }
});
