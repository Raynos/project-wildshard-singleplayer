// oxlint-disable-next-line import/no-nodejs-modules -- Exercise native ESM rather than Vitest's module transformer.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture owns only its project directory.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine source execution fixtures to repository tmp.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Give Node an exact absolute source module URL.
import { pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';
import { executeBundle } from '../src/sdk/executeBundle';

function native(source: string): string {
  mkdirSync('tmp', { recursive: true });
  const project = mkdtempSync(resolve('tmp/sdk-execute-'));
  try {
    return execFileSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import {existsSync,writeFileSync} from 'node:fs';
      import {dirname,resolve} from 'node:path';
      import {fileURLToPath,pathToFileURL} from 'node:url';
      const {executeBundle}=await import(process.argv[1]);
      const project=process.argv[2];
      ${source}
    `, pathToFileURL(resolve('src/sdk/executeBundle.ts')).href, project], { encoding: 'utf8', timeout: 15_000 });
  } finally { rmSync(project, { recursive: true, force: true }); }
}

test('raw modules preserve bytes, closure text and content-addressed namespace identity', () => {
  const result: unknown = JSON.parse(native(`
    const dependency=pathToFileURL(resolve(project,'dependency.mjs')).href;
    writeFileSync(fileURLToPath(dependency),"export const value='external';");
    const source="import {basename} from 'node:path'; import {value} from "+JSON.stringify(dependency)+"; export const name=basename('/one/two')+value; export const text='舟 🌲 é'; export const url=import.meta.url; export async function run(){return (await import("+JSON.stringify(dependency)+")).value;}";
    const old=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
    const [first,second]=await Promise.all([executeBundle(source,project),executeBundle(source,project)]);
    assert.equal(first,second);
    assert.equal(await executeBundle(source,project),first);
    assert.equal(first.text,old.text);assert.equal(first.name,old.name);
    assert.equal(first.run.toString(),old.run.toString());
    assert.equal(await first.run(),await old.run());
    assert.equal(existsSync(dirname(fileURLToPath(first.url))),false);
    assert.equal(first.url.includes('/src/'),false);
    const different=await executeBundle(source+'\\nexport const extra=1;',project);
    assert.notEqual(first,different);assert.equal(different.extra,1);
    console.log(JSON.stringify({rawBytes:Buffer.byteLength(source),encodedCharacters:Buffer.from(source).toString('base64').length,namespaceReused:true,cleanup:true}));
  `));
  expect(result).toMatchObject({ namespaceReused: true, cleanup: true });
  console.info("SDK source transport parity", result);
});

test('syntax, evaluation and async refusals clean only owned files and stay cached', () => {
  expect(native(`
    const {registerHooks}=await import('node:module');
    const attempted=[];
    const hook=registerHooks({load(url,context,next){if(url.includes('/sdk-execution/module-')&&url.endsWith('/bundle.mjs'))attempted.push(url);return next(url,context);}});
    const keep=resolve(project,'keep.txt');writeFileSync(keep,'peer bytes');
    for(const [source,pattern] of [
      ['export const =',/Unexpected token/],
      ["throw new Error('evaluation refusal')",/evaluation refusal/],
      ["await Promise.reject(new Error('async refusal'))",/async refusal/]
    ]) {
      const first=executeBundle(source,project),second=executeBundle(source,project);
      assert.equal(first,second);
      await assert.rejects(first,pattern);await assert.rejects(second,pattern);
        assert.equal(existsSync(keep),true);
    }
    assert.equal(attempted.length,3);
    for(const url of attempted)assert.equal(existsSync(dirname(fileURLToPath(url))),false);
    hook.deregister();
  `)).toBe('');
});


test('bundle execution keeps native function text inside the Vitest host', async () => {
  const source = 'export function probe(){return import.meta.url;}';
  const loaded = await executeBundle(source, 'src/shards/pine-hollow');
  if (typeof loaded !== 'object' || loaded === null || !('probe' in loaded) || typeof loaded.probe !== 'function')
    throw new Error('Missing native exported probe');
  expect(loaded.probe.toString()).toBe('function probe(){return import.meta.url;}');
});
