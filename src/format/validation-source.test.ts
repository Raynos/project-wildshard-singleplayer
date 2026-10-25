import { expect, test, vi } from 'vitest';
import { validationSourceBytes, validationSourceBytesPaced } from './product';

test.each([
  null,
  { z: [3, { z: '雪\n"', a: true }], a: { '10': 10, '2': 2, '01': 1 }, omitted: undefined },
  JSON.parse('{"__proto__":{"z":1,"a":2},"constructor":null}') as unknown,
  [undefined, Number.NaN, Number.POSITIVE_INFINITY, -0],
])('paced receipt sorting preserves original bytes for %j', async source => {
  const pause = vi.fn(() => Promise.resolve());
  expect(await validationSourceBytesPaced(source, pause)).toEqual(validationSourceBytes(source));
  expect(pause).toHaveBeenCalled();
});

test('large array receipt sorting yields before the full source is visited', async () => {
  let read = 0;
  const rows = Array.from({ length: 2000 }, (_, i) => ({ z: i, get a(): number { read++; return i; } }));
  const source = { files: rows, shared: rows[0], repeated: rows[0] };
  const expected = validationSourceBytes(source);
  read = 0;
  const checkpoints: number[] = [];
  const clock = vi.spyOn(Date, 'now');
  let now = 0;
  clock.mockImplementation(() => { now += 5; return now; });
  try {
    const actual = await validationSourceBytesPaced(source, () => { checkpoints.push(read); return Promise.resolve(); });
    expect(actual).toEqual(expected);
    expect(checkpoints.length).toBeGreaterThan(10);
    expect(checkpoints[0]).toBeGreaterThan(0);
    expect(checkpoints[0]).toBeLessThan(2000);
    expect(Math.max(...checkpoints.map((count, at) => count - (checkpoints[at - 1] ?? 0)))).toBeLessThanOrEqual(128);
  } finally { clock.mockRestore(); }
});

test('receipt pacing propagates owner cancellation before finishing the source', async () => {
  const source = Array.from({ length: 2000 }, (_, index) => ({ index }));
  const cancelled = new Error('owner disposed');
  const clock = vi.spyOn(Date, 'now');
  let now = 0;
  clock.mockImplementation(() => { now += 5; return now; });
  try {
    await expect(validationSourceBytesPaced(source, () => Promise.reject(cancelled))).rejects.toBe(cancelled);
  } finally { clock.mockRestore(); }
});

test('cyclic receipt sources still refuse instead of publishing partial bytes', async () => {
  const source: { self?: unknown } = {};
  source.self = source;
  await expect(validationSourceBytesPaced(source, () => Promise.resolve())).rejects.toBeInstanceOf(TypeError);
});
