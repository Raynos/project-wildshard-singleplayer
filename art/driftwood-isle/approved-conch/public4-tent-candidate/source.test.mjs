import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdirSync, mkdtempSync, cpSync, writeFileSync, unlinkSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { ROOT, DIRECTORY, ORIGINAL, admitPublic4, inventory, productPin, verifyProduct, verifyEntries, same } from './admission.mjs';
import { practiceBootFixture, practiceEntryFixture, practiceHtmlFixture } from './fixture.mjs';
import { fixtureResolver, virtualTables } from './host-plugin.mjs';
import { runtimeSourceComparison } from './runtime-scope.mjs';
import { PIN, DIST, EVIDENCE, validatePin, safeNew, MAX_BYTES } from './build.mjs';
const read=p=>readFileSync(resolve(ROOT,p),'utf8');
test('strict native public4 admission plus exact original product closes',()=>{
 const a=admitPublic4();assert.equal(a.buildAllowed,false);assert.equal(a.pin.sourceHash,'e41d1e7600a94074384a00fca22b58f634c060f5eb0458c5d34ec2bf44db6cb8');assert.equal(a.metadata.bodies[0].bones.length,15);assert.equal(a.metadata.file,'/assets/driftwood-isle/conch-canonical-a820f64e2252058c7a02fe3ce551e704e4262990c59b6d28a9b323ee1356d610.bin');
});
test('new fixed normal-clock entries add only existing first-use assignment',()=>{
 verifyEntries();const boot=read(`${DIRECTORY}/candidate-practiceBoot.ts`),entry=read(`${DIRECTORY}/candidate-entry.ts`);
 for(const banned of ['prepareRest','setCapture','frameGate','elapsedTime','__installConchTentObservation','observe.mjs','rest-controls','selected-native'])assert.equal((boot+entry).includes(banned),false);
 assert.equal(boot.split("firstUse(game, 'tent')").length,2);
});
test('seam drift refuses rather than guessing',()=>{
 for(const fn of [practiceBootFixture,practiceEntryFixture,practiceHtmlFixture])assert.throws(()=>fn('changed'));
});
test('resolver only admits exact fixture relative imports and retains virtual TS IDs',async()=>{
 const plugin=fixtureResolver(ROOT);let seen;
 const host={resolve(path,importer,options){seen={path,importer,options};return path;}};
 const importer=resolve(ROOT,DIRECTORY,'candidate-practiceBoot.ts');
 assert.equal(await plugin.resolveId.call(host,'./practiceContent',importer),resolve(ROOT,'src/practiceContent'));
 assert.equal(seen.options.skipSelf,true);assert.equal(await plugin.resolveId.call(host,'./practiceContent','foreign'),null);
 const key=resolve(ROOT,'src/game/boot/bytes.generated'),tables=virtualTables(new Map([[key,'typed-source']]));
 const id=tables.resolveId('./bytes.generated',resolve(ROOT,'src/game/boot/other.ts'));assert.ok(id.endsWith('.ts'));assert.equal(tables.load(id),'typed-source');
});
test('public output rejects changed, added and missing product bytes',()=>{
 const parent=resolve(ROOT,'tmp/conch-public4-tent-source-tests');mkdirSync(parent,{recursive:true});const scratch=mkdtempSync(join(parent,'case-'));
 try {
  const pin=productPin();for(const path of Object.keys(pin.files)){mkdirSync(resolve(scratch,path,'..'),{recursive:true});cpSync(resolve(ROOT,ORIGINAL,path),resolve(scratch,path));}
  verifyProduct(scratch);writeFileSync(join(scratch,'practice-product/foreign.json'),'{}');assert.throws(()=>verifyProduct(scratch),/identity mismatch/u);unlinkSync(join(scratch,'practice-product/foreign.json'));
  const file=join(scratch,'practice-product/sections/actors/moves.json'),original=readFileSync(file);writeFileSync(file,'{}');assert.throws(()=>verifyProduct(scratch));writeFileSync(file,original);unlinkSync(file);assert.throws(()=>verifyProduct(scratch));
 }finally{rmSync(scratch,{recursive:true});}
});
test('fresh explicit root GO and complete exact inputs required',()=>{
 const inputs={source:{a:'hash'},product:{a:'bytes'}};
 const pin={schema:'wildshard.conch.public4-tent.pin.v1',buildAllowed:true,acceptance:false,review:'docs/reviews/conch-public4-tent-candidate.md',rootGo:'synthetic test only',inputs};
 assert.equal(validatePin(pin,structuredClone(inputs)),pin);
 for(const delta of [{rootGo:''},{buildAllowed:false},{acceptance:true},{schema:'old-diagnostic-pin'}])assert.throws(()=>validatePin({...pin,...delta},inputs));
 assert.throws(()=>validatePin(pin,{...inputs,extra:true}));assert.throws(()=>validatePin(pin,{source:inputs.source}));assert.throws(()=>same({a:'one'},{a:'two'}));
});
test('existing destinations refuse, new paths are distinct, budget is fixed',()=>{
 assert.throws(()=>safeNew(resolve(ROOT,ORIGINAL)),/Preserve existing/u);
 for(const path of [PIN,DIST,EVIDENCE])assert.ok(path.includes('conch-public4-tent-'));
 assert.equal(MAX_BYTES,201326592);
 assert.equal(JSON.parse(read(`${DIRECTORY}/budget.json`)).maxNewProducts,0);
});
test('all source checks are read-only for existing host and pin',()=>{
 const before=inventory(resolve(ROOT,ORIGINAL)),pinExisted=existsSync(resolve(ROOT,PIN));admitPublic4();same(before,inventory(resolve(ROOT,ORIGINAL)));assert.equal(existsSync(resolve(ROOT,PIN)),pinExisted);
});

test('original partial runtime inventory is disclosed without whole-host equality',()=>{
 const result=runtimeSourceComparison();same(result,JSON.parse(read(`${DIRECTORY}/runtime-source-comparison.json`)));assert.equal(result.entireCompiledRuntimeEqualityProven,false);assert.equal(result.buildPin.filter(row=>!row.match).length,4);assert.equal(result.buildPin.filter(row=>row.path.startsWith('src/')&&!row.match).length,0);assert.ok(result.unlistedExamples.includes('src/engine/core/Game.ts'));
});

test('fresh fixed PCF and tent entries share current runtime with only first-use boot choice',()=>{
 const tent=read(`${DIRECTORY}/candidate-practiceBoot.ts`),control=read(`${DIRECTORY}/control-practiceBoot.ts`);assert.equal(control,tent.replace("firstUse(game, 'tent')","firstUse(game, 'control')"));
 for(const fn of [practiceBootFixture,practiceEntryFixture,practiceHtmlFixture])assert.throws(()=>fn('changed','unknown'));
 const builder=read(`${DIRECTORY}/build.mjs`);assert.ok(builder.includes("input:{tent:resolve(ROOT,DIRECTORY,'candidate.html'),control:resolve(ROOT,DIRECTORY,'control.html')}"));
 const runner=read(`${DIRECTORY}/capture.mjs`);assert.ok(runner.includes('roots={control:resolve(ROOT,DIST),tent:resolve(ROOT,DIST)}'));assert.equal(runner.includes("start('original4')"),false);
});
