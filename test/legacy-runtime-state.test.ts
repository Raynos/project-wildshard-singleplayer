import { afterEach, beforeEach, expect, test } from 'vitest';
import { SaveStore } from '../src/engine/saves/store';
import { Scope } from '../src/engine/app/scope';
import { installRuntimeState } from '../src/game/shardfile/runtimeState';
import { bindRuntimeState } from '../src/game/plugin/headless';
import { installShards, legacyContentIdentity, shards } from '../src/game/shard/list';
import { sourceManifest, type ShardContext } from '../src/game/plugin/context';
import frozen from '../src/shards/nine-dragon-stack-legacy/shard.config';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';
// The remaining frozen entry exercises the shared migration bridge. These
// five versus twenty fields are an explicit state-law fixture, not Pine code.
if(frozen.runtime===null)throw new Error('Missing remaining frozen runtime fixture');
const source = { ...frozen, runtime:{...frozen.runtime,binds:['items' as const,'state' as const]},
  state: { ...frozen.state, shared: Array.from({length:5},(_,id)=>({
  id:id+1,name:`native.fixture.${id}`,type:'string' as const,privacy:'host' as const,default:'{}',
})) } };
const addedFields = Array.from({length:15},(_,id)=>({
  id:id+100,name:`native.extra.${id}`,type:'f64' as const,privacy:'public' as const,default:0,min:-10000,max:10000,
}));

const modern = { ...source, identity: { ...source.identity, slug: 'nine-dragon-stack' },
  state: { ...source.state, shared: [...source.state.shared, ...addedFields] } };
let previous: ReturnType<typeof shards>, identities: Readonly<Record<string, string>>;
beforeEach(() => {
  try { previous = shards(); } catch { previous = []; }
  identities = Object.fromEntries(previous.flatMap(row => {
    const primary = legacyContentIdentity(row.slug);
    return primary === undefined ? [] : [[row.slug, primary]];
  }));
  installShards([sourceManifest(modern), { ...sourceManifest(source), legacy: true }],
    { 'nine-dragon-stack-legacy': 'nine-dragon-stack' });
});
afterEach(() => { installShards(previous, identities); });

function fixture() {
  const store = new SaveStore({ local: null, session: null });
  const scope = new Scope('legacy-state');
  const field = installRuntimeState(store, scope, modern, 'nine-dragon-stack', 'native.fixture.2', () => '{"modern":true}');
  return { store, scope, field };
}

test('the strict guard still refuses the observed twenty-to-five field change', () => {
  const { store, scope } = fixture();
  try {
    const before = JSON.stringify(store.inspectShard({ id: 'nine-dragon-stack' }));
    expect(() => installRuntimeState(store, scope, source, 'nine-dragon-stack', 'native.fixture.2', () => null))
      .toThrow('State change requires an explicit valid migration');
    expect(JSON.stringify(store.inspectShard({ id: 'nine-dragon-stack' }))).toBe(before);
  } finally { scope.dispose(); }
});

test('registered legacy hardcoded primary binds its own doc and survives re-entry', () => {
  const { store, scope, field } = fixture();
  const entered = new Scope('legacy-entered');
  try {
    const before = JSON.stringify(store.inspectShard({ id: 'nine-dragon-stack' }));
    const legacy = bindRuntimeState({ app: legacyDouble<ShardContext['app']>({ saves: store }), scope: entered }, source, 'native.fixture.2', () => 'ignored', 'nine-dragon-stack');
    expect(legacy.read()).toBe('{}');
    legacy.write('{"legacy":true}');
    expect(field.read()).toBe('{"modern":true}');
    expect(JSON.stringify(store.inspectShard({ id: 'nine-dragon-stack' }))).toBe(before);
    entered.dispose();
    expect(() => legacy.read()).toThrow('disposed');
    const reentered = new Scope('legacy-reentered');
    try {
      expect(bindRuntimeState({ app: legacyDouble<ShardContext['app']>({ saves: store }), scope: reentered }, source, 'native.fixture.2', () => 'ignored', 'nine-dragon-stack').read())
        .toBe('{"legacy":true}');
      expect(bindRuntimeState({ app: legacyDouble<ShardContext['app']>({ saves: store }), scope: reentered }, source, 'native.fixture.2', () => 'ignored').read())
        .toBe('{"legacy":true}');
    } finally { reentered.dispose(); }
  } finally { entered.dispose(); scope.dispose(); }
});

test('ordinary and unregistered suffix sources retain the strict refusal', () => {
  const { store, scope } = fixture();
  try {
    for (const slug of ['nine-dragon-stack', 'unregistered-legacy']) {
      const other = { ...source, identity: { ...source.identity, slug } };
      expect(() => bindRuntimeState({ app: legacyDouble<ShardContext['app']>({ saves: store }), scope }, other, 'native.fixture.2', () => null, 'nine-dragon-stack'))
        .toThrow('State change requires an explicit valid migration');
    }
    const region = bindRuntimeState({ app: legacyDouble<ShardContext['app']>({ saves: store }), scope }, source, 'native.fixture.2', () => null, 'native-region');
    region.write('{"region":true}');
    expect(bindRuntimeState({ app: legacyDouble<ShardContext['app']>({ saves: store }), scope }, source, 'native.fixture.2', () => null).read()).toBe('{}');
    expect(region.read()).toBe('{"region":true}');
  } finally { scope.dispose(); }
});
