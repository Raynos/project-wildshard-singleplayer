import {expect,test,vi} from 'vitest';
import * as THREE from 'three';
import * as bowBinding from '../src/game/weapons/Bow';
import {HeldClaims} from '../src/game/loadout/claims';
import {parseHeldSlots,HeldSlotsSchema} from '../src/format/heldArms';
import {namedJsonSchema} from '../src/sdk/formatJsonSchema';
import {bindEquipmentActors,equipmentActorOwner} from '../src/game/loadout/actors';
import {AnimalManager} from '../src/engine/entities/AnimalManager';
import {Animal} from '../src/engine/entities/AnimalView';
import {Scope} from '../src/engine/app/scope';
import {ItemCatalogue} from '../src/game/plugin/nativeItems';
import {createShardProduct} from '../src/game/shardfile/shardProduct';
import {emptyShardfile} from '../src/sdk/author';
import {parseItems} from '../src/format/items';
import {legacyDouble} from './fake/FakeGame';
import type {ShardContext} from '../src/game/plugin/context';
import type {ShardRuntime} from '../src/game/shard/runtime';
import type {Targets} from '../src/engine/combat/types';
import type {EquipmentService} from '../src/engine/combat/EquipmentService';
import type {Bow} from '../src/game/weapons/Bow';
import * as native from '../src/game/plugin/headless';
import * as launcher from '../src/game/weapons/heldLauncher';
import rows from '../src/shards/nalati-grasslands/boot/bowVariant.generated.json' with {type:'json'};
import items from '../src/shards/nalati-grasslands/data/items.json' with {type:'json'};

const NativeBow=bowBinding.Bow;
function actor(kind:string):Animal{
  const value:unknown=Object.create(Animal.prototype);if(!(value instanceof Animal))throw new Error('Missing native actor');
  Object.assign(value,{kind,alive:true,position:new THREE.Vector3(),applyDamage:vi.fn(()=>false)});return value;
}
function owner(scope:Scope){
  const animals:unknown=Object.create(AnimalManager.prototype);if(!(animals instanceof AnimalManager))throw new Error('Missing native owner');
  const targets={raycast:()=>null};bindEquipmentActors(targets,animals,scope);return{animals,targets};
}
function bow(targets:Targets):Bow{
  const value:unknown=Object.create(NativeBow.prototype);if(!(value instanceof NativeBow))throw new Error('Missing native bow');
  Object.assign(value,{targets,row:new ItemCatalogue(items).equipment('weapon.bow'),drawSpeedScale:1,carrierVelocity:new THREE.Vector3(),damageMultiplier:()=>2,
    carryMountState:()=>undefined,arrows:{predict:(_o:THREE.Vector3,_v:THREE.Vector3,points:Float32Array)=>{points.set([0,0,-10,0,0,-20]);return 2;}}});return value;
}
function slotRows(power:unknown=rows){return {version:1,id:'bow-kit',slots:[{id:'bow',kind:'bow',item:'weapon.bow',file:'/bow.json'}],
  registration:['bow'],equipment:{primary:'bow',extras:[]},selection:{unlock:[]},mount:[],refills:[],
  upgrades:[{id:'reward',slot:'bow',kind:'bow',replacement:{item:rows.id,name:rows.name},power:{kind:'charged-pierce',rows:power}}]};}
async function kit(scope:Scope,targets:ReturnType<typeof owner>['targets'],input:unknown=slotRows()){
  const source={...emptyShardfile({slug:'orchard',name:'Orchard',author:'Fixture',revision:1,seed:1}),items:parseItems(items)};
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),world=legacyDouble<NonNullable<ShardRuntime['world']>>({game:legacyDouble<NonNullable<ShardRuntime['world']>['game']>({scene,camera})});
  const runtime=legacyDouble<ShardRuntime>({world}),product=createShardProduct({slug:'orchard',revision:1,shardfile:source,sections:new Map(),files:new Map(),read:()=>Promise.reject(new Error('Unexpected file read'))});
  const ctx=legacyDouble<ShardContext>({scope,product,app:legacyDouble<ShardContext['app']>({equipment:null}),game:legacyDouble<ShardContext['game']>({runtime}),rows:legacyDouble<ShardContext['rows']>({weapon:()=>undefined})});
  const held=HeldClaims.fromSlots(input);held.installPage(ctx);
  const builder=runtime.buildEquipment;if(builder===undefined)throw new Error('Missing bow slot factory');
  const result=await builder(targets,false),built=held.pageKit(ctx);if(built===null)throw new Error('Missing built bow slot');
  let current=result.primary;
  const equipment=legacyDouble<EquipmentService>({get:()=>current,replace:(_id,next)=>{current=next;}});
  return {held,built,equipment,scene,camera,runtime};
}
function setup(){
  vi.spyOn(NativeBow.prototype,'setStyle').mockImplementation(()=>undefined);
  function build(...args:ConstructorParameters<typeof NativeBow>):Bow{const weapon=bow(args[1]??{raycast:()=>null});weapon.row=args[2].row;return weapon;}
  vi.spyOn(bowBinding,'Bow').mockImplementation(legacyDouble<typeof NativeBow>(Object.assign(build,{prototype:NativeBow.prototype})));
  vi.spyOn(native,'bindRuntimeEquipment').mockReturnValue(legacyDouble<ReturnType<typeof native.bindRuntimeEquipment>>({}));
  type BowRead=Awaited<ReturnType<typeof launcher.loadHeldBow>>;
  vi.spyOn(launcher,'loadHeldBow').mockResolvedValue({profile:legacyDouble<BowRead['profile']>({}),rows:legacyDouble<BowRead['rows']>({}),model:{}});
}

test('the slot variant keeps composition, upgrade idempotence and delayed secondary contact',async()=>{
  setup();const scope=new Scope('bow-variant'),{animals,targets}=owner(scope),first=actor('wolf'),second=actor('balbal');
  const hurt=vi.spyOn(second,'applyDamage'),hurtFirst=vi.spyOn(first,'applyDamage');
  const ray=vi.spyOn(animals,'raycast').mockReturnValueOnce({animal:first,point:new THREE.Vector3(0,0,-1),distance:1,headshot:false,damage:10}).mockReturnValueOnce({animal:second,point:new THREE.Vector3(0,0,-3),distance:1,headshot:false,damage:20}).mockReturnValue(null);
  try{
    const f=await kit(scope,targets),power=f.built.bowPower('reward');expect(f.built.bowPower('reward')).toBe(power);expect(power.applied).toBe(false);
    f.built.upgradeBow('reward',f.equipment);const weapon=f.built.bow('bow');f.built.upgradeBow('reward',f.equipment);
    expect(power.applied).toBe(true);expect(weapon.drawSpeedScale).toBe(1.2);expect(weapon.row.id).toBe('weapon.golden-bow');
    weapon.onLoose?.(.9);expect(ray).not.toHaveBeenCalled();
    expect(weapon.damageMultiplier?.({animal:second,point:new THREE.Vector3(),distance:1,headshot:false})).toBe(4);
    weapon.onLoose?.(1);expect(ray).toHaveBeenCalledTimes(2);expect(weapon.damageMultiplier?.({animal:second,point:new THREE.Vector3(),distance:1,headshot:false})).toBe(6);
    power.update(.001);expect(hurt).not.toHaveBeenCalled();power.update(1);expect(hurt).toHaveBeenCalledWith(72,new THREE.Vector3(0,0,-3),expect.any(THREE.Vector3));
    expect(hurtFirst).not.toHaveBeenCalled();
  }finally{scope.dispose();vi.restoreAllMocks();}
});

test('independent slot owners and an orchard variant do not share actors or thresholds',async()=>{
  setup();const a=new Scope('orchard-kit'),b=new Scope('other-kit'),one=owner(a),two=owner(b),first=actor('beetle'),second=actor('log');
  const hurt=vi.spyOn(second,'applyDamage');
  const ray=vi.spyOn(one.animals,'raycast').mockReturnValueOnce({animal:first,point:new THREE.Vector3(),distance:1,headshot:false,damage:5}).mockReturnValueOnce({animal:second,point:new THREE.Vector3(),distance:1,headshot:false,damage:5}).mockReturnValue(null);
  try{
    expect(equipmentActorOwner(one.targets).animals).toBe(one.animals);expect(equipmentActorOwner(two.targets).animals).toBe(two.animals);
    const data=slotRows({...rows,id:'weapon.orchard-bow',name:'Harvest bow',style:'recurve',threshold:.5,pierce:2,crush:4,crushKinds:['log'],damageScale:{base:[1,1],kinds:{}}});
    const upgrade=data.upgrades[0];if(upgrade===undefined)throw new Error('Missing reward');upgrade.replacement={item:'weapon.orchard-bow',name:'Harvest bow'};
    const f=await kit(a,one.targets,data),power=f.built.bowPower('reward');f.built.upgradeBow('reward',f.equipment);const weapon=f.built.bow('bow');
    weapon.onLoose?.(.6);expect(ray).toHaveBeenCalledTimes(2);power.update(1);expect(hurt).toHaveBeenCalledWith(40,expect.any(THREE.Vector3),expect.any(THREE.Vector3));
    a.dispose();expect(()=>equipmentActorOwner(one.targets).animals).toThrow('no native actor owner');expect(equipmentActorOwner(two.targets).animals).toBe(two.animals);
    expect(f.scene.children).toHaveLength(0);expect(()=>power.update(1)).toThrow('owner has ended');expect(()=>weapon.onLoose?.(1)).toThrow('owner has ended');
  }finally{a.dispose();b.dispose();vi.restoreAllMocks();}
});

test('power admission refuses foreign identities, executable data and excess prediction before effects',()=>{
  expect(()=>namedJsonSchema(HeldSlotsSchema)).not.toThrow();
  const bad=[{...rows,id:'weapon.other'},{...rows,name:'Other'},{...rows,trail:{...rows.trail,points:49}},{...rows,threshold:Number.NaN},{...rows,choose:()=>1}];
  for(const input of bad)expect(()=>HeldClaims.fromSlots(slotRows(input))).toThrow();
  let reads=0;const input={...rows};Object.defineProperty(input,'threshold',{enumerable:true,get:()=>{reads++;return 1;}});
  expect(()=>parseHeldSlots(slotRows(input))).toThrow('JSON');expect(reads).toBe(0);
});

test('an upgrade cannot mutate equipment before preparation or during ancestor retirement',async()=>{
  setup();const parent=new Scope('bow-parent'),scope=parent.child('bow-entry'),{targets}=owner(scope);
  try{
    const f=await kit(scope,targets),initial=f.built.bow('bow');expect(()=>f.built.upgradeBow('reward',f.equipment)).toThrow('not prepared');expect(f.built.bow('bow')).toBe(initial);
    const power=f.built.bowPower('reward'),disposal=parent.disposeSteps();disposal.next();expect(scope.disposing).toBe(true);
    expect(()=>f.built.upgradeBow('reward',f.equipment)).toThrow('owner has ended');expect(()=>power.update(1)).toThrow('owner has ended');
    for(const _step of disposal){/* Finish the actual ancestor retirement. */}
  }finally{parent.dispose();vi.restoreAllMocks();}
});
