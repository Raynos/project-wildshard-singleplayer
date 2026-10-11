// oxlint-disable-next-line import/no-nodejs-modules -- Load actual Rapier for the native data-host boundary.
import { readFile } from 'node:fs/promises';
import { beforeAll, expect, it } from 'vitest';
import * as v from 'valibot';
import { CreatureHomeSchema } from '@wildshard/format/creatures';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { creaturesExample } from '../scripts/docs/authoring/creatures';
import { loadRapier } from '../src/engine/physics/rapier';
import { restoreSimHost, snapshotSimHost } from '../src/engine/sim/snapshot';
import { bindShardfileSim, createShardfileSim } from '../src/game/plugin/simulation';
import { expectSameSimSnapshot } from './fake/simSnapshot';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(Uint8Array.from(await readFile('public/assets/physics/rapier.wasm')).buffer); });
function ramExample() {
  const source = creaturesExample();
  source.creatures.groups = [];
  source.rows.strikes.push({ id: 'goat.ram', shape: { kind: 'lane', length: 4, width: 2 },
    windup: 0.2, active: 0.5, recover: 0.4, cooldown: 1, range: 6, damage: 12,
    tags: ['animal.goat'], weight: 1, speed: 0 });
  source.creatures.brains.push({ id: 'goat.ram', kind: 'grazer', pattern: 'wander-ram', thinkDivisor: 6,
    strike: 'goat.ram', grazeSpeed: 1.2, ramSpeed: 7, noticeRadius: 10, rimMargin: 1,
    fallDrop: 2, levelTolerance: 2.5, threatSpeed: 1.4, wanderMinSeconds: 2, wanderMaxSeconds: 4, rampRate: 4 });
  source.creatures.spawns = source.creatures.spawns.filter(row => row.id !== 'goat.2');
  for (const row of source.creatures.spawns) {
    if (row.species === 'goat') {
      row.brain = 'goat.ram'; row.at = [row.id === 'goat.0' ? 3 : -3, 0, 0];
      row.home = { x: row.at[0], y: 0, z: 0, r: 12 };
    } else row.home = { x: 0, y: 8, z: 6, r: 9 };
  }
  return parseShardfile(source);
}

it('bounds authored body homes and preserves omitted metadata instead of deriving a home', () => {
  expect(v.parse(CreatureHomeSchema, { x: 250, y: -250, z: 0, r: 500 })).toEqual({ x: 250, y: -250, z: 0, r: 500 });
  for (const invalid of [{ x: 251 }, { y: Number.NaN }, { z: Infinity }, { r: 0 }, { r: 501 }, { owner: 'other' }])
    expect(v.safeParse(CreatureHomeSchema, { x: 0, y: 0, z: 0, r: 12, ...invalid }).success).toBe(false);
  expect(creaturesExample().creatures.spawns.every(row => !('home' in row))).toBe(true);
  const unused = creaturesExample();
  const grouped = unused.creatures.spawns[0];
  if (grouped === undefined) throw new Error('Missing fixture actor');
  grouped.home = { x: 0, y: 0, z: 0, r: 12 };
  expect(() => parseShardfile(unused)).toThrow('creature');
  const source = ramExample();
  source.creatures.spawns = source.creatures.spawns.map(({ home: _home, ...row }) => row);
  expect(() => createShardfileSim(source, new Map(), { rapier })).toThrow('authored data-host ram home');
});

it('binds two actual ram bodies to independent homes and restores RNG, strike and physics exactly', () => {
  const source = ramExample(), sim = createShardfileSim(source, new Map(), { rapier });
  try {
    let attacking = false;
    const initialHealth = sim.host.player.health.attributes.health;
    for (let tick = 0; tick < 90; tick++) {
      sim.host.step();
      attacking ||= (sim.host.entities.get('goat.0')?.attackPhase ?? -1) >= 0;
    }
    expect(attacking).toBe(true);
    expect(sim.host.player.health.attributes.health).toBeLessThan(initialHealth);
    const saved = snapshotSimHost(sim.host);
    const restored = restoreSimHost(sim.host.level, { rapier }, saved,
      fresh => { bindShardfileSim(fresh, source, new Map(), { rapier, restoring: true }); });
    try {
      expectSameSimSnapshot(snapshotSimHost(restored), saved);
      for (let tick = 0; tick < 600; tick++) { sim.host.step(); restored.step(); }
      expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(sim.host));
    } finally { restored.dispose(); }
    const changed = ramExample();
    const goat = changed.creatures.spawns.find(row => row.id === 'goat.0');
    if (goat?.home === undefined) throw new Error('Missing fixture home');
    goat.home.x += 1;
    expect(() => restoreSimHost(sim.host.level, { rapier }, saved,
      fresh => { bindShardfileSim(fresh, changed, new Map(), { rapier, restoring: true }); })).toThrow('continuation');
  } finally { sim.dispose(); }
});

for (const protection of ['cover', 'authorization'] as const) {
  it(`refuses real ram contact under ${protection}`, () => {
    const source = ramExample();
    source.creatures.spawns = source.creatures.spawns.filter(row => row.species === 'goat');
    const sim = createShardfileSim(source, new Map(), { rapier });
    try {
      const initial = sim.host.player.health.attributes.health;
      if (protection === 'authorization') sim.host.events.answer('ai.claim', () => false, sim.host.scope);
      else {
        const { R, world } = sim.host.physics;
        world.createCollider(R.ColliderDesc.cuboid(0.2, 3, 4).setTranslation(1.5, 2, 0));
        world.createCollider(R.ColliderDesc.cuboid(0.2, 3, 4).setTranslation(-1.5, 2, 0));
      }
      for (let tick = 0; tick < 180; tick++) sim.host.step();
      expect(sim.host.player.health.attributes.health).toBe(initial);
    } finally { sim.dispose(); }
  });
}

it('steers each actual body toward its authored home without taking a species-wide default', () => {
  const source = ramExample();
  source.creatures.spawns = source.creatures.spawns.filter(row => row.species === 'goat');
  for (const row of source.creatures.spawns) row.home = { x: row.at[0] > 0 ? 20 : -20, y: 0, z: 0, r: 4 };
  const sim = createShardfileSim(source, new Map(), { rapier });
  try {
    sim.host.step();
    expect(sim.host.entities.get('goat.0')?.desiredYaw).toBeCloseTo(Math.PI / 2, 12);
    expect(sim.host.entities.get('goat.1')?.desiredYaw).toBeCloseTo(-Math.PI / 2, 12);
  } finally { sim.dispose(); }
});
