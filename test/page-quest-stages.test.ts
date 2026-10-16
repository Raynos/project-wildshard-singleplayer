// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import type { SystemSpec } from '../src/engine/app/systems';
import { Flags } from '../src/engine/world/interact/flags';
import { parseQuestHost } from '../src/format/questHost';
import { bindBorrowedPageQuestStages } from '../src/game/plugin/ui';
import { QUEST_HOST as signal } from '../src/shards/sunscar-dunes/data/questHost';
import { QUEST_HOST as sky } from '../src/shards/far-reach/data/questHost';
import { FLAG } from '../src/shards/sunscar-dunes/data/flags';
import { FLAGS } from '../src/shards/far-reach/quests/flags';
import { SIGNAL_RUNTIME_ROWS } from '../src/shards/sunscar-dunes/data/runtimeRows';
import { MoverLifecycle } from '../src/engine/sim/moverLifecycle';
import { parseMovers } from '../src/format/movers';
import MOVERS from '../src/shards/far-reach/data/movers.generated.json' with { type: 'json' };
import { STRINGS } from '../src/shards/far-reach/data/strings';
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

it('Sky stages consume mover endpoints and restore them without repeating the toast', () => {
  const flags = new Flags('page-sky', false); flags.set(FLAGS.notes);
  const rows = parseMovers(MOVERS), row = rows.find(entry => entry.id === 'far.winch.bridge');
  if (row?.atEnd === undefined) throw new Error('Missing admitted winch endpoint');
  const lifecycle = new MoverLifecycle([{ id: row.id, atEnd: row.atEnd, restoreFrom: row.restoreFrom }]);
  const updates: SystemSpec[] = [], toasts: string[] = []; let alive = true;
  const tick = (systems: readonly SystemSpec[]): void => {
    for (const phase of ['fixed.post', 'update'] as const) for (const system of systems) if (system.phase === phase) system.run(1 / 60, 0);
  };
  const motion = { data: rows, atEnd: lifecycle.atEnd.bind(lifecycle), drainEndEvents: lifecycle.drain.bind(lifecycle) };
  const source = { questHost: parseQuestHost(sky) };
  bindBorrowedPageQuestStages({ system: spec => { updates.push(spec); } }, source, flags,
    SKY_RUNTIME_ROWS.pageQuest.stages, new Map(), () => ({ alive }), { motion, toast: text => { toasts.push(text); } });
  tick(updates);
  expect(flags.has(FLAGS.roost)).toBe(false); expect(flags.has(FLAGS.raised)).toBe(false);
  alive = false; lifecycle.observe(row.id, { 5: 1 }); tick(updates);
  expect(flags.has(FLAGS.roost)).toBe(true); expect(flags.has(FLAGS.raised)).toBe(true); expect(toasts).toEqual([STRINGS.raised]);
  tick(updates); expect(toasts).toHaveLength(1);
  const loaded = new MoverLifecycle([{ id: row.id, atEnd: row.atEnd, restoreFrom: row.restoreFrom }]); loaded.seed(row.id, { 5: 1 });
  const resumed: SystemSpec[] = [];
  bindBorrowedPageQuestStages({ system: spec => { resumed.push(spec); } }, source, flags,
    SKY_RUNTIME_ROWS.pageQuest.stages, new Map(), () => ({ alive }),
    { motion: { data: rows, atEnd: loaded.atEnd.bind(loaded), drainEndEvents: loaded.drain.bind(loaded) }, toast: text => { toasts.push(text); } });
  tick(resumed); expect(toasts).toHaveLength(1);
  let installed = false;
  expect(() => bindBorrowedPageQuestStages({ system: () => { installed = true; } }, source, flags,
    SKY_RUNTIME_ROWS.pageQuest.stages, new Map(), () => null)).toThrow('Unbound quest mover endpoint');
  expect(installed).toBe(false);
});

it('missing borrowed stage methods refuse before installing events or ticking',()=>{
 const flags=new Flags('page-stage-refusal',false),fire={onLight:null};let installed=false;
 expect(()=>bindBorrowedPageQuestStages({system:()=>{installed=true;}},{questHost:parseQuestHost(signal)},flags,SIGNAL_RUNTIME_ROWS.pageQuest.stages,
 new Map<string,unknown>([['fight',{}],['plugin',{places:{fire}}]]),()=>null)).toThrow();
 expect(installed).toBe(false);expect(fire.onLight).toBe(null);expect(flags.has(FLAG.lit)).toBe(false);
});
