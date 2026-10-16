// oxlint-disable-next-line import/no-nodejs-modules -- The focused bundler fixture owns its small output tree.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture root and entry are explicit local paths.
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { build } from 'vite';

it('compiles the literal output-only registry with a lazy copied runtime and embedded inventory', async () => {
  mkdirSync(resolve('tmp'), {recursive:true}); const root = mkdtempSync(join(resolve('tmp'),'registry-build-'));
  try {
    const folder = join(root,'out/probe'); mkdirSync(join(folder,'runtime'),{recursive:true});
    writeFileSync(join(folder,'runtime/index.ts'),'export default class Probe { world() {} }\n');
    writeFileSync(join(folder,'shard.json'),JSON.stringify({runtime:{files:[{path:'runtime/index.ts',hash:'b'.repeat(64),bytes:55,lines:1}]}}));
    const result = await build({root,configFile:false,publicDir:false,logLevel:'silent',build:{write:false,minify:false,
      lib:{entry:resolve('src/outputRuntimeRegistry.ts'),formats:['es'],fileName:'registry'}}});
    const bundled = Array.isArray(result) ? result[0] : result;
    if (bundled === undefined || !('output' in bundled)) throw new Error('Registry bundle missing');
    const chunks = bundled.output.filter(file => file.type === 'chunk');
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    const entry = chunks.find(file => file.isEntry);
    expect(entry?.code).not.toContain('import.meta.glob'); expect(entry?.code).toContain('runtime/index.ts');
    expect(entry?.code).toContain('b'.repeat(64)); expect(chunks.some(file => file.facadeModuleId === join(folder,'runtime/index.ts'))).toBe(true);
    expect(chunks.every(file => !file.code.includes('/src/shards/'))).toBe(true);
  } finally { rmSync(root,{recursive:true,force:true}); }
});
