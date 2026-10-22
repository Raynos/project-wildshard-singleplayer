// @vitest-environment happy-dom
import { Group, type Material } from 'three';
import type { ShardContext } from '../src/game/plugin/context';
import type { ShardWorld } from '../src/game/shard/world';
import type { ShardRuntime } from '../src/game/shard/runtime';
import type { FixedDraws } from '../src/game/models/fixedDraws';
import { WorldAssembly } from '../src/game/shardfile/worldAssembly';
import { SceneHandles } from '../src/game/shardfile/sceneHandles';
import { bindResidentWorldScope } from '../src/game/shardfile/hybridPresentation';
import { entryOwner,publishEntryOwner } from '../src/game/shardfile/entryOwners';
import * as runtimeProduct from '../src/game/shardfile/runtimeProduct';
import * as sceneHost from '../src/game/shardfile/worldScenes';
import * as bakedHost from '../src/game/shardfile/bakedTiles';
import { legacyDouble } from './fake/FakeGame';
import { expect,test,vi } from 'vitest';
import * as v from 'valibot';
import { Scope } from '../src/engine/app/scope';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { parseClientPlan } from '../src/format/clientPlan';
import { CLIENT_FEATURES,admitClientPlan } from '../src/game/shardfile/clientPlan';
import { formatJsonSchema } from '../src/sdk/formatJsonSchema';
import { ResolvedIslandLibrarySchema } from '../src/format/islandLibrary';
import { admittedIslandBook,preflightIslandBook } from '../src/game/shardfile/islandBook';
import { explorerRoster } from '../src/game/models/explorerCatalogue';
import { collectionRows } from '../src/shards/driftwood-isle/generators/collections';

const rows={construction:{cells:{phone:'cells.bin',desktop:'cells.bin'},seed:1,progress:{total:1,start:'Start',finish:'Finish',budgetMs:30},
  checkpoints:[],gpu:{label:'gpu',roots:[{kind:'object',id:'root'}]},looks:{unbound:[],bound:[]},publish:{draws:'draws',collection:'collection'}},
  stages:[{kind:'group',id:'root',label:'Root',part:'root'}]};
const row=parseClientPlan({version:1,features:[{kind:'world.assembly',library:'fixture.island',catalogue:'models.json',rows}]}).features[0];
if(row?.kind!=='world.assembly'||row.library===undefined||row.catalogue===undefined)throw new Error('Missing assembly fixture');
const assembly={...row,library:row.library,catalogue:row.catalogue};
const book={id:assembly.library,draws:[{slot:'chime',file:'mesh.glb',channels:[]}],groups:'groups.json',figures:'figures.json',collections:{chime:'chime'}};
const siteCatalogue={product:'fixture-island',models:[{key:'site',id:'fixture-island/site',name:'Site',file:'fixture.json',category:'props',pipeline:'blender',defaults:{},variants:[],
  choices:[{id:'world',params:{},size:[1,1,1],draws:[],lods:[],colliders:[]}]}]};
function fixture(root:unknown=book,features:unknown[]=[assembly]){
  const source=emptyShardfile({slug:'fixture-island',name:'Test',author:'Test',revision:1,seed:1});
  const sections=new Map<string,unknown>([['client/plan',{version:1,features}],['custom/fixedLayouts',root],['world/scenes',{catalogue:'models.json',version:1,libraries:[],materials:[],steps:[]}],
    ['custom/collections',collectionRows()],['explore/catalogue',{version:1,entries:[{kind:'scene-model',library:book.id,model:'site',copies:0,drawnAs:'single'}]}]]);
  const reads=vi.fn((name:string)=>Promise.resolve(new TextEncoder().encode(JSON.stringify(name==='models.json'?siteCatalogue:{}))));
  const product=createShardProduct({slug:source.identity.slug,revision:1,shardfile:source,sections,
    files:new Map(['models.json','groups.json','figures.json','mesh.glb'].map(name=>[name,{hash:name,url:name}])),read:reads});
  return{product,sections,reads};
}

test('whole-plan admission preflights a strict finite matching book before any read',()=>{
  const f=fixture();expect(()=>preflightIslandBook(f.product,assembly)).not.toThrow();expect(f.reads).not.toHaveBeenCalled();
  expect(()=>admitClientPlan(f.product.section('client/plan'),f.product)).not.toThrow();
  for(const root of [{...book,id:'other'},{...book,draws:{section:'custom/old',field:'draws'}},{...book,collections:{chime:'missing'}},{...book,callback:()=>undefined}]){
    const bad=fixture(root);expect(()=>admitClientPlan(bad.product.section('client/plan'),bad.product)).toThrow();expect(bad.reads).not.toHaveBeenCalled();
  }
  const missing=fixture(book,[{...assembly,rows:{...rows,construction:{...rows.construction,looks:undefined}}}]);
  expect(()=>admitClientPlan(missing.product.section('client/plan'),missing.product)).toThrow();expect(missing.reads).not.toHaveBeenCalled();
  expect(()=>preflightIslandBook(f.product,{...assembly,catalogue:'other.json'})).toThrow('catalogue');
});

test('cold Explorer and construction readers resolve the same pinned record in either order',async()=>{
  for(const coldFirst of [true,false]){
    const f=fixture(),owner=new Scope('book-source');
    try{
      const first=await owner.run(()=>coldFirst?explorerRoster(f.product,[]):admittedIslandBook(f.product,book.id));
      const record=await owner.run(()=>admittedIslandBook(f.product,book.id));
      const roster=await owner.run(()=>explorerRoster(f.product,[]));
      expect(roster[0]?.id).toBe(record.sites.model('site').id);
      if(!Array.isArray(first))expect(first).toBe(record);
      expect(await owner.run(()=>admittedIslandBook(f.product,book.id))).toBe(record);
      expect(f.reads.mock.calls).toEqual([['models.json']]);
      expect(record.library.product).toBe(f.product);
      const other=fixture();expect((await owner.run(()=>admittedIslandBook(other.product,book.id))).library).not.toBe(record.library);
    }finally{owner.dispose();}
  }
});

test('unknown, duplicated or changed declarations refuse rather than creating another book',async()=>{
  const owner=new Scope('book-refusal'),f=fixture();
  try{
    await expect(owner.run(()=>admittedIslandBook(f.product,'missing'))).rejects.toThrow('one matching');expect(f.reads).not.toHaveBeenCalled();
    const duplicate=fixture(book,[assembly,assembly]);expect(()=>admitClientPlan(duplicate.product.section('client/plan'),duplicate.product)).toThrow('Duplicate client feature');await expect(owner.run(()=>admittedIslandBook(duplicate.product,book.id))).rejects.toThrow('Duplicate client feature');expect(duplicate.reads).not.toHaveBeenCalled();
    await owner.run(()=>admittedIslandBook(f.product,book.id));f.sections.set('custom/fixedLayouts',{...book});
    await expect(owner.run(()=>admittedIslandBook(f.product,book.id))).rejects.toThrow('changed');
    owner.dispose();await expect(owner.run(()=>admittedIslandBook(f.product,book.id))).rejects.toThrow('left');
  }finally{owner.dispose();}
});

test('the real registry rank and section schema keep assembly before world bindings',()=>{
  const entry=CLIENT_FEATURES['world.assembly'];expect({phase:entry.phase,rank:entry.rank,lifetime:entry.lifetime}).toEqual({phase:'world',rank:70,lifetime:'entered'});
  expect(entry.sections).toEqual(['world/scenes']);
  const schema=formatJsonSchema(ResolvedIslandLibrarySchema);expect(JSON.stringify(schema)).toContain('collections');expect(v.parse(ResolvedIslandLibrarySchema,book)).toEqual(book);
});

function emptyLooks(): Awaited<ReturnType<typeof runtimeProduct.runtimeLookMaterials>> {
  return {toon:legacyDouble<Awaited<ReturnType<typeof runtimeProduct.runtimeLookMaterials>>['toon']>({}),
    materials:new Map<string,Material>(),textures:new Map(),setParam:()=>undefined,setTexture:()=>undefined,
    compile:()=>{throw new Error('No compilation');},bindMeshMap:()=>{throw new Error('No mesh');},tick:()=>undefined,
    outline:()=>[],graphs:{bind:()=>undefined,readout:{compiled:0,fallback:0,reasons:[]}},surfaces:null};
}

function nativeFixture(f: ReturnType<typeof fixture>, construction?: Scope) {
  const scope=construction?.child('entered')??new Scope('unbound');
  if(construction!==undefined)bindResidentWorldScope(scope,construction);
  const world=legacyDouble<ShardWorld>({game:legacyDouble<ShardWorld['game']>({}),registry:legacyDouble<ShardWorld['registry']>({}),sky:legacyDouble<ShardWorld['sky']>({}),physics:legacyDouble<ShardWorld['physics']>({})}),runtime=legacyDouble<ShardRuntime>({world});
  const ctx=legacyDouble<ShardContext>({scope,product:f.product,cube:null,progress:legacyDouble<ShardContext['progress']>({set:()=>undefined,detail:()=>undefined}),game:legacyDouble<ShardContext['game']>({runtime})});
  return{scope,world,runtime,ctx};
}

test('native entered dispatch retains one bound build through leave/reentry and lends the original owners',async()=>{
  const f=fixture(),construction=new Scope('resident'),first=nativeFixture(f,construction),events:string[]=[],group=new Group();
  let finish:()=>void=()=>{throw new Error('No build');},started:()=>void=()=>{throw new Error('No start');};
  const complete=new Promise<void>(resolve=>{finish=resolve;}),begin=new Promise<void>(resolve=>{started=resolve;});
  const ownerBook=await first.scope.run(()=>admittedIslandBook(f.product,book.id));
  const materials=vi.spyOn(runtimeProduct,'runtimeLookMaterials').mockImplementation(ctx=>{events.push('looks');expect(ctx.scope).toBe(construction);return Promise.resolve(emptyLooks());});
  const scenes=vi.spyOn(sceneHost,'installWorldScenes').mockResolvedValue(new SceneHandles({setupMaterial:()=>undefined}));
  const baked=vi.spyOn(bakedHost,'residentBakedTiles').mockResolvedValue(new Map());
  const draws=legacyDouble<FixedDraws>({ready:true}),loaded=vi.spyOn(ownerBook.library,'loaded').mockReturnValue(draws);
  const build=vi.spyOn(WorldAssembly,'construct').mockImplementation(async(_rows,ports)=>{events.push('build');expect(ports.scope).toBe(construction);expect(ports.library).toBe(ownerBook.library);expect(ports.sites).toBe(ownerBook.sites);started();await complete;publishEntryOwner(ports.scope,'object','root',group);return {};});
  try{
    const pending=CLIENT_FEATURES['world.assembly'].install(first.ctx,assembly,construction);await Promise.race([begin,pending]);
    first.scope.dispose();finish();await expect(pending).rejects.toThrow('ended');
    expect(entryOwner(construction,'object','root')).toBe(group);expect(build).toHaveBeenCalledTimes(1);
    const next=nativeFixture(f,construction);Object.assign(next.ctx.game,{runtime:first.runtime});
    await CLIENT_FEATURES['world.assembly'].install(next.ctx,assembly,construction);
    expect(build).toHaveBeenCalledTimes(1);expect(events).toEqual(['looks','build']);
    const resolved=await next.scope.run(()=>admittedIslandBook(f.product,book.id));
    expect(entryOwner(next.scope,'collection','collection')).toBe(resolved.library.collections);
    expect(entryOwner(next.scope,'fixed-draws','draws')).toBe(draws);expect(entryOwner(next.scope,'object','root')).toBe(group);
    next.scope.dispose();expect(entryOwner(construction,'object','root')).toBe(group);
  }finally{finish();construction.dispose();for(const spy of[materials,scenes,baked,loaded,build])spy.mockRestore();}
});

test('unbound native construction keeps its entered authority and never acquires a resident cache',async()=>{
  const f=fixture(),first=nativeFixture(f),next=nativeFixture(f),owners:Scope[]=[];
  const ownerBook=await first.scope.run(()=>admittedIslandBook(f.product,book.id));
  const materials=vi.spyOn(runtimeProduct,'runtimeLookMaterials').mockResolvedValue(emptyLooks());
  const scenes=vi.spyOn(sceneHost,'installWorldScenes').mockResolvedValue(new SceneHandles({setupMaterial:()=>undefined}));
  const baked=vi.spyOn(bakedHost,'residentBakedTiles').mockResolvedValue(new Map());
  const draws=legacyDouble<FixedDraws>({ready:true}),loaded=vi.spyOn(ownerBook.library,'loaded').mockReturnValue(draws);
  const build=vi.spyOn(WorldAssembly,'construct').mockImplementation((_rows,ports)=>{owners.push(ports.scope);publishEntryOwner(ports.scope,'object','root',new Group());return Promise.resolve({});});
  try{
    await CLIENT_FEATURES['world.assembly'].install(first.ctx,assembly,first.scope);first.scope.dispose();
    await CLIENT_FEATURES['world.assembly'].install(next.ctx,assembly,next.scope);
    expect(owners).toEqual([first.scope,next.scope]);expect(build).toHaveBeenCalledTimes(2);
    expect(materials.mock.calls.map(call=>call[3])).toEqual([rows.construction.looks.unbound,rows.construction.looks.unbound]);
    next.scope.dispose();await expect(CLIENT_FEATURES['world.assembly'].install(next.ctx,assembly,next.scope)).rejects.toThrow('left');expect(build).toHaveBeenCalledTimes(2);
  }finally{first.scope.dispose();next.scope.dispose();for(const spy of[materials,scenes,baked,loaded,build])spy.mockRestore();}
});

test('caller retirement or a replaced book during catalogue read refuses later use',async()=>{
  for(const replace of [true,false]){
    const f=fixture(),owner=new Scope('book-await');
    let release:(bytes:Uint8Array)=>void=()=>{throw new Error('No gate');};const gate=new Promise<Uint8Array>(resolve=>{release=resolve;});
    f.reads.mockImplementation(async()=>Uint8Array.from(await gate));const pending=owner.run(()=>admittedIslandBook(f.product,book.id));
    if(replace)f.sections.set('custom/fixedLayouts',{...book});else owner.dispose();
    release(new TextEncoder().encode(JSON.stringify(siteCatalogue)));
    try{await expect(pending).rejects.toThrow(replace?'changed':'left');}finally{owner.dispose();}
  }
});
