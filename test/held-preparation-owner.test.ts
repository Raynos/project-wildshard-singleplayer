import { expect, test, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import type { ShardContext } from '../src/game/plugin/context';
import type { ShardRuntime } from '../src/game/shard/runtime';
import { HeldClaims } from '../src/game/loadout/claims';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { parseItems } from '../src/format/items';
import items from '../src/shards/nine-dragon-stack/data/items.json' with { type: 'json' };
import { legacyDouble } from './fake/FakeGame';

const rows = { kind: 'declared-primary', primary: { item: 'weapon.jian', blade: 'wood', file: 'weapons/presentation.json' }, tools: ['tool.fei-zhua'] };
const presentation = new TextEncoder().encode(JSON.stringify({ portraitFov: 78, aim: {}, view: {} }));
function fixture(pending?: Promise<Uint8Array>) {
  const parent = new Scope('held-owner-parent'), scope = parent.child('held-owner');
  const slug = 'held-owner-fixture';
  const source = { ...emptyShardfile({ slug, name: 'Held owner fixture', author: 'Fixture', revision: 1, seed: 7 }), items: parseItems(items) };
  const read = vi.fn(() => pending ?? Promise.resolve(presentation));
  const product = createShardProduct({ slug, revision: 1, shardfile: source, sections: new Map([['held/arms', rows]]),
    files: new Map([[rows.primary.file, { hash: 'a'.repeat(64), url: '/fixture/presentation.json' }]]), read });
  const runtime = legacyDouble<ShardRuntime>({ world: legacyDouble<NonNullable<ShardRuntime['world']>>({}) });
  const weapon = vi.fn<ShardContext['rows']['weapon']>();
  const ctx = legacyDouble<ShardContext>({ scope, product, game: legacyDouble<ShardContext['game']>({ runtime }),
    rows: legacyDouble<ShardContext['rows']>({ weapon }) });
  return { parent, scope, slug, read, runtime, ctx, weapon };
}

test('unchanged preparation publishes once on its original scope without constructing equipment', async () => {
  const f = fixture();
  try {
    const owner = await HeldClaims.prepare(f.ctx);
    expect(owner.rows).toEqual(rows);expect(HeldClaims.current(f.slug)).toBe(owner);
    expect(f.read).toHaveBeenCalledOnce();expect(f.weapon).not.toHaveBeenCalled();
    f.scope.dispose();expect(() => HeldClaims.current(f.slug)).toThrow('not prepared');
  } finally { f.parent.dispose(); }
});

test.each(['scope', 'product', 'game', 'runtime', 'world'])('replaced %s during preparation never publishes a held owner', async owner => {
  let finish: ((bytes: Uint8Array) => void) | undefined;
  const pending = new Promise<Uint8Array>(resolve => { finish = resolve; });
  const f = fixture(pending), replacement = fixture();
  try {
    const preparing = HeldClaims.prepare(f.ctx);
    switch (owner) {
      case 'scope': Object.defineProperty(f.ctx, 'scope', { value: replacement.scope }); break;
      case 'product': Object.defineProperty(f.ctx, 'product', { value: replacement.ctx.product }); break;
      case 'game': Object.defineProperty(f.ctx, 'game', { value: replacement.ctx.game }); break;
      case 'runtime': Object.defineProperty(f.ctx.game, 'runtime', { value: replacement.runtime }); break;
      case 'world': f.runtime.world = replacement.runtime.world; break;
      default: throw new Error('Unknown owner fixture');
    }
    if (finish === undefined) throw new Error('Missing deferred product read');
    finish(presentation);
    await expect(preparing).rejects.toThrow('replaced during preparation');
    expect(f.weapon).not.toHaveBeenCalled();expect(() => HeldClaims.current(f.slug)).toThrow('not prepared');
  } finally { f.parent.dispose();replacement.parent.dispose(); }
});

test.each([false, true])('retirement during preparation never publishes a held owner (ancestor: %s)', async ancestor => {
  let finish: ((bytes: Uint8Array) => void) | undefined;
  const f = fixture(new Promise<Uint8Array>(resolve => { finish = resolve; }));
  let retirement: Generator | undefined;
  try {
    const preparing = HeldClaims.prepare(f.ctx);
    if (ancestor) {
      f.parent.onDispose(() => undefined);retirement = f.parent.disposeSteps();retirement.next();
      expect(f.scope.disposing).toBe(true);expect(f.scope.disposed).toBe(false);
    } else f.scope.dispose();
    if (finish === undefined) throw new Error('Missing deferred product read');
    finish(presentation);
    await expect(preparing).rejects.toThrow('owner ended during preparation');
    expect(f.weapon).not.toHaveBeenCalled();expect(() => HeldClaims.current(f.slug)).toThrow('not prepared');
  } finally {
    if (retirement !== undefined) for (const _step of retirement) { /* Finish original disposal. */ }
    f.parent.dispose();
  }
});
