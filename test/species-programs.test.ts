import { parse } from 'valibot';
import { ThrallLookSchema } from '../src/shards/pine-hollow/generators/sections';
import { THRALL_CLIPS } from '../src/shards/pine-hollow/generators/thrallClips';
import thrallLook from '../src/shards/pine-hollow/data/thrallLook.json' with { type: 'json' };
import { expect, test } from 'vitest';
import { bakeSpecies } from '../src/sdk/bake/species';
import { species } from '../src/sdk/species';
import { readSpeciesPrograms, readSpeciesProgram } from '../src/format/speciesPrograms';
import { PINE_SPECIES_PROGRAMS } from '../src/shards/pine-hollow/generators/speciesPrograms';
import { DRIFTWOOD_SPECIES_PROGRAMS } from '../src/shards/driftwood-isle/generators/speciesPrograms';
import { speciesWithLook } from '../src/engine/entities/species/look';
import { registerKing } from '../src/shards/pine-hollow/runtime/models/antlerKing';
import { pineLooks } from '../src/shards/pine-hollow/species/looks';
import { ISLAND_BOAR_LOOK, ISLAND_BEAR_LOOK } from '../src/shards/driftwood-isle/species/fauna';
import { ISLAND_BOAR, ISLAND_BEAR } from '../src/shards/driftwood-isle/generators/faunaSpecies';
import { PINE_BOAR, PINE_SPECIES, pineDeer, pineElk } from '../src/shards/pine-hollow/generators/speciesRows';
import { speciesBrains } from '../src/sdk/speciesBrains';
import { BOAR } from '../src/game/systems/species/boar';
import { readProjectAssets } from '../src/sdk/project';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { admitPineView } from '../src/shards/pine-hollow/runtime/world/context';

test('both populations admit the same gameplay fields without visual or callback metadata', () => {
  const pine = readSpeciesPrograms(structuredClone(PINE_SPECIES_PROGRAMS));
  const island = readSpeciesPrograms(structuredClone(DRIFTWOOD_SPECIES_PROGRAMS));
  expect(pine.page.map(row => row.kind)).toEqual(['boar', 'bear', 'deer', 'elk']);
  expect(pine.native.map(row => row.kind)).toEqual(['deer', 'elk', 'boar', 'bear', 'antler-king']);
  expect(island.page).toEqual(island.native);
  expect(pine.native.find(row => row.kind === 'antler-king')?.aggressive).toBe(true);
  expect(pine.page[0]).toEqual(bakeSpecies(PINE_BOAR, PINE_BOAR.id));
  expect(species(pine.page[0])).toEqual(pine.page[0]);
  expect(pine.page[0]?.spawnOnly).toEqual(PINE_BOAR.spawnOnly);
  expect(island.native[0]?.variants.map(row => row.scale)).toEqual(BOAR.variants.map(row => row.scale));
  expect(() => readSpeciesPrograms({ page: [...pine.page, pine.page[0]], native: [] })).toThrow();
  expect(() => bakeSpecies({ ...PINE_BOAR, think: () => undefined }, PINE_BOAR.id)).toThrow('callback-free');
  expect(() => species({ ...pine.page[0], parent: PINE_BOAR })).toThrow();
});

// The gameplay bake strips tint/traits; the existing view must restore exactly the same factory variants.
test('both emitted populations keep the original resolved visual variants', async () => {
  const loaded = await readProjectAssets('src/shards/pine-hollow');
  const section = loaded.output.custom?.sections.find(row => row.name === 'custom/nativeView');
  const bytes = section === undefined ? undefined : loaded.output.custom?.files.get(section.path);
  if (section === undefined || bytes === undefined) throw new Error('Missing admitted Pine native view');
  admitPineView(createShardProduct({ slug: 'pine-hollow', revision: 1, shardfile: loaded.shard,
    sections: new Map([['custom/nativeView', JSON.parse(new TextDecoder().decode(bytes))]]), files: new Map(),
    read: () => Promise.reject(new Error('Native view must use its section')) }));
  registerKing();
  const authored = [...PINE_SPECIES, pineDeer(), pineElk(), ISLAND_BOAR, ISLAND_BEAR];
  const programs = [...PINE_SPECIES_PROGRAMS.page, ...DRIFTWOOD_SPECIES_PROGRAMS.page];
  const looks = [...pineLooks(parse(ThrallLookSchema, { pose: THRALL_CLIPS, ...thrallLook })), ISLAND_BOAR_LOOK, ISLAND_BEAR_LOOK];
  for (const [i, row] of programs.entries()) {
    const before = authored[i], look = looks.find(value => value.species === row.id);
    if (before === undefined || look === undefined) throw new Error(`Missing comparison: ${row.id}`);
    const old = speciesWithLook(before, look), current = speciesWithLook(row, look);
    expect(current.variants, row.id).toEqual(old.variants);
    expect(current.spawnOnly, row.id).toEqual(old.spawnOnly);
  }
});


test('published brain/body programs bind the existing owner and refuse executable or ambiguous rows', () => {
  const program = readSpeciesPrograms(structuredClone(DRIFTWOOD_SPECIES_PROGRAMS)).program;
  if (program === undefined) throw new Error('Missing emitted enemy program');
  expect(program.species.map(row => row.kind)).toEqual(['crab', 'monkey', 'sailor', 'captain']);
  const owner = speciesBrains(program.species, program.strikes, program.modules);
  expect([...owner.kinds]).toEqual(['crab', 'monkey', 'sailor', 'captain']);
  expect(() => owner.bind('captain')).toThrow('existing body authority');
  for (const kind of ['crab', 'sailor']) expect(typeof owner.bind(kind).act).toBe('function');
  expect(() => owner.bind('monkey')).toThrow('trusted native body adapter');
  expect(program.species[0]?.body?.kind).toBe('animal');
  expect(() => readSpeciesProgram({ ...program, species: [...program.species, program.species[0]] })).toThrow();
  expect(() => readSpeciesProgram({ ...program, strikes: [...program.strikes, program.strikes[0]] })).toThrow();
  expect(() => readSpeciesProgram({ ...program, modules: { unsafe: () => undefined } })).toThrow();
});
