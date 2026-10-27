import { Box3, Vector3 } from 'three';
import * as v from 'valibot';
import { islandProtos, type IslandProto } from './islandProtos';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';

interface ProtoFacts { name:string;present:boolean;empty:boolean;min:{x:number;y:number;z:number};max:{x:number;y:number;z:number};half:number;top:number }
export interface DriftwoodIslandFacts {
 protos: ProtoFacts[];
 extraPalms: { x:number;z:number;h:number;lean:number;leanDir:number;rot:number;fronds:number }[];
 bake: { bounceGain:number;sunY:number };
}
export const DRIFTWOOD_ISLAND_FACT_INPUTS: readonly string[] = ['/assets/models/driftwood-blender/island.glb', '/assets/models/driftwood-blender/island.json'];

/** Admit complete native prototype observations before synchronous declaration readers use them. */
export function parseDriftwoodIslandFacts(bytes: Uint8Array): DriftwoodIslandFacts {
 const n=v.pipe(v.number(),v.finite()),point=v.object({x:n,y:n,z:n});
 return v.parse(v.object({protos:v.array(v.object({name:v.string(),present:v.boolean(),empty:v.boolean(),min:point,max:point,half:n,top:n})),
  extraPalms:v.array(v.object({x:n,z:n,h:n,lean:n,leanDir:n,rot:n,fronds:n})),bake:v.object({bounceGain:n,sunY:n})}),JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
}

/** Retained drivers provide only committed native inputs, never a copied facts file. */
export async function driftwoodIslandFactsFrom(read: (url:string)=>Uint8Array): Promise<DriftwoodIslandFacts> {
 return parseDriftwoodIslandFacts(await islandPrototypeFacts(read));
}

/** One owned facts cache shared by declaration, page-file and scene-bank consumers. */
export async function driftwoodIslandFacts(ctx: Pick<ProjectGenerationContext,'cached'>): Promise<DriftwoodIslandFacts> {
 const files=await ctx.cached({id:'island-facts',native:true,inputs:DRIFTWOOD_ISLAND_FACT_INPUTS},async inputs=>new Map([['facts.json',await islandPrototypeFacts(url=>{
  const bytes=inputs.get(url);if(bytes===undefined||bytes.byteLength===0)throw new Error(`Missing island facts input: ${url}`);return bytes;
 })]]));
 const bytes=files.get('facts.json');if(files.size!==1||bytes===undefined)throw new Error('Invalid island facts cache inventory');
 return parseDriftwoodIslandFacts(bytes);
}
/** Prototype bounds and original rock fit dimensions; no vertices or placements are duplicated. */
export function prototypeFacts(name:string,proto:IslandProto|undefined):ProtoFacts {
 const box=new Box3(),point=new Vector3();
 if(proto!==undefined)for(let i=0;i<proto.pos.length;i+=3)box.expandByPoint(point.set(proto.pos[i]??0,proto.pos[i+1]??0,proto.pos[i+2]??0));
 const empty=box.isEmpty(),top=empty?0:Math.max(0,box.max.y);
 return {name,present:proto!==undefined,empty,min:empty?{x:0,y:0,z:0}:{x:box.min.x,y:box.min.y,z:box.min.z},max:empty?{x:0,y:0,z:0}:{x:box.max.x,y:box.max.y,z:box.max.z},
  half:empty?0.4:Math.max(box.max.x-box.min.x,box.max.z-box.min.z)/2,top:top>0?top:0.25};
}
/** The native Blender GLB and LOD recipe are the sole authority for these cheap metadata rows. */
export async function islandPrototypeFacts(readAsset:(url:string)=>Uint8Array):Promise<Uint8Array> {
 const base='/assets/models/driftwood-blender/';
 const n=v.pipe(v.number(),v.finite()),palm=v.object({x:n,z:n,h:n,lean:n,leanDir:n,rot:n,fronds:n});
 const meta=v.parse(v.object({protos:v.array(v.object({name:v.string()})),lod:v.record(v.string(),v.number()),extraPalms:v.array(palm),bake:v.object({bounceGain:n,refSun:v.tuple([n,n,n])})}),JSON.parse(new TextDecoder().decode(readAsset(`${base}island.json`))));
 const protos=await islandProtos(readAsset(`${base}island.glb`),meta);
 // everything the runtime reads of island.json (G467): the prototype facts, the extra palms the monkeys climb, and the
 // bounce bake's gain and reference sun height
 return new TextEncoder().encode(`${JSON.stringify({protos:meta.protos.map((p,i)=>prototypeFacts(p.name,protos[i])),extraPalms:meta.extraPalms,bake:{bounceGain:meta.bake.bounceGain,sunY:meta.bake.refSun[1]}})}\n`);
}
