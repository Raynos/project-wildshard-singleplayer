import { ResolvedIslandLibrarySchema } from '../src/format/islandLibrary';
// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, Matrix4 } from 'three';
import { zlibSync } from 'fflate';
import { GeometryPackWriter } from '../src/sdk/kit/geometryPack';
import { FigureRows } from '../src/game/systems/npc/figureRows';
import { SceneHandles } from '../src/game/shardfile/sceneHandles';
import { Scope } from '../src/engine/app/scope';
import { IslandLibrary } from '../src/game/models/islandLibrary';
import { FigureCatalogue, ProductFigureCatalogue } from '../src/game/models/figureCatalogue';
import { CollectionCatalogue } from '../src/game/models/collectionDisplay';
import * as runtime from '../src/game/shardfile/runtimeProduct';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { collectionRows } from '../src/shards/driftwood-isle/generators/collections';
import * as v from 'valibot';
import * as wholeGeometry from '../src/game/plugin/geometry';

function glb(): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],
    buffers:[{byteLength:36}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}]}));
  const padded=Math.ceil(json.length/4)*4,bytes=new Uint8Array(12+8+padded+8+36),view=new DataView(bytes.buffer);
  view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,bytes.length,true);
  view.setUint32(12,padded,true);view.setUint32(16,0x4e4f534a,true);bytes.fill(32,20,20+padded);bytes.set(json,20);
  view.setUint32(20+padded,36,true);view.setUint32(24+padded,0x004e4942,true);new Float32Array(bytes.buffer,28+padded,9).set([0,0,0,1,0,0,0,1,0]);return bytes;
}
const root={id:'fixture.island',draws:[{slot:'chime',file:'mesh.glb',channels:[]}],groups:'groups.json',figures:'figures.json',collections:{chime:'chime'}};
function fixture() {
  const source=emptyShardfile({slug:'fixture-island',name:'Test',author:'Test',revision:1,seed:1});
  const blobs=new Map([['mesh.glb',glb()],['groups.json',new TextEncoder().encode('{"native":true}')],['figures.json',new TextEncoder().encode('{"figures":{}}')]]);
  const reads=vi.fn((name:string)=>{const bytes=blobs.get(name);if(bytes===undefined)throw new Error('Missing fixture bytes');return Promise.resolve(bytes);});
  const product=createShardProduct({slug:source.identity.slug,revision:1,shardfile:source,sections:new Map([['custom/collections',collectionRows()]]),
    files:new Map([...blobs].map(([name])=>[name,{hash:name,url:name}])),read:reads});
  return {product,reads};
}

test('the strict resolved book refuses selectors and executable additions',()=>{
  expect(v.parse(ResolvedIslandLibrarySchema,root)).toEqual(root);
  expect(()=>v.parse(ResolvedIslandLibrarySchema,{...root,draws:{section:'custom/old',field:'draws'}})).toThrow();
  expect(()=>v.parse(ResolvedIslandLibrarySchema,{...root,load:()=>undefined})).toThrow();
});

test('cold geometry is intaken once, construction re-admits figures on its own owner and later cards borrow it',async()=>{
  const f=fixture(),cold=new Scope('cold'),world=new Scope('world'),later=new Scope('later'),library=new IslandLibrary(root,f.product);
  const admit=vi.spyOn(library.figures,'admit');
  try{
    await cold.run(()=>library.load());const template=library.loaded().handle('chime').copy();expect(template).toBeInstanceOf(BufferGeometry);
    cold.dispose();
    // A real world authority is unnecessary after the completed template intake:
    // passing the construction's Scope still preserves the original load branch.
    await library.load(undefined,world,world);
    expect(admit.mock.calls.map(call=>call[1])).toEqual([cold,world]);
    await later.run(()=>library.load());
    expect(admit).toHaveBeenCalledTimes(2);
    expect(await later.run(()=>ProductFigureCatalogue.fromProduct(f.product,'figures.json'))).toBe(library.figures);
    expect(f.reads.mock.calls.filter(([name])=>name==='mesh.glb')).toHaveLength(1);
    expect(f.reads.mock.calls.filter(([name])=>name==='groups.json')).toHaveLength(1);
    expect(f.reads.mock.calls.filter(([name])=>name==='figures.json')).toHaveLength(2);
    template.dispose();
  }finally{cold.dispose();world.dispose();later.dispose();admit.mockRestore();}
});

test('retiring an older source cannot invalidate the same catalogue re-admitted by construction',async()=>{
  const f=fixture(),cold=new Scope('cold'),world=new Scope('world'),catalogue=new ProductFigureCatalogue(f.product.slug,'figures.json');
  try{
    await catalogue.admit(f.product,cold);await catalogue.admit(f.product,world);cold.dispose();
    await expect(ProductFigureCatalogue.fromProduct(f.product,'figures.json',cold)).rejects.toThrow('owner left');
    expect(await world.run(()=>ProductFigureCatalogue.fromProduct(f.product,'figures.json'))).toBe(catalogue);
    world.dispose();const next=new Scope('next');try{expect(await next.run(()=>ProductFigureCatalogue.fromProduct(f.product,'figures.json'))).not.toBe(catalogue);}finally{next.dispose();}
  }finally{cold.dispose();world.dispose();}
});

test('pinned collections share library templates and never reopen a first-party product',async()=>{
  const f=fixture(),owner=new Scope('collections'),library=new IslandLibrary(root,f.product),open=vi.spyOn(runtime,'loadFirstPartyProduct');
  try{
    await owner.run(()=>library.collections.prepare());expect(library.collections.model('chime').id).toBe(collectionRows().models['chime']?.id);
    expect(open).not.toHaveBeenCalled();expect(library.ready).toBe(true);
    expect(()=>new CollectionCatalogue('other-product',new Map(),f.product)).toThrow('identity');
    expect(()=>library.admit({...f.product})).toThrow('identity');
  }finally{owner.dispose();open.mockRestore();}
});

test('leave during figure reads publishes no admission and permits a later construction retry',async()=>{
  const f=fixture(),cold=new Scope('cold'),world=new Scope('world');
  let release:(bytes:Uint8Array)=>void=()=>{throw new Error('No gate');};
  const gate=new Promise<Uint8Array>(resolve=>{release=resolve;}),read=f.product.file;
  const files=vi.spyOn(f.product,'file').mockImplementation(name=>name==='figures.json'?gate:read(name));
  const library=new IslandLibrary(root,f.product),pending=cold.run(()=>library.load());cold.dispose();release(new TextEncoder().encode('{"figures":{}}'));
  try{
    await expect(pending).rejects.toThrow('owner left');files.mockRestore();await world.run(()=>library.load());expect(library.ready).toBe(true);
  }finally{cold.dispose();world.dispose();files.mockRestore();}
});


test('world-first geometry and collection reads keep one intake while each live construction re-admits figures',async()=>{
  const f=fixture(),first=new Scope('world-first'),second=new Scope('world-next'),cold=new Scope('card'),library=new IslandLibrary(root,f.product);
  // The first load supplies actual native geometry bytes through the same
  // owned-geometry intake; a later load must not replace that template.
  const input=new Map([['mesh.glb',new BufferGeometry()]]),admit=vi.spyOn(library.figures,'admit');
  try{
    await library.load(input,undefined,first);
    await cold.run(()=>library.collections.prepare());
    first.dispose();await library.load(input,second,second);
    expect(admit.mock.calls.map(call=>call[1])).toEqual([first,second]);
    expect(f.reads.mock.calls.filter(([name])=>name==='mesh.glb')).toHaveLength(0);
    expect(f.reads.mock.calls.filter(([name])=>name==='groups.json')).toHaveLength(1);
  }finally{first.dispose();second.dispose();cold.dispose();admit.mockRestore();input.get('mesh.glb')?.dispose();}
});


test('retirement during skin preparation preserves the last complete figure admission',async()=>{
  const figures=new FigureCatalogue(),resources=new SceneHandles({setupMaterial:()=>undefined}),owner=new Scope('figure-source');
  await figures.admit({material:{name:'original',roughness:.4,metalness:0},figures:{}},resources,owner);
  let release:()=>void=()=>{throw new Error('No gate');};const pending=new Promise<void>(resolve=>{release=resolve;});
  const skins=vi.spyOn(FigureRows,'prepareSkins').mockReturnValue(pending);
  try{
    const admission=figures.admit({material:{name:'replacement',roughness:.8,metalness:0},figures:{}},resources,owner);
    owner.dispose();release();await expect(admission).rejects.toThrow('owner left');
    const material=figures.material(resources);expect(material.name).toBe('original');material.dispose();
  }finally{owner.dispose();release();skins.mockRestore();}
});


test('resolved books explicitly refuse packed figure owners before a pack fetch',async()=>{
  const f=fixture(),owner=new Scope('unpacked-book'),library=new IslandLibrary(root,f.product),read=f.product.file;
  const file=vi.spyOn(f.product,'file').mockImplementation(name=>name==='figures.json'?Promise.resolve(new TextEncoder().encode(JSON.stringify({figures:{},pack:{url:'pack',rows:{bytes:0,geometries:[]}}}))):read(name));
  const fetch=vi.spyOn(globalThis,'fetch');
  try{await expect(owner.run(()=>library.load())).rejects.toThrow('unpacked');expect(fetch).not.toHaveBeenCalled();expect(library.ready).toBe(false);}
  finally{owner.dispose();file.mockRestore();fetch.mockRestore();}
});


test('legacy catalogue admission still decodes its original packed geometry by default',async()=>{
  const f=fixture(),owner=new Scope('legacy-pack'),writer=new GeometryPackWriter('legacy-book');
  const geometry=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array([0,0,0,1,0,0,0,1,0]),3));writer.add(geometry);
  const read=f.product.file,file=vi.spyOn(f.product,'file').mockImplementation(name=>name==='figures.json'?Promise.resolve(new TextEncoder().encode(JSON.stringify({figures:{},pack:{url:'legacy-pack',rows:writer.rows()}}))):read(name));
  const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(Uint8Array.from(zlibSync(writer.bytes()))));
  const catalogue=new ProductFigureCatalogue(f.product.slug,'figures.json');
  try{
    await catalogue.admit(f.product,owner);expect(fetch).toHaveBeenCalledTimes(1);expect(fetch.mock.calls[0]?.[0]).toBe('legacy-pack');
    expect(await owner.run(()=>ProductFigureCatalogue.fromProduct(f.product,'figures.json'))).toBe(catalogue);
  }finally{owner.dispose();file.mockRestore();fetch.mockRestore();geometry.dispose();}
});

test('groups transport overlaps held figure admission without publishing inventory or geometry early', async () => {
  const f = fixture(), owner = new Scope('overlapped-book'), library = new IslandLibrary<{ native: boolean }>(root, f.product);
  const read = f.reads.getMockImplementation();
  if (read === undefined) throw new Error('Missing original fixture reader');
  let release: (bytes: Uint8Array) => void = () => { throw new Error('Missing figure gate'); };
  const gate = new Promise<Uint8Array>(resolve => { release = resolve; });
  f.reads.mockImplementation(name => name === 'figures.json' ? gate : read(name));
  const pending = owner.run(() => library.load());
  try {
    await vi.waitFor(() => { expect(f.reads.mock.calls.map(([name]) => name)).toContain('groups.json'); });
    expect(library.ready).toBe(false);
    expect(() => library.groups()).toThrow('not loaded');
    expect(f.reads.mock.calls.map(([name]) => name)).not.toContain('mesh.glb');
    release(new TextEncoder().encode('{"figures":{}}'));
    await pending;
    expect(library.groups()).toEqual({ native: true }); expect(library.ready).toBe(true);
    expect(f.reads.mock.calls.filter(([name]) => name === 'groups.json')).toHaveLength(1);
  } finally { release(new TextEncoder().encode('{"figures":{}}')); await pending.catch(() => undefined); owner.dispose(); }
});

test('figure refusal drains started groups transport without publishing inventory or decoding templates', async () => {
  const f = fixture(), owner = new Scope('refused-book'), library = new IslandLibrary(root, f.product);
  const failure = new Error('Original figure refusal'), read = f.reads.getMockImplementation();
  if (read === undefined) throw new Error('Missing original fixture reader');
  let release: (bytes: Uint8Array) => void = () => { throw new Error('Missing inventory gate'); };
  const gate = new Promise<Uint8Array>(resolve => { release = resolve; });
  f.reads.mockImplementation(name => name === 'groups.json' ? gate : name === 'figures.json' ? Promise.reject(failure) : read(name));
  const pending = owner.run(() => library.load());
  let settled = false;
  void pending.then(() => { settled = true; return settled; }, () => { settled = true; return settled; });
  try {
    await vi.waitFor(() => { expect(f.reads.mock.calls.map(([name]) => name)).toContain('groups.json'); });
    await new Promise(resolve => { setTimeout(resolve, 0); });
    expect(settled).toBe(false);
    release(new TextEncoder().encode('{"native":true}'));
    await expect(pending).rejects.toBe(failure);
    expect(library.ready).toBe(false); expect(() => library.groups()).toThrow('not loaded');
    expect(f.reads.mock.calls.map(([name]) => name)).not.toContain('mesh.glb');
  } finally { release(new TextEncoder().encode('{"native":true}')); await pending.catch(() => undefined); owner.dispose(); }
});

test('prepared whole intake overlaps earlier work but publishes only after figure admission', async () => {
  const f = fixture(), owner = new Scope('prepared-island'), source = owner.child('source'), library = new IslandLibrary(root, f.product);
  const geometry = new BufferGeometry(), disposed = vi.spyOn(geometry, 'dispose');
  const whole = vi.spyOn(wholeGeometry, 'readWholeGeometry').mockImplementation(scope => {
    const release = scope.capture('geometries', () => { geometry.dispose(); });
    return Promise.resolve(new Map([['mesh', { geometry, matrix: new Matrix4(), release }]]));
  });
  let release: (bytes: Uint8Array) => void = () => { throw new Error('Missing figure gate'); };
  const gate = new Promise<Uint8Array>(resolve => { release = resolve; }), read = f.product.file;
  const files = vi.spyOn(f.product, 'file').mockImplementation(name => name === 'figures.json' ? gate : read(name));
  const drain = library.prepareGeometry(owner, source);
  if (drain === undefined) throw new Error('Missing whole preparation');
  try {
    await vi.waitFor(() => { expect(whole).toHaveBeenCalledTimes(1); });
    expect(library.ready).toBe(false); expect(() => library.loaded()).toThrow('not loaded');
    const pending = library.load(undefined, owner, source);
    expect(library.ready).toBe(false);
    release(new TextEncoder().encode('{"figures":{}}')); await pending; await drain();
    expect(library.ready).toBe(true); expect(whole).toHaveBeenCalledTimes(1);
    expect(f.reads.mock.calls.filter(([name]) => name === 'mesh.glb')).toHaveLength(0);
    expect(disposed).not.toHaveBeenCalled();
    const copy = library.loaded().handle('chime').copy();
    expect(copy.attributes).toEqual(geometry.attributes); copy.dispose();
  } finally { release(new TextEncoder().encode('{"figures":{}}')); await drain(); owner.dispose(); whole.mockRestore(); files.mockRestore(); geometry.dispose(); }
});

test('abandoned preparation drains its read and releases geometry without publishing templates', async () => {
  const f = fixture(), owner = new Scope('abandoned-island'), source = owner.child('source'), library = new IslandLibrary(root, f.product);
  const geometry = new BufferGeometry(), disposed = vi.spyOn(geometry, 'dispose');
  let release: () => void = () => { throw new Error('Missing whole gate'); };
  const gate = new Promise<void>(resolve => { release = resolve; });
  const whole = vi.spyOn(wholeGeometry, 'readWholeGeometry').mockImplementation(async scope => {
    await gate;
    const unregister = scope.capture('geometries', () => { geometry.dispose(); });
    return new Map([['mesh', { geometry, matrix: new Matrix4(), release: unregister }]]);
  });
  const drain = library.prepareGeometry(owner, source);
  if (drain === undefined) throw new Error('Missing whole preparation');
  try {
    await vi.waitFor(() => { expect(whole).toHaveBeenCalledTimes(1); });
    let settled = false; const discarded = drain().then(() => { settled = true; return settled; });
    await Promise.resolve(); expect(settled).toBe(false);
    release(); await discarded;
    expect(disposed).toHaveBeenCalledTimes(1); expect(library.ready).toBe(false);
    expect(f.reads).not.toHaveBeenCalled();
  } finally { release(); await drain(); owner.dispose(); whole.mockRestore(); }
});

test('a figure refusal keeps precedence over an earlier failed geometry preparation', async () => {
  const f = fixture(), owner = new Scope('refused-preparation'), library = new IslandLibrary(root, f.product);
  const original = new Error('Original figure admission'), read = f.product.file;
  const files = vi.spyOn(f.product, 'file').mockImplementation(name => name === 'figures.json' ? Promise.reject(original) : read(name));
  const whole = vi.spyOn(wholeGeometry, 'readWholeGeometry').mockRejectedValue(new Error('Independent geometry refusal'));
  const drain = library.prepareGeometry(owner, owner);
  if (drain === undefined) throw new Error('Missing whole preparation');
  try {
    await vi.waitFor(() => { expect(whole).toHaveBeenCalledTimes(1); });
    await expect(library.load(undefined, owner, owner)).rejects.toBe(original);
    await drain(); expect(library.ready).toBe(false);
  } finally { await drain(); owner.dispose(); whole.mockRestore(); files.mockRestore(); }
});

test('source retirement cancels a preparation before it starts geometry intake', async () => {
  const f = fixture(), owner = new Scope('retired-preparation'), source = owner.child('source'), library = new IslandLibrary(root, f.product);
  const whole = vi.spyOn(wholeGeometry, 'readWholeGeometry');
  const drain = library.prepareGeometry(owner, source);
  if (drain === undefined) throw new Error('Missing whole preparation');
  try {
    source.dispose(); await drain();
    expect(whole).not.toHaveBeenCalled(); expect(library.ready).toBe(false);
    await expect(library.load(undefined, owner, source)).rejects.toThrow('owner left');
    expect(f.reads).not.toHaveBeenCalled();
  } finally { await drain(); owner.dispose(); whole.mockRestore(); }
});
