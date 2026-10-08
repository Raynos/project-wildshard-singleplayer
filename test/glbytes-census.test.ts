// oxlint-disable-next-line import/no-nodejs-modules -- Tests the exact pre-boot WebGL instrumentation without requiring a GPU.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Each census runs in an isolated context with a deterministic GL fixture.
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

const file = readFileSync('scripts/parity/glbytes.mjs', 'utf8');
const source = file.slice(file.indexOf('String.raw`') + 11, file.lastIndexOf('`;'));
interface Resource { id: string; kind: string; bytes: number; owner: string; asset: string; labelled: boolean }
interface Census { resources: Resource[]; totalBytes: number; listedBytes: number; reconciled: boolean; unlabelled: number }
function census(scenario: string): Census[] {
  return runInNewContext(`
    class GL {
      listeners = new Map(); bindings = new Map(); canvas = {width:16,height:16,addEventListener:(name,fn,options)=>{if(options?.once!==true)throw Error('Loss observer must release itself');this.listeners.set(name,fn);}}; lost = false;
      createTexture() { return {}; } createBuffer() { return {}; } createRenderbuffer() { return {}; }
      getParameter(key) { return this.bindings.get(key); } isContextLost() { return this.lost; }
      loss = {loseContext:()=>{this.lost=true;const delivered=this.listeners.get('webglcontextlost');this.listeners.delete('webglcontextlost');delivered?.();}, restoreContext:()=>{this.lost=false;}};
      getExtension(name) { return name === 'WEBGL_lose_context' ? this.loss : null; }
      bindTexture(_target, value) { this.bindings.set(0x8069,value); }
      bindBuffer(_target, value) { this.bindings.set(0x8894,value); }
      bindRenderbuffer(_target, value) { this.bindings.set(0x8ca7,value); }
      texImage2D() {} compressedTexImage2D() {} generateMipmap() {}
      renderbufferStorageMultisample() {} bufferData() {}
      deleteTexture() {} deleteBuffer() {} deleteRenderbuffer() {}
    }
    const window = {WebGL2RenderingContext:GL};
    ${source}
    const gl = new GL();
    ${scenario}
    window.__sc_gl().map(({gl,...record})=>record);
  `) as Census[];
}
it('enumerates zero-byte creations and labelled mips, compressed blocks, buffers and multisample storage exactly', () => {
  const rows = census(`
    window.__sc_gl_scope('renderer','builtin',()=>gl.createTexture());
    const t = gl.createTexture(), data = new Uint8Array(64);
    window.__sc_label_source(data,'pine/trees','/assets/pine/tree.ktx2');
    gl.bindTexture(0x0de1,t); gl.texImage2D(0x0de1,0,0x8058,4,4,0,0x1908,0x1401,data); gl.generateMipmap(0x0de1);
    const compressed = gl.createTexture(); window.__sc_label_gl(compressed,'pine/ground','ground.ktx2');
    gl.bindTexture(0x0de1,compressed); gl.compressedTexImage2D(0x0de1,0,0x83f1,5,5,0,new Uint8Array(32));
    const rb = gl.createRenderbuffer(); window.__sc_label_gl(rb,'renderer','shadow-depth');
    gl.bindRenderbuffer(0x8d41,rb); gl.renderbufferStorageMultisample(0x8d41,4,0x8058,8,8);
    const b = gl.createBuffer(), vertices = new Float32Array(12);
    window.__sc_label_source(vertices,'pine/trees','tree.glb/position'); gl.bindBuffer(0x8892,b); gl.bufferData(0x8892,vertices,0x88e4);
  `);
  expect(rows).toHaveLength(1);
  const row = rows[0];
  expect(row?.totalBytes).toBe(84 + 32 + 1024 + 48);
  expect(row?.listedBytes).toBe(row?.totalBytes);
  expect(row?.reconciled).toBe(true);
  expect(row?.unlabelled).toBe(0);
  expect(row?.resources).toHaveLength(5);
  expect(row?.resources.map((r) => [r.asset, r.bytes])).toEqual([
    ['shadow-depth', 1024], ['/assets/pine/tree.ktx2', 84], ['tree.glb/position', 48], ['ground.ktx2', 32], ['builtin', 0],
  ]);
  expect(new Set(row?.resources.map((r) => r.id)).size).toBe(5);
});
it('exposes unlabelled entries, preserves identity on resize and removes deleted allocations', () => {
  const rows = census(`
    const t = gl.createTexture(); gl.bindTexture(0x0de1,t);
    gl.texImage2D(0x0de1,0,0x8058,2,2,0,0x1908,0x1401,null);
    const before = window.__sc_gl()[0].resources[0].id;
    gl.texImage2D(0x0de1,0,0x8058,4,4,0,0x1908,0x1401,null);
    if(window.__sc_gl()[0].resources[0].id !== before) throw new Error('unstable id');
    const deleted = gl.createBuffer(); gl.bindBuffer(0x8892,deleted); gl.bufferData(0x8892,999,0x88e4); gl.deleteBuffer(deleted);
  `);
  expect(rows[0]?.resources).toHaveLength(1);
  expect(rows[0]?.totalBytes).toBe(64);
  expect(rows[0]?.unlabelled).toBe(1);
  expect(rows[0]?.resources[0]?.asset).toBe('unlabelled');
  expect(census('gl.createTexture(); gl.lost = true;')).toEqual([]);
});
it('restores creation scopes after a nested throw', () => {
  const rows = census(`
    window.__sc_gl_scope('outer','outer-asset',()=>{
      try { window.__sc_gl_scope('inner','inner-asset',()=>{gl.createTexture(); throw new Error('fixture');}); } catch {}
      gl.createBuffer();
    });
    gl.createRenderbuffer();
  `);
  expect(rows[0]?.resources.map((r) => [r.owner, r.asset])).toEqual([
    ['inner', 'inner-asset'], ['outer', 'outer-asset'], ['unlabelled', 'unlabelled'],
  ]);
});

it('recovers a late source label without changing uploaded bytes or resource identity', () => {
  const rows = census(`
    const b = gl.createBuffer(), vertices = new Float32Array(72);
    gl.bindBuffer(0x8892,b); gl.bufferData(0x8892,vertices,0x88e4);
    const before = window.__sc_gl()[0].resources[0];
    if(before.labelled || before.bytes !== 288) throw new Error('unexpected initial label or bytes');
    window.__sc_label_source(vertices,'engine/draw','generated/background/position');
    const after = window.__sc_gl()[0].resources[0];
    if(after.id !== before.id || after.bytes !== before.bytes) throw new Error('allocation changed');
  `);
  expect(rows[0]?.unlabelled).toBe(0);
  expect(rows[0]?.totalBytes).toBe(288);
  expect(rows[0]?.reconciled).toBe(true);
  expect(rows[0]?.resources[0]?.asset).toBe('generated/background/position');
});

it('journals exact allocation mutations and labels without retaining WebGL objects or changing the census', () => {
  const rows = census(`
    const events=[]; window.__sc_gl_change=event=>events.push(event);
    const b=window.__sc_gl_scope('engine','fixture-buffer',()=>gl.createBuffer());
    gl.bindBuffer(0x8892,b); gl.bufferData(0x8892,64,0x88e4); gl.bufferData(0x8892,128,0x88e4); gl.deleteBuffer(b);
    const t=gl.createTexture(),pixels=new Uint8Array(64);
    window.__sc_label_source(pixels,'engine','fixture-texture');
    gl.bindTexture(0x0de1,t); gl.texImage2D(0x0de1,0,0x8058,4,4,0,0x1908,0x1401,pixels); gl.generateMipmap(0x0de1);
    const buffer=events.filter(e=>e.op==='allocation' && e.kind==='buffer');
    if(JSON.stringify(buffer.map(e=>e.bytes))!=='[0,64,128,null]')throw Error('Missing buffer mutation');
    if(new Set(buffer.map(e=>e.id)).size!==1)throw Error('Unstable allocation identity');
    const texture=events.filter(e=>e.op==='allocation' && e.kind==='texture').at(-1);
    if(texture.bytes!==84 || texture.asset!=='fixture-texture' || !texture.labelled)throw Error('Missing mip/label mutation');
    if(events.some(e=>Object.values(e).some(v=>v!==null && typeof v==='object')))throw Error('Journal retains an object');
    const count=events.length; window.__sc_gl_change=null; gl.createBuffer();
    if(events.length!==count)throw Error('Disabled loading journal still observes playing allocations');
  `);
  expect(rows[0]?.totalBytes).toBe(84);
  expect(rows[0]?.resources.filter(row => row.kind === 'texture').map(row => row.asset)).toEqual(['fixture-texture']);
});

it('joins native handles and uploaded sources by scalar identities without labels or deleted buffers', () => {
  const rows = census(`
    const data = new Float32Array(9), attribute = {}, b = gl.createBuffer(), spare = gl.createBuffer();
    window.__sc_label_source(data,'composer','arbitrary-name',attribute);
    gl.bindBuffer(0x8892,b); gl.bufferData(0x8892,data,0x88e4);
    const id = window.__sc_gl_id(b);
    if (window.__sc_gl_source_ids(data).join() !== id || window.__sc_gl_source_ids(attribute).join() !== id) throw Error('exact source/storage join');
    if (window.__sc_gl_id({}) !== null || window.__sc_gl_source_ids(undefined).length) throw Error('unknown identity');
    gl.deleteBuffer(b);
    if (window.__sc_gl_source_ids(data).length || window.__sc_gl_source_ids(attribute).length) throw Error('retired native buffer');
  `);
  expect(rows[0]?.resources).toHaveLength(1);
  expect(rows[0]?.totalBytes).toBe(0);
});

it('does not call the journal for unchanged per-draw owner labels, while preserving real relabels', () => {
  const rows = census(`
    const events=[]; window.__sc_gl_change=event=>events.push(event);
    const resource=gl.createBuffer();
    window.__sc_label_gl(resource,'owner','asset'); const initial=events.length;
    for(let index=0;index<100000;index++)window.__sc_label_gl(resource,'owner','asset');
    if(events.length!==initial)throw Error('Unchanged draw labels reached the journal');
    window.__sc_label_gl(resource,'next','asset');
    if(events.length!==initial+1 || events.at(-1).owner!=='next')throw Error('Real relabel was lost');
  `);
  expect(rows[0]?.resources[0]?.owner).toBe('next');
});

it('retires probe allocations on delivered loss without wrapping native extensions or querying the driver', () => {
  const rows = census(`
    const events=[]; window.__sc_gl_change=event=>events.push(event);
    const textures=[4,24,4,4].map(bytes=>{
      const t=window.__sc_gl_scope('engine/renderer','builtin/probe-renderer',()=>gl.createTexture());
      gl.bindTexture(0x0de1,t); gl.texImage2D(0x0de1,0,0x8058,bytes/4,1,0,0x1908,0x1401,null); return t;
    });
    const b=gl.createBuffer(); gl.bindBuffer(0x8892,b); gl.bufferData(0x8892,64,0x88e4);
    const rb=gl.createRenderbuffer(); gl.bindRenderbuffer(0x8d41,rb); gl.renderbufferStorageMultisample(0x8d41,1,0x8058,2,2);
    if(window.__sc_gl()[0].totalBytes!==116)throw Error('Fixture allocation');
    const loss=gl.getExtension('WEBGL_lose_context'), nativeLose=loss.loseContext;
    gl.getExtension('WEBGL_lose_context');
    if(loss.loseContext!==nativeLose || gl.getExtension.name!=='getExtension')throw Error('Native extension was wrapped');
    const isLost=gl.isContextLost; gl.isContextLost=()=>{throw Error('Loss observer queried the driver');};
    loss.loseContext(); gl.isContextLost=isLost;
    const retired=events.filter(e=>e.op==='allocation' && e.bytes===null);
    if(retired.length!==6 || new Set(retired.map(e=>e.id)).size!==6)throw Error('Missing immediate context retirement');
    if(retired.filter(e=>e.kind==='texture').length!==textures.length)throw Error('Missing probe texture retirement');
    if(window.__sc_gl().length || events.filter(e=>e.bytes===null).length!==6)throw Error('Repeated context retirement');
    loss.restoreContext();
    if(window.__sc_gl()[0].totalBytes!==0 || window.__sc_gl()[0].resources.length)throw Error('Restored context resurrected dead allocations');
    gl.createTexture(); loss.loseContext();
    if(gl.listeners.size || events.filter(e=>e.bytes===null).length!==7)throw Error('Restored allocation did not rearm one-shot loss');
    loss.restoreContext(); gl.createTexture(); gl.lost=true; window.__sc_gl();
    if(events.filter(e=>e.bytes===null).length!==8)throw Error('Unrequested loss not reconciled');
    gl.lost=false;
  `);
  expect(rows[0]?.totalBytes).toBe(0);
  expect(rows[0]?.resources).toEqual([]);
});
