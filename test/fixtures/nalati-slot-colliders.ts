import * as v from 'valibot';
import type {SimHost} from '../../src/engine/sim';
import {EncounterSitesSchema} from '../../src/format/encounterRows';
import {originalNalatiPhysics} from './nalati-physics-original';

const finite=v.pipe(v.number(),v.finite()),triple=v.tuple([finite,finite,finite]);
const Source=v.object({pieces:v.array(v.object({id:v.string(),colliders:finite,active:v.boolean()})),
  solids:v.array(v.object({shape:finite,at:triple,rot:v.tuple([finite,finite,finite,finite]),half:v.exactOptional(triple)}))});
/** Bind the actual retained statue colliders by complete source geometry,
 * refusing ambiguity. Never infer a flattened collider index or add a box. */
export function nalatiSlotColliders(host:SimHost,input:unknown):{
  readonly set:(index:number,awake:boolean)=>void;readonly snapshot:()=>boolean[];
  readonly restore:(input:unknown)=>void;readonly physicsRestored:()=>void;
} {
  const rows=v.parse(EncounterSitesSchema,input),source=v.parse(Source,originalNalatiPhysics());
  const awake=rows.sites.map(()=>false);
  const solids=rows.sites.map((site,index)=>{
    const owner=source.pieces.filter(piece=>piece.id===`${rows.name}-${index}`);
    if(owner.length!==1||owner[0]?.colliders!==1||!owner[0].active)throw new Error('Native slot statue lost its original owner');
    const y=host.groundHeightAt(site.x,site.z)-rows.sink*site.scale,c=rows.collider;
    // WorldRegistry.boxDesc's original P2 box arithmetic, independently
    // joined below to its retained source and actual native collider.
    const yTop=y+c.top*site.scale,yBottom=y-c.bottom;
    const box={x:site.x,y:(yTop+yBottom)/2,z:site.z,hx:c.hw*site.scale,hy:Math.max(.005,(yTop-yBottom)/2),hz:c.hd*site.scale};
    const at=[box.x,box.y,box.z].map(Math.fround),half=[box.hx,box.hy,box.hz].map(Math.fround);
    const rot=[0,Math.sin(site.yaw/2),0,Math.cos(site.yaw/2)].map(Math.fround);
    const matches=source.solids.filter(solid=>solid.shape===1&&solid.at.every((n,i)=>Object.is(n,at[i]))
      &&solid.half?.every((n,i)=>Object.is(n,half[i]))===true&&solid.rot.every((n,i)=>Object.is(n,rot[i])));
    const solid=matches[0];if(matches.length!==1||solid?.half===undefined)throw new Error('Native slot statue geometry differs from the admitted site');
    return solid;
  });
  const handles=solids.map(solid=>{
    const matches:number[]=[];
    host.physics.world.forEachCollider(collider=>{
      if(collider.shapeType()!==host.physics.R.ShapeType.Cuboid)return;
      const at=collider.translation(),half=collider.halfExtents(),rot=collider.rotation();
      if(half===null)return;
      if([at.x,at.y,at.z].every((n,i)=>Object.is(n,solid.at[i]))&&[half.x,half.y,half.z].every((n,i)=>Object.is(n,solid.half?.[i]))
        &&[rot.x,rot.y,rot.z,rot.w].every((n,i)=>Object.is(n,solid.rot[i])))matches.push(collider.handle);
    });
    const handle=matches[0];if(matches.length!==1||handle===undefined)throw new Error('Native slot statue has no unique physical collider');return handle;
  });
  if(new Set(handles).size!==handles.length)throw new Error('Aliased native slot statue collider');
  const live=(index:number)=>{
    if(host.scope.disposed||host.scope.disposing)throw new Error('Slot collider owner retired');
    const handle=handles[index],solid=solids[index],collider=handle===undefined?null:host.physics.world.getCollider(handle);
    if(collider===null||solid===undefined||collider.shapeType()!==host.physics.R.ShapeType.Cuboid)throw new Error('Missing native slot collider');
    const at=collider.translation(),half=collider.halfExtents(),rot=collider.rotation();
    if(half===null)throw new Error('Native slot collider has no original box');
    if(![at.x,at.y,at.z].every((n,i)=>Object.is(n,solid.at[i]))||![half.x,half.y,half.z].every((n,i)=>Object.is(n,solid.half?.[i]))
      ||![rot.x,rot.y,rot.z,rot.w].every((n,i)=>Object.is(n,solid.rot[i])))throw new Error('Replaced native slot collider');
    return collider;
  };
  return {set:(index,value)=>{const collider=live(index);awake[index]=value;collider.setEnabled(!value);},snapshot:()=>[...awake],
    restore:inputValue=>{const saved=v.parse(v.pipe(v.array(v.boolean()),v.length(awake.length)),inputValue);
      for(let index=0;index<saved.length;index++)live(index);
      saved.forEach((value,index)=>{awake[index]=value;live(index).setEnabled(!value);});},
    physicsRestored:()=>{awake.forEach((value,index)=>{if(live(index).isEnabled()===value)throw new Error('Restored slot activity differs from its native physics');});}};
}
