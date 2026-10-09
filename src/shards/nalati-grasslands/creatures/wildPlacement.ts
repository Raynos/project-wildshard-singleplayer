import type { Rng } from '@wildshard/engine/core/rng';
import { KOKBORI_DEN, HORSE_PLAINS, PASTURE } from '../layout';

/** What Wildlife's placement reads of the ground: the terrain's up-normal and height, the water line and the wet ground. */
export interface WildGround {
  readonly normalY: (x: number, z: number) => number;
  readonly heightAt: (x: number, z: number) => number;
  readonly waterLevel: () => number;
  readonly wetAt: (x: number, z: number) => boolean;
}
/** A placed body as the free-spot test reads it (every body the manager holds, in its list). */
export interface WildBody { readonly position: { readonly x: number; readonly z: number }; readonly yaw: number }
/**
 * The placement Wildlife does for the creature manager, renderer-free (SF72): its own stream `Rng(seed ^ 0x3a17)`, the
 * ground, the manager's live bodies, and the manager's spawn and place. The page's Wildlife and a trusted Node host share it,
 * so both draw the same spots, yaws and mare coats.
 */
export interface WildPlacer<B extends WildBody> {
  readonly rng: Rng;
  readonly ground: WildGround;
  readonly bodies: () => Iterable<WildBody>;
  readonly spawn: (kind: string, x: number, z: number, yaw: number, variant: string) => B;
  readonly place: (body: B, x: number, z: number, yaw: number) => void;
}

export interface WildlifeLayout {
  packs: { x: number; z: number; variants: string[] }[];
  herds: { x: number; z: number; mares: number; foals: number; stallion: boolean }[];
  flocks: { x: number; z: number; count: number; dog: boolean; range?: number }[];
  /** marmot burrows: `sites` seeded inside the box (ambient; one instanced draw for all) */
  marmots?: { sites: number; box: { x0: number; x1: number; z0: number; z1: number } };
  /** the camp's saddled horses tied at the hitching rail (HITCH_HORSE_SPOTS, src/shards/nalati-grasslands/world/layout.ts) */
  campHorses?: boolean;
}

/** layout v2 (src/shards/nalati-grasslands/layout.ts): the pack below Kokbori's den on the NE rim, the AI herd on the horse plains
 *  (the hundreds round it are the instanced far herds), the flock on the pasture */
export const NALATI_WILDLIFE: WildlifeLayout = {
  packs: [{ x: KOKBORI_DEN.x + 22, z: KOKBORI_DEN.z - 30, variants: ['alpha', 'grey', 'tawny', 'grey', 'scout'] }],
  herds: [{ x: HORSE_PLAINS.x, z: HORSE_PLAINS.z, mares: 11, foals: 3, stallion: true }],
  flocks: [{ x: PASTURE.x, z: PASTURE.z, count: 40, dog: true, range: PASTURE.r }],
  marmots: { sites: 7, box: { x0: -160, x1: 170, z0: -30, z1: 95 } },   // the Sky Grassland's bowl
  campHorses: true,
};

/** The wild herd's mare coats, in order: a herd starts at a rolled index and walks round the list. */
export const MARE_VARIANTS = ['bay', 'chestnut', 'bay', 'dun', 'chestnut', 'grey', 'bay', 'black', 'dun', 'bay', 'chestnut', 'grey'];

export function inChunk(x: number, z: number, margin = 0): boolean { return Math.abs(x) <= 250 - margin && Math.abs(z) <= 250 - margin; }

/** a free spot near (x, z) within r: dry, in the chunk, not steep, not on top of another animal */
export function freeSpot<B extends WildBody>(s: WildPlacer<B>, x: number, z: number, r: number): [number, number] {
  for (let i = 0; i < 40; i++) {
    const a = s.rng.range(0, Math.PI * 2), d = Math.sqrt(s.rng.next()) * r;
    const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    if (!inChunk(px, pz, 15) || s.ground.normalY(px, pz) < 0.78 || s.ground.heightAt(px, pz) < s.ground.waterLevel() + 0.3 || s.ground.wetAt(px, pz)) continue;
    let clash = false;
    for (const o of s.bodies()) if (Math.abs(o.position.x - px) < 2 && Math.abs(o.position.z - pz) < 2) { clash = true; break; }
    if (!clash) return [px, pz];
  }
  return [x, z];
}

/** A wolf pack round (x, z): each variant on a free spot within 8 m, a rolled yaw; `each` files every body as it spawns. */
export function placePack<B extends WildBody>(s: WildPlacer<B>, x: number, z: number, variants: readonly string[], each: (body: B) => void): B[] {
  const members: B[] = [];
  for (const v of variants) {
    const [px, pz] = freeSpot(s, x, z, 8);
    const w = s.spawn('wolf', px, pz, s.rng.range(0, Math.PI * 2), v);
    each(w); members.push(w);
  }
  return members;
}

/** A wild herd round (x, z): the mares (11 m), each foal by its mother (3 m, then beside her), the stallion 16 m east. */
export function placeHerd<B extends WildBody>(s: WildPlacer<B>, x: number, z: number, mares: number, foals: number, stallion: boolean, each: (body: B) => void): B[] {
  const members: B[] = [];
  const add = (v: string, r: number): B => {
    const [px, pz] = freeSpot(s, x, z, r);
    const h = s.spawn('horse', px, pz, s.rng.range(0, Math.PI * 2), v);
    each(h); members.push(h);
    return h;
  };
  const start = s.rng.int(0, MARE_VARIANTS.length - 1);
  const mareList: B[] = [];
  for (let i = 0; i < mares; i++) mareList.push(add(MARE_VARIANTS[(start + i) % MARE_VARIANTS.length] ?? 'bay', 11));
  for (let i = 0; i < foals; i++) {
    const mom = mareList[i % Math.max(1, mareList.length)];
    const f = add(i % 2 === 0 ? 'foal-bay' : 'foal-chestnut', 3);
    if (mom !== undefined) s.place(f, mom.position.x + s.rng.range(-2, 2), mom.position.z + s.rng.range(-2, 2), mom.yaw);
  }
  if (stallion) { const st = add('stallion', 4); s.place(st, x + 16, z + 4, 0); }
  return members;
}

/** The flock's sheepdog: a free spot within 4 m of 14 m east of the flock, facing north. */
export function placeDog<B extends WildBody>(s: WildPlacer<B>, x: number, z: number): B {
  const [px, pz] = freeSpot(s, x + 14, z, 4);
  return s.spawn('sheepdog', px, pz, 0, 'collie');
}
