import * as v from 'valibot';
import {SpeciesActorsFileSchema} from '../../src/format/speciesBookRows';
import {parsePackedCreatureLooks} from '../../src/format/speciesLooks';
import {numericCreaturePoseFromBook} from '../../src/game/plugin/channelPrograms';
import {creatureFrame} from '../../src/game/plugin/creatureFrame';
import type {NativeCreaturePoseRecipe} from '../../src/game/plugin/animation';
import type {AnimalRigContext} from '../../src/engine/entities/animalRig';
import type {ShardProduct} from '../../src/game/shardfile/shardProduct';

const finite=v.pipe(v.number(),v.finite());
const Bones=v.pipe(v.array(v.object({name:v.string(),parent:v.nullable(v.string()),pos:v.tuple([finite,finite,finite])})),v.maxLength(32));
/** Native contact joints and exact custom animations from the admitted page
 * body and look books, never approximate target capsules. */
export async function readNalatiArenaPoses(product:Pick<ShardProduct,'json'>,kinds:readonly string[]):Promise<{
  rows:readonly {kind:string;variant:string;pose:NativeCreaturePoseRecipe}[];
  animations:(ground:(x:number,z:number)=>number)=>ReadonlyMap<string,(context:AnimalRigContext)=>void>;
}> {
  const [actors,looks]=await Promise.all([
    product.json('actors/sheep.json').then(input=>v.parse(SpeciesActorsFileSchema,input)),
    product.json('actors/species-looks.json').then(parsePackedCreatureLooks),
  ]);
  const selected=kinds.map(kind=>{
    const body=actors.species.lookBook.rows.find(row=>row.metadata.kind===kind),look=looks.rows.find(row=>row.kind===kind);
    if(body===undefined||look===undefined||look.rig!=='custom'||look.postPose!==undefined||look.lift!==undefined
      ||(look.animate===undefined)===(look.frame===undefined))throw new Error('Arena requires its original custom pose');
    return {kind,body,look};
  });
  const rows=selected.flatMap(({kind,body,look})=>[...body.metadata.variants,...body.metadata.spawnOnly??[]].map(variant=>{
    const mapping=body.variants[variant.id],packed=mapping===undefined?undefined:
      actors.species.packedBodies.rows.find(row=>row.kind===body.family&&row.variant===mapping.body);
    const skeleton=packed===undefined?undefined:actors.species.packedBodies.skeletons[packed.skeleton];
    if(skeleton===undefined)throw new Error('Arena contact body has no actual skeleton');
    const bones=v.parse(Bones,skeleton.bones);
    if(new Set(bones.map(bone=>bone.name)).size!==bones.length)throw new Error('Duplicate arena contact joint');
    const pose:NativeCreaturePoseRecipe={custom:true,deathSplay:false,
      ...(look.gait===undefined?{}:{gait:look.gait}),...(look.stance===undefined?{}:{pose:look.stance}),
      joints:bones.map((bone,index)=>{
        const parent=bone.parent===null?-1:bones.findIndex(candidate=>candidate.name===bone.parent),rest=bones[parent];
        if(bone.parent!==null&&(parent<0||parent>=index))throw new Error('Arena skeleton lost its original parent order');
        return {name:bone.name,parent,position:[bone.pos[0]-(rest?.pos[0]??0),bone.pos[1]-(rest?.pos[1]??0),bone.pos[2]-(rest?.pos[2]??0)],
          order:'XYZ',scale:[1,1,1]};
      })};
    return {kind,variant:variant.id,pose};
  }));
  return {rows,animations:ground=>new Map(selected.map(({kind,look})=>{
    if(look.animate!==undefined)return [kind,numericCreaturePoseFromBook(looks,look.animate)];
    const frame=look.frame===undefined?undefined:looks.frames[look.frame];
    if(frame===undefined)throw new Error('Arena frame is absent from its real look book');
    return [kind,creatureFrame(frame,ground)];
  }))};
}
