import * as v from 'valibot';
import {SpeciesActorsFileSchema} from '../../src/format/speciesBookRows';
import {parsePackedCreatureLooks} from '../../src/format/speciesLooks';
import {TimedEncountersSchema} from '../../src/format/encounterRows';
import type {ShardProduct} from '../../src/game/shardfile/shardProduct';
import type {NativeCreaturePoseRecipe} from '../../src/game/plugin/animation';
import type {AnimalRigContext} from '../../src/engine/entities/animalRig';
import {numericCreaturePoseFromBook} from '../../src/game/plugin/channelPrograms';
import {poseRidingEnvelopes} from '../../src/game/riding/presentation';

const finite=v.pipe(v.number(),v.finite());
const Bones=v.pipe(v.array(v.object({name:v.string(),parent:v.nullable(v.string()),pos:v.tuple([finite,finite,finite])})),v.maxLength(32));

/** The real patrol's contact joints and horse overlay, from the same admitted
 * skeleton and pose book the page uses. No geometry or body is manufactured. */
export async function readNalatiPatrolPoses(product:Pick<ShardProduct,'json'>):Promise<{
  readonly kind:string;
  readonly rows:readonly {readonly kind:string;readonly variant:string;readonly pose:NativeCreaturePoseRecipe}[];
  readonly postPose:(context:AnimalRigContext,wind:{x:number;z:number;strength:number})=>void;
}> {
  const [actors,book,timed]=await Promise.all([
    product.json<unknown>('actors/sheep.json').then(input=>v.parse(SpeciesActorsFileSchema,input)),
    product.json<unknown>('actors/species-looks.json').then(parsePackedCreatureLooks),
    product.json<unknown>('combat/timed-encounters.json').then(input=>v.parse(TimedEncountersSchema,input)),
  ]);
  const kind=timed.patrol.actors?.kind;
  if(kind===undefined)throw new Error('Patrol contact pose requires its declared species');
  const metadata=actors.species.lookBook.rows.find(row=>row.metadata.kind===kind),look=book.rows.find(row=>row.kind===kind);
  if(metadata===undefined||look===undefined||look.postPose?.envelopes===undefined||look.rig==='custom'
    ||look.animate!==undefined||look.frame!==undefined||look.lift!==undefined)
    throw new Error('Patrol contact pose requires its actual quadruped and overlay');
  const post=look.postPose,envelopes=post.envelopes;
  if(envelopes===undefined)throw new Error('Patrol contact pose is missing its admitted envelopes');
  const alive=numericCreaturePoseFromBook(book,post.alive),dead=numericCreaturePoseFromBook(book,post.dead??post.alive);
  const rows=[...metadata.metadata.variants,...metadata.metadata.spawnOnly??[]].map(variant=>{
    const mapped=metadata.variants[variant.id];
    if(mapped===undefined)throw new Error('Patrol contact pose is missing its original body mapping');
    const row=actors.species.packedBodies.rows.find(candidate=>candidate.kind===metadata.family&&candidate.variant===mapped.body);
    const skeleton=row===undefined?undefined:actors.species.packedBodies.skeletons[row.skeleton];
    if(skeleton===undefined)throw new Error('Patrol contact pose is missing its packed skeleton');
    const bones=v.parse(Bones,skeleton.bones);
    if(bones.length>32||new Set(bones.map(bone=>bone.name)).size!==bones.length)throw new Error('Patrol contact skeleton exceeds the original joint contract');
    const pose:NativeCreaturePoseRecipe={custom:false,deathSplay:false,
      ...(look.gait===undefined?{}:{gait:look.gait}),...(look.stance===undefined?{}:{pose:look.stance}),
      joints:bones.map((bone,index)=>{
        const parent=bone.parent===null?-1:bones.findIndex(candidate=>candidate.name===bone.parent);
        if(bone.parent!==null&&(parent<0||parent>=index))throw new Error('Patrol contact joints must retain parent order');
        const at=bones[parent];
        return {name:bone.name,parent,position:[bone.pos[0]-(at?.pos[0]??0),bone.pos[1]-(at?.pos[1]??0),bone.pos[2]-(at?.pos[2]??0)],
          order:'XYZ',scale:[1,1,1]};
      })};
    if(!pose.joints.some(joint=>joint.name===timed.ride.figure.bone))throw new Error('Patrol figure seat lacks its real joint');
    return {kind,variant:variant.id,pose};
  });
  return {kind,rows,postPose:(context,wind)=>{poseRidingEnvelopes(context,envelopes,wind);(context.alive?alive:dead)(context);}};
}
