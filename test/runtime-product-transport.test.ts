// oxlint-disable-next-line import/no-nodejs-modules -- A fresh V8 process enables real GC of admission and reader transports.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Reuse the focused worker's Node executable for the GC regression.
import { execPath } from 'node:process';
import { expect, it, vi } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, MeshStandardMaterial } from 'three';
import { Scope } from '../src/engine/app/scope';
import { emptyShardfile } from '../src/sdk/author';
import { staticGlb } from '../src/sdk/bake/glb';
import { parseGlb } from '../src/sdk/assets';
import { contentHash } from '../src/sdk/project';
import { admitProduct, type CachedProduct, type ProductCache, type ProductOptions } from '../src/game/shardfile/product';
import { admittedRuntimeProduct, provideRuntimeProduct } from '../src/game/shardfile/runtimeProduct';

function fixture() {
  const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3)), material = new MeshStandardMaterial();
  const bytes = staticGlb([{ geometry, material }], 'owned'), other = staticGlb([{ geometry, material }], 'unbound');
  geometry.dispose(); material.dispose();
  const hash = contentHash(bytes), keep = contentHash(other), source = emptyShardfile({ slug: 'transport-handoff', name: 'Handoff', author: 'test', seed: 1, revision: 1 });
  source.runtime = { entry: 'runtime/index.ts', binds: ['props'] };
  source.props = { version: 1, family: 'toon', wholeLibrary: [hash], tiles: [], panels: [], models: [], far: null, textures: [], colliders: [] };
  source.files = [bytes, other].map(wire => {
    const row = { hash: contentHash(wire), kind: 'glb' as const, compressed: wire.length, dependencies: [], critical: false };
    return Object.assign(row, parseGlb(wire));
  });
  source.library = [hash, keep];
  source.budgets.library = { compressed: bytes.length + other.length, resident: source.files.reduce((sum, file) => sum + file.decoded + file.gpu, 0) };
  const disk = new Map<string, Uint8Array>(), products = new Map<string, CachedProduct>(), pins: string[][] = [];
  let unpins = 0;
  const cache: ProductCache = { product: base => Promise.resolve(products.get(base) ?? null),
    asset: (_base, ref) => { const wire = disk.get(ref); return Promise.resolve(wire === undefined ? null : Uint8Array.from(wire)); },
    putAsset: (_base, ref, wire) => { disk.set(ref, Uint8Array.from(wire)); return Promise.resolve(true); },
    putProduct: (base, product) => { products.set(base, product); return Promise.resolve(); },
    pin: refs => { pins.push([...refs]); return () => { unpins++; }; } };
  const fetch = vi.fn((url: string) => {
    const wire = url.endsWith(hash) ? bytes : url.endsWith(keep) ? other : undefined;
    if (wire === undefined) throw new Error('Unexpected asset');
    return Promise.resolve(new Response(Uint8Array.from(wire).buffer));
  });
  const options: ProductOptions = { base: 'https://fixture.test/', firstParty: true, offline: false, cache, fetch, hash: wire => Promise.resolve(contentHash(wire)) };
  return { source, hash, keep, bytes, other, disk, cache, options, fetch, pins, unpins: () => unpins };
}

it('keeps admission until decoded handoff, then releases both owned copies with pinned exact rereads', async () => {
  const f = fixture(), admitted = await admitProduct(f.source, f.options), scope = new Scope('handoff');
  const wire = admitted.assets.get(f.hash);
  try {
    provideRuntimeProduct(admitted, scope, f.options);
    const runtime = admittedRuntimeProduct(f.source.identity.slug);
    if (runtime === null) throw new Error('No resident reader');
    expect(await runtime.assets.read(f.hash)).toBe(wire);
    expect(admitted.assets.has(f.hash)).toBe(true);
    expect(f.pins.at(-1)).toEqual([f.hash]);
    await runtime.releaseTransport([f.hash, f.keep]);
    expect([...admitted.assets.keys()]).toEqual([f.keep]);
    expect([...runtime.assets.retained.keys()]).toEqual([f.keep]);
    expect(await runtime.assets.read(f.hash)).toEqual(f.bytes);
    expect(await runtime.assets.read(f.keep)).toBe(admitted.assets.get(f.keep));
    expect(f.fetch).toHaveBeenCalledTimes(2);
    expect(f.unpins()).toBe(1); // Admission publication ended; the runtime lease remains.
  } finally { scope.dispose(); }
  expect(f.unpins()).toBe(2);
  expect(admittedRuntimeProduct(f.source.identity.slug)).toBeNull();
});

it.each(['size', 'hash'] as const)('refuses a corrupt %s cached reread after decoder release', async failure => {
  const f = fixture(), admitted = await admitProduct(f.source, f.options), scope = new Scope('corrupt');
  try {
    provideRuntimeProduct(admitted, scope, f.options);
    const runtime = admittedRuntimeProduct(f.source.identity.slug);
    if (runtime === null) throw new Error('No resident reader');
    await runtime.releaseTransport([f.hash]);
    const corrupt = failure === 'size' ? new Uint8Array() : Uint8Array.from(f.bytes);
    if (failure === 'hash') corrupt[0] = (corrupt[0] ?? 0) ^ 1;
    f.disk.set(f.hash, corrupt);
    await expect(runtime.assets.read(f.hash)).rejects.toThrow('hash or size mismatch');
  } finally { scope.dispose(); }
});

it('retains both copies when cache quota refuses durable storage', async () => {
  const f = fixture(), options = { ...f.options, cache: { ...f.cache, putAsset: () => Promise.resolve(false) } };
  const admitted = await admitProduct(f.source, options), scope = new Scope('quota');
  try {
    provideRuntimeProduct(admitted, scope, options);
    const runtime = admittedRuntimeProduct(f.source.identity.slug);
    if (runtime === null) throw new Error('No resident reader');
    await runtime.releaseTransport([f.hash]);
    expect(admitted.assets.has(f.hash)).toBe(true);
    expect(runtime.assets.retained.has(f.hash)).toBe(true);
  } finally { scope.dispose(); }
});

it('refuses an undeclared release atomically and keeps a bound file shared with an unbound section', async () => {
  const f = fixture();
  f.source.requires.commons.push(f.hash);
  f.source.requires.commonsWire[f.hash] = f.bytes.length;
  const costs = parseGlb(f.bytes);
  f.source.requires.commonsCosts[f.hash] = { decoded: costs.decoded, gpu: costs.gpu, triangles: costs.triangles, draws: costs.draws };
  f.source.library.push(`commons:${f.hash}`);
  f.source.budgets.library.compressed += f.bytes.length;
  f.source.budgets.library.resident += costs.decoded + costs.gpu;
  const shared = await admitProduct(f.source, f.options);
  if (shared.releaseTransport === undefined) throw new Error('No owned release callback');
  expect(await shared.releaseTransport([f.hash])).toEqual([]);
  expect(shared.assets.get(f.hash)).toBe(shared.assets.get(`commons:${f.hash}`));
  const valid = fixture(), admitted = await admitProduct(valid.source, valid.options);
  if (admitted.releaseTransport === undefined) throw new Error('No owned release callback');
  await expect(admitted.releaseTransport([valid.hash, 'missing'])).rejects.toThrow('Undeclared transport release');
  expect(admitted.assets.has(valid.hash)).toBe(true);
  // A caller-owned Map has no admission release authority, even when its runtime owns the declared section.
  const assets = new Map([[f.hash, f.bytes], [f.keep, f.other]]), scope = new Scope('caller');
  try {
    provideRuntimeProduct({ source: f.source, assets, cached: false }, scope, f.options);
    const runtime = admittedRuntimeProduct(f.source.identity.slug);
    if (runtime === null) throw new Error('No resident reader');
    await runtime.releaseTransport([f.hash]);
    expect(runtime.assets.retained.has(f.hash)).toBe(true);
    expect(assets.has(f.hash)).toBe(true);
    expect(f.pins.at(-1)).toEqual([]);
  } finally { scope.dispose(); }
});

const gcScript = String.raw`
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers';
import {BufferGeometry,Float32BufferAttribute,MeshStandardMaterial} from 'three';
import {Scope} from './src/engine/app/scope.ts';
import {emptyShardfile} from './src/sdk/author.ts';
import {staticGlb} from './src/sdk/bake/glb.ts';
import {parseGlb} from './src/sdk/assets.ts';
import {contentHash} from './src/sdk/project.ts';
import {admitProduct} from './src/game/shardfile/product.ts';
import {provideRuntimeProduct,admittedRuntimeProduct} from './src/game/shardfile/runtimeProduct.ts';
async function fixture(){
  const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute([0,0,0,1,0,0,0,0,1],3));
  const material=new MeshStandardMaterial(), bytes=staticGlb([{geometry,material}],'owned'), hash=contentHash(bytes);
  geometry.dispose();material.dispose();
  const source=emptyShardfile({slug:'gc-handoff',name:'GC',author:'test',seed:1,revision:1});
  source.runtime={entry:'runtime/index.ts',binds:['props']};
  source.props={version:1,family:'toon',wholeLibrary:[hash],tiles:[],panels:[],models:[],far:null,textures:[],colliders:[]};
  source.files=[{hash,kind:'glb',compressed:bytes.length,dependencies:[],critical:false,...parseGlb(bytes)}];
  source.library=[hash];source.budgets.library={compressed:bytes.length,resident:source.files[0].decoded+source.files[0].gpu};
  const disk=new Map(),options={base:'https://fixture.test/',firstParty:true,offline:false,hash:async wire=>contentHash(wire),
    fetch:async()=>new Response(Uint8Array.from(bytes)),cache:{product:async()=>null,
    asset:async(_base,ref)=>disk.has(ref)?Uint8Array.from(disk.get(ref)):null,
    putAsset:async(_base,ref,wire)=>{disk.set(ref,Uint8Array.from(wire));return true;},putProduct:async()=>{},pin:()=>()=>{}}};
  const admitted=await admitProduct(source,options), scope=new Scope('gc'), weak=new WeakRef(admitted.assets.get(hash));
  provideRuntimeProduct(admitted,scope,options);
  const runtime=admittedRuntimeProduct(source.identity.slug);
  if(runtime===null)throw new Error('No runtime reader');
  await runtime.releaseTransport([hash]);
  return {admitted,runtime,scope,weak,hash};
}
const held=await fixture();
if(typeof globalThis.gc!=='function')throw new Error('Missing real GC');
for(let i=0;i<8;i++){await new Promise(resolve=>setImmediate(resolve));globalThis.gc();}
assert(held.weak.deref()===undefined,'admission or runtime callbacks retain the decoded transport');
assert.equal(held.admitted.assets.size,0);assert.equal(held.runtime.assets.retained.size,0);
assert((await held.runtime.assets.read(held.hash)).length>0,'released wire cannot be reread');
held.scope.dispose();
`;

it('collects decoded wire backing while admission and the runtime reader both remain live', () => {
  const result = spawnSync(execPath, ['--expose-gc', '--experimental-transform-types', '--import', './scripts/bake-loader.mjs', '--input-type=module', '-e', gcScript],
    { encoding: 'utf8', timeout: 15_000 });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
}, 20_000);
