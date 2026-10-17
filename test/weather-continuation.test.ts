import { expect, test } from 'vitest';
import type { SystemSpec } from '../src/engine/app/systems';
import { WeatherContinuation } from '../src/engine/world/weatherContinuation';
import { parseWeatherProgram } from '../src/format/weatherProgram';
import { PineWeather } from '../src/shards/pine-hollow-legacy/world/weatherProfile';
import { SteppeStorm as OldStorm } from '../src/shards/nalati-grasslands-legacy/world/Weather';
import { Lightning } from '../src/shards/nalati-grasslands/world/Lightning';
import { installWeatherContinuation } from '../src/game/plugin/weather';
import nalati from '../src/shards/nalati-grasslands/data/weather.json' with {type:'json'};
import pine from '../src/shards/pine-hollow/data/weather.json' with { type:'json' };
import saved from './fixtures/weather-continuation.json' with { type:'json' };

const rows=parseWeatherProgram(pine);
test('DATA weather preserves phase RNG, every numeric output and held-mode transitions',()=>{
  for(const seed of [1,0x4a1a])for(const mode of ['live','rain','clear','fog'] as const){
    const current=new WeatherContinuation(rows,{seed,mode}),old=new PineWeather({seed,mode});
    for(let i=0;i<2400;i++){
      const dt=i%11===0?31:(i%7+1)/120,phase=(i/239)%1;
      current.update(dt,phase);old.update(dt,phase);
      expect(current.captureWeather()).toEqual(old.captureWeather());
      if(i===987){current.force('rain');old.force('rain');}
      if(i===1234){current.setMode('live');old.setMode('live');}
    }
  }
});
test('old v1 cadence/wind saves resume exactly and malformed restore is atomic',()=>{
  for(const entry of saved){
    const current=new WeatherContinuation(rows,{seed:entry.seed,mode:entry.mode}),identity=current.gust?.current;
    current.prepareContinuationRestore(entry.saved)();
    expect(current.captureContinuation()).toEqual(entry.saved);
    for(let i=0;i<entry.tail.length;i++){
      current.step((i%5+1)/60,(i/13)%1);expect(current.captureContinuation()).toEqual(entry.tail[i]);
    }
    for(const bad of [{...entry.saved,boost:2},{...entry.saved,wind:{...entry.saved.wind,time:0}},
      {...entry.saved,weather:{...entry.saved.weather,n:{rain:0}}}]){
      const before=current.captureContinuation();expect(()=>current.prepareContinuationRestore(bad)).toThrow();
      expect(current.captureContinuation()).toEqual(before);expect(current.gust?.current).toBe(identity);
    }
  }
});
test('Nalati keeps lightning, RNG, held phases and old save continuation on the same DATA host',()=>{
  const world={heightAt:()=>0,exposed:()=>undefined,player:()=>({x:1,y:1.75,z:2,crouched:false,mounted:false,sheltered:false})};
  for(const seed of [7,0x4a1a]){
    const current=new Lightning(installWeatherContinuation({seed},parseWeatherProgram({...nalati,firstLength:{clear:[.6,1.2]}}),{phase:0},undefined),world),old=new OldStorm({seed,world,firstClear:[.01,.02]});
    for(let i=0;i<3200;i++){
      current.update(.5);old.update(.5);expect(current.snapshot()).toEqual(old.snapshot());
      if(i===300){current.weather.force('storm',.4);old.force('storm',.4);}
      if(i===900){current.weather.hold=true;old.hold=true;}
      if(i===1100){current.weather.hold=false;old.hold=false;}
      if(i===1700){const value=old.snapshot();current.restore(value);expect(current.snapshot()).toEqual(value);}
    }
  }
});
test('weather programs refuse incomplete phases, outputs and unbounded expressions',()=>{
  expect(()=>parseWeatherProgram({...pine,next:{clear:'missing'}})).toThrow();
  expect(()=>parseWeatherProgram({...pine,outputs:{rain:1}})).toThrow();
  expect(()=>parseWeatherProgram({...pine,values:[['rain','later']]})).toThrow();
  expect(()=>parseWeatherProgram({...pine,values:[['t',1]]})).toThrow();
  expect(()=>parseWeatherProgram({...pine,values:[['bad',['ss',0,1]]]})).toThrow();
});

test('page installer keeps the declared system, clock and pause owner',()=>{
  const systems:SystemSpec[]=[],state={paused:false},day={phase:.25};
  const weather=installWeatherContinuation({seed:31,system:spec=>{systems.push(spec);},state},rows,day,'live');
  const original=new WeatherContinuation(rows,{seed:31,mode:'live'}),system=systems[0];
  expect(system).toMatchObject({...rows.page,phase:'update'});
  if(system===undefined)throw new Error('Missing installed page system');
  for(let i=0;i<120;i++){
    day.phase=i/120;state.paused=i%7===0;
    system.run(.5,i*.5);if(!state.paused)original.update(.5,day.phase);
    expect(weather.captureWeather()).toEqual(original.captureWeather());
    expect(weather.registers).toEqual(original.registers);
  }
});

test('action rows refuse undeclared registers and inputs before consuming RNG',()=>{
  for(const actions of [
    {tick:[{target:'missing',value:0}]},
    {tick:[{target:'boost',value:'register.missing'}]},
    {tick:[{target:'boost',when:'clock',value:0}]},
    {tick:[{target:'boost',value:{range:[0,'missing']}}]},
    {tick:Array.from({length:65},()=>({target:'boost',value:0}))},
  ])expect(()=>parseWeatherProgram({...pine,actions})).toThrow();
  expect(()=>parseWeatherProgram({...pine,outputs:{...pine.outputs,wind:'register.boost'}})).toThrow();
});
