import { expect, it } from 'vitest';
import { TrampleField } from '../../src/game/systems/looks/trample';

/** a walk east through the grass with a standing push, and some recovery */
function trodden(): TrampleField {
  const field = new TrampleField(), p = { x: 3, z: -7 };
  for (let i = 0; i < 90; i++) { field.push(p.x, p.z, 0.55, 1, 5, 0); field.update(1 / 60, p); p.x += 5 / 60; }
  field.push(p.x, p.z, 0.8, 1.5);
  return field;
}

it('a trample map continues exactly from its snapshot (SF72): pushes, recovery and the window\'s scroll', () => {
  const a = trodden(), b = new TrampleField();
  b.restore(a.snapshot());
  expect(b.snapshot()).toEqual(a.snapshot());
  expect(a.snapshot().cells.length).toBeGreaterThan(30);
  const p = { x: 40, z: -7 };
  for (const f of [a, b]) for (let i = 0; i < 200; i++) { f.push(p.x + i * 0.1, p.z, 0.55, 1, 6, 0); f.update(1 / 60, { x: p.x + i * 0.1, z: p.z }); }
  expect(b.snapshot()).toEqual(a.snapshot());
  expect(b.amountAt(44, -7)).toBe(a.amountAt(44, -7));
});

it('an untouched map snapshots its unset window, and a restore refuses a state no map could hold', () => {
  expect(new TrampleField().snapshot()).toEqual({ cells: [], origin: null, centre: [0, 0], anyFlat: false, dirty: false, tick: 0 });
  const saved = trodden().snapshot(), field = new TrampleField();
  expect(() => { field.restore({ ...saved, cells: [5, 0.5, 0, 4, 0.5, 0] }); }).toThrow('Invalid trample cell');
  expect(() => { field.restore({ ...saved, cells: [5, 1.5, 0] }); }).toThrow('Invalid trample cell');
  expect(() => { field.restore({ ...saved, cells: [256 * 256, 0.5, 0] }); }).toThrow('Invalid trample cell');
  expect(() => { field.restore({ ...saved, tick: Number.NaN }); }).toThrow('Invalid trample state');
  expect(field.snapshot().cells).toEqual([]);
  field.track({ x: 0, z: 0 }, 0.5);
  expect(() => field.snapshot()).toThrow('tracked movers');
});
