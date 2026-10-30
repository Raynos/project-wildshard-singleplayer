import * as v from 'valibot';
import type { HeadlessCommand } from './tickProtocol';
import type { SimHost } from '@wildshard/engine/sim';
import { diagnosticNow } from '@wildshard/engine/core/clock';

export interface WalkPoint { readonly x:number;readonly z:number;readonly jump?:boolean|number;readonly jumpAt?:number }
export interface WalkStall { readonly tick:number;readonly waypoint:number;readonly x:number;readonly y:number;readonly z:number }
export interface HeadlessJourneyPlan { ticks:number;points:WalkPoint[] }
export interface HeadlessJourneyReport {
  ticks:number;settledTicks:number;distance:number;visited:number;traversals:number;stuck:WalkStall[];
  final:{tick:number;position:[number,number,number];grounded:boolean};maxTickMicros:number;
}
const finite=v.pipe(v.number(),v.finite());
const natural=v.pipe(finite,v.integer(),v.minValue(0));
/** Finite offline route data only; no callbacks, module URLs, snapshots or facts. */
export const HeadlessJourneyPlanSchema:v.GenericSchema<HeadlessJourneyPlan> = v.strictObject({
  ticks:v.pipe(natural,v.minValue(1),v.maxValue(1800)),
  points:v.pipe(v.array(v.strictObject({x:finite,z:finite,jump:v.exactOptional(v.union([v.boolean(),v.pipe(natural,v.maxValue(2))])),
    jumpAt:v.exactOptional(v.pipe(finite,v.minValue(0)))})),v.minLength(2),v.maxLength(256)),
});
/** Compact observations of actual native ticks, never a replacement continuation. */
export const HeadlessJourneyReportSchema:v.GenericSchema<HeadlessJourneyReport> = v.strictObject({
  ticks:natural,settledTicks:natural,distance:v.pipe(finite,v.minValue(0)),visited:natural,traversals:natural,
  stuck:v.pipe(v.array(v.strictObject({tick:natural,waypoint:natural,x:finite,y:finite,z:finite})),v.maxLength(512)),
  final:v.strictObject({tick:natural,position:v.tuple([finite,finite,finite]),grounded:v.boolean()}),maxTickMicros:v.pipe(finite,v.minValue(0)),
});
type PlayerCommand=Extract<HeadlessCommand,{kind:'player'}>;

/** The browser walk's same waypoint tolerance and 0.3 m / 2 s progress rule,
 * driven by fixed ticks and actual committed feet. It never teleports or skips a blocked waypoint. */
export class PhysicsRouteCursor {
  private at=0;
  private direction=1;
  private jumps=0;
  private jumpedAt=0;
  private lastY:number|undefined;
  private windowTick=0;
  private windowDistance=Infinity;
  private readonly reported=new Set<string>();
  readonly stuck:WalkStall[]=[];
  visited=0;
  traversals=0;
  constructor(private readonly points:readonly WalkPoint[]) {
    if(points.length<2||points.some(point=>![point.x,point.z].every(Number.isFinite)))throw new Error('Walk needs two finite route points');
  }
  command(position:readonly number[],tick:number):PlayerCommand {
    const [x,y,z]=position;
    if(x===undefined||y===undefined||z===undefined||![x,y,z].every(Number.isFinite))throw new Error('Invalid committed walk feet');
    let point=this.points[this.at];if(point===undefined)throw new Error('Missing walk waypoint');
    for(let skipped=0;skipped<this.points.length&&Math.hypot(point.x-x,point.z-z)<.8;skipped++){
      this.visited++;this.at+=this.direction;this.jumps=0;this.windowTick=tick;this.windowDistance=Infinity;
      if(this.at>=this.points.length){this.direction=-1;this.at=this.points.length-2;this.traversals++;}
      else if(this.at<0){this.direction=1;this.at=1;this.traversals++;}
      point=this.points[this.at];if(point===undefined)throw new Error('Missing next walk waypoint');
    }
    const dx=point.x-x,dz=point.z-z,distance=Math.hypot(dx,dz),key=`${this.direction}:${this.at}`;
    if(this.windowDistance===Infinity){this.windowDistance=distance;this.windowTick=tick;}
    if(tick-this.windowTick>=120){
      if(this.windowDistance-distance<.3&&!this.reported.has(key)){
        this.reported.add(key);this.stuck.push({tick,waypoint:this.at,x,y,z});
      }
      this.windowTick=tick;this.windowDistance=distance;
    }
    const count=point.jump===true?1:typeof point.jump==='number'?point.jump:0;
    let jump=false;
    if(count>0&&distance<(point.jumpAt??1.6)&&this.jumps===0){jump=true;this.jumps=1;this.jumpedAt=tick;}
    else if(count>1&&this.jumps===1&&tick-this.jumpedAt>5&&this.lastY!==undefined&&(y-this.lastY)*60<1.5){jump=true;this.jumps=2;}
    this.lastY=y;
    return {kind:'player',moveX:distance===0?0:dx/distance,moveZ:distance===0?0:dz/distance,yaw:Math.atan2(-dx,-dz),...(jump?{jump:true}:{})};
  }
}

/** Terminal offline walk. Every tick runs the original native adapter and
 * its script/decision/finite-state refusals. The parent request watchdog still
 * preempts a blocked worker. This proof does not encode a resumable checkpoint. */
export function runHeadlessJourney(host:SimHost,step:(commands:readonly HeadlessCommand[])=>void,input:HeadlessJourneyPlan):HeadlessJourneyReport {
  const plan=v.parse(HeadlessJourneyPlanSchema,input),cursor=new PhysicsRouteCursor(plan.points),initial=host.state.tick;
  let distance=0,maxTickMicros=0;
  const tick=(commands:readonly HeadlessCommand[]):void=>{
    const prior=host.state.tick,started=diagnosticNow();step(commands);maxTickMicros=Math.max(maxTickMicros,(diagnosticNow()-started)*1000);
    if(host.state.tick!==prior+1)throw new Error('Journey did not commit exactly one tick');
    const p=host.player.position;if(![p.x,p.y,p.z].every(Number.isFinite))throw new Error('Journey produced invalid feet');
  };
  for(let at=0;at<plan.ticks;at++){
    const p=host.player.position,x=p.x,z=p.z,command=cursor.command([p.x,p.y,p.z],at);
    tick([command]);distance+=Math.hypot(p.x-x,p.z-z);
  }
  const settledTicks=60;for(let at=0;at<settledTicks;at++)tick([]);
  if(host.state.tick!==initial+plan.ticks+settledTicks)throw new Error('Journey tick count differs');
  const p=host.player.position;
  return {ticks:plan.ticks,settledTicks,distance,visited:cursor.visited,traversals:cursor.traversals,stuck:cursor.stuck,
    final:{tick:host.state.tick,position:[p.x,p.y,p.z],grounded:host.player.motor.snapshot().result.grounded},maxTickMicros};
}
