import {BladeRowsSchema,type BladeRows} from '@wildshard/format/heldMelee';
import { ArcWeaponPower,type ArcWeaponDeps } from './arcPower';
import * as THREE from 'three';
import * as schema from 'valibot';
import { MeleeWeaponProfileSchema } from '@wildshard/format/weaponProfiles';
import { createModelLibrary } from '@wildshard/game/plugin/geometry';
import { ItemCatalogue } from '@wildshard/game/plugin/nativeItems';
import { SWORD_WOOD } from '@wildshard/game/weapons/starterMeleeProfile';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import { viewmodelRowMaterial } from '@wildshard/engine/combat/view/ranged';
import { app } from '@wildshard/engine/app/runtime';
import type { MeleeProfile } from '@wildshard/engine/combat/meleeProfile';
import type { Targets } from '@wildshard/engine/combat/types';
import type { Key, Move, SwordRig, SwordWorld } from '@wildshard/engine/combat/view/melee';
import { Sword } from '@wildshard/game/weapons/Sword';
import { HeldDecision } from './heldDecision';

export interface MountedSwordMount { speed: number; yaw: number }

export interface MountedSwordProfile extends MeleeProfile {
  readonly mounted: {
    
    readonly reach: number; readonly cooldown: number; readonly sense: number;
    readonly chainWindow: number; readonly chainStep: number; readonly chainMax: number;
    
    readonly speedDivisor: number;
    
    readonly behind: number;
  };
}

export interface MountedSwordPasses { readonly left: Move; readonly right: Move }

export interface MountedSwordOptions<P extends MountedSwordProfile> {
  readonly profile: P;
  readonly rig: SwordRig;
  readonly program:unknown;
  readonly passes: MountedSwordPasses;
  readonly allowUnlocked?: boolean;
  readonly power?: ArcWeaponPower;
}

export class MountedSword<P extends MountedSwordProfile = MountedSwordProfile> extends Sword {
  
  mount: MountedSwordMount | null = null;
  
  passChain = 0;
  
  private chainT = 0;
  private mountCd = 0;
  private readonly swordProfile: P;
  private readonly law:HeldDecision;
  private pendingAttack=false;private pendingHits=0;private elapsed=0;
  private readonly passes: MountedSwordPasses;
  private readonly power: ArcWeaponPower | null;

  constructor(world: SwordWorld, targets: Targets | undefined, opts: MountedSwordOptions<P>) {
    super(world, targets, { row: opts.profile, profile: opts.profile, allowUnlocked: opts.allowUnlocked ?? false, rig: opts.rig });
    this.swordProfile = opts.profile;this.law=new HeldDecision(opts.program,world.game.levelScope);
    this.passes = opts.passes;
    this.power = opts.power ?? null;
    this.power?.apply(this);
  }
  protected override onSwingStart(move: Move): void {
    if (this.power !== null) this.power.onSwingStart(move);
    else super.onSwingStart(move);
  }
  protected override onMoveHit(move: Move): void {
    if (move !== this.passes.left && move !== this.passes.right) return;
    this.pendingHits++;

  }
  
  carryPassState(previous: MountedSword<P>): void {
    this.mount = previous.mount; this.passChain = previous.passChain;
    this.chainT = previous.chainT; this.mountCd = previous.mountCd; this.heavyMult = previous.heavyMult;
  }

  get mounted(): boolean { return this.mount !== null; }
  
  get passChainLeft(): number { return this.chainT; }

  override tryFire():void{if(this.mount===null){super.tryFire();return;}this.pendingAttack=true;}
  private decide(dt:number):void{
   this.elapsed+=dt;if(this.elapsed<.1-1e-9)return;
   const m=this.mount,p=this.player.position,yaw=m?.yaw??this.player.yaw,fx=-Math.sin(yaw),fz=-Math.cos(yaw),rx=Math.cos(yaw),rz=-Math.sin(yaw),rows=this.swordProfile.mounted;
   const candidates:Record<string,number>[]=[];
   for(const target of [...app.aimTargets].filter(body=>body.alive&&body.hidden!==true).sort((a,b)=>a.position.distanceToSquared(p)-b.position.distanceToSquared(p))){if(candidates.length>=8)break;const dx=target.position.x-p.x,dz=target.position.z-p.z;
    candidates.push({live:Number(target.alive&&target.hidden!==true),distance:Math.hypot(dx,dz),forward:dx*fx+dz*fz,side:dx*rx+dz*rz>=0?1:-1});}
   const v=this.law.update(this.elapsed,{mode:1,cooldown:this.mountCd,chain:this.chainT,links:this.passChain,hits:this.pendingHits,chainWindow:rows.chainWindow,attack:Number(this.pendingAttack),charging:Number(this.chargingHeavy),mounted:Number(m!==null),sense:rows.sense,behind:rows.behind,look:Math.atan2(Math.sin(this.player.yaw-yaw),Math.cos(this.player.yaw-yaw)),baseDamage:this.swordProfile.damage,speed:m?.speed??0,speedDivisor:rows.speedDivisor,chainMax:rows.chainMax,chainStep:rows.chainStep,passCooldown:rows.cooldown},candidates);
   this.elapsed=0;if(v===null)return;this.pendingAttack=false;this.pendingHits=0;
   this.mountCd=v['cooldown']??0;this.chainT=v['chain']??0;this.passChain=v['links']??0;
   if(v['side']!==0&&v['side']!==undefined){this.damage=v['damage']??this.swordProfile.damage;this.strikeMove(v['side']<0?this.passes.left:this.passes.right,false);}
  }

  override update(dt: number, t: number): void {
    this.decide(dt);
    if (!this.swinging) this.damage = this.swordProfile.damage; // a pass slash sets its own number for its one swing
    super.update(dt, t);
  }
}

export interface MountedSwordRowOptions<P extends MountedSwordProfile>{allowUnlocked?:boolean;profile?:P;power?:ArcWeaponPower}
export interface MountedSwordType<P extends MountedSwordProfile>{new(world:SwordWorld,targets?:Targets,opts?:MountedSwordRowOptions<P>):MountedSword<P>;readonly prototype:MountedSword<P>}
function sabreKey(row: BladeRows['moves']['rest']): Key { return { t: row.t, pos: new THREE.Vector3(...row.pos), q: new THREE.Quaternion(...row.q) }; }
function sabreMove(row: BladeRows['moves']['heavy']): Move {
  return { ...row, keys: [sabreKey(row.keys[0]), sabreKey(row.keys[1]), sabreKey(row.keys[2])], trail: { ...row.trail, color: new THREE.Color(...row.trail.color) } };
}
type SabreProfile = MountedSwordProfile & { blade: { length: number; curve: number } };

/** Client-only native sword presentation and contact binding. Mounted pass
 * decisions come exclusively from the declared <=10 Hz guest program. */
export class BladeSet {
 private data:{rows:BladeRows;parts:ReturnType<typeof createModelLibrary<never,never>>;profile:SabreProfile;passes:MountedSwordPasses}|null=null;
 constructor(private readonly declaration:{file:string;item:`weapon.${string}`}){}
 private need():NonNullable<BladeSet['data']>{if(this.data===null)throw new Error('Blade rows not prepared');return this.data;}
 readonly Power:new(deps:ArcWeaponDeps)=>ArcWeaponPower=((owner:BladeSet)=>class extends ArcWeaponPower{constructor(deps:ArcWeaponDeps){super(deps,owner.need().rows.power);}})(this);
 readonly Weapon:MountedSwordType<SabreProfile>=((owner:BladeSet)=>class extends MountedSword<SabreProfile>{
  constructor(world:SwordWorld,targets?:Targets,opts:MountedSwordRowOptions<SabreProfile>={}){
   const data=owner.need(),material=painterlyMaterial(world.sky,{vertexColors:true,rim:.55,bands:.7,transparent:true,depthWrite:true});material.name='held-viewmodel';
   super(world,targets,{profile:opts.profile??data.profile,rig:owner.build(material,viewmodelRowMaterial(world.sky,'held-steel',{metalness:.55,roughness:.38,envMapIntensity:.7,transparent:true,depthWrite:true})),passes:data.passes,allowUnlocked:opts.allowUnlocked??false,...(opts.power===undefined?{}:{power:opts.power}),program:data.rows.program});
  }
 })(this);
 async prepare(product:Pick<ShardProduct,'file'|'shardfile'>):Promise<void>{
  const rows=schema.parse(BladeRowsSchema,JSON.parse(new TextDecoder().decode(await product.file(this.declaration.file))));
  const item=product.shardfile.items.rows.find(row=>row.id===this.declaration.item),policy=schema.parse(MeleeWeaponProfileSchema,item?.kind==='weapon'?item.profile:undefined);
  if(policy.mounted===undefined)throw new Error('Blade requires mounted passes');
  const parts=createModelLibrary<never,never>({meshes:[],hd:[],meshUrls:{},hdUrls:{},hdLooks:{},aoFloor:1,geometryPools:[rows.pool]},'held-blade');await parts.preload();
  this.data={rows,parts,passes:{left:sabreMove(rows.moves.passes.left),right:sabreMove(rows.moves.passes.right)},profile:{...SWORD_WOOD,...new ItemCatalogue(product.shardfile.items).equipment(this.declaration.item),parent:SWORD_WOOD.id,damage:policy.damage,swingScale:policy.swingScale,reach:policy.reach,cooldown:policy.cooldown,comboGap:policy.comboGap,chainLag:policy.chainLag,heavyCharge:policy.heavyCharge,lunge:policy.lunge,sweep:policy.sweep,hitStop:{body:.045,head:.045,kill:.045},portraitPullX:.85,mounted:policy.mounted,blade:rows.blade,moves:{rest:sabreKey(rows.moves.rest),charge:sabreKey(rows.moves.charge),sprint:sabreKey(rows.moves.sprint),combo:rows.moves.combo.map(sabreMove),heavy:sabreMove(rows.moves.heavy)}}};
 }
 build(material:THREE.Material,steel:THREE.Material):SwordRig{
  const {rows,parts}=this.need(),geometry=(name:string):THREE.BufferGeometry=>{const part=parts.geometry(name);if(part===null)throw new Error(`Missing blade part ${name}`);return part;};
  return {...rows.rig,material,sword:geometry(rows.parts.body),arms:geometry(rows.parts.arms),extras:[{geometry:geometry(rows.parts.metal),material:steel}]};
 }
 profile():SabreProfile{return this.need().profile;}
 power():unknown{return this.need().rows.power;}
}
