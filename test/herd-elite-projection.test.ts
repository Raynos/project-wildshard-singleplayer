import {expect,test} from 'vitest';
import {Scope} from '../src/engine/app/scope';
import {ProjectedState,ReturnProgram} from '../src/game/population/returnProgram';
import {HerdEliteProjection} from './fixtures/originalEliteEncounters';
import admission from '../src/shards/nalati-grasslands/behaviour/admission.generated.json' with {type:'json'};
import program from '../src/shards/nalati-grasslands/behaviour/eliteGroup.generated.json' with {type:'json'};
import law from '../src/shards/nalati-grasslands/data/eliteGroup.json' with {type:'json'};

const codec:Readonly<Record<string,number>>={flaunt:1,rush:2,yield:3};
const initial={state:'flaunt',phase2:false,engaged:true,bonded:false,same:true,health:1,at:[1,2,3] as const,player:[4,5,6] as const};
test('actual ABI2 projection matches original due-only effects and retained f64 columns',()=>{
  const scope=new Scope('group.differential');
  try{
    const old=new HerdEliteProjection({signal:'argymaqTick',states:codec},ReturnProgram.page(admission,scope));
    const current=new ProjectedState({...law,signals:{step:law.signal}},ReturnProgram.page(program,scope));
    for(const [dt,frame]of [[.05,initial],[.05,initial],[.021,{...initial,state:'unknown'}],[.079,{...initial,state:'rush',phase2:true}],
      [.9,{...initial,state:'yield',bonded:true,same:false}],[.13,{...initial,state:'flaunt',at:[-0,.123456789012345,3] as const}]] as const){
      const expected=old.advance(dt,frame),{values}=current.step(dt,{state:codec[frame.state]??0,phase2:Number(frame.phase2),engaged:Number(frame.engaged),bonded:Number(frame.bonded),same:Number(frame.same),health:frame.health,x:frame.at[0],y:frame.at[1],z:frame.at[2],px:frame.player[0],py:frame.player[1],pz:frame.player[2]});
      expect({signature:values['signature']===1,lead:values['lead']===1,adopt:values['adopt']===1}).toEqual(expected);
      const saved=old.snapshot();expect(current.samplingTime).toBe(saved.elapsed);expect(current.value('laneT')).toBe(saved.laneT);expect(current.value('runT')).toBe(saved.runT);
      for(const [keys,point]of [[['fromX','fromY','fromZ'],saved.laneFrom],[['toX','toY','toZ'],saved.laneTo]] as const)keys.forEach((key,i)=>expect(Object.is(current.value(key),point[i])).toBe(true));
    }
  }finally{scope.dispose();}
});
test('failed projection keeps accumulated cadence and refuses restore before mutation',()=>{
  let fail=true,calls=0;
  const owner=new ProjectedState({initial:{n:0},retain:{n:'n'},outputs:['n'],signals:{step:'sample'}},{project:(_signal,frame)=>{calls++;if(fail)throw new Error('projection refused');return{n:frame['dt']??0};}});
  owner.step(.04,{});expect(()=>owner.step(.07,{})).toThrow('refused');expect(owner.samplingTime).toBe(.04+.07);expect(owner.value('n')).toBe(0);
  fail=false;const elapsed=.04+.07+.02;expect(owner.step(.02,{})).toEqual({dt:elapsed,values:{n:elapsed}});expect(calls).toBe(2);expect(owner.samplingTime).toBe(0);
  for(const n of [-0,-3.5,4.2]){owner.restoreSamplingTime(n);expect(Object.is(owner.samplingTime,n)).toBe(true);}
  expect(()=>owner.restoreSamplingTime(Infinity)).toThrow();expect(owner.samplingTime).toBe(4.2);
});
