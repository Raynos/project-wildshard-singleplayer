// E106: Nalati's spruce stipple is placed once per forest mask and a map tile draws only the crowns on it, with the same
// dots the old per-tile walk of the whole chunk drew.
import { describe, expect, it } from 'vitest';
import { Rng, SEED, type MapOverlay } from '#engine';
import { NALATI_MINIMAP } from '#shards/nalati-grasslands/look/minimap';

type Arc = [number, number, number, string];
/** a 2D context that only records the filled discs */
function recorder(width: number, height: number): { ctx: CanvasRenderingContext2D; arcs: Arc[] } {
  const arcs: Arc[] = [];
  let fill = '', last: [number, number, number] = [0, 0, 0];
  const ctx = {
    canvas: { width, height } as Partial<HTMLCanvasElement> as HTMLCanvasElement,
    set fillStyle(v: string) { fill = v; },
    get fillStyle(): string { return fill; },
    lineCap: 'butt', lineJoin: 'miter', lineWidth: 1, strokeStyle: '',
    beginPath: () => undefined, moveTo: () => undefined, lineTo: () => undefined, stroke: () => undefined,
    arc: (u: number, v: number, r: number) => { last = [u, v, r]; },
    fill: () => { arcs.push([...last, fill]); },
  };
  // the stub carries every member overlay() touches; the cast is the test's seam onto the DOM type (as in room-map.test.ts)
  return { ctx: ctx as Partial<CanvasRenderingContext2D> as CanvasRenderingContext2D, arcs };
}

const mask = (x: number, z: number): number => (Math.sin(x * 0.03) + Math.cos(z * 0.025) > 0.4 ? 1 : 0.2);
const HALF = 250;

/** the pre-E106 overlay's stipple, verbatim: the whole chunk in one rng stream */
function reference(ppm: number, toU: (x: number) => number, toV: (z: number) => number): Arc[] {
  const out: Arc[] = [], rng = new Rng(SEED + 4242);
  for (let x = -HALF + 3; x < HALF - 3; x += 4.2) for (let z = -HALF + 3; z < HALF - 3; z += 4.2) {
    const cx = x + rng.range(-1.6, 1.6), cz = z + rng.range(-1.6, 1.6);
    if (rng.next() > mask(cx, cz) * 0.85) continue;
    const r = (1.6 + rng.range(0, 1.1)) * ppm;
    out.push([toU(cx) + 0.8 * ppm, toV(cz) + 0.8 * ppm, r, 'rgba(14, 26, 18, 0.45)']);
    out.push([toU(cx), toV(cz), r, rng.next() < 0.5 ? '#2c4a30' : '#38583a']);
  }
  return out;
}

function draw(width: number, u0: number, v0: number, ppm: number): Arc[] {
  const { ctx, arcs } = recorder(width, width);
  const o: MapOverlay = { ctx, toU: (x) => (x - u0) * ppm, toV: (z) => (z - v0) * ppm, ppm, trails: [], half: HALF, forestMask: mask };
  NALATI_MINIMAP.overlay?.(o);
  return arcs;
}

describe('Nalati map stipple (E106)', () => {
  it('draws the same dots as the whole-chunk walk', () => {
    const ppm = 2, u0 = -HALF, v0 = -HALF;
    const near = (a: Arc, b: Arc): boolean => a[3] === b[3] && Math.abs(a[0] - b[0]) < 1e-3 && Math.abs(a[1] - b[1]) < 1e-3 && Math.abs(a[2] - b[2]) < 1e-3;
    const got = draw(HALF * 2 * ppm, u0, v0, ppm), want = reference(ppm, (x) => (x - u0) * ppm, (z) => (z - v0) * ppm);
    expect(got.length).toBe(want.length);
    expect(got.every((a, i) => { const b = want[i]; return b !== undefined && near(a, b); })).toBe(true);
  });

  it('a zoomed-in tile draws only the crowns on it', () => {
    const ppm = 6, size = 256, u0 = 20, v0 = -40;
    const arcs = draw(size, u0, v0, ppm);
    const all = reference(ppm, (x) => (x - u0) * ppm, (z) => (z - v0) * ppm);
    expect(arcs.length).toBeGreaterThan(0);
    expect(arcs.length).toBeLessThan(all.length / 20);
    for (const [u, v, r] of arcs) expect(u + r > -2 * ppm && v + r > -2 * ppm && u - r < size + ppm && v - r < size + ppm).toBe(true);
  });
});
