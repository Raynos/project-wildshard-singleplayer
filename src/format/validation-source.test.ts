import { expect, test, vi } from 'vitest';
import { validationSourceBytes, validationSourceBytesPaced } from './validationReceipt';

test.each([
  null,
  { z: [3, { z: '雪\n"', a: true }], a: { '10': 10, '2': 2, '01': 1 }, omitted: undefined },
  JSON.parse('{"__proto__":{"z":1,"a":2},"constructor":null}') as unknown,
  [undefined, Number.NaN, Number.POSITIVE_INFINITY, -0],
])('paced receipt sorting preserves original bytes for %j', async source => {
  const pause = vi.fn(() => Promise.resolve());
  expect(await validationSourceBytesPaced(source, pause, () => 0)).toEqual(validationSourceBytes(source));
  expect(pause).toHaveBeenCalled();
});

test('paced receipt bytes match the direct writer over seeded random sources', async () => {
  let seed = 7;
  const next = (): number => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const keys = ['a', 'B', '0', '7', '10', '01', 'z', '__proto__', 'é', '4294967295'];
  const make = (depth: number): unknown => {
    const pick = next();
    if (depth > 3 || pick < 0.3) return [null, 1.5, -0, Number.NaN, 'x"\n', true, undefined][Math.floor(next() * 7)];
    if (pick < 0.6) return Array.from({ length: Math.floor(next() * 5) }, () => make(depth + 1));
    const row: Record<string, unknown> = {};
    for (let i = Math.floor(next() * 6); i > 0; i--) Object.defineProperty(row, keys[Math.floor(next() * keys.length)] ?? 'k', { value: make(depth + 1), enumerable: true, writable: true, configurable: true });
    return row;
  };
  for (let i = 0; i < 200; i++) { const source = make(0); expect(await validationSourceBytesPaced(source, () => Promise.resolve(), () => 0)).toEqual(validationSourceBytes(source)); }
});

test('large array receipt sorting yields before the full source is visited', async () => {
  let read = 0;
  const rows = Array.from({ length: 2000 }, (_, i) => ({ z: i, get a(): number { read++; return i; } }));
  const source = { files: rows, shared: rows[0], repeated: rows[0] };
  const expected = validationSourceBytes(source);
  read = 0;
  const checkpoints: number[] = [];
  let now = 0;
  const clock = (): number => { now += 5; return now; };
  const actual = await validationSourceBytesPaced(source, () => { checkpoints.push(read); return Promise.resolve(); }, clock);
  expect(actual).toEqual(expected);
  expect(checkpoints.length).toBeGreaterThan(10);
  expect(checkpoints[0]).toBeGreaterThan(0);
  expect(checkpoints[0]).toBeLessThan(2000);
  expect(Math.max(...checkpoints.map((count, at) => count - (checkpoints[at - 1] ?? 0)))).toBeLessThanOrEqual(128);
});

test('receipt pacing propagates owner cancellation before finishing the source', async () => {
  const source = Array.from({ length: 2000 }, (_, index) => ({ index }));
  const cancelled = new Error('owner disposed');
  let now = 0;
  const clock = (): number => { now += 5; return now; };
  await expect(validationSourceBytesPaced(source, () => Promise.reject(cancelled), clock)).rejects.toBe(cancelled);
});

test('cyclic receipt sources still refuse instead of publishing partial bytes', async () => {
  const source: { self?: unknown } = {};
  source.self = source;
  await expect(validationSourceBytesPaced(source, () => Promise.resolve(), () => 0)).rejects.toBeInstanceOf(TypeError);
});
