import * as v from 'valibot';
import { LayoutProjectionSchema, type LayoutRows, type LayoutProjection } from './sections';
import fixed from '../data/fixedKits.generated.json' with { type: 'json' };
import lantern from '../data/lantern.json' with { type: 'json' };

/** One layout geometry's bounds as the layout bake measured them (bake-nine-layout.mjs): [x, y, z, radius], [min, max] */
export interface LayoutBounds { readonly sphere: readonly number[]; readonly box: readonly number[] }

/** Decode the predecessor's mixed stream once at build time, retaining every double and signed zero. */
export function layoutProjection(rows: LayoutRows, records: readonly number[], bounds: readonly LayoutBounds[]): LayoutProjection {
  if (rows.kitxs.length > 0) throw new Error('Nine layout requires offline merged kits');
  const c = rows.counts;
  let at = (c.walkers + c.sitters) * 16;
  const words = (count: number): number[] => {
    const values = records.slice(at, at + count); at += count;
    if (values.length !== count) throw new Error('Nine layout ran out of records');
    return values;
  };
  const point = (): [number, number, number] => v.parse(v.tuple([v.number(), v.number(), v.number()]), words(3));
  const lanterns = Array.from({ length: c.lanterns }, () => words(16));
  const acs = Array.from({ length: c.acs }, () => words(16));
  const hooks = Array.from({ length: c.hooks }, point);
  const hookMounts = Array.from({ length: c.hookMounts }, () => ({ ring: point(), out: point() }));
  at += c.steam * 3 + c.pieces * 19 + c.windows * 26;
  const inst = rows.inst.map(([name, count]) => [name, Array.from({ length: count }, () => ({ matrix: words(16), color: point() }))]);
  at += (c.lions + rows.sets.reduce((sum, row) => sum + row.count, 0)) * 16;
  if (at !== records.length) throw new Error('Nine layout has records left over');
  const used = new Set([...rows.kits.flatMap(row => row.geo === null ? [] : [row.geo]), ...rows.alphaKits.map(row => row.geo), ...(rows.shell === null ? [] : [rows.shell])]);
  for (const row of rows.inKit) if (!rows.kits.some(kit => kit.name === row.kit)) throw new Error(`Nine model ${row.model} has no kit ${row.kit}`);
  return v.parse(LayoutProjectionSchema, { geometries: [...used].map(id => {
    const row = rows.geometries[id]; if (row === undefined) throw new Error(`Missing Nine geometry ${id}`);
    // O19: the layout bake's bounds, so entry assigns them instead of scanning vertices
    const baked = bounds[id]; if (baked === undefined || bounds.length !== rows.geometries.length) throw new Error(`Missing Nine layout bounds ${id}`);
    const geometry: { id: number; box: boolean; sphere: readonly number[]; bounds?: readonly number[] } = { id, box: row.box, sphere: baked.sphere };
    if (row.box) geometry.bounds = baked.box;
    return geometry;
  }), kits: rows.kits.map(row => [row.name, row.geo]), alphaKits: rows.alphaKits.map(row => [row.name, row.geo]),
  farOf: rows.farOf, inKit: rows.inKit, shell: rows.shell, lanterns, acs, hooks, hookMounts, inst,
  fixed: { lanterns: fixed.lanterns.map(row => row.map(Number)), drop: lantern.drop } });
}

/** JSON admission normalizes zero; restore explicitly declared negative-zero words for author proofs. */
export function restoreLayoutZeros({ rows: source, negativeZeros }: { rows: LayoutRows; negativeZeros: readonly (readonly string[])[] }): LayoutRows {
  const rows = structuredClone(source);
  for (const path of negativeZeros) {
    let parent: unknown = rows;
    for (const key of path.slice(0, -1)) {
      if (parent === null || typeof parent !== 'object') throw new Error('Invalid Nine signed-zero path');
      parent = Reflect.get(parent, key);
    }
    const key = path.at(-1);
    if (parent === null || typeof parent !== 'object' || key === undefined || Reflect.get(parent, key) !== 0) throw new Error('Invalid Nine signed-zero word');
    Reflect.set(parent, key, -0);
  }
  return rows;
}
