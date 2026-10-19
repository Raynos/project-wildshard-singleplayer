import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test, expect } from 'vitest';
import { packedCreatureBodies } from '../../../../../src/game/plugin/geometry';
import { buildDecisionScripts } from '../../../../../src/sdk/buildDecisionScripts';
import { COLOSSUS_NATIVE_JOINTS } from './colossusLethalPoseClips';
import { createColossusLethalPoseCandidateOutput, decisions, retainedFields } from './candidateFactory';
import { TIDAL_GIANTS_FIELDS, TIDAL_GIANTS_MOVES, TIDAL_GIANTS_STRIKES } from '../../../../../src/shards/driftwood-isle/generators/tidalGiantsCombat';
const dir = 'art/driftwood-isle/lowpoly-colossus/motion-studies/lethal-pose-inline/';
const original = dir.replace('lethal-pose-inline', 'lethal-pose-input');
const native = 'art/driftwood-isle/lowpoly-colossus/runtime-admission/';
const hash = (bytes: string | Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

test('source equivalence: only two export annotations differ; complete factory, clips and rig identical', () => {
  const before = readFileSync(original+'behaviour/tide-root-colossus.as','utf8');
  const after = readFileSync(dir+'behaviour/tide-root-colossus.as','utf8');
  const expected = before.replace('export function onHit(', '@inline export function onHit(').replace('export function onDeath(', '@inline export function onDeath(');
  expect(after).toBe(expected);
  expect(after.replace('@inline export function onHit(', 'export function onHit(').replace('@inline export function onDeath(', 'export function onDeath(')).toBe(before);
  const equalFiles = ['candidateFactory.ts','colossusLethalPoseClips.ts','rig.ts'];
  for(const file of equalFiles)expect(readFileSync(dir+file)).toEqual(readFileSync(original+file));
  writeFileSync(dir+'source-equivalence.json',JSON.stringify({sourceSha256:hash(before),candidateSha256:hash(after),onlyChanges:['@inline onHit','@inline onDeath'],bodiesByteIdentical:true,identicalFiles:Object.fromEntries(equalFiles.map(file=>[file,hash(readFileSync(dir+file))]))},null,2));
});

test('strict native metadata and exact packed payload decode without renderer; unknown schema keys refuse', async () => {
  const metadata: unknown = JSON.parse(readFileSync(native+'arena-candidate2/metadata.json','utf8'));
  if(typeof metadata!=='object'||metadata===null)throw new Error('No metadata');
  expect(()=>packedCreatureBodies({...metadata,unrecognized:true})).toThrow();
  const payload = readFileSync(native+'v4-skin1/payload.bin');
  expect(hash(payload)).toBe('bfb9cd8333fb8ba2b17209a51126e26cc5c1e56a521627fc68910af86b506e46');
  const bodies = packedCreatureBodies(metadata,undefined,async()=>payload);
  await bodies.preload();
  const body = bodies.copy('tideRootColossus','tide-root-colossus');
  expect(body.bones.map(bone=>bone.name)).toEqual(COLOSSUS_NATIVE_JOINTS);
  const parts = [...body.furParts,...body.hardParts,...body.eyeParts];
  expect(parts).toHaveLength(12);
  const vertices = parts.reduce((total,part)=>total+part.getAttribute('position').count,0);
  expect(vertices).toBe(15600);
  const output = createColossusLethalPoseCandidateOutput(metadata);
  expect(output.namedFiles?.some(row=>row.name==='practice/bodies.json')).toBe(true);
  for(const part of parts)part.dispose();
  writeFileSync(dir+'native-admission.json',JSON.stringify({strictSchema:true,unknownKeyRefused:true,packedPayloadSha256:hash(payload),parts:parts.length,vertices,joints:body.bones.map(bone=>bone.name),mounted:false,physicalAcceptance:false},null,2));
});

test('actual candidate directory compiles with unchanged contract and records exact compilation inputs',async()=>{
  const fields=[...TIDAL_GIANTS_FIELDS,...retainedFields];
  const registries={actors:new Map([['driftwood.colossus',2]]),moves:new Map(TIDAL_GIANTS_MOVES.map((row,i)=>[row.id,i+1])),strikes:new Map(TIDAL_GIANTS_STRIKES.map((row,i)=>[row.id,i+1])),fields:new Map(fields.map(row=>[row.name,row.id]))};
  const options={asLineCeiling:300};
  const result=await buildDecisionScripts(dir,decisions,registries,options);
  expect(result.rows).toHaveLength(1);expect(result.blobs).toHaveLength(1);
  const blob=result.blobs[0];if(blob===undefined)throw new Error('No module');
  expect(blob.bytes.length).toBe(15375);
  writeFileSync(dir+'compilation-inputs.json',JSON.stringify({options,registries:Object.fromEntries(Object.entries(registries).map(([key,value])=>[key,[...value]])),decisions,generated:Object.fromEntries(result.generated),lines:result.lines,ceiling:result.ceiling,moduleSha256:hash(blob.bytes),moduleBytes:blob.bytes.length,rows:result.rows},null,2));
},120000);
