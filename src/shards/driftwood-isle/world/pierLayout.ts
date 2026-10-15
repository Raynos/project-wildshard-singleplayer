import type { PierParams } from '../assets/contracts/pier';

interface Collider { x:number;z:number;hw:number;hd:number;rot:number;yTop:number;yBottom:number }

/** the deck's top at `along` metres from the sea end, own y: flat, then the landing's step-down onto the sand */
export function pierDeckAt(p: PierParams, along: number): number {
  const rampFrom = p.landing?.rampFrom ?? p.length, landY = p.landing?.landY ?? 0;
  if (p.seaRamp !== undefined && along < p.seaRamp.run) return p.seaRamp.landY * (1 - Math.max(0, along) / p.seaRamp.run);
  if (along <= rampFrom) return 0;
  const t = Math.min(1, (along - rampFrom) / Math.max(0.1, p.length - rampFrom));
  return landY * t;
}

/** the deck's half width at `along` metres from the sea end: half the deck, or on a flared sea ramp (SF72) narrowing
 *  straight from half the flare at the sea end to half the deck at the ramp's top */
export function pierHalfWidthAt(p: PierParams, along: number): number {
  const sea = p.seaRamp, half = p.width / 2;
  if (sea === undefined || along >= sea.run) return half;
  const t = Math.max(0, along) / sea.run;
  return sea.flare / 2 + (half - sea.flare / 2) * t;
}

/** where the pilings, the bollards and the landing posts stand, own space ([along, across]; −X side first at each station) */
export function pierPosts(p: PierParams): { posts: [number, number][]; bollards: [number, number][] } {
  const posts: [number, number][] = [], bollards: [number, number][] = [];
  const rampFrom = p.landing?.rampFrom ?? p.length;
  for (let a = 1.2; a < rampFrom; a += 3.0) for (const s of [-1, 1]) posts.push([a, s * (pierHalfWidthAt(p, a) + 0.1)]);
  for (const s of [-1, 1]) bollards.push([0.35, s * (pierHalfWidthAt(p, 0.35) + 0.25)]);
  return { posts, bollards };
}

/** the posts' and bollards' legacy boxes, own space (the ocean's foam rings and the melee sweep; `pierColliders` carries them) */
export function pierBoxes(p: PierParams): Collider[] {
  const out: Collider[] = [];
  const postR = 0.17, postTop = 0.95;
  const rampFrom = p.landing?.rampFrom ?? p.length;
  for (let a = 1.2; a < rampFrom; a += 3.0) for (const s of [-1, 1]) out.push({ x: s * (pierHalfWidthAt(p, a) + 0.1), z: a, hw: postR + 0.04, hd: postR + 0.04, rot: 0, yTop: postTop, yBottom: -1 });
  for (const s of [-1, 1]) out.push({ x: s * (pierHalfWidthAt(p, 0.35) + 0.25), z: 0.35, hw: 0.32, hd: 0.32, rot: 0, yTop: 1.35, yBottom: -1 });
  if (p.landing) {
    const [gl, gr] = p.landing.postGround;
    for (const s of [-1, 1]) {
      const gy = s < 0 ? gl : gr, top = gy + 1.5;
      out.push({ x: s * (p.width / 2 + 0.3), z: p.length - 0.4, hw: 0.34, hd: 0.34, rot: 0, yTop: top, yBottom: gy - 1 });
    }
  }
  return out;
}

