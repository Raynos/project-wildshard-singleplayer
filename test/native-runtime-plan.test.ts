import { expect, it } from 'vitest';
import { parseNativeRuntimePlan } from '../src/format/nativeRuntimePlan';
import { emitPlatformSections } from '../src/sdk/platformSections';
import { SKY_NATIVE_WORLD } from '../src/shards/far-reach/data/nativeWorld';
import { SIGNAL_NATIVE_WORLD } from '../src/shards/sunscar-dunes/data/nativeWorld';

it('admits both existing native policies without dropping owner metadata', () => {
  for (const recipe of [SKY_NATIVE_WORLD, SIGNAL_NATIVE_WORLD]) {
    const parsed = parseNativeRuntimePlan({ kind: 'held-melee', recipe, baked: { pieces: [], actors: [] } });
    expect(parsed.recipe.population.owner).toEqual(recipe.population.owner);
    expect(parsed.recipe.population.rows.homes).toEqual(recipe.population.rows.homes);
    expect(parsed.recipe.runtime).toEqual(recipe.runtime);
    expect(parsed.recipe.population.rows.program.species.map(row => row.variants))
      .toEqual(recipe.population.rows.program.species.map(row => row.variants));
    const output = emitPlatformSections(new Map([['sim/runtime-plan', parsed]]));
    expect(output.sections[0]?.schema).toBe('wildshard:sim/runtime-plan@1');
  }
});

it('refuses executable selectors, callbacks and unbounded native declarations', () => {
  const row = { kind: 'held-melee', recipe: SKY_NATIVE_WORLD, baked: { pieces: [] } };
  expect(() => parseNativeRuntimePlan({ ...row, module: 'file:///source.ts' })).toThrow();
  expect(() => parseNativeRuntimePlan({ ...row, kind: 'source' })).toThrow();
  expect(() => parseNativeRuntimePlan({ ...row, baked: { install: () => undefined } })).toThrow();
  expect(() => parseNativeRuntimePlan({ ...row, recipe: { ...row.recipe, player: { speed: Infinity } } })).toThrow();
  expect(() => parseNativeRuntimePlan({ ...row, recipe: { ...row.recipe, population: {
    ...row.recipe.population, rows: { ...row.recipe.population.rows, homes: Array.from({ length: 4097 }, () => row.recipe.population.rows.homes[0]) },
  } } })).toThrow();
});

it('retains the body-home field order used by existing native saves', () => {
  const parsed = parseNativeRuntimePlan({ kind: 'held-melee', recipe: SKY_NATIVE_WORLD, baked: { pieces: [] } });
  const source = SKY_NATIVE_WORLD.population.rows.placement.rows[0]?.home;
  const admitted = parsed.recipe.population.rows.placement?.rows[0]?.home;
  if (source === undefined || admitted === undefined) throw new Error('Missing original body home');
  expect(Object.keys(admitted)).toEqual(Object.keys(source));
});

it('retains director input order through canonical output for existing saves', () => {
  const emitted = emitPlatformSections(new Map([['sim/runtime-plan', { kind: 'held-melee', recipe: SKY_NATIVE_WORLD, baked: { pieces: [] } }]]));
  const bytes = emitted.files.get('sections/sim/runtime-plan.json');
  if (bytes === undefined) throw new Error('Missing native section');
  const decoded = parseNativeRuntimePlan(JSON.parse(new TextDecoder().decode(bytes)));
  expect(Object.keys(decoded.recipe.population.owner.stages.inputs))
    .toEqual(Object.keys(SKY_NATIVE_WORLD.population.owner.stages.inputs));
  expect(() => parseNativeRuntimePlan({ ...decoded, ownerInputs: ['foreign'] })).toThrow();
});
