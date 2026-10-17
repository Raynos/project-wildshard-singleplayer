// @vitest-environment happy-dom
import signalModels from '../src/shards/sunscar-dunes/data/creatureModels.generated.json' with { type: 'json' };
import { output as signalOutput } from '../src/shards/sunscar-dunes/generators/output';
import { readSpeciesProgram, readSpeciesPrograms } from '../src/format/speciesPrograms';
import skyRows from '../src/shards/far-reach/data/runtimeRows.generated.json' with { type: 'json' };
import signalRows from '../src/shards/sunscar-dunes/data/runtimeRows.generated.json' with { type: 'json' };
import { SKY_RUNTIME_ROWS } from '../src/shards/far-reach/generators/rows/runtimeRows';
import { SIGNAL_RUNTIME_ROWS } from '../src/shards/sunscar-dunes/generators/rows/runtimeRows';
import { expect, test } from 'vitest';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { createLevelInstallation } from '../src/engine/level/installation';
import { shardContext, type ShardContext } from '../src/game/plugin/context';
import { HybridRuntimePlugin, type HybridRuntimeRows } from '../src/game/plugin/headless';
import { createShardProduct, absentShardProduct, type ShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { MANIFEST as TEMPLATE } from '../src/shards/_template/discovery.generated';

class ProductRows extends HybridRuntimePlugin {
  readonly events: string[] = [];
  protected rows(product: ShardProduct): HybridRuntimeRows {
    this.events.push('rows');
    return { expose: 'productRows', strings: product.strings(['welcome']), complete: 'complete', encounters: [],
      weapon: { id: 'weapon.fixture', ui: { name: 'Fixture', icon: 'sword', touch: 'melee', lockOn: false, melee: true, tracers: false, swapIcon: 'x' },
        meta: { name: 'Fixture', icon: 'sword', blurb: '', category: 'weapon' } },
      species: () => ({ rows: [], looks: [], witness: () => null }) };
  }
  protected build(): void { this.events.push('build'); }
  protected install(): void { /* No play services in this world-stage fixture. */ }
}
const source = emptyShardfile({ slug: 'product-rows', name: 'Rows', author: 'Wildshard', revision: 1, seed: 1 });
const product = (): ShardProduct => createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source,
  sections: new Map([['ui/strings', { welcome: 'Welcome' }]]), files: new Map(), read: () => Promise.reject(new Error('No files')) });
function context(scope: Scope, value: ShardProduct): ShardContext {
  const level = createLevelInstallation(new App(), scope, {}, () => ({ set: () => { /* Fixture progress. */ }, detail: () => { /* Fixture progress. */ } }));
  return shardContext(level.context, TEMPLATE, { shard: TEMPLATE, rows: new Map(), bag: {
    tab: () => () => { /* No external service. */ }, fragment: () => () => { /* No external service. */ } } }, value);
}

test('hybrid rows read the admitted product once before world build and cannot switch products', async () => {
  const scope = new Scope('product-rows'), p = product(), plugin = new ProductRows();
  try {
    expect(plugin.events).toEqual([]);
    const ctx = context(scope, p);
    await plugin.world(ctx); await plugin.world(ctx);
    expect(plugin.events).toEqual(['rows', 'build', 'build']);
    await expect(plugin.world({ ...ctx, product: product() })).rejects.toThrow('another product');
    expect(plugin.events).toEqual(['rows', 'build', 'build']);
  } finally { scope.dispose(); }
});

test('an absent or refused product cannot publish rows or build the world', async () => {
  const scope = new Scope('absent-product-rows'), plugin = new ProductRows();
  try {
    await expect(plugin.world(context(scope, absentShardProduct('missing')))).rejects.toMatchObject({ reason: 'absent' });
    expect(plugin.events).toEqual([]);
    const p = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source, sections: new Map(), files: new Map(), read: () => Promise.reject(new Error('No files')) });
    await expect(plugin.world(context(scope, p))).rejects.toMatchObject({ reason: 'missing-strings' });
    expect(plugin.events).toEqual(['rows']);
    await plugin.world(context(scope, product()));
    expect(plugin.events).toEqual(['rows', 'rows', 'build']);
  } finally { scope.dispose(); }
});

// The portable producer must retain every page owner binding and native recipe.
test.each([['Sky Reach', skyRows, SKY_RUNTIME_ROWS], ['Signal Dunes', signalRows, SIGNAL_RUNTIME_ROWS]])(
  '%s emits the complete checked hybrid rows without changing values', (_name, emitted, authored) => {
    expect(emitted).toStrictEqual(authored);
  });

// Explorer and page use the same generated body catalogue and exact clip rows.
test('Signal creature models retain body order, framing and page rig contracts', () => {
  const species = signalRows.species;
  const bytes = signalOutput.platform.files.get('sections/actors/species-programs.json');
  if (bytes === undefined) throw new Error('Missing emitted Signal species section');
  const admitted = readSpeciesPrograms(JSON.parse(new TextDecoder().decode(bytes)));
  expect(admitted.page).toStrictEqual(species.page);
  expect(admitted.program).toStrictEqual(readSpeciesProgram(species.program));
  expect(admitted.native).toEqual([]);
  expect(signalModels.map(row => row.body)).toEqual(['ray', 'skitterer', 'strider', 'matriarch']);
  expect(signalModels.map(row => 'scale' in row.specimen ? row.specimen.scale : 1)).toEqual([1, 1, 1, 3.6]);
  expect(species.library.looks.map(row => row.body)).toEqual(signalModels.map(row => row.body));
  expect(species.library.looks.map(row => row.look.species)).toEqual(species.page.map(row => row.id));
  expect(species.library.looks.map(row => row.clips.length)).toEqual([3, 7, 12, 5]);
});
