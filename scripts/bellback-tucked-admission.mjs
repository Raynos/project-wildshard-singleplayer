import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

export const BELLBACK_TUCKED_CANDIDATE='art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate3';
export const bellbackHash=bytes=>createHash('sha256').update(bytes).digest('hex');
const original='art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/frame2-native';
export function admitBellbackTucked(root){
 const receipt=JSON.parse(readFileSync(resolve(root,BELLBACK_TUCKED_CANDIDATE,'admission.json'),'utf8'));
 if(receipt.schema!=='wildshard.bellback.arena-candidate.v1'||receipt.candidate!=='V6-frame2-native8-motion3'||receipt.visualAcceptance!==false||receipt.colliderAcceptance!==false||receipt.runtimeAcceptance!==false||receipt.rootFlinch!=='authored-pose')throw new Error('Invalid Bellback admission');
 for(const [path,expected] of Object.entries(receipt.files)){
  if((!path.startsWith('art/driftwood-isle/lowpoly-bellback/')&&!path.startsWith('src/shards/driftwood-isle/')&&!path.startsWith('scripts/')&&!path.startsWith('vite/')&&!path.startsWith('test/'))||path.split('/').includes('..'))throw new Error('Foreign Bellback admission path');
  if(bellbackHash(readFileSync(resolve(root,path)))!==expected)throw new Error(`Bellback tuple mismatch: ${path}`);
 }
 if(receipt.files[`${original}/payload.bin`]!=='b97a9df5437062aa2eb490340663c2b35ecf22ba83c83b834082d8ffe7ae7e9c'||receipt.files['art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/build_bellback_v6_frame2.py']!=='68a955915e6836735a0c0df2454c2f168255689f2baf54ef2bea16008a410728')throw new Error('Wrong Bellback source');
 const metadata=JSON.parse(readFileSync(resolve(root,BELLBACK_TUCKED_CANDIDATE,'metadata.json'),'utf8'));
 const before=JSON.parse(readFileSync(resolve(root,original,'metadata.json'),'utf8'));
 const measure=JSON.parse(readFileSync(resolve(root,BELLBACK_TUCKED_CANDIDATE,'dimension-measurement.json'),'utf8'));
 for(const path of [`${BELLBACK_TUCKED_CANDIDATE}/metadata.json`,`${BELLBACK_TUCKED_CANDIDATE}/dimension-measurement.json`,'src/shards/driftwood-isle/generators/bellbackTuckedClips.ts','src/shards/driftwood-isle/generators/bellbackTuckedPreview.ts','src/shards/driftwood-isle/behaviour/bellback.as','src/shards/driftwood-isle/generators/tidalGiantsCombat.ts'])if(!receipt.files[path])throw new Error('Incomplete Bellback tuple');
 before.bodies[0].dims=measure.dimensions;
 if(measure.colliderAcceptance!==false||measure.worldCorpseContactAccepted!==false||JSON.stringify(before)!==JSON.stringify(metadata))throw new Error('Bellback changed beyond measured dimensions');
 if(metadata.bodies.length!==1||metadata.bodies[0].kind!=='bellback'||metadata.bodies[0].variant!=='bellback'||JSON.stringify(metadata.bodies[0].bones.map(row=>row.name))!=='["body","head","bell","clapper","leg0","leg1","leg2","leg3"]')throw new Error('Wrong Bellback rig');
 return {receipt,metadata,payload:readFileSync(resolve(root,original,'payload.bin'))};
}
