import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {MeshStandardMaterial} from 'three';
import {modelContext,seedOf} from '@wildshard/engine/models/model';
import {Rng} from '@wildshard/engine/core/rng';
import {staticGlb} from '@wildshard/sdk/bake/glb';
import {fencePost,signpost,plankStep} from './trailsideModels.ts';

const folder=new URL('../../../../public/assets/driftwood-isle/baked/',import.meta.url);mkdirSync(folder,{recursive:true});
const files={},ctx=modelContext(null),material=new MeshStandardMaterial();ctx.once('driftwood-isle/trail:material',()=>material);
for(const model of [fencePost,signpost,plankStep])for(const variant of model.variants??[{id:'fencePost',params:{}}]){
 const parts=model.build(ctx,{...model.defaults,...variant.params},new Rng(seedOf(model)));
 if(!Array.isArray(parts)||parts.length!==1)throw new Error('Trail specimen needs one native draw');
 const part=parts[0],bytes=staticGlb([{geometry:part.geometry,material,compactIndex:true}],model.id),hash=createHash('sha256').update(bytes).digest('hex'),name=`trail-${hash}.glb`;
 writeFileSync(new URL(name,folder),bytes);files[variant.id]=`/assets/driftwood-isle/baked/${name}`;part.geometry.dispose();
}
console.log(`trail-specimens ${JSON.stringify(files)}`);
