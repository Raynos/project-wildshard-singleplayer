import { boxDesc, type ColliderDesc, type Interactable } from '#engine';
import type { ShardContext } from '#game';
import { Vector3, type PointLight, type Group } from 'three';
import { DECK, TOWER } from '../layout';
import { STRINGS } from '../strings';
import { ownPrimitives } from './resources';
import { buildTower, BRAZIER, LEG, STAIR } from './tower';

export interface BuiltWorld { fire: Group; light: PointLight; brazier: Vector3; base: Vector3; interact: Interactable }
const FILE = 'src/shards/sunscar-dunes/world/build.ts';

/** The signal tower on the far crest, registered as one piece: legs, deck, rails and a tread stair collide. */
export function buildWorld(ctx: ShardContext, onLight: () => void): BuiltWorld {
  const y = ctx.manifest.ground.terrain?.heightAt(TOWER.x, TOWER.z) ?? 0, h = DECK.height;
  const { tower, fire, light } = buildTower(); tower.position.set(TOWER.x, y, TOWER.z); ctx.root.add(tower);
  const at = (x: number, z: number): { x: number; z: number } => ({ x: TOWER.x + x, z: TOWER.z + z });
  const colliders: ColliderDesc[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) colliders.push(boxDesc({ ...at(sx * (LEG + 0.12), sz * (LEG + 0.12)), hw: 0.14, hd: 0.14, rot: 0, yBottom: y, yTop: y + h }, 'wood'));
  colliders.push(boxDesc({ ...at(0, 0), hw: DECK.half, hd: DECK.half, rot: 0, yBottom: y + h - 0.16, yTop: y + h }, 'wood'));
  for (const [x, z, hw, hd] of [[0, DECK.half, DECK.half, 0.05], [DECK.half, 0, 0.05, DECK.half], [-DECK.half, 0, 0.05, DECK.half],
    [-(DECK.half + 0.45 * DECK.half) / 2, -DECK.half, (DECK.half - 0.45 * DECK.half) / 2, 0.05], [(DECK.half + 0.45 * DECK.half) / 2, -DECK.half, (DECK.half - 0.45 * DECK.half) / 2, 0.05]] as const) {
    colliders.push(boxDesc({ ...at(x, z), hw, hd, rot: 0, yBottom: y + h, yTop: y + h + 1.05 }, 'wood'));
  }
  colliders.push({ kind: 'treads', from: { x: TOWER.x + STAIR.x, y, z: TOWER.z + STAIR.z0 }, to: { x: TOWER.x + STAIR.x, y: y + h, z: TOWER.z + STAIR.z1 },
    width: DECK.stairWidth, count: STAIR.steps, surface: 'wood' });
  ctx.piece({ id: 'sunscar.tower', name: STRINGS.tower, category: 'buildings', file: FILE, object: tower, colliders, surface: 'wood' });
  const brazier = new Vector3(TOWER.x + BRAZIER[0], y + BRAZIER[1] + 0.4, TOWER.z + BRAZIER[2]);
  const interact: Interactable = { label: STRINGS.light, position: brazier, radius: 2.6, onInteract: onLight };
  ownPrimitives(ctx.root, ctx.scope);
  return { fire, light, brazier, base: new Vector3(TOWER.x, y, TOWER.z), interact };
}
