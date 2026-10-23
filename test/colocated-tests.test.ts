// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real lint policy with an owned engine test fixture.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Create and remove only the temporary policy fixture.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve exact engine project members and the current lint CLI.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the lint subprocess on the current runtime.
import { execPath } from 'node:process';
import ts from '@typescript/typescript6';
import { expect,test } from 'vitest';

const units=['src/engine/boot/stall.test.ts','src/engine/boot/waits.test.ts','src/engine/boot/weights.test.ts',
 'src/engine/audio/util.test.ts','src/engine/ai/strikes.test.ts'];

test('the actual engine composite project includes its colocated unit tests',()=>{
 const project=ts.getParsedCommandLineOfConfigFile(resolve('tsconfig.engine.json'),{},
  {...ts.sys,onUnRecoverableConfigFileDiagnostic:diagnostic=>{throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText,'\n'));}});
 expect(project).toBeDefined();
 for(const file of units)expect(project?.fileNames).toContain(resolve(file));
});

test('colocated tests retain the hard refusal of module replacement',()=>{
 mkdirSync('src/engine',{recursive:true});const root=mkdtempSync(resolve('src/engine/unit-policy-'));
 const target=resolve(root,'example.test.ts');
 try{
  writeFileSync(target,"import {vi} from 'vitest'; vi.mock('virtual-package');\n");
  const result=spawnSync(execPath,[resolve('scripts/lint-fast.mjs'),target],{encoding:'utf8'});
  expect(result.status,result.stdout+result.stderr).toBe(1);
  expect(result.stdout+result.stderr).toContain('no-module-mock');
 }finally{rmSync(root,{recursive:true,force:true});}
});
