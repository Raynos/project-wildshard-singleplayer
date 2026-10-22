import { afterEach, expect, test, vi } from 'vitest';
import { HeldClaims } from '../src/game/loadout/claims';
import { MountedArsenal } from '../src/game/loadout/mounted';
import { Scope } from '../src/engine/app/scope';
import type { Targets } from '../src/engine/combat/types';
import type { EquipmentService } from '../src/engine/combat/EquipmentService';
import type { ShardContext } from '../src/game/plugin/context';
import type { ShardRuntime } from '../src/game/shard/runtime';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { parseItems } from '../src/format/items';
import { parseHeldSlots } from '../src/format/heldArms';
import { ItemCatalogue } from '../src/game/plugin/nativeItems';
import { legacyDouble } from './fake/FakeGame';
import * as native from '../src/game/plugin/headless';
import * as bowBinding from '../src/game/weapons/Bow';
import * as firearmBinding from '../src/game/plugin/heldFirearm';
import * as launcher from '../src/game/weapons/heldLauncher';
import * as plan from '../src/engine/boot/plan';
import type { VariantBowPower } from '../src/game/weapons/bowVariant';
import type { ArcWeaponPower } from '../src/game/weapons/arcPower';
import items from '../src/shards/nalati-grasslands/data/items.json' with { type:'json' };
import loadout from '../src/shards/nalati-grasslands/data/loadout.json' with { type:'json' };

const original={...loadout,variants:{bow:{id:'weapon.golden-bow',name:'Golden Bow'},blade:{id:'weapon.naizagai',name:'Naizagai'}}};
function slots(){return parseHeldSlots({version:1,id:'native-kit',bindAt:'equipment',pause:true,
  slots:[{id:'blade',kind:'blade',item:loadout.blade.item,source:{kind:'passes',file:loadout.blade.file}},
    {id:'polearm',kind:'polearm',...loadout.polearm},{id:'bow',kind:'bow',...loadout.bow},{id:'firearm',kind:'firearm',...loadout.page.firearm}],
  registration:['bow','blade','polearm','firearm'],equipment:{primary:'blade',rifle:'firearm',extras:['bow','polearm'],order:['bow','blade','polearm']},
  selection:{initial:'bow',unlock:['bow','polearm']},mount:['blade','polearm','bow'],
  refills:[{slot:'polearm',kind:'fill-capacity'},{slot:'bow',kind:'add-magazine'}],
  upgrades:[{id:'bow-reward',slot:'bow',kind:'bow',replacement:{item:'weapon.golden-bow',name:'Golden Bow'}},
    {id:'blade-reward',slot:'blade',kind:'blade-pass',replacement:{item:'weapon.naizagai',name:'Naizagai'}}]});}

afterEach(()=>{vi.restoreAllMocks();});
function fixture(mode:'original'|'slots'){
  const parent=new Scope('slot-parent'),scope=parent.child('slot-entry');
  const source={...emptyShardfile({slug:'native-slots',name:'Native slots',author:'Fixture',revision:1,seed:1}),items:parseItems(items)};
  const catalogue=new ItemCatalogue(source.items),events:string[]=[],registered:string[]=[];
  const owner=mode==='original'?new MountedArsenal(original):HeldClaims.fromSlots(slots());
  const blade=owner instanceof MountedArsenal?owner.blade:owner.blade('blade');
  const polearm=owner instanceof MountedArsenal?owner.polearm:owner.polearm('polearm');
  const bladeProfile=legacyDouble<ReturnType<typeof blade.profile>>({...catalogue.equipment(loadout.blade.item)});
  vi.spyOn(blade,'profile').mockReturnValue(bladeProfile);
  vi.spyOn(polearm,'profile').mockReturnValue(legacyDouble<ReturnType<typeof polearm.profile>>({}));
  type Blade=InstanceType<typeof blade.Weapon>;
  type Polearm=InstanceType<typeof polearm.Weapon>;
  type Bow=InstanceType<typeof bowBinding.Bow>;
  const bows:Bow[]=[],blades:Blade[]=[],mounts=new Map<Bow,Blade['mount']>();
  function makeBlade(...args:ConstructorParameters<typeof blade.Weapon>):Blade {
    const options=args[2];
    const row=options?.profile??bladeProfile,id=row.legacySlot;if(id===undefined)throw new Error('Missing native blade slot');
    events.push(`blade:${row.id}`);
    const weapon=legacyDouble<Blade>({row,id,meta:row.meta,mount:null,passChain:0,
      carryPassState:previous=>{weapon.mount=previous.mount;weapon.passChain=previous.passChain;events.push('blade:carry');}});
    blades.push(weapon);return weapon;
  }
  vi.spyOn(blade,'Weapon').mockImplementation(legacyDouble<typeof blade.Weapon>(Object.assign(makeBlade,{prototype:blade.Weapon.prototype})));
  function makePolearm():Polearm {
    const row=catalogue.equipment(loadout.polearm.item),id=row.legacySlot;if(id===undefined)throw new Error('Missing native polearm slot');
    events.push(`polearm:${row.id}`);return legacyDouble<Polearm>({row,id,meta:row.meta,mount:null,javelins:1,maxJavelins:6});
  }
  vi.spyOn(polearm,'Weapon').mockImplementation(legacyDouble<typeof polearm.Weapon>(Object.assign(makePolearm,{prototype:legacyDouble<Polearm>({})})));
  function makeBow(...args:ConstructorParameters<typeof bowBinding.Bow>):Bow {
    const options=args[2];
    const row=options.row,id=row.legacySlot;if(id===undefined)throw new Error('Missing native bow slot');
    events.push(`bow:${row.id}`);
    const weapon=legacyDouble<Bow>({row,id,meta:row.meta,magazine:9,damageMultiplier:undefined,onLoose:undefined,
      addBolts:value=>{events.push(`bow:refill:${value}`);},setMount:value=>{mounts.set(weapon,value);events.push('bow:mount');},
      carryMountState:previous=>{mounts.set(weapon,mounts.get(previous)??null);events.push('bow:carry');}});
    bows.push(weapon);return weapon;
  }
  vi.spyOn(bowBinding,'Bow').mockImplementation(legacyDouble<typeof bowBinding.Bow>(Object.assign(makeBow,{prototype:bowBinding.Bow.prototype})));
  function makeFirearm(...args:ConstructorParameters<typeof firearmBinding.HeldFirearm>):InstanceType<typeof firearmBinding.HeldFirearm> {
    const options=args[2];
    const row=options.row,id=row.legacySlot;if(id===undefined)throw new Error('Missing native firearm slot');
    events.push(`firearm:${row.id}`);return legacyDouble<InstanceType<typeof firearmBinding.HeldFirearm>>({row,id,meta:row.meta});
  }
  vi.spyOn(firearmBinding,'HeldFirearm').mockImplementation(legacyDouble<typeof firearmBinding.HeldFirearm>(Object.assign(makeFirearm,{prototype:firearmBinding.HeldFirearm.prototype})));
  type BowRead=Awaited<ReturnType<typeof launcher.loadHeldBow>>;
  vi.spyOn(launcher,'loadHeldBow').mockImplementation(()=>{events.push('bow:read');return Promise.resolve({profile:legacyDouble<BowRead['profile']>({}),rows:legacyDouble<BowRead['rows']>({}),model:{}});});
  vi.spyOn(plan,'macrotask').mockImplementation(()=>{events.push('pause');return Promise.resolve();});
  const bind=vi.spyOn(native,'bindRuntimeEquipment').mockReturnValue(legacyDouble<ReturnType<typeof native.bindRuntimeEquipment>>({}));
  const bytes=new TextEncoder().encode(JSON.stringify({feel:{},view:{},rows:{}}));
  const read=vi.fn(()=>{events.push('firearm:read');return Promise.resolve(bytes);});
  const product=createShardProduct({slug:source.identity.slug,revision:1,shardfile:source,sections:new Map(),
    files:new Map([[loadout.page.firearm.file,{hash:'a'.repeat(64),url:'/firearm.json'}]]),read});
  const world=legacyDouble<NonNullable<ShardRuntime['world']>>({}),runtime=legacyDouble<ShardRuntime>({world});
  const ctx=legacyDouble<ShardContext>({scope,product,app:legacyDouble<ShardContext['app']>({equipment:null}),
    game:legacyDouble<ShardContext['game']>({runtime}),rows:legacyDouble<ShardContext['rows']>({weapon:rows=>{
      if('id' in rows)registered.push(rows.id);else for(const row of rows)registered.push(row.id);
    }})});
  return {parent,scope,source,owner,blade,polearm,ctx,runtime,events,registered,read,bind,bows,blades,mounts};
}

async function run(mode:'original'|'slots'){
  const f=fixture(mode);
  try {
    f.owner.installPage(f.ctx);const builder=f.runtime.buildEquipment;
    if(builder===undefined)throw new Error('Missing native slot builder');
    const result=await builder(legacyDouble<Targets>({}),false),kit=f.owner.pageKit(f.ctx);
    if(kit===null)throw new Error('Missing original kit');
    const currentBow=()=>('blade' in kit?kit.bow('bow'):kit.bow);
    const currentBlade=()=>('blade' in kit?kit.blade('blade'):kit.sabre);
    const spear='polearm' in kit?kit.polearm('polearm'):kit.spear;
    const weapons=new Map([result.primary,...(result.extras??[]),...(result.rifle===null?[]:[result.rifle])].map(weapon=>[weapon.id,weapon]));
    const events=f.events,selection:string[]=[],equipment=legacyDouble<EquipmentService>({
      get:id=>{const weapon=weapons.get(id);if(weapon===undefined)throw new Error('Missing native weapon');return weapon;},
      replace:(id,next)=>{const old=weapons.get(id);if(old===undefined||next.id!==old.id)throw new Error('Invalid native replacement');events.push(`replace:${next.row.id}`);weapons.set(id,next);},
      unlock:id=>{selection.push(`unlock:${id}`);},select:id=>{selection.push(`select:${id}`);},
    });
    result.install?.(equipment);expect(result.primary).toBe(currentBlade());
    expect(result.order).toEqual(['bow','sabre','spear']);expect(selection).toEqual(['unlock:bow','unlock:spear','select:bow']);
    const initial=currentBow(),bladeBefore=currentBlade(),mount={speed:7,yaw:.2};
    const damage=vi.fn(()=>2),loose=vi.fn<NonNullable<InstanceType<typeof bowBinding.Bow>['onLoose']>>();initial.damageMultiplier=damage;initial.onLoose=loose;bladeBefore.passChain=3;
    kit.setMount(mount);kit.refill();
    const power=legacyDouble<VariantBowPower>({apply:bow=>{expect(bow.damageMultiplier).toBe(damage);expect(bow.onLoose).toBe(loose);events.push('bow:power');}});
    const bladePower=legacyDouble<ArcWeaponPower>({});
    if('blade' in kit){kit.upgradeBow('bow-reward',equipment,power);kit.upgradeBlade('blade-reward',equipment,bladePower);}
    else {kit.upgradeBow(equipment,power);kit.upgradeSabre(equipment,bladePower);}
    const bow=currentBow(),blade=currentBlade();
    expect(bow===initial,JSON.stringify(f.events)).toBe(false);expect(blade===bladeBefore,JSON.stringify(f.events)).toBe(false);expect(blade.passChain).toBe(3);
    expect(blade.mount).toBe(mount);expect(f.mounts.get(bow)).toBe(mount);expect(weapons.get('sabre')).toBe(blade);expect('blade' in kit?kit.weapon('blade'):kit.base).toBe(blade);
    kit.refill();expect(spear.javelins).toBe(spear.maxJavelins);
    const before=f.events.length;
    if('blade' in kit){kit.upgradeBow('bow-reward',equipment,power);kit.upgradeBlade('blade-reward',equipment,bladePower);}
    else {kit.upgradeBow(equipment,power);kit.upgradeSabre(equipment,bladePower);}
    expect(f.events.length).toBe(before);
    return {events:[...f.events],registered:[...f.registered],selection,bow:bow.row,blade:blade.row};
  } finally {f.parent.dispose();vi.restoreAllMocks();}
}

test('finite slot construction, registration, selection and native reward ordering match the original arsenal',async()=>{
  expect(await run('slots')).toEqual(await run('original'));
});

test('cold slots retain original concrete metadata and never prepare or read an asset',()=>{
  const f=fixture('slots');
  try {
    const owner=f.owner;if(!(owner instanceof HeldClaims))throw new Error('Missing slot owner');
    expect(owner.blade('blade')).toBe(f.blade);expect(owner.polearm('polearm')).toBe(f.polearm);
    expect(f.read).not.toHaveBeenCalled();expect(f.events).toEqual([]);expect(f.owner.pageKit(f.ctx)).toBeNull();
    expect(()=>owner.blade('missing')).toThrow();
  } finally {f.parent.dispose();}
});

test('whole registration preflight refuses a malformed suffix before any metadata effects',()=>{
  const f=fixture('slots');
  try {
    const row=f.source.items.rows.find(entry=>entry.id===loadout.page.firearm.item);if(row?.kind!=='weapon')throw new Error('Missing firearm');
    delete row.profile;
    expect(()=>f.owner.installPage(f.ctx)).toThrow('native profile');expect(f.registered).toEqual([]);expect(f.events).toEqual([]);
  } finally {f.parent.dispose();}
});

test('a retired original scope cannot lend its kit or publish a new native build',async()=>{
  const f=fixture('slots');
  try {
    f.owner.installPage(f.ctx);const builder=f.runtime.buildEquipment;if(builder===undefined)throw new Error('Missing native builder');
    await builder(legacyDouble<Targets>({}),false);const kit=f.owner.pageKit(f.ctx);if(kit===null||!('blade' in kit))throw new Error('Missing slot kit');
    f.parent.onDispose(()=>undefined);const disposal=f.parent.disposeSteps();disposal.next();
    expect(f.scope.disposing).toBe(true);expect(f.owner.pageKit(f.ctx)).toBeNull();
    expect(()=>kit.bow('bow')).toThrow('owner has ended');expect(()=>kit.refill()).toThrow('owner has ended');
    await expect(builder(legacyDouble<Targets>({}),false)).rejects.toThrow('owner has ended');
    for(const _step of disposal){/* Complete the real ancestor retirement. */}
  } finally {f.parent.dispose();}
});


test('a suspended construction cannot publish after its concrete world is replaced',async()=>{
  const f=fixture('slots');let finish:(()=>void)|undefined;
  const paused=new Promise<void>(resolve=>{finish=resolve;});
  vi.spyOn(plan,'macrotask').mockReturnValue(paused);
  try {
    f.owner.installPage(f.ctx);const builder=f.runtime.buildEquipment;if(builder===undefined)throw new Error('Missing native builder');
    const pending=builder(legacyDouble<Targets>({}),false);
    expect(f.events).toEqual(['blade:weapon.sabre']);
    f.runtime.world=legacyDouble<NonNullable<ShardRuntime['world']>>({});
    if(finish===undefined)throw new Error('Missing construction pause');finish();
    await expect(pending).rejects.toThrow('owner was replaced');
    expect(f.events).toEqual(['blade:weapon.sabre']);expect(f.owner.pageKit(f.ctx)).toBeNull();
  } finally {f.parent.dispose();}
});

test('concurrent native construction refuses before allocating another weapon',async()=>{
  const f=fixture('slots');let finish:(()=>void)|undefined;
  const paused=new Promise<void>(resolve=>{finish=resolve;});
  vi.spyOn(plan,'macrotask').mockReturnValue(paused);
  try {
    f.owner.installPage(f.ctx);const builder=f.runtime.buildEquipment;if(builder===undefined)throw new Error('Missing native builder');
    const first=builder(legacyDouble<Targets>({}),false);
    await expect(builder(legacyDouble<Targets>({}),false)).rejects.toThrow('already started');
    expect(f.events).toEqual(['blade:weapon.sabre']);
    if(finish===undefined)throw new Error('Missing construction pause');finish();
    await first;expect(f.blades).toHaveLength(1);expect(f.bows).toHaveLength(1);
  } finally {f.parent.dispose();}
});
