import * as THREE from 'three';
import { parseCarriedQuest, type CarriedQuestRows } from '@wildshard/format/questSteps';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import { Rng } from '@wildshard/engine/core/rng';
import { modelContext } from '@wildshard/engine/models/model';
import { defineSpecimenCatalogue } from '../models/specimenCatalogue';
import { ReturnProgram } from '../population/returnProgram';
import { pageRidingMount } from '../riding/client';
import { commitQuestEffects } from './effects';
import type { ShardContext } from '../plugin/context';

/** Client-only projection of an existing carried-prop guest. The entered world,
 * mount, saved flags and page services are borrowed by their native identities. */
export class CarriedQuestProp {
  readonly object:THREE.Object3D;
  private readonly rows:CarriedQuestRows;
  private readonly state:Record<string,number>;
  private readonly brain:ReturnProgram;
  private readonly world:NonNullable<NonNullable<ShardContext['game']['runtime']>['world']>;
  private readonly mount:ReturnType<typeof pageRidingMount>;
  private pending=0;
  constructor(private readonly ctx:ShardContext,input:unknown){
    const rows=parseCarriedQuest(input),world=ctx.game.runtime?.world;
    if(world===undefined||world===null)throw new Error('Carried quest requires its entered world');
    this.rows=rows;this.world=world;this.state={...rows.state};this.mount=pageRidingMount(ctx);
    this.brain=ReturnProgram.page(rows.program,ctx.scope);
    const modelRow=rows.model[0];if(modelRow===undefined)throw new Error('Missing carried model');
    const model=defineSpecimenCatalogue<Record<string,object>>(rows.model).model(modelRow.key);
    const object=model.build(modelContext(world.sky),model.defaults,new Rng(0));
    if(!(object instanceof THREE.Object3D))throw new Error('Carried model requires its scene');
    this.object=object;this.object.name=rows.objectName;this.resetPose();
    ctx.scope.onDispose(()=>{object.removeFromParent();});
  }
  get goals():CarriedQuestRows['goals']{return this.rows.goals;}
  get carrying():boolean{return (this.state[this.rows.outputs.carrying]??0)!==0;}
  private floorAt(x:number,z:number):number{
    const ground=terrainHeight(x,z),deck=this.world.registry.floorAt(x,z);
    return deck!==undefined&&deck>ground&&deck<ground+2?deck:ground;
  }
  private resetPose():void{
    const {home,poses}=this.rows;this.object.position.set(home.x,this.floorAt(home.x,home.z)+poses.home.height,home.z);
    this.object.rotation.set(...poses.home.rotation);
  }
  private carryPose():void{
    const horse=this.mount.horse;if(horse===null)return;
    const pose=this.rows.poses.attached;
    this.object.position.set(horse.position.x+Math.cos(horse.yaw)*pose.out,horse.position.y+pose.height,horse.position.z-Math.sin(horse.yaw)*pose.out);
    this.object.rotation.set(0,horse.yaw+pose.yaw,pose.roll);
  }
  win():void{this.project(this.rows.signals.win,0);}
  update(dt:number):void{
    this.pending+=dt;
    if(this.pending>=this.rows.step){const elapsed=this.pending;this.pending=0;this.project(this.rows.signals.step,elapsed);}
    else if(this.carrying)this.carryPose();
  }
  private project(signal:string,dt:number):void{
    const {rows,world,mount,object}=this,fields=rows.fields,horse=mount.horse,player=world.player.position;
    const out=this.brain.project(signal,{...this.state,
      [fields.dt]:dt,[fields.playerX]:player.x,[fields.playerZ]:player.z,[fields.objectX]:object.position.x,[fields.objectZ]:object.position.z,
      [fields.mounted]:Number(mount.mounted),[fields.carrier]:Number(horse!==null),[fields.fast]:Number(mount.gait==='canter'||mount.gait==='gallop'),
      [fields.practice]:Number(practiceRoom.open),[fields.carrierX]:horse?.position.x??0,[fields.carrierZ]:horse?.position.z??0,
    });
    for(const key of Object.keys(this.state)){const value=out[key];if(value===undefined)throw new Error('Missing carried quest continuation');this.state[key]=value;}
    if(out[rows.outputs.warning]===1)commitQuestEffects(this.ctx,rows.quest,rows.warning);
    const pose=out[rows.outputs.pose];
    if(pose===rows.poses.reset)this.resetPose();
    else if(pose!==undefined&&rows.poses.carry.includes(pose))this.carryPose();
    const event=out[rows.outputs.event];
    if(event!==undefined&&event>0){const action=rows.events.find(row=>row.value===event);if(action===undefined)throw new Error('Missing carried quest effect');commitQuestEffects(this.ctx,rows.quest,action.effects);}
    if(pose===rows.poses.goal){
      const goal=rows.goals[out[rows.outputs.goal]??-1];if(goal===undefined)throw new Error('Missing carried quest goal');
      object.position.set(goal.x,this.floorAt(goal.x,goal.z)+rows.poses.delivered.height,goal.z);object.rotation.set(...rows.poses.delivered.rotation);
    }
  }
}
