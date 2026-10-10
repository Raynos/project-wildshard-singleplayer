import { afterEach, describe, expect, it } from 'vitest';
import { generatedContent, inventoryOutputs, inventoryMarkdown, outputPolicy } from '../scripts/generation-inventory.mjs';

// oxlint-disable-next-line import/no-nodejs-modules -- Verify the inventory reads committed Git blobs, not the shared index.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The isolated Git fixture owns all temporary files.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture never writes inside another agent's checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture paths for Git.
import { dirname, resolve } from 'node:path';

const roots:string[]=[];
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});

describe('G292 output inventory', () => {
  it('requires both measured expense and small size, preserving normative and Blender inputs', () => {
    const row = {bytes:199_999,seconds:null,darwinOnly:null,blender:false,frozen:false};
    expect(outputPolicy(row)).toContain('candidate');
    expect(outputPolicy({...row,seconds:61})).toBe('retain small + expensive');
    expect(outputPolicy({...row,seconds:61,bytes:200_000})).toContain('candidate');
    expect(outputPolicy({...row,seconds:60})).toContain('candidate');
    expect(outputPolicy({...row,blender:true})).toBe('retain Blender (G293)');
    expect(outputPolicy({...row,darwinOnly:true})).toBe('retain Darwin normative');
    expect(outputPolicy({...row,frozen:true})).toBe('retain frozen baseline');
  });
  it('recognizes content outputs without classifying authored rows as generated', () => {
    for (const path of ['public/assets/x/baked/world.glb','public/assets/gpu/x.ktx2','public/assets/x/overlay.ktx2','public/assets/models/x.phone.glb',`src/shards/x/assets/${'a'.repeat(64)}`,'test/proof/x/checkpoints/basis.snap.gz','src/shards/x/look/map.baked.json','public/assets/x/map/top.webp','src/shards/x/ktx2.generated.ts','public/assets/packs/a.ws-pack']) expect(generatedContent(path),path).toBe(true);
    expect(generatedContent('src/shards/x/data/creatures.ts')).toBe(false);
    expect(generatedContent('src/shards/x/data/creatures.ts','// DO NOT EDIT: generator')).toBe(true);
    expect(generatedContent('src/shards/x/generators/creatures.ts')).toBe(false);
  });
  it('takes sizes and frozen membership from the committed tree despite staged and working changes',()=>{
    const root=mkdtempSync(resolve(tmpdir(),'generation-inventory-'));roots.push(root);
    const git=(...args:string[]):string=>execFileSync('git',args,{cwd:root,encoding:'utf8'});
    const put=(file:string,text:string):void=>{mkdirSync(dirname(resolve(root,file)),{recursive:true});writeFileSync(resolve(root,file),text);};
    git('init','-q');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');
    put('scripts/blender/targets.json','{"targets":{}}');
    put('lint/legacy-shards.json','{"shards":{"x-legacy":{"files":{"runtime/physics.baked.json":"hash"}}}}');
    put('src/shards/x-legacy/runtime/physics.baked.json','{}');
    put('src/shards/not-registered-legacy/runtime/physics.baked.json','{}');
    git('add','.');git('commit','-qm','fixture');
    put('src/shards/x-legacy/runtime/physics.baked.json','different working bytes');
    put('public/assets/gpu/uncommitted.ktx2','not committed');git('add','.');
    const report=inventoryOutputs(root);
    expect(report.rows.find(row=>row.path.includes('x-legacy'))?.bytes).toBe(2);
    expect(report.rows.find(row=>row.path.includes('x-legacy'))?.frozen).toBe(true);
    expect(report.rows.find(row=>row.path.includes('not-registered'))?.frozen).toBe(false);
    expect(report.rows.some(row=>row.path.includes('uncommitted'))).toBe(false);
  });
  it('renders missing evidence as unavailable rather than zero or a portability claim', () => {
    const row={path:'public/assets/x/baked/world.bin',bytes:22,generator:null,seconds:null,darwinOnly:null,blender:false,frozen:false,policy:'pending'};
    const report=inventoryMarkdown({pin:'abc',rows:[row]});
    expect(report).toContain('1 files, 22 bytes');
    expect(report).toContain('UNRESOLVED | unavailable | unproven');
  });
});
