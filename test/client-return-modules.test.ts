// @vitest-environment happy-dom
import {parseReturnProjectionV2} from '../src/format/returnProjectionV2';
import {expect,test,vi} from 'vitest';
import {Scope} from '../src/engine/app/scope';
import {ReturnProgram} from '../src/game/population/returnProgram';
import {prepareClientReturnModules} from '../src/game/shardfile/clientReturnModules';
import {clientNativeBook} from '../src/game/shardfile/clientNativeBook';
import * as descriptors from '../src/game/shardfile/outputDescriptor';
import type {OutputDescriptor} from '../src/game/shardfile/outputDescriptor';
import {createShardProduct} from '../src/game/shardfile/shardProduct';
import {emptyShardfile} from '../src/sdk/author';
import type {ShardContext} from '../src/game/plugin/context';
import {legacyDouble} from './fake/FakeGame';
import programs from '../src/shards/nalati-grasslands/behaviour/titan.generated.json' with {type:'json'};

test('page preparation lends the same verified book to sibling construction and actual level scopes',async()=>{
  const root=new Scope('page'),scope=root.child('construction'),level=root.child('entered');
  const row=structuredClone(programs.attack),artifact=parseReturnProjectionV2(row.v2).artifact;
  const bytes=Uint8Array.from(atob(row.v2.bytes),value=>value.codePointAt(0)??0);row.v2.bytes='';
  const name='behaviour/fixture.wasm';
  const returns=[{id:'fixture.projection',module:`blobs/wasm/${artifact.hash}.wasm`,side:'sim' as const,abi:2 as const,lane:'project' as const,
    pages:artifact.pages,ioBytes:artifact.ioBytes,compilerRevision:artifact.compilerRevision,admissionRevision:artifact.admissionRevision}];
  const source=emptyShardfile({slug:'fixture-place',name:'Place',author:'Fixture',revision:1,seed:7});
  const read=vi.fn(()=>Promise.resolve(bytes));
  const product=createShardProduct({slug:'fixture-place',revision:1,shardfile:source,
    sections:new Map([['actors/return-scripts',returns]]),files:new Map([[name,{hash:artifact.hash,url:'fixture.wasm'}]]),read});
  const ctx=legacyDouble<ShardContext>({scope,product,game:legacyDouble<ShardContext['game']>({
    runtime:legacyDouble<NonNullable<ShardContext['game']['runtime']>>({world:legacyDouble<NonNullable<NonNullable<ShardContext['game']['runtime']>['world']>>({
      game:legacyDouble<NonNullable<NonNullable<ShardContext['game']['runtime']>['world']>['game']>({levelScope:level})})})})});
  const descriptor=vi.spyOn(descriptors,'outputDescriptor').mockReturnValue(legacyDouble<OutputDescriptor>({
    index:legacyDouble<OutputDescriptor['index']>({files:[legacyDouble<OutputDescriptor['index']['files'][number]>({kind:'wasm',hash:artifact.hash,name})]})}));
  const lend=vi.spyOn(ReturnProgram,'lendModules');
  try{
    await prepareClientReturnModules(ctx);await prepareClientReturnModules(ctx);
    const assets=clientNativeBook(ctx).decisionAssets;
    expect(assets.get(artifact.hash)).toBe(bytes);expect(read).toHaveBeenCalledOnce();
    expect(lend).toHaveBeenCalledWith(scope,assets,returns);expect(lend).toHaveBeenCalledWith(level,assets,returns);
    expect(ReturnProgram.page(row,level).project('bossClamp',{fullHp:100,share:.3})).toEqual({hp:30});
    expect(ReturnProgram.page(row,scope).project('bossClamp',{fullHp:100,share:.3})).toEqual({hp:30});
  }finally{lend.mockRestore();descriptor.mockRestore();root.dispose();}
});
