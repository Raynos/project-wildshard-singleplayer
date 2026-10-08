/**
 * Sky Reach's far proxy (SHARD-PLATFORM SF23 / SF49), read only by the far baker (scripts/bake/far-proxies.mjs). Sky Reach
 * has no ground: its land is models floating over the painted cloud sea. So its proxy is model-based: a flat grid under
 * the cloud sheet (`farGrid`, one quad per region: the sheet at −8, `PAINTED_SEA.y`, hides the void beneath), and its
 * islands as parts (`farParts`): the six textured island models decimated by the baker and hung exactly where the shard
 * hangs them (world/skyIsleHd.ts's unit frame and pose: the decorative sky isles inside the cell and the playable
 * islands' keels under their 12-gon grass decks), recoloured as the shard's rock patch does (turf kept green, the rock a
 * warm stone), plus the decks, their pines and the windmill as a few facets. One draw, toon facets, in Sky Reach's haze.
 * The Rising Islet entries (SF49-g, G183; the only way in since G194) are in it too (`entryParts`): each gate isle and its
 * islet resting at the road, from the shard's own island builder, decimated, the four chains from the islet up to its gate
 * isle's posts, the stone lip and the gate isle's pine, all in their rest pose (world/islets.ts is the one source). The
 * standalone sky docks (G200) never draw in the grid, so they stay out.
 */
import { BufferAttribute, BufferGeometry, Color, Vector3 } from 'three';
import { skyHdUrl } from '../boot/files';
import { ISLE_CUT, ISLE_KEEL_CUT, keelIsles, SKY_ISLE_MODELS, skyIslePose, skyIsleUnit, skyIsleWear, type SkyIsleModel, type SkyIsleUnit } from '../world/skyIsleHd';
import { skyIslesIn, type SkyIsle } from '../world/skyIsles';
import { ISLES, MILL, PINES, WINDMILL, apothem, type Isle } from '../layout';
import { islandMesh } from '../world/isle';
import { ISLET, RISING_ISLETS, type RisingIslet } from '../world/islets';
import { PALETTE } from '../world/shapes';

type Rgb = [number, number, number];
const smooth = (a: number, b: number, t: number): number => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
const HALF = 250;
/** The cloud sheet's height (`PAINTED_SEA.y`) and the flat ground left under it. */
const SEA = -8, FLOOR = -40;
export const farLook = {
  family: 'toon',
  quads: 1,
  colourAt: (x: number, z: number, h: number, slope: number): [number, number, number] => {
    const rock = Math.max(smooth(0.3, 0.45, slope), smooth(-2, -12, h)), k = 0.94 + 0.06 * Math.sin(x * 0.09 + z * 0.07);
    return [(0.3 + (0.42 - 0.3) * rock) * k, (0.55 + (0.4 - 0.55) * rock) * k, (0.18 + (0.42 - 0.18) * rock) * k];
  },
  water: { level: SEA, colour: [0.86, 0.88, 0.93] },
  haze: { colour: [0.7, 0.8, 0.95], near: 500, far: 2800, max: 0.5 },
} as const;

/** The flat grid under the cloud sheet (Sky Reach bakes no terrain). */
export function farGrid(): { res: number; size: number; heights: Float32Array; splat: null } {
  return { res: 2, size: HALF * 2, heights: new Float32Array(4).fill(FLOOR), splat: null };
}

/**
 * The proxy's share per island model (triangles after decimation; 26 instances inside the cell under the 8000 cap) and
 * the paint's lift standing in for the shard's self-light on the models (`SKY_ISLE_HD.selfLight`).
 */
export const FAR_ISLES = { triangles: 250, lift: 1.3 } as const;
/** The Rising Islet entries' share (SF49): triangles per decimated gate isle and islet, and a chain strand's width (m: a
 *  real link is 0.15 m, under a pixel from the road, so the far strand is drawn fatter). */
export const FAR_ENTRIES = { gate: 110, islet: 60, chain: 0.45 } as const;

interface FarPart { positions: Float32Array; colours: Float32Array; index: Uint32Array }
interface FarModelTools {
  readonly model: (path: string) => Promise<{ readonly positions: Float32Array; readonly colours: Float32Array; readonly index: Uint32Array }>;
  readonly decimate: (positions: Float32Array, index: Uint32Array, triangles: number) => Uint32Array;
}
/** A decimated island model in its unit frame, its paint per vertex (linear). */
interface FarIsle { readonly unit: SkyIsleUnit; readonly positions: Float32Array; readonly colours: Float32Array; readonly index: Uint32Array }

/** The shard's rock patch on the models' paint (world/skyIsleHd.ts `far.sky-isle-rock`), turf off on a playable keel. */
function recolour(c: Rgb, keel: boolean): Rgb {
  const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11, turf = keel ? 0 : smooth(0.02, 0.12, c[1] - Math.max(c[0], c[2]) * 0.92), s = 0.75 + 0.35 * smooth(0.15, 0.6, l);
  const stone: Rgb = [l * 1.02 * s, l * 0.96 * s, l * 0.88 * s], leafTint: Rgb = [1.02, 1.12, 0.78];
  const channel = (i: 0 | 1 | 2): number => {
    const leaf = Math.min(1, Math.max(0, (l + (c[i] - l) * 1.35) * leafTint[i] * 1.15));
    return (stone[i] + (leaf - stone[i]) * turf) * FAR_ISLES.lift;
  };
  return [channel(0), channel(1), channel(2)];
}

/** Collect facets into one part. */
function facets(): { tri: (a: Vector3, b: Vector3, c: Vector3, rgb: Rgb) => void; part: () => FarPart } {
  const pos: number[] = [], col: number[] = [];
  return {
    tri: (a, b, c, rgb) => { for (const p of [a, b, c]) { pos.push(p.x, p.y, p.z); col.push(...rgb); } },
    part: () => ({ positions: Float32Array.from(pos), colours: Float32Array.from(col), index: Uint32Array.from({ length: pos.length / 3 }, (_, i) => i) }),
  };
}
const linear = (hex: number): Rgb => { const c = new Color(hex); return [c.r, c.g, c.b]; };

/** An island model hung where the shard hangs it; null when any of it falls outside the cell. */
function hang(isle: FarIsle, s: SkyIsle, k: number, keel: boolean): FarPart | null {
  const { yaw, r, sy } = skyIslePose(s, isle.unit, k, keel), cos = Math.cos(yaw), sin = Math.sin(yaw), n = isle.positions.length / 3;
  const positions = new Float32Array(n * 3), colours = new Float32Array(n * 3);
  for (let v = 0; v < n; v++) {
    // a playable keel is cut at its turf (the shard discards above it): its canopy folds flat under the deck
    const lx = (isle.positions[v * 3] ?? 0) * r, ly = (keel ? Math.min(0, isle.positions[v * 3 + 1] ?? 0) : isle.positions[v * 3 + 1] ?? 0) * r * sy, lz = (isle.positions[v * 3 + 2] ?? 0) * r;
    // three's Y rotation: x' = x cos + z sin, z' = −x sin + z cos
    const x = s.x + lx * cos + lz * sin, z = s.z - lx * sin + lz * cos;
    if (Math.abs(x) > HALF - 0.5 || Math.abs(z) > HALF - 0.5) return null;
    positions.set([x, s.y + ly, z], v * 3);
    colours.set(recolour([isle.colours[v * 3] ?? 0, isle.colours[v * 3 + 1] ?? 0, isle.colours[v * 3 + 2] ?? 0], keel), v * 3);
  }
  return { positions, colours, index: isle.index };
}

/** A playable island's deck: the 12-gon grass top and its cut band (world/build.ts), its pines; the windmill on its isle. */
function decks(): FarPart {
  const { tri, part } = facets(), grass = linear(PALETTE.grass), dirt = linear(PALETTE.dirt), pine = linear(PALETTE.pine), tower = linear(PALETTE.tower), sail = linear(PALETTE.sail);
  const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
  for (const isle of ISLES) {
    const cut = isle.y - (ISLE_KEEL_CUT[isle.id]?.cut ?? ISLE_CUT), rim = Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return [isle.x + Math.cos(a) * isle.r, isle.z + Math.sin(a) * isle.r] as const; });
    for (let i = 0; i < 12; i++) {
      const [ax, az] = rim[i] ?? [0, 0], [bx, bz] = rim[(i + 1) % 12] ?? [0, 0];
      tri(v(isle.x, isle.y, isle.z), v(bx, isle.y, bz), v(ax, isle.y, az), grass);
      tri(v(ax, isle.y, az), v(bx, isle.y, bz), v(bx, cut, bz), dirt); tri(v(ax, isle.y, az), v(bx, cut, bz), v(ax, cut, az), dirt);
    }
    for (const [dx, dz, s] of PINES[isle.id] ?? []) {
      const x = isle.x + dx, z = isle.z + dz, top = v(x, isle.y + 7 * s, z), r = 1.9 * s;
      const foot = [0, 1, 2].map((i) => { const a = (i / 3) * Math.PI * 2 + dx; return v(x + Math.cos(a) * r, isle.y + 0.8 * s, z + Math.sin(a) * r); });
      for (let i = 0; i < 3; i++) { const a = foot[i], b = foot[(i + 1) % 3]; if (a !== undefined && b !== undefined) tri(top, b, a, pine); }
    }
  }
  // the windmill (world/mill.ts MILL): a six-sided tapered tower on its drum and the sails facing the spawn (+z)
  const y0 = WINDMILL.y + 1.2, y1 = y0 + 8.6, ring = (r: number, y: number): Vector3[] => Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2; return v(MILL.x + Math.cos(a) * r, y, MILL.z + Math.sin(a) * r); });
  const lo = ring(2.5, y0), hi = ring(1.7, y1), cap = v(MILL.x, y1 + 2.9, MILL.z);
  for (let i = 0; i < 6; i++) {
    const a = lo[i], b = lo[(i + 1) % 6], c = hi[(i + 1) % 6], d = hi[i];
    if (a === undefined || b === undefined || c === undefined || d === undefined) continue;
    tri(a, c, b, tower); tri(a, d, c, tower); tri(d, cap, c, linear(PALETTE.dirt));
  }
  const hub = v(MILL.x, y1 - 0.4, MILL.z + 2.2), w = 0.7, L = 7.4;
  for (const [ux, uy] of [[1, 1], [-1, 1]] as const) {
    const dx = (ux * L) / Math.SQRT2, dy = (uy * L) / Math.SQRT2, px = (-uy * w) / Math.SQRT2, py = (ux * w) / Math.SQRT2;
    const a = v(hub.x - dx - px, hub.y - dy - py, hub.z), b = v(hub.x + dx - px, hub.y + dy - py, hub.z), c = v(hub.x + dx + px, hub.y + dy + py, hub.z), d = v(hub.x - dx + px, hub.y - dy + py, hub.z);
    tri(a, b, c, sail); tri(a, c, d, sail); tri(a, c, b, sail); tri(a, d, c, sail);
  }
  return part();
}

/** An island of the shard's own code builder (world/isle.ts) welded by position, decimated, recoloured, hung at `at`. */
function builtIsle(isle: Isle, at: { x: number; y: number; z: number }, random: () => number, triangles: number, tools: FarModelTools): FarPart {
  const geometry = islandMesh(isle, random).geometry, position = geometry.getAttribute('position'), colour = geometry.getAttribute('color'), source = geometry.getIndex();
  if (source === null) throw new Error('Sky Reach island mesh is indexed');
  const slot = new Map<string, number>(), remap = new Uint32Array(position.count), pos: number[] = [], sum: number[] = [], count: number[] = [];
  for (let v = 0; v < position.count; v++) {
    const x = position.getX(v), y = position.getY(v), z = position.getZ(v), key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    let s = slot.get(key);
    if (s === undefined) { s = pos.length / 3; slot.set(key, s); pos.push(x, y, z); sum.push(0, 0, 0); count.push(0); }
    remap[v] = s; sum[s * 3] = (sum[s * 3] ?? 0) + colour.getX(v); sum[s * 3 + 1] = (sum[s * 3 + 1] ?? 0) + colour.getY(v); sum[s * 3 + 2] = (sum[s * 3 + 2] ?? 0) + colour.getZ(v); count[s] = (count[s] ?? 0) + 1;
  }
  const welded = Float32Array.from(pos), kept = tools.decimate(welded, Uint32Array.from({ length: source.count }, (_, k) => remap[source.getX(k)] ?? 0), triangles);
  const out = new Map<number, number>(), positions: number[] = [], colours: number[] = [];
  const index = Uint32Array.from(kept, (i) => {
    let o = out.get(i);
    if (o === undefined) {
      o = out.size; out.set(i, o); const n = count[i] ?? 1;
      positions.push(at.x + (welded[i * 3] ?? 0), at.y + (welded[i * 3 + 1] ?? 0), at.z + (welded[i * 3 + 2] ?? 0));
      colours.push(...recolour([(sum[i * 3] ?? 0) / n, (sum[i * 3 + 1] ?? 0) / n, (sum[i * 3 + 2] ?? 0) / n], false));
    }
    return o;
  });
  return { positions: Float32Array.from(positions), colours: Float32Array.from(colours), index };
}

/** world/risingIslet.ts's chain rig at rest: its two post tops on the gate isle's rim and the islet's four rings. */
const POST = { h: 2.8, side: 3.2, inset: 0.7 } as const;
function chains(entry: RisingIslet): { tops: Vector3[]; rings: Vector3[] } {
  const h = new Vector3(entry.dock.x - entry.rest.x, 0, entry.dock.z - entry.rest.z).normalize(), p = new Vector3(-h.z, 0, h.x), isletR = apothem({ id: 'islet', x: 0, z: 0, r: ISLET.islet.r, y: 0, keel: ISLET.islet.keel });
  const rim = new Vector3(entry.dock.x, entry.gate.y, entry.dock.z).addScaledVector(h, isletR + ISLET.gap + POST.inset);
  const tops = [-1, 1].map((k) => rim.clone().addScaledVector(p, k * POST.side).setY(entry.gate.y + POST.h - 0.3));
  const rings = [-1, 1].flatMap((k) => [-1, 1].map((f) => new Vector3(entry.rest.x, entry.rest.y + 0.15, entry.rest.z).addScaledVector(p, k * (POST.side + 0.2)).addScaledVector(h, f * 2.4)));
  return { tops, rings };
}

/** The four Rising Islet entries in their rest pose (see the module note). */
export function entryParts(tools: FarModelTools): FarPart[] {
  // the shard's own seeded streams (world/build.ts's gate isles from 1830, world/risingIslet.ts's islets from 4183)
  const stream = (start: number): (() => number) => { let seed = start; return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; };
  const gateRnd = stream(1830), isletRnd = stream(4183), parts: FarPart[] = [];
  const islet: Isle = { id: 'islet', x: 0, z: 0, r: ISLET.islet.r, y: 0, keel: ISLET.islet.keel };
  for (const entry of RISING_ISLETS) parts.push(builtIsle({ ...entry.gate }, entry.gate, gateRnd, FAR_ENTRIES.gate, tools));
  for (const entry of RISING_ISLETS) parts.push(builtIsle(islet, entry.rest, isletRnd, FAR_ENTRIES.islet, tools));
  const { tri, part } = facets(), chain = linear(0x4a4244), stone = linear(PALETTE.rock), pine = linear(PALETTE.pine), v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
  for (const entry of RISING_ISLETS) {
    // each strand two crossed quads (both faces), so it reads from any side
    const { tops, rings } = chains(entry);
    rings.forEach((ring, k) => {
      const top = tops[k < 2 ? 0 : 1]; if (top === undefined) return;
      const along = top.clone().sub(ring).normalize(), across = [new Vector3(0, 1, 0).cross(along).normalize(), along.clone().cross(new Vector3(0, 1, 0)).cross(along).normalize()];
      for (const side of across) {
        const w = side.multiplyScalar(FAR_ENTRIES.chain / 2), a = ring.clone().sub(w), b = ring.clone().add(w), c = top.clone().add(w), d = top.clone().sub(w);
        tri(a, b, c, chain); tri(a, c, d, chain); tri(a, c, b, chain); tri(a, d, c, chain);
      }
    });
    // the stone lip at road height: its top and its four sides
    const l = entry.landing, x0 = l.x - l.hx, x1 = l.x + l.hx, y0 = l.y - l.hy, y1 = l.y + l.hy, z0 = l.z - l.hz, z1 = l.z + l.hz;
    tri(v(x0, y1, z0), v(x0, y1, z1), v(x1, y1, z1), stone); tri(v(x0, y1, z0), v(x1, y1, z1), v(x1, y1, z0), stone);
    for (const [ax, az, bx, bz] of [[x0, z1, x1, z1], [x1, z1, x1, z0], [x1, z0, x0, z0], [x0, z0, x0, z1]] as const) { tri(v(ax, y0, az), v(bx, y0, bz), v(bx, y1, bz), stone); tri(v(ax, y0, az), v(bx, y1, bz), v(ax, y1, az), stone); }
    // the gate isle's pine beside the chain posts (world/build.ts), as the decks' pines are drawn
    const g = entry.gate, px = g.x + 3, pz = g.z - 3, s = 0.9, top = v(px, g.y + 7 * s, pz), r = 1.9 * s;
    const foot = [0, 1, 2].map((i) => { const a = (i / 3) * Math.PI * 2 + 3; return v(px + Math.cos(a) * r, g.y + 0.8 * s, pz + Math.sin(a) * r); });
    for (let i = 0; i < 3; i++) { const a = foot[i], b = foot[(i + 1) % 3]; if (a !== undefined && b !== undefined) tri(top, b, a, pine); }
  }
  parts.push(part());
  return parts;
}

/** Sky Reach's islands as far parts (see the module note). */
export async function farParts(tools: FarModelTools): Promise<FarPart[]> {
  const models = new Map<SkyIsleModel, FarIsle>();
  for (const name of SKY_ISLE_MODELS) {
    const raw = await tools.model(`public${skyHdUrl(name)}`), geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(Float32Array.from(raw.positions), 3)).setIndex(new BufferAttribute(Uint32Array.from(raw.index), 1));
    const unit = skyIsleUnit(geometry), positions = Float32Array.from(geometry.getAttribute('position').array), kept = tools.decimate(positions, raw.index, FAR_ISLES.triangles);
    // compact to the vertices the decimated index keeps
    const slot = new Map<number, number>(), pos: number[] = [], col: number[] = [];
    const index = Uint32Array.from(kept, (i) => {
      let s = slot.get(i);
      if (s === undefined) { s = slot.size; slot.set(i, s); pos.push(positions[i * 3] ?? 0, positions[i * 3 + 1] ?? 0, positions[i * 3 + 2] ?? 0); col.push(raw.colours[i * 3] ?? 0, raw.colours[i * 3 + 1] ?? 0, raw.colours[i * 3 + 2] ?? 0); }
      return s;
    });
    models.set(name, { unit, positions: Float32Array.from(pos), colours: Float32Array.from(col), index });
  }
  const parts: FarPart[] = [], place = (isles: readonly SkyIsle[], keel: boolean): void => {
    const seen = new Map<SkyIsleModel, number>();
    isles.forEach((s, i) => {
      const name = skyIsleWear(s, i), isle = models.get(name), k = seen.get(name) ?? 0; seen.set(name, k + 1);
      const part = isle === undefined ? null : hang(isle, s, k, keel); if (part !== null) parts.push(part);
    });
  };
  // the proxy only draws in the grid: the cube's isles (G99), and `hang` refuses any vertex past the cell edge
  place(skyIslesIn({ half: HALF }), false); place(keelIsles(ISLES), true);
  parts.push(decks(), ...entryParts(tools));
  return parts;
}
