import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { installedInventory, assertIdentity, bytesUnder } from './manifest.mjs';
import { safeNew, virtualTables } from './build.mjs';
const scratch=()=>mkdtempSync(resolve('tmp/conch-tent-dependency-test-'));
test('installed inventory includes bytes, new files and exact link targets',()=>{
  const root=scratch();try {
    mkdirSync(resolve(root,'node_modules/pkg'),{recursive:true});
    writeFileSync(resolve(root,'node_modules/pkg/a.js'),'a');
    symlinkSync('pkg',resolve(root,'node_modules/alias'));
    const before=installedInventory(root);assert.equal(before.links['node_modules/alias'],'node_modules/pkg');
    writeFileSync(resolve(root,'node_modules/pkg/a.js'),'b');assert.throws(()=>assertIdentity(before,installedInventory(root)));
    writeFileSync(resolve(root,'node_modules/pkg/a.js'),'a');writeFileSync(resolve(root,'node_modules/pkg/b.js'),'b');
    assert.throws(()=>assertIdentity(before,installedInventory(root)));
  }finally{rmSync(root,{recursive:true});}
});
test('installed dependency links outside root and existing outputs fail closed',()=>{
  const root=scratch();try {
    mkdirSync(resolve(root,'node_modules'));symlinkSync('../../..',resolve(root,'node_modules/escape'));
    assert.throws(()=>installedInventory(root));assert.throws(()=>safeNew(root));
    assert.throws(()=>safeNew(resolve(root,'node_modules/escape/new')));
  }finally{rmSync(root,{recursive:true});}
});
test('budget counts bytes and rejects output symlinks',()=>{
  const root=scratch();try {
    writeFileSync(resolve(root,'a'),'12345');assert.equal(bytesUnder(root),5);
    symlinkSync('a',resolve(root,'b'));assert.throws(()=>bytesUnder(root));
  }finally{rmSync(root,{recursive:true});}
});

test('virtual generated TypeScript tables retain .ts loader identity and exact bytes',async()=>{
  const { starterArmClipsTableSource }=await import('../../../../scripts/gen-starter-arm-clips.mjs');
  const { starterEffectsTableSource }=await import('../../../../scripts/gen-starter-effects.mjs');
  const sources=new Map([
    [resolve('src/game/systems/viewmodel/clips.generated'),starterArmClipsTableSource()],
    [resolve('src/game/systems/effects/starter.generated'),starterEffectsTableSource()],
  ]);
  const plugin=virtualTables(sources);
  for(const [key,source] of sources) {
    assert.ok(source.includes('as const'));
    const id=plugin.resolveId(key,undefined);
    assert.ok(id.endsWith('.ts'));
    assert.equal(plugin.load(id),source);
    assert.equal(plugin.resolveId(key+'.ts',undefined),id);
  }
  assert.equal(plugin.resolveId('three',undefined),null);
  assert.equal(plugin.load('unrelated'),null);
});
