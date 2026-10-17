import { expect, test } from 'vitest';
import * as v from 'valibot';
import { BufferAttribute, BufferGeometryLoader, Quaternion, Vector3, type BufferGeometry } from 'three';
import { output } from '../src/shards/nine-dragon-stack/generators/output';
import { ClothSheet, StrandTassel } from '../src/shards/nine-dragon-stack/runtime/looks/strandCloth';
import { TALISMAN, TASSEL } from '../src/shards/nine-dragon-stack/data/cloth';
import { viewmodelLook } from '../src/shards/nine-dragon-stack/runtime/looks/vmLook';
import viewmodel from '../src/shards/nine-dragon-stack/data/decals.json' with { type: 'json' };
import baseline from './fixtures/nine-cloth-buffers.json' with { type: 'json' };

async function channels(geometry: BufferGeometry): Promise<unknown> {
  const hash = async (array: BufferAttribute['array']): Promise<string> => {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)));
    return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  };
  return { attributes: Object.fromEntries(await Promise.all(Object.entries(geometry.attributes).map(async ([name, attribute]) => {
    if (!(attribute instanceof BufferAttribute)) throw new Error('Cloth channels stay ordinary buffers');
    return [name, { type: attribute.array.constructor.name, size: attribute.itemSize, normalized: attribute.normalized, count: attribute.count, hash: await hash(attribute.array) }] as const;
  }))), index: geometry.index === null ? null : { type: geometry.index.array.constructor.name, count: geometry.index.count, hash: await hash(geometry.index.array) } };
}

function parts(): { knot: BufferGeometry; tassel: BufferGeometry; sheet: BufferGeometry; cord: BufferGeometry } {
  const row = output.namedFiles.find(file => file.name === 'weapons/jian-cloth.json');
  const bytes = row === undefined ? undefined : output.assets.get(row.hash);
  if (bytes === undefined) throw new Error('Missing admitted viewmodel cloth blob');
  const data = v.parse(v.strictObject({ rows: v.unknown(), knot: v.unknown(), tassel: v.unknown(), sheet: v.unknown(), cord: v.unknown() }), JSON.parse(new TextDecoder().decode(bytes), (_key, value: unknown) => value === '-0' ? -0 : value));
  expect(data.rows).toEqual({ tassel: TASSEL, sheet: TALISMAN });
  const loader = new BufferGeometryLoader();
  return { knot: loader.parse(data.knot), tassel: loader.parse(data.tassel), sheet: loader.parse(data.sheet), cord: loader.parse(data.cord) };
}

// Recorded from the original vm/cloth.ts, vm/geo.ts and fpArms dressParts at 21bcf8dac.
test('fixed cloth and knot preserve every original vertex and index byte', async () => {
  const geometry = parts();
  for (const key of ['knot', 'tassel', 'sheet', 'cord'] as const) expect(await channels(geometry[key])).toEqual(baseline.raw[key]);
});

test('baked topology retains the original 90-frame cloth and knot motion', async () => {
  const geometry = parts();
  const tassel = new StrandTassel(TASSEL, geometry.tassel), talisman = new ClothSheet(TALISMAN, geometry.sheet, geometry.cord);
  const q = new Quaternion(), pivot = new Vector3(), gravity = new Vector3(0, -9.8, 0);
  const caps = [{ a: new Vector3(-0.02, -0.12, 0), b: new Vector3(0.02, -0.2, 0), r: 0.035 }];
  const trace = [];
  for (let i = 0; i < 90; i++) {
    const dt = i % 3 === 0 ? 1 / 30 : 1 / 60;
    pivot.set(0.02 * Math.sin(i * 0.13), 0.005 * Math.cos(i * 0.17), 0.01 * Math.sin(i * 0.07));
    q.setFromAxisAngle(new Vector3(0, 0, 1), 0.2 * Math.sin(i * 0.11));
    tassel.step(dt, pivot, q, gravity, 1, caps);
    talisman.step(dt, pivot, q, gravity, 1, caps);
    if ([0, 29, 59, 89].includes(i)) trace.push({ frame: i, tassel: await channels(tassel.geo), sheet: await channels(talisman.geo), cord: await channels(talisman.cordGeo), cap: tassel.cap.toArray(), direction: tassel.capDir.toArray() });
  }
  expect(trace).toEqual(baseline.trace);
});

test('separate rigs retain independent mutable cloth buffers', () => {
  const first = parts(), second = parts();
  const a = new StrandTassel(TASSEL, first.tassel), b = new StrandTassel(TASSEL, second.tassel);
  a.step(1 / 30, new Vector3(1, 2, 3), new Quaternion(), new Vector3(0, -9.8, 0), 1);
  const position = b.geo.getAttribute('position');
  expect(Array.from(position.array).every(value => value === 0)).toBe(true);
  expect(a.geo.index?.array).not.toBe(b.geo.index?.array);
  expect(a.geo.getAttribute('uv').array).not.toBe(b.geo.getAttribute('uv').array);
});

test('the shared class table preserves every shader byte and material value', async () => {
  const look = viewmodelLook(viewmodel.classes);
  expect(viewmodel.classes).toEqual(baseline.look.classes);
  expect(look.PALETTE).toEqual(baseline.look.palette);
  expect(look.NPAL).toBe(baseline.look.npal);
  expect(look.VM_PAL).toEqual(baseline.look.vmPalette);
  expect(look.VM_UNIFORMS).toEqual(baseline.look.uniforms);
  for (const key of ['VM_VS', 'VM_FS', 'VM_HULL_VS', 'VM_HULL_FS'] as const) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(look[key])));
    expect(Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')).toBe(baseline.look.shaders[key]);
  }
});
