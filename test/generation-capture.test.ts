import { describe, expect, it } from 'vitest';
import { captureOutcome } from '../scripts/generation-capture.mjs';

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
