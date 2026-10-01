import { boxDesc, type ColliderDesc, type Interactable } from '#engine';
import type { ShardContext } from '#game';
import { Vector3 } from 'three';
import { TOWER } from '../layout';
import { STRINGS } from '../strings';
import { ownPrimitives } from './resources';
import { buildTower, flicker, TOWER_SIZE, type TowerParts } from './tower';

const FILE = 'src/shards/sunscar-dunes/world/tower.ts';

export interface BuiltWorld { tower: TowerParts; beacon: Interactable; beaconAt: Vector3; light: () => void }

/** The signal tower on the far crest: one registry piece with its posts, deck, rail and stair as colliders. */
export function buildWorld(ctx: ShardContext, onLight: () => void): BuiltWorld {
  const heightAt = (x: number, z: number): number => ctx.manifest.ground.terrain?.heightAt(x, z) ?? 0;
  const y = heightAt(TOWER.x, TOWER.z), { deck, half, legs, stairRun, stairWidth } = TOWER_SIZE;
  // the stair's foot is where the falling crest meets it: settle the drop and the tread count together
  let footDrop = 0;
  for (let i = 0; i < 4; i++) footDrop = Math.max(0, y - heightAt(TOWER.x + 0.6, TOWER.z + half + stairRun * Math.ceil((deck + footDrop) / TOWER_SIZE.stairRise)));
  const tower = buildTower(footDrop); tower.root.position.set(TOWER.x, y, TOWER.z);
  const colliders: ColliderDesc[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) colliders.push(boxDesc({ x: TOWER.x + sx * legs, z: TOWER.z + sz * legs, hw: 0.14, hd: 0.14, rot: 0, yBottom: y - 1.5, yTop: y + deck + 1.1 }, 'wood'));
  colliders.push(boxDesc({ x: TOWER.x, z: TOWER.z, hw: half, hd: half, rot: 0, yBottom: y + deck - 0.25, yTop: y + deck }, 'wood'));
  for (const [x, z, hw, hd] of [[0, -half, half, 0.06], [-half, 0, 0.06, half], [half, 0, 0.06, half]] as const) {
    colliders.push(boxDesc({ x: TOWER.x + x, z: TOWER.z + z, hw, hd, rot: 0, yBottom: y + deck, yTop: y + deck + 1.05 }, 'wood'));
  }
  colliders.push({ kind: 'treads', from: { x: TOWER.x + 0.6, y: y - footDrop, z: TOWER.z + half + stairRun * tower.stairCount },
    to: { x: TOWER.x + 0.6, y: y + deck, z: TOWER.z + half }, width: stairWidth, count: tower.stairCount, surface: 'wood' });
  ctx.root.add(tower.root);
  ctx.piece({ id: 'sunscar.tower', name: STRINGS.tower, category: 'buildings', file: FILE, object: tower.root, colliders, surface: 'wood' });
  ownPrimitives(tower.root, ctx.scope);
  const beaconAt = new Vector3(TOWER.x, y + deck + 1, TOWER.z);
  let lit = false;
  const beacon: Interactable = { label: STRINGS.fire, position: beaconAt, radius: 3, onInteract: () => undefined };
  const light = (): void => {
    if (lit) return; lit = true; tower.fire.visible = true; beacon.label = STRINGS.lit; onLight();
  };
  beacon.onInteract = light;
  ctx.system({ id: 'sunscar.fire', phase: 'update', run: (_dt, t) => { if (lit) flicker(tower, t); } });
  return { tower, beacon, beaconAt, light };
}
