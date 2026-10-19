import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkFirstUse, checkRig, assertComparable, assertShader } from './contract.mjs';
import { practiceBootFixture, assertFixture, assertCallOrder } from './fixture.mjs';
const read = path => readFileSync(new URL(path, import.meta.url),'utf8');
const rig = () => ({ cascades:1, shadowLights:1, sceneShadowLights:1, mode:'practical', maxFar:80, margin:60, fade:true,
  mapSize:[1024,1024], radius:2, bias:-0.00012, normalBias:0.05, breaks:[1] });
const pristine = () => ({ backendBuilds:null, programCount:0, renderFrame:0, renderCalls:0, gameFrame:0, gameTime:0,
  graphReceivers:0, hasFilter:false, rig:rig() });
test('first use accepts only null/unbuilt backend and pristine renderer', () => {
  assert.equal(checkFirstUse(pristine()),true);
  assert.equal(checkFirstUse({...pristine(),backendBuilds:0}),true);
  for (const key of ['backendBuilds','programCount','renderFrame','renderCalls','gameFrame','gameTime','graphReceivers'])
    assert.throws(() => checkFirstUse({...pristine(),[key]:1}));
  assert.throws(() => checkFirstUse({...pristine(),backendBuilds:undefined}));
  assert.throws(() => checkFirstUse({...pristine(),programCount:null}));
  assert.throws(() => checkFirstUse({...pristine(),hasFilter:true}));
});
test('every preserved rig parameter fails closed when changed', () => {
  for (const [key,value] of Object.entries({cascades:3,shadowLights:2,sceneShadowLights:2,mode:'custom',maxFar:81,margin:59,
    fade:false,mapSize:[2048,2048],radius:1.5,bias:0,normalBias:0.14,breaks:[0.1,0.3,1]}))
    assert.throws(() => checkRig({...rig(),[key]:value}), key);
});
test('fixed fixture has exactly the reviewed prepare delta', () => {
  const source=read('../../../../src/practiceBoot.ts');
  for(const variant of ['control','tent']) {
    const fixture=read(`./${variant}-practiceBoot.ts`);
    assertFixture(source,fixture,variant);
    assert.throws(() => assertFixture(source,fixture.replace('preparePracticeContent(game, product)','Promise.resolve({})'),variant));
    assert.throws(() => assertFixture(source,fixture+'\n// extra byte',variant));
    assert.throws(() => assertFixture(source,fixture,variant==='control'?'tent':'control'));
  }
  assert.throws(() => practiceBootFixture(source,'phoneSplits'));
  assert.throws(() => practiceBootFixture(source.replace('prepare: game','prepare: (game)'),'tent'));
});
test('actual source retains sky then prepare then start ordering', () => {
  const start=read('../../../../src/game/practiceDemo/startPracticeDemo.ts'), content=read('../../../../src/practiceContent.ts');
  assertCallOrder(start,content);
  assert.throws(() => assertCallOrder(start.replace('await game.buildSky();',''),content));
});
test('actual semantic controls cannot be normalised away', () => {
  const control={root:[1,2],bones:[0],camera:[3],frame:1,time:0};
  assertComparable(control,structuredClone(control));
  for(const key of Object.keys(control)) assert.throws(() => assertComparable(control,{...control,[key]:null}));
});
test('shader evidence requires arithmetic and rejects absent or opposite path', () => {
  const tent=' '.repeat(110)+' floor(x) / 2704.0 + x/144.0;', pcf=' '.repeat(110)+'2.399963229728653 * 52.9829189';
  assertShader(tent,'tent'); assertShader(pcf,'control');
  assert.throws(() => assertShader(tent+pcf,'tent')); assert.throws(() => assertShader(tent,'control'));
  assert.throws(() => assertShader(pcf,'tent')); assert.throws(() => assertShader('tentShadowFilter','tent'));
});

test('public rest controls survive actual THREE.Clock start and repeated gated deltas', async () => {
  const { Clock } = await import('three');
  const { GameClock } = await import('../../../../src/engine/core/clock.ts');
  const { prepareRest, assertRest } = await import('./rest-controls.mjs');
  const game = { frameCount:0, frameTime:0, clock:new Clock(), app:{ clock:new GameClock() } };
  prepareRest(game);
  game.clock.start();
  for (let i=0;i<5;i++) {
    assert.equal(game.frameGate(),false);
    assert.equal(game.clock.getDelta(),0);
    assertRest(game);
  }
  game.app.clock.tick(0);
  assert.throws(() => assertRest(game));
  assert.throws(() => prepareRest(game));
});
test('standard Game.start gate precedes simulation and composer rendering', () => {
  const source=read('../../../../src/engine/core/Game.ts');
  const start=source.slice(source.indexOf('  start(): void {'));
  const gate=start.indexOf('if (!forceFrame && !this.frameGate()) { this.clock.getDelta(); return; }');
  assert.ok(gate>start.indexOf('this.clock.start();'));
  for(const later of ['this.app.clock.tick(liveDt);','this._frameTime += dt;','composer.render(realDt);']) assert.ok(start.indexOf(later)>gate);
});

test('new entry resolver verifies originals and changed closure bytes fail closed', async () => {
  const { verifyEntries } = await import('./host-plugin.mjs');
  const { assertExactClosure } = await import('./source-gate.mjs');
  verifyEntries(new URL('../../../../',import.meta.url).pathname);
  const pin={'product/payload.bin':'a','host/control.js':'b','host/tent.js':'c'};
  assertExactClosure(pin,{...pin});
  for(const key of Object.keys(pin)) {
    assert.throws(() => assertExactClosure(pin,{...pin,[key]:'changed'}));
    const removed={...pin}; delete removed[key]; assert.throws(() => assertExactClosure(pin,removed));
  }
  assert.throws(() => assertExactClosure(pin,{...pin,'host/extra.js':'x'}));
});
test('common controls are absent from the production boot path and graph has no time input', () => {
  for(const file of ['practice.ts','practiceBoot.ts','game/practiceDemo/startPracticeDemo.ts']) {
    const source=read(`../../../../src/${file}`);
    assert.equal(source.includes('tent-shadow-diagnostic'),false);
    assert.equal(source.includes('prepareRest('),false);
  }
  const graph=JSON.parse(read('../selected-native-color/graph.json'));
  for(const node of Object.values(graph.nodes)) assert.ok(['mul','materialEmissive','attribute','materialColour'].includes(node.op));
});
