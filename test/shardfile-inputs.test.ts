// oxlint-disable-next-line import/no-nodejs-modules -- Owned compiler input fixtures.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise promise reads in the recorder.
import { readFile } from 'node:fs/promises';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Simulate an external writer outside the recorder's process.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture subprocess runtime.
import process from 'node:process';
import { afterEach, expect, it } from 'vitest';
import { captureProductInputs, productInputKey, productToolchainKey, recordBundle, matchingProductInputKey, publishProductInputs } from '../scripts/shardfile-inputs.mjs';
import { InputHashMemo } from '../scripts/bake-input-hashes.mjs';
import { build } from '../scripts/shardfile-vite.mjs';

const owned: string[] = [];
afterEach(() => { for (const root of owned.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture(): string {
  mkdirSync('tmp', { recursive: true }); const root = mkdtempSync(resolve('tmp/product-inputs-')); owned.push(root);
  for (const path of ['src/engine', 'src/sdk', 'src/format', 'assets']) mkdirSync(resolve(root,path), { recursive: true });
  for (const path of ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml']) writeFileSync(resolve(root,path),'{}');
  writeFileSync(resolve(root,'entry.ts'), "import {value} from './src/engine/used'; export const answer=value;\n");
  writeFileSync(resolve(root,'src/engine/used.ts'),'export const value=1;\n');
  writeFileSync(resolve(root,'asset.txt'),'asset'); return root;
}
it('keys native-bundled modules, sync and async reads, negative probes and real directory inventories only', async () => {
  const root = fixture(), receipt = resolve(root,'receipt.json'), memo = new InputHashMemo(root);
  await captureProductInputs(root,receipt,async () => {
    readFileSync(resolve(root,'asset.txt')); await readFile(resolve(root,'asset.txt'));
    existsSync(resolve(root,'optional.json')); readdirSync(resolve(root,'assets'));
    await build({root,configFile:false,publicDir:false,logLevel:'silent',build:{write:false,minify:false,lib:{entry:resolve(root,'entry.ts'),formats:['es'],fileName:'fixture'}}});
  });
  const key = () => productInputKey(root,receipt,[],memo), before = key(); expect(before).toMatch(/^[a-f0-9]{64}$/u);
  writeFileSync(resolve(root,'src/engine/unread.generated.ts'),'unread'); expect(key()).toBe(before);
  writeFileSync(resolve(root,'src/engine/used.ts'),'export const value=2;\n'); expect(key()).toBeUndefined();
  writeFileSync(resolve(root,'src/engine/used.ts'),'export const value=1;\n'); expect(key()).toBe(before);
  writeFileSync(resolve(root,'optional.json'),'{}'); expect(key()).toBeUndefined(); rmSync(resolve(root,'optional.json'));
  writeFileSync(resolve(root,'assets/new.txt'),'new'); expect(key()).toBeUndefined(); rmSync(resolve(root,'assets/new.txt'));
  expect(productInputKey(root,receipt,['--other-flags'],memo)).not.toBe(key());
  expect(productInputKey(root,receipt,[],new InputHashMemo(fixture()))).toBeUndefined();
  rmSync(resolve(root,'asset.txt'));mkdirSync(resolve(root,'asset.txt'));
  expect(key()).toBeUndefined();rmSync(resolve(root,'asset.txt'),{recursive:true});
  symlinkSync('entry.ts',resolve(root,'asset.txt'));
  expect(key()).toBeUndefined();rmSync(resolve(root,'asset.txt'));writeFileSync(resolve(root,'asset.txt'),'asset');
  expect(key()).toBe(before);
  writeFileSync(receipt,'{}'); expect(key()).toBeUndefined();
});

it('keeps another revision from replacing a matching captured read set', async () => {
  const first=fixture(), second=fixture(), directory=resolve(first,'receipts'), recipe=['same-product'];
  writeFileSync(resolve(second,'asset.txt'),'second');
  const receipts=[];
  for(const root of [first,second]) {
    const receipt=resolve(root,'trace.json'), memo=new InputHashMemo(root);
    await captureProductInputs(root,receipt,()=>{readFileSync(resolve(root,'asset.txt'));recordBundle({output:[]});return Promise.resolve();});
    const key=productInputKey(root,receipt,recipe,memo); if(key===undefined)throw new Error('Fixture requires a complete receipt');
    publishProductInputs(directory,receipt,key);receipts.push(key);
  }
  expect(receipts[0]).not.toBe(receipts[1]);
  expect(matchingProductInputKey(first,directory,recipe,new InputHashMemo(first))).toBe(receipts[0]);
  expect(matchingProductInputKey(second,directory,recipe,new InputHashMemo(second))).toBe(receipts[1]);
  writeFileSync(resolve(first,'asset.txt'),'third');
  expect(matchingProductInputKey(first,directory,recipe,new InputHashMemo(first))).toBeUndefined();
});
it('keys compiler writes, refuses concurrent source edits and rejects incomplete traces', async () => {
  const root = fixture(), receipt = resolve(root,'receipt.json');
  await expect(captureProductInputs(root,receipt,() => {
    readFileSync(resolve(root,'asset.txt')); writeFileSync(resolve(root,'asset.txt'),'changed');
    recordBundle({output:[]}); return Promise.resolve();
  })).resolves.toBeUndefined(); // declared compiler writes are keyed by their resulting bytes
  await expect(captureProductInputs(root,receipt,() => {
    readFileSync(resolve(root,'asset.txt'));
    execFileSync(process.execPath,['-e', 'require("node:fs").writeFileSync(process.argv[1],"external")',resolve(root,'asset.txt')]);
    recordBundle({output:[]}); return Promise.resolve();
  })).rejects.toThrow('Product input changed during build');
  await expect(captureProductInputs(root,receipt,() => Promise.resolve())).rejects.toThrow('Incomplete');
});
it('keeps mandatory SDK and format sources in every recipe without unread generated tables', () => {
  const root = fixture(), memo = new InputHashMemo(root), key = () => productToolchainKey(root,memo), before = key();
  writeFileSync(resolve(root,'src/sdk/unread.generated.ts'),'generated'); expect(key()).toBe(before);
  writeFileSync(resolve(root,'src/sdk/compiler.ts'),'compiler'); expect(key()).not.toBe(before);
  const sdk = key(); writeFileSync(resolve(root,'src/format/schema.ts'),'schema'); expect(key()).not.toBe(sdk);
});

it('invalidates when a new native directory entry can take precedence', async () => {
  const root=fixture(), receipt=resolve(root,'receipt.json'), memo=new InputHashMemo(root);
  mkdirSync(resolve(root,'module'));
  writeFileSync(resolve(root,'module/index.ts'),'export const value=1;');
  writeFileSync(resolve(root,'entry.ts'),"import {value} from './module'; export const answer=value;");
  await captureProductInputs(root,receipt,async()=>{
    await build({root,configFile:false,publicDir:false,logLevel:'silent',build:{write:false,lib:{entry:resolve(root,'entry.ts'),formats:['es'],fileName:'fixture'}}});
  });
  const before=productInputKey(root,receipt,[],memo); expect(before).toMatch(/^[a-f0-9]{64}$/u);
  writeFileSync(resolve(root,'module/index.mts'),'export const value=2;');
  expect(productInputKey(root,receipt,[],memo)).not.toBe(before);
});

it('rechecks absent descendants after a file parent becomes a directory', async () => {
  const root=fixture(), receipt=resolve(root,'receipt.json'), memo=new InputHashMemo(root);
  await captureProductInputs(root,receipt,()=>{
    existsSync(resolve(root,'asset.txt/child.ts'));recordBundle({output:[]});return Promise.resolve();
  });
  const before=productInputKey(root,receipt,[],memo);expect(before).toMatch(/^[a-f0-9]{64}$/u);
  rmSync(resolve(root,'asset.txt'));mkdirSync(resolve(root,'asset.txt'));
  writeFileSync(resolve(root,'asset.txt/child.ts'),'new input');
  expect(productInputKey(root,receipt,[],memo)).toBeUndefined();
});
