import { boxDesc, type ColliderDesc, type Interactable } from '#engine';
import type { ShardContext } from '#game';
import { Vector3 } from 'three';
import { TOWER } from '../layout';
import { STRINGS } from '../strings';
import { buildTower, STAIR, type TowerModel } from './tower';
import { ownPrimitives } from './resources';

export interface BuiltWorld { tower: TowerModel; brazier: Interactable; firePoint: Vector3; light: () => void; lit: () => boolean }

/** The signal tower as one registry piece (it draws, collides, shows on the map and in Explore), plus the brazier interactable. */
export function buildWorld(ctx: ShardContext, onLight: () => void): BuiltWorld {
  const ground = (x: number, z: number): number => ctx.manifest.ground.terrain?.heightAt(x, z) ?? 0;
  const y0 = ground(TOWER.x, TOWER.z), top = TOWER.half * 0.72, stairZ = TOWER.z + top + 0.3;
  // The stair foot lands on the dune below the south face: size the flight to the real drop.
  let drop = 0;
  for (let i = 0; i < 3; i++) { const steps = Math.ceil((TOWER.deck + drop) / STAIR.rise); drop = Math.max(-TOWER.deck + 1, y0 - ground(TOWER.x, stairZ + steps * STAIR.run)); }
  const tower = buildTower(TOWER.deck, TOWER.half, drop);
  tower.group.position.set(TOWER.x, y0, TOWER.z); ctx.root.add(tower.group);
  const deckY = y0 + TOWER.deck, footZ = stairZ + tower.stairSteps * STAIR.run;
  const colliders: ColliderDesc[] = [
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => boxDesc({ x: TOWER.x + sx * (TOWER.half + top) / 2, z: TOWER.z + sz * (TOWER.half + top) / 2, hw: 0.14, hd: 0.14, rot: 0, yBottom: y0 - 1, yTop: deckY }, 'wood'))),
    boxDesc({ x: TOWER.x, z: TOWER.z, hw: top + 0.3, hd: top + 0.3, rot: 0, yBottom: deckY - 0.18, yTop: deckY }, 'wood'),
    boxDesc({ x: TOWER.x - top - 0.3, z: TOWER.z, hw: 0.05, hd: top + 0.3, rot: 0, yBottom: deckY, yTop: deckY + 1.05 }, 'wood'),
    boxDesc({ x: TOWER.x + top + 0.3, z: TOWER.z, hw: 0.05, hd: top + 0.3, rot: 0, yBottom: deckY, yTop: deckY + 1.05 }, 'wood'),
    boxDesc({ x: TOWER.x, z: TOWER.z - top - 0.3, hw: top + 0.3, hd: 0.05, rot: 0, yBottom: deckY, yTop: deckY + 1.05 }, 'wood'),
    { kind: 'treads', from: { x: TOWER.x, y: y0 - drop, z: footZ }, to: { x: TOWER.x, y: deckY, z: stairZ }, width: STAIR.width, count: tower.stairSteps, surface: 'wood' },
  ];
  ctx.piece({ id: 'sunscar.tower', name: STRINGS.tower, category: 'buildings', file: 'src/shards/sunscar-dunes/world/tower.ts', object: tower.group, colliders, surface: 'wood' });
  ownPrimitives(tower.group, ctx.scope);
  let lit = false;
  const firePoint = new Vector3(TOWER.x, deckY + 1, TOWER.z - 0.6);
  const brazier: Interactable = { label: STRINGS.light, position: firePoint, radius: 3, onInteract: () => undefined };
  const light = (): void => { if (lit) return; lit = true; tower.fire.visible = true; tower.light.intensity = 120; brazier.label = STRINGS.lit; };
  brazier.onInteract = () => { if (lit) return; light(); onLight(); };
  return { tower, brazier, firePoint, light, lit: () => lit };
}
