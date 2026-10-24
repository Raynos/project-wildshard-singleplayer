import { expect, test } from 'vitest';
import { GRAPH_ADMISSION_LIMITS, graphAdmissionErrors } from './materialGraph';

test('array length stays outside JSON byte and node counts at exact limits', () => {
  const exact = ['x'.repeat(GRAPH_ADMISSION_LIMITS.bytes - 4)];
  expect(new TextEncoder().encode(JSON.stringify(exact))).toHaveLength(GRAPH_ADMISSION_LIMITS.bytes);
  expect(graphAdmissionErrors(exact)).toEqual([]);
  expect(graphAdmissionErrors([`${exact[0]}x`])).toEqual(['graph: JSON byte size exceeds admission cap']);
  expect(graphAdmissionErrors({ nodes: [0, 1] }, 2)).toEqual([]);
  expect(graphAdmissionErrors({ nodes: [0, 1] }, 1)).toEqual(['budget: 2 nodes (at most 1); all nested nodes counted']);
  // Ordinary objects' length properties are real data, not array bookkeeping.
  expect(graphAdmissionErrors({ nodes: { length: 0, first: 1 } }, 1)).toEqual(['budget: 2 nodes (at most 1); all nested nodes counted']);
});

test('sparse and extended arrays retain the original structural refusal', () => {
  const sparse: number[] = []; sparse.length = 1;
  expect(graphAdmissionErrors(sparse)).toEqual(['graph: sparse JSON arrays refused']);
  const extended = [0]; Object.defineProperty(extended, 'extra', { value: 1, enumerable: true });
  expect(graphAdmissionErrors(extended)).toEqual(['graph: sparse JSON arrays refused']);
  const symbolic = [0]; Object.defineProperty(symbolic, Symbol('hidden'), { value: 1 });
  expect(graphAdmissionErrors(symbolic)).toEqual(['graph: plain JSON data required']);
});

test('descriptor admission never invokes getters or toJSON and rejects hidden fields', () => {
  let calls = 0;
  const accessor = Object.defineProperty({}, 'field', { enumerable: true, get: () => { calls++; return 1; } });
  expect(graphAdmissionErrors(accessor)).toEqual(['graph: JSON accessors and hidden properties refused']);
  const hidden = Object.defineProperty({}, 'field', { value: 1 });
  expect(graphAdmissionErrors(hidden)).toEqual(['graph: JSON accessors and hidden properties refused']);
  expect(graphAdmissionErrors({ toJSON: () => { calls++; return null; } })).toEqual(['graph: plain JSON data required']);
  expect(calls).toBe(0);
});

test('depth, active cycles and finite-number fences remain independent', () => {
  let value: unknown = 0;
  for (let depth = 0; depth < GRAPH_ADMISSION_LIMITS.depth; depth++) value = [value];
  expect(graphAdmissionErrors(value)).toEqual([]);
  expect(graphAdmissionErrors([value])).toEqual(['graph: JSON depth exceeds admission cap']);
  const cyclic: { self?: object } = {}; cyclic.self = cyclic;
  expect(graphAdmissionErrors(cyclic)).toEqual(['graph: JSON cycle refused']);
  const shared = { value: 1 };
  expect(graphAdmissionErrors([shared, shared])).toEqual([]);
  for (const invalid of [Number.NaN, Infinity, -Infinity, -0]) expect(graphAdmissionErrors([invalid])).toEqual(['graph: finite JSON numbers required']);
});
