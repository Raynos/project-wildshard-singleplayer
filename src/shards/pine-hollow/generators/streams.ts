/**
 * Pine Hollow's running water shaped (PINE-HOLLOW-REMASTER PH-L9; G285: an offline bake). Build-time only:
 * `scripts/bake-pine-streams.mjs` runs `bakePineStreams` with the Pine level selected and its baked terrain installed (the
 * page's heights and normals) and writes the one water mesh — the creek ribbon from the beaver dam to the slab's south
 * edge, the waterfall's sheet down the Ridge's face, the plunge ring on the pond — to
 * `public/assets/pine-hollow/baked/streams.bin` (zlib) + `../data/streams.json` (with the fall's plunge and face-foot
 * anchors); the page draws it (../world/streams.ts) and never runs this. test/shards/pine-hollow/streams-bake.test.ts is
 * the stale gate.
 */
import { CREEK, WATERFALL, RIDGE_STREAM, CREEK_WATER, creekSpan, creekSurfaceAt, creekFlowAt, creekFoamAt, type XZ } from '../layout';
import { smoothstep } from '@wildshard/engine/core/noise';
import { normalAt, waterLevel } from '@wildshard/engine/world/Heightfield';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';

/** where the fall's sheet meets the pond, and the foot of its steep face (the spray's anchors, the sound's) */
interface Anchors { plunge: [number, number, number]; faceFoot: [number, number, number] }

/** the creek ribbon's across-stream offsets (m): dense where the water meets the banks */
const CREEK_ACROSS = [-6, -4.6, -3.8, -3.2, -2.6, -1.5, 0, 1.5, 2.6, 3.2, 3.8, 4.6, 6];

/** an accumulating mesh: positions, uv, aWater and an index */
class Builder {
  pos: number[] = []; uv: number[] = []; aw: number[] = []; idx: number[] = [];
  get count(): number { return this.pos.length / 3; }
  vert(x: number, y: number, z: number, u: number, v: number, depth: number, flow: number, foam: number, kAbs: number): void {
    this.pos.push(x, y, z); this.uv.push(u, v); this.aw.push(depth, flow, foam, kAbs);
  }
  /** a grid of `rows` × `cols` vertices starting at `base`, rows along the flow, columns to its left (wound to face up) */
  grid(base: number, rows: number, cols: number): void {
    for (let r = 0; r + 1 < rows; r++) for (let c = 0; c + 1 < cols; c++) {
      const a = base + r * cols + c, b = a + 1, d = a + cols, e = d + 1;
      this.idx.push(a, b, d, b, e, d);
    }
  }
}

/** a polyline sampled by arc length: point and (smoothed) unit tangent */
class Path {
  private cum: number[] = [0];
  readonly length: number;
  constructor(private pts: readonly XZ[]) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      this.cum.push((this.cum[i - 1] ?? 0) + (a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0));
    }
    this.length = this.cum[this.cum.length - 1] ?? 0;
  }
  at(s: number): [number, number] {
    const t = Math.min(this.length, Math.max(0, s));
    let i = 0;
    while (i < this.pts.length - 2 && t > (this.cum[i + 1] ?? 0)) i++;
    const a = this.pts[i], b = this.pts[i + 1], l = (this.cum[i + 1] ?? 0) - (this.cum[i] ?? 0);
    if (!a || !b) return [0, 0];
    const u = l > 0 ? (t - (this.cum[i] ?? 0)) / l : 0;
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  }
  /** the direction over ±`span` m (so the ribbon bends smoothly round the polyline's corners) */
  tangent(s: number, span: number): [number, number] {
    const p = this.at(s - span), q = this.at(s + span), dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1;
    return [dx / l, dz / l];
  }
}

/** the creek: from just before the dam's crest (the outlet above it is the pond's own water) to the slab's edge */
function buildCreek(b: Builder): void {
  const path = new Path(CREEK), { dam, end } = creekSpan();
  const stations: number[] = [];
  for (let s = dam - CREEK_WATER.lead; s < end - 0.2;) { stations.push(s); s += s > dam - 2.5 && s < dam + 8 ? 0.5 : 1.5; }
  stations.push(end - 0.2);
  let travel = 0, prev = stations[0] ?? 0;
  const base = b.count;
  for (const s of stations) {
    travel += (s - prev) / Math.max(0.1, (creekFlowAt(s) + creekFlowAt(prev)) / 2);
    prev = s;
    const [cx, cz] = path.at(s), [tx, tz] = path.tangent(s, 7), lx = -tz, lz = tx;
    const surf = creekSurfaceAt(s), foam = creekFoamAt(s);
    for (const o of CREEK_ACROSS) {
      const x = cx + lx * o, z = cz + lz * o, h = heightAt(x, z), d = surf - h;
      // just above the water the ribbon drapes onto the bank: the wet film
      const y = d < 0 && d > -0.45 ? h + 0.04 : surf;
      b.vert(x, y, z, o, travel, d, 1, foam, 2.0); // tea-brown running water (the forest's tannins): 2 / m, the bed shows through
    }
  }
  b.grid(base, stations.length, CREEK_ACROSS.length);
}

/** the waterfall: the ridge-top stream's last metres, down the Ridge's face, the short run below it, into the pond */
function buildFall(b: Builder, out: Anchors): void {
  const wl = waterLevel();
  const entry = pondEntry();
  // start 9 m above the lip on the ridge-top stream (further up its bed is too rough to hold water: it climbs again)
  const r2 = RIDGE_STREAM[2] ?? [WATERFALL.lip.x, WATERFALL.lip.z + 16], lip = WATERFALL.lip;
  const start: XZ = [r2[0] + (lip.x - r2[0]) * 0.44, r2[1] + (lip.z - r2[1]) * 0.44];
  const path = new Path([start, [lip.x, lip.z], [WATERFALL.foot.x, WATERFALL.foot.z], entry]);
  const COLS = 9, step = 0.7;
  const lipS = Math.hypot(lip.x - start[0], lip.z - start[1]);
  let yRun = Infinity, travel = 0, top = 0, rows = 0, faceFootFound = false;
  const base = b.count;
  for (let s = 0; s <= path.length + 1e-6; s += step) {
    const [cx, cz] = path.at(s), [tx, tz] = path.tangent(s, 2), lx = -tz, lz = tx;
    const hC = heightAt(cx, cz), nC = normalAt(cx, cz);
    // the surface never climbs downstream (the ridge top is rough): the running minimum of the ground + a skin
    yRun = Math.min(yRun, hC + 0.22);
    if (s === 0) top = yRun;
    const steep = 1 - nC[1];                                        // 0 flat … ~0.4 on the 53° face
    if (!faceFootFound && s > lipS + 8 && steep < 0.12) { faceFootFound = true; out.faceFoot = [cx, hC + 0.6, cz]; }
    const drop = Math.max(0, top - yRun);
    const speed = Math.min(8, Math.max(1.2, Math.sqrt(2 * 9.8 * drop) * (steep > 0.15 ? 1 : 0.55)));
    travel += step / speed;
    const halfW = 1.1 + 0.9 * smoothstep(0, lipS, s) + 1.3 * smoothstep(lipS, lipS + 30, s) + 0.5 * smoothstep(path.length - 10, path.length, s);
    const foam = s < lipS - 2 ? 0.5 : steep > 0.15 ? 0.84 : 0.7;
    for (let c = 0; c < COLS; c++) {
      const o = (c / (COLS - 1) * 2 - 1) * halfW, e = o / halfW;
      const x = cx + lx * o, z = cz + lz * o, n = normalAt(x, z);
      // off the rock by a skin, standing further off (and bulged at the middle) where the face is steep: a curved curtain
      const off = 0.14 + 0.55 * steep * (1 - e * e);
      let y = Math.max(heightAt(x, z) + off * n[1], yRun - 0.05 + (off - 0.14));
      y = Math.max(y, wl + 0.02);
      b.vert(x + n[0] * off, y, z + n[2] * off, o, travel, 0.5 * (1 - e ** 4), 1, foam, 4);
    }
    rows++;
  }
  b.grid(base, rows, COLS);
  if (!faceFootFound) out.faceFoot = [WATERFALL.foot.x, heightAt(WATERFALL.foot.x, WATERFALL.foot.z) + 0.6, WATERFALL.foot.z];
  out.plunge = [entry[0], wl, entry[1]];
}

/** where the line from the fall's foot toward the pond's centre first meets the water */
function pondEntry(): XZ {
  const wl = waterLevel(), f = WATERFALL.foot;
  const dx = -100 - f.x, dz = 110 - f.z, l = Math.hypot(dx, dz);
  for (let t = 0; t < l; t += 0.25) {
    const x = f.x + (dx / l) * t, z = f.z + (dz / l) * t;
    if (heightAt(x, z) < wl) return [x, z];
  }
  return [f.x, f.z - 6];
}

/** the plunge ring: foam spreading outward on the pond's surface from where the fall lands (an overlay: no reflection) */
function buildRing(b: Builder, out: Anchors): void {
  const wl = waterLevel(), R = 6.5, RINGS = 8, SEGS = 28, cx = out.plunge[0], cz = out.plunge[2];
  const base = b.count;
  for (let r = 0; r < RINGS; r++) {
    const rr = (r / (RINGS - 1)) * R, fade = (1 - rr / R) ** 0.8;
    for (let k = 0; k <= SEGS; k++) {
      const a = (k / SEGS) * Math.PI * 2;
      // uv: 20 m round (4 texture periods: seamless), radial travel at 0.6 m/s — the foam rides outward
      b.vert(cx + Math.cos(a) * rr, wl + 0.02, cz + Math.sin(a) * rr, (k / SEGS) * 20, rr / 0.6, fade, 1, 0.35 + 0.6 * fade, -1);
    }
  }
  b.grid(base, RINGS, SEGS + 1);
}

/** the bake: the water mesh's blocks (position f32 ×3, uv f32 ×2, aWater f32 ×4, the index, each padded to 4 bytes) and its rows */
export function bakePineStreams(): { bin: Uint8Array; rows: { vertices: number; indices: number; wide: boolean; plunge: [number, number, number]; faceFoot: [number, number, number] } } {
  const b = new Builder(), anchors: Anchors = { plunge: [0, 0, 0], faceFoot: [0, 0, 0] };
  buildCreek(b);
  buildFall(b, anchors);
  buildRing(b, anchors);
  // the page's index is three's pick for a number[] index: 32-bit once any index reaches 65 535
  const wide = b.idx.some((i) => i >= 65535);
  const blocks = [Float32Array.from(b.pos), Float32Array.from(b.uv), Float32Array.from(b.aw), wide ? Uint32Array.from(b.idx) : Uint16Array.from(b.idx)];
  const size = blocks.reduce((n, a) => n + Math.ceil(a.byteLength / 4) * 4, 0), bin = new Uint8Array(size);
  let at = 0;
  for (const a of blocks) { bin.set(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), at); at += Math.ceil(a.byteLength / 4) * 4; }
  // the anchors stay doubles: the page's spray matrices are built from them before they become floats
  return { bin, rows: { vertices: b.count, indices: b.idx.length, wide, plunge: anchors.plunge, faceFoot: anchors.faceFoot } };
}
