// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { BoxGeometry, Mesh } from 'three';
import { parseQuestNpcBinding } from '../src/format/npcs';
import { borrowedNpcSpecimen } from '../src/game/plugin/ui';
import { QUEST_NPC } from '../src/shards/sunscar-dunes/data/questNpc';

test('borrowed NPC specimen builds its admitted figure and refuses invalid geometry',()=>{
  const source={questNpcs:[parseQuestNpcBinding(QUEST_NPC)]};
  const row={kind:'npc',npc:QUEST_NPC.npc.id,figure:{kind:'mesh',read:{owner:'models',path:['mesh']}}} as const;
  const root=borrowedNpcSpecimen(source,row,new Map([['models',{mesh:()=>new BoxGeometry(0.5,1.7,0.4)}]]));
  let drawn=false;root.traverse(object=>{if(object instanceof Mesh)drawn=true;});
  expect(drawn).toBe(true);
  expect(()=>borrowedNpcSpecimen(source,row,new Map([['models',{mesh:()=>({invalid:true})}]]))).toThrow('copied geometry');
  expect(()=>borrowedNpcSpecimen(source,{...row,npc:'missing'},new Map())).toThrow('Undeclared quest NPC');
});
