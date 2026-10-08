// Harness-only provenance must preserve decoder arguments/result, without owning decoded PCM or starting playback.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { AUDIO_INIT } from './inspect.mjs';

const context = vm.createContext({ WeakRef });
vm.runInContext(`
window=globalThis;
class Response { constructor(url){this.url=url;} arrayBuffer(){return Promise.resolve(new ArrayBuffer(16));} }
class BaseAudioContext {
 state='suspended'; currentTime=0; sampleRate=48000;
 decodeAudioData(...args){this.arguments=args;this.result=args[0].byteLength===0?Promise.reject(Error('decode failed')):Promise.resolve({decoded:true});return this.result;}
}
globalThis.Response=Response;globalThis.AudioContext=class extends BaseAudioContext {};globalThis.OfflineAudioContext=class extends BaseAudioContext {};
`, context);
vm.runInContext(AUDIO_INIT, context);
const result = await vm.runInContext(`(async()=>{
 const bytes=await new Response('/sprite.m4a').arrayBuffer(), copy=bytes.slice(2,8), ctx=new OfflineAudioContext();
 const callback=()=>{}, promise=ctx.decodeAudioData(copy,callback), originalPromise=promise===ctx.result,
  argumentsUnchanged=ctx.arguments[0]===copy&&ctx.arguments[1]===callback, buffer=await promise;
 await Promise.resolve();
 const failed=ctx.decodeAudioData(new ArrayBuffer(0));await failed.catch(()=>undefined);await Promise.resolve();
 return {source:__g227Audio[0].source,identity:__g227Audio[0].buffer.deref()===buffer,
  records:__g227Audio.length,weak:__g227Audio[0].buffer instanceof WeakRef,
  argumentsUnchanged, originalPromise,context:__g227AudioContexts[0].context.deref()===ctx,state:ctx.state};
})()`, context);
assert.equal(result.source, '/sprite.m4a');
assert.equal(result.identity, true);
assert.equal(result.records, 1, 'Failed decodes register no buffer');
assert.equal(result.weak, true);
assert.equal(result.argumentsUnchanged, true);
assert.equal(result.originalPromise, true);
assert.equal(result.context, true);
assert.equal(result.state, 'suspended', 'Attribution never resumes playback');
assert.equal(vm.runInContext('__g227Audio.length', context), 1);
vm.runInContext(AUDIO_INIT, context);
assert.equal(vm.runInContext('__g227Audio.length', context), 1, 'Repeated init preserves registrations');
console.log('Audio attribution preserves weak byte-copy provenance and decoder behavior; no playback or PCM ownership.');
