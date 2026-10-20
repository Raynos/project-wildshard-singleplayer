import * as v from 'valibot';
import type { AnimalRigContext } from '@wildshard/engine/entities/animalRig';
import { lookAngles } from '@wildshard/engine/entities/species/rigs';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import { CreatureFrameSchema } from '@wildshard/format/creatureFrame';
import { installChannelPrograms,numericCreaturePose } from '../plugin/channelPrograms';

/** Client-only retained visual fields, terrain attachment and detached numeric
 * observation channels. Decisions and their clocks remain with the actor. */
export class CreatureFrame {
  private readonly row;
  private readonly pose;
  private readonly rigs=new WeakMap<AnimalRigContext['bones'],{frame:AnimalRigContext;look:{yaw:number;pitch:number};draw:ReturnType<typeof installChannelPrograms>}>();
  constructor(input:unknown){
    this.row=v.parse(CreatureFrameSchema,input);this.pose=numericCreaturePose(this.row.pose);
    if(this.row.observations.some(row=>row.numeric?.group!==this.row.group||row.numeric.outputs.some(output=>output.target!=='mem'||output.path.length!==1)))
      throw new Error('Creature frame observations must target private visual memory');
  }
  animate(c:AnimalRigContext):void{
    const row=this.row,retained=c.mem,dt=c.dt;
    for(const field of row.smooth){
      const value=retained[field.input]??0,previous=retained[field.output]??field.initial??value;
      retained[field.output]=previous+(value-previous)*Math.min(1,dt*field.rate);
    }
    const floor=row.floor;
    if(!c.alive)retained[floor.death]=(retained[floor.death]??0)+dt;
    c.animal.yOffset=(retained[floor.field]??0)-terrainHeight(c.animal.position.x,c.animal.position.z)+(retained[floor.lift]??0)-Math.max(0,(retained[floor.death]??0)-floor.delay)*floor.rate;
    let rig=this.rigs.get(c.bones);
    if(rig===undefined){
      const frame={...c,mem:{...row.defaults}},look={yaw:0,pitch:0};
      for(const program of row.observations)for(const output of program.numeric?.outputs??[]){const key=output.path[0];if(typeof key!=='string')throw new Error('Missing creature visual field');frame.mem[key]=0;}
      rig={frame,look,draw:installChannelPrograms(row.observations,row.group,new Map<string,unknown>([['frame',frame],['mem',frame.mem],['look',look]]))};this.rigs.set(c.bones,rig);
    }
    const {frame,look,draw}=rig,memory=frame.mem;Object.assign(frame,c);frame.mem=memory;Object.assign(memory,retained);Object.assign(look,lookAngles(c,...row.look));
    draw.evaluate({time:c.t,delta:dt,values:{}});this.pose(frame);
  }
}
