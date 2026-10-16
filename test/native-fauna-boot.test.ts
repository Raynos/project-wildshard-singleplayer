// oxlint-disable-next-line import/no-nodejs-modules -- The native roster runs the actual shipped Rapier bytes.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Rng } from '../src/engine/core/rng';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost } from '../src/engine/sim';
import { createNativeCreatureRoster } from '../src/game/shardfile/homeKeeper';
import type { HuntBody } from '../src/engine/ai/hunt';
import { faunaPlacement } from '../src/shards/driftwood-isle-legacy/runtime/fauna';
import { DRIFTWOOD_NATIVE_FAUNA } from '../src/shards/driftwood-isle/generators/nativeFauna';
import physics from '../src/shards/driftwood-isle/data/physicsRows.json';
import { SIM_LEVEL } from './fixtures/sim-level/level';

test('authored fauna preserves the shipping reader spawn, yaw, herd centres and memory stream', () => {
  const boot = DRIFTWOOD_NATIVE_FAUNA, fauna = physics.actors.filter(row => row.kind === 'boar' || row.kind === 'bear');
  const old = faunaPlacement(boot.seed, fauna), stream = new Rng(boot.seed + 31), replay = new Rng(boot.seed + 31);
  expect(boot.centres).toEqual(old.centres);
  expect(boot.rows.map(row => [row.id, row.herd, row.seed])).toEqual(fauna.map(row => [row.id, row.herd, row.seed]));
  let drawn = 0;
  for (const row of boot.rows) {
    const placed = old.spawns.get(row.id); if (placed === undefined) throw new Error('Missing shipping fauna');
    expect([row.x, row.z, row.yaw]).toEqual([placed.x, placed.z, placed.yaw]);
    while (drawn <= placed.at) { stream.next(); drawn++; }
    expect(row.stream).toEqual(stream.snapshot());
    replay.restore(row.stream);
    expect([replay.next(), replay.next(), replay.next()]).toEqual([stream.next(), stream.next(), stream.next()]); drawn += 3;
  }
  while (drawn < old.draws) { stream.next(); drawn++; }
  expect(boot.stream).toEqual(stream.snapshot());
  replay.restore(boot.stream); expect(replay.next()).toBe(stream.next());
  expect(() => faunaPlacement(boot.seed + 1, fauna)).toThrow();
});

test('native adoption preflights identities and complete owned streams before any effect', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host = createSimHost({ ...SIM_LEVEL, entities: [] }, { rapier }), rng = new Rng(39);
  const effects: string[] = [];
  let expectAdopt = (_actor: HuntBody, _x: number, _z: number): void => undefined;
  const adopt = (actor: HuntBody, x: number, z: number): void => { expectAdopt(actor, x, z); effects.push('adopt'); rng.next(); rng.next(); rng.next(); };
  const recipe = SIM_LEVEL.entities[0]; if (recipe === undefined) throw new Error('Missing native recipe');
  const intake = createNativeCreatureRoster(host, { specs: [recipe.spec],
    variants: new Map([[recipe.spec.kind, [{ id: recipe.spec.variant, scale: [1, 1] as const }]]]),
    rng, spawnY: 10, attackTurnCap: 1, hunted: 'every',
    hunt: { herds: [], addHerd: () => 0, adopt, forget: () => undefined } });
  try {
    const body: Parameters<typeof intake.arrive>[0] = intake.body('fauna', recipe.spec.kind, recipe.spec.variant, 0, { x: 8, z: 8 }, 0, [1, 1], { seed: .25, scale: 1 });
    intake.arrive(body);
    const start = rng.snapshot(), checkpoint = new Rng(39); checkpoint.next();
    const row = { id: 'fauna', seed: .25, x: 8, z: 8, stream: checkpoint.snapshot() };
    checkpoint.next(); checkpoint.next(); checkpoint.next(); const end = checkpoint.snapshot();
    for (const invalid of [[{ ...row, id: 'missing' }], [row, row], [{ ...row, x: Infinity }], [{ ...row, seed: .5 }],
      [{ ...row, stream: { ...row.stream, state: -1 } }], [{ ...row, stream: { ...row.stream, initial: 40 } }],
      Array.from({ length: 1025 }, () => row)]) {
      expect(() => { intake.adopt(invalid, end); }).toThrow(); expect(effects).toEqual([]); expect(rng.snapshot()).toEqual(start);
    }
    expect(() => { intake.adopt([row], { ...end, version: 99 }); }).toThrow(); expect(rng.snapshot()).toEqual(start);
    expectAdopt = (actor, x, z) => { expect(actor).toBe(body.actor); expect([x, z]).toEqual([8, 8]); expect(rng.snapshot()).toEqual(row.stream); };
    intake.adopt([row], end);
    expect(effects).toEqual(['adopt']); expect(rng.snapshot()).toEqual(end);
  } finally { host.dispose(); }
});
