// oxlint-disable-next-line import/no-nodejs-modules -- The source catalogue belongs to this checkout.
import { cwd } from 'node:process';
import { expect, test } from 'vitest';
import { discoverGeneration } from '../scripts/generate.mjs';

const root=cwd(),required=['src/sdk/bake/rawTexture.ts','src/sdk/bake/byteCodec.ts'];

test('isolated image texture adapters include the raw pixel packer and its codec', () => {
  let checked=0;
  for(const job of discoverGeneration(root).jobs){
    const covers=(file:string):boolean=>job.inputRoots.some(input=>file===input||file.startsWith(`${input}/`));
    if(!covers('src/sdk/bake/texture.ts'))continue;
    checked++;
    for(const file of required)expect(covers(file),`${job.id}: ${file}`).toBe(true);
  }
  expect(checked).toBeGreaterThan(0);
});
