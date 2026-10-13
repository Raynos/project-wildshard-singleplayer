import { expect, it } from 'vitest';
import { placeholderSource } from '@wildshard/format/placeholderSource';
import { PLACEHOLDER as PINE } from '../src/shards/pine-hollow/data/placeholder';
import { PLACEHOLDER as DRIFTWOOD } from '../src/shards/driftwood-isle/data/placeholder';

it('G348: admits the shards\' declared placeholder rows and refuses a malformed one', () => {
  expect(placeholderSource('any', undefined)).toEqual({});
  expect(placeholderSource('pine-hollow', PINE).trees?.map((row) => row.species)).toEqual(['fir', 'pine', 'giant', 'birch', 'sapling', 'snag']);
  expect(placeholderSource('driftwood-isle', DRIFTWOOD).ground).toEqual({ generator: 'generators/groundRows.ts', export: 'driftwoodGroundBytes' });
  expect(placeholderSource('driftwood-isle', DRIFTWOOD).far?.look).toEqual({ module: 'look/far.ts', export: 'farLook' });
  expect(() => placeholderSource('x', { ground: { generator: '../escape.ts', export: 'f' } })).toThrow(/x: invalid placeholder source/u);
  expect(() => placeholderSource('x', { far: { look: { module: '../../scripts/x.ts', export: 'farLook' } } })).toThrow(/invalid placeholder source/u);
  expect(() => placeholderSource('x', { trees: [{ species: 'fir', stem: null, rings: [], crown: [300, 0, 0] }] })).toThrow(/invalid placeholder source/u);
  expect(() => placeholderSource('x', { colour: 'red' })).toThrow(/invalid placeholder source/u);
  expect(placeholderSource('driftwood-isle', DRIFTWOOD).near?.floors).toEqual([{ prototype: 'driftwood-isle/palm', triangles: 120 }]);
  expect(() => placeholderSource('x', { near: { floors: [{ prototype: 'palm', triangles: 0 }] } })).toThrow(/invalid placeholder source/u);
  expect(() => placeholderSource('x', { near: { floors: [] } })).toThrow(/invalid placeholder source/u);
});

it('sp-o37: a declared near floor lifts only its prototype, on top of the content budget', async () => {
  const { nearPlaceholderParts } = await import('@wildshard/sdk/bake/nearPlaceholder');
  // two 200-triangle fans (a disc of thin wedges), one copy each at the cell centre
  const fan = (name: string) => {
    const positions = [0, 0, 0], index: number[] = [];
    for (let i = 0; i <= 200; i++) { const a = (i / 200) * Math.PI * 2, r = 1 + 0.3 * Math.sin(i * 2.7); positions.push(Math.cos(a) * r, Math.sin(i * 1.3) * 0.2, Math.sin(a) * r); }
    for (let i = 1; i <= 200; i++) index.push(0, i, i + 1 > 200 ? 1 : i + 1);
    return { name, positions: Float32Array.from(positions), colours: new Float32Array(positions.length).fill(0.5), index: Uint32Array.from(index), transforms: [[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]] };
  };
  const base = await nearPlaceholderParts([fan('a'), fan('b')], { triangles: 40, half: 250 });
  const floored = await nearPlaceholderParts([fan('a'), fan('b')], { triangles: 40, half: 250, floors: [{ prototype: 'a', triangles: 120 }] });
  const tris = (r: typeof base, name: string) => r.report.kept.find((k) => k.name === name)?.triangles ?? -1;
  expect(tris(base, 'a')).toBeLessThanOrEqual(23);
  expect(tris(floored, 'a')).toBeGreaterThanOrEqual(110);
  expect(tris(floored, 'b')).toBe(tris(base, 'b'));
});

it('G348: every declared row names modules inside its own shard folder', () => {
  const rows = import.meta.glob<{ PLACEHOLDER: unknown }>('../src/shards/*/data/placeholder.ts', { eager: true });
  const modules = new Set(Object.keys(import.meta.glob(['../src/shards/*/look/**/*.ts', '../src/shards/*/generators/**/*.ts'])));
  expect(Object.keys(rows).length).toBeGreaterThanOrEqual(9);
  for (const [path, row] of Object.entries(rows)) {
    const folder = path.slice(0, -'data/placeholder.ts'.length), source = placeholderSource(folder, row.PLACEHOLDER);
    for (const ref of [source.far?.look, source.far?.grid, source.far?.parts]) if (ref !== undefined) expect(modules.has(`${folder}${ref.module}`), `${folder}${ref.module}`).toBe(true);
  }
});
