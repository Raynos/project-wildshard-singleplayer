// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { Flags } from '../src/engine/world/interact/flags';
import { parseQuestHost } from '../src/format/questHost';
import { bindBorrowedPageQuestStages } from '../src/game/plugin/ui';
import { QUEST_HOST as signal } from '../src/shards/sunscar-dunes/data/questHost';
import { QUEST_HOST as sky } from '../src/shards/far-reach/data/questHost';
import { FLAG } from '../src/shards/sunscar-dunes/data/flags';
import { FLAGS } from '../src/shards/far-reach/quests/flags';
import { SIGNAL_RUNTIME_ROWS } from '../src/shards/sunscar-dunes/data/runtimeRows';
import { SKY_RUNTIME_ROWS } from '../src/shards/far-reach/data/runtimeRows';

it('a loaded lit Signal save stays quiet', () => {
  const flags = new Flags('page-signal-loaded', false); flags.set(FLAG.lit);
  let summoned = false;
  const fire:{onLight:(()=>void)|null}={onLight:null};
  const stages = bindBorrowedPageQuestStages({ system: () => undefined }, { questHost: parseQuestHost(signal) }, flags,
    SIGNAL_RUNTIME_ROWS.pageQuest.stages,new Map<string,unknown>([['fight',{summon:()=>{summoned=true;}}],['plugin',{places:{fire}}]]),()=>null);
  stages.advance('sunscar.signal-fire');
  expect(summoned).toBe(false);
});

it('accepted Signal fire summons once and refuses unknown stage identities', () => {
  const flags = new Flags('page-signal-edge', false); let summoned = false;
  const fire:{onLight:(()=>void)|null}={onLight:null};
  const stages = bindBorrowedPageQuestStages({ system: () => undefined }, { questHost: parseQuestHost(signal) }, flags,
    SIGNAL_RUNTIME_ROWS.pageQuest.stages,new Map<string,unknown>([['fight',{summon:()=>{summoned=true;}}],['plugin',{places:{fire}}]]),()=>null);
  flags.set(FLAG.lit); fire.onLight?.(); expect(summoned).toBe(true);
  summoned = false; stages.advance('sunscar.signal-fire'); expect(summoned).toBe(false);
  expect(() => stages.advance('foreign-stage')).toThrow('Undeclared page quest stage');
});

it('Sky progress observes living roost bodies and the actual raised winch', () => {
  const flags = new Flags('page-sky', false); flags.set(FLAGS.notes);
  const updates: (() => void)[] = []; let alive = true, raised = false;
  bindBorrowedPageQuestStages({ system: spec => { updates.push(() => { spec.run(1 / 60, 0); }); } }, { questHost: parseQuestHost(sky) }, flags,
    SKY_RUNTIME_ROWS.pageQuest.stages,new Map([['plugin',{built:{state:{get raised(){return raised;}}}}]]),()=>({alive}));
  for (const update of updates) update();
  expect(flags.has(FLAGS.roost)).toBe(false); expect(flags.has(FLAGS.raised)).toBe(false);
  alive = false; raised = true; for (const update of updates) update();
  expect(flags.has(FLAGS.roost)).toBe(true); expect(flags.has(FLAGS.raised)).toBe(true);
});

it('missing borrowed stage methods refuse before installing events or ticking',()=>{
 const flags=new Flags('page-stage-refusal',false),fire={onLight:null};let installed=false;
 expect(()=>bindBorrowedPageQuestStages({system:()=>{installed=true;}},{questHost:parseQuestHost(signal)},flags,SIGNAL_RUNTIME_ROWS.pageQuest.stages,
 new Map<string,unknown>([['fight',{}],['plugin',{places:{fire}}]]),()=>null)).toThrow();
 expect(installed).toBe(false);expect(fire.onLight).toBe(null);expect(flags.has(FLAG.lit)).toBe(false);
});
