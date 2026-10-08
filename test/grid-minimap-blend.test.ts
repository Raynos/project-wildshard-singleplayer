import { describe, expect, it } from 'vitest';
import { GridAssembly } from '../src/game/grid/assembly';
import { GridCellEvents } from '../src/game/grid/boot';
import { fullMapOverlay, minimapOverlay, roadRects, ROAD_TERRAIN_ALPHA } from '../src/game/grid/minimapBlend';
import { crossingSaveStatus } from '../src/game/grid/borderShimmer';

const assembly = new GridAssembly({ developer: false, devserver: false });
const home = assembly.cells[0];
if (home === undefined) throw new Error('no home cell');
const image = {} as HTMLCanvasElement;
const host = (feet: { x: number; z: number }, cells: GridCellEvents) => ({ assembly, home, cells, worldFeet: () => feet,
  image: (id: string) => (id === home.instance ? null : image), name: (cell: { slug: string }) => cell.slug });

describe('G107 minimap blend', () => {
  const rects = roadRects(assembly, home);
  it('inside the home cell: its own layer, no neighbour terrain, a neighbour name once the road is near', () => {
    const cells = new GridCellEvents(); cells.enter({ instance: home.instance, slug: home.slug });
    const deep = minimapOverlay(host({ x: home.origin.x, z: home.origin.z }, cells), rects);
    expect(deep.baseAlpha).toBe(1); expect(deep.images).toHaveLength(0); expect(deep.labels).toHaveLength(0);
    const edge = minimapOverlay(host({ x: home.origin.x + 220, z: home.origin.z }, cells), rects);
    expect(edge.images).toHaveLength(0);
    const east = assembly.neighbour(home, 'east');
    expect(edge.labels.map((l) => l.text)).toEqual('instance' in east ? [east.slug] : []);
  });
  it('on the road: every neighbour faded, the home layer too', () => {
    const cells = new GridCellEvents();
    const road = minimapOverlay(host({ x: home.origin.x + 277.5, z: home.origin.z }, cells), rects);
    expect(road.baseAlpha).toBe(ROAD_TERRAIN_ALPHA);
    expect(road.images.length).toBe(assembly.cells.length - 1);
    expect(road.images.every((m) => m.alpha === ROAD_TERRAIN_ALPHA)).toBe(true);
    expect(road.labels).toHaveLength(0);
  });
  it('uses the shared authored raster for a home copy too, at full strength inside and faded on the road', () => {
    const cells = new GridCellEvents(); cells.enter({ instance: home.instance, slug: home.slug });
    const port = { ...host({ x: home.origin.x, z: home.origin.z }, cells), image: () => image };
    const inside = minimapOverlay(port, rects);
    expect(inside.baseAlpha).toBe(0); expect(inside.images).toEqual([{ image, x: 0, z: 0, size: 500, alpha: 1 }]);
    cells.leave();
    const road = minimapOverlay({ ...port, worldFeet: () => ({ x: home.origin.x + 277.5, z: home.origin.z }) }, rects);
    expect(road.baseAlpha).toBe(0); expect(road.images).toHaveLength(assembly.cells.length);
    expect(road.images.every((row) => row.alpha === ROAD_TERRAIN_ALPHA)).toBe(true);
  });
  it('SF66: the full map lays out every other cell\'s baked map at its cell, the road, and every shard\'s name', () => {
    const cells = new GridCellEvents();
    const map = fullMapOverlay(host({ x: home.origin.x, z: home.origin.z }, cells), rects);
    expect(map.baseAlpha).toBe(1); // the home's own baked map is the base layer
    expect(map.images).toHaveLength(assembly.cells.length - 1);
    expect(map.images.every((m) => m.alpha === 1 && m.size === 500)).toBe(true);
    const others = assembly.cells.filter((c) => c.instance !== home.instance);
    expect(map.images.map((m) => [m.x, m.z])).toEqual(others.map((c) => [c.origin.x - home.origin.x, c.origin.z - home.origin.z]));
    expect(map.labels.map((l) => l.text)).toEqual(assembly.cells.map((c) => c.slug));
    expect(map.rects).toBe(rects);
  });
});

describe('G119 crossing save status', () => {
  it('maps the crossing telemetry', () => {
    expect(crossingSaveStatus(null)).toBeNull();
    expect(crossingSaveStatus({ current: 'a', target: 'a', phase: 'settled', issue: null })).toBeNull();
    expect(crossingSaveStatus({ current: 'a', target: null, phase: 'ready', issue: null })).toBe('saving');
    expect(crossingSaveStatus({ current: 'a', target: null, phase: 'ready', issue: 'Local checkpoint is not durable' })).toBe('failed');
    expect(crossingSaveStatus({ current: 'a', target: 'b', phase: 'blocked', issue: 'b is not a shardfile shard' })).toBeNull();
  });
});
