import { expect, test } from 'vitest';
import * as v from 'valibot';
import { emptyShardfile } from '../src/sdk/author';
import { absentShardProduct, createShardProduct, ProductError, type ShardProduct, type ShardProductInput } from '../src/game/shardfile/shardProduct';

// A runtime's custom section registry, as runtime/sections.ts declares it (P2a spec §3).
const SECTIONS = {
  'custom/trades': v.array(v.strictObject({ id: v.string(), give: v.number() })),
  'custom/wind': v.strictObject({ gust: v.number() }),
} as const;

const shardfile = emptyShardfile({ slug: 'p2a-fixture', name: 'P2a fixture', author: 'Wildshard', revision: 3, seed: 1 });
const wasm = new Uint8Array([0, 97, 115, 109]);

function product(overrides: Partial<ShardProductInput> = {}): ShardProduct {
  return createShardProduct({
    slug: 'p2a-fixture', revision: 3, shardfile,
    sections: new Map<string, unknown>([
      ['quests/quests', { quests: shardfile.quests }],
      ['ui/strings', { raised: 'The bridge is up', locked: 'The winch will not turn' }],
      ['custom/trades', [{ id: 'bolts', give: 2 }]],
      ['custom/wind', { gust: 'strong' }],
    ]),
    streamed: new Set(['world/tiles']),
    files: new Map([['behaviour/director.wasm', { hash: 'a'.repeat(64), url: `https://example.test/blobs/wasm/${'a'.repeat(64)}.wasm` }]]),
    read: hash => hash === 'a'.repeat(64) ? Promise.resolve(wasm) : Promise.reject(new Error('unexpected hash')),
    ...overrides,
  });
}

function refusal(read: () => unknown): ProductError {
  try { read(); } catch (error) { if (error instanceof ProductError) return error; throw error; }
  throw new Error('expected a ProductError');
}

test('platform and custom sections read synchronously, typed by the registry', () => {
  const p = product();
  const quests = p.section('quests/quests').quests;
  expect(quests).toBe(shardfile.quests);
  const trades = p.section('custom/trades', SECTIONS);
  expect(trades[0]?.id).toBe('bolts');
  expect(p.has('quests/quests')).toBe(true);
  expect(p.has('world/tiles')).toBe(true);
  expect(p.has('custom/missing')).toBe(false);
  expect(p.shardfile).toBe(shardfile);
});

test('a missing or streamed section refuses with its reason', () => {
  const p = product();
  expect(refusal(() => p.section('combat/items')).reason).toBe('missing-section');
  expect(refusal(() => p.section('world/tiles')).reason).toBe('stream-section');
});

test('generated custom types need no runtime registry and retain product refusals', () => {
  type Trades = { id: string; give: number }[];
  const checked = product({ check: true });
  const trades = checked.section<Trades>('custom/trades');
  expect(trades).toEqual([{ id: 'bolts', give: 2 }]);
  expect(Object.isFrozen(trades) && Object.isFrozen(trades[0])).toBe(true);
  expect(checked.section<Trades>('custom/trades')).toBe(trades);
  expect(refusal(() => checked.section<Trades>('custom/missing')).reason).toBe('missing-section');
  expect(refusal(() => product({ streamed: new Set(['custom/trades']) }).section<Trades>('custom/trades')).reason).toBe('stream-section');
  expect(refusal(() => absentShardProduct('absent').section<Trades>('custom/trades')).reason).toBe('absent');
});

test('the trusted product never parses; a checked product parses custom sections and freezes them', () => {
  // the shipped page trusts the build's validation: a wrong value passes through untouched
  expect(product().section('custom/wind', SECTIONS)).toEqual({ gust: 'strong' });
  const checked = product({ check: true });
  const error = refusal(() => checked.section('custom/wind', SECTIONS));
  expect(error.reason).toBe('schema');
  expect(error.item).toBe('custom/wind');
  const trades = checked.section('custom/trades', SECTIONS);
  expect(Object.isFrozen(trades) && Object.isFrozen(trades[0])).toBe(true);
  expect(checked.section('custom/trades', SECTIONS)).toBe(trades);
});

test('strings are read all at once and refuse naming every missing key', () => {
  const p = product();
  const strings = p.strings(['raised', 'locked']);
  expect(strings.raised).toBe('The bridge is up');
  expect(Object.isFrozen(strings)).toBe(true);
  const error = refusal(() => p.strings(['raised', 'vane', 'roost']));
  expect(error.reason).toBe('missing-strings');
  expect(error.message).toContain('vane, roost');
  expect(product({ sections: new Map() }).strings([])).toEqual({});
});

test('files are read by logical name through the verified reader', async () => {
  const p = product();
  expect(p.hasFile('behaviour/director.wasm')).toBe(true);
  expect(await p.file('behaviour/director.wasm')).toBe(wasm);
  expect(p.url('behaviour/director.wasm')).toMatch(/blobs\/wasm\/a{64}\.wasm$/u);
  await expect(p.file('models/missing.glb')).rejects.toMatchObject({ reason: 'missing-file' });
  expect(refusal(() => p.url('models/missing.glb')).reason).toBe('missing-file');
});

test('generated named-JSON types read verified bytes and reject malformed content', async () => {
  interface Rig { bones: string[] }
  const files = new Map([['rig.json', { hash: 'b'.repeat(64), url: '/rig.json' }]]);
  const read = (text: string) => product({ files, read: () => Promise.resolve(new TextEncoder().encode(text)) });
  expect(await read('{"bones":["root"]}').json<Rig>('rig.json')).toEqual({ bones: ['root'] });
  await expect(read('{broken').json<Rig>('rig.json')).rejects.toThrow();
  await expect(product({ files, read: () => Promise.resolve(new Uint8Array([255])) }).json<Rig>('rig.json')).rejects.toThrow();
  await expect(read('{}').json<Rig>('missing.json')).rejects.toMatchObject({ reason: 'missing-file' });
  await expect(absentShardProduct('absent').json<Rig>('rig.json')).rejects.toMatchObject({ reason: 'absent' });
});

test('an entry with no built output refuses every read with the fix', async () => {
  const p = absentShardProduct('far-reach-legacy');
  expect(p.has('quests/quests')).toBe(false);
  const error = refusal(() => p.section('quests/quests'));
  expect(error.reason).toBe('absent');
  expect(error.message).toContain('wildshard build far-reach-legacy');
  expect(refusal(() => p.shardfile).reason).toBe('absent');
  expect(refusal(() => p.strings(['raised'])).reason).toBe('absent');
  await expect(p.file('models/roc.glb')).rejects.toMatchObject({ reason: 'absent' });
});
