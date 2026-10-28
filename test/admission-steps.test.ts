import { expect, test } from 'vitest';
import { isJsonData, isJsonDataSteps } from '../src/format/json';
import { assertCellBounds, assertCellBoundsSteps } from '../src/format/cellBounds';
import { preflightShardfile, preflightShardfileSteps } from '../src/format/preflight';
import { productResidentBytes, productResidentBytesSteps } from '../src/game/shardfile/productCost';
import { emptyShardfile } from '../src/sdk/author';

// T10: product admission's walks run in steps between drawn frames; each must give exactly its one-shot original's verdict,
// refusal message and bytes, and must actually pause on a large value.
function drain<T>(steps: Generator<void, T>): { value: T; pauses: number } {
  let pauses = 0, step = steps.next();
  while (step.done !== true) { pauses++; step = steps.next(); }
  return { value: step.value, pauses };
}
const outcome = (run: () => unknown): string => { try { return `ok ${JSON.stringify(run())}`; } catch (error) { return `refused ${error instanceof Error ? error.message : String(error)}`; } };

function cases(): unknown[] {
  const cycle: Record<string, unknown> = { a: 1 }; cycle['self'] = cycle;
  const deep: Record<string, unknown> = {}; let at = deep; for (let i = 0; i < 70; i++) { const next = {}; at['n'] = next; at = next; }
  const holes: unknown[] = [1, 2]; holes[4] = 3;
  const extra: unknown[] = [1, 2]; Reflect.set(extra, 'name', 'x');
  const accessor = {}; Object.defineProperty(accessor, 'x', { enumerable: true, get: () => 1 });
  const hidden = {}; Object.defineProperty(hidden, 'x', { enumerable: false, value: 1 });
  const symbol = { [Symbol('s')]: 1 };
  const shared = { leaf: 1 };
  return [null, 1, 'text', true, { a: [1, 'b', { c: null }] }, Object.assign(Object.create(null) as object, { a: 1 }), { a: shared, b: shared },
    Number.NaN, -0, { a: Infinity }, cycle, deep, holes, extra, accessor, hidden, symbol, new Map(), [new Date()], { f: () => 1 },
    Array.from({ length: 120_000 }, () => 0), { rows: Array.from({ length: 40_000 }, (_, i) => ({ i, s: `x${i}` })) }];
}

test('the stepped plain-JSON fence matches isJsonData on every case and pauses on large values', () => {
  for (const value of cases()) expect(drain(isJsonDataSteps(value, 64)).value).toBe(isJsonData(value));
  const large = { rows: Array.from({ length: 5000 }, (_, i) => ({ i })) };
  expect(drain(isJsonDataSteps(large, 1000)).pauses).toBeGreaterThan(5);
});

test('the stepped bounds walk refuses the same node with the same path', () => {
  const rows = [
    { list: [{ a: 1 }, { place: { min: [0, 0, 0], max: [251, 1, 1] } }], later: { min: [0, 0, 0], max: [999, 1, 1] } },
    { zones: [{ zone: { x0: 2, x1: 1, z0: 0, z1: 1 } }, { zone: { x0: -999, x1: 1, z0: 0, z1: 1 } }] },
    { fine: { x0: 0, x1: 1, z0: 0, z1: '1' }, box: { min: [0, 0, 0], max: [1, 1, 1] } },
    { bad: Number.NaN },
  ];
  for (const value of rows) expect(outcome(() => { drain(assertCellBoundsSteps(value, 'scene', 2)); })).toBe(outcome(() => { assertCellBounds(value, 'scene'); }));
});

test('stepped preflight gives the same verdict and message as preflightShardfile', () => {
  const source = (): Record<string, unknown> => ({ ...structuredClone(emptyShardfile({ slug: 'steps', name: 'Steps', author: 'T', revision: 1, seed: 1 })) });
  const variants: ((s: Record<string, unknown>) => void)[] = [
    () => undefined,
    s => { s['extra'] = { id: 'x'.repeat(129) }; },
    s => { s['extra'] = { text: 'y'.repeat(4097), id: 'z'.repeat(200) }; },
    s => { s['extra'] = [{ name: 'é'.repeat(64) }, { ['k'.repeat(129)]: 1 }]; },
    s => { s['pad'] = Array.from({ length: 600 }, () => 'p'.repeat(4000)); },
    s => { s['files'] = [{ hash: 'a'.repeat(64), compressed: 1 }, { hash: 'a'.repeat(64), compressed: 2 }]; },
    s => { s['files'] = [{ hash: 'nothex', compressed: 1 }]; },
    s => { s['bounds'] = { min: [0, 0, 0], max: [300, 1, 1] }; },
    s => { s['bad'] = -0; },
  ];
  for (const vary of variants) {
    const one = source(), two = source(); vary(one); vary(two);
    expect(outcome(() => { drain(preflightShardfileSteps(two, 16)); })).toBe(outcome(() => { preflightShardfile(one); }));
  }
});

test('stepped residency bytes equal productResidentBytes', () => {
  const source = emptyShardfile({ slug: 'steps', name: 'Steps', author: 'T', revision: 1, seed: 1 });
  Reflect.set(source, 'rows', Array.from({ length: 3000 }, (_, i) => ({ id: `row-${i}`, x: i * 0.5, tags: ['a', 'é'] })));
  const stepped = drain(productResidentBytesSteps(source, 500));
  expect(stepped.value).toBe(productResidentBytes(source));
  expect(stepped.pauses).toBeGreaterThan(5);
});
