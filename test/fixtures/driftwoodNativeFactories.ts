/** Original pre-G2a factories, frozen for native geometry/pose/material parity. */
import { FigureRows } from '@wildshard/game/systems/npc/figureRows';
import { KitFigure } from '@wildshard/game/systems/npc/kitFigure';
import { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import { driftwoodRows, driftwoodProduct } from '../../src/shards/driftwood-isle/runtime/boot/rows';
import type * as THREE from 'three';
import { type ModelDef, type ModelPart } from '@wildshard/engine/models/model';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { loadFixedGeometry, fixedDraw, fixedGeometryGroups, FIGURES } from '../../src/shards/driftwood-isle/runtime/boot/blobAssets';

const originalModel = <P extends object>(row: ModelDef<P>): ModelDef<P> => row;

/** Both cosmetics keep their baked geometry, ordinary kit material and native socket space. */
const GARMENTS = {
  'captain-hat': { name: "Captain's hat", geometry: fixedDraw('hat'), yaw: 0 },
  'sailcloth-cape': { name: 'Sailcloth cape', geometry: fixedDraw('cape'), yaw: Math.PI },
} as const;
type Garment = keyof typeof GARMENTS;

export interface CaptainHatParams { readonly size: number }
export type SailclothCapeParams = CaptainHatParams;

function garment(id: Garment) {
  const row = GARMENTS[id];
  return originalModel<CaptainHatParams>({
    id: `driftwood-isle/${id}`, name: row.name, category: 'gear', pipeline: 'code',
    file: 'src/shards/driftwood-isle/runtime/models/captainHat.ts', surface: 'felt',
    prepare: loadFixedGeometry, defaults: { size: 1 }, specimenYaw: row.yaw,
    build: (ctx, p): readonly ModelPart[] => [{
      geometry: ctx.once(`${id}:${p.size}`, () => (p.size === 1 ? row.geometry.copy() : row.geometry.copy().scale(p.size, p.size, p.size))),
      material: lowPolyLookMaterial(ctx.sky), castShadow: true, receiveShadow: true,
    }],
  });
}
export const captainHat = garment('captain-hat'), sailclothCape = garment('sailcloth-cape');

const byGroup = new WeakMap<THREE.Object3D, KitFigure>();
export function traderOf(object: THREE.Object3D): KitFigure | null { return byGroup.get(object) ?? null; }

export const trader: ModelDef<object> = originalModel<object>({
  id: 'driftwood-isle/trader', name: 'The trader', category: 'people', pipeline: 'code', file: 'src/shards/driftwood-isle/runtime/models/trader.ts', surface: 'flesh',
  prepare: loadFixedGeometry, defaults: {},
  build: (ctx) => {
    const geometry = new Map(Object.entries(fixedGeometryGroups().npc.trader).map(([part, slot]) => [part, fixedDraw(slot).copy()]));
    const rig = new KitFigure(ctx.sky, 'trader', FIGURES.rows('trader'), FIGURES.kit('trader'), { geometry, channels: driftwoodProduct().shardfile.clientChannels }, new SceneHandles(ctx.sky));
    byGroup.set(rig.group, rig); return rig.group;
  },
  colliders: () => FigureRows.collidersFor(FIGURES.rows('trader')),
});

export const tradeCounter: ModelDef<object> = originalModel<object>({
  id: 'driftwood-isle/trade-counter', name: 'The trader\'s counter', category: 'props', pipeline: 'code', file: 'src/shards/driftwood-isle/runtime/models/trader.ts', surface: 'wood',
  prepare: loadFixedGeometry, defaults: {},
  build: (ctx): readonly ModelPart[] => [{ geometry: fixedDraw('tradeCounter').copy(), material: lowPolyLookMaterial(ctx.sky, 'still'), castShadow: true, receiveShadow: true }],
  colliders: () => [{ kind: 'box', x: 0, y: driftwoodRows('custom/fixedLayouts').nativeView.COUNTER_TOP.y / 2, z: 0, hx: driftwoodRows('custom/fixedLayouts').nativeView.COUNTER_TOP.w / 2, hy: driftwoodRows('custom/fixedLayouts').nativeView.COUNTER_TOP.y / 2, hz: driftwoodRows('custom/fixedLayouts').nativeView.COUNTER_TOP.d / 2 + 0.02 }],
});
