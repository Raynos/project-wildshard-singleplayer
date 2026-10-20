import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
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
import { defineModel, type ModelContext, type ModelLod, type ModelPart } from '@wildshard/engine/models/model';
import { lod as lodRows, specimens } from '../boot/metadata.generated.json' with { type: 'json' };
import { loadCast, loadCastLods } from '../world/casts';
import { type NdLook, ndLook, need } from '../world/modelLook';


const rows = specimens.crowd;
const FILE = 'src/shards/nine-dragon-stack/models/crowd.ts';

/** load both casts in both ramps into the look (the fragment awaits it before placing) */
export async function loadCrowd(look: NdLook): Promise<void> {
  const names = Object.entries(rows).flatMap(([key, row]) => row.variants.map(variant => `${key}-${variant.id}`));
  await Promise.all(names.map(async key => {
    const base = await loadCast(key);
    look.geo.set(key, base);
    await loadCastLods(look.geo, key, base, [...lodRows.MID_FROM, 'far']);
  }));
}

const figure = (ctx: ModelContext, geometry: BufferGeometry): readonly ModelPart[] => [{ geometry, material: lowPolyLookMaterial(ctx.sky, 'nine-architecture') }];

/** the levels past full detail: the middle copies (the full geometry without the simplifier: the culler leaves them
 *  out), the clustered far copy, none past lodRows.LOD_FAR */
function levels(key: string): readonly ModelLod<FigureParams>[] {
  const mid = (d: number): ModelLod<FigureParams> => ({
    from: d,
    build: (ctx, p) => figure(ctx, need(ndLook(ctx).geo.get(`${key}-${p.pick}:mid${d}`), 'the prepared crowd LOD')),
  });
  return [
    ...lodRows.MID_FROM.map(mid),
    { from: lodRows.LOD_NEAR, build: (ctx, p) => figure(ctx, need(ndLook(ctx).geo.get(`${key}-${p.pick}:far`), 'the prepared far crowd')) },
    { from: lodRows.LOD_FAR, build: () => [] },
  ];
}

interface FigureParams { readonly pick: string }

const model = (key: keyof typeof rows) => defineModel<FigureParams>({
  ...rows[key], category: 'people', pipeline: 'trellis', file: FILE,
  build: (ctx, p) => figure(ctx, need(ndLook(ctx).geo.get(`${key}-${p.pick}`), 'the figure cast')),
  lods: levels(key),
});

export const umbrellaWalker = model('walker');
export const mahjongSitter = model('sitter');
