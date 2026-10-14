import { PointLight, Vector3, type MeshStandardMaterial } from 'three';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { bindWorldSceneParts, createWorldScene, type WorldSceneBoundParts } from '@wildshard/game/plugin/ui';
import REST_SCENES from '../data/restScenes.generated.json' with { type:'json' };
import { PLACE_BINDINGS } from '../data/placeBindings';
import { addFire, addLampGlow, fireLight } from './fireFx';
import { WORLD, type BakedWorld } from './baked';
import { DUNE_LIBRARY } from './meshes';

type Place = keyof typeof PLACE_BINDINGS;
type Parts<Id extends Place> = WorldSceneBoundParts<typeof PLACE_BINDINGS[Id]> & {glow:(lit:boolean)=>void};
export type TowerParts = Parts<'tower'>;
export type WellParts = Parts<'well'>;
export type BrazierParts = Parts<'brazier'>;
/** One native scene binder for the page and each separate Model Explorer specimen. */
export function buildPlace<Id extends Place>(id:Id,baked:BakedWorld,index=0,colliders?:ColliderDesc[]):Parts<Id> {
  const rows={...REST_SCENES.bindings,brazier:REST_SCENES.bindings.braziers[index]},row=rows[id];
  if(row===undefined)throw new Error('Missing declared place');
  const embers:MeshStandardMaterial[]=[], objects=new Map(row.lights.map(light=>[light.id,new PointLight(light.color,light.intensity,light.distance,light.decay)]));
  const made=createWorldScene(row.recipe,{geometry:DUNE_LIBRARY.geometry,model:DUNE_LIBRARY.model,objects,
    baked:(piece,only,each)=>WORLD.object(piece,only,each,baked),materialCollectors:new Map([['embers',(material:MeshStandardMaterial)=>{embers.push(material);}]]),
  });
  const parts=bindWorldSceneParts(made,PLACE_BINDINGS[id],row.fields);
  for(const effect of [...row.lamps,...row.fires]) {
    const group=made.group(effect.part);if(group===null)throw new Error('Missing declared effect anchor');
    const pool=effect.pool===null?null:DUNE_LIBRARY.geometry(effect.pool);
    if('size' in effect)addFire(group,effect.size,pool);else addLampGlow(group,effect.glow,pool);
  }
  const light=row.glowAt===null?null:fireLight(new Vector3().fromArray(row.glowAt));
  return Object.assign(parts,{colliders:colliders??parts.colliders,glow:(lit:boolean)=>{light?.(lit);for(const ember of embers)ember.emissiveIntensity=lit?1.1:0;}});
}
