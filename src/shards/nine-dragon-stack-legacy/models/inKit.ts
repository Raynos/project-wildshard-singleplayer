/**
 * Models the fragment draws INTO its kits (E306 / E315 M4): the square's and the Well's merged meshes, where each copy's
 * geometry is welded into its region with the neon spill baked in and costs no draw of its own. Their builders
 * (../world/props.ts) write a copy straight into the kit it stands in, and the world records it there (Ctx `inKit`);
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
import { Vector3 } from 'three';
import { Kit } from '../world/kit';
import { type HookSink, dragonHook, person, scooter, stool } from '../world/props';
import { mahjongTable } from '../world/square';
import { Rng } from '@wildshard/engine/core/rng';
import { defineModel, type ModelContext, type ModelPart, type ModelVariant } from '@wildshard/engine/models/model';
import { ndLook, need } from '../world/modelLook';

const FILE = 'src/shards/nine-dragon-stack/models/inKit.ts';

/** one Kit built at the origin, as the Jiehua kit program draws it */
function kit(ctx: ModelContext, key: string, draw: (k: Kit) => void): readonly ModelPart[] {
  const geometry = ctx.once(`nds:inkit:${key}`, () => { const k = new Kit(); draw(k); return k.build(); });
  return [{ geometry, material: need(ndLook(ctx).mat, 'the Jiehua program') }];
}

export interface HookParams { readonly reach: number }
const REACHES = [0.6, 0.7, 0.8, 0.9, 1.0, 1.3] as const;

export const brassDragonHook = defineModel<HookParams>({
  id: 'nine-dragon-stack/brass-dragon-hook', name: 'Brass dragon hook (grapple anchor)', category: 'props', pipeline: 'code', file: FILE, defaults: { reach: 0.9 },
  variants: REACHES.map((reach): ModelVariant<HookParams> => ({ id: `reach-${reach}`, label: `Reach ${reach} m`, params: { reach } })),
  build: (ctx, p) => kit(ctx, `hook:${p.reach}`, (k) => {
    const sink: HookSink = { hooks: [], hookMounts: [], inKit: [] };
    dragonHook(k, sink, new Vector3(0, 0, 0), new Vector3(0, 0, 1), p.reach);
  }),
});

export interface WashParams { readonly wash: number }
const wash = (hex: number, label: string): ModelVariant<WashParams> => ({ id: hex.toString(16), label, params: { wash: hex } });

export const drumStool = defineModel<WashParams>({
  id: 'nine-dragon-stack/stool', name: 'Drum stool', category: 'props', pipeline: 'code', file: FILE, defaults: { wash: 0xc23b22 },
  variants: [wash(0xc23b22, 'Cinnabar'), wash(0x2e5fa3, 'Azurite'), wash(0x3e5a4a, 'Malachite')],
  build: (ctx, p) => kit(ctx, `stool:${p.wash}`, (k) => { stool(k, 0, 0, 0, p.wash); }),
});

export const parkedScooter = defineModel<WashParams>({
  id: 'nine-dragon-stack/scooter', name: 'Scooter', category: 'props', pipeline: 'code', file: FILE, defaults: { wash: 0xb8321f },
  variants: [wash(0xb8321f, 'Red'), wash(0x2e5fa3, 'Blue'), wash(0x7fbf9a, 'Mint')],
  build: (ctx, p) => kit(ctx, `scooter:${p.wash}`, (k) => { scooter(k, 0, 0, 0, 0, p.wash); }),
});

export const mahjongTableModel = defineModel({
  id: 'nine-dragon-stack/mahjong-table', name: 'Mahjong table', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => kit(ctx, 'mahjong', (k) => { mahjongTable(k, new Rng(5), 0, 0, 0, 0); }),
});

export interface FigureParams { readonly pose: 'stand' | 'sit' | 'cook'; readonly umbrella: boolean }

export const inkFigure = defineModel<FigureParams>({
  id: 'nine-dragon-stack/ink-figure', name: 'Brush-drawn figure (procedural)', category: 'people', pipeline: 'code', file: FILE,
  defaults: { pose: 'stand', umbrella: false },
  variants: [
    { id: 'stand', label: 'Standing', params: {} }, { id: 'umbrella', label: 'With an umbrella', params: { umbrella: true } },
    { id: 'sit', label: 'Seated', params: { pose: 'sit' } }, { id: 'cook', label: 'Cooking', params: { pose: 'cook' } },
  ],
  build: (ctx, p) => kit(ctx, `figure:${p.pose}:${String(p.umbrella)}`, (k) => { person(k, new Rng(11), 0, 0, 0, 0, p.pose, p.umbrella); }),
});
