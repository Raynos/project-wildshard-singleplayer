import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { installedInventory, assertIdentity, bytesUnder } from './manifest.mjs';
import { safeNew } from './build.mjs';
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
