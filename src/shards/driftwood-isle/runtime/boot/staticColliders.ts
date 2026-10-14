import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { Material } from '@wildshard/engine/physics/surface';

/** The generated static facts used by this shard's cave and trail; other shape kinds refuse. */
export interface StaticColliderFact {
  readonly kind:string; readonly surface?:string;
  readonly x?:number;readonly y?:number;readonly z?:number;
  readonly hx?:number;readonly hy?:number;readonly hz?:number;readonly yaw?:number;
  readonly rot?:{readonly x:number;readonly y:number;readonly z:number;readonly w:number};
  readonly from?:{readonly x:number;readonly y:number;readonly z:number};
  readonly to?:{readonly x:number;readonly y:number;readonly z:number};
  readonly width?:number;readonly count?:number;
}
const finite=(v:number|undefined):number=>{if(v===undefined||!Number.isFinite(v))throw new Error('Static collider lacks a finite value');return v;};
const point=(v:{readonly x:number;readonly y:number;readonly z:number}|undefined):{x:number;y:number;z:number}=>{if(v===undefined)throw new Error('Static stair lacks an endpoint');return {x:finite(v.x),y:finite(v.y),z:finite(v.z)};};
/** Fresh descriptors preserve the caller's surface and leave the generated facts unchanged between entries. */
export function staticColliders(rows:readonly StaticColliderFact[],expectedSurface?:Material):ColliderDesc[] {
  return rows.map((d):ColliderDesc=>{
    if(d.surface!==expectedSurface)throw new Error('Unexpected static collider surface');
    const surface=expectedSurface===undefined?{}:{surface:expectedSurface};
    if(d.kind==='treads')return {kind:'treads',from:point(d.from),to:point(d.to),width:finite(d.width),count:finite(d.count),...surface};
    if(d.kind==='box')return {kind:'box',x:finite(d.x),y:finite(d.y),z:finite(d.z),hx:finite(d.hx),hy:finite(d.hy),hz:finite(d.hz),
      ...(d.yaw===undefined?{}:{yaw:finite(d.yaw)}),...(d.rot===undefined?{}:{rot:{x:finite(d.rot.x),y:finite(d.rot.y),z:finite(d.rot.z),w:finite(d.rot.w)}}),...surface};
    throw new Error('Unexpected static collider shape');
  });
}
