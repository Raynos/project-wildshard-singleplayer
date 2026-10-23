import { expect,test } from 'vitest';
import { parseHeldSlots } from '../src/format/heldArms';
import { Scope } from '../src/engine/app/scope';
import { HeldClaims } from '../src/game/loadout/claims';
import { heldSlotRows } from '../src/shards/nalati-grasslands/generators/heldSlots';
import loadout from '../src/shards/nalati-grasslands/data/loadout.json' with {type:'json'};
import variants from '../src/shards/nalati-grasslands/data/legendaryWeapons.json' with {type:'json'};
import power from '../src/shards/nalati-grasslands/boot/bowVariant.generated.json' with {type:'json'};

const authored={...loadout,variants:{bow:{id:`weapon.${variants.goldenBow.id}`,name:variants.goldenBow.name},blade:{id:`weapon.${variants.naizagai.id}`,name:variants.naizagai.name}}};
test('the entered kit retains its authored native slots and reward identities',()=>{
  const rows=heldSlotRows(authored,power),arsenal=HeldClaims.fromSlots(rows);
  expect(rows.selection.initial).toBe('bow');
  expect(rows.slots.map(row=>[row.id,row.item])).toEqual([['blade',loadout.blade.item],['polearm',loadout.polearm.item],['bow',loadout.bow.item],['firearm',loadout.page.firearm.item]]);
  expect(rows.registration).toEqual(['bow','blade','polearm','firearm']);
  expect(rows.equipment).toEqual({primary:'blade',rifle:'firearm',extras:['bow','polearm'],order:['bow','blade','polearm']});
  expect(rows.upgrades.map(row=>row.replacement)).toEqual([{item:authored.variants.bow.id,name:authored.variants.bow.name},{item:authored.variants.blade.id,name:authored.variants.blade.name}]);
  expect(rows.upgrades[0]?.power?.rows).toEqual(power);
  expect(arsenal.blade('blade').Weapon.prototype).not.toBe(arsenal.polearm('polearm').Weapon.prototype);
});

test('an orchard declares independent tools and cannot inject selection or constructors',()=>{
  const source={blade:{file:'tools/hook.json',item:'weapon.hook'},polearm:{file:'tools/pole.json',item:'weapon.pole'},bow:{file:'/assets/orchard/sling.json',item:'weapon.sling'},initial:'polearm',page:{firearm:{file:'tools/seed-rifle.json',item:'weapon.seed-rifle',muzzleLight:false},order:['spear','bow']},variants:{bow:{id:'weapon.sling-copper',name:'Copper sling'},blade:{id:'weapon.hook-steel',name:'Steel hook'}}};
  const rows=heldSlotRows(source,{...power,id:'weapon.sling-copper',name:'Copper sling'}),first=HeldClaims.fromSlots(rows),second=HeldClaims.fromSlots(rows);
  const scope=new Scope('orchard.kit');expect(first.pageKit({scope})).toBeNull();scope.dispose();
  expect(first.slots.slots.find(row=>row.kind==='firearm')).toEqual({id:'firearm',kind:'firearm',...source.page.firearm});
  expect(first.slots).toEqual(parseHeldSlots(rows));
  expect(first.blade('blade').Weapon).not.toBe(second.blade('blade').Weapon);
  expect(first.polearm('polearm').Weapon).not.toBe(second.polearm('polearm').Weapon);
  expect(()=>HeldClaims.fromSlots({...rows,selection:{...rows.selection,initial:()=>0}})).toThrow();
  expect(()=>HeldClaims.fromSlots({...rows,create:()=>null})).toThrow();
  expect(()=>HeldClaims.fromSlots({...rows,slots:rows.slots.map(row=>row.kind==='firearm'?{...row,file:()=>null}:row)})).toThrow();
  expect(()=>HeldClaims.fromSlots({...rows,equipment:{...rows.equipment,install:()=>null}})).toThrow();
});
