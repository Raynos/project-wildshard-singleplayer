/**
 * The red paper lantern (the neon lab's, round 14; E306 / E315 M4): ~2,500 of them hang over the square, the stair and
 * the Well — body, lacquer caps and tassel in one lathe told apart by `aPart`, drawn by its own program (the paper glows
 * through to the candle, 16 bamboo ribs, a slow sway; ../look/lanterns.ts). Its pivot is its hook (the lantern's top).
 * Three levels, bucketed per lantern each frame by ../look/lanterns.ts `Lanterns` (handed them by `place`): an 8 × 6
 * lathe with caps and tassel near, a 6 × 4 body alone from LOD_NEAR, a 2 × 6 dot from LOD_DOT (E283).
 */
import type { BufferGeometry } from 'three';
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import { LOD_DOT, LOD_NEAR, lanternGeometry } from '../look/lanterns';
import { ndLook, need } from '../world/modelLook';

const FILE = 'src/shards/nine-dragon-stack/models/paperLantern.ts';

const parts = (ctx: ModelContext, geometry: BufferGeometry): readonly ModelPart[] => [{ geometry, material: need(ndLook(ctx).lantern, 'the lantern program') }];

export const paperLantern = defineModel({
  id: 'nine-dragon-stack/paper-lantern', name: 'Red paper lantern', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => parts(ctx, ctx.once('nds:lantern:near', () => lanternGeometry(6, 8, true))),
  lods: [
    { from: LOD_NEAR, build: (ctx) => parts(ctx, ctx.once('nds:lantern:far', () => lanternGeometry(4, 6, false))) },
    { from: LOD_DOT, build: (ctx) => parts(ctx, ctx.once('nds:lantern:dot', () => lanternGeometry(2, 6, false))) },
  ],
});
