// oxlint-disable-next-line import/no-nodejs-modules -- Load the real native Rapier body/contact implementation.
import { readFile } from 'node:fs/promises';
import { beforeAll, expect, it } from 'vitest';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { creaturesExample } from '../scripts/docs/authoring/creatures';
import { loadRapier } from '../src/engine/physics/rapier';
import { restoreSimHost, snapshotSimHost } from '../src/engine/sim/snapshot';
import { bindShardfileSim, createShardfileSim } from '../src/game/plugin/simulation';
import { expectSameSimSnapshot } from './fake/simSnapshot';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(Uint8Array.from(await readFile('public/assets/physics/rapier.wasm')).buffer); });
function packExample() {
  const shard = creaturesExample();
  shard.creatures.brains = [];
  shard.creatures.spawns = shard.creatures.spawns.filter(row => row.species === 'goat');
  for (const [index, row] of shard.creatures.spawns.entries()) {
    row.brain = 'predators'; row.at = [index - 1, 0, 4]; row.yaw = Math.PI;
  }
  shard.creatures.groups = [{ id: 'predators', kind: 'stalker', pattern: 'pack', thinkDivisor: 6,
    members: shard.creatures.spawns.map(row => row.id), home: [0, 4], trotSpeed: 2, runSpeed: 8,
    shadowMinRadius: 4, shadowMaxRadius: 8, ringMinRadius: 2, ringMaxRadius: 4, biteRadius: 2,
    sightRadius: 30, coneAngle: Math.PI, smellRadius: 0, hearing: [10, 16, 24, 30],
    telegraphSeconds: 0.2, dashSeconds: 1, breakoffSeconds: 0.3, attackSeconds: 0.4,
    leaderVariant: 'guard', yipCue: 'pack.yip', howlCue: 'pack.howl', snarlCue: 'pack.snarl', biteCue: 'pack.bite' }];
  return parseShardfile(shard);
}
it('automatically binds a real pack roster, token owner and actual bites', () => {
  const sim = createShardfileSim(packExample(), new Map(), { rapier });
  try {
    const initial = sim.host.player.health.attributes.health;
    const hits: string[] = [];
    sim.host.events.on('damage.dealt', ({ req }) => { if (req.moveId !== undefined) hits.push(req.moveId); }, sim.host.scope);
    let active = false, maxLungers = 0;
    for (let tick = 0; tick < 1800; tick++) {
      sim.host.step();
      const actors = [...sim.host.entities.values()];
      maxLungers = Math.max(maxLungers, actors.filter(actor => actor.mem['lunge'] === 1 || actor.mem['lunge'] === 2).length);
      active ||= actors.some(actor => actor.state === 'charge');
      if (hits.length > 0) break;
    }
    expect(active).toBe(true); expect(maxLungers).toBe(1);
    expect(sim.host.player.health.attributes.health).toBeLessThan(initial);
    expect(hits).toContain('predators');
  } finally { sim.dispose(); }
});
it('restores real pack roles, attack clocks, RNG and native physics exactly', () => {
  const shard = packExample(), sim = createShardfileSim(shard, new Map(), { rapier });
  try {
    for (let tick = 0; tick < 380; tick++) sim.host.step();
    const saved = snapshotSimHost(sim.host);
    const restored = restoreSimHost(sim.host.level, { rapier }, saved,
      fresh => { bindShardfileSim(fresh, shard, new Map(), { rapier, restoring: true }); });
    try {
      expectSameSimSnapshot(snapshotSimHost(restored), saved);
      for (let tick = 0; tick < 600; tick++) { sim.host.step(); restored.step(); }
      expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(sim.host));
    } finally { restored.dispose(); }
  } finally { sim.dispose(); }
});
for (const protection of ['cover', 'claim'] as const) {
  it(`refuses actual pack damage under ${protection}`, () => {
    const sim = createShardfileSim(packExample(), new Map(), { rapier });
    try {
      const hp = sim.host.player.health.attributes.health;
      if (protection === 'claim') sim.host.events.answer('ai.claim', () => false, sim.host.scope);
      else {
        const { R, world } = sim.host.physics;
        world.createCollider(R.ColliderDesc.cuboid(200, 5, 0.2).setTranslation(0, 4, 2));
      }
      for (let tick = 0; tick < 1200; tick++) sim.host.step();
      expect(sim.host.player.health.attributes.health).toBe(hp);
    } finally { sim.dispose(); }
  });
}
