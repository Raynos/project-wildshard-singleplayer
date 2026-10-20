import { expect, test } from 'vitest';
import { Rng } from '../src/engine/core/rng';
import { enemyPlacements } from '../src/shards/driftwood-isle/generators/enemyPlacement';
import { keeperRows } from '../src/shards/driftwood-isle/generators/keeperRows';
import { parse } from 'valibot';
import { PopulationKeeperRowsSchema } from '../src/format/populationKeeper';
import physics from '../src/shards/driftwood-isle/data/physics.generated.json' with { type: 'json' };

test('keeper compilation retains the captured native recipes, placement order and stream checkpoints', () => {
  const placement = enemyPlacements(), rows = parse(PopulationKeeperRowsSchema, keeperRows(placement));
  expect(rows.bodies.map(({ id, kind, variant, seed, scale }) => ({ id, kind, variant, seed, scale })))
    .toEqual(physics.actors.map(({ id, kind, variant, seed, scale }) => ({ id, kind, variant, seed, scale })));
  expect(rows.bodies.filter(row => row.practice).map(row => row.id)).toEqual([physics.habitat.practice]);
  expect(rows.herds.map(row => row.kind)).toEqual(physics.herds.map(row => row.kind));
  const rng = new Rng(rows.seed + 31); rng.restore(rows.fauna.stream);
  for (const [i, source] of placement.native.enemies.entries()) {
    const row = rows.bodies[rows.fauna.rows.length + i]; if (row === undefined) throw new Error('Missing keeper body');
    if (source.variant === null) rng.next();
    const variants = rows.variants.find(value => value.kind === row.kind)?.rows;
    const range = variants?.find(value => value.id === row.variant)?.scale;
    if (range === undefined) throw new Error('Missing keeper variant');
    expect(rng.range(range[0], range[1])).toBe(row.scale); rng.next(); expect(rng.next()).toBe(row.seed);
    rng.next(); rng.next(); rng.next(); expect(row.stream).toEqual(rng.snapshot());
    expect([row.x, row.z, row.yaw]).toEqual([source.x, source.z, source.yaw]);
  }
  expect(() => parse(PopulationKeeperRowsSchema, { ...rows, extra: true })).toThrow();
});
