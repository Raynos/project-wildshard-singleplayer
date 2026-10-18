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
import type { SitterPick, WalkerPick } from '../world/crowd';
import { LOD_FAR, LOD_NEAR, MID_FROM } from '../data/lod';
import { loadCast, loadCastLods } from '../world/casts';
import { type NdLook, ndLook, need } from '../world/modelLook';

const FILE = 'src/shards/nine-dragon-stack/models/crowd.ts';

/** load both casts in both ramps into the look (the fragment awaits it before placing) */
export async function loadCrowd(look: NdLook): Promise<void> {
  const names = ['walker-dark', 'walker-light', 'walker-oxblood', 'walker-paper', 'walker-blue', 'sitter-dark', 'sitter-light'] as const;
  await Promise.all(names.map(async key => {
    const base = await loadCast(key);
    look.geo.set(key, base);
    await loadCastLods(look.geo, key, base, [...MID_FROM, 'far']);
  }));
}

/** Every colourway keeps its own shared full/middle-level vertex buffers. */
export function walkerGeometry(ctx: ModelContext, pick: WalkerPick): BufferGeometry {
  return need(ndLook(ctx).geo.get(`walker-${pick}`), 'the walker cast');
}

export function sitterGeometry(ctx: ModelContext, pick: SitterPick): BufferGeometry {
  return need(ndLook(ctx).geo.get(`sitter-${pick}`), 'the sitter cast');
}

const figure = (ctx: ModelContext, geometry: BufferGeometry): readonly ModelPart[] => [{ geometry, material: need(ndLook(ctx).mat, 'the Jiehua program') }];

/** the levels past full detail: the middle copies (the full geometry without the simplifier: the culler leaves them
 *  out), the clustered far copy, none past LOD_FAR */
function levels<P extends object>(key: (p: P) => string): readonly ModelLod<P>[] {
  const mid = (d: number): ModelLod<P> => ({
    from: d,
    build: (ctx, p) => figure(ctx, need(ndLook(ctx).geo.get(`${key(p)}:mid${d}`), 'the prepared crowd LOD')),
  });
  return [
    ...MID_FROM.map(mid),
    { from: LOD_NEAR, build: (ctx, p) => figure(ctx, need(ndLook(ctx).geo.get(`${key(p)}:far`), 'the prepared far crowd')) },
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
  lods: levels<WalkerParams>((p) => `walker-${p.pick}`),
});

export const mahjongSitter = defineModel<SitterParams>({
  id: 'nine-dragon-stack/mahjong-sitter', name: 'Mahjong sitter', category: 'people', pipeline: 'trellis', file: FILE, defaults: { pick: 'dark' },
  variants: [{ id: 'dark', label: 'Dark coat', params: { pick: 'dark' } }, { id: 'light', label: 'Beige jacket', params: { pick: 'light' } }],
  build: (ctx, p) => figure(ctx, sitterGeometry(ctx, p.pick)),
  lods: levels<SitterParams>((p) => `sitter-${p.pick}`),
});
