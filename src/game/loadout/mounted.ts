import { parse } from 'valibot';
import { MountedLoadoutSchema, type MountedLoadoutRows } from '@wildshard/format/loadout';
import { macrotask } from '@wildshard/engine/boot/plan';
import { BladeSet } from '../weapons/mountedBlade';
import { PolearmSet, type HeldPolearmWorld } from '../weapons/heldPolearm';
import { Bow } from '../weapons/Bow';
import { loadHeldBow } from '../plugin/heldLauncher';
import { readItemEquipment } from '../plugin/nativeItems';
import type { ArcWeaponPower } from '../weapons/arcPower';
import type { WeaponId } from '@wildshard/engine/combat/Equipment';
import type { EquipmentService } from '@wildshard/engine/combat/EquipmentService';
import type { Targets } from '@wildshard/engine/combat/types';
import type { Weapon } from '@wildshard/engine/combat/Weapon';

type Blade = InstanceType<BladeSet['Weapon']>;
type Polearm = InstanceType<PolearmSet['Weapon']>;
export interface MountedLoadout {
  base:Blade;bow:Bow;sabre:Blade;spear:Polearm;extras:Weapon[];
  install:(weapons:EquipmentService)=>void;
  replaceBow:(weapons:EquipmentService)=>Bow|null;
  upgradeSabre:(weapons:EquipmentService,power:ArcWeaponPower)=>void;
  refill:()=>void;
  setMount:(state:Blade['mount'])=>void;
  melee:(id:WeaponId)=>boolean;
}

/** Client-only kit assembly over the native families. No content constructor,
 * selection hook or replacement callback crosses the declaration boundary. */
export class MountedArsenal {
  readonly blade:BladeSet;
  readonly polearm:PolearmSet;
  readonly rows:MountedLoadoutRows;
  constructor(input:unknown){
    this.rows=parse(MountedLoadoutSchema,input);
    this.blade=new BladeSet(this.rows.blade);this.polearm=new PolearmSet(this.rows.polearm);
  }
  async build(world:HeldPolearmWorld,targets:Targets,allowUnlocked:boolean,items:unknown):Promise<MountedLoadout>{
    const sabre=new this.blade.Weapon(world,targets,{allowUnlocked});await macrotask();
    const spear=new this.polearm.Weapon(world,targets,{allowUnlocked});await macrotask();
    const {profile}=await loadHeldBow(this.rows.bow.file);
    const bow=new Bow(world,targets,{row:readItemEquipment(items,this.rows.bow.item),profile,allowUnlocked});
    const kit:MountedLoadout={
      base:sabre,bow,sabre,spear,extras:[bow,spear],
      install:weapons=>{for(const weapon of kit.extras)weapons.unlock(weapon.id);weapons.select(({blade:kit.sabre,polearm:kit.spear,bow:kit.bow})[this.rows.initial].id,true);},
      replaceBow:weapons=>{
        const variant=this.rows.variants.bow,previous=kit.bow;if(previous.row.id===variant.id)return null;
        const next=new Bow(world,targets,{row:{...previous.row,id:variant.id,ui:{...previous.row.ui,name:variant.name,swapName:variant.name},meta:{...previous.meta,name:variant.name}},profile,allowUnlocked});
        next.damageMultiplier=previous.damageMultiplier;next.onLoose=previous.onLoose;next.carryMountState(previous);
        weapons.replace(previous.id,next);kit.bow=next;return next;
      },
      upgradeSabre:(weapons,power)=>{
        const variant=this.rows.variants.blade;if(kit.sabre.row.id===variant.id)return;
        const base=this.blade.profile(),next=new this.blade.Weapon(world,targets,{allowUnlocked,power,profile:{...base,id:variant.id,parent:base.id,ui:{...base.ui,name:variant.name},meta:{...base.meta,name:variant.name}}});
        next.carryPassState(kit.sabre);weapons.replace(kit.sabre.id,next);kit.sabre=next;kit.base=next;
      },
      refill:()=>{spear.javelins=spear.maxJavelins;kit.bow.addBolts(kit.bow.magazine);},
      setMount:state=>{kit.sabre.mount=state;spear.mount=state;kit.bow.setMount(state);},
      melee:id=>[kit.sabre,spear,kit.bow].some(weapon=>weapon.id===id&&weapon.row.ui.melee),
    };
    return kit;
  }
}
