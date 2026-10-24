import { expect, test, vi } from 'vitest';
import { object, parse } from 'valibot';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the existing admitted catalogue data without a product build.
import { readFileSync } from 'node:fs';
import { ClientSpeciesProgramSchema } from '../src/format/clientNative';
import { HullLookBookSchema, PackedCreatureLooksSchema } from '../src/format/speciesLooks';
import { SpeciesPresentationSchema } from '../src/format/speciesBookRows';
import { Scope } from '../src/engine/app/scope';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { CLIENT_FEATURES } from '../src/game/shardfile/clientPlan';
import { entryOwner } from '../src/game/shardfile/entryOwners';
import { installClientSpeciesProgram, prepareClientSpeciesCatalogue } from '../src/game/shardfile/clientSpeciesProgram';
import type { ShardContext } from '../src/game/plugin/context';
import type { ShardRuntime } from '../src/game/shard/runtime';
import type { ShardWorld } from '../src/game/shard/world';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';

const source = parse(object({hullBook: HullLookBookSchema, looks: PackedCreatureLooksSchema, presentation: SpeciesPresentationSchema}),
  JSON.parse(readFileSync('src/shards/nalati-grasslands/data/species.generated.json', 'utf8')));
const row = {kind: 'species.program', catalogue: {owner: 'orchard.species', actors: 'actors/catalogue.json', looks: 'actors/looks.json'}} as const;

function fixture() {
  const scope = new Scope('species-catalogue'), trace: string[] = [], world = legacyDouble<ShardWorld>({});
  const shardfile = emptyShardfile({slug: 'orchard-catalogue', name: 'Orchard', author: 'Fixture', revision: 1, seed: 1});
  const files = new Map([[row.catalogue.actors, {hash: 'actors', url: '/actors'}], [row.catalogue.looks, {hash: 'looks', url: '/looks'}]]);
  let onRead: (hash: string) => void = () => undefined;
  const product = createShardProduct({slug: shardfile.identity.slug, revision: 1, shardfile, files,
    sections: new Map([['look/hull-book', {...source.hullBook, slug: shardfile.identity.slug}]]), read: hash => {
      trace.push(hash); onRead(hash);
      return Promise.resolve(new TextEncoder().encode(JSON.stringify(hash === 'actors' ? {species: source.presentation} : source.looks)));
    }});
  const species = vi.fn<ShardContext['rows']['species']>(() => undefined), speciesLook = vi.fn<ShardContext['rows']['speciesLook']>(() => undefined);
  const runtime = legacyDouble<ShardRuntime>({world});
  const ctx = legacyDouble<ShardContext>({scope, product, game: legacyDouble<ShardContext['game']>({runtime}),
    rows: legacyDouble<ShardContext['rows']>({species, speciesLook})});
  return {scope, trace, ctx, species, speciesLook, onRead: (read: typeof onRead) => { onRead = read; }};
}

test('the catalogue source prepares once before world and installs the same rows at kit', async () => {
  const f = fixture();
  try {
    const feature = CLIENT_FEATURES['species.program'];
    expect(feature.world?.when({...row, shove: false})).toBe(true);
    expect(feature.world?.when({kind: 'species.program', library: 'animals', shove: false})).toBe(false);
    expect(feature.needsWorldLooks).toBe(false);
    expect(feature.rankFor?.({...row, shove: false})).toBeLessThan(CLIENT_FEATURES['held.claims.install'].rank);
    expect(feature.rankFor?.({kind: 'species.program', library: 'animals', shove: false})).toBe(20);
    await prepareClientSpeciesCatalogue(f.ctx, row);
    const catalogue = entryOwner(f.scope, 'species', row.catalogue.owner);
    expect(f.trace).toEqual(['actors', 'looks']); expect(f.species).not.toHaveBeenCalled();
    await installClientSpeciesProgram(f.ctx, row);
    expect(f.species).toHaveBeenCalledExactlyOnceWith(catalogue.rows);
    expect(f.speciesLook).toHaveBeenCalledExactlyOnceWith(catalogue.looks);
    expect(entryOwner(f.scope, 'species', row.catalogue.owner)).toBe(catalogue);
    expect(f.trace).toEqual(['actors', 'looks']);
    await expect(prepareClientSpeciesCatalogue(f.ctx, row)).rejects.toThrow('already prepared');
    expect(f.trace).toEqual(['actors', 'looks']);
    f.scope.dispose(); await expect(installClientSpeciesProgram(f.ctx, row)).rejects.toThrow('ended');
    expect(f.species).toHaveBeenCalledTimes(1);
  } finally { f.scope.dispose(); }
});

test('catalogue publication refuses changed original owners after either file read', async () => {
  for (const at of ['actors', 'looks']) {
    const f = fixture();
    try {
      f.onRead(hash => { if (hash === at) Object.assign(f.ctx.game, {runtime: legacyDouble<ShardRuntime>({world: legacyDouble<ShardWorld>({})})}); });
      await expect(prepareClientSpeciesCatalogue(f.ctx, row)).rejects.toThrow('owner changed');
      expect(() => entryOwner(f.scope, 'species', row.catalogue.owner)).toThrow('Missing live entry owner');
      expect(f.species).not.toHaveBeenCalled();
    } finally { f.scope.dispose(); }
  }
});

test('species source grammar preserves the old source and refuses mixed or absent sources', () => {
  expect(parse(ClientSpeciesProgramSchema, {kind: 'species.program', library: 'animals'})).toEqual({kind: 'species.program', library: 'animals', shove: false});
  for (const input of [{kind: 'species.program'}, {...row, library: 'animals'}, {...row, shove: true}, {...row, homes: {}}])
    expect(() => parse(ClientSpeciesProgramSchema, input)).toThrow('Species program requires one source');
});
