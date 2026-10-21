// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { createLevelInstallation } from '../src/engine/level/installation';
import { WorldRegistry } from '../src/engine/world/registry';
import { shardContext } from '../src/game/plugin/context';
import { QuestViews } from '../src/game/plugin/ui';
import { RetainedRuntimeHooks } from '../src/game/shard/retainedHooks';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { parseShardSlug } from '../src/game/shard/slug';
import { MANIFEST as TEMPLATE } from '../src/shards/_template/discovery.generated';
import source from '../src/shards/driftwood-isle/shard.config';
import { TRADER_STALL as coinRows } from '../src/shards/driftwood-isle/generators/questShop';
import { TRADER_STALL as barterRows } from '../src/shards/pine-hollow/generators/questShop';
import { TRADES } from '../src/shards/pine-hollow/generators/trades';
import { FIGURE_CATALOGUE } from '../src/shards/pine-hollow/generators/figureCatalogue';
import { Owned } from '../src/game/loot/Owned';
import { Purse, publishPurse, enteredPurse } from '../src/game/loot/Purse';
import { installQuestTrader, installQuestShop } from '../src/game/quest/trader';

function page(loot: unknown = source.rows.loot) {
  const scope = new Scope('shop-entry'), host = new App(), events: string[] = [], owned = new Owned('shop-entry');
  for (const id of owned.all) owned.revoke(id);
  const product = createShardProduct({ slug: source.identity.slug, revision: source.identity.revision, shardfile: source,
    sections: new Map([['economy/loot', { rows: { loot } }]]), files: new Map(), read: () => Promise.reject(new Error('No shop file read')) });
  const level = createLevelInstallation(host, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const ctx = shardContext(level.context, { ...TEMPLATE, slug: parseShardSlug(source.identity.slug) }, { shard: TEMPLATE, rows: new Map(), bag: { tab: () => () => undefined, fragment: () => () => undefined } }, product);
  const pack = new Map<string, number>(), inventory = {
    count: (id: string) => pack.get(id) ?? 0,
    take: (id: string, n: number) => { if ((pack.get(id) ?? 0) < n) return false; pack.set(id, (pack.get(id) ?? 0) - n); events.push(`take:${id}:${n}`); return true; },
    add: (id: string, n: number) => { pack.set(id, (pack.get(id) ?? 0) + n); events.push(`add:${id}:${n}`); },
  };
  const hud = { holdPause: false, entered: true, toast: (text: string) => { events.push(text); }, setPaused: () => undefined };
  const weapons = { stowed: false, setEnabled: (on: boolean) => { events.push(`weapons:${on}`); } };
  Object.defineProperty(ctx.game, 'runtime', { value: {
    world: { registry: new WorldRegistry(), player: { position: new Vector3(), yaw: 0, pitch: 0, swimming: false } },
    play: { owned, inventory, hud, weapons, menu: { isOpen: false, close: () => undefined }, nolock: true, touchUi: () => true,
      audio: { voices: { play: (id: string) => { events.push(id); } } } }, interactables: [],
  } });
  return { ctx, scope, events, owned, pack, hud, weapons };
}

test('the real coin cards spend the entered purse before grants and keep original feedback and modal hooks', () => {
  vi.useFakeTimers();
  const { ctx, scope, events, owned, hud, weapons } = page();
  const { placement: _placement, view: _view, ...rows } = coinRows;
  const purse = new Purse('shop-entry', { read: () => 12, write: n => { events.push(`saved:${n}`); return true; } });
  publishPurse(scope, purse);
  owned.onChange(() => { events.push('owned'); });
  try {
    const stall = installQuestTrader(ctx, rows), panel = installQuestShop(ctx, rows)();
    expect(() => installQuestShop(ctx, rows)).toThrow('already installed');
    expect(stall.shop).toBe(panel); expect(enteredPurse(scope)).toBe(purse);
    panel.open(); expect(hud.holdPause).toBe(true); expect(weapons.stowed).toBe(true);
    events.length = 0;
    panel.root.querySelector<HTMLButtonElement>('.ws-shop-bigbuy')?.click();
    expect(events).toEqual(['saved:0', 'owned', 'ui-chime', 'Bought · Whetstone I — sword damage +25 %']);
    expect(purse.coins).toBe(0); expect(owned.has('whetstone-1')).toBe(true);
    panel.root.querySelector<HTMLButtonElement>('.ws-shop-bigbuy')?.click(); expect(events).toHaveLength(4);
    panel.close(); expect(weapons.stowed).toBe(false); vi.advanceTimersByTime(450); expect(hud.holdPause).toBe(false);
    panel.onBuy?.({ id: 'heart-1', name: '', does: '', icon: 'heart', price: 14 });
    expect(owned.has('heart-1')).toBe(false);
    panel.dispose(); expect(stall.shop).toBeNull(); scope.dispose(); expect(() => enteredPurse(scope)).toThrow('Missing entered purse');
  } finally { scope.dispose(); vi.useRealTimers(); }
});

test('an unrelated barter counter uses the same shop, pays before grants and preserves caller modal callbacks', () => {
  const goods = [{ id: 'bundle', name: 'Apple bundle', does: 'A bundled snack', icon: 'bolt', price: 0, tile: 'Apples' }] as const;
  const economy = { kind: 'barter', goods, tables: [], exchange: {
    count: { owner: 'pack', path: ['count'] }, owns: { owner: 'skins', path: ['owns'] },
    goods: [{ id: 'bundle', costs: [{ item: 'seed', n: 2, text: '2 seeds' }], payments: [{ owner: 'pack', path: ['take'], args: ['seed', 2], required: true }], grants: [{ owner: 'pack', path: ['add'], args: ['apple', 3] }] }],
  } };
  const { ctx, scope, events, pack } = page([{ economy }]);
  const rows = { name: 'Orchard keeper', reopen: true, shop: { place: 'Orchard', barter: true, lifetime: 'entered', after: { bundle: [{ kind: 'toast', text: 'Traded · Apple bundle' }] } } };
  try {
    installQuestTrader(ctx, rows); const get = installQuestShop(ctx, rows), panel = get();
    const views = new QuestViews(ctx), hud = { holdPause: false, entered: true, setPaused: () => undefined };
    views.panelHold({ hud, weapons: { setEnabled: () => undefined }, menu: { isOpen: false, close: () => undefined }, nolock: true, touchUi: () => true, panels: [get] });
    panel.open(); expect(hud.holdPause).toBe(true);
    expect(panel.onBuy?.(goods[0])).toBe(false); expect(events).toEqual([]);
    pack.set('seed', 2); panel.render(); panel.root.querySelector<HTMLButtonElement>('.ws-shop-bigbuy')?.click();
    expect(events).toEqual(['take:seed:2', 'add:apple:3', 'Traded · Apple bundle']); expect(pack.get('seed')).toBe(0); expect(pack.get('apple')).toBe(3);
    panel.close(); pack.set('seed', 2);
    expect(panel.onBuy?.(goods[0])).toBe(false);
    panel.dispose();
  } finally { scope.dispose(); }
});

test('Pine cards retain all original post-grant feedback as data and malformed feedback refuses before construction', () => {
  const trader = FIGURE_CATALOGUE.figures['trader'];
  if (trader === undefined) throw new Error('Missing authored trader figure');
  expect(trader.phone.id).toBe(trader.desktop.id);
  for (const trade of TRADES) expect(barterRows.shop?.after[trade.id]).toEqual([
    ...('skin' in trade.get ? [{ kind: 'wear', finish: trade.get.skin }] : []),
    { kind: 'bark', audio: 'ambience', group: 'trader', figure: trader.phone.id }, { kind: 'chime', at: 'none', gain: 1 }, { kind: 'toast', text: `Traded · ${trade.label}` },
  ]);
  const { ctx, scope } = page(), rows = { name: 'Bad shop', reopen: true, shop: { place: 'Bad', barter: false, lifetime: 'resident', after: {} } };
  try {
    installQuestTrader(ctx, rows);
    expect(() => installQuestShop(ctx, rows)).toThrow('exact purchase feedback');
    expect(() => installQuestShop(ctx, { ...rows, shop: { ...rows.shop, after: { key: [{ kind: 'call', owner: 'code', path: ['run'] }] } } })).toThrow();
  } finally { scope.dispose(); }
});

test('resident counters prepare off-board while entered counters recreate their real widgets on each home entry', () => {
  vi.useFakeTimers();
  const { ctx: base, scope } = page();
  const retained = new RetainedRuntimeHooks(base, { deferActivation: true }), ctx = retained.context;
  publishPurse(scope, new Purse('shop-entry', { read: () => 12, write: () => true }));
  const { placement: _placement, view: _view, ...rows } = coinRows;
  try {
    const resident = installQuestTrader(ctx, rows), getResident = installQuestShop(ctx, rows), original = getResident();
    expect(resident.shop).toBe(original);
    const enteredRows = { ...rows, name: 'Entered counter', shop: { ...rows.shop, lifetime: 'entered' } };
    const entered = installQuestTrader(ctx, enteredRows), getEntered = installQuestShop(ctx, enteredRows);
    expect(entered.shop).toBeNull(); expect(() => getEntered()).toThrow('left its home');
    retained.activate(); const first = getEntered(); expect(entered.shop).toBe(first);
    retained.deactivate(); expect(entered.shop).toBeNull(); expect(first.scope.disposed).toBe(true);
    expect(getResident()).toBe(original); expect(original.scope.disposed).toBe(false);
    retained.activate(); expect(getEntered()).not.toBe(first); expect(getResident()).toBe(original);
    original.dispose();
  } finally { scope.dispose(); vi.useRealTimers(); }
});
