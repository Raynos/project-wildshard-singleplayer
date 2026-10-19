import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export const BRINE_PITCHER_NATIVE = 'art/driftwood-isle/approved-brine-pitcher/v3';
export const brinePitcherHash = bytes => createHash('sha256').update(bytes).digest('hex');
/** Closed source tuple. This is structural admission only, never visual or runtime approval. */
export function admitBrinePitcherNative(root) {
 const receipt=JSON.parse(readFileSync(resolve(root,BRINE_PITCHER_NATIVE,'admission.json'),'utf8'));
 if(receipt.schema!=='wildshard.brine-pitcher.source-admission.v1'||receipt.candidate!=='brine-pitcher-native-v3'||receipt.visualAcceptance!==false||receipt.runtimeAcceptance!==false||receipt.colliderAcceptance!==false)throw new Error('Invalid Pitcher receipt');
 const required=[`${BRINE_PITCHER_NATIVE}/source-audit.json`,`${BRINE_PITCHER_NATIVE}/metadata.json`,`${BRINE_PITCHER_NATIVE}/payload.bin`,`${BRINE_PITCHER_NATIVE}/native-source.json`,`${BRINE_PITCHER_NATIVE}/brine-pitcher-v1.glb`,'src/shards/driftwood-isle/generators/brinePitcherNativeClips.ts','src/shards/driftwood-isle/generators/brinePitcherCombat.ts','src/shards/driftwood-isle/generators/brinePitcherNativePreview.ts','src/shards/driftwood-isle/behaviour/brine-pitcher.as'];
 for(const path of required)if(!receipt.files[path])throw new Error(`Missing Pitcher tuple: ${path}`);
 for(const [path,expected] of Object.entries(receipt.files)){
  if(path.split('/').includes('..')||(!path.startsWith('art/driftwood-isle/approved-brine-pitcher/')&&!required.includes(path)))throw new Error('Foreign Pitcher path');
  if(brinePitcherHash(readFileSync(resolve(root,path)))!==expected)throw new Error(`Pitcher source mismatch: ${path}`);
 }
 const audit=JSON.parse(readFileSync(resolve(root,BRINE_PITCHER_NATIVE,'source-audit.json'),'utf8'));
 if(audit.singleSidedGlbMaterials!==true||audit.orientedTriangleParity!==true||audit.positiveClosedComponents.length!==100||audit.positiveClosedComponents.some(row=>!(row.signedVolume>0))||Object.keys(audit.watertightVesselVolumes).length!==3||audit.outwardRimTriangles!==576)throw new Error('Incomplete Pitcher winding audit');
 const metadata=JSON.parse(readFileSync(resolve(root,BRINE_PITCHER_NATIVE,'metadata.json'),'utf8'));
 const body=metadata.bodies[0];
 if(metadata.bodies.length!==1||body.kind!=='brine-pitcher-matriarch'||body.variant!==body.kind||JSON.stringify(body.bones.map(b=>b.name))!==JSON.stringify(['body','head','leftHead','rightHead','headLid','leftHeadLid','rightHeadLid']))throw new Error('Invalid Pitcher native rig');
 for(const bone of body.bones)if(bone.parent!==(bone.name==='body'?null:bone.name.endsWith('Lid')?bone.name.slice(0,-3):'body'))throw new Error('Invalid Pitcher hierarchy');
 return {receipt,metadata,payload:readFileSync(resolve(root,BRINE_PITCHER_NATIVE,'payload.bin'))};
}
