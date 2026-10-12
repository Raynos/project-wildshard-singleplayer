import { expect, it } from 'vitest';
import * as rows from '../src/shards/pine-hollow/data/layout';
import * as queries from '../src/shards/pine-hollow/behaviour/layout';
import * as original from '../src/shards/pine-hollow-legacy/layout';

it('keeps every layout export as exact JSON data from the frozen native layout', () => {
  const reference = new Map<string, unknown>(Object.entries(original));
  for (const [name, value] of Object.entries(rows)) {
    expect(value, name).toEqual(reference.get(name));
    const encoded = JSON.stringify(value), decoded: unknown = JSON.parse(encoded);
    expect(decoded, name).toStrictEqual(value);
  }
});

it('preserves ridge, polyline, bed, pool and cable laws at 10k coordinates', () => {
  for (let index = 0; index < 10_000; index++) {
    const x = ((index * 137.031) % 620) - 310, z = ((index * 71.917) % 620) - 310;
    const nearest = queries.nearestOnPolyline(rows.CREEK, x, z);
    expect(nearest).toEqual(original.nearestOnPolyline(original.CREEK, x, z));
    expect(queries.ridgeFootZ(x)).toBe(original.ridgeFootZ(x));
    expect(queries.creekBedAt(nearest.s)).toBe(original.creekBedAt(nearest.s));
    expect(queries.beaverPoolBed(nearest.s, nearest.d)).toBe(original.beaverPoolBed(nearest.s, nearest.d));
    expect(queries.inBeaverPool(x, z)).toBe(original.inBeaverPool(x, z));
    expect(queries.ziplineAt(index / 9999, 17.25, 3.75)).toEqual(original.ziplineAt(index / 9999, 17.25, 3.75));
  }
  expect(queries.creekSpan()).toEqual(original.creekSpan());
  for (let index = 0; index <= rows.CREEK.length; index++) {
    expect(queries.arcTo(rows.CREEK, index)).toBe(original.arcTo(original.CREEK, index));
  }
});

it('retains the native shared drain-state law rather than capturing a fixed water level', () => {
  const before = rows.beaverPoolLevel.y, old = original.beaverPoolLevel.y;
  try {
    for (const level of [rows.BEAVER_POOL.full, rows.BEAVER_POOL.drained, -3.31]) {
      rows.beaverPoolLevel.y = level; original.beaverPoolLevel.y = level;
      for (let index = 0; index < 1000; index++) {
        const s = -10 + index * 0.4;
        expect(queries.creekSurfaceAt(s)).toBe(original.creekSurfaceAt(s));
        expect(queries.creekFlowAt(s)).toBe(original.creekFlowAt(s));
        expect(queries.creekFoamAt(s)).toBe(original.creekFoamAt(s));
        const x = -118 - index * 0.1, z = 92 - index * 0.33;
        expect(queries.creekWaterAt(x, z)).toBe(original.creekWaterAt(x, z));
      }
    }
  } finally {
    rows.beaverPoolLevel.y = before; original.beaverPoolLevel.y = old;
  }
});
