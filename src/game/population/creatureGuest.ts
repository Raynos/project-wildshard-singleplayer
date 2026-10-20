import * as v from 'valibot';
import { Vector3 } from 'three';
import { app } from '@wildshard/engine/app/runtime';
import { ANIMAL_STATES } from '@wildshard/engine/entities/AnimalSim';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { SpeciesDef,ThinkCtx } from '@wildshard/engine/entities/species/registry';
import type { DamageRequest } from '@wildshard/engine/combat/pipeline';
import { StrikeRunner } from '@wildshard/engine/ai/strikes';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import { CreatureGuestSchema } from '@wildshard/format/creatureGuest';
import { ReturnProgram } from './returnProgram';

/** Client-only adapter from the existing ten-Hz guest to actual native species
 * observations, movement and contact. No authored callback or second AI clock. */
export class PageCreatureGuest {
  private readonly row;
  private get program():ReturnProgram{return ReturnProgram.page(this.row.program,app.levelScope??undefined);}
  private readonly strike;
  private readonly contacts=new StrikeRunner();
  private readonly point=new Vector3();
  readonly binding:Required<Pick<SpeciesDef,'think'|'damageMul'>>={
    think:(actor,context)=>{this.think(actor,context);},
    damageMul:(actor,point,_direction,request)=>this.damage(actor,point,request),
  };
  constructor(input:unknown){
    this.row=v.parse(CreatureGuestSchema,input);this.strike=strikeFromData(this.row.strike);
    if(this.row.states.some(state=>!ANIMAL_STATES.some(value=>value===state)))throw new Error('Unknown creature state');
  }
  /** A geometric observation shared by damage and local hit presentation. */
  weakPoint(actor:Animal,point:Vector3):boolean{
    this.point.copy(point).sub(actor.position);this.point.y-=actor.yOffset;
    const cos=Math.cos(-actor.yaw),sin=Math.sin(-actor.yaw),x=this.point.x*cos+this.point.z*sin,z=-this.point.x*sin+this.point.z*cos;
    this.point.set(x,this.point.y,z).multiplyScalar(1/actor.scale);
    return this.row.weak.some(([px,py,pz])=>Math.hypot(this.point.x-px,this.point.y-py,this.point.z-pz)<this.row.radius);
  }
  private think(actor:Animal,context:ThinkCtx):void{
    const row=this.row,memory=actor.mem,previous=memory[row.clock],dt=previous===undefined?context.dt:context.t-previous;
    if(previous!==undefined&&dt<.1-1e-9)return;
    const observed:Record<string,number>={};
    for(const [key,field]of Object.entries(row.memory))observed[key]=memory[key]??(field.when!==undefined&&memory[field.when.field]===field.when.equal?field.when.value:field.source===undefined?field.value:field.source==='yaw'?actor.yaw:actor.position[field.source]);
    const bearing=Math.atan2(context.player.x-actor.position.x,context.player.z-actor.position.z),wrap=(angle:number)=>Math.atan2(Math.sin(angle),Math.cos(angle));
    const answer=this.program.project('think',{...observed,bearing,homeBearing:Math.atan2((observed['homeX']??actor.position.x)-actor.position.x,(observed['homeZ']??actor.position.z)-actor.position.z),
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
      const shape=this.strike.shape;if(shape.kind!=='wedge')throw new Error('Guest contact needs an admitted wedge');
      this.contacts.contact({...this.strike,shape:{...shape,length:row.length[0]*actor.scale/row.length[1]+row.length[2]}},{actor,target:context.player,canReach:()=>context.reach(actor),hit:()=>{context.hurt(out('damage'));}});context.sound(row.strikeSound);
    }
    const sound=row.sounds[out('sound')];if(sound!==undefined&&sound!=='')context.sound(sound);
  }
  private damage(actor:Animal,point:Vector3,request:DamageRequest|undefined):number{
    const row=this.row,equipment=app.equipment,id=equipment!==null&&equipment.visible&&!equipment.stowed?equipment.current.row.id:'';
    const piercing=request===undefined||request.sourceTags.some(tag=>tag===row.piercing.legacy)?row.piercing.equipment.includes(id):request.sourceTags.some(tag=>row.piercing.tags.includes(tag));
    return v.parse(v.pipe(v.number(),v.finite()),this.program.project('damage',{field:actor.mem['field']??0,rise:actor.mem['rise']??1,open:actor.mem['open']??0,
      range:Math.hypot(point.x-(actor.mem[row.playerKeys[0]]??0),point.z-(actor.mem[row.playerKeys[1]]??0)),piercing:Number(piercing),crack:Number(this.weakPoint(actor,point))})['damage']);
  }
}
