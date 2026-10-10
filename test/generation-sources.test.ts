import {afterEach,expect,it} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture checks pinned downloads against a real local HTTP source.
import {createServer} from 'node:http';
// oxlint-disable-next-line import/no-nodejs-modules -- Encoder fixture invokes the currently running Node binary.
import {execPath} from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Source digest is the input contract.
import {createHash} from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Every generated input lives in an owned scratch directory.
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary source/cache root.
import {tmpdir} from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Relative output locations are checked by the shared backend.
import {resolve} from 'node:path';
import {externalGenerationInputs,generationTools} from '../scripts/generation-sources.mjs';

const roots:string[]=[];
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
it('pins raw bytes, reuses the same cache offline and refuses upstream changes without publication',async()=>{
  const root=mkdtempSync(resolve(tmpdir(),'generation-source-test-'));roots.push(root);let body='original',requests=0;
  const server=createServer((_request,response)=>{requests++;response.end(body);});
  await new Promise<void>(_resolve=>{server.listen(0,'127.0.0.1',_resolve);});
  try {
    const address=server.address();if(address===null || typeof address==='string')throw new Error('Missing fixture address');
    const source={path:'public/raw.bin',url:`http://127.0.0.1:${String(address.port)}/raw`,sha256:createHash('sha256').update(body).digest('hex')};
    const [cold]=await externalGenerationInputs([source],resolve(root,'cache'));if(cold===undefined)throw new Error('Missing source');
    expect(readFileSync(cold.file,'utf8')).toBe('original');body='changed';
    expect(await externalGenerationInputs([source],resolve(root,'cache'))).toEqual([cold]);expect(requests).toBe(1);
    await expect(externalGenerationInputs([source],resolve(root,'empty-cache'))).rejects.toThrow('digest changed');
    expect(readFileSync(cold.file,'utf8')).toBe('original');
    await expect(externalGenerationInputs([{...source,url:'file:///private/raw'}],resolve(root,'cache'))).rejects.toThrow('HTTPS');
  } finally{await new Promise<void>((_resolve,reject)=>{server.close(error=>error?reject(error):_resolve());});}
});
it('binds real encoder binary and version output, and refuses missing tools',()=>{
  const command=[execPath,'--version'];expect(generationTools([command])).toEqual(generationTools([command]));
  expect(Object.values(generationTools([command]))[0]).toMatch(/^[a-f0-9]{64}$/u);
  expect(()=>generationTools([['does-not-exist-g292','--version']])).toThrow('Missing generation tool');
});
