/**
 * Models the fragment draws INTO its kits (E306 / E315 M4): the square's and the Well's merged meshes, where each copy's
 * geometry is welded into its region with the neon spill baked in and costs no draw of its own. Their builders
 * (../generators/props.ts) write a copy straight into the kit it stands in, and the world records it there (Ctx `inKit`);
 * once the kits are meshes, build.ts registers them with `place(…, { drawnInto })` on those meshes — a catalog card, the
 * copies counted, a tap on a copy picks it. Here each is built alone in its own space for the Model Explorer:
 *  - the brass dragon hook (飛爪 anchor): a bracket out from the wall along +z, a snarling head, the ring the claw bites —
 *    every grapple anchor in the fragment (the gold is reserved for them); its reach varies by wall;
 *  - the stool (a lacquered drum, the Well rim's tea tables), in its three washes;
 *  - the scooter parked by the market;
 *  - the mahjong table (the hero lab's: green felt, the four walls of tiles, a few loose ones; its players are the
 *    TRELLIS sitters, who bring their own stools);
 *  - the brush-drawn figure (the procedural people crossing the skybridges and the cable deck, living things never
 *    ruled), its coat, hair and stride drawn per copy from the kit's stream.
 */
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import { HOOK_PROFILE, STOOL_PROFILE, SCOOTER_PROFILE, FIGURE_PROFILE } from '../data/specimenProfiles';
import { ndLook, need, specimen } from '../world/modelLook';

const FILE = 'src/shards/nine-dragon-stack/models/inKit.ts';

/** one Kit built at the origin (G285: baked, ../generators/specimens.ts), as the Jiehua kit program draws it */
function kit(ctx: ModelContext, key: string): readonly ModelPart[] {
  return [{ geometry: specimen(ctx, `inkit:${key}`), material: need(ndLook(ctx).mat, 'the Jiehua program') }];
}

export interface HookParams { readonly reach: number }

export const brassDragonHook = defineModel<HookParams>({
  id: 'nine-dragon-stack/brass-dragon-hook', name: 'Brass dragon hook (grapple anchor)', category: 'props', pipeline: 'code', file: FILE, defaults: HOOK_PROFILE.defaults,
  variants: HOOK_PROFILE.variants,
  build: (ctx, p) => kit(ctx, `hook:${p.reach}`),
});

export interface WashParams { readonly wash: number }

export const drumStool = defineModel<WashParams>({
  id: 'nine-dragon-stack/stool', name: 'Drum stool', category: 'props', pipeline: 'code', file: FILE, defaults: STOOL_PROFILE.defaults,
  variants: STOOL_PROFILE.variants,
  build: (ctx, p) => kit(ctx, `stool:${p.wash}`),
});

export const parkedScooter = defineModel<WashParams>({
  id: 'nine-dragon-stack/scooter', name: 'Scooter', category: 'props', pipeline: 'code', file: FILE, defaults: SCOOTER_PROFILE.defaults,
  variants: SCOOTER_PROFILE.variants,
  build: (ctx, p) => kit(ctx, `scooter:${p.wash}`),
});

export const mahjongTableModel = defineModel({
  id: 'nine-dragon-stack/mahjong-table', name: 'Mahjong table', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => kit(ctx, 'mahjong'),
});

export interface FigureParams { readonly pose: 'stand' | 'sit' | 'cook'; readonly umbrella: boolean }

export const inkFigure = defineModel<FigureParams>({
  id: 'nine-dragon-stack/ink-figure', name: 'Brush-drawn figure (procedural)', category: 'people', pipeline: 'code', file: FILE,
  defaults: FIGURE_PROFILE.defaults,
  variants: FIGURE_PROFILE.variants,
  build: (ctx, p) => kit(ctx, `figure:${p.pose}:${String(p.umbrella)}`),
});
