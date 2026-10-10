import { clipAnimate } from '@wildshard/sdk/species/clips';
import { DUNE_RAY, RAY_CLIPS } from '../data/species/duneRay';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute } from 'three';
import { bandSkin } from '@wildshard/sdk/looks/fittedHull';
import { MANTA_HULL, RAY_TINT } from '../data/species/hulls';
import { duneMesh } from '../world/meshes';

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

/** The generated manta (data/species/hulls.ts MANTA_HULL), tinted when `tint` is given; null when its file did not load. */
export function mantaBody(tint: typeof RAY_TINT | null = null): BufferGeometry | null {
  const source = duneMesh('dune-matriarch');
  return source === null ? null : bandSkin(source, MANTA_HULL, tint);
}

export const DUNE_RAY_LOOK: SpeciesLook = { id: 'sunscar.look.duneRay', species: DUNE_RAY.id, kind: 'duneRay', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'sunscar.duneRay', sockets: ['body', 'head', 'wingL', 'wingR', 'tail'], clips: ['idle', 'fly', 'attack', 'hit', 'die'] },
  build: () => ({ bones: rayBones(), furParts: [], hardParts: [mantaBody(RAY_TINT) ?? rayGeometry()], eyeParts: [],
    dims: { bodyY: 0.3, bodyHalfLen: 1.1, bodyRadius: 0.8, headRadius: 0.4, legLen: 0, feet: [], halfWidth: 2.6 } }),
  animate: clipAnimate(RAY_CLIPS),
};
