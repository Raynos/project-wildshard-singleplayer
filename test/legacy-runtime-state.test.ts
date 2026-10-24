import { afterEach, beforeEach, expect, test } from 'vitest';
import { SaveStore } from '../src/engine/saves/store';
import { Scope } from '../src/engine/app/scope';
import { installRuntimeState } from '../src/game/shardfile/runtimeState';
import { bindRuntimeState } from '../src/game/plugin/headless';
import { installShards, legacyContentIdentity, shards } from '../src/game/shard/list';
import { sourceManifest, type ShardContext } from '../src/game/plugin/context';
import source from '../src/shards/pine-hollow-legacy/shard.config';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';
import { KING_FIELDS } from '../src/shards/pine-hollow/generators/kingDecision';

const modern = { ...source, identity: { ...source.identity, slug: 'pine-hollow' },
  state: { ...source.state, shared: [...source.state.shared, ...KING_FIELDS] } };
let previous: ReturnType<typeof shards>, identities: Readonly<Record<string, string>>;
beforeEach(() => {
  try { previous = shards(); } catch { previous = []; }
  identities = Object.fromEntries(previous.flatMap(row => {
    const primary = legacyContentIdentity(row.slug);
    return primary === undefined ? [] : [[row.slug, primary]];
  }));
  installShards([sourceManifest(modern), { ...sourceManifest(source), legacy: true }],
    { 'pine-hollow-legacy': 'pine-hollow' });
});
afterEach(() => { installShards(previous, identities); });

function fixture() {
  const store = new SaveStore({ local: null, session: null });
  const scope = new Scope('legacy-state');
  const field = installRuntimeState(store, scope, modern, 'pine-hollow', 'pine.bosses', () => '{"modern":true}');
  return { store, scope, field };
}

test('the strict guard still refuses the observed twenty-to-five field change', () => {
  const { store, scope } = fixture();
  try {
    const before = JSON.stringify(store.inspectShard({ id: 'pine-hollow' }));
    expect(() => installRuntimeState(store, scope, source, 'pine-hollow', 'pine.bosses', () => null))
      .toThrow('State change requires an explicit valid migration');
    expect(JSON.stringify(store.inspectShard({ id: 'pine-hollow' }))).toBe(before);
  } finally { scope.dispose(); }
});

test('registered legacy hardcoded primary binds its own doc and survives re-entry', () => {
  const { store, scope, field } = fixture();
  const entered = new Scope('legacy-entered');
  try {
    const before = JSON.stringify(store.inspectShard({ id: 'pine-hollow' }));
    const legacy = bindRuntimeState({ app: legacyDouble<ShardContext['app']>({ saves: store }), scope: entered }, source, 'pine.bosses', () => 'ignored', 'pine-hollow');
    expect(legacy.read()).toBe('{}');
    legacy.write('{"legacy":true}');
    expect(field.read()).toBe('{"modern":true}');
    expect(JSON.stringify(store.inspectShard({ id: 'pine-hollow' }))).toBe(before);
    entered.dispose();
    expect(() => legacy.read()).toThrow('disposed');
    const reentered = new Scope('legacy-reentered');
    try {
      expect(bindRuntimeState({ app: legacyDouble<ShardContext['app']>({ saves: store }), scope: reentered }, source, 'pine.bosses', () => 'ignored', 'pine-hollow').read())
        .toBe('{"legacy":true}');
      expect(bindRuntimeState({ app: legacyDouble<ShardContext['app']>({ saves: store }), scope: reentered }, source, 'pine.bosses', () => 'ignored').read())
        .toBe('{"legacy":true}');
    } finally { reentered.dispose(); }
  } finally { entered.dispose(); scope.dispose(); }
});

test('ordinary and unregistered suffix sources retain the strict refusal', () => {
  const { store, scope } = fixture();
  try {
    for (const slug of ['pine-hollow', 'unregistered-legacy']) {
      const other = { ...source, identity: { ...source.identity, slug } };
      expect(() => bindRuntimeState({ app: legacyDouble<ShardContext['app']>({ saves: store }), scope }, other, 'pine.bosses', () => null, 'pine-hollow'))
        .toThrow('State change requires an explicit valid migration');
    }
    const region = bindRuntimeState({ app: legacyDouble<ShardContext['app']>({ saves: store }), scope }, source, 'pine.bosses', () => null, 'pine-region');
    region.write('{"region":true}');
    expect(bindRuntimeState({ app: legacyDouble<ShardContext['app']>({ saves: store }), scope }, source, 'pine.bosses', () => null).read()).toBe('{}');
    expect(region.read()).toBe('{"region":true}');
  } finally { scope.dispose(); }
});
