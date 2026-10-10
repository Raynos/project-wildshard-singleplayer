/**
 * Fitted creature hulls (SHARD-PLATFORM M3; ex a dune shard's generated creatures): a generated mesh (image-to-3D, painted
 * facets) fitted to its size and skinned to a species skeleton from rows, so the shard keeps only the numbers. Nothing here
 * knows a shard.
 *
 * - `quadrupedHull`: a four-legged body, rigid per facet (`bindRigid`). Facets low under the body ride the leg of their
 *   quadrant (front is +Z, left is −X; legs in the order front-left, front-right, back-left, back-right, each leg bone at
 *   the mean x / z of its quadrant's low vertices), the front share above the withers is the head, the back share the
 *   tail, the rest the body. Bones: body, head, the four legs, the tail.
 * - `bandSkin`: a flat winged body (a ray, a manta) skinned per vertex with smooth bands, so a shared corner never splits:
 *   the wings by |x|, the head forward of an edge, the tail behind one, the body the rest (bones body, head, left / right
 *   wing, tail); optionally tinted, the back by a factor and the underside toward a belly colour.
 * - `loftedBandHull`: the code stand-in for such a body: a mirrored outline lofted to a raised centre on top and a lower
 *   one beneath (a dark back over a paler belly), a thin three-sided spine tail, band-skinned the same way.
 * - `quadrupedLook`: a species look on a fitted four-legged hull: its rig contract, clips and dims as rows.
 */
import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute } from 'three';
import type { ClipName, SocketName } from '@wildshard/engine/anim/rig';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { bindRigid, fitGeometry, undrawnRig, type ModelFit } from './modelLibrary';
import { clipAnimate, type SpeciesClips } from '../species/clips';

/** One bone of a hull's skeleton (absolute bind space). */
export interface HullBone { name: string; parent: string | null; pos: [number, number, number] }

/** A four-legged hull as rows: its fit, its legs' names and stand-in tops, and the shares that split it. */
export interface QuadrupedHullRow {
  readonly fit: ModelFit;
  /** the legs, front-left, front-right, back-left, back-right: name and the stand-in top's x / z */
  readonly legs: readonly (readonly [string, number, number])[];
  /** the leg tops' height as a share of the hull's height; a facet below it rides a leg */
  readonly legTop: number;
  /** the vertices that place a leg's top: below this share of the leg top */
  readonly legFoot: number;
  /** the head: the front `share` of the length, above `above` of the height */
  readonly head: { readonly share: number; readonly above: number };
  /** the tail: the back share of the length */
  readonly tail: number;
  /** the body, head and tail bones' heights as shares of the hull's height */
  readonly boneY: { readonly body: number; readonly head: number; readonly tail: number };
  /** the stand-in: its height and skeleton when the generated mesh did not load (drawn as nothing) */
  readonly standIn: { readonly h: number; readonly bones: readonly HullBone[] };
}

/** A fitted hull: its skeleton, its skinned geometry and its height. */
export interface FittedHull { bones: HullBone[]; geometry: BufferGeometry; h: number }

/** A generated four-legged body fitted and rigidly skinned from its rows; an undrawn stand-in when `source` is null. */
export function quadrupedHull(source: BufferGeometry | null, row: QuadrupedHullRow): FittedHull {
  if (source === null) return { bones: row.standIn.bones.map((b) => ({ name: b.name, parent: b.parent, pos: [b.pos[0], b.pos[1], b.pos[2]] })), geometry: undrawnRig(), h: row.standIn.h };
  const g = fitGeometry(source, row.fit), b = g.boundingBox, p = g.getAttribute('position');
  const h = b ? b.max.y : row.standIn.h, z0 = b ? b.min.z : -row.fit.size / 2, z1 = b ? b.max.z : row.fit.size / 2, legTop = h * row.legTop;
  const head = z1 - (z1 - z0) * row.head.share, tail = z0 + (z1 - z0) * row.tail;
  const quad = (x: number, z: number): number => (z > 0 ? 0 : 2) + (x < 0 ? 0 : 1), sum = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < p.count; i++) if (p.getY(i) < legTop * row.legFoot) { const q = sum[quad(p.getX(i), p.getZ(i))]; if (q) { q[0] = (q[0] ?? 0) + p.getX(i); q[1] = (q[1] ?? 0) + p.getZ(i); q[2] = (q[2] ?? 0) + 1; } }
  const top = (q: number): [number, number, number] => {
    const s = sum[q], n = s?.[2] ?? 0, [, x, z] = row.legs[q] ?? ['', 0, 0];
    return n > 0 ? [(s?.[0] ?? 0) / n, legTop, (s?.[1] ?? 0) / n] : [x, legTop, z];
  };
  const tailBone = 2 + row.legs.length;
  bindRigid(g, (x, y, z) => y < legTop ? 2 + quad(x, z) : z > head && y > h * row.head.above ? 1 : z < tail ? tailBone : 0);
  return { geometry: g, h, bones: [{ name: 'body', parent: null, pos: [0, h * row.boneY.body, 0] }, { name: 'head', parent: 'body', pos: [0, h * row.boneY.head, head] },
    ...row.legs.map(([name], i): HullBone => ({ name, parent: 'body', pos: top(i) })),
    { name: 'tail', parent: 'body', pos: [0, h * row.boneY.tail, tail] }] };
}

/** A smooth band: 0 at `from`, 1 at `from + over` (a smoothstep). */
export interface HullBand { readonly from: number; readonly over: number }

/** A winged hull as rows: its fit, its nose, its three bands and an optional tint. */
export interface BandSkinRow {
  readonly fit: ModelFit;
  /** the nose's z after the fit (the hull is moved along z so its front lies there) */
  readonly nose: number;
  /** the wings by |x|; the tail by −z (behind −`from`); the head by z */
  readonly wing: HullBand;
  readonly tail: HullBand;
  readonly head: HullBand;
}

/** A tint for a hull's painted facets (linear): the back × `top`, the underside lerped to `belly` by `bellyMix`. */
export interface HullTint { readonly top: readonly [number, number, number]; readonly belly: readonly [number, number, number]; readonly bellyMix: number }

const smooth = (t: number): number => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };

/** A generated winged body fitted and band-skinned from its rows, tinted when `tint` is set. */
export function bandSkin(source: BufferGeometry, row: BandSkinRow, tint: HullTint | null = null): BufferGeometry {
  const g = fitGeometry(source, row.fit), b = g.boundingBox;
  if (b !== null) g.translate(0, 0, row.nose - b.max.z);
  const p = g.getAttribute('position'), n = p.count, index = new Uint16Array(n * 4), weight = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), z = p.getZ(i), wing = smooth((Math.abs(x) - row.wing.from) / row.wing.over), tail = smooth((-row.tail.from - z) / row.tail.over) * (1 - wing);
    const head = smooth((z - row.head.from) / row.head.over) * (1 - wing), body = Math.max(0, 1 - wing - tail - head);
    index.set([0, 1, x < 0 ? 2 : 3, 4], i * 4); weight.set([body, head, wing, tail], i * 4);
  }
  g.setAttribute('skinIndex', new Uint16BufferAttribute(index, 4)); g.setAttribute('skinWeight', new Float32BufferAttribute(weight, 4));
  if (tint !== null && g.hasAttribute('color')) {
    const col = g.getAttribute('color');
    if (!g.hasAttribute('normal')) g.computeVertexNormals();
    const nrm = g.getAttribute('normal');
    for (let i = 0; i < n; i++) {
      const under = smooth((-nrm.getY(i) - 0.1) / 0.5) * tint.bellyMix;
      for (let c = 0; c < 3; c++) {
        const v = (c === 0 ? col.getX(i) : c === 1 ? col.getY(i) : col.getZ(i)) * (tint.top[c] ?? 1);
        const out = v + ((tint.belly[c] ?? v) - v) * under;
        if (c === 0) col.setX(i, out); else if (c === 1) col.setY(i, out); else col.setZ(i, out);
      }
    }
    col.needsUpdate = true;
  }
  return g;
}

type V3 = readonly [number, number, number];

/** A code-built winged body as rows: the outline's right half (x / z, nose first, x 0 at both ends), mirrored. */
export interface LoftedBandHullRow {
  readonly half: readonly (readonly [number, number])[];
  /** the rim's height: `base` plus `perX` per metre out from the spine */
  readonly lift: { readonly base: number; readonly perX: number };
  /** the raised centre the top fans to, and the lower one the belly fans to */
  readonly top: V3;
  readonly bottom: V3;
  /** the back's and the belly's grey, times `tint` per channel (linear) */
  readonly shade: { readonly top: number; readonly bottom: number; readonly tint: V3 };
  /** the wing and head bands (as `BandSkinRow`'s) and the z behind which a vertex is wholly tail */
  readonly wing: HullBand;
  readonly head: HullBand;
  readonly tailBehind: number;
  /** the tail: a three-sided spine from its root's left, right and top corners to the tip */
  readonly tail: { readonly left: V3; readonly right: V3; readonly up: V3; readonly tip: V3 };
}

/** A code-built winged body lofted and band-skinned from its rows (bones body, head, left / right wing, tail). */
export function loftedBandHull(row: LoftedBandHullRow): BufferGeometry {
  const half = row.half, outline: (readonly [number, number])[] = [...half, ...half.slice(1, -1).reverse().map(([x, z]): [number, number] => [-x, z])];
  const lift = (x: number): number => row.lift.base + Math.abs(x) * row.lift.perX;
  const pos: number[] = [], col: number[] = [], idx: number[] = [], wts: number[] = [], [tr, tg, tb] = row.shade.tint;
  const push = (x: number, y: number, z: number, top: boolean): void => {
    pos.push(x, y, z); const shade = top ? row.shade.top : row.shade.bottom; col.push(shade * tr, shade * tg, shade * tb);
    const wing = smooth((Math.abs(x) - row.wing.from) / row.wing.over), tail = z < row.tailBehind ? 1 : 0, head = smooth((z - row.head.from) / row.head.over) * (1 - wing);
    const body = Math.max(0, 1 - wing - tail - head);
    idx.push(0, 1, x < 0 ? 2 : 3, 4); wts.push(body, head, tail ? 0 : wing, tail);
  };
  const tri = (a: V3, b: V3, c: V3, top: boolean): void => { push(...a, top); push(...b, top); push(...c, top); };
  for (let i = 0; i < outline.length; i++) {
    const p = outline[i], q = outline[(i + 1) % outline.length]; if (p === undefined || q === undefined) continue;
    const pa: V3 = [p[0], lift(p[0]), p[1]], qa: V3 = [q[0], lift(q[0]), q[1]];
    tri(row.top, pa, qa, true); tri(row.bottom, qa, pa, false);
  }
  const { left, right, up, tip } = row.tail;
  tri(left, up, tip, true); tri(up, right, tip, true); tri(right, left, tip, false);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(col, 3));
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(idx), 4));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(wts, 4));
  geometry.computeVertexNormals();
  return geometry;
}

/** A four-legged hull's species look as rows: its ids, rig contract and dims (`bodyY` and `legLen` as shares of the hull's height). */
export interface QuadrupedLookRow {
  readonly id: string; readonly species: string; readonly kind: string;
  readonly skeleton: string; readonly sockets: readonly SocketName[]; readonly clipNames: readonly ClipName[];
  readonly dims: { readonly bodyY: number; readonly bodyHalfLen: number; readonly bodyRadius: number; readonly headRadius: number; readonly legLen: number; readonly halfWidth: number };
}

/** A species look on a fitted four-legged hull (built fresh each time from `hull`), animated by its clip rows. */
export function quadrupedLook(row: QuadrupedLookRow, hull: () => FittedHull, clips: SpeciesClips): SpeciesLook {
  const d = row.dims;
  return { id: row.id, species: row.species, kind: row.kind, rig: 'custom', fur: NO_FUR,
    rigContract: { skeleton: row.skeleton, sockets: [...row.sockets], clips: [...row.clipNames] },
    build: () => {
      const body = hull();
      return { bones: body.bones, furParts: [], hardParts: [body.geometry], eyeParts: [],
        dims: { bodyY: body.h * d.bodyY, bodyHalfLen: d.bodyHalfLen, bodyRadius: d.bodyRadius, headRadius: d.headRadius, legLen: body.h * d.legLen, feet: [], halfWidth: d.halfWidth } };
    },
    animate: clipAnimate(clips),
  };
}
