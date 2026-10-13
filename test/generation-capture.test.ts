import { describe, expect, it } from 'vitest';
import { captureOutcome, capturePreview } from '../scripts/generation-capture.mjs';

// oxlint-disable-next-line import/no-nodejs-modules -- Serve the real shipping version protocol without a browser or game.
import { createServer } from 'node:http';

describe('captured generation comparison',()=>{
  const capture={version:1,revision:'old',build:'old-build',inputs:{a:'old-hash'},ground:{heights:'abc'},actors:[{id:1,at:{x:2,y:3,z:4}}]};
  it('excludes only explicit top-level source provenance',()=>{
    expect(captureOutcome(JSON.stringify(capture))).toBe(captureOutcome(JSON.stringify({...capture,revision:'new',build:'new-build',inputs:{a:'new-hash'}})));
  });
  it('supports older capture headers without inventing a missing input map',()=>{
    const {inputs:_inputs,...older}=capture;
    expect(captureOutcome(JSON.stringify(older))).toBe(captureOutcome(JSON.stringify(capture)));
  });
  it('retains every actor, clock, collision and nested provenance value',()=>{
    const before=captureOutcome(JSON.stringify(capture));
    expect(captureOutcome(JSON.stringify({...capture,actors:[{id:1,at:{x:2.0000001,y:3,z:4}}]}))).not.toBe(before);
    expect(captureOutcome(JSON.stringify({...capture,ground:{heights:'changed'}}))).not.toBe(before);
    expect(captureOutcome(JSON.stringify({...capture,time:1}))).not.toBe(before);
    expect(captureOutcome(JSON.stringify({...capture,ground:{heights:'abc',inputs:{changed:true}}}))).not.toBe(before);
  });
  it('refuses noncapture data instead of erasing arbitrary fields',()=>{
    expect(()=>captureOutcome('{}')).toThrow();
    expect(()=>captureOutcome(JSON.stringify({...capture,inputs:null}))).toThrow();
  });
});

it('pins map previews through the shipping build/time version protocol', async () => {
  const revision='a'.repeat(40);
  let build=`${revision.slice(0,7)}-fixture`,status=200;
  const server=createServer((_request,response)=>{response.statusCode=status;response.setHeader('Content-Type','application/json');response.end(JSON.stringify({build,time:'2026-10-13T00:00:00Z'}));});
  await new Promise<void>(resolve=>{server.listen(0,'127.0.0.1',resolve);});
  try {
    const address=server.address();
    if (address===null || typeof address==='string') throw new Error('Missing fixture server address');
    const spec={url:`http://127.0.0.1:${address.port}`,revision};
    expect(await capturePreview(spec)).toMatchObject({...spec,build});
    build=`${'b'.repeat(7)}-other`;
    await expect(capturePreview(spec)).rejects.toThrow('revision mismatch');
    status=503;
    await expect(capturePreview(spec)).rejects.toThrow('unavailable');
  } finally {await new Promise<void>((resolve,reject)=>{server.close(error=>{if(error)reject(error);else resolve();});});}
});
