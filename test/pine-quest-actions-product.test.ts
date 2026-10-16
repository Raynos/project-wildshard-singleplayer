// @vitest-environment happy-dom
import { beforeAll, expect, test } from 'vitest';
import { Vector3 } from 'three';
import { readProjectAssets } from '../src/sdk/project';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { parseQuestPageInteractions, type QuestPageInteractionsData } from '../src/format/questInteractions';
import { bindQuestPageInteractions } from '../src/game/plugin/ui';
import { Flags } from '../src/engine/world/interact/flags';
import { claim, loadBoard, newBoard, recordKill, saveBoard } from '../src/shards/pine-hollow/quest/contracts';
import { tradeState } from '../src/shards/pine-hollow/quest/trades';
import { TRADES } from '../src/shards/pine-hollow/data/trades';

const admitted = new Map<string, QuestPageInteractionsData>();
// Frozen from the original play-read tables before moving their assembly to build time.
const originals = {
  consequences: '3d464b375692d2844c8bdf35be447416972986e429c2327b3c4edf3e7d1c694c',
  clock: '49215a7ca659d840f9678eeb7a448c0dede081c5e0c152d8283edeb2d462c484',
  transactions: '891ccf64742a1e21d5e75705d91c393e784215317a5dc522da779c37f48be04b',
};
beforeAll(async () => {
  const loaded = await readProjectAssets('src/shards/pine-hollow');
  for (const [name, hash] of Object.entries(originals)) {
    const file = loaded.output.namedFiles?.find(row => row.name === `quests/${name}.json`);
    if (file?.kind !== 'json') throw new Error(`Missing admitted quest actions: ${name}`);
    const bytes = loaded.assets.get(file.hash);
    if (bytes === undefined) throw new Error(`Missing quest action bytes: ${name}`);
    expect(hashImmutableBytes(bytes)).toBe(hash);
    admitted.set(name, parseQuestPageInteractions(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))));
  }
}, 30_000);
function rows(name: string): QuestPageInteractionsData {
  const value = admitted.get(name);
  if (value === undefined) throw new Error(`Missing test rows: ${name}`);
  return value;
}

test('Miller completion keeps the paid flag before rewards; binding a paid save is silent', () => {
  const flags = new Flags('published-consequences', false), events: string[] = [];
  const ports = { flags, toast: (text: string) => { events.push(text); }, owners: new Map<string, unknown>([
    ['flags', { set(id: string) { flags.set(id); events.push(id); } }],
    ['inventory', { add(id: string, n: number) { expect(flags.has('errand:paid')).toBe(true); events.push(`${id}:${String(n)}`); } }],
    ['music', { sting(id: string) { events.push(id); } }], ['native', { syncWheel() { events.push('wheel'); } }],
  ]) };
  const page = bindQuestPageInteractions(rows('consequences'), ports);
  expect(events).toEqual([]);
  page.action('miller.pay')();
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
  const board = newBoard(), original = board.slots[0];
  if (original === undefined) throw new Error('Missing initial contract');
  expect(claim(board, 0)).toBe(null); expect(events).toEqual([]);
  for (let i = 0; i < 3; i++) recordKill(board, { kind: 'deer', elite: null, thrall: false });
  let raw = ''; const store = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
  saveBoard(board, store); const restored = loadBoard(store);
  expect(claim(restored, 0)).not.toBe(null); page.run(`contract.${original.kind}.${original.target}`);
  expect(events).toEqual(['add:lodge-ribbon:1', 'bolts:10']); saveBoard(restored, store);
  expect(claim(loadBoard(store), 0)).toBe(null);
  events.length = 0;
  const trade = TRADES.find(row => row.id === 'broadheads');
  if (trade === undefined) throw new Error('Missing trade');
  const check = () => tradeState(trade, { count: id => pack.get(id) ?? 0 }, id => owned.has(id));
  expect(check().ok).toBe(false); expect(events).toEqual([]);
  pack.set('boar-hide', 1); pack.set('amber-resin', 2); expect(check().ok).toBe(true);
  page.run(`trade.${trade.id}`);
  expect(events).toEqual(['take:boar-hide:1', 'take:amber-resin:2', 'ammo:broadhead:8', 'chime', 'Traded · Broadhead bolts ×8']);
  expect(check().ok).toBe(false);
  events.length = 0; page.run('contract.finish');
  expect(events.slice(0, 2)).toEqual(['own:hollow-ash', 'wear:hollow-ash']);
});

test('night and dawn keep durations, lantern order and completion payout; restoring emits nothing', () => {
  const flags = new Flags('published-clock', false), events: string[] = [];
  flags.set('wait:night');
  const ports = { flags, toast: (text: string) => { events.push(text); }, owners: new Map<string, unknown>([
    ['flags', { set(id: string) { flags.set(id); events.push(id); }, clear(id: string) { flags.clear(id); events.push(`clear:${id}`); } }],
    ['inventory', { add(id: string, n: number) { events.push(`${id}:${String(n)}`); } }],
    ['music', { sting(id: string) { events.push(id); } }],
    ['lamps', { setLit(id: string, on: boolean) { expect(flags.has(`lit:${id}`)).toBe(true); events.push(`lamp:${id}:${String(on)}`); } }],
    ['caption', { show(on: boolean) { events.push(`caption:${String(on)}`); } }],
    ['objective', { hide(on: boolean) { events.push(`hide:${String(on)}`); } }],
    ['native', { fastForward(to: number, seconds: number) { events.push(`forward:${String(to)}:${String(seconds)}`); } }],
  ]) };
  const page = bindQuestPageInteractions(rows('clock'), ports);
  expect(events).toEqual([]); page.run('night.consume'); page.run('night.start');
  expect(flags.has('wait:night')).toBe(false); expect(events.at(-1)).toBe('forward:0.92:6');
  events.length = 0; page.run('dawn.sunrise'); expect(events).toEqual(['forward:0.02:7']);
  events.length = 0; page.run('dawn.lanterns');
  expect(events).toEqual(['lit:pond', 'lit:ridge', 'lit:den', 'lamp:pond:true', 'lamp:ridge:true', 'lamp:den:true', 'dawn']);
  events.length = 0; page.run('dawn.caption'); page.run('dawn.finish');
  expect(events).toEqual(['caption:true', 'hide:true', 'caption:false', 'hide:false', 'amber-resin:4',
    "Hale's thanks · 4 amber resin — and the Warden's bow is yours to keep", 'seen:dawn']);
  const saved = flags.all.slice(); events.length = 0; flags.restore(saved);
  bindQuestPageInteractions(rows('clock'), ports); expect(events).toEqual([]); expect(flags.all).toEqual(saved);
});
