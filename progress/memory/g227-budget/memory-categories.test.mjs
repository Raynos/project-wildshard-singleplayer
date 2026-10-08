import assert from 'node:assert/strict';
import { test } from 'node:test';
import { memoryCategories } from './memory-categories.mjs';
const event = { timestamp: 12, categories: ['javascript','jit','images','layers','page','other'].map((type,i)=>({type,size:i*100})) };
function fake(fail) {
  const calls = []; let listener, removed = false;
  const inspector = { on(method, fn) { assert.equal(method,'Memory.trackingUpdate'); listener=fn; return () => {removed=true;}; },
    async send(method) { calls.push(method); if (method===fail) throw new Error('unsupported'); } };
  return { inspector, calls, emit: e => listener(e), removed:()=>removed };
}
test('records categories without collecting, and retires tracking and listener', async()=>{
  const f=fake(); const r=await memoryCategories(f.inspector,async()=>f.emit({event}));
  assert.deepEqual(r.samples,[event]); assert.deepEqual(r.errors,[]);
  assert.deepEqual(f.calls,['Memory.enable','Memory.startTracking','Memory.stopTracking','Memory.disable']); assert.equal(f.removed(),true);
});
test('unsupported tracking still disables the domain and removes listener',async()=>{
  const f=fake('Memory.startTracking'); const r=await memoryCategories(f.inspector,async()=>{});
  assert.equal(r.samples.length,0);assert.match(r.errors[0],/unsupported/);assert.equal(f.removed(),true);
  assert.deepEqual(f.calls,['Memory.enable','Memory.startTracking','Memory.disable']);
});
test('refuses duplicate or invalid categories rather than inventing totals',async()=>{
  const f=fake(); const r=await memoryCategories(f.inspector,async()=>f.emit({event:{...event,categories:event.categories.map(()=>({type:'page',size:100}))}}));
  assert.equal(r.samples.length,0);assert.match(r.errors[0],/Invalid/);assert.equal(f.removed(),true);
});
