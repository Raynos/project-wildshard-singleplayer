import {SEED} from '@wildshard/engine/core/config';
import {defineModel} from '@wildshard/engine/models/model';
import {libraryModel} from '@wildshard/game/models/libraryModel';
import {lowPolyLookMaterial} from '@wildshard/engine/world/lowpolyKit';
import type {ColliderDesc} from '@wildshard/engine/world/registry';
import {readColliderRows} from '@wildshard/engine/models/colliders';
import {driftwoodRows} from '../boot/rows';
import {pierParamsKey,pierSpecKey,type PierParams,type PierSpec} from '../../assets/contracts/pier';
import {PIER_DEFAULTS,PIER_VARIANTS} from '../../data/pierRows';
import rows from '../../data/piers.generated.json' with {type:'json'};
import {fixedGeometryReady,loadFixedGeometry,PIER_GEOMETRIES} from '../boot/fixedGeometry';

const pair=(v:readonly number[]):[number,number]=>{const [a,b]=v;if(a===undefined||b===undefined||v.length!==2)throw new Error('Pier row requires a pair');return [a,b];};
/** Read the canonical measured parameters; tuples are admitted before lending them to native code. */
export function pierWorldParams(spec:PierSpec):PierParams {
 const row=rows.find(r=>r.specKey===pierSpecKey(spec));
 if(row===undefined)throw new Error('Pier site changed; regenerate its authored geometry');
 const p=row.params;
 return {length:p.length,width:p.width,pileDepth:p.pileDepth,pennantDir:pair(p.pennantDir),
  landing:p.landing===null?null:{...p.landing,postGround:pair(p.landing.postGround)},
  ...(p.pennantAt===undefined?{}:{pennantAt:p.pennantAt}),...(p.seaRamp===undefined?{}:{seaRamp:p.seaRamp})};
}
/** Resolve one of the seven authored parameter sets; there is no procedural fallback. */
export function pierGeometryKey(p:PierParams):string {
 const row=rows.find(r=>r.paramKey===pierParamsKey(p));
 if(row===undefined)throw new Error('Pier parameters changed; regenerate its authored geometry');
 return row.id;
}
/** Fresh authored descriptors; the producer retains the original box, ramp and float32 hull arithmetic. */
export function pierColliders(p: PierParams): ColliderDesc[] {
 const row=driftwoodRows('custom/fixedLayouts').piers.find(candidate=>candidate.paramKey===pierParamsKey(p));
 if(row===undefined)throw new Error('Pier parameters changed; regenerate its authored geometry');
 const colliders:unknown[]=[];
 for(let i=0;i<128;i++){const c=row.colliders[i];if(c===undefined)break;colliders.push(c.kind==='box'&&c.yaw===null?{...c,yaw:-0}:c);}
 return readColliderRows(colliders,{kinds:['box','hull'],surfaces:[]});
}


/** The deck on the kit's still look; the pennant flutters in its graph, its shadow too (data/kitLook.ts). */
export const pier=defineModel<PierParams>({
 id:'driftwood-isle/pier',name:'Pier',category:'buildings',pipeline:'code',file:'src/shards/driftwood-isle/runtime/models/pier.ts',surface:'planks',
 defaults:PIER_DEFAULTS,variants:PIER_VARIANTS,seed:SEED^0x9e37,
 ...libraryModel<PierParams,'still'|'pennant'>({
  draws:p=>{const key=pierGeometryKey(p);return [{draw:`${key}/deck`,material:'still',castShadow:true,receiveShadow:true},
   ...(PIER_GEOMETRIES.get(key)?.cloth?[{draw:`${key}/cloth`,material:'pennant' as const,castShadow:true}]:[])];},
  geometry:(_,draw)=>{const [key,part]=draw.split('/'),g=PIER_GEOMETRIES.get(key??'')?.[part==='cloth'?'cloth':'deck'];
   if(!g)throw new Error(`Missing authored pier geometry ${draw}`);return g.copy();},
  material:(ctx,key)=>lowPolyLookMaterial(ctx.sky,key),colliders:pierColliders,
  loading:{id:'driftwood-isle/pier',ready:fixedGeometryReady,load:()=>loadFixedGeometry(),size:p=>[p.width+2,10,p.length]},
 }),
});
