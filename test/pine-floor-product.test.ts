import { Matrix4, Quaternion, Vector3 } from 'three';
import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { decodeFloorRecords } from '../src/shards/pine-hollow/generators/floorRows.mjs';
import { output } from '../src/shards/pine-hollow/generators/output';
import { parseFloorRows } from '../src/shards/pine-hollow/generators/sections';
import floorRows from '../src/shards/pine-hollow/data/floorLayout.generated.json' with { type: 'json' };

const UP = new Vector3(0, 1, 0), normal = new Vector3(), place = new Vector3(), size = new Vector3(), tilt = new Quaternion(), turn = new Quaternion();
/** The frozen page composer, copied verbatim from the retired legacy undergrowth's `matrixOf`:
 *  yaw about up, then tilt up onto the ground normal, at the placement's point and uniform scale. */
function matrixOf(it: { x: number; y: number; z: number; nx: number; ny: number; nz: number; rot: number; scale: number }, target = new Matrix4()): Matrix4 {
  tilt.setFromUnitVectors(UP, normal.set(it.nx, it.ny, it.nz));
  turn.setFromAxisAngle(UP, it.rot).premultiply(tilt);
  return target.compose(place.set(it.x, it.y, it.z), turn, size.set(it.scale, it.scale, it.scale));
}

test('the named floor preserves all 22,250 shipping placements and refuses malformed or oversized records', () => {
  const file = output.namedFiles.find(row => row.name === 'world/floor.json');
  const bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (bytes === undefined) throw new Error('Missing named floor');
  const rows = parseFloorRows(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  const source = parseFloorRows(floorRows);
  // Recorded from the actual shipping loadUnderPlacements at 238bcf425,
  // before moving its decoder: hash every value, tint, normal and array order.
  const facts = Object.fromEntries(Object.entries(source.layout).map(([kind, items]) => [kind, items.map(({ x, y, z, nx, ny, nz, rot, scale, r, g, b }) => ({ x, y, z, nx, ny, nz, rot, scale, r, g, b }))]));
  expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(facts)))).toBe('7c0b23e88b4c31727bed35d146ded1db0c13a6b049657365a0616c44b9704dfb');
  // Compare all sixteen components with the actual frozen page composer.
  // Its native libm results vary by CPU even at a Float32 rounding boundary.
  // The product rounds every number to 1e-5 (0.01 mm); compare it to the source.
  const matrix = new Matrix4();
  let worst = 0, rounded = 0, compared = 0;
  const products = Object.values(rows.layout);
  for (const [kind, items] of Object.values(source.layout).entries()) for (const [at, item] of items.entries()) {
    const original = matrixOf(item, matrix).elements, product = products[kind]?.[at];
    if (product === undefined) throw new Error('Missing product placement');
    for (let index = 0; index < 16; index++) {
      const value = original[index], baked = item.matrix[index], shipped = product.matrix[index];
      if (value === undefined || baked === undefined || shipped === undefined) throw new Error('Missing matrix component');
      worst = Math.max(worst, Math.abs(value - baked)); rounded = Math.max(rounded, Math.abs(baked - shipped));
    }
    for (const key of ['x', 'y', 'z', 'nx', 'ny', 'nz', 'rot', 'scale', 'r', 'g', 'b'] as const) rounded = Math.max(rounded, Math.abs(item[key] - product[key]));
    compared++;
  }
  expect(compared).toBe(22_250);
  expect(worst).toBeLessThanOrEqual(1e-12);
  expect(rounded).toBeLessThanOrEqual(5.000001e-6);
  expect(rows.counts).toEqual([6000, 3750, 5000, 3000, 3000, 1500]);
  expect(() => parseFloorRows({ ...rows, counts: [1, 1, 1, 1, 1, 1] })).toThrow();
  expect(() => parseFloorRows({ ...rows, extra: true })).toThrow();
  const point = rows.layout.ferns[0];
  if (point === undefined) throw new Error('Missing shipping fern');
  expect(() => parseFloorRows({ ...rows, layout: { ...rows.layout, ferns: [{ ...point, nx: Infinity }] } })).toThrow();
  expect(() => parseFloorRows({ ...rows, layout: { ...rows.layout, ferns: [{ ...point, matrix: [1] }] } })).toThrow();
  expect(() => parseFloorRows({ counts: [40001, 0, 0, 0, 0, 0], layout: { ferns: Array.from({ length: 40001 }, () => point), shrubs: [], litter: [], stones: [], moss: [], reeds: [] } })).toThrow();
  expect(() => decodeFloorRecords(new Uint8Array(32), rows.counts)).toThrow('invalid floor records');
  const invalidCounts = new Uint8Array(32), view = new DataView(invalidCounts.buffer);
  view.setUint32(0, 0x46555357, true); view.setUint32(4, 2, true);
  expect(() => decodeFloorRecords(invalidCounts, rows.counts)).toThrow('invalid floor counts');
});
