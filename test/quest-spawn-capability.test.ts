import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { Flags } from '../src/engine/world/interact/flags';
import { QuestState } from '../src/engine/quest/core';
import type { AnimalManager } from '../src/engine/entities/AnimalManager';
import type { DeclaredSoundBank } from '../src/engine/audio/declaredBank';
import type { ShardContext } from '../src/game/plugin/context';
import type { ShardProduct } from '../src/game/shardfile/shardProduct';
import type { QuestPageComposition } from '../src/game/quest/pageComposition';
import { publishEntryOwner } from '../src/game/shardfile/entryOwners';
import { publishBoundQuest } from '../src/game/quest/boundState';
import { installDeclaredQuestSpawns, type QuestSpawnCapability } from '../src/game/quest/chapterDirector';
import * as spawn from '../src/game/population/spawnScript';
import { compileDecisionScripts } from '../src/sdk/buildDecisionScripts';
import { parseSpawnScript, spawnScriptRegistries, type SpawnScriptRows } from '../src/format/spawnScripts';
import { legacyDouble } from './fake/FakeGame';

let program: SpawnScriptRows | undefined;
beforeAll(async () => {
  const rows = parseSpawnScript({ step: 'marsh.spawn', roster: 'marsh.animals', seed: 17, maximum: 4, controlState: 'sidestep', bytes: '',
    slots: [{ id: 'bird', handle: 1 }], species: [{ id: 'bird', kind: 'heron', variant: 'reed' }],
    sites: [{ id: 'nest', slot: 'bird', point: [3, 4], face: 'player' }], spawns: [{ id: 'bird', species: 'bird', site: 'nest' }],
    fields: [], flags: ['done:watch'], cues: ['puff', 'sound'], channels: ['count'], moves: [],
    script: { id: 'marsh.spawn', abi: '1.0', side: 'sim', module: `blobs/wasm/${'0'.repeat(64)}.wasm`, source: 'behaviour/marsh.as',
      binding: { shard: true }, pages: 1, onFail: 'hold', tick: 10, on: ['tick'], reads: ['flag'], commands: ['flag', 'cue', 'channel'],
      stateVersion: 1, state: [], params: {}, flags: { done: 'done:watch' }, cues: { puff: 'puff', sound: 'sound' }, channels: { count: 'count' } } });
  const built = await compileDecisionScripts([rows.script], spawnScriptRegistries(rows), new Map([['behaviour/marsh.as',
    "import {Read,Do,Flag,Cue,Channel} from './generated/marshSpawn';\nexport function onTick(dt:f64):void{Do.channel(Channel.count,1);if(!Read.flag(Flag.done)){Do.flag(Flag.done,true);Do.cue(Cue.puff);Do.cue(Cue.sound);}}"]]), { asLineCeiling: 10 });
  const script = built.rows[0], blob = built.blobs[0];
  if (script === undefined || blob === undefined) throw new Error('Missing fixture guest');
  program = parseSpawnScript({ ...rows, script, bytes: btoa(String.fromCodePoint(...blob.bytes)) });
});
const scopes: Scope[] = [];
afterEach(() => { scopes.splice(0).forEach(scope => { scope.dispose(); }); vi.restoreAllMocks(); });
function fixture(omit?: 'quest' | 'animals' | 'sounds') {
  if (program === undefined) throw new Error('Missing compiled fixture guest');
  const source = program, scope = new Scope('marsh.spawns'), flags = new Flags('marsh.spawns', false), events: string[] = [];
  scopes.push(scope);
  const quest = new QuestState({ id: 'marsh.watch', title: 'The watch', completeFlag: 'seen:watch',
    steps: [{ id: 'watch', objective: 'Wait', done: { all: ['done:watch'] } }] }, flags, undefined, scope);
  publishBoundQuest(scope, quest);
  flags.onChange(flag => { if (flag === 'done:watch') events.push('flag'); });
  const rows = { quest: quest.def.id, script: source.step, channel: 1, limit: { phone: 2, desktop: 4 },
    complete: [{ flag: 'done:watch', effects: [{ kind: 'flag', flag: 'done:watch' }, { kind: 'toast', text: 'complete' }] }],
    cues: [{ kind: 'puff', id: 1 }, { kind: 'sound', id: 2, name: 'marsh.call' }],
    puffs: { color: [1, 1, 1], count: 2, height: .5, burst: [1, 2, .4, .6] } };
  const section = vi.fn(); section.mockReturnValue({ spawns: rows });
  const product = legacyDouble<ShardProduct>({ section }), ctx = legacyDouble<ShardContext>({ scope, product });
  Object.defineProperty(ctx, 'game', { value: { runtime: { world: { sky: { dayNight: { night: 1 } } }, play: {
    hud: { toast: (text: string) => { events.push(text); } }, inventory: { add: () => undefined, take: () => false }, music: { sting: () => undefined },
  } } } });
  const animals = legacyDouble<AnimalManager>({ animals: [] });
  const bank = legacyDouble<DeclaredSoundBank>({ acceptsShot: name => name === 'marsh.call', shot: () => { events.push('sound'); return true; } });
  if (omit !== 'quest') publishEntryOwner(scope, 'quest', 'marsh.quest', legacyDouble<QuestPageComposition>({ flags }));
  if (omit !== 'animals') publishEntryOwner(scope, 'animals', 'marsh.animals', animals);
  if (omit !== 'sounds') publishEntryOwner(scope, 'sounds', 'marsh.sounds', bank);
  const capability: QuestSpawnCapability = { id: 'marsh.spawns', source: 'custom/marsh', quest: 'marsh.quest', animals: 'marsh.animals', sounds: 'marsh.sounds' };
  const read = vi.spyOn(spawn, 'readSpawnScript').mockResolvedValue(source);
  return { ctx, scope, quest, flags, events, capability, read, source };
}
for (const kind of ['quest', 'animals', 'sounds'] as const) test(`declared spawn capability refuses a missing ${kind} loan before guest admission`, async () => {
  const f = fixture(kind);
  await expect(installDeclaredQuestSpawns(f.ctx, f.capability)).rejects.toThrow('Missing live entry owner');
  expect(f.read).not.toHaveBeenCalled(); expect(f.events).toEqual([]);
});
test('declared spawn effects retain completion-before-cues order and stop with their owner', async () => {
  const f = fixture(), result = await installDeclaredQuestSpawns(f.ctx, f.capability);
  // Decisions stage at tick 6 and commit on the next native tick.
  result.update(7 / 60, new Vector3(3, 2, 4));
  expect(f.events).toEqual(['flag', 'complete', 'sound']); expect(result.count).toBe(1);
  expect(result.takePuffs()).toEqual([{ x: 0, y: 0, z: 0 }]);
  result.update(.1, new Vector3()); expect(f.events).toEqual(['flag', 'complete', 'sound']);
  f.flags.clear('done:watch'); result.update(.1, new Vector3());
  const before = [...f.events]; f.scope.dispose(); result.force(); result.update(.1, new Vector3());
  expect(result.takePuffs()).toEqual([]); expect(f.events).toEqual(before);
});
test('restored quest flags and v1 envelope stay quiet during capability construction', async () => {
  const f = fixture(); f.flags.restore(['done:watch']);
  const saved: ReturnType<QuestState['snapshot']> = { version: 1, id: f.quest.def.id, started: true, currentId: null };
  f.quest.restore(saved); const flags = f.flags.all;
  const result = await installDeclaredQuestSpawns(f.ctx, f.capability);
  expect(f.quest.snapshot()).toEqual(saved); expect(f.flags.all).toEqual(flags); expect(f.events).toEqual([]);
  result.update(.1, new Vector3()); expect(result.takePuffs()).toEqual([]); expect(f.events).toEqual([]);
});
test('leaving during admitted byte read constructs no guest or publication', async () => {
  const f = fixture(); let finish: ((value: SpawnScriptRows) => void) | undefined;
  f.read.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const page = vi.spyOn(spawn.SpawnScript, 'page'), pending = installDeclaredQuestSpawns(f.ctx, f.capability);
  const refusal = expect(pending).rejects.toThrow('Quest left during spawn director admission');
  f.scope.dispose(); if (finish === undefined) throw new Error('Missing pending admission'); finish(f.source);
  await refusal; expect(page).not.toHaveBeenCalled(); expect(f.events).toEqual([]);
});
