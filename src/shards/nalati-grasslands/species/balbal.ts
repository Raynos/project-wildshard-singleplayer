import * as THREE from 'three';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { SpeciesDef,RigAnimCtx,ThinkCtx } from '@wildshard/engine/entities/species/registry';
import { smooth01,step } from '@wildshard/engine/entities/species/rigs';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import * as v from 'valibot';
import { app } from '@wildshard/engine/app/runtime';
import { ANIMAL_STATES } from '@wildshard/engine/entities/AnimalSim';
import type { DamageRequest } from '@wildshard/engine/combat/pipeline';
import { StrikeRunner } from '@wildshard/engine/ai/strikes';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import type { CreatureGuestRows } from '@wildshard/format/speciesBookRows';
import { ReturnProgram } from '@wildshard/game/population/returnProgram';
import speciesRows from '../boot/speciesRows.generated.json' with { type:'json' };
import { poseNalatiCreature,balbalCrackGeometry,speciesGuestRows } from './presentation';

export const BALBAL = speciesRows.balbal.kind;
export const BALBAL_SLAM = speciesRows.slam;
const cracks = new WeakMap<Animal, THREE.MeshBasicMaterial>();
let admitted:CreatureGuestRows|null=null;
let strike:ReturnType<typeof strikeFromData>|null=null;
const contacts=new StrikeRunner();
function guestRows():CreatureGuestRows{
  if(admitted!==null)return admitted;
  const row=speciesGuestRows();
  if(row.states.some(state=>!ANIMAL_STATES.some(value=>value===state)))throw new Error('Unknown creature state');
  admitted=row;return row;
}
function program():ReturnProgram{return ReturnProgram.page(guestRows().program,app.levelScope??undefined);}
function nativeStrike():ReturnType<typeof strikeFromData>{strike??=strikeFromData(guestRows().strike);return strike;}
  /** A geometric observation shared by damage and local hit presentation. */
function weakPoint(actor:Animal,point:THREE.Vector3):boolean{
    const yaw=-actor.yaw;
    return program().project('weakPoint',{x:actor.position.x,ay:actor.position.y,z:actor.position.z,
      cos:Math.cos(yaw),sin:Math.sin(yaw),scale:actor.scale,yOffset:actor.yOffset,hitX:point.x,hitY:point.y,hitZ:point.z})['weakPoint']===1;
  }
function think(actor:Animal,context:ThinkCtx):void{
    const row=guestRows(),memory=actor.mem,previous=memory[row.clock],dt=previous===undefined?context.dt:context.t-previous;
    if(previous!==undefined&&dt<.1-1e-9)return;
    const observed:Record<string,number>={};
    for(const [key,field]of Object.entries(row.memory))observed[key]=memory[key]??(field.when!==undefined&&memory[field.when.field]===field.when.equal?field.when.value:field.source===undefined?field.value:field.source==='yaw'?actor.yaw:actor.position[field.source]);
    const bearing=Math.atan2(context.player.x-actor.position.x,context.player.z-actor.position.z),wrap=(angle:number)=>Math.atan2(Math.sin(angle),Math.cos(angle));
    const answer=program().project('think',{...observed,bearing,homeBearing:Math.atan2((observed['homeX']??actor.position.x)-actor.position.x,(observed['homeZ']??actor.position.z)-actor.position.z),
      homeOff:wrap((observed['homeYaw']??actor.yaw)-actor.yaw),hitOff:wrap(bearing-actor.yaw),dt,px:context.player.x,py:context.player.y,pz:context.player.z,
      x:actor.position.x,ay:actor.position.y,z:actor.position.z,yaw:actor.yaw,state:row.states.indexOf(actor.state),calm:Number(context.calm),attack:actor.attackPhase,
      bounds:Number(['minX','maxX','minZ','maxZ'].every(key=>memory[key]!==undefined)),scale:actor.scale});
    const out=(key:string):number=>{const value=answer[key];if(value===undefined)throw new Error('Missing creature decision output');return value;};
    for(const key of row.writes)memory[key]=out(key);
    memory['init']=1;memory[row.clock]=context.t;memory[row.playerKeys[0]]=context.player.x;memory[row.playerKeys[1]]=context.player.z;
    actor.position.x=out('x');actor.position.z=out('z');actor.lookTarget.copy(context.player);actor.lookWeight=out('look');
    const state=ANIMAL_STATES.find(value=>value===row.states[out('state')]);if(state!==undefined)actor.state=state;
    if(out('start')===1)actor.startAttack(row.attack);
    if(out('motion')===1){if(out('path')===1)context.steer(actor,out('yaw'),out('speed'),out('turn'));else actor.setMotion(out('yaw'),out('speed'),out('turn'));}
    if(out('cancel')===1)actor.cancelAttack();
    if(out('strike')===1){
      const shape=nativeStrike().shape;if(shape.kind!=='wedge')throw new Error('Guest contact needs an admitted wedge');
      contacts.contact({...nativeStrike(),shape:{...shape,length:row.length[0]*actor.scale/row.length[1]+row.length[2]}},{actor,target:context.player,canReach:()=>context.reach(actor),hit:()=>{context.hurt(out('damage'));}});context.sound(row.strikeSound);
    }
    const sound=row.sounds[out('sound')];if(sound!==undefined&&sound!=='')context.sound(sound);
  }
function damage(actor:Animal,point:THREE.Vector3,_direction:THREE.Vector3,request:DamageRequest|undefined):number{
    const row=guestRows(),equipment=app.equipment,id=equipment!==null&&equipment.visible&&!equipment.stowed?equipment.current.row.id:'';
    const piercing=request===undefined||request.sourceTags.some(tag=>tag===row.piercing.legacy)?row.piercing.equipment.includes(id):request.sourceTags.some(tag=>row.piercing.tags.includes(tag));
    return v.parse(v.pipe(v.number(),v.finite()),program().project('damage',{field:actor.mem['field']??0,rise:actor.mem['rise']??1,open:actor.mem['open']??0,
      range:Math.hypot(point.x-(actor.mem[row.playerKeys[0]]??0),point.z-(actor.mem[row.playerKeys[1]]??0)),piercing:Number(piercing),crack:Number(weakPoint(actor,point))})['damage']);
  }
const nativeGuest={weakPoint,program,binding:{think,damageMul:damage}};
/** Borrow the actual balbal's numeric guest observations and contact binding. */
export function creatureGuest():typeof nativeGuest{guestRows();nativeStrike();return nativeGuest;}
function animateBalbal(c: RigAnimCtx): void {
  const m = c.mem, a = c.animal;
  let material = cracks.get(a);
  if (material === undefined) {
    material = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .46, .1), toneMapped: false }); material.name = 'balbal-cracks';
    const mesh = new THREE.SkinnedMesh(balbalCrackGeometry(), material); mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
    a.mesh.add(mesh); mesh.bind(a.mesh.skeleton, a.mesh.bindMatrix); cracks.set(a, material);
  }
  const atk = c.attack, wind = atk >= 0 ? step(atk, 0, .52) : 0, flash = atk >= 0 ? Math.max(0, 1 - Math.abs(atk - .55) * 14) : 0;
  const dead = c.deathT >= 0 ? smooth01(c.deathT) : 0, rising = m['field'] === 1 ? 1 - (m['rise'] ?? 1) : 0;
  m['glow'] = (.9 + .25 * Math.sin(c.t * 2.3 + c.seed) + 2.6 * wind * wind + 4 * flash + 1.5 * rising * (.6 + .4 * Math.sin(c.t * 17))) * (1 - dead * .85);
  material.color.setRGB(1, .46, .1).multiplyScalar(m['glow']);
  if (!c.alive) m['deadT'] = (m['deadT'] ?? 0) + c.dt;
  const ground = terrainHeight(a.position.x, a.position.z), sink = Math.max(0, (m['deadT'] ?? 0) - .9) * 1.1;
  a.yOffset = (m['field'] === 1 ? -(1 - smooth01(m['rise'] ?? 1)) * 2.5 * a.scale : (m['floorY'] ?? ground) - ground) - sink;
  poseNalatiCreature('balbal', c);
}
/** The balbals' page controls; their body, rig and look are the look book's rows. */
export const BALBAL_SPECIES: Pick<SpeciesDef, 'kind' | 'animate' | 'think' | 'damageMul'> = {
  kind: BALBAL, animate: animateBalbal,
  think,
  damageMul: damage,
};

