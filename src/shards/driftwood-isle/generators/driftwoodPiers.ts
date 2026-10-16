import {Rng} from '@wildshard/sdk/random';
import {SEED} from '../data/landscapeRows';
import type {BufferGeometry} from 'three';
import type {ColliderDesc} from '@wildshard/engine/world/registry';
import {pierParamsKey,pierSpecKey,type PierParams} from '../assets/contracts/pier';
import {PIER_DEFAULTS,PIER_VARIANTS} from '../data/pierRows';
import {LOWERED_SEA} from '../world/sea';
import {driftwoodGroundSampler} from './groundSampling';
import {deckGeometry} from './pier';
import {worldPierSites,resolvePierParams} from './pierSites';
import {pierColliders} from './pierColliders';

/** Four world piers and the existing three Explorer variants, from the original builders. */
export function originalPiers():{geometry:Map<string,BufferGeometry>;rows:{id:string;specKey:string;paramKey:string;params:PierParams;cloth:boolean;colliders:ReturnType<typeof colliderRows>}[]} {
 const ground=driftwoodGroundSampler(),geometry=new Map<string,BufferGeometry>();
 const sites=worldPierSites(),rows:{id:string;specKey:string;paramKey:string;params:PierParams;cloth:boolean;colliders:ReturnType<typeof colliderRows>}[]=[];
 const inputs=[...sites.map((site,i)=>({id:`world-${i}`,site,params:resolvePierParams(site,ground,LOWERED_SEA)})),
  ...PIER_VARIANTS.map(v=>({id:`specimen-${v.id}`,site:null,params:{...PIER_DEFAULTS,...v.params}}))];
 for(const {id,site,params} of inputs){
  const made=deckGeometry(params,new Rng(SEED^0x9e37));
  for(const [part,geo] of Object.entries(made))if(geo!==null){
   const key=`pier-${id}-${part}`;geometry.set(key,geo);
  }
  rows.push({id,specKey:site===null?'':pierSpecKey(site),paramKey:pierParamsKey(params),params,cloth:made.cloth!==null,colliders:colliderRows(params)});
 }
 return {geometry,rows};
}

type PierColliderRow = (Omit<Extract<ColliderDesc,{kind:'box'}>,'yaw'> & {yaw?:number|null})
 | (Omit<Extract<ColliderDesc,{kind:'hull'}>,'points'> & {points:number[]});
/** Hull points were already rounded by the original Float32Array before publication. */
function colliderRows(params:PierParams):PierColliderRow[] {
 const rows:PierColliderRow[]=[];
 for(const row of pierColliders(params)) {
  if(row.kind==='hull'){rows.push({...row,points:Array.from(row.points)});continue;}
  if(row.kind!=='box')throw new Error('Unexpected authored pier collider');
  // JSON cannot represent -0; a null yaw keeps that original bit on read.
  rows.push(Object.is(row.yaw,-0)?{...row,yaw:null}:row);
 }
 return rows;
}
