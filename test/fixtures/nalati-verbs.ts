import * as v from 'valibot';
import type {SimHost} from '../../src/engine/sim';
import type {HeadlessRuntimeInstallation,PrepareHeadlessRuntime} from '../../src/sdk/headlessRuntime';
import {QuestLine,type QuestDef} from '../../src/engine/quest/core';
import {NpcReading} from '../../src/engine/quest/dialogueClock';
import {pickPrompt} from '../../src/engine/world/interact/prompts';
import {ChapterViewSchema,type ChapterViewRows} from '../../src/format/questPageComposition';
import {FigureRowSchema} from '../../src/format/figures';
import {parseChapterStoryPresentation} from '../../src/format/questStory';
import {createReadingRoster} from '../../src/game/plugin/quests';
import {eyeReaches} from '../../src/game/quest/interactionRows';
import {prepareHeadlessRuntime as prepareNalati} from './nalati-headless';

/** Add the actual static camp readings to the existing native world. Moving
 * speaker motion remains a separate unimplemented verb, never a stand-in. */
export const prepareHeadlessRuntime:PrepareHeadlessRuntime=async preparation=>{
  const base=await prepareNalati(preparation);
  const content=v.parse(ChapterViewSchema,await preparation.product.json('quests/content.json'));
  const story=parseChapterStoryPresentation(await preparation.product.json('quests/chapters.json'));
  const figures=content.figures;
  if(figures===undefined)throw new Error('Nalati verb readings require admitted figures');
  return {...base,install:(host,context)=>{base.install(host,context);installNalatiReadings(host,context,preparation.shard.quests.quests,content,story);}};
};

/** Bind the original reading/quest owners without scene or UI construction. */
export function installNalatiReadings(host:SimHost,context:Pick<HeadlessRuntimeInstallation,'commands'>,quests:QuestDef[],content:Pick<ChapterViewRows,'figures'|'npcs'>,story:ReturnType<typeof parseChapterStoryPresentation>):void {
    const figures=content.figures;if(figures===undefined)throw new Error('Nalati readings lack figures');
    if(host.quests.length>0)throw new Error('Nalati verb chapter already has an owner');
    const line=new QuestLine(quests,host.flags,host.events,host.scope);
    host.quests.push(...line.chapters);
    const admittedFigures=Object.values(figures.figures).map(figure=>({moving:figure.moving,row:v.parse(FigureRowSchema,figure.row)}));
    const speakers=story.talks.flatMap((talk,index)=>{
      const figure=admittedFigures.find(row=>row.row.id===(talk.figure??talk.id));
      if(figure===undefined||content.npcs[talk.id]===undefined)throw new Error('Nalati talk lacks its admitted speaker');
      if(figure.moving)return [];
      const [x,offset,z]=figure.row.feet,y=host.groundHeightAt(x,z)+offset+figure.row.talkHeight;
      return [{id:talk.id,index,position:{x,y,z},radius:talk.radius}];
    });
    const readings=createReadingRoster({speakers:Object.fromEntries(speakers.map(row=>[row.id,content.npcs[row.id]])),
      continuation:{bare:'elder',wrapped:speakers.filter(row=>row.id!=='elder').map(row=>row.id)}},
    speakers.map(row=>({kind:row.id,at:row.position,prompt:{...row.position,radius:row.radius}})),
    (npc,at,radius)=>{
      if(npc===undefined)throw new Error('Missing Nalati dialogue');
      return new NpcReading(npc,host.flags,at,radius);
    },()=>undefined);
    host.onStep('nalati.talk',dt=>{
      for(const command of context.commands()){
        if(command.kind!=='script'||command.actorId!=='nalati.talk')continue;
        if(command.value===-1){readings.dismiss();continue;}
        const speaker=speakers.find(row=>row.index===command.value);
        if(speaker===undefined)throw new Error('Unknown or moving Nalati reading speaker');
        const eye={x:host.player.position.x,y:host.player.position.y+1.68,z:host.player.position.z};
        if(readings.active||eyeReaches(host,{...speaker.position,radius:speaker.radius})&&pickPrompt([speaker],eye,host.physics)!==undefined)readings.press(speaker.id);
      }
      readings.advanceReading(dt,host.player.position);
    },{snapshot:()=>readings.snapshot(),restore:value=>readings.prepareRestore(value)()});
}
