import { InteractionRules } from '../src/game/quest/interactionRows';
import { Vector3 } from 'three';
// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { Flags } from '../src/engine/world/interact/flags';
import { parseQuestHost } from '../src/format/questHost';
import { createQuestPagePrompts, bindQuestPageInteractions } from '../src/game/plugin/ui';
import { QUEST_HOST as signal } from '../src/shards/sunscar-dunes/data/questHost';
import { QUEST_HOST as sky } from '../src/shards/far-reach/data/questHost';
import { FLAG } from '../src/shards/sunscar-dunes/data/flags';
import { FLAGS } from '../src/shards/far-reach/quests/flags';

test('Signal refuses unraised oil, runs the crank and restores saved page state',()=>{
  const flags=new Flags('page-beats-signal',false),well={label:'well'},logbook={label:'logbook'},jar={visible:true},toasts:string[]=[];
  let summoned=false;
  const labels=new Map([['well',well],['logbook',logbook],...['0','1','2'].map(id=>[`brazier.${id}`,{label:'brazier'}] as const)]);
  const visible=new Map([['jar',jar],...['0','1','2'].flatMap(id=>[[`oil.${id}`,{visible:false}] as const,[`fire.${id}`,{visible:false}] as const])]);
  const calls=new Map<string,()=>void>([['catch-fire',()=>undefined],['summon',()=>{summoned=true;}],...['0','1','2'].map(id=>[`glow.${id}`,()=>undefined] as const)]);
  const ports={flags,labels,visible,calls,owners:new Map([['world',{logbook:{onInteract:()=>undefined},fire:{brazier:{onInteract:()=>undefined}},well:{crankAt:new Vector3(),spot:{onInteract:()=>undefined}},braziers:['0','1','2'].map(()=>({spot:{onInteract:()=>undefined},parts:{bowlAt:new Vector3()}}))}]]),toast:(text:string)=>{toasts.push(text);}};
  const page=bindQuestPageInteractions({questHost:parseQuestHost(signal)},ports);
  expect(page.run('well')).toBe(false);expect(jar.visible).toBe(true);expect(toasts).not.toEqual([]);
  expect(page.run('crank')).toBe(true);expect(page.run('well')).toBe(true);expect(flags.has(FLAG.oil)).toBe(true);expect(jar.visible).toBe(false);
  expect(page.run('well')).toBe(false);expect(page.run('fire')).toBe(false);
  for(const id of ['0','1','2']){expect(page.run(`pour.${id}`)).toBe(true);expect(page.run(`light.${id}`)).toBe(true);}
  expect(page.run('fire')).toBe(true);expect(summoned).toBe(true);summoned=false;expect(page.run('fire')).toBe(false);expect(summoned).toBe(false);
  jar.visible=true;well.label='old';
  bindQuestPageInteractions({questHost:parseQuestHost(signal)},ports);
  expect(jar.visible).toBe(false);expect(well.label).not.toBe('old');
  expect(()=>page.run('missing')).toThrow('Unknown page interaction');
});

test('Sky notes unlock the quest, winch needs both permissions and a raised winch stays silent',()=>{
  const flags=new Flags('page-beats-sky',false);let up=false,commanded=false;
  const page=bindQuestPageInteractions({questHost:parseQuestHost(sky)},{flags,toast:()=>undefined,
    owners:new Map([['world',{notes:{onInteract:()=>undefined},winch:{onInteract:()=>undefined}}]]),observations:new Map([['winch-up',()=>up]]),calls:new Map([['winch',()=>{commanded=true;}]])});
  page.action('notes')();expect(flags.has(FLAGS.notes)).toBe(true);expect(page.run('winch')).toBe(false);
  flags.set(FLAGS.roost);flags.set(FLAGS.vanes);expect(page.run('winch')).toBe(true);expect(commanded).toBe(true);
  commanded=false;up=true;expect(page.run('winch')).toBe(false);expect(commanded).toBe(false);
});

test('unknown fields or missing borrowed targets refuse before initial effects',()=>{
  const flags=new Flags('page-beats-invalid',false),view={label:'unchanged'};
  expect(()=>bindQuestPageInteractions({questHost:parseQuestHost({...signal,page:{actions:[],unexpected:true}})},{flags,toast:()=>undefined})).toThrow();
  expect(()=>bindQuestPageInteractions({questHost:parseQuestHost({...signal,page:{actions:[{id:'a',after:[{kind:'call',target:'missing'}]}],initial:[{when:{},effects:[{kind:'label',target:'view',text:'changed'}]}]}})},
    {flags,labels:new Map([['view',view]]),toast:()=>undefined})).toThrow('Missing page interaction command');
  expect(view.label).toBe('unchanged');
});

test('borrowed rows restore actual views and methods keep their receiver; path escapes refuse',()=>{
  const flags=new Flags('page-borrowed-world',false);flags.set('restored');
  const world={label:'old',visible:true,active:false,turn(on:boolean){this.active=on;}};
  const page={actions:[{id:'turn',after:[{kind:'call',target:'turn'}]}],bindings:{
    labels:[{target:'label',owner:'world',path:['label']}],visible:[{target:'visible',owner:'world',path:['visible']}],
    calls:[{target:'turn',owner:'world',path:['turn'],args:[true]}]},
    initial:[{when:{all:['restored']},effects:[{kind:'label',target:'label',text:'restored'},{kind:'visible',target:'visible',value:false}]}]};
  const source={questHost:parseQuestHost({...signal,page})};
  const bound=bindQuestPageInteractions(source,{flags,owners:new Map([['world',world]]),toast:()=>undefined});
  expect(world.label).toBe('restored');expect(world.visible).toBe(false);bound.run('turn');expect(world.active).toBe(true);
  expect(()=>parseQuestHost({...signal,page:{...page,bindings:{calls:[{target:'turn',owner:'world',path:['constructor','prototype']}]}}})).toThrow();
  world.label='unchanged';
  expect(()=>bindQuestPageInteractions(source,{flags,owners:new Map(),toast:()=>undefined})).toThrow('Missing borrowed owner');
  expect(world.label).toBe('unchanged');
});

 test('borrowed prompt binds its named page action and preflights before restore',()=>{
  const flags=new Flags('prompt-bindings',false),world={onInteract:()=>undefined,label:'before'};let called=false;
  const page={actions:[{id:'take',after:[{kind:'call',target:'take'}]}],bindings:{prompts:[{target:'take',owner:'world',path:['onInteract']}],labels:[{target:'label',owner:'world',path:['label']}]},initial:[{when:{},effects:[{kind:'label',target:'label',text:'restored'}]}]};
  const source={questHost:parseQuestHost({...signal,page})};
  bindQuestPageInteractions(source,{flags,owners:new Map([['world',world]]),calls:new Map([['take',()=>{called=true;}]]),toast:()=>undefined});world.onInteract();expect(called).toBe(true);expect(world.label).toBe('restored');
  const broken={onInteract:0,label:'before'};expect(()=>bindQuestPageInteractions(source,{flags,owners:new Map([['world',broken]]),calls:new Map([['take',()=>undefined]]),toast:()=>undefined})).toThrow('Invalid borrowed prompt');expect(broken.label).toBe('before');
 });

test('admitted interaction rules refuse a missing host without changing flags',()=>{
 const flags=new Flags('missing-interaction-host',false);expect(()=>InteractionRules.fromDeclared({},flags)).toThrow('Missing admitted interaction host');expect(flags.has(FLAG.oil)).toBe(false);
});

test('declared prompts borrow their real positions and refuse missing or unsafe frames',()=>{
  const at=new Vector3(4,5,6),source={questHost:parseQuestHost({...sky,page:{...sky.page,prompts:[{id:'notes',label:'Read notes',radius:2.6,at:{owner:'world',path:['at']}}]}})};
  const [prompt]=createQuestPagePrompts(source,new Map([['world',{at}]]),['notes']);
  expect(prompt.position).toBe(at);expect(prompt.label).toBe('Read notes');expect(prompt.radius).toBeGreaterThan(0);
  expect(()=>prompt.onInteract()).toThrow('not bound');
  expect(()=>createQuestPagePrompts(source,new Map([['world',{at:0}]]),['notes'])).toThrow('actual position');
  expect(()=>createQuestPagePrompts(source,new Map([['world',{at}]]),['missing'])).toThrow('Undeclared');
  expect(()=>parseQuestHost({...sky,page:{actions:[],prompts:[{id:'bad',label:'Bad',radius:1,at:{owner:'world',path:['__proto__']}}]}})).toThrow();
});

test('prompt registration preserves real object order and refuses before appending',()=>{
  const flags=new Flags('registered-prompts',false),first={label:'First',position:new Vector3(),radius:2,onInteract:()=>undefined},second={label:'Second',position:new Vector3(1,0,0),radius:3,onInteract:()=>undefined};
  const source={questHost:parseQuestHost({...sky,page:{actions:[{id:'a'},{id:'b'}],bindings:{prompts:[{target:'a',owner:'world',path:['first','onInteract']},{target:'b',owner:'world',path:['second','onInteract']}]}}})};
  const interactables:typeof first[]=[];
  bindQuestPageInteractions(source,{flags,owners:new Map([['world',{first,second}]]),interactables,toast:()=>undefined});
  expect(interactables).toEqual([first,second]);expect(()=>first.onInteract()).not.toThrow();
  const refused:typeof first[]=[];
  expect(()=>bindQuestPageInteractions(source,{flags,owners:new Map([['world',{first,second:{onInteract:()=>undefined}}]]),interactables:refused,toast:()=>undefined})).toThrow('Invalid registered');expect(refused).toEqual([]);
});
