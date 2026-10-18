import { plumbingKnob } from '@wildshard/game/shard/declaredPlumbing';
import { slugRuntimeProduct } from '@wildshard/game/shardfile/runtimeProduct';
/** Living cabin nodes over the admitted bake. Static shells and specimen trees
 * are restored by world/scenes; this adapter lends only live geometry handles. */
import type * as THREE from 'three';
import { buildTier, TIER_CONFIG } from '@wildshard/engine/core/tier';
import { BakedBuildingAssembly } from '@wildshard/game/shardfile/buildingAssembly';
import type { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import type { BakedBuildingLook, BakedBuildingRole, BuildingAssemblyRows } from '@wildshard/format/buildings';
import rows from '../../data/cabins.json' with { type: 'json' };
import type { BakedBuilding } from '../productSections.generated.d.ts';
import type { Mats } from './homestead';

/** Unchanged native owner rows, validated by the generator. */
export const CABIN_ROWS = rows;

/** the hamlet's roofs for the map: each building's footprint (+1 m of eave), turned with it */
export function hamletRoofs(): { x: number; z: number; rot: number; w: number; d: number }[] {
  return CABIN_ROWS.buildings.filter((b) => b.hamlet).map((b) => ({ x: b.at[0], z: b.at[2], rot: b.rot, w: b.size[1] + 1, d: b.size[0] + 1 }));
}

/** The existing living-building owner retains animated nodes and door physics. */
export type BuildingRole = BakedBuildingRole;
export type LogBuilding = BakedBuildingAssembly<string, 'flame' | 'ember' | 'smoke'>;
export function createLogBuilding(resources: SceneHandles, b: BakedBuilding, mats: Mats,
  models: { firePit: THREE.Object3D; lantern: THREE.Object3D }, role: BuildingRole, look: BakedBuildingLook): LogBuilding {
  const ordinals = new Set(b.nodes.flatMap(node => node.t === 'door' ? [node.leaf, node.iron, node.batten] : node.t === 'glow' || node.t === 'wheel' ? [node.g] : node.t === 'particles' ? [node.seeds] : node.t === 'lantern' ? [node.ring] : []));
  const names = Object.fromEntries(Object.entries<THREE.Material>({ ...mats }).map(([key, material]) => [key, resources.lend(material)]));
  const material = (key: keyof Mats): string => { const id = names[key]; if (id === undefined) throw new Error('Missing building material'); return id; };
  const parts = Object.fromEntries(['log', 'endGrain', 'chink', 'roof', 'beam', 'deck', 'door', 'stone', 'bark', 'iron', 'cloth', 'char'].map(key => [key, names[key] ?? '']));
  const input: BuildingAssemblyRows<string, 'flame' | 'ember' | 'smoke'> = { id: b.id, record: b, bakedStatic: true, publish: `cabins.${b.id}`,
    geometry: Object.fromEntries([...ordinals].map(ordinal => [String(ordinal), `cabins.live.${String(ordinal)}`])),
    materials: { parts, particles: { flame: material('flame'), ember: material('ember'), smoke: material('smoke') }, glass: material('glass'), glow: material('glow') },
    models: { firePit: resources.lend(models.firePit), lantern: resources.lend(models.lantern) },
    role, look, tier: { detailDist: plumbingKnob(slugRuntimeProduct('pine-hollow')?.source.plumbing, buildTier(), 'pine.cabinDetailDist', 'number', TIER_CONFIG), detailShadows: plumbingKnob(slugRuntimeProduct('pine-hollow')?.source.plumbing, buildTier(), 'pine.cabinDetailShadows', 'boolean', TIER_CONFIG), sharedLights: plumbingKnob(slugRuntimeProduct('pine-hollow')?.source.plumbing, buildTier(), 'pine.sharedCabinLights', 'boolean', TIER_CONFIG) } };
  return new BakedBuildingAssembly(resources, input);
}
