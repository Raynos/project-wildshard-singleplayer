import {expect,it} from 'vitest';
import {HeldDecision} from '../src/game/weapons/heldDecision';
import rows from '../src/shards/nalati-grasslands/data/heldWeapons.generated.json' with {type:'json'};

const polearm={mode:0,held:1,enabled:1,ads:0,previousAds:0,attack:0,tap:0,ammo:3,capacity:3,thrust:-1,wind:-1,throwing:-1,queued:0,release:0,threw:0,hit:0,windup:.12,activeEnd:.22,total:.35,throwWindup:.4,throwRelease:.2,recovery:.3,mounted:0,speed:0,minSpeed:8,lanceReach:2.5,cone:Math.PI/12,rehit:1.2,baseDamage:40,speedDamage:6,pickupRadius:1.5,pickupHeight:2,survive:.8};
const blade={mode:1,cooldown:0,chain:0,links:0,hits:0,chainWindow:2,attack:1,charging:0,mounted:1,sense:6,behind:-1,look:0,baseDamage:30,speed:10,speedDivisor:10,chainMax:2,chainStep:.25,passCooldown:.5};
const power={mode:2,swing:0,mounted:0,speed:0,heavy:0,call:-1,storm:0,callX:0,callZ:0,...rows.powers};
it('queues edges until the next 100 ms snapshot and covers the thrust window',()=>{
 const law=new HeldDecision(rows.programs.polearm);
 expect(law.update(.05,{...polearm,attack:1})).toBeNull();
 const begin=law.update(.05,{...polearm,attack:1});expect(begin?.['start']).toBe(1);expect(begin?.['strike']).toBe(0);
 expect(law.update(.1,{...polearm,thrust:.1})?.['strike']).toBe(1);
 expect(law.update(.1,{...polearm,thrust:.25,hit:1})?.['strike']).toBe(0);
});
it('keeps desktop tap throws, held release and dry ammunition distinct',()=>{
 const law=new HeldDecision(rows.programs.polearm);
 expect(law.update(.1,{...polearm,tap:1,ammo:0})?.['dry']).toBe(1);
 expect(law.update(.1,{...polearm,tap:1})?.['wind']).toBeCloseTo(.1);
 const released=law.update(.1,{...polearm,wind:.35,previousAds:1});expect(released?.['launch']).toBe(1);
 expect(law.update(.1,{...polearm,held:0,wind:.3,thrust:.1})?.['thrust']).toBe(-1);
});
it('limits lance contacts by cone, closing speed and per-target rehit',()=>{
 const law=new HeldDecision(rows.programs.polearm),target={kind:0,id:1,live:1,distance:2,radius:.5,height:0,angle:0,closing:3,since:2};
 expect(law.update(.1,{...polearm,mounted:1,speed:9},[target])?.['damage']).toBe(112);
 expect(law.update(.1,{...polearm,mounted:1,speed:9},[{...target,since:.5}])?.['target']).toBe(0);
 expect(law.update(.1,{...polearm,mounted:1,speed:9},[{...target,angle:1}])?.['target']).toBe(0);
});
it('recovers grounded ammunition only within the declared pickup volume',()=>{
 const law=new HeldDecision(rows.programs.polearm),target={kind:1,id:2,distance:1,height:.5,random:.5};
 const result=law.update(.1,{...polearm,ammo:2},[target]);expect(result?.['pickup']).toBe(2);expect(result?.['recover']).toBe(1);
 expect(law.update(.1,{...polearm,ammo:2},[{...target,height:3}])?.['pickup']).toBe(0);
 expect(law.update(.1,polearm,[target])?.['pickup']).toBe(0);
});
it('selects mounted passes and damage with row-driven chain expiry',()=>{
 const law=new HeldDecision(rows.programs.blade),targets=[{live:1,distance:2,forward:1,side:-1},{live:1,distance:1,forward:-4,side:1}];
 const pass=law.update(.1,{...blade,chain:1,links:2},targets);expect(pass?.['side']).toBe(-1);expect(pass?.['damage']).toBe(90);
 expect(law.update(.1,{...blade,cooldown:.3},targets)?.['side']).toBe(0);
 expect(law.update(.1,{...blade,chain:.05,links:5},targets)?.['damage']).toBe(60);
});
it('lets an unrelated orchard shard drive the native law with different weapon rows',()=>{
 const orchard={...blade,baseDamage:8,speed:4,speedDivisor:20,chainMax:1.2,chainStep:.05,look:1,passCooldown:1.3};
 const law=new HeldDecision(rows.programs.blade),result=law.update(.1,orchard);
 expect(result?.['side']).toBe(-1);expect(result?.['damage']).toBe(10);expect(result?.['cooldown']).toBe(1.3);
 const harvesting={...polearm,capacity:1,ammo:0,pickupRadius:.25,survive:1};
 expect(new HeldDecision(rows.programs.polearm).update(.1,harvesting,[{kind:1,id:1,distance:.2,height:0,random:.9}])?.['recover']).toBe(1);
});
it('selects crescent and storm arc chains from scalar hit candidates',()=>{
 const law=new HeldDecision(rows.programs.power),targets=[{id:1,live:1,along:3,side:0,radius:.5,x:0,y:0,z:-3,scale:1},{id:2,live:1,along:5,side:4,radius:.5,x:4,y:0,z:-5,scale:1},{id:3,live:1,along:8,side:5,radius:.5,x:5,y:0,z:-8,scale:1}];
 const storm=law.update(.1,{...power,swing:1,mounted:1,speed:12,storm:1},targets);
 expect(storm?.['action']).toBe(1);expect(storm?.['target']).toBe(1);expect(storm?.['damage']).toBe(50);expect(storm?.['arc1']).toBe(2);expect(storm?.['arc2']).toBe(3);
 const clear=law.update(.1,power,targets);expect(clear?.['arc2']).toBe(0);
 const eight=Array.from({length:8},(_,i)=>({id:i+1,live:1,along:i+2,side:0,radius:.5,x:0,y:0,z:-i-2,scale:1}));
 expect(law.update(.1,{...power,swing:1,mounted:1,speed:12,storm:1},eight)?.['arc2']).toBe(3);
});
it('delays the bolt and applies the whole bounded area snapshot',()=>{
 const law=new HeldDecision(rows.programs.power),targets=Array.from({length:8},(_,i)=>({id:i+1,live:1,along:0,side:0,radius:.5,x:i===7?1:100,y:0,z:0,scale:1}));
 expect(law.update(.1,{...power,swing:1,heavy:1},targets)?.['action']).toBe(2);
 expect(law.update(.1,{...power,call:.3},targets)?.['detonate']).toBe(0);
 const result=law.update(.1,{...power,call:.55,storm:1},targets);expect(result?.['detonate']).toBe(1);expect(result?.['callDamage']).toBe(75);expect(result?.['aoe0']).toBe(1<<7);
});

it('binds unrelated native polearm, blade and power rows without shard callbacks',async()=>{
 const [{PolearmSet},{BladeSet},{staticGlb},{emptyShardfile},{parseItems},{GLTFLoader},three,{Player},{AnimalManager}]=await Promise.all([
  import('../src/game/weapons/heldPolearm'),import('../src/game/weapons/mountedBlade'),import('../src/sdk/bake/glb'),import('../src/sdk/author'),import('../src/format/items'),import('three/examples/jsm/loaders/GLTFLoader.js'),import('three'),import('../src/engine/player/Player'),import('../src/engine/entities/AnimalManager')]);
 const [{default:spear},{default:sabre},{default:items}]=await Promise.all([import('../src/shards/nalati-grasslands/data/spear.generated.json'),import('../src/shards/nalati-grasslands/data/sabre.generated.json'),import('../src/shards/nalati-grasslands/data/items.json')]);
 const {vi}=await import('vitest'),material=new three.MeshBasicMaterial(),geometry=new three.BoxGeometry(.1,1,.1);
 const pool={url:'/fixtures/orchard-tools.glb',parts:['handle','tip','grip','sleeve','world']};
 const bytes=staticGlb(pool.parts.map(name=>({name,geometry,material,extras:{restGroups:geometry.groups.map(group=>[group.start,group.count,group.materialIndex??0]),restBox:null,restSphere:null}}))),gltf=await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,'');
 const load=vi.spyOn(GLTFLoader.prototype,'loadAsync').mockResolvedValue(gltf);
 try{
  const identity={slug:'orchard-fixture',name:'Orchard',author:'Fixture',revision:1,seed:31};
  const orchardItems=parseItems(JSON.parse(JSON.stringify(items).replaceAll('weapon.spear','weapon.fruit-hook').replaceAll('weapon.sabre','weapon.pruner').replaceAll('nalati-grasslands','orchard-fixture')));
  const powerRows={program:rows.programs.power,powers:{...rows.powers,crescentDamage:9},item:'weapon.pruner',name:'Pruner',blue:[.5,1,.4],glow:[0,.1,0]};
  const polearmRows={...spear,pool,profile:{...spear.profile,damage:7,reach:1.8},program:rows.programs.polearm,presentation:{...rows.polearm,parts:{leftArm:'sleeve',rightArm:'sleeve',body:'handle',metal:'tip',fist:'grip',projectile:'handle',projectileMetal:'tip',world:'world'}}};
  const bladeRows={...sabre,pool,program:rows.programs.blade,power:powerRows,parts:{body:'handle',arms:'sleeve',metal:'tip'}};
  const files=new Map<string,unknown>([['tools/fruit-hook.json',polearmRows],['tools/pruner.json',bladeRows]]);
  const product={shardfile:{...emptyShardfile(identity),items:orchardItems},file:(name:string)=>Promise.resolve(new TextEncoder().encode(JSON.stringify(files.get(name))))};
  const polearmSet=new PolearmSet({file:'tools/fruit-hook.json',item:'weapon.fruit-hook'}),bladeSet=new BladeSet({file:'tools/pruner.json',item:'weapon.pruner'});
  await polearmSet.prepare(product);await bladeSet.prepare(product);
  expect(polearmSet.profile().damage).toBe(7);expect(polearmSet.geometry('handle').getAttribute('position').count).toBe(geometry.getAttribute('position').count);
  const rig=bladeSet.build(material,material);expect(rig.sword.getAttribute('position').count).toBe(geometry.getAttribute('position').count);expect(bladeSet.profile().id).toBe('weapon.pruner');
  const player:unknown=Object.create(Player.prototype),animals:unknown=Object.create(AnimalManager.prototype);
  if(!(player instanceof Player)||!(animals instanceof AnimalManager))throw new Error('Missing fixture native owners');
  const reward=new bladeSet.Power({scene:new three.Scene(),player,camera:new three.PerspectiveCamera(),animals,weather:{stormActive:false,flash:0}});
  expect(reward.applied).toBe(false);
 }finally{load.mockRestore();material.dispose();geometry.dispose();}
});

it('shares one module across all weapon signals and isolates their channels',async()=>{
 const {Scope}=await import('../src/engine/app/scope');const scope=new Scope('combined-weapon-fixture');
 const spear=new HeldDecision(rows.programs.polearm,scope),sabre=new HeldDecision(rows.programs.blade,scope),powerLaw=new HeldDecision(rows.programs.power,scope);
 expect(spear.program).toBe(sabre.program);expect(powerLaw.program).toBe(sabre.program);
 expect(new Set(Object.values(rows.programs).map(program=>program.script.module)).size).toBe(1);
 expect(spear.update(.1,{...polearm,attack:1})?.['start']).toBe(1);
 expect(sabre.update(.1,{...blade,mounted:1,attack:1})?.['side']).toBe(1);
 expect(sabre.update(.1,blade)?.['start']).toBeUndefined();scope.dispose();
});

it('shares reordered wire aliases while refusing a changed declaration',async()=>{
 const {Scope}=await import('../src/engine/app/scope'),scope=new Scope('wire-alias-fixture');
 const first=new HeldDecision(rows.programs.polearm,scope),source=rows.programs.blade;
 const reverse=(input:Record<string,string>)=>Object.fromEntries(Object.entries(input).reverse());
 const reordered={...source,script:{...source.script,fields:reverse(source.script.fields),channels:reverse(source.script.channels),signals:reverse(source.script.signals)}};
 expect(new HeldDecision(reordered,scope).program).toBe(first.program);
 expect(()=>new HeldDecision({...reordered,script:{...reordered.script,fields:{...reordered.script.fields,mode:'changed'}}},scope)).toThrow('Shared return declaration changed');
 scope.dispose();
});
