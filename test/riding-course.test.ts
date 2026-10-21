import { expect, test } from 'vitest';
import { ProjectedState, ReturnProgram } from '../src/game/population/returnProgram';
import { parseRidingPractice } from '../src/format/practiceCourse';
import { horseCourseRows } from '../src/shards/nalati-grasslands/generators/courseScene';
import { parseDecisionScripts } from '../src/format/decisionScripts';

const original = horseCourseRows();
const originalScript = parseDecisionScripts([original.program.script])[0];
if(originalScript===undefined)throw new Error('Missing mounted course guest');
// An unrelated orchard shard declares its own room, mount and guest parameters.
const orchard = parseRidingPractice({ ...original,
  title:'Orchard circuit',chip:'Harvest run',piece:{id:'orchard-course',name:'Orchard circuit',file:'orchard.json'},
  actor:{kind:'horse',variant:'orchard-cart',name:'Orchard mare'},
  fieldAt:{x:-30,z:90},horseStart:{x:-5,z:9,yaw:Math.PI/2},riderStart:{x:-6,z:7},
  oval:{halfLen:12,radius:9,width:4},lineX:2,road:[[2,9],[12,9],[12,-9],[-12,-9],[-12,9],[2,9]],
  presentation:{parts:[],colliders:[],map:{bounds:{x0:-18,x1:18,z0:-16,z1:16},shapes:[]}},
  program:{...original.program,script:{...originalScript,id:'orchard.course',params:{...originalScript.params,courseRadius:9,courseWidth:4,courseLine:2}}},
});

for(const rows of [original,orchard])test(`${rows.title}: mounted laps require the back straight and preserve the record`,()=>{
  expect(parseRidingPractice(rows)).toEqual(rows);
  const run=new ProjectedState({initial:{lap:0,started:0,running:0,half:0,best:-1,last:-1,prevX:0},
    signals:{reset:'courseReset',step:'courseStep'}},ReturnProgram.page(rows.program)),x=rows.lineX,r=rows.oval.radius;
  const reset=(courseX:number):void=>{run.event('reset',{courseX,courseY:0,courseZ:0,courseTime:0,courseMounted:0});};
  const step=(courseTime:number,courseX:number,courseY:number,courseZ:number,mounted:boolean)=>run.event('step',{courseTime,courseX,courseY,courseZ,courseMounted:Number(mounted)});
  reset(x-1);
  step(0,x+1,0,r,false);step(1,x-1,0,0,true);step(2,x+1,0,0,true);
  expect(run.state.running).toBe(0);
  step(3,x-1,0,r,true);step(4,x+1,0,r,true);
  expect(run.state.lap).toBe(1);expect(run.state.started).toBe(4);
  step(7,x-1,0,r,true);expect(step(8,x+1,0,r,true)['courseEvent']).toBe(0);
  expect(run.state.lap).toBe(2);expect(run.state.best).toBe(-1);
  step(10,x+1,0,-r,true);expect(step(11,x-1,0,-r,true)['courseEvent']).toBe(2);
  const lap=step(20,x+1,0,r,true);
  expect(lap).toMatchObject({courseEvent:1,lap:3,last:12,best:12});expect(run.state.best).toBe(12);
  expect(step(21,x+2,-13,r,true)['courseFell']).toBe(1);
  reset(x-1);expect(run.state.lap).toBe(0);expect(run.state.last).toBe(-1);expect(run.state.best).toBe(12);
  step(22,x+1,0,r,true);step(23,x-1,0,-r,true);
  expect(step(42,x+1,0,r,true)).toMatchObject({courseEvent:1,last:20,best:12});
  expect(run.state.best).toBe(12);
});

test('course admission refuses executable fields and an invalid guest before drawing',()=>{
  expect(()=>parseRidingPractice({...orchard,program:{}})).toThrow();
  expect(()=>parseRidingPractice({...orchard,update:()=>0})).toThrow();
  expect(()=>parseRidingPractice({...orchard,actor:{...orchard.actor,variant:()=>0}})).toThrow();
});
