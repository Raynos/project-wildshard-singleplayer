import { expect, test } from 'vitest';
import { ELITE_OUTPUT_OPERATION, parseEliteOutputActions, parseEliteOutputBank, readEliteOutputV2 } from '../src/format/eliteFeature';

const actions = [
  { id: 1, controller: 0, kind: 'contact', amount: 14 },
  { id: 2, controller: 0, kind: 'knockdown', duration: .8 },
  { id: 3, controller: 1, kind: 'patrol-rider', variant: 'rider' },
  { id: 4, controller: 1, kind: 'patrol-line' },
  { id: 5, controller: 1, kind: 'patrol-dissolve' },
  { id: 6, controller: 0, kind: 'wildlife-pack', variants: ['plain', 'dark'] },
  { id: 7, controller: 2, kind: 'wildlife-herd', actorKind: 'stag', variant: 'gold', offset: [3, -4], mares: 2, foals: 1, stallion: false },
  { id: 8, controller: 0, kind: 'feed', text: 'The marsh stirs' },
  { id: 9, controller: 0, kind: 'sound', cue: 'creature.warning' },
  { id: 10, controller: 2, kind: 'record', actorKind: 'stag', variant: 'gold' },
];
const admitted = () => parseEliteOutputActions(actions, 3);

test('finite outputs retain emitted order, controller identity and exact f64 operands', () => {
  const source = [
    { action: 3, values: [100.00000000001, -0, .75] },
    { action: 1, values: [1] }, { action: 2, values: [-0, -1] },
    { action: 6, values: [2, 3, 100.00000000001, -0] },
    { action: 7, values: [10, 20, .5] }, { action: 4, values: [8] },
    { action: 5, values: [0] }, { action: 8, values: [] },
    { action: 9, values: [1, 2, 3] }, { action: 10, values: [] },
  ];
  const bank = parseEliteOutputBank(admitted(), source, 2);
  expect(bank.map(row => row.kind)).toEqual(['patrol-rider', 'contact', 'knockdown', 'wildlife-pack', 'wildlife-herd', 'patrol-line', 'patrol-dissolve', 'feed', 'sound', 'record']);
  expect(bank.map(row => row.id)).toEqual(source.map(row => row.action));
  expect(bank[0]?.values).toEqual(source[0]?.values);
  expect(Object.is(bank[0]?.values[1], -0)).toBe(true);
  expect(Object.is(bank[2]?.values[0], -0)).toBe(true);
  source[0]?.values.fill(0);
  expect(bank[0]?.values[0]).toBe(100.00000000001);
});

test('action grammar refuses ambiguous IDs, missing controllers and reflected owners', () => {
  for (const input of [[...actions, actions[0]], [{ ...actions[0], controller: 3 }], [{ ...actions[0], id: 0 }], [{ ...actions[0], controller: 1.1 }], [{ ...actions[0], path: 'world.player' }], [{ ...actions[0], kind: 'impulse' }], [{ ...actions[0], amount: Infinity }]]) {
    expect(() => parseEliteOutputActions(input, 3)).toThrow();
  }
  expect(() => parseEliteOutputActions(Array.from({ length: 129 }, (_, index) => ({ ...actions[0], id: index + 1 })), 3)).toThrow();
});

test('invalid suffix refuses the complete bank with exact widths and bounded actor slots', () => {
  const prefix = { action: 8, values: [] };
  for (const suffix of [
    { action: 65535, values: [] }, { action: 1, values: [] }, { action: 1, values: [2] },
    { action: 1, values: [-1] }, { action: 1, values: [1.1] },
    { action: 2, values: [1, Infinity] }, { action: 2, values: [1, 2, 3] },
    { action: 4, values: [9] }, { action: 4, values: [2.5] },
    { action: 5, values: [64] }, { action: 6, values: [1, 2, 3] },
    { action: 7, values: [1, 2] }, { action: 9, values: [Number.NaN, 2, 3] },
    { action: 10, values: [0] }, { action: 8, values: [], owner: 'hud' },
  ]) expect(() => parseEliteOutputBank(admitted(), [prefix, suffix], 2), JSON.stringify(suffix)).toThrow();
  expect(() => parseEliteOutputBank(admitted(), Array.from({ length: 257 }, () => prefix), 2)).toThrow();
});

test('authored action and output getters are refused without executing them', () => {
  let reads = 0;
  const action = { ...actions[0], get controller() { reads++; return 0; } };
  const output = { action: 8, get values() { reads++; return []; } };
  expect(() => parseEliteOutputActions([action], 3)).toThrow();
  expect(() => parseEliteOutputBank(admitted(), [{ action: 8, values: [] }, output], 2)).toThrow();
  expect(reads).toBe(0);
});


test('cyclic banks and altered action banks refuse before any result is returned', () => {
  const values: unknown[] = []; values.push(values);
  expect(() => parseEliteOutputBank(admitted(), [{ action: 8, values }], 2)).toThrow();
  const rows = [...admitted(), ...admitted()];
  expect(() => parseEliteOutputBank(rows, [{ action: 8, values: [] }], 2)).toThrow();
});

function wire(action: number, values: readonly number[]): DataView {
  const view = new DataView(new ArrayBuffer(80));
  view.setUint32(8, 9, true); view.setUint32(12, ELITE_OUTPUT_OPERATION, true); view.setUint32(16, action, true);
  values.forEach((value, index) => { view.setFloat64(24 + index * 8, value, true); });
  return view;
}

test('op25 decodes detached f64 values without changing the guest bank', () => {
  const view = wire(6, [100.00000000001, -0, 2, 3]);
  const before = new Uint8Array(view.buffer).slice(), output = readEliteOutputV2(view, 8, 9, admitted(), 2);
  expect(output.kind).toBe('wildlife-pack'); expect(output.values).toEqual([100.00000000001, -0, 2, 3]);
  expect(new Uint8Array(view.buffer)).toEqual(before);
  view.setFloat64(24, 0, true); expect(output.values[0]).toBe(100.00000000001);
});

test('op25 refuses foreign binding, reserved words, arity and world operations', () => {
  const valid = wire(1, [0]);
  expect(() => readEliteOutputV2(valid, 8, 8, admitted(), 2)).toThrow();
  expect(() => readEliteOutputV2(valid, 7, 9, admitted(), 2)).toThrow();
  expect(() => readEliteOutputV2(valid, 24, 9, admitted(), 2)).toThrow();
  for (const op of [0, 1, 14, 23, 24, 26]) {
    const view = wire(1, [0]); view.setUint32(12, op, true);
    expect(() => readEliteOutputV2(view, 8, 9, admitted(), 2)).toThrow();
  }
  for (const at of [32, 40, 48, 56, 64]) {
    const view = wire(1, [0]); view.setFloat64(at, -0, true);
    expect(() => readEliteOutputV2(view, 8, 9, admitted(), 2)).toThrow();
  }
  const reserved = wire(1, [0]); reserved.setUint32(20, 1, true);
  expect(() => readEliteOutputV2(reserved, 8, 9, admitted(), 2)).toThrow();
  expect(() => readEliteOutputV2(wire(4, [9]), 8, 9, admitted(), 2)).toThrow();
  expect(() => readEliteOutputV2(wire(65535, []), 8, 9, admitted(), 2)).toThrow();
});
