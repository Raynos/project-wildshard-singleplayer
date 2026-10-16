import {AudioPhraseProgramSchema,type AudioPhraseProgram,type AudioMixExpr as E} from '@wildshard/format/audioProfiles';
import * as v from 'valibot';

type Step=AudioPhraseProgram['steps'][number];
type Tone=Extract<Step,{kind:'tone'}>;
type Burst=Extract<Step,{kind:'burst'}>;
type Body=Extract<Step,{kind:'repeat'}>['body'][number];
const add=(...x:E[]):E=>['+',...x],mul=(...x:E[]):E=>['*',...x],sub=(a:E,b:E):E=>['-',a,b];
const random=(a:number,b:number):E=>add(a,mul('random',sub(b,a)));
const value=(id:string,expr:E):Body=>({kind:'value',id,value:expr});
const repeat=(count:E,max:number,index:string,body:Body[]):Step=>({kind:'repeat',count,max,index,body});
const tone=(row:Omit<Tone,'kind'|'out'>):Tone=>({kind:'tone',out:'out',...row});
const burst=(row:Omit<Burst,'kind'|'out'>):Burst=>({kind:'burst',out:'out',...row});
/** Hoist random-valued argument expressions in authored property order, before the native tone/burst can draw its own noise offset. */
function ordered(input:Step[]):Step[]{
 let serial=0;
 const randomExpr=(expr:E):boolean=>typeof expr==='string'?expr==='random':typeof expr==='number'?false:expr.slice(1).some(randomExpr);
 return input.flatMap(step=>{
  if(step.kind==='repeat')return [v.parse(AudioPhraseProgramSchema,{steps:[{...step,body:ordered(step.body)}]}).steps[0]].filter((row):row is Step=>row!==undefined);
  if(step.kind!=='tone'&&step.kind!=='burst')return [step];
  const rows:Step[]=[],made={...step};
  for(const key of Object.keys(step)){
   if(['kind','out','type','when','vibrato','envelope'].includes(key))continue;
   const parsed=v.parse(AudioPhraseProgramSchema,{steps:[step]}).steps[0];if(parsed===undefined)throw new Error('Missing phrase step');
   const scalar=Reflect.get(parsed,key) as E;
   if(randomExpr(scalar)){const id=`arg.${serial++}`;rows.push(value(id,scalar));Reflect.set(made,key,id);}
  }
  return [...rows,made];
 });
}
const programs:Record<string,Step[]>={
 eagle_cry:[value('n',add(1,['floor',random(0,1.7)])),repeat('n',2,'i',[
  value('ti',add('at',mul('i',random(.42,.55)))),value('top',random(2300,2700)),
  tone({t:'ti',type:'sine',f0:mul('top',.8),f1:'top',glide:.06,gain:.5,attack:.02,hold:.08,decay:.05,vibrato:{rate:34,depth:60}}),
  tone({t:add('ti',.14),type:'sawtooth',f0:'top',f1:mul('top',.62),glide:.3,gain:.22,attack:.01,decay:.32,vibrato:{rate:40,depth:90},lowpass:5200}),
  burst({t:'ti',type:'bandpass',freq:mul('top',1.4),q:2.2,gain:.08,attack:.02,hold:.1,decay:.3}),
 ])],
 leopard_growl:[value('dur',random(.55,.8)),
  tone({t:'at',type:'sawtooth',f0:random(88,104),f1:70,glide:'dur',gain:.6,attack:.04,hold:mul('dur',.5),decay:mul('dur',.45),vibrato:{rate:24,depth:12},lowpass:700}),
  burst({t:'at',type:'bandpass',freq:3200,freqEnd:1800,q:.7,gain:.3,attack:.02,hold:mul('dur',.3),decay:mul('dur',.5)}),
  burst({t:'at',type:'lowpass',freq:600,gain:.35,attack:.03,hold:mul('dur',.4),decay:mul('dur',.5),rate:.8})],
 wolf_howl:[value('voices',add(1,['floor',random(0,2.6)])),repeat('voices',3,'v',[
  value('tv',add('at',['if','v',random(.5,1.6),0])),value('k',['if','v',random(.82,1.22),1]),
  value('rise',random(.45,.7)),value('hold',random(.9,1.5)),value('fall',random(.7,1.1)),value('top',mul(random(560,700),'k')),value('g',['if','v',.3,.55]),
  tone({t:'tv',type:'sine',f0:mul('top',.55),f1:'top',glide:'rise',gain:'g',attack:.25,hold:sub(add('rise','hold'),.25),decay:.08,vibrato:{rate:5,depth:9}}),
  tone({t:add('tv','rise','hold'),type:'sine',f0:'top',f1:mul('top',.62),glide:'fall',gain:'g',attack:.02,decay:'fall',vibrato:{rate:5,depth:7}}),
  tone({t:'tv',type:'triangle',f0:mul('top',1.1),f1:mul('top',2),glide:'rise',gain:mul('g',.12),attack:.3,hold:sub(add('rise','hold'),.3),decay:mul('fall',.6),lowpass:3000}),
  burst({t:'tv',type:'bandpass',freq:mul('top',1.4),q:3,gain:mul('g',.12),attack:.3,hold:add('rise','hold'),decay:'fall'}),
 ])],
 wolf_snarl:[value('dur',random(.5,.8)),tone({t:'at',type:'sawtooth',f0:random(105,125),f1:90,glide:'dur',gain:.6,attack:.04,hold:mul('dur',.6),decay:mul('dur',.4),vibrato:{rate:34,depth:22},lowpass:900}),
  burst({t:'at',type:'bandpass',freq:700,q:1.1,gain:.35,attack:.03,hold:mul('dur',.6),decay:mul('dur',.4)}),burst({t:add('at',mul('dur',.3)),type:'highpass',freq:2600,gain:.08,attack:.05,hold:mul('dur',.3),decay:.2})],
 wolf_bite:[burst({t:'at',type:'highpass',freq:2200,gain:.7,decay:.035}),burst({t:add('at',.012),type:'bandpass',freq:1200,q:1.5,gain:.4,decay:.05}),
  tone({t:'at',type:'sine',f0:140,f1:70,glide:.06,gain:.5,decay:.09}),tone({t:add('at',.05),type:'sawtooth',f0:120,f1:95,glide:.2,gain:.35,attack:.02,decay:.22,vibrato:{rate:30,depth:18},lowpass:800})],
 wolf_yip:[value('n',add(2,['floor',random(0,2)])),repeat('n',3,'i',[
  value('ti',add('at',mul('i',random(.14,.2)))),value('f',random(900,1150)),
  tone({t:'ti',type:'sawtooth',f0:mul('f',.8),f1:mul('f',1.3),glide:.05,gain:.35,attack:.008,hold:.03,decay:.07,lowpass:3200}),
  tone({t:'ti',type:'sine',f0:'f',f1:mul('f',1.2),glide:.06,gain:.3,attack:.008,decay:.09})])],
 horse_neigh:[value('dur',random(1,1.35)),value('top',random(950,1150)),
  tone({t:'at',type:'sawtooth',f0:mul('top',.8),f1:'top',glide:.12,gain:.5,attack:.04,hold:.12,decay:.05,vibrato:{rate:17,depth:110},lowpass:3800}),
  tone({t:add('at',.2),type:'sawtooth',f0:'top',f1:mul('top',.45),glide:'dur',gain:.45,attack:.02,hold:mul('dur',.5),decay:mul('dur',.5),vibrato:{rate:15,depth:90},lowpass:3000}),
  burst({t:'at',type:'bandpass',freq:2200,q:.8,gain:.14,attack:.05,hold:mul('dur',.6),decay:mul('dur',.4)}),value('tn',add('at',.2,'dur')),
  repeat(4,4,'i',[tone({t:add('tn',mul('i',.07)),type:'sawtooth',f0:170,f1:140,glide:.06,gain:.25,attack:.01,decay:.06,lowpass:900})]),
  burst({t:'tn',type:'lowpass',freq:700,gain:.25,attack:.02,hold:.2,decay:.15})],
 horse_snort:[repeat(5,5,'i',[burst({t:add('at',mul('i',.028)),type:'bandpass',freq:random(450,700),q:.9,gain:mul(.5,sub(1,mul('i',.12))),attack:.004,decay:.05})]),burst({t:'at',type:'lowpass',freq:1400,gain:.35,attack:.02,hold:.12,decay:.2})],
 horse_squeal:[tone({t:'at',type:'sawtooth',f0:1300,f1:1700,glide:.1,gain:.55,attack:.02,hold:.25,decay:.3,vibrato:{rate:24,depth:90},lowpass:4200}),
  tone({t:'at',type:'square',f0:650,f1:820,glide:.1,gain:.15,attack:.02,hold:.25,decay:.3,lowpass:2000}),burst({t:'at',type:'bandpass',freq:2600,q:1,gain:.2,attack:.02,hold:.25,decay:.3})],
 dog_bark:[value('n',add(1,['floor',random(0,2.8)])),repeat('n',3,'i',[
  value('ti',add('at',mul('i',random(.22,.32)))),value('f',random(420,520)),tone({t:'ti',type:'sawtooth',f0:'f',f1:mul('f',.6),glide:.1,gain:.55,attack:.008,hold:.03,decay:.1,lowpass:2000}),
  burst({t:'ti',type:'bandpass',freq:900,q:.8,gain:.4,attack:.005,hold:.02,decay:.09})])],
 marmot_whistle:[value('n',add(1,['floor',random(0,1.7)])),repeat('n',2,'i',[
  value('ti',add('at',mul('i',random(.3,.45)))),value('f',random(2700,3100)),tone({t:'ti',type:'sine',f0:mul('f',1.04),f1:mul('f',.94),glide:.18,gain:.45,attack:.01,hold:.1,decay:.12}),
  tone({t:'ti',type:'sine',f0:mul('f',2.08),f1:mul('f',1.88),glide:.18,gain:.06,attack:.01,hold:.1,decay:.1})])],
};
for(const [name,f] of [['wolf_yelp',1150],['dog_yelp',1400]] as const)programs[name]=[
 tone({t:'at',type:'sawtooth',f0:f,f1:mul(f,.5),glide:.32,gain:.55,attack:.01,hold:.04,decay:.3,vibrato:{rate:26,depth:40},lowpass:3600}),
 tone({t:add('at',.36),type:'sine',f0:mul(f,.7),f1:mul(f,.55),glide:.25,gain:.22,attack:.02,decay:.25,vibrato:{rate:12,depth:20}})];
export const NALATI_CALL_PHRASES:Readonly<Record<string,AudioPhraseProgram>>=Object.fromEntries(Object.entries(programs).map(([name,steps])=>[name,v.parse(AudioPhraseProgramSchema,{steps:ordered(steps)})]));
