import { afterEach, expect, it } from 'vitest';
import { app } from '../src/engine/app/runtime';
import { Scope } from '../src/engine/app/scope';
import { Flags } from '../src/engine/world/interact/flags';
import type { ItemFamily } from '../src/engine/combat/itemFamilies';
import { installShards, shards, shardContentIdentity } from '../src/game/shard/list';
import { parseShardSlug } from '../src/game/shard/slug';
import { bindRuntimeLedger, bindRuntimeQuest, bindRuntimeState } from '../src/game/shardfile/hybridRows';
import { shardItemFamilies } from '../src/game/shardfile/items';
import { parseShardfile } from '../src/game/shardfile/schema';
import manifest from '../src/shards/driftwood-isle/manifest';
import source from '../src/shards/driftwood-isle/shard.config';

const original = shards();
const identities = Object.fromEntries(original.flatMap(row => shardContentIdentity(row.slug) === row.slug ? [] : [[row.slug, shardContentIdentity(row.slug)]]));
const copy = { ...manifest, slug: parseShardSlug('driftwood-isle-legacy'), legacy: true as const };
const list = [...original.filter(row => row.slug !== copy.slug), copy];
afterEach(() => { installShards(original, identities); });

it('installs the generated inventory identities at the real composition root', () => {
  expect(Object.keys(identities)).toHaveLength(6);
  expect(identities['driftwood-isle-legacy']).toBe('driftwood-isle');
  expect(identities['nalati-grasslands-legacy']).toBe('nalati-grasslands');
});

it('maps only exact inventory rows, never an arbitrary suffix or the legacy flag alone', () => {
  installShards(list, {});
  expect(shardContentIdentity(copy.slug)).toBe(copy.slug);
  installShards(list, { [copy.slug]: manifest.slug });
  expect(shardContentIdentity(copy.slug)).toBe(manifest.slug);
  expect(shardContentIdentity('unregistered-legacy')).toBe('unregistered-legacy');
  expect(shardContentIdentity(manifest.slug)).toBe(manifest.slug);
  for (const invalid of [{ [copy.slug]: copy.slug }, { orphan: manifest.slug }, { [copy.slug]: 'missing' }, { [manifest.slug]: manifest.slug }]) {
    expect(() => installShards(list, invalid)).toThrow('inventoried copy');
    expect(shardContentIdentity(copy.slug)).toBe(manifest.slug); // refused installation is atomic
  }
});

it('resolves the original frozen item family names while keeping the foreign-family and shadowing refusals', () => {
  const family: ItemFamily = { kind: 'weapon', create: () => { throw new Error('Resolution must not construct a view'); } };
  const families = new Map([['driftwood-isle.wood', family]]);
  installShards(list, {});
  expect(() => shardItemFamilies(new Map(), { slug: shardContentIdentity(copy.slug), families })).toThrow('must be named');
  installShards(list, { [copy.slug]: manifest.slug });
  expect(shardItemFamilies(new Map(), { slug: shardContentIdentity(copy.slug), families }).get('driftwood-isle.wood')).toBe(family);
  expect(() => shardItemFamilies(families, { slug: shardContentIdentity(copy.slug), families })).toThrow('shadows');
  expect(() => shardItemFamilies(new Map(), { slug: shardContentIdentity(copy.slug), families: new Map([['foreign.wood', family]]) })).toThrow('must be named');
});

it('keeps shared content ids isolated in actual quest flags, host state and the emitting ledger, including reload', () => {
  installShards(list, { [copy.slug]: manifest.slug });
  const scope = new Scope('legacy-content-isolation');
  const runtime = source.runtime;
  if (runtime === null) throw new Error('Missing runtime fixture');
  const stateSource = parseShardfile({ ...source, runtime: { ...runtime, binds: [...runtime.binds ?? [], 'state'] },
    state: { version: 1, sharedOwner: 'host', playerKey: 'actorId', player: [], shared: [
      { id: 1, name: 'driftwood.switch', type: 'bool', privacy: 'host', default: false },
    ] } });
  const frozen = { ...stateSource, identity: { ...stateSource.identity, slug: copy.slug } };
  try {
    const mainState = bindRuntimeState({ app, scope }, stateSource, 'driftwood.switch', () => null);
    const copyState = bindRuntimeState({ app, scope }, frozen, 'driftwood.switch', () => null);
    expect(copyState.write(true)).toBe(true); expect(mainState.read()).toBe(false);
    expect(bindRuntimeState({ app, scope }, frozen, 'driftwood.switch', () => null).read()).toBe(true);
    const primaryFlags = new Flags(manifest.slug), legacyFlags = new Flags(copy.slug), quest = source.quests.quests[0];
    if (quest === undefined) throw new Error('Missing quest fixture');
    legacyFlags.set(quest.completeFlag);
    expect(new Flags(manifest.slug).has(quest.completeFlag)).toBe(false);
    expect(new Flags(copy.slug).has(quest.completeFlag)).toBe(true);
    const mainFacts = bindRuntimeLedger({ app }, stateSource, manifest.slug);
    const copyFacts = bindRuntimeLedger({ app }, frozen, copy.slug);
    copyFacts('driftwood.crab10', 'same-entity');
    expect(copyFacts.achievement('crab10')?.count).toBe(1);
    expect(mainFacts.achievement('crab10')).toBeUndefined();
    mainFacts('driftwood.crab10', 'same-entity');
    expect(mainFacts.achievement('crab10')?.count).toBe(1);
    expect(bindRuntimeLedger({ app }, frozen, copy.slug).achievement('crab10')?.count).toBe(1);
    const primaryQuest = bindRuntimeQuest({ app, scope }, stateSource, quest.id, { flags: primaryFlags, facts: mainFacts });
    const frozenQuest = bindRuntimeQuest({ app, scope }, frozen, quest.id, { flags: legacyFlags, facts: copyFacts });
    expect(primaryQuest.state.isComplete).toBe(false); expect(frozenQuest.state.isComplete).toBe(true);
    scope.onDispose(() => { primaryQuest.state.dispose(); frozenQuest.state.dispose(); });
    expect(localStorage.getItem(`wildshard.save.v2.${manifest.slug}`)).not.toBe(localStorage.getItem(`wildshard.save.v2.${copy.slug}`));
    expect(localStorage.getItem('wildshard.save.v2.profile')).toContain(copy.slug);
  } finally { scope.dispose(); }
});

it('never calls a primary legacy reader for a fresh frozen field, while normal migration and copy reload remain intact', () => {
  installShards(list, { [copy.slug]: manifest.slug });
  const scope = new Scope('legacy-content-migration');
  const runtime = source.runtime;
  if (runtime === null) throw new Error('Missing runtime fixture');
  const primary = parseShardfile({ ...source, runtime: { ...runtime, binds: [...runtime.binds ?? [], 'state'] },
    state: { version: 1, sharedOwner: 'host', playerKey: 'actorId', player: [], shared: [
      { id: 1, name: 'driftwood.migration', type: 'string', privacy: 'host', default: '{}' },
    ] } });
  const frozen = { ...primary, identity: { ...primary.identity, slug: copy.slug } };
  let reads = 0;
  const legacyRead = (): string => { reads++; return '{"primary-owned":true}'; };
  try {
    const main = bindRuntimeState({ app, scope }, primary, 'driftwood.migration', legacyRead);
    expect(main.read()).toBe('{"primary-owned":true}'); expect(reads).toBe(1);
    const separate = bindRuntimeState({ app, scope }, frozen, 'driftwood.migration', legacyRead);
    expect(separate.read()).toBe('{}'); expect(reads).toBe(1);
    expect(separate.write('{"copy-owned":true}')).toBe(true);
    expect(bindRuntimeState({ app, scope }, frozen, 'driftwood.migration', legacyRead).read()).toBe('{"copy-owned":true}');
    expect(main.read()).toBe('{"primary-owned":true}'); expect(reads).toBe(1);
  } finally { scope.dispose(); }
});

it('keeps both reviewed gameplay selectors on content identity without changing their save identity', () => {
  const nalati = original.find(row => row.slug === 'nalati-grasslands');
  if (nalati === undefined) throw new Error('Missing Nalati fixture');
  const nalatiCopy = { ...nalati, slug: parseShardSlug('nalati-grasslands-legacy'), legacy: true as const };
  installShards([...list.filter(row => row.slug !== nalatiCopy.slug), nalatiCopy], { [copy.slug]: manifest.slug, [nalatiCopy.slug]: nalati.slug });
  for (const [primary, frozen] of [['driftwood-isle', 'driftwood-isle-legacy'], ['nalati-grasslands', 'nalati-grasslands-legacy']] as const) {
    expect(shardContentIdentity(frozen)).toBe(primary);
    expect(frozen).not.toBe(primary);
  }
});

it('preserves installed exact aliases across registry refreshes and drops aliases when their pair is absent', () => {
  installShards(list, { [copy.slug]: manifest.slug });
  installShards([...list]);
  expect(shardContentIdentity(copy.slug)).toBe(manifest.slug);
  installShards(list.filter(row => row.slug !== copy.slug));
  expect(shardContentIdentity(copy.slug)).toBe(copy.slug);
});
