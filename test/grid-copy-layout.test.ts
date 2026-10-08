import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { GridAssembly } from '../src/game/grid/assembly';
import { copyLayoutBoxes, copyLayoutMesh, withCopyLayout } from '../src/game/grid/copyLayout';
import { PropsSchema } from '../src/game/shardfile/props';

const copies = (mode: { developer: boolean; devserver: boolean }) => new GridAssembly(mode).cells.filter((cell) => cell.slug === '_template');
const MODES = [{ developer: false, devserver: false }, { developer: true, devserver: false }, { developer: true, devserver: true }];

describe('template copies differ in layout without a second product (G220 pass 2, SF52)', () => {
  it('gives every copy a layout whose plots carry different landmarks from every other copy', () => {
    for (const mode of MODES) {
      const cells = copies(mode);
      for (const cell of cells) expect(cell.identity?.layout).toBeDefined();
      // per plot, a signature of what stands on it (count and tallest top): no two copies share all of them
      const signatures = cells.map((cell) => {
        const layout = cell.identity?.layout; if (layout === undefined) throw new Error('layout');
        const boxes = copyLayoutBoxes(layout);
        return layout.plots.map((plot) => { const on = boxes.filter((b) => Math.abs(b.x - plot.x) <= plot.half && Math.abs(b.z - plot.z) <= plot.half); return `${on.length}/${Math.max(...on.map((b) => b.y + b.hy)).toFixed(1)}`; }).join(' ');
      });
      expect(new Set(signatures).size).toBe(cells.length);
      if (cells.length > 1) for (let p = 0; p < 4; p++) expect(new Set(signatures.map((s) => s.split(' ')[p])).size).toBeGreaterThan(1);
    }
  });

  it('keeps every landmark box on its plot, inside the cell and deterministic in the seed', () => {
    for (const cell of copies({ developer: false, devserver: false })) {
      const layout = cell.identity?.layout; if (layout === undefined) throw new Error('layout');
      const boxes = copyLayoutBoxes(layout);
      expect(copyLayoutBoxes(layout)).toEqual(boxes);
      for (const b of boxes) {
        expect(layout.plots.some((plot) => Math.abs(b.x - plot.x) + Math.hypot(b.hx, b.hz) <= plot.half + 12 && Math.abs(b.z - plot.z) + Math.hypot(b.hx, b.hz) <= plot.half + 12)).toBe(true);
        expect(Math.abs(b.x) + Math.hypot(b.hx, b.hz)).toBeLessThan(240);
        expect(Math.abs(b.z) + Math.hypot(b.hx, b.hz)).toBeLessThan(240);
        expect(b.y - b.hy).toBeGreaterThan(-0.5);
      }
    }
  });

  it('draws the landmarks as one merged mesh of a few tens of KB and collides with exactly the same boxes', () => {
    const props = { version: 1, family: 'pbr', tiles: [], panels: [], models: [], far: null, colliders: [], textures: [] } as const;
    const source = { props: v.parse(PropsSchema, props) };
    for (const cell of copies({ developer: false, devserver: false })) {
      const layout = cell.identity?.layout; if (layout === undefined) throw new Error('layout');
      const drawn = copyLayoutMesh(cell.identity);
      expect(drawn).not.toBeNull(); if (drawn === null) continue;
      const boxes = copyLayoutBoxes(layout);
      const g = drawn.mesh.geometry;
      expect(g.getAttribute('position').count).toBe(boxes.length * 24);
      const bytes = ['position', 'normal', 'color'].reduce((n, name) => n + g.getAttribute(name).array.byteLength, g.getIndex()?.array.byteLength ?? 0);
      expect(bytes).toBeLessThan(32 * 1024);
      drawn.dispose();
      const region = withCopyLayout(source, cell.identity);
      const row = region.props.colliders.at(-1);
      expect(row?.id).toBe('copy.layout');
      expect(row?.shapes).toHaveLength(boxes.length);
      // the added row is valid declared props (inside the cell, unit rotations)
      expect(() => v.parse(PropsSchema, region.props)).not.toThrow();
    }
    expect(copyLayoutMesh(undefined)).toBeNull();
    expect(withCopyLayout(source, undefined)).toBe(source);
  });
});
