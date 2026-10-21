import { afterEach, expect, test, vi } from 'vitest';
import { SkinnedMesh, Scene, Vector3 } from 'three';
import { installChapterLead } from '../src/game/quest/chapterDirector';
import { publishBoundChapter } from '../src/game/quest/chapterBindings';
import { publishBoundQuest } from '../src/game/quest/boundState';
import { Scope } from '../src/engine/app/scope';
import { Flags } from '../src/engine/world/interact/flags';
import { QuestState } from '../src/engine/quest/core';
import { legacyDouble } from './fake/FakeGame';
import type { Animal } from '../src/engine/entities/AnimalView';
import type { AnimalManager } from '../src/engine/entities/AnimalManager';
import type { ShardContext } from '../src/game/plugin/context';
import type { QuestChapter } from '../src/game/quest/chapter';
import { parseQuestLeadPage } from '../src/format/questSteps';
import { ReturnProgram } from '../src/game/population/returnProgram';
import program from '../src/shards/pine-hollow/behaviour/life.generated.json' with { type: 'json' };
import { parseQuestLeadRows } from '../src/shards/pine-hollow/generators/sections';
import leadJson from '../src/shards/pine-hollow/data/questLead.json' with { type: 'json' };
import { hashImmutableBytes } from '../src/sdk/immutable';
import frozen from './fixtures/legacy-oracles/pine-stag-walk.json' with { type: 'json' };

const LEAD = parseQuestLeadRows(leadJson);
const scopes: Scope[] = [];
afterEach(() => { for (const scope of scopes.splice(0)) scope.dispose(); });

function fixture() {
  const effects: string[] = [], scene = new Scene();
  const actor = legacyDouble<Animal>({
    position: new Vector3(), yaw: 0, herd: 0, mesh: new SkinnedMesh(), alive: true, hidden: false, lookTarget: new Vector3(), lookWeight: 0,
    setDrawLod: () => { effects.push('lod'); }, update: () => { effects.push('update'); },
    sampleTerrain: () => { effects.push('terrain'); }, setMotion: (_yaw, speed) => { effects.push(speed > 0 ? 'trot' : 'stop'); },
    place: (x, z, yaw) => { effects.push('place'); actor.position.set(x, 0, z); actor.yaw = yaw; },
  });
  const animals = legacyDouble<AnimalManager>({ animals: [],
    spawn: (_kind, x, z, yaw) => { effects.push('spawn'); actor.position.set(x, 0, z); actor.yaw = yaw; animals.animals.push(actor); scene.add(actor.mesh); return actor; },
    onSound: () => { effects.push('call'); },
  });
  const brain = ReturnProgram.page(program), scope = new Scope('guide-test'), flags = new Flags('guide-test', false);
  scopes.push(scope);
  const quest = new QuestState({ id: 'marsh-guide', title: 'Guide', completeFlag: 'guide:finished',
    steps: [{ id: 'trail', objective: 'Follow', done: { all: ['guide:followed'] } }] }, flags, undefined, scope);
  publishBoundQuest(scope, quest);
  // like the shared chapter host (chapter.ts): its decision rows add the leadStep observation and commit the lead's action channels
  publishBoundChapter(scope, quest.def.id, legacyDouble<QuestChapter>({ quest, project: (signal, input) => {
    const result = brain.project(signal, { ...input, leadStep: Number(quest.current?.id === 'trail') });
    if (result['leadAppear'] === 1) effects.push('first');
    if (result['leadDone'] === 1) { flags.set('guide:followed'); effects.push('done'); }
    return result;
  } }));
  const player = new Vector3(); let night = 1;
  const ctx = { scope } as ShardContext;
  Object.defineProperty(ctx, 'game', { value: { runtime: { world: { player: { position: player }, sky: { dayNight: { get night() { return night; } } } },
    play: { animals, hud: { toast: (text: string) => { effects.push(text); } } } } } });
  const rows = parseQuestLeadPage({ quest: quest.def.id, signal: 'lead',
    actor: { kind: 'marsh-ibex', variant: 'pale' }, path: LEAD.path, motion: { faceTurn: 3, trotSpeed: 4.5, trotTurn: 4, stopTurn: 1 }, sound: 'ibex.call',
    puffs: { color: [1, 1, 1], count: 1, height: 1, appear: [1, 2, 1, 1], fade: [2, 3, 1, 1] } });
  const native = installChapterLead(ctx, { leadPage: rows });
  const lead = { get active() { return native.active; }, get position() { return native.position; }, update: (dt: number, time: number, on: boolean, point: Vector3) => {
    player.copy(point); night = on ? 1 : 0; native.update(dt, time);
    for (const cue of native.takePuffs()) effects.push(cue.kind === 'appear' ? 'appear-puff' : 'fade-puff');
  } };
  return { lead, actor, animals, effects, scope };

}

test('page decisions precede continuous actor integration and retain ordered fade effects', () => {
  const { lead, actor, animals, effects } = fixture(), player = new Vector3(30, 0, -30);
  lead.update(0.1, 1, true, player);
  expect(lead.active).toBe(true); expect(animals.animals).toEqual([]);
  expect(effects.indexOf('first')).toBeLessThan(effects.indexOf('update'));
  expect(effects.indexOf('update')).toBeLessThan(effects.indexOf('stop'));
  effects.length = 0; player.copy(actor.position);
  lead.update(0.1, 1.1, true, player);
  expect(effects).toContain('trot');
  effects.length = 0; lead.update(1.4, 2.5, true, player);
  expect(effects.indexOf('call')).toBeLessThan(effects.indexOf('update'));
  expect(effects).not.toContain('trot');
  expect(effects).toContain('fade-puff');
  expect(actor.mesh.visible).toBe(false);
  effects.length = 0; lead.update(1.2, 3.7, true, player);
  expect(effects.indexOf('place')).toBeLessThan(effects.indexOf('update'));
  expect(effects.indexOf('place')).toBeLessThan(effects.indexOf('appear-puff'));
  effects.length = 0; lead.update(0.1, 3.8, false, player);
  expect(lead.active).toBe(false); expect(actor.alive).toBe(false); expect(actor.hidden).toBe(true);
  expect(effects).not.toContain('update'); expect(effects).not.toContain('done'); expect(effects).not.toContain('call');
});

test('the shared walk completes all bends once and resumes its existing saved fields', () => {
  const { lead, effects } = fixture();
  let t = 0;
  for (const [x, z] of LEAD.path) {
    const player = new Vector3(x, 0, z);
    lead.update(0.1, t += 0.1, true, player);
    lead.update(1.4, t += 1.4, true, player);
    if (lead.active) lead.update(1.2, t += 1.2, true, player);
  }
  expect(lead.active).toBe(false);
  expect(effects.filter(effect => effect === 'spawn')).toHaveLength(1);
  expect(effects.filter(effect => effect === 'call')).toHaveLength(LEAD.path.length);
  expect(effects.filter(effect => effect === 'done')).toHaveLength(1);
  const guest = ReturnProgram.page(program);
  expect(guest.project('lead', { i: 2, mode: 3, elapsed: 0.8, begin: 0, dt: 0.4, leadStep: 1, night: 1, playerX: 0, playerZ: 0, atX: 86, atZ: 16 }))
    .toEqual({ i: 2, mode: 1, elapsed: 0, event: 2, leadAppear: 0, leadDone: 0 });
});

test('v1 lead projections preserve cancellations and old-save suffixes', () => {
  const guest = ReturnProgram.page(program), modes = ['none', 'stare', 'trot', 'gone'] as const;
  // The sealed predecessor's walk, frozen per tick (fixtures/legacy-oracles/pine-stag-walk.json), is the oracle for the original law.
  const cases = frozen.cases[Symbol.iterator]();
  for (const mode of modes) for (const i of [0, 2, LEAD.path.length - 1]) {
    const oracle = cases.next().value;
    if (oracle === undefined) throw new Error('Missing frozen stag case');
    expect({ mode: oracle.mode, i: oracle.i }).toEqual({ mode, i });
    const state = { i, mode: modes.indexOf(mode), elapsed: 0.8 }, seen = { i: '', mode: '', event: '' }, times: number[] = [];
    for (let tick = 0; tick < 800; tick++) {
      const bend = LEAD.path[state.i];
      const player = tick % 173 === 0 ? { x: 300, z: 300 } : { x: bend?.[0] ?? 0, z: bend?.[1] ?? 0 };
      const on = tick % 197 !== 196, dt = tick % 7 === 0 ? 0.4 : 1 / 60;
      // G565: the guest gates itself (its quest step at night); alternate which input closes the gate
      const gate = on ? { leadStep: 1, night: 1 } : tick % 2 === 0 ? { leadStep: 0, night: 1 } : { leadStep: 1, night: 0.5 };
      const { i: nextI, mode: nextMode, elapsed: nextElapsed, ...result } = guest.project('lead', { ...state, begin: 0, dt, ...gate, playerX: player.x, playerZ: player.z, atX: bend?.[0] ?? 0, atZ: bend?.[1] ?? 0 });
      Object.assign(state, { i: nextI, mode: nextMode, elapsed: nextElapsed });
      const kind = result['event'] ?? -1;
      expect(result).toEqual({ event: kind, leadAppear: Number(kind === 1), leadDone: Number(kind === 5) });
      seen.i += String(state.i); seen.mode += String(state.mode); seen.event += String(kind); times.push(state.elapsed);
    }
    expect(seen).toEqual(oracle.steps);
    expect(times.filter((_, at) => at % 50 === 0)).toEqual(oracle.tSamples);
    expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(times)))).toBe(oracle.tSha256);
  }
});

for (const hz of [30, 60, 120]) test(`stag decisions stay at <=10 Hz while the actor integrates at ${hz} Hz`, () => {
  const requests = vi.spyOn(ReturnProgram.prototype, 'project');
  const { lead, actor, effects } = fixture(), player = new Vector3(30, 0, -30);
  for (let frame = 1; frame <= hz; frame++) lead.update(1 / hz, frame / hz, true, player);
  expect(requests.mock.calls.length).toBeGreaterThanOrEqual(8);
  expect(requests.mock.calls.length).toBeLessThanOrEqual(10);
  expect(requests.mock.calls.every(([, input]) => (input['dt'] ?? 0) >= 0.1 && input['begin'] === 0)).toBe(true);
  effects.length = 0;
  for (let frame = 1; frame <= hz; frame++) lead.update(1 / hz, 1 + frame / hz, true, player);
  expect(effects.filter(effect => effect === 'update')).toHaveLength(hz);
  expect(lead.position).toBe(actor.position);
  requests.mockRestore();
});
