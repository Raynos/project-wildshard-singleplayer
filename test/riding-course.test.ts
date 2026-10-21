import { expect, test } from 'vitest';
import { RidingCourseRun } from '../src/game/practice/course';
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
  const run=new RidingCourseRun(rows.program),x=rows.lineX,r=rows.oval.radius;
  run.reset(x-1);
  run.step(0,x+1,0,r,false);run.step(1,x-1,0,0,true);run.step(2,x+1,0,0,true);
  expect(run.state.running).toBe(0);
  run.step(3,x-1,0,r,true);run.step(4,x+1,0,r,true);
  expect(run.state.lap).toBe(1);expect(run.elapsed(6)).toBe(2);
  run.step(7,x-1,0,r,true);expect(run.step(8,x+1,0,r,true).notice).toBeNull();
  expect(run.state.lap).toBe(2);expect(run.best).toBeNull();
  run.step(10,x+1,0,-r,true);expect(run.step(11,x-1,0,-r,true).notice).toBe(2);
  const lap=run.step(20,x+1,0,r,true);
  expect(lap).toMatchObject({notice:1,lap:2,time:12,best:true});expect(run.best).toBe(12);
  expect(run.step(21,x+2,-13,r,true).fell).toBe(true);
  run.reset(x-1);expect(run.state.lap).toBe(0);expect(run.state.last).toBe(-1);expect(run.best).toBe(12);
  run.step(22,x+1,0,r,true);run.step(23,x-1,0,-r,true);
  expect(run.step(42,x+1,0,r,true)).toMatchObject({notice:1,time:20,best:false});
  expect(run.best).toBe(12);
});

test('course admission refuses executable fields and an invalid guest before drawing',()=>{
  expect(()=>parseRidingPractice({...orchard,program:{}})).toThrow();
  expect(()=>parseRidingPractice({...orchard,update:()=>0})).toThrow();
  expect(()=>parseRidingPractice({...orchard,actor:{...orchard.actor,variant:()=>0}})).toThrow();
});
