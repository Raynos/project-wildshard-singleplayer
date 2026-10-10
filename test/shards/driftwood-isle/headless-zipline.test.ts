// oxlint-disable-next-line import/no-nodejs-modules -- Hash the captured, immutable shipping gameplay statements.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Refuse a changed shipping ride law until its oracle is reviewed.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Run the actual captured page method, including its visual-only assignments.
import { Script } from 'node:vm';
import { Vector3 } from 'three';
import { expect, it, vi } from 'vitest';
import { DriftwoodZipline } from '../../../src/shards/driftwood-isle/runtime/zipline';
import { ZiplineLayout } from '../../fixtures/driftwood-zipline/shipping';
import spots from '../../../src/shards/driftwood-isle/runtime/spots.baked.json';
import source from '../../fixtures/driftwood-zipline/ride.json';

const spec = () => ({ top: new Vector3(spots.zipline.top.x, spots.zipline.top.y, spots.zipline.top.z),
  bottom: new Vector3(spots.zipline.bottom.x, spots.zipline.bottom.y, spots.zipline.bottom.z), sag: spots.zipline.sag });
const player = () => ({ position: new Vector3(), velocity: new Vector3() });
const start = new Script(`(function () { ${source.start} }).call(page)`);
const update = new Script(`${source.constants}\n(function (dt, player) { ${source.update} }).call(page, dt, player)`);

function pageRide(onRide: (on: boolean) => void) {
  const layout = new ZiplineLayout(spec()), trolley = { position: new Vector3(), rotation: { z: 0 } };
  return { riding: false, s: 0, v: 0, trolley, lay: layout, onRide,
    at: (s: number, out: Vector3) => layout.at(s, out), parkTrolley: () => { layout.park(trolley.position); } };
}

it('matches the real page ride for 10k phone/desktop frames at the actually captured endpoints', () => {
  expect(createHash('sha256').update(`${source.constants}\n${source.start}\n${source.update}`).digest('hex')).toBe(source.bodySha256);
  const shipping = readFileSync(new URL('../../../src/shards/driftwood-isle/world/Zipline.ts', import.meta.url), 'utf8');
  const startAt = shipping.indexOf('  start(): void'), updateAt = shipping.indexOf('  update(dt:');
  const startBody = shipping.slice(shipping.indexOf('    if (this.riding) return;', startAt), shipping.indexOf('\n  }', startAt));
  const updateBody = shipping.slice(shipping.indexOf('    if (!this.riding) return;', updateAt), shipping.indexOf('\n  }', updateAt));
  const constants = shipping.split('\n').filter(line => line.startsWith('const HANG =') || line.startsWith('const G =')).join('\n');
  expect(createHash('sha256').update(`${constants}\n${startBody}\n${updateBody}`).digest('hex')).toBe(source.bodySha256);
  expect(source.revision).toMatch(/^[a-f0-9]{40}$/u);
  const pageEvents: boolean[] = [], nativeEvents: boolean[] = [];
  const page = pageRide(on => { pageEvents.push(on); }), native = new DriftwoodZipline(spec(), on => { nativeEvents.push(on); });
  const pagePlayer = player(), nativePlayer = player(), ahead = new Vector3();
  for (let tick = 0; tick < 10_000; tick++) {
    if (tick % 500 === 0) { start.runInNewContext({ page }); native.start(); native.start(); }
    const dt = tick % 3 === 0 ? 1 / 30 : 1 / 60;
    update.runInNewContext({ page, dt, player: pagePlayer, _p: ahead }); native.update(dt, nativePlayer);
    expect(nativePlayer).toEqual(pagePlayer); expect(native.snapshot()).toEqual({ riding: page.riding, s: page.s, v: page.v });
    expect(nativeEvents).toEqual(pageEvents);
  }
  expect(nativeEvents.filter(on => !on)).toHaveLength(20);
});

it('restores mid-ride without callbacks or a pose step and preserves the complete finish suffix', () => {
  const native = new DriftwoodZipline(spec(), vi.fn<(on: boolean) => void>()), original = player(); native.start();
  for (let tick = 0; tick < 97; tick++) native.update(1 / 60, original);
  expect(native.isRiding).toBe(true);
  const onRide = vi.fn<(on: boolean) => void>(), restored = new DriftwoodZipline(spec(), onRide), other = player();
  other.position.copy(original.position); other.velocity.copy(original.velocity);
  const saved = native.snapshot(); restored.restore(saved);
  expect(onRide).not.toHaveBeenCalled(); expect(other).toEqual(original);
  saved.s = 999; expect(restored.snapshot()).toEqual(native.snapshot());
  const before = restored.snapshot();
  for (const bad of [{ ...before, v: 17 }, { ...before, s: -1 }, { ...before, s: Infinity }, { ...before, extra: true }]) {
    expect(() => restored.restore(bad)).toThrow(); expect(restored.snapshot()).toEqual(before);
  }
  for (let tick = 97; tick < 10_000; tick++) {
    native.update(1 / 60, original); restored.update(1 / 60, other);
    expect(other).toEqual(original); expect(restored.snapshot()).toEqual(native.snapshot());
  }
  expect(onRide).toHaveBeenCalledExactlyOnceWith(false);
});
