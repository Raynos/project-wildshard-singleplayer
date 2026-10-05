import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { StrikeSpec } from '@wildshard/engine/ai/strikes';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute } from 'three';
import { STRINGS } from '../strings';
import { mantaBody, type MantaTint } from './manta';

/** The flight numbers (metres, m/s, seconds). */
export const RAY = { glideAlt: 14, glideSpeed: 9, circleR: 20, patrolR: 34, patrolAlt: 22, notice: 55, diveFrom: 38, diveSpeed: 15, climbAlt: 17, climbFor: 2.6, diveMax: 4.5, rest: 3 } as const;
/** One swoop: a 3-D sphere at the player's chest (ENGINE §19 "Short flyer example"). */
export const SWOOP: StrikeSpec = { id: 'sunscar.ray.swoop', shape: { kind: 'sphere', radius: 2.2 }, windup: 0.3, active: 0.4, recover: 0.5, cooldown: 2.5,
  range: 7, damage: 14, tags: ['creature.duneRay'], units: 'world', weight: () => 1 };

export const DUNE_RAY: SpeciesRow = { id: 'sunscar.creature.duneRay', kind: 'duneRay', label: STRINGS.ray, aggressive: true, lockable: true, blood: false,
  // A generous lock (sol-lock, Jake): the ray circles 10–18 m up and swoops from further out than a ground creature.
  flight: { altitude: RAY.glideAlt, above: 'ground', climbRate: 6, diveRate: 24, lockRange: 34 },
  variants: [{ id: 'dusk', label: STRINGS.ray, weight: 1, rarity: 'common', scale: [1, 1.15], hp: 70 }] };

/** Bones (absolute bind space, +Z forward): body first, then head, the two wings and the tail. */
const rayBones = (): { name: string; parent: string | null; pos: [number, number, number] }[] => [
  { name: 'body', parent: null, pos: [0, 0.3, 0] as [number, number, number] },
  { name: 'head', parent: 'body', pos: [0, 0.3, 1.2] as [number, number, number] },
  { name: 'wingL', parent: 'body', pos: [-0.9, 0.3, 0] as [number, number, number] },
  { name: 'wingR', parent: 'body', pos: [0.9, 0.3, 0] as [number, number, number] },
  { name: 'tail', parent: 'body', pos: [0, 0.3, -1.0] as [number, number, number] },
];
const smooth = (t: number): number => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };

/** A flat manta with a raised back, cephalic lobes and a long whip tail, skinned to the five bones. */
export function rayGeometry(): BufferGeometry {
  const half: [number, number][] = [[0, 1.45], [0.35, 1.78], [0.62, 1.3], [1.6, 0.62], [2.65, -0.15], [1.45, -0.6], [0.42, -1.0], [0, -1.08]];
  const outline: [number, number][] = [...half, ...half.slice(1, -1).reverse().map(([x, z]): [number, number] => [-x, z])];
  const lift = (x: number): number => 0.3 + Math.abs(x) * 0.06;
  const pos: number[] = [], col: number[] = [], idx: number[] = [], wts: number[] = [];
  const push = (x: number, y: number, z: number, top: boolean): void => {
    pos.push(x, y, z); const shade = top ? 0.07 : 0.16; col.push(shade * 1.1, shade * 0.85, shade);
    const wing = smooth((Math.abs(x) - 0.5) / 1.6), tail = z < -1.05 ? 1 : 0, head = smooth((z - 1.0) / 0.6) * (1 - wing);
    const body = Math.max(0, 1 - wing - tail - head);
    idx.push(0, 1, x < 0 ? 2 : 3, 4); wts.push(body, head, tail ? 0 : wing, tail);
  };
  const tri = (a: [number, number, number], b: [number, number, number], c: [number, number, number], top: boolean): void => {
    push(...a, top); push(...b, top); push(...c, top);
  };
  const topC: [number, number, number] = [0, 0.58, 0.15], botC: [number, number, number] = [0, 0.12, 0.15];
  for (let i = 0; i < outline.length; i++) {
    const p = outline[i], q = outline[(i + 1) % outline.length]; if (p === undefined || q === undefined) continue;
    const pa: [number, number, number] = [p[0], lift(p[0]), p[1]], qa: [number, number, number] = [q[0], lift(q[0]), q[1]];
    tri(topC, pa, qa, true); tri(botC, qa, pa, false);
  }
  // The tail: a thin three-sided spine, 2.2 m behind the body.
  const t0: [number, number, number] = [-0.07, 0.3, -1.0], t1: [number, number, number] = [0.07, 0.3, -1.0], t2: [number, number, number] = [0, 0.4, -1.0], tip: [number, number, number] = [0, 0.32, -3.2];
  tri(t0, t2, tip, true); tri(t2, t1, tip, true); tri(t1, t0, tip, false);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(col, 3));
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(idx), 4));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(wts, 4));
  geometry.computeVertexNormals();
  return geometry;
}

/** The ray's hide on the Matriarch's generated body (round 1): a lighter sand-brown back, a pale bone belly. */
const RAY_TINT: MantaTint = { top: [0.62, 0.52, 0.5], belly: [0.42, 0.3, 0.24], bellyMix: 0.7 }; // council round 2: a dark silhouette, not a pale card

export const DUNE_RAY_LOOK: SpeciesLook = { id: 'sunscar.look.duneRay', species: DUNE_RAY.id, kind: 'duneRay', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'sunscar.duneRay', sockets: ['body', 'head', 'wingL', 'wingR', 'tail'], clips: ['idle', 'fly', 'attack', 'hit', 'die'] },
  build: () => ({ bones: rayBones(), furParts: [], hardParts: [mantaBody(RAY_TINT) ?? rayGeometry()], eyeParts: [],
    dims: { bodyY: 0.3, bodyHalfLen: 1.1, bodyRadius: 0.8, headRadius: 0.4, legLen: 0, feet: [], halfWidth: 2.6 } }),
  animate: ({ bones, t, alive }) => {
    const flap = alive ? Math.sin(t * 2.4) * 0.32 : -0.5;
    const left = bones['wingL'], right = bones['wingR'], tail = bones['tail'];
    if (left) left.rotation.z = -flap; if (right) right.rotation.z = flap;
    if (tail) tail.rotation.y = alive ? Math.sin(t * 1.7) * 0.25 : 0;
  },
};
