import { describe, expect, it } from 'vitest';
import type { GridCell } from '../src/game/grid/assembly';
import { planNearPlaceholders } from '../src/game/grid/nearPlaceholderPlan';

const pitch = 555;
function cell(x: number, z: number): GridCell {
  return { instance: `${x},${z}`, slug: 'fixture', cell: [x, z], origin: { x: x * pitch, y: 0, z: z * pitch } };
}
const cells = [-1, 0, 1, 2].flatMap(x => [-1, 0, 1, 2].map(z => cell(x, z)));
const ids = (plan: ReturnType<typeof planNearPlaceholders>): string[] => plan.cells.map(row => row.instance).sort();

describe('G342 bounded visual near-placeholder selection', () => {
  it('selects the four cells around a crossroads', () => {
    const plan = planNearPlaceholders(cells, pitch, { x: pitch / 2, z: pitch / 2 }, null);
    expect(plan.mode).toBe('crossroads'); expect(plan.crossroads).toEqual([0, 0]);
    expect(ids(plan)).toEqual(['0,0', '0,1', '1,0', '1,1']);
    expect(plan.cells.every(row => Number.isFinite(row.distance) && row.distance >= 0)).toBe(true);
  });
  it('selects only cardinal neighbours in a cell interior', () => {
    const plan = planNearPlaceholders(cells, pitch, { x: 0, z: 0 }, '0,0');
    expect(plan.mode).toBe('adjacent'); expect(plan.crossroads).toBeNull();
    expect(ids(plan)).toEqual(['-1,0', '0,-1', '0,1', '1,0']);
  });
  it('never asks for the cell whose real runtime already owns presentation', () => {
    const plan = planNearPlaceholders(cells, pitch, { x: pitch / 2, z: pitch / 2 }, '1,1');
    expect(ids(plan)).toEqual(['0,0', '0,1', '1,0']);
  });
  it('uses signed grid coordinates and stable ordering regardless of catalogue order', () => {
    const point = { x: -pitch / 2, z: -pitch / 2 };
    const plan = planNearPlaceholders(cells, pitch, point, null);
    expect(plan.crossroads).toEqual([-1, -1]); expect(ids(plan)).toEqual(['-1,-1', '-1,0', '0,-1', '0,0']);
    expect(planNearPlaceholders([...cells].reverse(), pitch, point, null)).toEqual(plan);
  });
  it('keeps a crossroads stable across small road-centre movement, then replaces it', () => {
    const previous = [0, 0] as const;
    const held = planNearPlaceholders(cells, pitch, { x: -1, z: pitch / 2 }, null, previous);
    expect(held.crossroads).toEqual(previous);
    const moved = planNearPlaceholders(cells, pitch, { x: -16, z: pitch / 2 }, null, previous);
    expect(moved.crossroads).toEqual([-1, 0]); expect(ids(moved)).toEqual(['-1,0', '-1,1', '0,0', '0,1']);
  });
  it('keeps finite-grid empty neighbours empty and never mutates its inputs', () => {
    const sparse = [cell(0, 0), cell(1, 0)];
    const before = structuredClone(sparse), point = Object.freeze({ x: pitch / 2, z: pitch / 2 });
    expect(ids(planNearPlaceholders(sparse, pitch, point, null))).toEqual(['0,0', '1,0']);
    expect(sparse).toEqual(before);
    expect(planNearPlaceholders([], pitch, point, null).cells).toEqual([]);
  });
  it('refuses nonfinite positions, invalid grid spacing and malformed previous crossroads', () => {
    expect(() => planNearPlaceholders(cells, pitch, { x: Number.NaN, z: 0 }, null)).toThrow('coordinates');
    expect(() => planNearPlaceholders(cells, 500, { x: 0, z: 0 }, null)).toThrow('coordinates');
    expect(() => planNearPlaceholders(cells, pitch, { x: 0, z: 0 }, null, [0.5, 0])).toThrow('crossroads');
  });
  it('refuses duplicate instances, duplicate cells and mismatched render placement', () => {
    expect(() => planNearPlaceholders([cell(0, 0), cell(0, 0)], pitch, { x: 0, z: 0 }, null)).toThrow('cell');
    const duplicate = { ...cell(0, 0), instance: 'other' };
    expect(() => planNearPlaceholders([cell(0, 0), duplicate], pitch, { x: 0, z: 0 }, null)).toThrow('cell');
    const misplaced = { ...cell(0, 0), origin: { x: 1, y: 0, z: 0 } };
    expect(() => planNearPlaceholders([misplaced], pitch, { x: 0, z: 0 }, null)).toThrow('cell');
  });
});
