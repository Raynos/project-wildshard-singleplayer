// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the production native physics and body recipes.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { snapshotSimHost, restoreSimHost, type SimSnapshot } from '../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { installSpeciesHomes, bakedSpecs } from '../src/game/plugin/brain';
import { creatureFloor } from '../src/game/shardfile/homeKeeper';
import { speciesBrains } from '../src/sdk/speciesBrains';
import { SKY_CREATURE_ROWS, SKY_CREATURE_STRIKES } from '../src/shards/far-reach/data/brains';
import { SKY_FLOCK_ROWS } from '../src/shards/far-reach/data/spawns';
import { skySpecs } from './fake/sky-specs';
import { DECK } from '../src/shards/far-reach/data/layout';
import { SIGNAL_SPECIES, SIGNAL_STRIKES, SIGNAL_MODULES } from '../src/shards/sunscar-dunes/data/brains';
import { SIGNAL_HEADLESS } from '../src/shards/sunscar-dunes/data/headlessOwners';
import signalPhysics from '../src/shards/sunscar-dunes/data/physics.generated.json' with { type: 'json' };
import { SIM_LEVEL } from './fixtures/sim-level/level';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const level = { ...SIM_LEVEL, entities: [], quests: [] };
const sky = {
  rows: SKY_FLOCK_ROWS.map(row => ({ id: row.id, kind: row.kind, at: row.at, yaw: row.yaw, respawn: 0, late: row.kind === 'skyGoat' })),
  placement: { fallback: -1000, rows: SKY_FLOCK_ROWS.map(row => ({ id: row.id, home: row.home, fromY: row.kind === 'skyGoat' ? row.home.y + 2 : DECK + 2 })) },
};
function installSky(host: SimHost, next: boolean, saved?: Readonly<SimSnapshot>) {
  const brains = speciesBrains(SKY_CREATURE_ROWS, SKY_CREATURE_STRIKES), floor = creatureFloor(host, () => -1000);
  const core = { step: 'fixture.creatures', seed: 6417, homes: sky.rows, specs: skySpecs(), species: SKY_CREATURE_ROWS, brains,
    attackers: Infinity, think: { every: 6, dt: 0.1 } };
  const placement = next ? { placement: sky.placement } : {
    home: (id: string) => { const row = SKY_FLOCK_ROWS.find(value => value.id === id); if (row === undefined) throw new Error('Missing authored home'); return row.home; },
    place: (id: string) => { const row = SKY_FLOCK_ROWS.find(value => value.id === id); if (row === undefined) throw new Error('Missing authored home'); return floor(row.at[0], row.at[1], row.kind === 'skyGoat' ? row.home.y + 2 : DECK + 2); },
    adopt: (actor: Parameters<NonNullable<Parameters<typeof installSpeciesHomes>[1]['adopt']>>[0]) => { actor.groundHeight = (x, z, fromY) => floor(x, z, fromY).y; },
  };
  const keeper = installSpeciesHomes(host, { ...core, ...placement }, saved); keeper.settle(); return keeper;
}
function installSignal(host: SimHost, next: boolean, saved?: Readonly<SimSnapshot>) {
  const spec = SIGNAL_HEADLESS.homes;
  const brains = speciesBrains(SIGNAL_SPECIES, SIGNAL_STRIKES, SIGNAL_MODULES);
  const authority = next ? { holds: spec.holds } : { beforeStep: (kept: ReturnType<ReturnType<typeof installSpeciesHomes>['homes']>) => {
    for (let index = 0; index < 1024; index++) {
      const hold = spec.holds[index]; if (hold === undefined) break;
      const actor = kept[hold.home]?.actor; if (actor) actor.mem[hold.field] = host.flags.has(hold.until) ? 0 : 1;
    }
  } };
  const keeper = installSpeciesHomes(host, { step: 'fixture.creatures', seed: spec.seed, homes: spec.rows,
    boss: SIGNAL_HEADLESS.boss.row, specs: bakedSpecs([...signalPhysics.actors, ...signalPhysics.bosses]), species: SIGNAL_SPECIES,
    brains, attackers: spec.attackers, think: spec.think, ...authority }, saved);
  keeper.settle(); return keeper;
}
it.each(['sky', 'signal'] as const)('%s placement/hold rows preserve the original complete keeper and quiet restore', kind => {
  const install = kind === 'sky' ? installSky : installSignal;
  const before = createSimHost(level, { rapier }), after = createSimHost(level, { rapier });
  let restored: SimHost | undefined;
  try {
    const old = install(before, false), next = install(after, true);
    expect(snapshotSimHost(after)).toEqual(snapshotSimHost(before));
    for (let tick = 0; tick < 600; tick++) {
      for (const [host, keeper] of [[before, old], [after, next]] as const) {
        if (kind === 'signal' && tick === 120) keeper.boss?.draw();
        if (kind === 'signal' && tick === 240) host.flags.set(SIGNAL_HEADLESS.homes.holds[0]?.until ?? '');
        host.player.position.set(Math.sin(tick * 0.01) * 5, 0, Math.cos(tick * 0.01) * 5); host.step();
      }
      expect(snapshotSimHost(after)).toEqual(snapshotSimHost(before));
      if (tick === 300) {
        const saved = snapshotSimHost(after);
        restored = restoreSimHost(level, { rapier }, saved, host => { install(host, true, saved); });
        expect(snapshotSimHost(restored)).toEqual(saved);
      }
    }
  } finally { restored?.dispose(); after.dispose(); before.dispose(); }
});
it('refuses conflicting or incomplete placement and invalid hold addresses before a body exists', () => {
  const host = createSimHost(level, { rapier }), before = snapshotSimHost(host);
  const spec = { step: 'fixture.creatures', seed: 6417, homes: sky.rows, specs: skySpecs(), species: SKY_CREATURE_ROWS,
    brains: speciesBrains(SKY_CREATURE_ROWS, SKY_CREATURE_STRIKES), attackers: Infinity, think: { every: 6, dt: 0.1 } };
  try {
    expect(() => installSpeciesHomes(host, { ...spec, placement: { ...sky.placement, rows: [] } })).toThrow('one declared floor authority');
    expect(() => installSpeciesHomes(host, { ...spec, placement: sky.placement, home: () => sky.placement.rows[0]?.home ?? { x: 0, y: 0, z: 0, r: 1 } })).toThrow('one declared floor authority');
    expect(() => installSpeciesHomes(host, { ...spec, placement: { ...sky.placement,
      rows: sky.placement.rows.map(row => ({ id: row.id, home: row.home, fromY: Number.NaN })) } })).toThrow('placement');
    expect(() => installSpeciesHomes(host, { ...spec, placement: { ...sky.placement,
      rows: sky.placement.rows.map(row => ({ id: row.id, fromY: row.fromY, home: { x: row.home.x, z: row.home.z, y: row.home.y, r: 0 } })) } })).toThrow();
    expect(() => installSpeciesHomes(host, { ...spec, holds: [{ home: 99, field: 'held', until: 'met' }] })).toThrow('hold');
    expect(snapshotSimHost(host)).toEqual(before);
  } finally { host.dispose(); }
});
