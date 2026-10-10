import * as v from 'valibot';
import { Rng } from '@wildshard/engine/core/rng';
import { BodyBandClocks, DEFAULT_TICK_RATES, bandAt, tickDistance } from '@wildshard/engine/sim/bands';

const MAX = 256;
const finite = v.pipe(v.number(), v.finite()), positive = v.pipe(finite, v.minValue(0));
const integer = v.pipe(positive, v.integer()), frame = v.pipe(finite, v.integer(), v.minValue(-1));
const uint = v.pipe(integer, v.maxValue(0xffffffff));
const clock = v.strictObject({ elapsed: positive, credit: positive, frame, dt: positive, last: finite, due: v.boolean(), tickFrame: frame });
const row = v.strictObject({ x: finite, z: finite, bx: finite, bz: finite, yaw: finite, stand: finite, sink: finite,
  state: v.picklist([0, 1, 2, 3]), t: finite, tx: finite, tz: finite });
export const MarmotContinuation = v.strictObject({
  rows: v.pipe(v.array(row), v.maxLength(MAX)), acc: positive,
  rng: v.strictObject({ version: v.literal(1), state: uint, initial: uint, scrambledFork: v.boolean() }),
  bands: v.strictObject({ rates: uint, time: positive, frame: integer, frameDt: positive,
    rows: v.pipe(v.array(v.strictObject({ id: v.string(), rate: v.literal('fx'), brain: clock, body: clock })), v.maxLength(MAX)) }),
});
export type MarmotState = v.InferOutput<typeof row>;
export type MarmotSnapshot = v.InferOutput<typeof MarmotContinuation>;
export interface MarmotGround { heightAt: (x: number, z: number) => number; normalY: (x: number, z: number) => number }
interface Point { readonly x: number; readonly y: number; readonly z: number }
const FX = DEFAULT_TICK_RATES.find(([id]) => id === 'fx')?.[1];
if (FX === undefined) throw new Error('Missing canonical marmot FX rate');

/** Shipping sentry/forage/burrow keeper, including the private RNG and canonical discarded paused-time clock. */
export class MarmotBrain {
  readonly rows: MarmotState[] = [];
  readonly poseDue = new Uint8Array(MAX);
  private readonly active = new Uint8Array(MAX);
  private readonly bands = new BodyBandClocks();
  private readonly point = { x: 0, y: 0, z: 0 };
  private readonly rng: Rng;
  private readonly ground: MarmotGround;
  private readonly ids = Array.from({ length: MAX }, (_, index) => `marmot:${String(index)}`);
  private acc = 0;
  constructor(seed: number, ground: MarmotGround) { this.ground = ground; this.rng = new Rng(seed ^ 0x6a2b); }

  build(sites: readonly { x: number; z: number }[], perSite = 5): void {
    if (sites.length > 64 || !Number.isInteger(perSite) || perSite < 3 || this.rows.length + sites.length * perSite > MAX) throw new RangeError('Marmot colony bound exceeded');
    for (let site = 0; site < 64; site++) {
      const s = sites[site]; if (s === undefined) break;
      if (!inChunk(s.x, s.z, 10)) continue;
      const n = this.rng.int(3, perSite);
      for (let i = 0; i < MAX && i < n; i++) {
        const a = this.rng.range(0, Math.PI * 2), radius = this.rng.range(0.5, 5);
        const x = s.x + Math.cos(a) * radius, z = s.z + Math.sin(a) * radius;
        this.rows.push({ x, z, bx: s.x + Math.cos(a) * 0.4, bz: s.z + Math.sin(a) * 0.4,
          yaw: this.rng.range(0, Math.PI * 2), stand: 0, sink: 0, state: 0, t: this.rng.range(1, 6), tx: x, tz: z });
      }
    }
  }
  /** Same native-ground scatter as the page; no model or renderer is loaded. */
  static scatter(seed: number, n: number, box: { x0: number; x1: number; z0: number; z1: number }, ground: MarmotGround): { x: number; z: number }[] {
    if (!Number.isInteger(n) || n < 0 || n > 64) throw new RangeError('Marmot site bound exceeded');
    const rng = new Rng(seed ^ 0x1717), out: { x: number; z: number }[] = [];
    for (let i = 0; i < 1280 && i < n * 20 && out.length < n; i++) {
      const x = rng.range(box.x0, box.x1), z = rng.range(box.z0, box.z1);
      if (!inChunk(x, z, 20) || ground.normalY(x, z) < 0.93 || out.some(o => Math.hypot(o.x - x, o.z - z) < 25)) continue;
      out.push({ x, z });
    }
    return out;
  }

  update(dt: number, player: Point, playerSpeed: number, crouched: boolean, whistle?: (x: number, z: number) => void): void {
    this.bands.beginTick(dt); this.acc += dt;
    const think = this.acc >= 0.1; if (think) this.acc = 0;
    let whistled = false;
    this.active.fill(0);
    for (let i = 0; i < MAX; i++) {
      const m = this.rows[i], id = this.ids[i]; if (m === undefined || id === undefined) break;
      this.point.x = m.x; this.point.y = this.ground.heightAt(m.x, m.z); this.point.z = m.z;
      const distance = tickDistance(this.point, player);
      this.poseDue[i] = this.bands.takeBrainDt(id, 'fx', distance, false) > 0 ? 1 : 0;
      if (FX === undefined || bandAt(FX, distance)?.brainHz === 'paused') continue;
      this.active[i] = 1;
      const d = Math.hypot(player.x - m.x, player.z - m.z);
      if (think) {
        m.t -= 0.1;
        const seeR = crouched ? 22 : playerSpeed > 5 ? 45 : 35;
        if ((m.state === 0 || m.state === 1) && d < seeR && (m.state === 1 || d < seeR * 0.6)) {
          if (!whistled && m.state === 1) { whistled = true; whistle?.(m.x, m.z); }
          m.state = 2; m.t = 3;
        } else if (m.state === 0 && m.t <= 0) {
          if (this.rng.next() < 0.3) { m.state = 1; m.t = this.rng.range(4, 9); }
          else { const a = this.rng.range(0, Math.PI * 2), r = this.rng.range(0.5, 3); m.tx = m.bx + Math.cos(a) * r; m.tz = m.bz + Math.sin(a) * r; m.t = this.rng.range(2, 6); }
        } else if (m.state === 1 && m.t <= 0) { m.state = 0; m.t = this.rng.range(2, 5); }
        else if (m.state === 2 && Math.hypot(m.x - m.bx, m.z - m.bz) < 0.3) { m.state = 3; m.t = this.rng.range(10, 18); }
        else if (m.state === 3 && m.t <= 0 && d > 25) { m.state = 1; m.t = this.rng.range(4, 8); }
      }
      const run = m.state === 2, tx = run || m.state === 3 ? m.bx : m.tx, tz = run || m.state === 3 ? m.bz : m.tz;
      const dx = tx - m.x, dz = tz - m.z, dd = Math.hypot(dx, dz);
      if (dd > 0.05 && m.state !== 1) {
        const speed = Math.min(dd, (run ? 3.5 : 0.35) * dt);
        m.x += (dx / dd) * speed; m.z += (dz / dd) * speed; m.yaw = Math.atan2(dx, dz);
      }
      m.stand += ((m.state === 1 ? 1 : 0) - m.stand) * Math.min(1, dt * 6);
      m.sink += ((m.state === 3 ? 1 : 0) - m.sink) * Math.min(1, dt * 5);
    }
    if (whistled) for (let i = 0; i < MAX; i++) {
      const m = this.rows[i]; if (m === undefined) break;
      if (this.active[i] === 1 && (m.state === 0 || m.state === 1)) { m.state = 2; m.t = 3; }
    }
  }
  snapshot(): MarmotSnapshot { return v.parse(MarmotContinuation, { rows: this.rows, acc: this.acc, rng: this.rng.snapshot(), bands: this.bands.snapshot() }); }
  restore(input: unknown): void {
    const saved = v.parse(MarmotContinuation, input);
    if (saved.rng.initial !== this.rng.snapshot().initial) throw new RangeError('Marmot seed mismatch');
    if (this.rows.length > 0 && saved.rows.length !== this.rows.length) throw new RangeError('Marmot colony identity mismatch');
    if (saved.bands.frame > 0 && saved.bands.rows.length !== saved.rows.length) throw new RangeError('Missing marmot clocks');
    const ids = new Set(this.ids.slice(0, saved.rows.length));
    this.bands.restore(saved.bands, ids); this.rng.restore(saved.rng); this.acc = saved.acc;
    this.rows.length = 0; this.rows.push(...saved.rows); this.poseDue.fill(0); this.active.fill(0);
  }
}
function inChunk(x: number, z: number, margin: number): boolean { return Math.abs(x) <= 250 - margin && Math.abs(z) <= 250 - margin; }
