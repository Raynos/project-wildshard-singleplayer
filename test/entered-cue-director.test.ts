import { expect,test } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import type { Game } from '../src/engine/core/Game';
import type { ShardContext } from '../src/game/plugin/context';
import { CueDirector } from '../src/game/audio/cueDirector';
import { clientNativeBook } from '../src/game/shardfile/clientNativeBook';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '@wildshard/sdk/author';
import { legacyDouble } from './fake/FakeGame';

test('entered cue identities stay isolated by product and entered lifetime',()=>{
  const scope=new Scope('cue-entry'),other=new Scope('other-cue-entry');
  const product=(slug:string)=>createShardProduct({slug,revision:1,shardfile:emptyShardfile({slug,name:slug,author:'Wildshard',revision:1,seed:1}),sections:new Map(),files:new Map(),read:()=>Promise.reject(new Error('No asset reads'))});
  const firstProduct=product('first-cue'),secondProduct=product('second-cue');
  const first=legacyDouble<ShardContext>({scope,product:firstProduct}),second=legacyDouble<ShardContext>({scope,product:secondProduct});
  const reentered=legacyDouble<ShardContext>({scope:other,product:firstProduct});
  const rows={version:1,fields:[],rows:[]},game=legacyDouble<Game>({levelScope:scope});
  const a=new CueDirector(game,rows,scope),b=new CueDirector(game,rows,scope);
  try{
    clientNativeBook(first).presentations.set('night',a);clientNativeBook(second).presentations.set('night',b);
    expect(CueDirector.entered(first,'night')).toBe(a);expect(CueDirector.entered(second,'night')).toBe(b);
    expect(CueDirector.entered(first,'missing')).toBeUndefined();expect(CueDirector.entered(reentered,'night')).toBeUndefined();
    scope.dispose();expect(()=>CueDirector.entered(first,'night')).toThrow('living entered scope');
    expect(CueDirector.entered(reentered,'night')).toBeUndefined();
  }finally{scope.dispose();other.dispose();}
});
