import originalPersistence from './fixtures/nalati-persistence-original.json' with { type: 'json' };
import { expect, test,vi } from 'vitest';
import { entryOwner } from '../src/game/shardfile/entryOwners';
import { enteredAdventurePersistence } from '../src/game/quest/chapterBindings';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import type { ShardContext } from '../src/game/plugin/context';
import type { ShardRuntime } from '../src/game/shard/runtime';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';
import { Scope } from '../src/engine/app/scope';
import { app } from '../src/engine/app/runtime';
import { bossesSave, elitesSave, progressSave } from '../src/game/saves';
import { legacyAdventureNames,legacyAdventureCosmetics,legacyAdventureBond } from '../src/game/quest/legacyRecords';
import { bindAdventurePersistence, installClientAdventurePersistence } from '../src/game/quest/persistence';
import source from './fixtures/nalati-product-source';
import { nalatiPersistenceRows } from '../src/shards/nalati-grasslands/generators/persistence';
import { CLIENT_FEATURES } from '../src/game/shardfile/clientPlan';

const rows = nalatiPersistenceRows();

test('Nalati adopts old saves, replays stable feat identities and reloads only declared records', () => {
  expect(rows).toEqual(originalPersistence);
  const slug = source.identity.slug, instance = 'declared-nalati-old-save';
  const scope = new Scope(instance), next = new Scope(`${instance}-reload`);
  const previous = { bosses: bossesSave.read(slug), elites: elitesSave.read(slug), progress: progressSave.read(slug) };
  const bosses = { 'golden-king': { defeated: true, rewardTaken: true, kills: 2 } };
  const elites = { aqbars: { timer: 0, discovered: true, skinTaken: true, kills: 1, retired: false } };
  const legacy={names:'orchard.old-names',cosmetics:'orchard.old-coats',bond:'orchard.old-bond'},policy={...rows,legacy};
  const oldNames=legacyAdventureNames(legacy.names),oldCosmetics=legacyAdventureCosmetics(legacy.cosmetics),oldBond=legacyAdventureBond(legacy.bond);
  oldNames.write({'Camp horse|horse:camp-bay':'Kara Jorga'},slug);oldCosmetics.write({owned:['irbis-sabre'],worn:{sabre:'irbis-sabre'}},slug);oldBond.write('1',slug);
  const reads=vi.spyOn(oldNames,'read');
  bossesSave.write(bosses, slug); elitesSave.write(elites, slug);
  progressSave.write({ ...previous.progress, counts: { wolf5: 3, wolf25: 3, tulpar: 1 } }, slug);
  try {
    const saved = bindAdventurePersistence({ app, scope }, source, policy, instance);
    expect(saved.bosses.read()).toEqual(bosses); expect(saved.elites.read()).toEqual(elites);
    expect(saved.names.read()).toEqual({ 'Camp horse|horse:camp-bay': 'Kara Jorga' });
    expect(saved.flags.all).toEqual(expect.arrayContaining(['dead:golden-king', 'felled:aqbars', 'owned:irbis-sabre', 'tamed:horse']));
    expect(saved.flags.has('tamed:argymaq')).toBe(false); expect(reads).toHaveBeenCalledTimes(1);
    expect(saved.facts.achievement('wolf5')?.count).toBe(3);
    expect(saved.facts.achievement('tulpar')?.count ?? 0).toBe(0);
    saved.kill('wolf', 'alpha'); saved.feat('tame', 1); saved.feat('tame', 1);
    expect(saved.facts.achievement('wolf5')?.count).toBe(4);
    expect(saved.facts.achievement('wolf25')?.count).toBe(4);
    expect(saved.facts.achievement('alpha')?.count).toBe(1);
    expect(saved.facts.achievement('tame')?.count).toBe(1);
    // The same historical receipt must be a duplicate, never a fifth kill.
    saved.facts('nalati.feat.wolf5', 'feat.wolf5.4');
    expect(saved.facts.achievement('wolf5')?.count).toBe(4);
    saved.bond.write('argymaq'); expect(saved.flags.has('tamed:argymaq')).toBe(true);
    saved.names.write({ tulpar: 'Argymaq' });
    expect(() => saved.elites.write({ ...elites, aqbars: { ...elites.aqbars, kills: -1 } })).toThrow();
    expect(() => saved.names.read('another-cell')).toThrow('another instance');
    scope.dispose();
    bossesSave.write({}, slug); elitesSave.write({}, slug);
    progressSave.write({ ...previous.progress, counts: {} }, slug);
    const resumed = bindAdventurePersistence({ app, scope: next }, source, policy, instance);
    expect(resumed.bosses.read()).toEqual(bosses); expect(resumed.elites.read()).toEqual(elites);
    expect(resumed.names.read()).toEqual({ tulpar: 'Argymaq' });
    expect(resumed.bond.read()).toBe('argymaq'); expect(reads).toHaveBeenCalledTimes(1);
    expect(resumed.facts.achievement('wolf5')?.count).toBe(4);
    resumed.kill('wolf'); expect(resumed.facts.achievement('wolf5')?.count).toBe(5);
    expect(() => saved.bosses.read()).toThrow('disposed');
  } finally {
    reads.mockRestore();scope.dispose(); next.dispose();
    bossesSave.write(previous.bosses, slug); elitesSave.write(previous.elites, slug); progressSave.write(previous.progress, slug);
  }
});


test('the declared persistence id lends the same saved owner and retires with its entered scope', async () => {
  const scope = new Scope('adventure-row'), world = legacyDouble<NonNullable<ShardRuntime['world']>>({ chunk: legacyDouble<NonNullable<ShardRuntime['world']>['chunk']>({ slug: 'nalati-grasslands' }) });
  const runtime = legacyDouble<ShardRuntime>({ world });
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source, sections: new Map(), files: new Map(), read: () => Promise.reject(new Error('No fixture byte read')) });
  const read = vi.spyOn(product, 'json').mockResolvedValue(rows);
  const ctx = legacyDouble<ShardContext>({ scope, app, product, game: legacyDouble<ShardContext['game']>({ runtime }) });
  try {
    await installClientAdventurePersistence(ctx, { kind: 'state.adventure', file: 'quests/persistence.json', id: 'saved' });
    expect(entryOwner(scope, 'adventure', 'saved')).toBe(enteredAdventurePersistence(scope));
    expect(read).toHaveBeenCalledExactlyOnceWith('quests/persistence.json');
    scope.dispose(); expect(() => entryOwner(scope, 'adventure', 'saved')).toThrow();
  } finally { read.mockRestore(); scope.dispose(); }
});

test('replacing the persistence world during admission publishes no saved owner', async () => {
  const scope = new Scope('adventure-row-replaced'), world = legacyDouble<NonNullable<ShardRuntime['world']>>({ chunk: legacyDouble<NonNullable<ShardRuntime['world']>['chunk']>({ slug: 'nalati-grasslands' }) });
  const runtime = legacyDouble<ShardRuntime>({ world });
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source, sections: new Map(), files: new Map(), read: () => Promise.reject(new Error('No fixture byte read')) });
  const read = vi.spyOn(product, 'json').mockImplementation(() => { runtime.world = null; return Promise.resolve(rows); });
  const ctx = legacyDouble<ShardContext>({ scope, app, product, game: legacyDouble<ShardContext['game']>({ runtime }) });
  try {
    await expect(installClientAdventurePersistence(ctx, { kind: 'state.adventure', file: 'quests/persistence.json', id: 'saved' })).rejects.toThrow('changed during admission');
    expect(() => entryOwner(scope, 'adventure', 'saved')).toThrow();
    expect(() => enteredAdventurePersistence(scope)).toThrow('not entered');
  } finally { read.mockRestore(); scope.dispose(); }
});

test('declared progress binds the original saved owner before plugin play and refuses retirement', async () => {
  const scope = new Scope('adventure-progress'), trace: string[] = [];
  const progress = legacyDouble<NonNullable<ShardRuntime['play']>['progress']>({bindLedger: () => { trace.push('bind ledger'); }});
  const runtime = legacyDouble<ShardRuntime>({play: legacyDouble<NonNullable<ShardRuntime['play']>>({progress})});
  const ctx = legacyDouble<ShardContext>({scope, game: legacyDouble<ShardContext['game']>({runtime})});
  const owner = bindAdventurePersistence({app, scope}, source, rows, 'progress-feature');
  const feature = CLIENT_FEATURES['state.adventure'].preparePlay;
  if (feature === undefined) throw new Error('Missing progress phase');
  try {
    expect(CLIENT_FEATURES['state.adventure'].needsWorldLooks).toBe(false);
    expect(feature.rank).toBe(-100);
    expect(feature.when?.({kind: 'state.adventure', file: 'quests/persistence.json'})).toBe(false);
    const row = {kind: 'state.adventure', file: 'quests/persistence.json', id: 'progress', progress: true} as const;
    expect(feature.when?.(row)).toBe(true);
    await feature.install(ctx, row, scope); trace.push('plugin play');
    expect(trace).toEqual(['bind ledger', 'plugin play']);
    expect(enteredAdventurePersistence(scope)).toBe(owner);
    scope.dispose(); expect(() => feature.install(ctx, row, scope)).toThrow('not entered');
    expect(trace).toEqual(['bind ledger', 'plugin play']);
  } finally { scope.dispose(); }
});
