import { expect,test } from 'vitest';
import { parse } from 'valibot';
import { MountedLoadoutSchema } from '../src/format/loadout';
import { Scope } from '../src/engine/app/scope';
import { MountedArsenal } from '../src/game/loadout/mounted';
import nalati from '../src/shards/nalati-grasslands/boot/mountedLoadout.generated.json' with {type:'json'};
import gear from '../src/shards/nalati-grasslands/data/gear.generated.json' with {type:'json'};

test('the entered kit retains its authored native slots and reward identities',()=>{
  const arsenal=new MountedArsenal(nalati);
  expect(arsenal.rows.initial).toBe('bow');
  expect(arsenal.rows.variants).toEqual({bow:{id:`weapon.${gear.variants.goldenBow.id}`,name:gear.variants.goldenBow.name},blade:{id:`weapon.${gear.variants.naizagai.id}`,name:gear.variants.naizagai.name}});
  expect(arsenal.blade.Weapon.prototype).not.toBe(arsenal.polearm.Weapon.prototype);
});

test('an orchard declares independent tools and cannot inject selection or constructors',()=>{
  const rows={blade:{file:'tools/hook.json',item:'weapon.hook'},polearm:{file:'tools/pole.json',item:'weapon.pole'},bow:{file:'/assets/orchard/sling.json',item:'weapon.sling'},initial:'polearm',page:{firearm:{file:'tools/seed-rifle.json',item:'weapon.seed-rifle',muzzleLight:false},order:['spear','bow']},variants:{bow:{id:'weapon.sling-copper',name:'Copper sling'},blade:{id:'weapon.hook-steel',name:'Steel hook'}}};
  const first=new MountedArsenal(rows),second=new MountedArsenal(rows);
  const scope=new Scope('orchard.kit');expect(first.pageKit({scope})).toBeNull();scope.dispose();
  expect(first.rows.page?.firearm).toEqual(rows.page.firearm);
  expect(first.rows).toEqual(parse(MountedLoadoutSchema,rows));
  expect(first.blade.Weapon).not.toBe(second.blade.Weapon);
  expect(first.polearm.Weapon).not.toBe(second.polearm.Weapon);
  expect(()=>new MountedArsenal({...rows,initial:()=>0})).toThrow();
  expect(()=>new MountedArsenal({...rows,create:()=>null})).toThrow();
  expect(()=>new MountedArsenal({...rows,page:{...rows.page,firearm:{...rows.page.firearm,file:()=>null}}})).toThrow();
  expect(()=>new MountedArsenal({...rows,page:{...rows.page,install:()=>null}})).toThrow();
});
