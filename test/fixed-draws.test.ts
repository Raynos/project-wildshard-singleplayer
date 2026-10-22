// oxlint-disable-next-line import/no-nodejs-modules -- The cold card reads the shipped baked gull through its product.
import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { BufferAttribute, BufferGeometry } from 'three';
import { coldFixedDraws, fixedDraws } from '../src/game/models/fixedDraws';
import { Scope } from '../src/engine/app/scope';
import { createOwnedGeometry } from '../src/engine/models/ownedGeometry';

// G571: a product's named fixed draws (Driftwood's fixed-model templates) loaded together as owned templates.
const tri = (x: number): BufferGeometry => new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array([x, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
const rows = [{ slot: 'gull', file: 'models/fixed/gull.glb', channels: [] }, { slot: 'reefFish', file: 'models/fixed/reef-fish.glb', channels: [] }];
const product = { slug: 'fixture', file: () => Promise.reject(new Error('read through the product')) };

test('every slot loads together from named sources and copies its own template', async () => {
  const draws = fixedDraws(product, rows);
  expect(draws.ready).toBe(false);
  await draws.load(new Map([['models/fixed/gull.glb', tri(7)], ['models/fixed/reef-fish.glb', tri(9)]]));
  expect(draws.ready).toBe(true);
  const gull = draws.handle('gull').copy(), fish = draws.handle('reefFish').copy();
  expect(gull.getAttribute('position').getX(0)).toBe(7); expect(fish.getAttribute('position').getX(0)).toBe(9);
  expect(gull).not.toBe(draws.handle('gull').copy());
});

test('an undeclared, missing or repeated slot refuses; no source reads the product', async () => {
  expect(() => fixedDraws(product, [...rows, rows[0]])).toThrow('Repeated');
  const draws = fixedDraws(product, rows);
  expect(() => draws.handle('crab')).toThrow('Undeclared');
  await expect(draws.load(new Map([['models/fixed/gull.glb', tri(1)]]))).rejects.toThrow('Missing fixed draw: reefFish');
  expect(draws.ready).toBe(false);
  await expect(draws.load()).rejects.toThrow('read through the product');
});

test('a cold card owns exactly its slots, read through the product, and releases them with its scope', async () => {
  const gull = Uint8Array.from(readFileSync('public/assets/driftwood-isle/baked/fixed-models/gull.glb'));
  const read = { slug: 'fixture', file: (name: string) => name === 'models/fixed/gull.glb' ? Promise.resolve(gull) : Promise.reject(new Error(`unread ${name}`)) };
  const card = new Scope('card');
  const draws = await coldFixedDraws(read, rows, card, ['gull']);
  expect(draws.ready).toBe(true); expect(() => draws.handle('reefFish')).toThrow('Undeclared');
  const copy = draws.handle('gull').copy(); expect(copy.getAttribute('position').count).toBeGreaterThan(0);
  card.dispose(); expect(() => draws.handle('gull').copy()).toThrow();
  await expect(coldFixedDraws(read, rows, new Scope('x'), ['gull', 'gull'])).rejects.toThrow('undeclared or repeated');
  await expect(coldFixedDraws(read, rows, new Scope('y'), ['crab'])).rejects.toThrow('undeclared or repeated');
  const closing = new Scope('closing'), pending = coldFixedDraws(read, rows, closing, ['gull']); closing.dispose();
  await expect(pending).rejects.toThrow('owner left');
});

// sp-x8 QX: lifetime regressions for the cold entry
const bytes = (name: string): Uint8Array => Uint8Array.from(readFileSync(`public/assets/driftwood-isle/baked/fixed-models/${name}.glb`));
function deferred() { let settle: (value: Uint8Array) => void = () => undefined;
  const promise = new Promise<Uint8Array>(resolve => { settle = resolve; }); return { promise, resolve: (value: Uint8Array) => { settle(value); } }; }
// the real template intake, signalling each slot's decode completion to the test (the dependency passed in, E422)
function signalled() {
  const waiting = new Map<string, () => void>();
  const decoded = (slot: string): Promise<void> => new Promise(resolve => { waiting.set(slot, resolve); });
  const template: typeof createOwnedGeometry = (slot, channels) => {
    const handle = createOwnedGeometry(slot, channels);
    return { ...handle, load: async (...args) => { await handle.load(...args); waiting.get(slot)?.(); } };
  };
  return { decoded, template };
}
test('closing during a read releases a slot that finished early and refuses; a closed card hands out nothing', async () => {
  const late = deferred(), disposed = vi.spyOn(BufferGeometry.prototype, 'dispose');
  try {
    const card = new Scope('card'), read = { slug: 'fixture', file: (name: string) => name.endsWith('gull.glb') ? Promise.resolve(bytes('gull')) : late.promise };
    const signal = signalled(), gullDecoded = signal.decoded('gull'), pending = coldFixedDraws(read, rows, card, ['gull', 'reefFish'], signal.template);
    await gullDecoded;
    const before = disposed.mock.calls.length;
    card.dispose(); late.resolve(bytes('reef-fish'));
    await expect(pending).rejects.toThrow('owner left');
    expect(disposed.mock.calls.length - before).toBe(1);
  } finally { disposed.mockRestore(); }
  const card = new Scope('card'), draws = await coldFixedDraws({ slug: 'fixture', file: () => Promise.resolve(bytes('gull')) }, rows, card, ['gull']);
  card.dispose();
  expect(draws.ready).toBe(false); expect(() => draws.handle('gull')).toThrow('owner left'); await expect(draws.load()).rejects.toThrow('owner left');
});
test('an ancestor retiring (disposing, the card still live) during a read refuses', async () => {
  const late = deferred(), parent = new Scope('cell'), card = parent.child('card');
  parent.onDispose(() => undefined); // retired first (newest first): the card is still live while its ancestor retires
  const pending = coldFixedDraws({ slug: 'fixture', file: () => late.promise }, rows, card, ['gull']);
  const steps = parent.disposeSteps(); steps.next();
  expect(card.disposed).toBe(false); expect(card.disposing).toBe(true);
  late.resolve(bytes('gull'));
  await expect(pending).rejects.toThrow('owner left');
  for (let step = steps.next(); step.done !== true; step = steps.next()) { /* finish the retirement */ }
});
test('a partial read failure releases every slot that loaded and reports the failure', async () => {
  const disposed = vi.spyOn(BufferGeometry.prototype, 'dispose');
  try {
    const card = new Scope('card'), read = { slug: 'fixture', file: (name: string) => name.endsWith('gull.glb') ? Promise.resolve(bytes('gull')) : Promise.reject(new Error('reef fish unreadable')) };
    const before = disposed.mock.calls.length;
    await expect(coldFixedDraws(read, rows, card, ['gull', 'reefFish'])).rejects.toThrow('reef fish unreadable');
    expect(disposed.mock.calls.length - before).toBe(1);
    card.dispose();
    expect(disposed.mock.calls.length - before).toBe(1);
  } finally { disposed.mockRestore(); }
});

// G602/G603: a fixed draw row may name a baked geometry block instead of a GLB (Nalati's prepared shapes)
const baked = { attrs: [['position', 'f32', 3, false], ['aTone', 'u8', 1, true]] as [string, 'f32' | 'u8', number, boolean][], count: 3, index: 'u16' as const, indexCount: 3, box: true, expand: false };
function block(x: number): Uint8Array {
  const position = new Float32Array([x, 0, 0, 1, 0, 0, 0, 1, 0]), tone = new Uint8Array([10, 20, 30, 0]), deltas = new Int32Array([0, 1, 1]);
  const out = new Uint8Array(position.byteLength + tone.byteLength + deltas.byteLength);
  out.set(new Uint8Array(position.buffer), 0); out.set(tone, position.byteLength); out.set(new Uint8Array(deltas.buffer), position.byteLength + tone.byteLength);
  return out;
}
const stoneRow = { slot: 'stone', file: 'shapes/stone.bin', channels: [['aTone', 'tone']] as [string, string][], baked };
const bakedRows = [stoneRow, { slot: 'flat', file: 'shapes/flat.bin', channels: [], baked: { ...baked, expand: true } }];

test('a baked row decodes its block exactly, renames its channels and expands when declared', async () => {
  const files = new Map([['shapes/stone.bin', block(4)], ['shapes/flat.bin', block(6)]]);
  const read = { slug: 'fixture', file: (name: string) => { const found = files.get(name); return found === undefined ? Promise.reject(new Error(`unread ${name}`)) : Promise.resolve(found); } };
  const draws = fixedDraws(read, bakedRows);
  await draws.load();
  const stone = draws.handle('stone').copy(), flat = draws.handle('flat').copy();
  expect(stone.getAttribute('position').getX(0)).toBe(4); expect(stone.hasAttribute('tone')).toBe(true); expect(stone.hasAttribute('aTone')).toBe(false);
  expect(Array.from(stone.getIndex()?.array ?? [])).toEqual([0, 1, 2]); expect(stone.boundingBox).not.toBeNull();
  expect(flat.getIndex()).toBeNull(); expect(flat.getAttribute('position').getX(0)).toBe(6);
  // a card's cold copy reads the same row through the product
  const card = new Scope('card'), cold = await coldFixedDraws(read, bakedRows, card, ['stone']);
  expect(cold.handle('stone').copy().getAttribute('position').getX(0)).toBe(4); card.dispose();
});

test('a baked row refuses a wrong byte count, a missing channel or geometry instead of bytes', async () => {
  const short = { slug: 'fixture', file: () => Promise.resolve(block(1).slice(0, 8)) };
  await expect(fixedDraws(short, [stoneRow]).load()).rejects.toThrow('byte count differs: stone');
  const read = { slug: 'fixture', file: () => Promise.resolve(block(1)) };
  await expect(fixedDraws(read, [{ ...stoneRow, channels: [['aMissing', 'x']] }]).load()).rejects.toThrow('missing aMissing: stone');
  await expect(fixedDraws(product, [stoneRow]).load(new Map([['shapes/stone.bin', tri(1)]]))).rejects.toThrow('needs its file bytes: stone');
});
