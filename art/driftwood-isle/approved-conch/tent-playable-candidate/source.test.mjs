import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import { inspectSource, compareBodies, requireCompatibleTransfer, ownership } from './compatibility.mjs';
import { practiceBootFixture, practiceEntryFixture, practiceHtmlFixture, DIRECTORY } from './fixture.mjs';
import { admitSelectedNative } from '../selected-native-color-view/admission.mjs';
import { assertCallOrder } from '../tent-shadow-diagnostic/fixture.mjs';
const read = p => readFileSync(p,'utf8');
test('exact admitted native source audit reproduces without build permission',()=>{
 const report=inspectSource(); assert.deepEqual(report,JSON.parse(read(`${DIRECTORY}/source-audit.json`)));
 assert.equal(report.buildAllowed,false); assert.equal(report.selectedNativeAdmitted,true); assert.equal(report.public4SourceAdmitted,true);
 assert.throws(()=>requireCompatibleTransfer(report),/BLOCKED/u);
});
test('all 15 bind positions and six living dimension fields differ despite same joint hierarchy',()=>{
 const report=inspectSource(); assert.equal(report.skeletonNamesAndParentsEqual,true);
 assert.equal(report.bindDifferences.length,15); assert.equal(report.dimensionDifferences.length,6);
 assert.equal(report.selectedOwnership.vertices,6570); assert.equal(report.public4Ownership.vertices,7338);
 assert.equal(report.selectedOwnership.blended,94); assert.equal(report.public4Ownership.blended,94);
});
test('constant-rest rotations cover 15 joints but never attack, gait or death',()=>{
 const report=inspectSource(); assert.deepEqual(report.selectedPose,{programs:45,constantZero:true,hasDeathResponse:false,hasGaitResponse:false,hasAttackResponse:false});
});
test('synthetic same-name skeleton is not enough for transfer',()=>{
 const a={bodies:[{bones:[{name:'body',parent:null,pos:[0,1,0]}],dims:{bodyRadius:1}}]};
 const b=structuredClone(a); b.bodies[0].bones[0].pos[2]=.05;
 assert.equal(compareBodies(a,b).directPoseTransferAllowed,false);
 b.bodies[0].bones[0].pos[2]=0; b.bodies[0].dims.bodyRadius=2;
 assert.equal(compareBodies(a,b).directPoseTransferAllowed,false);
});
test('all skin lanes are checked and malformed influence bytes refuse',()=>{
 const a=admitSelectedNative(); const raw=inflateSync(a.payload), part=a.metadata.bodies[0].hard[0];
 const at=part.offsets[part.row.attrs.findIndex(row=>row[0]==='skinWeight')];
 raw.writeFloatLE(-1,at); assert.throws(()=>ownership(a.metadata,deflateSync(raw)),/Invalid skin influence/u);
});
test('normal-clock fixtures are exact and add only first-use assignment call',()=>{
 for(const [file,source,fn] of [['candidate-practiceBoot.ts','src/practiceBoot.ts',practiceBootFixture],['candidate-entry.ts','src/practice.ts',practiceEntryFixture],['candidate.html','practice.html',practiceHtmlFixture]]) assert.equal(read(`${DIRECTORY}/${file}`),fn(read(source)));
 const boot=read(`${DIRECTORY}/candidate-practiceBoot.ts`), entry=read(`${DIRECTORY}/candidate-entry.ts`);
 for(const banned of ['prepareRest','setCapture','frameGate','elapsedTime','__installConchTentObservation','observe.mjs','rest-controls'])assert.equal((boot+entry).includes(banned),false);
 assertCallOrder(read('src/game/practiceDemo/startPracticeDemo.ts'),read('src/practiceContent.ts'));
});
test('changed original seams refuse instead of guessing an adapter',()=>{
 assert.throws(()=>practiceBootFixture('changed'));assert.throws(()=>practiceEntryFixture('changed'));assert.throws(()=>practiceHtmlFixture('changed'));
});
