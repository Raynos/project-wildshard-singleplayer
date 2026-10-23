// oxlint-disable-next-line import/no-nodejs-modules -- Exact original compressed bytes and named-file admission.
import {createHash} from 'node:crypto';
import {expect,test,vi} from 'vitest';
import {zlibSync} from 'fflate';
import {Scope} from '../src/engine/app/scope';
import type {ScalarLatticeRows} from '../src/format/scalarChannel';
import {ScalarLatticeBindings,readScalarLattice,readScalarChannel} from '../src/engine/world/scalarChannel';
import {defineShard,prepareManifestScalarBlocks,type ShardManifestRows} from '../src/game/shard/manifest';
import {absentShardProduct,type ShardProduct} from '../src/game/shardfile/shardProduct';
import {readNamedBlob} from '../src/sdk/blobs';
import nalati from '../src/shards/nalati-grasslands/discovery.generated';
import reference from './fixtures/nalati-geography-blocks.json' with {type:'json'};
import {readNalatiScalarBlocks} from './fixtures/nalati-scalar-blocks';

type MutableProduct={-readonly[K in keyof ShardProduct]:ShardProduct[K]};
const compressed=(values:readonly number[]):Uint8Array=>zlibSync(new Uint8Array(Float32Array.from(values).buffer));
const raster=(file:string):ScalarLatticeRows=>({res:2,size:500,values:{type:'f32',count:4,data:{file}}});
function fixture(){
  const {scalarBlocks:_scalar,ground:_ground,groundColor:_colour,surfaceAt:_surface,forest:originalForest,minimap:_map,navmesh:_nav,...fixed}=nalati;
  if(originalForest===undefined)throw new Error('Missing original forest metadata');
  const {mask:_mask,...forest}=originalForest;
  const rows:ShardManifestRows={...fixed,forest,minimap:{palette:{ground:{base:[0,0,0],layers:[]},segments:[],trails:[],marks:[],pois:[]}},
    groundRows:{terrain:{flat:3,seed:17},water:2,trails:[],cabinSites:[],mask:raster('data/pond.bin'),bodies:[{id:'water',kind:'terrain-basin'}]},
    forestMaskSamples:raster('data/forest.bin'),groundColourSamples:[raster('data/red.bin'),raster('data/green.bin'),raster('data/blue.bin')],
    surfaceSamples:[raster('data/red.bin'),raster('data/green.bin'),raster('data/blue.bin')],mapGroundSamples:[raster('data/red.bin'),raster('data/green.bin'),raster('data/blue.bin')]};
  const manifest=defineShard(rows,{}),parent=new Scope('scalar-parent'),scope=parent.child('scalar-load');
  const blocks=new Map([['data/pond.bin',compressed([0,.25,.75,1])],['data/forest.bin',compressed([.1,.2,.3,.4])],
    ['data/red.bin',compressed([-2,1,2,3])],['data/green.bin',compressed([.25,2,3,4])],['data/blue.bin',compressed([3,4,5,6])]]);
  const file=vi.fn((name:string):Promise<Uint8Array>=>{const bytes=blocks.get(name);if(bytes===undefined)throw new Error('Missing test scalar');return Promise.resolve(bytes);});
  const product:MutableProduct=Object.assign(absentShardProduct(manifest.slug),{hasFile:(name:string)=>blocks.has(name),file});
  const sample=():number[]=>{const out:[number,number,number]=[0,0,0],terrain=manifest.ground.terrain;
    if(terrain===undefined||manifest.groundColor===undefined||manifest.surfaceAt===undefined||manifest.minimap?.palette===undefined||manifest.forest?.mask===undefined)throw new Error('Missing sampled definition');
    manifest.groundColor(-250,-250,0,0,terrain,out);
    return [...out,...manifest.surfaceAt(-250,-250,0,0),manifest.forest.mask(-250,-250),terrain.pondMask(-250,-250)];};
  return {manifest,rows,parent,scope,blocks,file,product,sample};
}

test('raw manifest declarations perform no reads and publish the original native field only after preparation',async()=>{
  const f=fixture(),ground=f.manifest.ground,terrain=ground.terrain;
  expect(f.file).not.toHaveBeenCalled();expect(()=>f.sample()).toThrow('not prepared');
  expect(()=>f.manifest.scalarBlocks?.lattice(raster('data/extra.bin'))).toThrow('sealed');
  await prepareManifestScalarBlocks(f.manifest,f.product,f.scope);
  expect(f.file).toHaveBeenCalledTimes(5);expect(f.sample()).toEqual([-2,.25,3,-2,.25,3,Math.fround(.1),0]);
  await prepareManifestScalarBlocks(f.manifest,f.product,f.scope);expect(f.file).toHaveBeenCalledTimes(5);
  expect(f.manifest.ground).toBe(ground);expect(f.manifest.ground.terrain).toBe(terrain);
  for(const name of f.manifest.scalarBlocks?.files??[]){const value=f.blocks.get(name);if(value===undefined)throw new Error('Missing original block');
    const old=readScalarLattice({res:2,size:500,values:{type:'f32',count:4,data:btoa(String.fromCodePoint(...value))}});
    const raw=f.manifest.scalarBlocks?.lattice(raster(name),name==='data/pond.bin'?{min:0,max:1}:undefined);
    for(const x of [-500,-250,-0,0,250,500,Number.NaN])for(const z of [-500,-250,-0,0,250,500])expect(Object.is(raw?.(x,z),old(x,z))).toBe(true);
  }
  f.parent.dispose();
});

test('a malformed suffix or absent named block leaves every manifest sampler closed',async()=>{
  const f=fixture();f.blocks.set('data/blue.bin',compressed([1,2,3]));
  await expect(prepareManifestScalarBlocks(f.manifest,f.product,f.scope)).rejects.toThrow('length mismatch');
  expect(()=>f.sample()).toThrow('not prepared');expect(()=>f.manifest.ground.terrain?.pondMask(0,0)).toThrow('not prepared');
  const absent=fixture();absent.blocks.delete('data/blue.bin');
  await expect(prepareManifestScalarBlocks(absent.manifest,absent.product,absent.scope)).rejects.toThrow('Missing manifest scalar file');
  expect(absent.file).not.toHaveBeenCalled();f.parent.dispose();absent.parent.dispose();
});

test.each(['scope','ancestor','sliced','reader','hasFile','identity','intake'] as const)('raw intake refuses a retired or replaced %s after an await',async(kind)=>{
  const f=fixture();let disposal:ReturnType<Scope['disposeSteps']>|undefined;f.product.file=name=>{
    const bytes=f.blocks.get(name);if(bytes===undefined)throw new Error('Missing test scalar');
    if(kind==='scope')f.scope.dispose();
    if(kind==='ancestor')f.parent.dispose();
    if(kind==='sliced'){f.parent.onDisposeSteps(function* delayed(){yield;});disposal=f.parent.disposeSteps();disposal.next();}
    if(kind==='reader')f.product.file=()=>Promise.resolve(bytes);
    if(kind==='hasFile')f.product.hasFile=()=>true;
    if(kind==='identity')f.product.slug='replaced';
    if(kind==='intake')f.manifest.scalarBlocks=new ScalarLatticeBindings();
    return Promise.resolve(bytes);
  };
  await expect(prepareManifestScalarBlocks(f.manifest,f.product,f.scope)).rejects.toThrow('Retired or replaced');
  expect(()=>f.sample()).toThrow('not prepared');if(disposal!==undefined)Array.from(disposal);f.parent.dispose();
});

test('the whole source grammar, count, finiteness and pond bounds refuse before publication',()=>{
  for(const row of [{...raster('../escape.bin')},{...raster('/absolute.bin')},{...raster('data/one.bin'),size:0},
    {...raster('data/one.bin'),values:{type:'f64',count:4,data:{file:'data/one.bin'}}}])expect(()=>new ScalarLatticeBindings().lattice(row)).toThrow();
  for(const values of [[0,0,0,Infinity],[0,0,0,Number.NaN],[0,0,0,1.01],[-.01,0,0,1]]){
    const binding=new ScalarLatticeBindings(),sample=binding.lattice(raster('data/one.bin'),{min:0,max:1});
    expect(()=>binding.prepare(new Map([['data/one.bin',compressed(values)]]))).toThrow();expect(()=>sample(0,0)).toThrow('not prepared');
  }
  const binding=new ScalarLatticeBindings();binding.lattice(raster('data/one.bin'));
  expect(()=>binding.lattice({...raster('data/one.bin'),size:32})).toThrow('Conflicting');
});

test('every actual geography sidecar retains the original compressed bytes through standard SDK intake',async()=>{
  const blocks=readNalatiScalarBlocks();expect(blocks.size).toBe(12);
  for(const row of reference){
    const blob=await readNamedBlob('src/shards/nalati-grasslands',row.file,row.file,'bin',{decoded:row.decoded});
    expect(blob.bytes).toEqual(blocks.get(row.file));expect(blob.bytes.length).toBe(row.bytes);
    expect(createHash('sha256').update(blob.bytes).digest('hex')).toBe(row.hash);expect(blob.file.decoded).toBe(row.decoded);
  }
});

test('raw f64 channels preserve signed zero and malformed accessors are never invoked',()=>{
  const bytes=zlibSync(new Uint8Array(new Float64Array([-0,Number.MAX_VALUE]).buffer));
  const decoded=readScalarChannel({type:'f64',count:2,data:{file:'data/f64.bin'}},new Map([['data/f64.bin',bytes]]));
  expect(decoded).toBeInstanceOf(Float64Array);expect(Object.is(decoded[0],-0)).toBe(true);expect(decoded[1]).toBe(Number.MAX_VALUE);
  let calls=0;const row={...raster('data/one.bin'),get size(){calls++;return 500;}};
  expect(()=>new ScalarLatticeBindings().lattice(row)).toThrow('plain JSON');expect(calls).toBe(0);
});
