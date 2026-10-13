import { describe, expect, it } from 'vitest';
import type { GridCell } from '../src/game/grid/assembly';
import { planNearPlaceholders } from '../src/game/grid/nearPlaceholderPlan';

const pitch = 555;
function cell(x: number, z: number): GridCell {
  return { instance: `${x},${z}`, slug: 'fixture', cell: [x, z], origin: { x: x * pitch, y: 0, z: z * pitch } };
}
const cells = [-1, 0, 1, 2].flatMap(x => [-1, 0, 1, 2].map(z => cell(x, z)));
const ids = (plan: ReturnType<typeof planNearPlaceholders>): string[] => plan.cells.map(row => row.instance).sort();

describe('G342 / G371 bounded visual near-placeholder selection', () => {
  it('selects the four cells around a crossroads', () => {
    const plan = planNearPlaceholders(cells, pitch, { x: pitch / 2, z: pitch / 2 }, null);
    expect(ids(plan)).toEqual(['0,0', '0,1', '1,0', '1,1']);
    expect(plan.cells.every(row => Number.isFinite(row.distance) && row.distance >= 0)).toBe(true);
  });
  it('G380 / G385 C (the hero capture pin only): every cell but the entered one, past the reach and the four-cell cap', () => {
    const plan = planNearPlaceholders(cells, pitch, { x: 0, z: 0 }, '0,0', { every: true });
    expect(plan.cells).toHaveLength(cells.length - 1);
    expect(plan.cells.some(row => row.distance > pitch)).toBe(true);
  });
  it('over a cell centre: the four cardinal neighbours are nearest (a diagonal is farther)', () => {
    const plan = planNearPlaceholders(cells, pitch, { x: 0, z: 0 }, '0,0');
    expect(ids(plan)).toEqual(['-1,0', '0,-1', '0,1', '1,0']);
    expect(plan.cells.map(row => row.distance)).toEqual([305, 305, 305, 305]);
  });
  it('includes a diagonal when a cardinal neighbour is missing or has no placeholder (G371)', () => {
    // over an edge cell's centre: three cardinal neighbours, then the nearer diagonals
    const edge = [-1, 0, 1].flatMap(x => [-1, 0, 1].map(z => cell(x, z)));
    const plan = planNearPlaceholders(edge, pitch, { x: pitch, z: 0 }, '1,0');
    expect(ids(plan)).toEqual(['0,-1', '0,0', '1,-1', '1,1']);
    const skipped = planNearPlaceholders(edge, pitch, { x: pitch, z: 0 }, '1,0', { skip: new Set(['1,-1', '0,-1']) });
    expect(ids(skipped)).toEqual(['0,0', '0,1', '1,1']);
    expect(skipped.cells.find(row => row.instance === '0,1')?.distance).toBeCloseTo(Math.hypot(305, 305));
  });
  it('plans from the eye: a camera nearer a diagonal cell picks it over the cardinal ones', () => {
    const plan = planNearPlaceholders(cells, pitch, { x: 230, z: 230 }, '0,0');
    expect(plan.cells[0]?.instance).toMatch(/^(0,1|1,0)$/u);
    expect(ids(plan)).toContain('1,1');
  });
  it('never asks for the cell whose real runtime already owns presentation', () => {
    const plan = planNearPlaceholders(cells, pitch, { x: pitch / 2, z: pitch / 2 }, '1,1');
    expect(ids(plan)).toEqual(['0,0', '0,1', '1,0']);
  });
  it('uses signed grid coordinates and stable ordering regardless of catalogue order', () => {
    const point = { x: -pitch / 2, z: -pitch / 2 };
    const plan = planNearPlaceholders(cells, pitch, point, null);
    expect(ids(plan)).toEqual(['-1,-1', '-1,0', '0,-1', '0,0']);
    expect(planNearPlaceholders([...cells].reverse(), pitch, point, null)).toEqual(plan);
  });
  it('holds a drawn cell against a slightly nearer newcomer, then lets it go', () => {
    const edge = [-1, 0, 1].flatMap(x => [-1, 0, 1].map(z => cell(x, z)));
    // over (1,0) a little north of centre: (1,1) is nearer than (1,-1); held (1,-1) survives a small lead only
    const held = new Set(['0,0', '1,1', '0,1', '1,-1']);
    const small = planNearPlaceholders(edge, pitch, { x: pitch, z: 5 }, '1,0', { held });
    expect(ids(small)).toContain('1,-1');
    const far = planNearPlaceholders(edge, pitch, { x: pitch, z: 200 }, '1,0', { held: new Set(['0,0', '1,1', '0,-1', '1,-1']) });
    expect(ids(far)).toEqual(['0,0', '0,1', '1,-1', '1,1']);
  });
  it('keeps finite-grid empty neighbours empty and never mutates its inputs', () => {
    const sparse = [cell(0, 0), cell(1, 0)];
    const before = structuredClone(sparse), point = Object.freeze({ x: pitch / 2, z: pitch / 2 });
    expect(ids(planNearPlaceholders(sparse, pitch, point, null))).toEqual(['0,0', '1,0']);
    expect(sparse).toEqual(before);
    expect(planNearPlaceholders([], pitch, point, null).cells).toEqual([]);
  });
  it('refuses nonfinite positions and invalid grid spacing', () => {
    expect(() => planNearPlaceholders(cells, pitch, { x: Number.NaN, z: 0 }, null)).toThrow('coordinates');
    expect(() => planNearPlaceholders(cells, 500, { x: 0, z: 0 }, null)).toThrow('coordinates');
  });
  it('refuses duplicate instances, duplicate cells and mismatched render placement', () => {
    expect(() => planNearPlaceholders([cell(0, 0), cell(0, 0)], pitch, { x: 0, z: 0 }, null)).toThrow('cell');
    const duplicate = { ...cell(0, 0), instance: 'other' };
    expect(() => planNearPlaceholders([cell(0, 0), duplicate], pitch, { x: 0, z: 0 }, null)).toThrow('cell');
    const misplaced = { ...cell(0, 0), origin: { x: 1, y: 0, z: 0 } };
    expect(() => planNearPlaceholders([misplaced], pitch, { x: 0, z: 0 }, null)).toThrow('cell');
  });
});
