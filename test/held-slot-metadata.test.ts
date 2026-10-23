import {afterEach,expect,test,vi} from 'vitest';
import {HeldClaims} from '../src/game/loadout/claims';
import {Scope} from '../src/engine/app/scope';
import type {ShardContext} from '../src/game/plugin/context';
import type {ShardRuntime} from '../src/game/shard/runtime';
import {createShardProduct} from '../src/game/shardfile/shardProduct';
import {emptyShardfile} from '../src/sdk/author';
import {parseItems} from '../src/format/items';
import {parseHeldSlots} from '../src/format/heldArms';
import * as geometry from '../src/game/plugin/geometry';
import {legacyDouble} from './fake/FakeGame';
import items from '../src/shards/nalati-grasslands/data/items.json' with {type:'json'};

const declaration={version:1,id:'metadata-kit',slots:[
  {id:'blade',kind:'blade',item:'weapon.sabre',source:{kind:'passes',file:'weapons/blade.json'}},
  {id:'polearm',kind:'polearm',item:'weapon.spear',file:'weapons/polearm.json'}],
  registration:['blade','polearm'],equipment:{primary:'blade',extras:['polearm']},selection:{unlock:[]},mount:[],refills:[],upgrades:[]};
const file='models/gear-book.json';
const book={rows:[{key:'reward',model:{id:'fixture/reward',name:'Reward',file:'fixture.ts',category:'gear',pipeline:'code',defaults:{}},source:{kind:'packed'}}],
  packed:{bin:'/assets/fixture/gear.bin',bytes:0,rows:[{key:'reward',parts:[]}]},materials:{}};
afterEach(()=>{vi.restoreAllMocks();});
function fixture(){
  const parent=new Scope('metadata-parent'),scope=parent.child('metadata-entry'),events:string[]=[];
  const source={...emptyShardfile({slug:'metadata-fixture',name:'Metadata fixture',author:'Fixture',revision:1,seed:1}),items:parseItems(items)};
  const read=vi.fn(()=>{events.push('book');return Promise.resolve(new TextEncoder().encode(JSON.stringify(book)));});
  const files=new Map([file,'weapons/blade.json','weapons/polearm.json'].map(name=>[name,{hash:'a'.repeat(64),url:`/fixture/${name}`} ]));
  const product=createShardProduct({slug:source.identity.slug,revision:1,shardfile:source,sections:new Map(),files,read});
  const held=HeldClaims.fromProductSlots(product,declaration,file),blade=held.blade('blade'),polearm=held.polearm('polearm');
  const bladePrepare=vi.spyOn(blade,'prepare').mockImplementation(()=>{events.push('blade');return Promise.resolve();});
  const polearmPrepare=vi.spyOn(polearm,'prepare').mockImplementation(()=>{events.push('polearm');return Promise.resolve();});
  vi.spyOn(blade,'profile').mockReturnValue(legacyDouble<ReturnType<typeof blade.profile>>({}));
  vi.spyOn(polearm,'profile').mockReturnValue(legacyDouble<ReturnType<typeof polearm.profile>>({}));
  const packed=vi.spyOn(geometry,'fetchLaneBake').mockImplementation(url=>{events.push(`packed:${url}`);return Promise.resolve(new Uint8Array());});
  const runtime=legacyDouble<ShardRuntime>({world:legacyDouble<NonNullable<ShardRuntime['world']>>({})});
  const weapon=vi.fn<ShardContext['rows']['weapon']>();
  const ctx=legacyDouble<ShardContext>({scope,product,app:legacyDouble<ShardContext['app']>({equipment:null}),game:legacyDouble<ShardContext['game']>({runtime}),rows:legacyDouble<ShardContext['rows']>({weapon})});
  return {parent,scope,product,files,held,blade,polearm,bladePrepare,polearmPrepare,packed,ctx,runtime,events,read,weapon};
}

test('metadata is pinned to actual product/id/rows/file and cold lookup performs no preparation',()=>{
  const f=fixture(),other=fixture();
  try {
    expect(HeldClaims.fromProductSlots(f.product,parseHeldSlots(declaration),file)).toBe(f.held);
    expect(other.held===f.held).toBe(false);expect(other.held.blade('blade')===f.blade).toBe(false);
    expect(()=>HeldClaims.fromProductSlots(f.product,{...declaration,mount:['blade']},file)).toThrow('declaration was replaced');
    expect(()=>HeldClaims.fromProductSlots(f.product,declaration,'weapons/blade.json')).toThrow('declaration was replaced');
    expect(f.read).not.toHaveBeenCalled();expect(f.bladePrepare).not.toHaveBeenCalled();expect(f.polearmPrepare).not.toHaveBeenCalled();expect(f.packed).not.toHaveBeenCalled();
    expect(()=>f.held.model('reward')).toThrow('not prepared');expect(()=>f.held.installPage(f.ctx)).toThrow('not prepared for this owner');expect(f.weapon).not.toHaveBeenCalled();
  } finally {f.parent.dispose();other.parent.dispose();}
});

test('preparation retains blade then polearm then original book and one original packed decode',async()=>{
  const f=fixture();
  try {
    await f.held.prepareSlotSources(f.ctx);
    expect(f.events).toEqual(['blade','polearm','book','packed:/assets/fixture/gear.bin']);
    expect(f.held.blade('blade')).toBe(f.blade);expect(f.held.polearm('polearm')).toBe(f.polearm);
    const model=f.held.model('reward');expect(model.id).toBe('fixture/reward');
    f.held.installPage(f.ctx);expect(f.weapon).toHaveBeenCalledOnce();
    f.scope.dispose();expect(f.held.model('reward')).toMatchObject({id:model.id,name:model.name,file:model.file,defaults:model.defaults});
    const nextScope=f.parent.child('next-entry'),next={...f.ctx,scope:nextScope};
    expect(()=>f.held.installPage(next)).toThrow('not prepared for this owner');
    await f.held.prepareSlotSources(next);f.held.installPage(next);
    expect(f.held.model('reward')).toMatchObject({id:model.id,name:model.name,file:model.file,defaults:model.defaults});expect(f.events).toEqual(['blade','polearm','book','packed:/assets/fixture/gear.bin']);
    expect(f.bladePrepare).toHaveBeenCalledOnce();expect(f.polearmPrepare).toHaveBeenCalledOnce();expect(f.packed).toHaveBeenCalledOnce();
  } finally {f.parent.dispose();}
});

test('retirement at the first source yield refuses the rest of preparation and readiness',async()=>{
  const f=fixture();let finish:(()=>void)|undefined;
  f.bladePrepare.mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;}));
  try {
    const pending=f.held.prepareSlotSources(f.ctx);f.scope.dispose();
    if(finish===undefined)throw new Error('Missing metadata preparation pause');finish();
    await expect(pending).rejects.toThrow('owner has ended');expect(f.polearmPrepare).not.toHaveBeenCalled();expect(f.read).not.toHaveBeenCalled();expect(f.packed).not.toHaveBeenCalled();expect(f.weapon).not.toHaveBeenCalled();
    expect(()=>f.held.model('reward')).toThrow('not prepared');
  } finally {f.parent.dispose();}
});

test('a replaced product callable refuses before book decode or publication',async()=>{
  const f=fixture();let finish:(()=>void)|undefined;
  f.polearmPrepare.mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;}));
  try {
    const pending=f.held.prepareSlotSources(f.ctx);await Promise.resolve();
    Object.defineProperty(f.product,'json',{value:()=>Promise.resolve(book)});
    if(finish===undefined)throw new Error('Missing metadata preparation pause');finish();
    await expect(pending).rejects.toThrow('metadata owner was replaced');expect(f.read).not.toHaveBeenCalled();expect(f.packed).not.toHaveBeenCalled();expect(f.weapon).not.toHaveBeenCalled();
  } finally {f.parent.dispose();}
});

test('a concurrent preparation cannot mutate the original source set',async()=>{
  const f=fixture();let finish:(()=>void)|undefined;
  f.bladePrepare.mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;}));
  try {
    const first=f.held.prepareSlotSources(f.ctx);
    await expect(f.held.prepareSlotSources(f.ctx)).rejects.toThrow('already preparing');expect(f.bladePrepare).toHaveBeenCalledOnce();
    if(finish===undefined)throw new Error('Missing metadata preparation pause');finish();await first;
    expect(f.polearmPrepare).toHaveBeenCalledOnce();expect(f.packed).toHaveBeenCalledOnce();
  } finally {f.parent.dispose();}
});

test('replacing a concrete blade constructor during a yield cannot prepare later sources',async()=>{
  const f=fixture();let finish:(()=>void)|undefined;
  f.bladePrepare.mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;}));
  try {
    const pending=f.held.prepareSlotSources(f.ctx),Original=f.blade.Weapon;
    Object.defineProperty(f.blade,'Weapon',{value:class extends Original{}});
    if(finish===undefined)throw new Error('Missing metadata preparation pause');finish();
    await expect(pending).rejects.toThrow('blade source was replaced');expect(f.polearmPrepare).not.toHaveBeenCalled();expect(f.read).not.toHaveBeenCalled();expect(f.packed).not.toHaveBeenCalled();expect(f.weapon).not.toHaveBeenCalled();
  } finally {f.parent.dispose();}
});


test('a changed named source URL cannot reuse the pinned metadata declaration',async()=>{
  const f=fixture();
  try {
    const row=f.files.get('weapons/blade.json');if(row===undefined)throw new Error('Missing original source row');row.url='/fixture/replaced-blade.json';
    expect(()=>HeldClaims.fromProductSlots(f.product,declaration,file)).toThrow('metadata owner was replaced');
    await expect(f.held.prepareSlotSources(f.ctx)).rejects.toThrow('metadata owner was replaced');
    expect(f.bladePrepare).not.toHaveBeenCalled();expect(f.polearmPrepare).not.toHaveBeenCalled();expect(f.read).not.toHaveBeenCalled();expect(f.packed).not.toHaveBeenCalled();
  } finally {f.parent.dispose();}
});
