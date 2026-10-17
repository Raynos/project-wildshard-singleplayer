/**
 * The crowd (dome B, E169; E281; E306 / E315 M4): two TRELLIS.2 casts from the lab — the umbrella walker
 * (public/assets/nine-dragon/lab/walker.glb, 2.08 m to the umbrella's crown) and the mahjong sitter (sitter.glb) —
 * loaded through glb.ts and colour-ramped to the ink, each in its colourways: the coat's ramp (dark coats, beige
 * jackets), and for the walker the umbrella's dye (black, oxblood, ochre paper, dark blue; the SDK's figure crowd
 * `tintAbove` keeps its shading). Static scenery: drawn by the Jiehua program, one InstancedMesh per colourway and
 * level, the figures in view picked per frame by the crowd's culler (../world/crowd.ts `Crowd`, handed the levels by
 * `place`): full detail near, E283's meshoptimizer copies from 12 m and 22 m, a ~320-triangle clustered copy from 35 m,
 * nothing past 130 m (the silk fog has swallowed them). ../world/crowd.ts `dealCrowd` deals the figures to the colourways.
 */
import type { BufferGeometry } from 'three';
import { defineModel, type ModelContext, type ModelLod, type ModelPart, type ModelVariant } from '@wildshard/engine/models/model';
import { BLUE_UMBRELLA, type SitterPick, type WalkerPick } from '../world/crowd';
import { LOD_FAR, LOD_NEAR, LOD_TRIS, MID_FROM, MID_PX } from '../data/lod';
import { tintAbove } from '../runtime/cull/figureCrowd';
import { loadCast } from '../world/casts';
import { PX_PER_M, clusterLod, simplifiedCopy } from '../runtime/cull/meshLod';
import { type NdLook, ndLook, need } from '../world/modelLook';

const FILE = 'src/shards/nine-dragon-stack/models/crowd.ts';

/** load both casts in both ramps into the look (the fragment awaits it before placing) */
export async function loadCrowd(look: NdLook): Promise<void> {
  const [walkD, walkL, sitD, sitL] = await Promise.all([
    loadCast('walker-dark'), loadCast('walker-light'), loadCast('sitter-dark'), loadCast('sitter-light'),
  ]);
  look.geo.set('walker-dark', walkD).set('walker-light', walkL).set('sitter-dark', sitD).set('sitter-light', sitL);
}

/** a walker colourway: the ramp its coat takes and the umbrella's dye (null: the ramp's own black / beige) */
const WALKER: Readonly<Record<WalkerPick, { ramp: 'dark' | 'light'; dye: number | null }>> = {
  dark: { ramp: 'dark', dye: null }, light: { ramp: 'light', dye: null }, oxblood: { ramp: 'dark', dye: 0x9a2e1c },
  paper: { ramp: 'light', dye: 0xb07a34 }, blue: { ramp: 'dark', dye: BLUE_UMBRELLA },
};

/** a walker colourway's full geometry (the dyed ones made once per fragment) */
export function walkerGeometry(ctx: ModelContext, pick: WalkerPick): BufferGeometry {
  const w = WALKER[pick], base = need(ndLook(ctx).geo.get(`walker-${w.ramp}`), 'the walker cast');
  return w.dye === null ? base : ctx.once(`nds:walker:${pick}`, () => tintAbove(base, w.dye ?? 0));
}

export function sitterGeometry(ctx: ModelContext, pick: SitterPick): BufferGeometry {
  return need(ndLook(ctx).geo.get(`sitter-${pick}`), 'the sitter cast');
}

const figure = (ctx: ModelContext, geometry: BufferGeometry): readonly ModelPart[] => [{ geometry, material: need(ndLook(ctx).mat, 'the Jiehua program') }];

/** the levels past full detail: the middle copies (the full geometry without the simplifier: the culler leaves them
 *  out), the clustered far copy, none past LOD_FAR */
function levels<P extends object>(key: (p: P) => string, full: (ctx: ModelContext, p: P) => BufferGeometry): readonly ModelLod<P>[] {
  const mid = (d: number): ModelLod<P> => ({
    from: d,
    build: (ctx, p) => figure(ctx, ctx.once(`nds:crowd:${key(p)}:mid${d}`, () => (ndLook(ctx).canLod ? simplifiedCopy(full(ctx, p), d * PX_PER_M * MID_PX) : full(ctx, p)))),
  });
  return [
    ...MID_FROM.map(mid),
    { from: LOD_NEAR, build: (ctx, p) => figure(ctx, ctx.once(`nds:crowd:${key(p)}:far`, () => clusterLod(full(ctx, p), LOD_TRIS))) },
    { from: LOD_FAR, build: () => [] },
  ];
}

export interface WalkerParams { readonly pick: WalkerPick }
export interface SitterParams { readonly pick: SitterPick }

const walkerVariant = (pick: WalkerPick, label: string): ModelVariant<WalkerParams> => ({ id: pick, label, params: { pick } });

export const umbrellaWalker = defineModel<WalkerParams>({
  id: 'nine-dragon-stack/umbrella-walker', name: 'Umbrella walker', category: 'people', pipeline: 'trellis', file: FILE, defaults: { pick: 'dark' },
  variants: [
    walkerVariant('dark', 'Dark coat · black umbrella'), walkerVariant('light', 'Beige jacket'), walkerVariant('oxblood', 'Oxblood oil-paper umbrella'),
    walkerVariant('paper', 'Ochre oil-paper umbrella'), walkerVariant('blue', 'Dark blue umbrella'),
  ],
  build: (ctx, p) => figure(ctx, walkerGeometry(ctx, p.pick)),
  lods: levels<WalkerParams>((p) => `walker-${p.pick}`, (ctx, p) => walkerGeometry(ctx, p.pick)),
});

export const mahjongSitter = defineModel<SitterParams>({
  id: 'nine-dragon-stack/mahjong-sitter', name: 'Mahjong sitter', category: 'people', pipeline: 'trellis', file: FILE, defaults: { pick: 'dark' },
  variants: [{ id: 'dark', label: 'Dark coat', params: { pick: 'dark' } }, { id: 'light', label: 'Beige jacket', params: { pick: 'light' } }],
  build: (ctx, p) => figure(ctx, sitterGeometry(ctx, p.pick)),
  lods: levels<SitterParams>((p) => `sitter-${p.pick}`, (ctx, p) => sitterGeometry(ctx, p.pick)),
});
