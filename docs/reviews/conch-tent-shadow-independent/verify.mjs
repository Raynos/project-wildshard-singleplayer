/** Read-only independent evidence verification; prints JSON, never builds or captures. */
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyHost} from '../../../art/driftwood-isle/approved-conch/tent-shadow-diagnostic/build.mjs';
const dir='tmp/conch-tent-shadow-attempt2/capture/';
const read=f=>JSON.parse(readFileSync(dir+f));
const hash=b=>createHash('sha256').update(b).digest('hex');
const report=read('report.json'), host=verifyHost();
assert.equal(report.completed,true);assert.deepEqual(report.errors,[]);assert.equal(report.acceptance,false);
assert.deepEqual(report.identityBefore,host);assert.deepEqual(report.identityAfter,host);
const c=read('control-setup.json'),t=read('tent-setup.json');assert.deepEqual(c.setup,t.setup);assert.deepEqual(c.identity.before,t.identity.before);
assert.equal(c.identity.before.programCount,0);assert.equal(c.identity.before.renderCalls,0);assert.equal(c.identity.before.graphReceivers,0);assert.equal(c.identity.before.hasFilter,false);
assert.equal(c.identity.variant,'control');assert.equal(t.identity.variant,'tent');assert.equal(t.identity.importedFilterIdentity,true);
const views=['front','left','right','back','top','diag-front','diag-left','diag-right','diag-back'];assert.equal(report.pairs.length,9);
const results=[];
for(const view of views){
 const pair=report.pairs.find(x=>x.view===view),a=read(view+'-control.json'),b=read(view+'-tent.json');
 assert.deepEqual(pair.control,a);assert.deepEqual(pair.tent,b);assert.deepEqual(a.state,b.state);assert.equal(pair.strictControlsEqual,true);
 for(const [variant,item] of [['control',a],['tent',b]]){
  assert.equal(item.repeatByteIdentical,true);assert.equal(item.state.observation.view,view);assert.equal(item.state.observation.variant,'native');
  for(const key of ['engineClock','frame','time','fixedSteps','alpha'])assert.equal(item.state.clocks[key],0);
  for(const key of ['elapsed','frames','wall'])assert.equal(item.state.clocks.simulation[key],0);
  assert.equal(item.state.clocks.simulation.captureFps,30);
  assert.equal(item.state.receivers.filter(r=>r.type==='SkinnedMesh'&&r.cast).length,1);
  assert.equal(item.image.file,view+'-'+variant+'.png');
  const bytes=readFileSync(dir+item.image.file);assert.equal(hash(bytes),item.image.sha256);assert.equal(bytes.length,item.image.bytes);
  assert.equal(bytes.readUInt32BE(16),402);assert.equal(bytes.readUInt32BE(20),874);assert.equal(item.image.visibility.visibleCandidate,true);
  assert.equal(item.shaders.length,1);
  for(const shader of item.shaders){assert.equal(shader.linked,true);assert.equal(shader.mesh,0);const source=readFileSync(dir+shader.file);assert.equal(hash(source),shader.sha256);const str=source.toString();
   assert.ok(str.includes('sampler2DShadow'));assert.ok(str.includes('dFdx'));
   for(const token of ['2704.0','144.0'])assert.equal(str.includes(token),variant==='tent');
   for(const token of ['2.399963','52.9829189'])assert.equal(str.includes(token),variant==='control');
  }
 }
 assert.notEqual(a.image.sha256,b.image.sha256);results.push({view,controlsEqual:true,control:a.image.sha256,tent:b.image.sha256});
}
assert.equal(readdirSync(dir).filter(f=>f.endsWith('.png')).length,18);
console.log(JSON.stringify({verifiedAt:new Date().toISOString(),reportSha256:hash(readFileSync(dir+'report.json')),pinSha256:host.pinSha256,hostSha256:host.hostSha256,hostFiles:Object.keys(host.files).length,verified:results,scope:'File and recorded-state verification; repeat stability and actual draw provenance rely on inspected capture source and retained telemetry. No browser rerun or acceptance.'},null,2));
