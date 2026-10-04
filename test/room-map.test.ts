// E321: a practice room's own map (src/engine/ui/roomMap.ts) — the view fits the room, and the painter draws every shape inside it.
import { describe, expect, it } from 'vitest';
import { arenaMap, fitRoom, paintRoom, type RoomMap } from '#engine-internal/ui/roomMap';

/** a 2D context that records where it drew (x, y device px) */
function recorder(): { ctx: CanvasRenderingContext2D; points: [number, number][]; calls: () => number } {
  const points: [number, number][] = [];
  let local = false;   // after save() + translate() the arrow draws in its own frame: not recorded
  const at = (x: number, y: number): void => { if (!local) points.push([x, y]); };
  let other = 0;       // the calls that draw nothing where they are (paths, state)
  const skip = (): void => { other++; };
  const stub = {
    lineCap: '', lineJoin: '', fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    fillRect: at, strokeRect: at, moveTo: at, lineTo: at, arc: at, fillText: (_t: string, x: number, y: number) => { at(x, y); }, strokeText: (_t: string, x: number, y: number) => { at(x, y); },
    beginPath: skip, closePath: skip, stroke: skip, fill: skip, save: () => { local = true; }, restore: () => { local = false; }, translate: skip, rotate: skip,
  };
  // the stub carries every member paintRoom touches; the cast is the test's seam onto the DOM type
  return { ctx: stub as Partial<CanvasRenderingContext2D> as CanvasRenderingContext2D, points, calls: () => other };
}

describe('room map (E321)', () => {
  it('the minimap view fits the room\'s diagonal in its circle', () => {
    const map: RoomMap = { bounds: { x0: -80, z0: -15, x1: 160, z1: 135 }, shapes: [] };
    const v = fitRoom(map, 300, 300, true);
    expect(Math.hypot(240, 150) * v.ppm).toBeLessThanOrEqual(300);
    expect(Math.hypot(240, 150) * v.ppm).toBeGreaterThan(270);
  });

  it('the arena map draws inside the circle', () => {
    const map = arenaMap({ x: 10, z: -20 });
    const { ctx, points, calls } = recorder();
    paintRoom(ctx, map, fitRoom(map, 300, 300, true), { x: 10, z: -20 }, 0, 1);
    expect(points.length).toBeGreaterThan(10);
    expect(calls()).toBeGreaterThan(0);
    for (const [x, y] of points) expect(Math.hypot(x - 150, y - 150)).toBeLessThanOrEqual(150);
  });

  it('north up, east right: a point north-east of the centre lands up and right', () => {
    const map: RoomMap = { bounds: { x0: -50, z0: -50, x1: 50, z1: 50 }, shapes: [{ kind: 'dot', x: -20, z: 20, r: 2, color: '#fff' }] };
    const { ctx, points } = recorder();
    paintRoom(ctx, map, fitRoom(map, 200, 200, true), { x: 0, z: 0 }, 0, 1);
    const [dx, dy] = points[0] ?? [0, 0];
    expect(dx).toBeGreaterThan(100);   // −X is east: screen right
    expect(dy).toBeLessThan(100);      // +Z is north: screen up
  });
});
