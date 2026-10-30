// oxlint-disable-next-line import/no-nodejs-modules -- The real shipped physics module owns prompt visibility.
import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import * as v from 'valibot';
import {loadRapier} from '../src/engine/physics/rapier';
import {createSimHost} from '../src/engine/sim';
import {trustedLevel} from '../src/game/plugin/simulation';
import {emptyShardfile} from '../src/sdk/author';
import {parseQuestData} from '../src/format/quests';
import {FigureGroupSchema} from '../src/format/figures';
import {NpcDialogueRowSchema} from '../src/format/npcs';
import {parseChapterStoryPresentation} from '../src/format/questStory';
import {installNalatiReadings} from './fixtures/nalati-verbs';
import content from '../src/shards/nalati-grasslands/data/questContent.json' with {type:'json'};
import chapters from '../src/shards/nalati-grasslands/data/chapterStory.json' with {type:'json'};
import {peopleRows} from '../src/shards/nalati-grasslands/generators/peopleRows.mjs';
import type {HeadlessCommand,HeadlessEffect} from '../src/sdk/tickProtocol';

test('the elder only grants his authored introduction when the real reading completes in reach',async()=>{
  const rapier=await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const source=emptyShardfile({slug:'reading-proof',name:'Reading proof',author:'Test',revision:1,seed:1});
  const host=createSimHost(trustedLevel(source,{at:{x:0,y:0,z:0},yaw:0,speed:4.3},{size:500,height:0}),{rapier});
  let commands:HeadlessCommand[]=[];const effects:HeadlessEffect[]=[];
  const fixture=v.parse(v.object({figures:FigureGroupSchema,npcs:v.record(v.string(),NpcDialogueRowSchema)}),{figures:peopleRows,npcs:content.npcs});
  try{
    installNalatiReadings(host,{commands:()=>commands,emit:effect=>{effects.push(effect);}},parseQuestData(content.quests),fixture,parseChapterStoryPresentation(chapters));
    commands=[{kind:'script',actorId:'nalati.talk',value:0}];host.step();
    expect(host.flags.has('talked:elder')).toBe(false);expect(host.adapters.get('nalati.talk')?.snapshot()).toBeNull();
    host.resetPlayerPose({x:86.6,y:0,z:219.5},0);host.step();
    expect(host.adapters.get('nalati.talk')?.snapshot()).not.toBeNull();expect(host.flags.has('talked:elder')).toBe(false);
    const reading=host.adapters.get('nalati.talk');if(reading===undefined)throw new Error('Missing actual reading owner');
    const saved=reading.snapshot();
    commands=[{kind:'script',actorId:'nalati.talk',value:-1}];host.step();
    expect(host.flags.has('talked:elder')).toBe(false);
    reading.restore(saved);expect(reading.snapshot()).toEqual(saved);expect(host.flags.has('talked:elder')).toBe(false);
    commands=[];host.resetPlayerPose({x:0,y:0,z:0},0);host.step();
    expect(reading.snapshot()).toBeNull();expect(host.flags.has('talked:elder')).toBe(false);
    host.resetPlayerPose({x:86.6,y:0,z:219.5},0);
    commands=[{kind:'script',actorId:'nalati.talk',value:0}];
    for(let tick=0;tick<64&&!host.flags.has('talked:elder');tick++)host.step();
    expect(host.flags.has('talked:elder')).toBe(true);
    expect(host.quests.find(row=>row.def.id==='tulpar')?.isStarted).toBe(true);
    expect(host.flags.has('tamed:horse')).toBe(false);expect(host.flags.has('won:kokpar')).toBe(false);
    expect(effects).toEqual([]);
  }finally{host.dispose();}
});
