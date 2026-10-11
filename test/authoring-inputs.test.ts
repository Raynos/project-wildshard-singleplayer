// oxlint-disable-next-line import/no-nodejs-modules -- This test owns the temporary authoring source tree.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture files are resolved beneath the owned temporary root.
import { dirname, join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- No source checkout is changed by this audit fixture.
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { auditAuthoringInputs, isAuthoringInput } from '../scripts/authoring-inputs.mjs';

function fixture(): {root:string;put:(file:string,source:string)=>void;close:()=>void} {
  const root = mkdtempSync(join(tmpdir(), 'authoring-inputs-'));
  return {root, put: (file,source) => {const path = join(root,file);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,source);},close:()=>{rmSync(root,{recursive:true,force:true});}};
}
it('classifies the six authoring folders and refuses runtime, legacy, sibling shards and game sources', () => {
  expect(isAuthoringInput('src/format/edgeProfiles.ts','fixture')).toBe(true);
  for (const folder of ['generators','data','quests','blender','assets','behaviour']) expect(isAuthoringInput(`src/shards/fixture/${folder}/source.ts`,'fixture')).toBe(true);
  for (const file of ['src/shards/fixture/runtime/source.ts','src/shards/fixture-legacy/data/source.ts','src/shards/other/data/source.ts','src/engine/source.ts','src/game/source.ts','src/sdk/runtime/source.ts','src/commons/runtime/source.ts']) expect(isAuthoringInput(file,'fixture')).toBe(false);
});
it('closes relative imports and defining SDK/commons exports without executing source or mistaking comments for imports', () => {
  const f = fixture();
  try {
    f.put('src/sdk/package.json',JSON.stringify({exports:{'./bake':'./bake.ts'}}));
    f.put('src/commons/package.json',JSON.stringify({exports:{'./pack':'./pack.ts'}}));
    f.put('src/format/package.json',JSON.stringify({exports:{'./contract':'./contract.ts'}}));
    f.put('src/format/contract.ts','export const contract = 1;');
    f.put('src/sdk/bake.ts',"import {contract} from '@wildshard/format/contract'; export const bake = contract;");f.put('src/commons/pack.ts',"import {bake} from '@wildshard/sdk/bake'; export const pack = bake;");
    f.put('src/shards/fixture/data/rows.ts','export const rows = [1];');
    const entry = 'src/shards/fixture/generators/build.ts';
    f.put(entry,"import {pack} from '@wildshard/commons/pack'; import {rows} from '../data/rows'; // import '../runtime/hidden';\nthrow new Error('must never execute');");
    const report = auditAuthoringInputs(f.root,'fixture',entry);
    expect(report.issues).toEqual([]);expect(report.files).toHaveLength(5);expect(report.files).toContain('src/format/contract.ts');expect(report.files).toContain('src/sdk/bake.ts');
  } finally {f.close();}
});
it('refuses runtime reached indirectly through the SDK and retains the immediate importer', () => {
  const f = fixture();
  try {
    f.put('src/sdk/package.json',JSON.stringify({exports:{'./bake':'./bake.ts'}}));
    f.put('src/sdk/bake.ts',"import '../game/runtime.ts';");
    f.put('src/game/runtime.ts','export const runtime = 1;');
    const entry = 'src/shards/fixture/generators/build.ts';f.put(entry,"import '@wildshard/sdk/bake';");
    expect(auditAuthoringInputs(f.root,'fixture',entry).issues).toEqual([{file:'src/game/runtime.ts',from:'src/sdk/bake.ts',reason:'outside-authoring'}]);
  } finally {f.close();}
});
it('refuses type-only runtime imports, unresolved private exports, computed imports and glob imports', () => {
  const f = fixture();
  try {
    f.put('src/shards/fixture/runtime/types.ts','export interface Runtime {}');
    const entry = 'src/shards/fixture/generators/build.ts';
    f.put(entry,"import type {Runtime} from '../runtime/types'; import '@wildshard/sdk/private'; import(name); import.meta.glob('../runtime/*');");
    const issues = auditAuthoringInputs(f.root,'fixture',entry).issues;
    expect(issues.map(issue=>issue.reason).sort()).toEqual(['computed-import','glob-import','outside-authoring','unresolved-import']);
  } finally {f.close();}
});

it('resolves literal string expressions and still refuses concealed runtime or computed imports', () => {
  const f = fixture();
  try {
    const entry = 'src/shards/fixture/generators/build.ts';
    f.put('src/shards/fixture/data/rows.ts', 'export const rows = [];');
    f.put(entry, "import('../data/' + 'rows.ts'); import('assemblyscript/dist/' + 'asc.js');");
    const allowed = auditAuthoringInputs(f.root, 'fixture', entry);
    expect(allowed.issues).toEqual([]);
    expect(allowed.files).toContain('src/shards/fixture/data/rows.ts');
    f.put(entry, `import('../run' + 'time/hidden.ts'); import('../data/' + variable); import(\`../data/\${variable}\`); import(resolve('literal'));`);
    expect(auditAuthoringInputs(f.root, 'fixture', entry).issues.map(issue => issue.reason).sort())
      .toEqual(['computed-import', 'computed-import', 'computed-import', 'outside-authoring']);
  } finally { f.close(); }
});
it('reports the runtime edges of a legacy page producer even when its entry already lies outside authoring', () => {
  const f = fixture();
  try {
    const entry = 'scripts/bake/coatPage.ts';f.put(entry,"import '../../src/shards/fixture/runtime/hulls';");
    f.put('src/shards/fixture/runtime/hulls.ts','export const hulls = [];');
    expect(auditAuthoringInputs(f.root,'fixture',entry).issues).toEqual([{file:entry,from:null,reason:'outside-authoring'},{file:'src/shards/fixture/runtime/hulls',from:entry,reason:'outside-authoring'}]);
  } finally {f.close();}
});

it('refuses an escaping entry before reading it', () => {
  const f = fixture();
  try {expect(auditAuthoringInputs(f.root,'fixture','../outside.ts').issues).toEqual([{file:'../outside.ts',from:null,reason:'outside-authoring'}]);}
  finally {f.close();}
});
