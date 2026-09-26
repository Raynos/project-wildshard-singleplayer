// The Yamen Well's plan (dome C, E169), shared by its region builders so each region can be owned on its own:
//   well-rim.ts    the rim ledge at the square's datum and the near galleries of the main shaft down to SPLIT
//                  (what the mockup B / D cameras stand on and look over),
//   well-mid.ts    the canyon's run north under the Cable Deck (its galleries), every crossing (bridges, catwalks, the
//                  gate bridges, nets, the gondola and its stations) and the far signs,
//   well-lower.ts  the main shaft's galleries below SPLIT, the shells and the floor lost in the mist, the fog sheets.
// The plan holds the footprint, the walls (where, which way, how deep their galleries run), the crossings (every gallery
// band opens its railing where one lands) and the built bands' profiles, so a crossing or a net built in one region
// ties into the gallery fronts another region built.
import { Vector3 } from 'three';
import type { Ctx } from './ctx';
import type { Kit } from './kit';
import { WELL, Y0 } from '../layout';
import { FLOOR_H, type GalleryProfile, galleryWall } from './well-galleries';
import type { BridgeKind } from './well-bridges';

/** the canyon's run north under the Cable Deck (its ceiling is the deck's sky screen at +155 m) */
export const EXT = { x0: WELL.x0, x1: -12, z0: -104, z1: WELL.z0 } as const;
/** the south rim: the ledge at the square's datum the mockup B / D cameras stand on, its balustrade at z0 */
export const RIM = { z0: 11.2, z1: WELL.z1 } as const;
/** the box the shaft's silk mist fills (look/style.ts uShaft) and the rectangles its fog sheets span */
export const SHAFT = { x0: WELL.x0, z0: EXT.z0, x1: WELL.x1, z1: WELL.z1 } as const;
export const WELL_RECTS = [
  { x0: WELL.x0, z0: WELL.z0, x1: WELL.x1, z1: WELL.z1 },
  { x0: EXT.x0, z0: EXT.z0, x1: EXT.x1, z1: EXT.z1 },
] as const;
/** the near galleries (well-rim.ts) run down to SPLIT + one floor; the lower levels (well-lower.ts) from SPLIT down */
export const SPLIT = Y0 - 30;
/** the lowest gallery floor (the fragment's cut); the walls run on below it as painted shells into the mist */
export const LOW = Y0 - 66;
/** the floor far below, lost in the mist */
export const DEEP = Y0 - 112;
/** the top gallery floor of the walls under the Cable Deck (its screen is at +29.85) */
export const DECK_TOP = Y0 + 24;
/** the gondola's cable runs along x at this z, y (build.ts slides the cabin between x0 + 5 and x1 − 5) */
export const CABLE = { z: -12, y: Y0 - 16, x0: WELL.x0, x1: WELL.x1 } as const;

/** the floor at or below y */
export const snapFloor = (y: number): number => Y0 - Math.ceil((Y0 - y) / FLOOR_H - 1e-6) * FLOOR_H;

export interface Crossing { kind: BridgeKind; z: number; y: number; w: number; crowd: number; ext: boolean }

/** every crossing (well-mid.ts builds them; every gallery band lands them): z, deck height (a floor), width */
export const CROSSINGS: readonly Crossing[] = [
  { kind: 'steel', z: -8, y: Y0 - 12, w: 1.4, crowd: 1, ext: false },
  { kind: 'timber', z: -21, y: Y0 - 6, w: 2.4, crowd: 6, ext: false },
  { kind: 'gate', z: -27, y: Y0 - 18, w: 7, crowd: 16, ext: false },
  { kind: 'timber', z: 4, y: Y0 - 27, w: 2.2, crowd: 2, ext: false },
  { kind: 'stone', z: -38, y: Y0 - 33, w: 3, crowd: 2, ext: false },
  { kind: 'steel', z: -17, y: Y0 - 42, w: 1.4, crowd: 1, ext: false },
  { kind: 'timber', z: -4, y: Y0 - 48, w: 2.2, crowd: 1, ext: false },
  { kind: 'covered', z: -33, y: Y0 - 54, w: 2.6, crowd: 1, ext: false },
  { kind: 'stone', z: -14, y: Y0 - 63, w: 3, crowd: 0, ext: false },
  // (dome D2's four for view D's middle, clear of the temple spur at z −11…+5 below +50)
  { kind: 'timber', z: -28, y: Y0 - 36, w: 2.2, crowd: 2, ext: false },
  { kind: 'steel', z: -24, y: Y0 - 69, w: 1.4, crowd: 1, ext: false },
  { kind: 'stone', z: -38, y: Y0 - 84, w: 3, crowd: 1, ext: false },
  { kind: 'timber', z: -20, y: Y0 - 93, w: 2.2, crowd: 1, ext: false },
  { kind: 'stone', z: -51, y: Y0 + 3, w: 3, crowd: 4, ext: true },
  { kind: 'steel', z: -58, y: Y0 - 27, w: 1.4, crowd: 1, ext: true },
  { kind: 'covered', z: -63, y: Y0 + 12, w: 2.6, crowd: 3, ext: true },
  { kind: 'timber', z: -70, y: Y0 - 6, w: 2.2, crowd: 3, ext: true },
  { kind: 'stone', z: -77, y: Y0 - 39, w: 3, crowd: 1, ext: true },
  { kind: 'stone', z: -81, y: Y0 + 18, w: 3, crowd: 2, ext: true },
  { kind: 'steel', z: -87, y: Y0 - 15, w: 1.4, crowd: 1, ext: true },
  { kind: 'gate', z: -95, y: Y0 + 3, w: 6, crowd: 10, ext: true },
  { kind: 'timber', z: -99, y: Y0 - 30, w: 2.2, crowd: 1, ext: true },
];

/** a wall of the shaft that carries galleries */
export interface WallPlan {
  name: 'south' | 'west' | 'east' | 'stub' | 'west-x' | 'east-x' | 'north';
  /** its start on its plane (its left end seen from the void) and its outward normal (into the void) */
  p0: Vector3;
  n: Vector3;
  len: number;
  /** the wall coordinate u (0…len along it) of a world z (walls along z) or x (walls along x) */
  uOf: (c: number) => number;
  /** the top gallery floor and where the back wall stops above it */
  top: number;
  wallTop: number;
  dMin: number;
  dMax: number;
  timber: number;
  wash: number;
  g0?: number;
  g1?: number;
  /** fronts stepping out going down (galleries.ts GalleryWall.cascade) */
  cascade?: { rate: number; from: number; cap: number };
  /** the main shaft (z ≥ −44) or the run north */
  ext: boolean;
}

/** (the main shaft's west and east galleries run 4.2–6.4 and 3.2–5 m deep, so the open gap reads 15–20 m from the rim;
 *  the south wall's galleries start tucked under the rim ledge (4.8 m deep) and cascade out 0.6 m a floor to 5.8 m, past
 *  its lip at z 11.2: looking down over the balustrade you see them stepping out below you) */
export const WALLS: readonly WallPlan[] = [
  { name: 'south', p0: new Vector3(WELL.x1, 0, WELL.z1), n: new Vector3(0, 0, -1), len: WELL.x1 - WELL.x0, uOf: (x) => WELL.x1 - x, top: Y0 - FLOOR_H, wallTop: Y0 - 0.7, dMin: 3.2, dMax: 4.2, timber: 0.6, wash: 0x7a7c84, g0: 5, g1: 6, ext: false, cascade: { rate: 0.6, from: Y0 - FLOOR_H, cap: 5.8 } },
  { name: 'west', p0: new Vector3(WELL.x0, 0, WELL.z1), n: new Vector3(1, 0, 0), len: WELL.z1 - WELL.z0, uOf: (z) => WELL.z1 - z, top: Y0, wallTop: Y0 + FLOOR_H - 0.3, dMin: 4.2, dMax: 6.4, timber: 0.75, wash: 0x737782, ext: false },
  { name: 'east', p0: new Vector3(WELL.x1, 0, WELL.z0), n: new Vector3(-1, 0, 0), len: WELL.z1 - WELL.z0, uOf: (z) => z - WELL.z0, top: Y0 - FLOOR_H, wallTop: Y0 - 1.4, dMin: 3.2, dMax: 5.0, timber: 0.65, wash: 0x797b83, g0: 3.6, ext: false },
  { name: 'stub', p0: new Vector3(EXT.x1, 0, WELL.z0 + 0.1), n: new Vector3(0, 0, 1), len: WELL.x1 - EXT.x1, uOf: (x) => x - EXT.x1, top: DECK_TOP, wallTop: Y0 + 30, dMin: 1.6, dMax: 3.2, timber: 0.7, wash: 0x70747f, ext: false },
  { name: 'west-x', p0: new Vector3(EXT.x0, 0, EXT.z1), n: new Vector3(1, 0, 0), len: EXT.z1 - EXT.z0, uOf: (z) => EXT.z1 - z, top: DECK_TOP, wallTop: Y0 + 30, dMin: 2, dMax: 3.4, timber: 0.75, wash: 0x737782, g1: 3.2, ext: true },
  { name: 'east-x', p0: new Vector3(EXT.x1, 0, EXT.z0), n: new Vector3(-1, 0, 0), len: EXT.z1 - EXT.z0, uOf: (z) => z - EXT.z0, top: DECK_TOP, wallTop: Y0 + 30, dMin: 2, dMax: 3.4, timber: 0.7, wash: 0x7c7c80, g0: 3.2, ext: true },
  { name: 'north', p0: new Vector3(EXT.x0, 0, EXT.z0), n: new Vector3(0, 0, 1), len: EXT.x1 - EXT.x0, uOf: (x) => x - EXT.x0, top: DECK_TOP, wallTop: Y0 + 30, dMin: 1.2, dMax: 2.2, timber: 0.7, wash: 0x70747f, g0: 3.6, g1: 3.6, ext: true },
];

export const wallPlan = (name: WallPlan['name']): WallPlan => {
  const w = WALLS.find((p) => p.name === name);
  if (w === undefined) throw new Error(`well: no wall ${name}`);
  return w;
};

/** a band's own overrides: its depth range (else the wall's), grey-tin eaves (default: the bands below SPLIT), the depth
 *  of its every-15-m street floors (default: its dMax + 0.6) */
export interface BandOptions { depths?: { dMin: number; dMax: number }; tin?: boolean; street?: number }

/** the kits a region writes a band into */
export interface BandKits { kit: (y: number) => Kit; alpha: (y: number) => Kit }

export class WellPlan {
  private readonly bands = new Map<WallPlan['name'], GalleryProfile[]>();
  constructor(readonly ctx: Ctx) {}

  /**
   * Build the floors [yBottom, yTop] of a wall's galleries into `kits`. The back wall runs from `wallBottom` (default:
   * just under the lowest floor) to the wall's top when the band holds its top floor. Crossings land, the gondola's
   * stations and the rim's corners stay clear.
   */
  band(name: WallPlan['name'], yTop: number, yBottom: number, seed: number, kits: BandKits, wallBottom = yBottom - 0.3, stairs = 0,
    opt: BandOptions = {}): GalleryProfile {
    const P = wallPlan(name);
    const dMin = opt.depths?.dMin ?? P.dMin, dMax = opt.depths?.dMax ?? P.dMax;
    const along = P.n.z === 0;
    const landings = along ? CROSSINGS.filter((c) => c.ext === P.ext).map((c) => {
      const a = P.uOf(c.z - c.w / 2), b = P.uOf(c.z + c.w / 2);
      return { y: c.y, u0: Math.min(a, b), u1: Math.max(a, b), d: dMin };
    }) : [];
    const voids: { y0: number; y1: number; u0: number; u1: number }[] = [];
    if (name === 'west' || name === 'east') {
      const a = P.uOf(CABLE.z - 3.4), b = P.uOf(CABLE.z + 3.4);
      voids.push({ y0: CABLE.y - 6, y1: CABLE.y + 2, u0: Math.min(a, b), u1: Math.max(a, b) });
      // the rim ledge's corner (z RIM.z0…RIM.z1) under the square's datum
      const r0 = P.uOf(RIM.z0 - 0.2), r1 = P.uOf(RIM.z1);
      voids.push({ y0: Y0 - 6, y1: Y0 + 0.5, u0: Math.min(r0, r1), u1: Math.max(r0, r1) });
    }
    // under the mockup B / D cameras (x −17…−4) the south wall keeps no galleries down to SPLIT: looking down over the
    // balustrade you see straight into the shaft, the west and east galleries dropping away on either side
    if (name === 'south') voids.push({ y0: SPLIT + 0.1, y1: Y0, u0: P.uOf(-4), u1: P.uOf(-17) });
    const holdsTop = yTop >= P.top - 0.01;
    const prof = galleryWall(this.ctx, {
      name: `${name}@${yTop}`, p0: P.p0, n: P.n, len: P.len, yTop: Math.min(yTop, P.top), yBottom,
      wallTop: holdsTop ? P.wallTop : Math.min(yTop, P.top) + FLOOR_H - 0.3, wallBottom,
      dMin, dMax, timber: P.timber, seed, wash: P.wash, landings, voids, stairs, tin: opt.tin ?? yTop <= SPLIT + 0.1,
      ...(opt.street === undefined ? {} : { street: opt.street }),
      ...(P.g0 === undefined ? {} : { g0: P.g0 }), ...(P.g1 === undefined ? {} : { g1: P.g1 }), ...(P.cascade === undefined ? {} : { cascade: P.cascade }),
    }, kits);
    const list = this.bands.get(name) ?? [];
    list.push(prof);
    this.bands.set(name, list);
    return prof;
  }

  /** a wall's gallery depth at (world z or x, floor y); 0 where it has none (or no band holds that floor yet) */
  depth(name: WallPlan['name'], c: number, y: number): number {
    const P = wallPlan(name);
    for (const b of this.bands.get(name) ?? []) {
      if (y > (b.floors[0] ?? -1e9) + 0.1 || y < (b.floors[b.floors.length - 1] ?? 1e9) - 0.1) continue;
      return b.at(P.uOf(c), y);
    }
    return 0;
  }

  /** the deepest front of a wall over a span of z (or x) and a band of heights */
  maxDepth(name: WallPlan['name'], c0: number, c1: number, y0: number, y1: number): number {
    const P = wallPlan(name);
    const a = P.uOf(c0), b = P.uOf(c1);
    let m = 0;
    for (const bd of this.bands.get(name) ?? []) m = Math.max(m, bd.maxIn(Math.min(a, b), Math.max(a, b), y0, y1));
    return m;
  }

  /** the gap's two fronts at (z, floor y): the x where the west galleries end and the east ones begin */
  fronts(z: number, y: number): [number, number] {
    const ext = z < WELL.z0;
    return [WELL.x0 + this.depth(ext ? 'west-x' : 'west', z, y), (ext ? EXT.x1 : WELL.x1) - this.depth(ext ? 'east-x' : 'east', z, y)];
  }

  /** the outermost fronts round a span of z over ±3.5 m of height (a net ties off to them) */
  frontsMax(z0: number, z1: number, y: number): [number, number] {
    const ext = Math.max(z0, z1) < WELL.z0 + 0.1;
    return [WELL.x0 + this.maxDepth(ext ? 'west-x' : 'west', z0, z1, y - 3.5, y + 3.5), (ext ? EXT.x1 : WELL.x1) - this.maxDepth(ext ? 'east-x' : 'east', z0, z1, y - 3.5, y + 3.5)];
  }
}

/** kit buckets by altitude, so the deep ones cull when you look across */
export function bandKits(ctx: Ctx, region: string): BandKits {
  const band = (y: number): string => (y >= Y0 - 1 ? 'hi' : y >= Y0 - 25 ? 'b0' : y >= Y0 - 49 ? 'b1' : y >= Y0 - 76 ? 'b2' : 'deep');
  return { kit: (y) => ctx.kit(`well-${region}-${band(y)}`), alpha: () => ctx.alpha(`well-${region}-a`) };
}
