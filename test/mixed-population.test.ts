// oxlint-disable-next-line import/no-nodejs-modules -- Real Rapier exercises the native host.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Rng } from '../src/engine/core/rng';
import { loadRapier } from '../src/engine/physics/rapier';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { createSimHost } from '../src/engine/sim';
import { installMixedPopulation, type MixedPopulationInput } from '../src/game/population/mixedRoster';
import { readSpeciesPrograms } from '../src/format/speciesPrograms';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { DRIFTWOOD_SPECIES_PROGRAMS } from '../src/shards/driftwood-isle/generators/speciesPrograms';
import { RETURN_PROGRAM } from '../src/shards/driftwood-isle/generators/returnProgram';
import { enemyPlacements } from '../src/shards/driftwood-isle/generators/enemyPlacement';
import { keeperRows } from '../src/shards/driftwood-isle/generators/keeperRows';
import source from '../src/shards/driftwood-isle/data/mixedPopulation.json' with { type: 'json' };

/** An unrelated orchard population uses one practice animal and a reserved
 * guardian, a different roster bound, floor, return gate and empty pose clips. */
function orchard(): MixedPopulationInput {
  const sample = SIM_LEVEL.entities[0], native = DRIFTWOOD_SPECIES_PROGRAMS.native[0], guard = DRIFTWOOD_SPECIES_PROGRAMS.program.species.find(row => row.kind === 'crab');
  if (sample === undefined || native === undefined || guard === undefined) throw new Error('Missing fixture species');
  const kind = 'orchard-hog', guardian = 'orchard-guard', spec = { ...sample.spec, kind }, guardSpec = { ...sample.spec, kind: guardian }, stream = new Rng(40).snapshot();
  const placement = enemyPlacements(), sourceKeeper = keeperRows(placement);
  const pose = { custom: true, joints: [
    { name: 'body', parent: -1, position: [0, 1, 0], order: 'YXZ', scale: [1, 1, 1] },
    { name: 'head', parent: 0, position: [0, 1, 0], order: 'YXZ', scale: [1, 1, 1] },
  ] } as const;
  return { rows: { ...source, step: 'orchard.population', limit: 8, hunted: [kind], floorKinds: [],
    reserve: { kind: guardian, variant: spec.variant, scale: [1, 1], legacyMemory: [] }, poses: [{ kind, clips: [] }, { kind: guardian, clips: [] }],
    practice: { at: { x: 2, z: 3 }, fade: .1, delay: .2, away: 5 } },
    population: readSpeciesPrograms({ ...DRIFTWOOD_SPECIES_PROGRAMS, native: [{ ...native, kind }], page: [],
      program: { ...DRIFTWOOD_SPECIES_PROGRAMS.program, species: [{ ...guard, kind: guardian }] },
      hunt: { limit: 8, player: 'host', fight: {}, bands: { states: [], legacyKinds: [] }, hit: { namespace: 'creature', tags: [] } } }),
    keeper: { ...sourceKeeper, seed: 9,
      environment: { ...sourceKeeper.environment, id: 'orchard.ground', seed: 9, chunkHalf: 16, water: -10, sea: false },
      variants: [{ kind, rows: [{ id: spec.variant, scale: [1, 1] }] }], herds: [{ kind, x: 2, z: 3 }],
      bodies: [{ id: 'creature:0', kind, variant: spec.variant, herd: 0, x: 2, z: 3, yaw: 0, seed: 7, scale: 1, fauna: true, practice: true, stream: null }],
      fauna: { seed: 9, centres: [[2, 3]], rows: [{ id: 'creature:0', herd: 0, seed: 7, x: 2, z: 3, yaw: 0, stream }], stream },
      ecology: { ...sourceKeeper.ecology, rules: {}, fixed: [], limit: 8 } },
    bake: { ground: { heights: new Float32Array(4), scale: { x: 32 } }, actors: [{ kind, variant: spec.variant, pose }], herds: [{}],
      habitat: { perches: [], perchBases: [], hold: { x: 0, z: 0, r: 1, guardR: 1, step: 1, floor: Array.from({ length: 9 }, () => null) } } },
    reserved: { pose, pool: { x: 5, z: 6, yaw: 0 } }, specs: new Map([[`${kind}.${spec.variant}`, spec], [`${guardian}.${spec.variant}`, guardSpec]]), fauna: new Map([[kind, { ...native, kind }]]),
    placement: { seed: 9, native: { stream } }, perchProgram: RETURN_PROGRAM, launch: { kind: 'target', speed: 9, time: [.8, 1.5], gravity: 9.81, rotation: [1, .7, 0] },
    seed: 9, waterLevel: -10, spawnY: 0, nav: null };
}

test('mixed orchard roster replaces the practice slot and restores its reserved body and volley owner', async () => {
  const R = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm'))), input = orchard();
  const level = { ...SIM_LEVEL, entities: [] }, host = createSimHost(level, { rapier: R });
  let restored: ReturnType<typeof createSimHost> | undefined;
  try {
    const population = installMixedPopulation(host, input), first = population.bodies()[0]?.actor;
    if (first === null || first === undefined) throw new Error('Missing orchard practice body');
    first.alive = false; first.hp = 0; host.player.position.set(-10, 0, -10);
    for (let i = 0; i < 60; i++) host.step({ moveX: 0, moveZ: 0, yaw: 0 });
    expect(population.bodies()).toHaveLength(1);
    expect(population.bodies()[0]?.id).toBe('creature:1');
    expect(population.bodies()[0]?.actor?.alive).toBe(true);
    const guardian = population.spawnCaptain(); expect(guardian.entityId).toBe('creature:2');
    expect(() => population.spawnCaptain()).toThrow('once');
    population.publishPoses();
    const saved = snapshotSimHost(host);
    restored = restoreSimHost(level, { rapier: R }, saved, owner => {
      const resumed = installMixedPopulation(owner, orchard(), saved); resumed.settle();
      expect(resumed.bodies().map(row => row.id)).toEqual(['creature:1']);
      expect(resumed.captain()?.entityId).toBe('creature:2');
    });
    expect(snapshotSimHost(restored)).toEqual(saved);
    for (let i = 0; i < 6; i++) { host.step({ moveX: 0, moveZ: 0, yaw: 0 }); restored.step({ moveX: 0, moveZ: 0, yaw: 0 }); }
    expect(snapshotSimHost(restored)).toEqual(snapshotSimHost(host));
  } finally { host.dispose(); restored?.dispose(); }
});
