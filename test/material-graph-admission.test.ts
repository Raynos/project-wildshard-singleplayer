import { expect, it } from 'vitest';
import { GRAPH_ADMISSION_LIMITS as limits, graphAdmissionErrors, validateGraph } from '../src/engine/core/materialGraph';
import { compileGraph } from '../src/engine/render/graph/compile';

const base = () => ({ version: 1, kind: 'material', nodes: {}, stages: { surface: { colour: [1, 1, 1] } } });
const nodes = (count: number) => Object.fromEntries(Array.from({ length: count }, (_, index) => [`n${index}`, { op: 'time' }]));
it('counts every node including unreachable nested loop bodies before typing or compilation', () => {
  expect(graphAdmissionErrors({ ...base(), nodes: nodes(160) })).toEqual([]);
  const hidden = { ...base(), nodes: { ...nodes(160), outer: { op: 'loop', count: 1, in: [0], body: { nodes: nodes(160), out: 0 } } } };
  expect(validateGraph(hidden)).toMatchObject({ ok: false }); expect(graphAdmissionErrors(hidden).join(' ')).toContain('all nested nodes');
  expect(() => compileGraph(hidden)).toThrow('all nested nodes');
  const nested = { ...base(), nodes: { ...nodes(159), outer: { op: 'loop', count: 1, in: [0], body: { nodes: nodes(1), out: 0 } } } };
  expect(graphAdmissionErrors(nested).join(' ')).toContain('161 nodes');
});
it('bounds exact UTF-8 JSON bytes, including multibyte keys and values', () => {
  const row = { text: '' }, overhead = new TextEncoder().encode(JSON.stringify(row)).length;
  row.text = 'x'.repeat(limits.bytes - overhead); expect(graphAdmissionErrors(row)).toEqual([]);
  row.text += 'x'; expect(graphAdmissionErrors(row).join(' ')).toContain('byte size');
  row.text = 'é'.repeat((limits.bytes - overhead) / 2); expect(graphAdmissionErrors(row)).toEqual([]);
  row.text += 'é'; expect(graphAdmissionErrors(row).join(' ')).toContain('byte size');
});
it('refuses cycles, deep structures and accessors without executing authored code', () => {
  let calls = 0; const getter = { get nodes() { calls++; return {}; } }, toJson = { toJSON() { calls++; return base(); } };
  expect(validateGraph(getter).ok).toBe(false); expect(validateGraph(toJson).ok).toBe(false); expect(calls).toBe(0);
  const cycle: { self?: unknown } = {}; cycle.self = cycle; expect(graphAdmissionErrors(cycle).join(' ')).toContain('cycle');
  let deep: unknown = 0; for (let index = 0; index <= limits.depth; index++) deep = { child: deep };
  expect(graphAdmissionErrors(deep).join(' ')).toContain('depth');
});
it('fuzzes both parser and compiler deterministically under bounded admission', () => {
  for (let index = 0; index < 256; index++) {
    const input = index % 4 === 0 ? { ...base(), nodes: nodes(161 + index) } : index % 4 === 1 ? { ...base(), nodes: { x: { op: `unknown${index}` } }, stages: { surface: { colour: 'x' } } } : index % 4 === 2 ? { ...base(), stages: { surface: { colour: [index / 256, 0.5, 1] } } } : { ...base(), params: { text: 'x'.repeat(limits.bytes + index) } };
    const parsed = validateGraph(input);
    if (parsed.ok) { const compiled = compileGraph(input); expect(compiled.material).toBeDefined(); compiled.material.dispose(); }
    else expect(() => compileGraph(input)).toThrow();
  }
});
