import { ENTRY_ASPHALT } from '@wildshard/engine/core/config';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { BoxGeometry, Color, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { bakeKinds, type PieceBake } from '@wildshard/sdk/bake/kinds';
import { ISLET, RISING_ISLETS, type EntryEdge, type RisingIslet } from '../world/islets';
import { PALETTE, flat } from '../world/shapes';

/**
 * Build-time only (SHARD-PLATFORM SF72): baked by `scripts/bake-sky-world.mjs` into `baked/docks.glb` + `data/docks.json`;
 * the client draws the bake (`world/skyDock.ts`).
 *
 * SHARD-PLATFORM G200 (Jake's pick B, art/grid/round-22-landings-standalone): played alone there is no road beyond a
 * Rising Islet's stone lip, so each lip ends at a timber sky dock: a plank jetty over the outer part of the road socket,
 * railed on its sides and its far end (and along the lip's own open edges) so nobody walks off into the cloud sea, with
 * mooring bollards and a tall beacon mast carrying a brass lantern and a pink pennant: a sky-ship landing stage, not a road
 * end. Standalone only (`ctx.cube === null`, world/build.ts): in a grid cell the road socket continues there and no dock
 * spawns. Two draws for all four docks (one instanced box mesh with per-instance colour, one emissive lantern mesh), no
 * facade multi-draw; the colliders are plain boxes.
 *
 * Laid out in each entry's own frame (world/islets.ts `entryFrame`): `t` along the edge, `u` inward from the cell edge.
 */
export const DOCK = {
  /** the jetty runs from `u0` to the lip's outer edge (the road socket's far end, u = ENTRY_ASPHALT) */
  u0: 5,
  /** half its walking width */
  half: 2.6,
  /** the rails: post height and thickness, the collider wall's thickness */
  rail: 1.25, post: 0.18, wall: 0.2,
  /** the beacon mast's height */
  mast: 6.2,
} as const;
/** the lip's own half width along the edge, and its inner edge (the islet side, left open: the islet docks there) */
const LIP_HALF = ISLET.lip.width / 2, U1 = ENTRY_ASPHALT, LIP_IN = ENTRY_ASPHALT + ISLET.lip.depth;

const ALONG_X: Readonly<Record<EntryEdge, boolean>> = { north: true, south: true, east: false, west: false };
/** an axis-aligned world box from the entry's frame: `t0..t1` along the edge, `u0..u1` in from it, `y0..y1` */
export function dockBox(entry: RisingIslet, t0: number, t1: number, u0: number, u1: number, y0: number, y1: number): { kind: 'box'; x: number; y: number; z: number; hx: number; hy: number; hz: number; surface: 'wood' } {
  const a = entry.at(t0, u0, y0), b = entry.at(t1, u1, y1);
  return { kind: 'box', x: (a.x + b.x) / 2, y: (y0 + y1) / 2, z: (a.z + b.z) / 2, hx: Math.abs(b.x - a.x) / 2, hy: (y1 - y0) / 2, hz: Math.abs(b.z - a.z) / 2, surface: 'wood' };
}

/**
 * One dock's collision: the deck (top y = 0, flush with the lip), the two side rails and the far-end rail, the lip's open
 * outer-edge corners beside the jetty and its two ends, the beacon mast and the bollards. The lip's inner edge stays open.
 */
export function dockColliders(entry: RisingIslet): ColliderDesc[] {
  const D = DOCK, w = D.wall, h = D.half, r = D.rail;
  return [
    dockBox(entry, -h - w, h + w, D.u0, U1, -0.42, 0),
    // the side rails, the far end, the lip's outer edge beside the jetty, the lip's two ends
    dockBox(entry, -h - w, -h, D.u0, U1, 0, r), dockBox(entry, h, h + w, D.u0, U1, 0, r),
    dockBox(entry, -h - w, h + w, D.u0 - w, D.u0, 0, r),
    dockBox(entry, -LIP_HALF - w, -h, U1 - w, U1, 0, r), dockBox(entry, h, LIP_HALF + w, U1 - w, U1, 0, r),
    dockBox(entry, -LIP_HALF - w, -LIP_HALF, U1 - w, LIP_IN, 0, r), dockBox(entry, LIP_HALF, LIP_HALF + w, U1 - w, LIP_IN, 0, r),
    // the beacon mast and the two bollards at the far end
    dockBox(entry, h - 0.55, h - 0.2, D.u0 + 0.2, D.u0 + 0.55, 0, D.mast),
    dockBox(entry, -h + 0.35, -h + 0.85, D.u0 + 0.35, D.u0 + 0.85, 0, 0.7), dockBox(entry, h - 1.45, h - 0.95, D.u0 + 0.35, D.u0 + 0.85, 0, 0.7),
  ];
}

const BRASS = 0xb08a3a, PENNANT = 0xe0708a, X = new Vector3(1, 0, 0), Z = new Vector3(0, 0, 1);
interface Part { t: number; u: number; y: number; st: number; su: number; sy: number; color: number; tilt?: number }
/** One dock's look as boxes in its frame (centres, sizes along t / u / y), drawn by one instanced mesh for all four. */
function dockParts(): Part[] {
  const D = DOCK, h = D.half, parts: Part[] = [], length = U1 - D.u0;
  // the planks across the jetty (a few warmer or greyer), the two stringers under them, the cross beam at the far end
  const planks = Math.round(length / 0.5);
  for (let i = 0; i < planks; i++) parts.push({ t: 0, u: D.u0 + (i + 0.5) * (length / planks), y: -0.06, st: 2 * h + 0.3, su: length / planks - 0.04, sy: 0.12, color: i % 3 === 1 ? 0x80604a : i % 4 === 2 ? 0x987456 : PALETTE.plank });
  for (const s of [-1, 1]) parts.push({ t: s * (h - 0.4), u: D.u0 + length / 2, y: -0.3, st: 0.3, su: length, sy: 0.36, color: PALETTE.trunk });
  parts.push({ t: 0, u: D.u0 + 0.15, y: -0.28, st: 2 * h + 0.5, su: 0.3, sy: 0.4, color: PALETTE.trunk });
  // posts: along both sides every 2.5 m, the far corners, the lip's corners; the rope rails at hand and knee height
  const post = (t: number, u: number): void => { parts.push({ t, u, y: D.rail / 2, st: D.post, su: D.post, sy: D.rail + 0.1, color: PALETTE.trunk }); };
  for (const s of [-1, 1]) {
    for (let u = D.u0; u <= U1 + 1e-6; u += length / 4) post(s * (h + 0.1), u);
    post(s * (LIP_HALF + 0.1), U1 - 0.1); post(s * (LIP_HALF + 0.1), LIP_IN - 0.1);
    for (const [y, th] of [[D.rail - 0.08, 0.09], [0.62, 0.06]] as const) {
      parts.push({ t: s * (h + 0.1), u: D.u0 + length / 2, y, st: th, su: length, sy: th, color: PALETTE.rope });
      parts.push({ t: s * (h + LIP_HALF + 0.2) / 2, u: U1 - 0.1, y, st: LIP_HALF - h + 0.1, su: th, sy: th, color: PALETTE.rope });
      parts.push({ t: s * (LIP_HALF + 0.1), u: (U1 + LIP_IN) / 2 - 0.1, y, st: th, su: LIP_IN - U1, sy: th, color: PALETTE.rope });
    }
  }
  for (const [y, th] of [[D.rail - 0.08, 0.09], [0.62, 0.06]] as const) parts.push({ t: 0, u: D.u0 - 0.1, y, st: 2 * h + 0.2, su: th, sy: th, color: PALETTE.rope });
  // the mooring bollards (a post with a cap) at the far end
  for (const t of [-h + 0.6, h - 1.2]) { parts.push({ t, u: D.u0 + 0.6, y: 0.3, st: 0.42, su: 0.42, sy: 0.6, color: PALETTE.trunk }); parts.push({ t, u: D.u0 + 0.6, y: 0.66, st: 0.56, su: 0.56, sy: 0.12, color: BRASS }); }
  // the beacon mast: a tall post with a yard, the lantern's brass cage (the glass is the emissive mesh), the pennant
  const mt = h - 0.38, mu = D.u0 + 0.38;
  parts.push({ t: mt, u: mu, y: D.mast / 2, st: 0.26, su: 0.26, sy: D.mast, color: PALETTE.trunk });
  parts.push({ t: mt - 0.5, u: mu, y: D.mast - 1.4, st: 1.2, su: 0.12, sy: 0.12, color: PALETTE.trunk });
  for (const y of [D.mast + 0.08, D.mast + 0.82]) parts.push({ t: mt, u: mu, y, st: 0.62, su: 0.62, sy: 0.1, color: BRASS });
  parts.push({ t: mt, u: mu, y: D.mast + 1.0, st: 0.16, su: 0.16, sy: 0.3, color: BRASS });
  parts.push({ t: mt - 0.9, u: mu, y: D.mast - 0.45, st: 1.6, su: 0.03, sy: 0.42, color: PENNANT, tilt: 0.22 });
  return parts;
}

export interface SkyDocks { readonly timber: InstancedMesh; readonly beacon: InstancedMesh; readonly colliders: ColliderDesc[] }

/** The four docks' look (the timber boxes with their per-instance colours, the beacon glass) and collision, in world space. */
export function buildSkyDocks(entries: readonly RisingIslet[] = RISING_ISLETS): SkyDocks {
  const parts = dockParts(), timber = new InstancedMesh(new BoxGeometry(1, 1, 1), flat(0xffffff), parts.length * entries.length);
  const beacon = new InstancedMesh(new BoxGeometry(0.5, 0.66, 0.5), flat(0xffc56a, { emissive: 0xffa040, emissiveIntensity: 1.8 }), entries.length);
  const m = new Matrix4(), q = new Quaternion(), s = new Vector3(), p = new Vector3(), c = new Color(), axis = new Vector3();
  entries.forEach((entry, e) => {
    const alongX = ALONG_X[entry.edge], tAxis = entry.at(1, 0, 0), t0 = entry.at(0, 0, 0);
    axis.set(tAxis.x - t0.x, 0, tAxis.z - t0.z).normalize();
    parts.forEach((part, i) => {
      const at = entry.at(part.t, part.u, part.y);
      // the pennant droops (its free end, toward −t, down) about the horizontal axis across it; everything else is axis-aligned
      q.identity();
      if (part.tilt !== undefined) q.setFromAxisAngle(alongX ? Z : X, alongX ? part.tilt * Math.sign(axis.x) : -part.tilt * Math.sign(axis.z));
      s.set(alongX ? part.st : part.su, part.sy, alongX ? part.su : part.st);
      timber.setMatrixAt(e * parts.length + i, m.compose(p.set(at.x, at.y, at.z), q, s)); timber.setColorAt(e * parts.length + i, c.setHex(part.color));
    });
    const lamp = entry.at(DOCK.half - 0.38, DOCK.u0 + 0.38, DOCK.mast + 0.45);
    beacon.setMatrixAt(e, m.compose(p.set(lamp.x, lamp.y, lamp.z), q.identity(), s.set(1, 1, 1)));
  });
  return { timber, beacon, colliders: entries.flatMap(dockColliders) };
}

/** The docks' bake: their two kinds and colliders, and the timber's per-instance colours (the GLB carries none). */
export interface DocksBake extends PieceBake { tints: Record<string, number[]> }

/** The four docks as two instanced kinds (world space); the timber's per-instance colours go in the rows (`tints`). */
export function bakeSkyDocks(): DocksBake {
  const built = buildSkyDocks(), colors = built.timber.instanceColor;
  const tints: Record<string, number[]> = colors === null ? {} : { timber: Array.from(colors.array) };
  built.timber.instanceColor = null;
  return { ...bakeKinds('far.docks', [['timber', built.timber], ['beacon', built.beacon]], built.colliders), tints };
}
