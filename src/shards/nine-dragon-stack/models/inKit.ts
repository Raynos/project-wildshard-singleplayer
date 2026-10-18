/** Brush-drawn figures retain their native per-pose specimen view. */
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import profiles from '../data/specimenProfiles.json' with { type: 'json' };
import { ndLook, need, specimen } from '../world/modelLook';

const FILE = 'src/shards/nine-dragon-stack/models/inKit.ts';

/** one Kit built at the origin (G285: baked, ../generators/specimens.ts), as the Jiehua kit program draws it */
function kit(ctx: ModelContext, key: string): readonly ModelPart[] {
  return [{ geometry: specimen(ctx, `inkit:${key}`), material: need(ndLook(ctx).mat, 'the Jiehua program') }];
}

export interface FigureParams { readonly pose: 'stand' | 'sit' | 'cook'; readonly umbrella: boolean }

export const inkFigure = defineModel<FigureParams>({
  id: 'nine-dragon-stack/ink-figure', name: 'Brush-drawn figure (procedural)', category: 'people', pipeline: 'code', file: FILE,
  defaults: profiles.FIGURE_PROFILE.defaults,
  variants: profiles.FIGURE_PROFILE.variants,
  build: (ctx, p) => kit(ctx, `figure:${p.pose}:${String(p.umbrella)}`),
});
