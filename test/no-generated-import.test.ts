// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual cheap lint CLI.
import {spawnSync} from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own and retire bounded rule fixtures.
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve exact fixture paths only.
import {resolve} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the current runtime for the linter.
import {execPath} from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the defining rule beside this test.
import {fileURLToPath} from 'node:url';
import {expect,test} from 'vitest';
import {generatedImportContext} from '../lint/no-generated-import.mjs';

function fixture(run:(root:string,put:(path:string,text:string)=>void)=>void):void{
  mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/generated-import-'));
  const put=(path:string,text:string):void=>{const target=resolve(root,path);mkdirSync(resolve(target,'..'),{recursive:true});writeFileSync(target,text);};
  try{run(root,put);}finally{rmSync(root,{recursive:true,force:true});}
}

test('declared outputs and public conditional exports resolve without a type program',()=>fixture((root,put)=>{
  put('src/game/package.json',JSON.stringify({exports:{'./table':{types:'./table.generated.ts',default:'./table.generated.ts'},'./rows/*':'./data/*.json'}}));
  const check=generatedImportContext(root,['src/game/table.generated.ts','src/game/data/rows.json','src/game/binary.bin'],['src/game/table.generated.ts']);
  expect(check('src/game/reader.ts','@wildshard/game/table')).toBe(false);
  expect(check('src/game/reader.ts','./table.generated')).toBe(false);
  expect(check('src/game/reader.ts','@wildshard/game/rows/rows')).toBe(true);
  expect(check('test/reader.ts','../src/game/binary.bin?url')).toBe(true);
  expect(check('src/game/unit.test.ts','vitest')).toBe(false);
  expect(check('src/game/reader.ts','./authored.json')).toBe(false);
  expect(check('src/game/reader.ts','./unknown.generated.json')).toBe(true);
}));

test('actual lint covers value, type, export, dynamic and require imports with exact shrinking debt',()=>fixture((root,put)=>{
  const helper=fileURLToPath(new URL('../lint/no-generated-import.mjs',import.meta.url));
  put('scripts/generation-jobs.json',JSON.stringify({jobs:[{outputs:['src/game/rows.json','src/game/raw.bin']}]}));
  put('policy.json',JSON.stringify({sources:[],files:{'src/game/old.ts':1}}));
  put('rule.mjs',`import {noGeneratedImportRule} from ${JSON.stringify(helper)};export default {meta:{name:'wildshard'},rules:{'no-generated-import':noGeneratedImportRule(${JSON.stringify(root)},${JSON.stringify(resolve(root,'policy.json'))})}};`);
  const run=(file:string,source:string,count=false)=>{
    put(file,source);put('lint.json',JSON.stringify({jsPlugins:[resolve(root,'rule.mjs')],categories:{correctness:'off'},rules:{'wildshard/no-generated-import':['error',{count}]}}));
    return spawnSync(execPath,[resolve('node_modules/oxlint/bin/oxlint'),'-c',resolve(root,'lint.json'),'--no-ignore',resolve(root,file)],{encoding:'utf8',maxBuffer:256*1024*1024});
  };
  for(const code of [
    'import rows from "./rows.json";', 'import type {X} from "./x.generated";',
    'export {X} from "./x.generated.ts";', 'export * from "./x.generated.ts";',
    'const p=import("./x.generated.json");', 'type X=import("./x.generated.json").X;',
    'const rows=require("./rows.json");', 'import bytes from "./raw.bin?url";',
  ]){const result=run('src/game/new.ts',code);expect(result.status,result.stdout+result.stderr).toBe(1);expect(result.stdout+result.stderr).toContain('NO-GENERATED-IMPORT');}
  expect(run('src/game/old.ts','import rows from "./rows.json";').status).toBe(0);
  expect(run('src/game/old.ts','import rows from "./rows.json";',true).status).toBe(1);
  expect(run('src/game/old.ts','import rows from "./rows.json";import more from "./x.generated.json";').status).toBe(1);
  expect(run('test/new.test.ts','import rows from "../src/game/rows.json";').status).toBe(1);
  expect(run('src/game/unit.test.ts','import {test} from "vitest";import {f} from "./authored";').status).toBe(0);
  expect(run('scripts/bake.mjs','import rows from "./x.generated.json";').status).toBe(0);
}));
