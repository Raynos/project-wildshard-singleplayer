/** Frozen pre-entry trader adapter for independent geometry, gesture and collider parity. */
import type * as THREE from 'three';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { FigureRows } from '@wildshard/game/systems/npc/figureRows';
import { KitFigure } from '@wildshard/game/systems/npc/kitFigure';
import { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import { loadFixedGeometry, fixedDraw, fixedGeometryGroups, FIGURES } from './driftwoodLegacyAssets';
import { driftwoodProduct } from './driftwoodLegacyRows';

const byGroup = new WeakMap<THREE.Object3D, KitFigure>();

/** the live Trader behind a placed copy of `trader` (null: not one) */
export function traderOf(o: THREE.Object3D): KitFigure | null { return byGroup.get(o) ?? null; }

/** Preserve the live owner while the admitted model supplies its static card. */
export function enteredTrader(nativeTrader: ModelDef<Record<string, unknown>>): ModelDef<Record<string, unknown>> {
  return defineModel({
    ...nativeTrader, prepare: loadFixedGeometry, specimen: nativeTrader.build,
    build: (ctx) => {
      const geometry = new Map(Object.entries(fixedGeometryGroups().npc.trader).map(([part, slot]) => [part, fixedDraw(slot).copy()]));
      const rig = new KitFigure(ctx.sky, 'trader', FIGURES.rows('trader'), FIGURES.kit('trader'), { geometry, channels: driftwoodProduct().shardfile.clientChannels }, new SceneHandles(ctx.sky));
      byGroup.set(rig.group, rig); return rig.group;
    },
    colliders: () => FigureRows.collidersFor(FIGURES.rows('trader')),
  });
}
