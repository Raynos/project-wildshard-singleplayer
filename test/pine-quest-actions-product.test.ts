import { QuestStepRunner } from '../src/game/quest/steps';
import { commitQuestEffects, readQuestServiceActions } from '../src/game/quest/effects';
import { publishBoundQuest } from '../src/game/quest/boundState';
import { QuestState } from '../src/engine/quest/core';
import { Scope } from '../src/engine/app/scope';
import { createShardProduct, type ShardProduct } from '../src/game/shardfile/shardProduct';
import type { ShardContext } from '../src/game/plugin/context';
import steps from '../src/shards/pine-hollow/data/questSteps.json' with { type: 'json' };
import { CONTRACTS } from './fixtures/pine-contracts';
import { beforeAll, expect, test } from 'vitest';
import { Vector3 } from 'three';
import { readProjectAssets } from '../src/sdk/project';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { parseQuestPageInteractions, type QuestPageInteractionsData } from '../src/format/questInteractions';
import { bindQuestPageInteractions } from '../src/game/plugin/ui';
import { Flags } from '../src/engine/world/interact/flags';
import { claim, loadBoard, newBoard, recordKill, saveBoard } from '../src/game/quest/contracts';
import { Exchange } from '../src/game/loot/exchange';
import { TRADES, tradeExchange } from '../src/shards/pine-hollow/generators/trades';

const serviceProducts = new Map<string, ShardProduct>();
const admitted = new Map<string, QuestPageInteractionsData>();
// Frozen from the original play-read tables before moving their assembly to build time.
const originals = {
  consequences: null,
  transactions: '891ccf64742a1e21d5e75705d91c393e784215317a5dc522da779c37f48be04b',
};
beforeAll(async () => {
  const loaded = await readProjectAssets('src/shards/pine-hollow');
  for (const slug of ['pine-hollow', 'driftwood-isle']) {
    const project = slug === 'pine-hollow' ? loaded : await readProjectAssets(`src/shards/${slug}`);
    const file = project.output.namedFiles?.find(row => row.name === 'quests/services.json');
    if (file === undefined) throw new Error('Missing admitted quest service rows');
    serviceProducts.set(slug, createShardProduct({ slug, revision: 1, shardfile: project.shard, sections: new Map(),
      files: new Map([['quests/services.json', { hash: file.hash, url: '/services.json' }]]), read: hash => {
        const bytes = project.assets.get(hash); if (bytes === undefined) throw new Error('Missing quest service bytes'); return Promise.resolve(bytes);
      } }));
  }

  for (const [name, hash] of Object.entries(originals)) {
    const file = loaded.output.namedFiles?.find(row => row.name === `quests/${name}.json`);
    if (file?.kind !== 'json') throw new Error(`Missing admitted quest actions: ${name}`);
    const bytes = loaded.assets.get(file.hash);
    if (bytes === undefined) throw new Error(`Missing quest action bytes: ${name}`);
    if (hash !== null) expect(hashImmutableBytes(bytes)).toBe(hash);
    admitted.set(name, parseQuestPageInteractions(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))));
  }
}, 30_000);
function rows(name: string): QuestPageInteractionsData {
  const value = admitted.get(name);
  if (value === undefined) throw new Error(`Missing test rows: ${name}`);
  return value;
}

test('Miller completion keeps the paid flag before rewards; binding a paid save is silent', async () => {
  const flags = new Flags('published-consequences', false), events: string[] = [];
  const inventory = { add(id: string, n = 1) { expect(flags.has('errand:paid')).toBe(true); events.push(`${id}:${String(n)}`); return true; }, take: () => false };
  const ports = { flags, toast: (text: string) => { events.push(text); }, owners: new Map<string, unknown>([
    ['flags', { set(id: string) { flags.set(id); events.push(id); } }],
    ['inventory', inventory],
    ['music', { sting(id: string) { events.push(id); } }], ['native', { syncWheel() { events.push('wheel'); } }],
  ]) };
  const page = bindQuestPageInteractions(rows('consequences'), ports);
  expect(events).toEqual([]);
  flags.set('errand:thanked');
  flags.onChange((flag, on) => { if (flag === 'errand:paid' && on) events.push(flag); });
  const runner = new QuestStepRunner(steps);
  const product = serviceProducts.get('pine-hollow'), scope = new Scope('payment');
  if (product === undefined) throw new Error('Missing admitted Pine services');
  const quest = product.shardfile.quests.quests[0]; if (quest === undefined) throw new Error('Missing declared quest');
  const context = { scope, product } as Pick<ShardContext, 'scope' | 'game' | 'product'>;
  Object.defineProperty(context, 'game', { value: { runtime: { play: { inventory,
    hud: { toast: (text: string) => { events.push(text); } }, music: { sting: (name: string) => { events.push(name); } } } } } });
  publishBoundQuest(scope, new QuestState({ id: quest.id, title: 'Payment', completeFlag: 'payment:complete',
    steps: [{ id: 'wait', objective: 'Wait', done: { all: ['payment:never'] } }] }, flags, undefined, scope));
  try {
    const services = await readQuestServiceActions(context, quest.id, 'quests/services.json');
    expect(events).toEqual([]);
    commitQuestEffects(context, quest.id, runner.signal({ kind: 'talk', target: 'miller' }, { flags: flags.all, inventory: {} }));
    services.run('miller.pay');
  } finally { scope.dispose(); }
  expect(events).toEqual(['errand:paid', 'lodge-ribbon:3', 'amber-resin:4', 'Brandt pays · 3 lodge ribbons · 4 amber resin', 'pickup']);
  const saved = flags.all.slice(); events.length = 0;
  flags.restore(saved); bindQuestPageInteractions(rows('consequences'), ports);
  expect(events).toEqual([]); expect(flags.all).toEqual(saved);
  page.run('errand.complete');
  expect(events.slice(0, 2)).toEqual(['errand:done', 'wheel']); expect(events.at(-1)).toBe('chunk');
});

test('saved board and shop still decide acceptance, with costs before grants and original feedback', () => {
  const flags = new Flags('published-transactions', false), events: string[] = [], pack = new Map<string, number>();
  const owned = new Set<string>(), finishes = Object.fromEntries(['hollow-ash', 'scarback-furnace'].map(id => [id, { wear() { events.push(`wear:${id}`); } }]));
  const page = bindQuestPageInteractions(rows('transactions'), { flags, toast: text => { events.push(text); }, owners: new Map<string, unknown>([
    ['inventory', { add(id: string, n: number) { pack.set(id, (pack.get(id) ?? 0) + n); events.push(`add:${id}:${String(n)}`); },
      take(id: string, n: number) { pack.set(id, (pack.get(id) ?? 0) - n); events.push(`take:${id}:${String(n)}`); } }],
    ['crossbow', { addBolts(n: number) { events.push(`bolts:${String(n)}`); } }],
    ['skins', { own(id: string) { owned.add(id); events.push(`own:${id}`); } }], ['finishes', finishes],
    ['music', { sting(id: string) { events.push(id); } }], ['sfx', { interact(id: string) { events.push(id); } }],
    ['ammo', { add(kind: string, n: number) { events.push(`ammo:${kind}:${String(n)}`); } }],
    ['voice', { current: null }], ['points', { trader: new Vector3() }],
  ]) });
  const board = newBoard(CONTRACTS), original = board.slots[0];
  if (original === undefined) throw new Error('Missing initial contract');
  expect(claim(CONTRACTS, board, 0)).toBe(null); expect(events).toEqual([]);
  for (let i = 0; i < 3; i++) recordKill(CONTRACTS, board, { kind: 'deer', elite: null, tags: [] });
  let raw = ''; const store = { getItem: (_key: string) => raw, setItem: (_key: string, value: string) => { raw = value; } };
  store.setItem(CONTRACTS.store, saveBoard(board)); const restored = loadBoard(CONTRACTS, store.getItem(CONTRACTS.store));
  expect(claim(CONTRACTS, restored, 0)).not.toBe(null); page.run(`contract.${original.kind}.${original.target}`);
  expect(events).toEqual(['add:lodge-ribbon:1', 'bolts:10']); store.setItem(CONTRACTS.store, saveBoard(restored));
  expect(claim(CONTRACTS, loadBoard(CONTRACTS, store.getItem(CONTRACTS.store)), 0)).toBe(null);
  events.length = 0;
  const trade = TRADES.find(row => row.id === 'broadheads');
  if (trade === undefined) throw new Error('Missing trade');
  const exchange = new Exchange(tradeExchange(), new Map<string, unknown>([['pack', { count: (id: string) => pack.get(id) ?? 0, take: () => true }], ['skins', { owns: (id: string) => owned.has(id), own: () => undefined }], ['ammo', { capacity: () => true, grant: () => undefined, addBolts: () => undefined }]]));
  const check = () => exchange.check(TRADES.indexOf(trade));
  expect(check().ok).toBe(false); expect(events).toEqual([]);
  pack.set('boar-hide', 1); pack.set('amber-resin', 2); expect(check().ok).toBe(true);
  page.run(`trade.${trade.id}`);
  expect(events).toEqual(['take:boar-hide:1', 'take:amber-resin:2', 'ammo:broadhead:8', 'chime', 'Traded · Broadhead bolts ×8']);
  expect(check().ok).toBe(false);
  events.length = 0; page.run('contract.finish');
  expect(events.slice(0, 2)).toEqual(['own:hollow-ash', 'wear:hollow-ash']);
});

test('DW named service rows borrow its original quest flags and keep pickup/glass feedback exact', async () => {
  const product = serviceProducts.get('driftwood-isle'), scope = new Scope('glass services'), flags = new Flags('glass services', false), events: string[] = [];
  if (product === undefined) throw new Error('Missing admitted DW services');
  const quest = product.shardfile.quests.quests[0]; if (quest === undefined) throw new Error('Missing declared DW quest');
  const context = { scope, product } as Pick<ShardContext, 'scope' | 'game' | 'product'>;
  Object.defineProperty(context, 'game', { value: { runtime: { play: { inventory: { add: () => true, take: () => false },
    hud: { toast: (text: string) => { events.push(text); } }, music: { sting: (name: string) => { events.push(name); } } } } } });
  publishBoundQuest(scope, new QuestState({ id: quest.id, title: 'Glass', completeFlag: 'fixture:complete',
    steps: [{ id: 'wait', objective: 'Wait', done: { all: ['fixture:never'] } }] }, flags, undefined, scope));
  try {
    const services = await readQuestServiceActions(context, quest.id, 'quests/services.json');
    expect(events).toEqual([]); flags.set('glass:one'); flags.set('glass:two'); flags.set('seen:unrelated');
    services.run('pickup'); services.run('glass');
    expect(events).toEqual(['pickup', 'Sea glass · 2 / 15']);
    expect(() => services.run('missing')).toThrow('Unknown quest service action');
    await expect(readQuestServiceActions(context, 'undeclared', 'quests/services.json')).rejects.toThrow('declared quest');
    scope.dispose(); expect(() => services.run('glass')).toThrow('not bound');
  } finally { scope.dispose(); }
});
