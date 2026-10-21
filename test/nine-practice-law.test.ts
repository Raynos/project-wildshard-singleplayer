import { expect,test } from 'vitest';
import { ProjectedState, ReturnProgram } from '@wildshard/game/population/returnProgram';
import program from '../src/shards/nine-dragon-stack/behaviour/practice.generated.json' with {type:'json'};
import course from '../src/shards/nine-dragon-stack/data/grappleCourse.json' with {type:'json'};
import { practiceFrame } from '../src/shards/nine-dragon-stack/generators/practiceFrame';

function scenario(): { sample:(signal:string,values?:Readonly<Record<string,number>>)=>Readonly<Record<string,number>>; snapshot:()=>Record<string,number>; restore:(value:Record<string,number>)=>void } {
  const guest=ReturnProgram.page(program),start=course.pads.findIndex(pad=>pad.id===course.run.from);
  const from=course.pads[start];if(from===undefined)throw new Error('Missing real start pad');
  const host=new ProjectedState({initial:{phase:0,started:0,elapsed:0,best:-1,checkpoint:start}},guest);
  // The guest now finds the pad from the position, so samples carry the baked course frame and a grounded flag.
  const fixed={...practiceFrame(course),grounded:1};
  return {snapshot:()=>({...host.state}),restore:value=>{host.set(value);},sample:(signal,values={})=>{
    const out=host.event(signal,{...fixed,now:0,x:from.x,y:from.top,z:from.z,pad:start,eligible:0,...values});
    return out;
  }};
}

test('real Nine route starts beyond its line, records checkpoints and finishes once',()=>{
  const run=scenario();expect(run.sample('reset')).toMatchObject({phase:0,best:-1,visit:-1,finish:0});
  expect(run.sample('step',{now:5})).toMatchObject({phase:0,elapsed:0});
  const route=['p1','p2','base','l1','l2','top'];
  for(const [tick,id] of route.entries()) {
    const index=course.pads.findIndex(pad=>pad.id===id),pad=course.pads[index];
    if(pad===undefined)throw new Error('Missing real route pad');
    const out=run.sample('step',{now:10+tick,pad:index,eligible:1,x:pad.x,y:pad.top,z:pad.z});
    expect(out).toMatchObject({checkpoint:index,visit:index,phase:id==='top'?2:1,finish:id==='top'?1:0});
  }
  expect(run.snapshot()).toMatchObject({elapsed:5,best:5,phase:2});
  expect(run.sample('step',{now:50})).toMatchObject({finish:0,elapsed:5,best:5});
  expect(run.sample('reset')).toMatchObject({phase:0,elapsed:0,best:5});
});

test('seeded airborne samples preserve the checkpoint and copied continuation resumes',()=>{
  const run=scenario(),restored=scenario();run.sample('reset');
  const index=course.pads.findIndex(pad=>pad.id==='p2'),pad=course.pads[index];
  if(pad===undefined)throw new Error('Missing route checkpoint');
  run.sample('step',{now:3,pad:index,eligible:1,x:pad.x,y:pad.top,z:pad.z});
  let seed=492;
  for(let tick=0;tick<40;tick++) {
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const observed={now:4+tick*.1,pad:-1,eligible:0,grounded:0,x:pad.x+(seed%11)-5,y:pad.top+5,z:pad.z-2};
    restored.restore(run.snapshot());
    expect(restored.sample('step',observed)).toEqual(run.sample('step',observed));
    expect(run.snapshot()['checkpoint']).toBe(index);
  }
  const fallen=run.sample('step',{now:9,pad:-1,grounded:0,y:-course.fallY-1});
  expect(fallen).toMatchObject({fell:1,checkpoint:index,finish:0});
  expect(run.sample('step',{now:10,pad:index,eligible:1,x:pad.x,y:pad.top,z:pad.z})).toMatchObject({fell:0,checkpoint:index});
});
