// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual native Rapier body and contact owners.
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
function circleExample(closeWeight = 1) {
  const shard = creaturesExample();
  shard.creatures.groups = []; shard.creatures.brains = [];
  shard.creatures.spawns = shard.creatures.spawns.filter(row => row.species === 'goat' && row.id !== 'goat.2');
  shard.rows.strikes = [
    { id: 'goat.charge', shape: { kind: 'lane', length: 8, width: 3 }, windup: 0.2,
      active: 0.3, recover: 0.2, cooldown: 0.5, range: 8, damage: 7, tags: ['animal.charge'], weight: 1, speed: 0 },
    { id: 'goat.close', shape: { kind: 'arc', radius: 4, halfAngle: Math.PI }, windup: 0.2,
      active: 0.3, recover: 0.2, cooldown: 0.5, range: 4, damage: 3, tags: ['animal.horns'], weight: 1, speed: 0 },
  ];
  shard.creatures.brains.push({ id: 'goat.challenge', kind: 'grazer', pattern: 'circle-challenge', thinkDivisor: 6,
    charge: 'goat.charge', close: 'goat.close', noticeRadius: 8, chargeRadius: 6, loseRadius: 20,
    walkSpeed: 1, approachSpeed: 1, homeRadius: 4, faceSeconds: 0.1, circleRate: 0.05,
    farPreferenceRadius: 5, farWeight: closeWeight === 0 ? 1 : 0, nearWeight: closeWeight === 0 ? 1 : 0,
    closeWeight, windupField: 'paw', recoveryField: 'winded' });
  for (const row of shard.creatures.spawns) {
    row.brain = 'goat.challenge'; row.at = [row.id === 'goat.0' ? 2 : -2, 0, 0];
    row.phaseOffset = row.id === 'goat.0' ? 0 : Math.PI;
  }
  return parseShardfile(shard);
}
it('admits only bounded explicitly authored phases for the matching policy', () => {
  const shard = circleExample();
  for (const phaseOffset of [Number.NaN, Infinity, 2 * Math.PI + 0.01]) {
    const invalid = circleExample();
    const row = invalid.creatures.spawns[0]; if (row === undefined) throw new Error('Missing body');
    row.phaseOffset = phaseOffset; expect(() => parseShardfile(invalid)).toThrow();
  }
  const other = creaturesExample(), grouped = other.creatures.spawns[0];
  if (grouped === undefined) throw new Error('Missing body');
  grouped.phaseOffset = 0; expect(() => parseShardfile(other)).toThrow('creature');
  shard.creatures.spawns = shard.creatures.spawns.map(({ phaseOffset: _phase, ...row }) => row);
  expect(() => createShardfileSim(shard, new Map(), { rapier })).toThrow('authored data-host circle phase');
});
for (const selected of ['close', 'charge'] as const) {
  it(`files the real selected ${selected} strike and restores a 600-tick suffix exactly`, () => {
    const shard = circleExample(selected === 'close' ? 1 : 0), sim = createShardfileSim(shard, new Map(), { rapier });
    try {
      const hits: { id: string | undefined; tags: readonly string[] }[] = [];
      sim.host.events.on('damage.dealt', ({ req }) => { hits.push({ id: req.moveId, tags: [...req.sourceTags] }); }, sim.host.scope);
      for (let tick = 0; tick < 60; tick++) sim.host.step();
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.every(hit => hit.id === `goat.${selected}` && hit.tags.includes(selected === 'close' ? 'animal.horns' : 'animal.charge'))).toBe(true);
      const saved = snapshotSimHost(sim.host);
      const restored = restoreSimHost(sim.host.level, { rapier }, saved,
        fresh => { bindShardfileSim(fresh, shard, new Map(), { rapier, restoring: true }); });
      try {
        expectSameSimSnapshot(snapshotSimHost(restored), saved);
        for (let tick = 0; tick < 600; tick++) { sim.host.step(); restored.step(); }
        expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(sim.host));
      } finally { restored.dispose(); }
      const changed = circleExample(selected === 'close' ? 1 : 0), row = changed.creatures.spawns[0];
      if (row === undefined) throw new Error('Missing body'); row.phaseOffset = 1;
      expect(() => restoreSimHost(sim.host.level, { rapier }, saved,
        fresh => { bindShardfileSim(fresh, changed, new Map(), { rapier, restoring: true }); })).toThrow('continuation');
    } finally { sim.dispose(); }
  });
}
it('uses independent authored phases without setup RNG draws', () => {
  const shard = circleExample();
  const policy = shard.creatures.brains[0]; if (policy?.kind !== 'grazer' || policy.pattern !== 'circle-challenge') throw new Error('Missing policy');
  policy.noticeRadius = 0;
  const sim = createShardfileSim(shard, new Map(), { rapier });
  try {
    const rng = sim.host.rng.snapshot(); sim.host.step();
    expect(sim.host.rng.snapshot()).toEqual(rng);
    expect(sim.host.entities.get('goat.0')?.desiredYaw).toBeCloseTo(1 / 60 * 0.05, 10);
    expect(Math.abs(sim.host.entities.get('goat.1')?.desiredYaw ?? 0)).toBeGreaterThan(3);
  } finally { sim.dispose(); }
});
it('does not file a hit when the actual attack claim refuses', () => {
  const sim = createShardfileSim(circleExample(), new Map(), { rapier });
  try {
    sim.host.events.answer('ai.claim', () => false, sim.host.scope);
    const hp = sim.host.player.health.attributes.health;
    for (let tick = 0; tick < 180; tick++) sim.host.step();
    expect(sim.host.player.health.attributes.health).toBe(hp);
  } finally { sim.dispose(); }
});
