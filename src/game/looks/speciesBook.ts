import { thinkCrowdGuard } from '../ambient/crowdPage';
import { DirectedSpecies } from '../population/directedSpecies';
import { groupSpecies } from '../population/groupSpecies';
import { numericCreaturePose } from '../plugin/channelPrograms';
import { poseRidingEnvelopes, type RidingPresentationRows } from '../riding/presentation';
import { wildEnv } from '../population/pageGroups';
import type { AnimalRigContext } from '@wildshard/engine/entities/animalRig';
import * as v from 'valibot';
import { packedCreatureBodies,type BakedGeometryRow } from '../plugin/geometry';
import { productRiggedHulls } from './riggedHulls';
import { SpeciesLookBookSchema } from '@wildshard/format/speciesLooks';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import type { VariantDef } from '@wildshard/engine/entities/species/registry';

/** Expand compact byte addressing only; the native packed owner admits every
 * geometry block, skeleton and dimension before it copies a body. */
function packedRows(input:unknown):unknown{
  const part=v.tuple([v.number(),v.number(),v.number(),v.array(v.tuple([v.number(),v.number(),v.number()])),v.picklist(['u16','u32'])]);
  const data=v.parse(v.object({file:v.string(),bytes:v.number(),attrs:v.array(v.tuple([v.string(),v.picklist(['f32','u16']),v.number(),v.boolean()])),skeletons:v.array(v.object({bones:v.unknown(),dims:v.unknown()})),
    rows:v.array(v.object({kind:v.string(),variant:v.string(),skeleton:v.number(),fur:v.array(part),hard:v.array(part),eye:v.array(part)}))}),input);
  const parts=(rows:v.InferOutput<typeof part>[])=>rows.map(([count,indexCount,start,groups,index])=>{
    let at=start;const offsets=data.attrs.map(([,type,width])=>{const offset=at,length=count*width*(type==='u16'?2:4);at+=length+(4-length%4)%4;return offset;});
    offsets.push(at);const row:BakedGeometryRow={attrs:data.attrs,count,index,indexCount,box:false};return {offsets,groups,indexEncoding:'raw',row};
  });
  return {file:data.file,bytes:data.bytes,bodies:data.rows.map(body=>{const skeleton=data.skeletons[body.skeleton];if(skeleton===undefined)throw new Error('Missing packed skeleton');
    return {kind:body.kind,variant:body.variant,bones:skeleton.bones,dims:skeleton.dims,fur:parts(body.fur),hard:parts(body.hard),eye:parts(body.eye)};})};
}
/** Client-only look catalogue over native packed bodies and the single hull
 * cache. Data names all variants, resources and material measurements; local
 * gameplay/pose callbacks never enter this owner. */
export class SpeciesLookBook {
  private readonly poses = new Map<string, ReturnType<typeof numericCreaturePose>>();
  private readonly envelopes = new Map<string, RidingPresentationRows>();
  readonly rows;
  readonly looks:readonly SpeciesLook[];
  private readonly bodies;
  private readonly hulls;
  constructor(input:unknown){
    const book=v.parse(SpeciesLookBookSchema,input);this.bodies=packedCreatureBodies(packedRows(book.body));this.hulls=productRiggedHulls(book.slug);
    for (const [id, pose] of Object.entries(book.poses ?? {})) this.poses.set(id, numericCreaturePose(pose));
    for (const row of book.rows) if (row.postPose !== undefined) {
      if (!this.poses.has(row.postPose.alive) || row.postPose.dead !== undefined && !this.poses.has(row.postPose.dead)) throw new Error('Missing species pose programme');
      if (row.postPose.envelopes !== undefined) this.envelopes.set(row.postPose.alive, row.postPose.envelopes);
    }
    this.rows=book.rows.map(row=>({...row.metadata,...(row.group === undefined ? {} : groupSpecies(row.group)),...(row.directed === undefined ? {} : new DirectedSpecies(row.directed, book.program).binding),...(row.guard === true ? { think: thinkCrowdGuard } : {})}));
    this.looks=book.rows.map(row=>{const look:SpeciesLook={id:row.id,species:row.metadata.id,kind:row.metadata.kind,rigContract:row.rigContract,fur:NO_FUR,
      variants:Object.fromEntries(Object.entries(row.variants).map(([id,source])=>{
        const variant:Pick<VariantDef,'tint'|'traits'>={};if(source.tint!==undefined)variant.tint=source.tint;if(source.traits!==undefined)variant.traits=source.traits;return [id,variant];
      })),
      build:variant=>{const key=row.variants[variant.id]?.body;if(key===undefined)throw new Error('Unknown packed creature variant');return this.copy(row.family,key);},
      material:(sky,glow,intensity=1)=>{const material=painterlyMaterial(sky,row.material);if(glow!==undefined){material.emissive.setRGB(...glow);material.emissiveIntensity=intensity;}return material;},
      preload:()=>this.preload(),hasSkin:variant=>this.hulls.hullOf(row.metadata.kind,variant.id)!==null,
      loadSkin:async variant=>{const name=this.hulls.hullOf(row.metadata.kind,variant.id);if(name!==null)await this.hulls.load(name);},
      skin:(variant,bones)=>{const hull=this.hulls.skin(row.metadata.kind,variant.id,bones);return hull===null?null:{...hull,normalMap:null,overgrown:false};},
    };
    if (row.postPose !== undefined) { const pose = row.postPose; look.postPose = context => { this.pose(context.alive ? pose.alive : pose.dead ?? pose.alive, context); }; }
    if(row.rig!==undefined)look.rig=row.rig;if(row.pose!==undefined)look.pose=row.pose;if(row.gait!==undefined)look.gait=row.gait;
    if(row.eyeGlow!==undefined)look.eyeGlow=row.eyeGlow;if(row.eyeGlowIntensity!==undefined)look.eyeGlowIntensity=row.eyeGlowIntensity;return look;});
  }
  /** Apply admitted numeric joints and optional mount envelopes over a borrowed rig. */
  pose(id: string, context: AnimalRigContext): void {
    const pose = this.poses.get(id); if (pose === undefined) throw new Error('Missing species pose programme');
    const envelopes = this.envelopes.get(id); if (envelopes !== undefined) poseRidingEnvelopes(context, envelopes, wildEnv.wind);
    pose(context);
  }
  /** Cold specimens and page factories share the same immutable sources. */
  async preload():Promise<void>{await Promise.all([this.bodies.preload(),this.hulls.preload()]);}
  /** Body-only intake for consumers that already own hull preparation. */
  async preloadBodies():Promise<void>{await this.bodies.preload();}
  /** Own a fresh body copy, selected only by its admitted data identity. */
  copy(family:string,key:string):ReturnType<typeof this.bodies.copy>{return this.bodies.copy(family,key);}
}
