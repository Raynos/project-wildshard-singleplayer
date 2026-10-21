import { parse } from 'valibot';
import * as v from 'valibot';
import type { ShardContext } from '../plugin/context';
import type { Scope } from '@wildshard/engine/app/scope';
import { HeldFirearm } from '../plugin/heldFirearm';
import { FirearmWeaponProfileSchema,parseHeldFirearmRows,parseHeldFirearmView } from '@wildshard/format/weaponProfiles';
import { bindRuntimeEquipment } from '../plugin/headless';
import type { VariantBowPower } from '../weapons/bowVariant';
import { MountedLoadoutSchema, type MountedLoadoutRows } from '@wildshard/format/loadout';
import { macrotask } from '@wildshard/engine/boot/plan';
import { BladeSet } from '../weapons/mountedBlade';
import { PolearmSet, type HeldPolearmWorld } from '../weapons/heldPolearm';
import { Bow } from '../weapons/Bow';
import { loadHeldBow } from '../weapons/heldLauncher';
import { ItemCatalogue } from '../plugin/nativeItems';
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
  upgradeBow:(weapons:EquipmentService,power:VariantBowPower)=>void;
  upgradeSabre:(weapons:EquipmentService,power:ArcWeaponPower)=>void;
  refill:()=>void;
  setMount:(state:Blade['mount'])=>void;
  melee:(id:WeaponId)=>boolean;
}

const enteredKits = new WeakMap<Scope, MountedLoadout>();
/** Borrow the native kit built by the entered equipment stage. */
export function mountedPageLoadout(ctx: Pick<ShardContext, 'scope'>): MountedLoadout {
  const kit = enteredKits.get(ctx.scope);
  if (ctx.scope.disposed || kit === undefined) throw new Error('Mounted loadout is not built');
  return kit;
}

/** Client-only kit assembly over the native families. No content constructor,
 * selection hook or replacement callback crosses the declaration boundary. */
export class MountedArsenal {
  readonly blade:BladeSet;
  readonly polearm:PolearmSet;
  readonly rows:MountedLoadoutRows;
  private readonly pageKits=new WeakMap<Scope,MountedLoadout>();
  constructor(input:unknown){
    this.rows=parse(MountedLoadoutSchema,input);
    this.blade=new BladeSet(this.rows.blade);this.polearm=new PolearmSet(this.rows.polearm);
  }
  /** Install the staged equipment builder from admitted native family rows.
   * Context is the game's concrete page authority; no content callback enters. */
  installPage(ctx:ShardContext):void{
    const runtime=ctx.game.runtime,page=this.rows.page;
    if(ctx.scope.disposed||runtime===undefined||page===undefined)throw new Error('Mounted page needs its live native equipment declaration');
    const world=runtime.world;if(world===null)throw new Error('Mounted page needs its actual world');
    const catalogue=new ItemCatalogue(ctx.product.shardfile.items);
    ctx.rows.weapon([this.rows.bow.item,this.rows.blade.item,this.rows.polearm.item,page.firearm.item].map(id=>catalogue.equipment(id)));
    ctx.scope.onDispose(()=>{this.pageKits.delete(ctx.scope);});
    runtime.buildEquipment=async(targets,allowUnlocked)=>{
      const kit=await this.build(world,targets,allowUnlocked,ctx.product.shardfile.items);await macrotask();
      const data=v.parse(v.object({feel:v.looseObject({ads:v.looseObject({blend:v.number()})}),view:v.unknown(),rows:v.unknown()}),await ctx.product.json<unknown>(page.firearm.file));
      const item=ctx.product.shardfile.items.rows.find(row=>row.id===page.firearm.item);
      const profile={...parse(FirearmWeaponProfileSchema,item?.kind==='weapon'?item.profile:undefined),...data.feel};
      const rifle=new HeldFirearm(world,targets,{row:catalogue.equipment(page.firearm.item),allowUnlocked,muzzleLight:page.firearm.muzzleLight,
        profile,view:parseHeldFirearmView(data.view),rows:parseHeldFirearmRows(data.rows),model:{}});
      if(ctx.scope.disposed)throw new Error('Mounted page left during equipment assembly');
      bindRuntimeEquipment(ctx,ctx.product.shardfile,[kit.bow,kit.sabre,kit.spear,rifle].map(weapon=>{
        const source=ctx.product.shardfile.items.rows.find(row=>row.id===weapon.row.id);return {id:weapon.row.id,weapon,profile:source?.kind==='weapon'?source.profile:undefined};
      }));
      this.pageKits.set(ctx.scope,kit); enteredKits.set(ctx.scope,kit);
      ctx.scope.onDispose(() => { if (enteredKits.get(ctx.scope) === kit) enteredKits.delete(ctx.scope); });
      return {primary:kit.base,rifle,secondary:null,extras:kit.extras,order:page.order,install:kit.install};
    };
  }
  /** Borrow the exact native kit assembled between kit and play. */
  pageKit(ctx:Pick<ShardContext,'scope'>):MountedLoadout|null{return this.pageKits.get(ctx.scope)??null;}
  async build(world:HeldPolearmWorld,targets:Targets,allowUnlocked:boolean,items:unknown):Promise<MountedLoadout>{
    const sabre=new this.blade.Weapon(world,targets,{allowUnlocked});await macrotask();
    const spear=new this.polearm.Weapon(world,targets,{allowUnlocked});await macrotask();
    const {profile}=await loadHeldBow(this.rows.bow.file);
    const bow=new Bow(world,targets,{row:new ItemCatalogue(items).equipment(this.rows.bow.item),profile,allowUnlocked});
    const kit:MountedLoadout={
      base:sabre,bow,sabre,spear,extras:[bow,spear],
      install:weapons=>{for(const weapon of kit.extras)weapons.unlock(weapon.id);weapons.select(({blade:kit.sabre,polearm:kit.spear,bow:kit.bow})[this.rows.initial].id,true);},
      replaceBow:weapons=>{
        const variant=this.rows.variants.bow,previous=kit.bow;if(previous.row.id===variant.id)return null;
        const next=new Bow(world,targets,{row:{...previous.row,id:variant.id,ui:{...previous.row.ui,name:variant.name,swapName:variant.name},meta:{...previous.meta,name:variant.name}},profile,allowUnlocked});
        next.damageMultiplier=previous.damageMultiplier;next.onLoose=previous.onLoose;next.carryMountState(previous);
        weapons.replace(previous.id,next);kit.bow=next;return next;
      },
      upgradeBow:(weapons,power)=>{const next=kit.replaceBow(weapons);if(next!==null)power.apply(next);},
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
