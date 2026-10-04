/**
 * The escarpment's rock (E306 / E315 second pass; the per-rock drawing of src/shards/nalati-grasslands/outcrops.ts, verbatim):
 *
 *   granite outcrop   a weathered granite block (./../../../world/nalati/granite.ts `graniteBlock`: a rounded box pushed
 *                     about by noise) lying along the contour, tipped into the slope, lichen on its tops, a darker foot —
 *                     the escarpment's ravines and rock bands, the rim's broken band, the edge berm's crest
 *   rounded boulder   a smooth lumpy stone (`blob`): leaning on a block downhill, standing in the river's current, lying
 *                     on its banks and bars, in the meltwater stream's bed and heaped along it
 *
 * Painted into the escarpment's ONE mesh (src/shards/nalati-grasslands/outcrops.ts: a NalatiSet over its kit, in the old order: so the
 * mesh is bit-identical) and placed `drawnInto` it. A copy draws its shape from that kit's rng stream; where the old
 * builder drew a tint between the shape and its turn, the params say so (`draw`). Collides as the hull of what it
 * draws when it is big (`solid`: a block over 1.1 m, a stream boulder over 1 m).
 */
import * as THREE from 'three';
import { defineModel } from '@wildshard/engine/models/model';
import { M, type PaintOpts } from '../world/paint';
import { blob } from '@wildshard/engine/world/geometryKit';
import { graniteBlock } from '../world/granite';
import { painted, type Paint } from '../world/painted';
import { supportHull } from '../world/solid';

const C = {
  granite: new THREE.Color('#948d82'),
  warm: new THREE.Color('#a39179'),
  cool: new THREE.Color('#7f8189'),
  lichen: new THREE.Color('#b3a35a'),
  moss: new THREE.Color('#5f7433'),
  snow: new THREE.Color('#eef2f7'),
};

export type RockTint = 'granite' | 'warm' | 'cool';

export interface GraniteOutcropParams {
  /** the block: width (along the contour), height, depth; how rough its surface */
  readonly w: number;
  readonly h: number;
  readonly d: number;
  readonly rough: number;
  /** its tip into the slope (radians about its own x / z) */
  readonly pitch: number;
  readonly roll: number;
  /** its tint; absent: drawn from the stream after the block's shape (`draw`: of two, granite / warm, or of three) */
  readonly tint?: RockTint;
  readonly draw?: 2 | 3;
  /** how much lichen on its tops */
  readonly lichen: number;
  /** it collides (as the hull of what it draws) */
  readonly solid: boolean;
}

/** `at`: its centre (sunk a third into the ground), `at.yaw` along the contour */
const outcropPaint: Paint<GraniteOutcropParams> = (kit, at, p) => {
  const rng = kit.rng;
  const block = graniteBlock(p.w, p.h, p.d, rng.int(1, 1e6), p.rough), bm = M(at.x, at.y, at.z, at.yaw, 1, 1, 1, p.pitch, p.roll);
  const descs = p.solid ? [supportHull(block, bm, 'rock')] : [];
  const tint = p.tint !== undefined ? C[p.tint] : p.draw === 2 ? (rng.next() < 0.5 ? C.granite : C.warm) : rng.next() < 0.5 ? C.granite : rng.next() < 0.5 ? C.warm : C.cool;
  kit.add(block, tint, { matrix: bm, top: { color: C.lichen, threshold: 0.55, amount: p.lichen }, brush: 0.14, foot: 0.72 });
  return { descs };
};

/** where a rounded boulder lies, and how it is painted there */
export type BoulderLook = 'lean' | 'channel' | 'bank' | 'bed' | 'streambank';

const LOOK: Readonly<Record<BoulderLook, { squash: number; rough: number; opts: PaintOpts }>> = {
  lean: { squash: 0.72, rough: 0.2, opts: { top: { color: C.moss, threshold: 0.7, amount: 0.4 }, brush: 0.12, foot: 0.75 } },
  channel: { squash: 0.65, rough: 0.16, opts: { brush: 0.1, foot: 0.6 } },
  bank: { squash: 0.7, rough: 0.18, opts: { top: { color: C.moss, threshold: 0.75, amount: 0.3 }, brush: 0.1, foot: 0.7 } },
  bed: { squash: 0.62, rough: 0.2, opts: { brush: 0.1, foot: 0.55 } },
  streambank: { squash: 0.7, rough: 0.22, opts: { top: { color: C.snow, threshold: 0.75, amount: 0.25 }, brush: 0.12, foot: 0.65 } },
};

export interface RoundedBoulderParams {
  /** radius, metres */
  readonly r: number;
  readonly look: BoulderLook;
  /** its tint; absent: drawn from the stream after its shape, cool with these odds, else granite */
  readonly tint?: RockTint;
  readonly coolOdds?: number;
  readonly solid: boolean;
}

/** `at`: its centre (the placer sinks it), it takes its own turn */
const boulderPaint: Paint<RoundedBoulderParams> = (kit, at, p) => {
  const rng = kit.rng, look = LOOK[p.look];
  const stone = blob(p.r, rng, 1, look.squash, look.rough);
  const tint = p.tint !== undefined ? C[p.tint] : rng.next() < (p.coolOdds ?? 0.5) ? C.cool : C.granite;
  const sm = M(at.x, at.y, at.z, rng.range(0, 6.28));
  const descs = p.solid ? [supportHull(stone, sm, 'rock')] : [];
  kit.add(stone, tint, { ...look.opts, matrix: sm });
  return { descs };
};

const FILE = 'src/shards/nalati-grasslands/models/outcrop.ts';

export const graniteOutcrop = defineModel<GraniteOutcropParams>({
  id: 'nalati-grasslands/granite-outcrop', name: 'Granite outcrop', category: 'nature', pipeline: 'code', file: FILE, surface: 'rock',
  defaults: { w: 4.2, h: 1.6, d: 2.4, rough: 0.22, pitch: 0.12, roll: 0, tint: 'granite', lichen: 0.55, solid: true },
  variants: [
    { id: 'escarpment', label: 'Escarpment', params: {} },
    { id: 'rim', label: 'Rim band', params: { w: 5.5, h: 2.2, d: 2.8, rough: 0.24, tint: 'warm', lichen: 0.5 } },
  ],
  build: painted(outcropPaint, { seed: 0x0c7, finish: { ao: false, aoH: 0.8, aoMin: 0.6 } }),
});

export const roundedBoulder = defineModel<RoundedBoulderParams>({
  id: 'nalati-grasslands/rounded-boulder', name: 'Rounded boulder', category: 'nature', pipeline: 'code', file: FILE, surface: 'rock',
  defaults: { r: 0.9, look: 'bank', tint: 'cool', solid: false },
  variants: [
    { id: 'bank', label: 'River bank', params: {} },
    { id: 'channel', label: 'In the current', params: { look: 'channel' } },
    { id: 'lean', label: 'Leaning on a block', params: { look: 'lean', tint: 'granite', r: 0.7 } },
    { id: 'streambank', label: 'Meltwater bank', params: { look: 'streambank', r: 1.1 } },
  ],
  build: painted(boulderPaint, { seed: 0x0c8, finish: { ao: false, aoH: 0.8, aoMin: 0.6 } }),
});
