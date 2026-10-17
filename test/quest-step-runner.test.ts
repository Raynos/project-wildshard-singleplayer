import { expect, test } from 'vitest';
import { Flags } from '../src/engine/world/interact/flags';
import { QuestStepRunner } from '../src/game/quest/steps';
import { QuestLeadWalk } from '../src/game/quest/lead';
import { QuestHintFeed } from '../src/game/quest/hints';
import type { Actor } from '../src/engine/combat/pipeline';
import type { HintTrigger, HintControl } from '../src/engine/ui/FirstHints';
import { parseQuestStepRows } from '../src/format/questSteps';
import pine from '../src/shards/pine-hollow/data/questSteps.json' with { type: 'json' };
import driftwood from '../src/shards/driftwood-isle/data/questSteps.json' with { type: 'json' };

// Made-up third shard: every supported step type driven through declared owners, without either shard's names.
const fixture = {
  version: 1, guards: [], steps: [
    { id: 'arrive', kind: 'go-to', at: { x: 2, z: 3 }, radius: 2, once: 'arrived', effects: [{ kind: 'flag', flag: 'at-town' }] },
    { id: 'hello', kind: 'talk', target: 'smith', when: { all: ['at-town'] }, effects: [{ kind: 'flag', flag: 'met' }] },
    { id: 'defeat', kind: 'kill', target: 'bandit', effects: [{ kind: 'flag', flag: 'safe' }] },
    { id: 'pick', kind: 'collect', target: 'ore', once: 'picked', effects: [{ kind: 'item', item: 'ore', count: 2 }] },
    { id: 'give', kind: 'deliver', target: 'smith', once: 'paid', effects: [{ kind: 'call', owner: 'reward' }] },
    { id: 'lead', kind: 'lead', target: 'mule', effects: [{ kind: 'flag', flag: 'led' }] },
    { id: 'follow', kind: 'follow', target: 'guide', effects: [{ kind: 'flag', flag: 'followed' }] },
    { id: 'rest', kind: 'wait', seconds: 2, when: { all: ['met'] }, once: 'rested', effects: [{ kind: 'notice', text: 'Ready' }] },
    { id: 'gate', kind: 'interact', target: 'gate', when: { all: ['rested'] }, effects: [{ kind: 'flag', flag: 'done' }] },
  ],
};
test('a made-up shard runs all step kinds through borrowed owners and resumes waits silently', () => {
  const flags = new Flags('copper-town', false), order: string[] = []; let ore = 0;
  const runner = new QuestStepRunner(fixture, { flags, position: () => ({ x: 2, z: 3 }), notice: text => { order.push(text); },
    inventory: { add: (_id, n) => { ore += n; }, take: (_id, n) => { if (ore < n) return false; ore -= n; return true; } },
    deliver: new Map([['smith', { item: 'ore', count: 2 }]]), calls: new Map([['reward', () => { order.push('reward'); }]]) });
  runner.signal({ kind: 'talk', target: 'smith' }); expect(flags.has('met')).toBe(false);
  runner.update(0); runner.signal({ kind: 'talk', target: 'smith' });
  runner.signal({ kind: 'deliver', target: 'smith' }); expect(flags.has('paid')).toBe(false);
  for (let n = 0; n < 2; n++) runner.signal({ kind: 'collect', target: 'ore' });
  expect(ore).toBe(2);
  for (let n = 0; n < 2; n++) runner.signal({ kind: 'deliver', target: 'smith' });
  expect(ore).toBe(0); expect(order).toEqual(['reward']);
  runner.signal({ kind: 'kill', target: 'bandit' }); runner.signal({ kind: 'lead', target: 'mule' }); runner.signal({ kind: 'follow', target: 'guide' });
  runner.update(1); const saved = runner.snapshot(); runner.update(0.5); runner.restore(saved);
  expect(order).toEqual(['reward']); runner.update(1); runner.update(10);
  expect(order).toEqual(['reward', 'Ready']);
  runner.signal({ kind: 'interact', target: 'gate' });
  expect(['arrived', 'met', 'safe', 'paid', 'led', 'followed', 'rested', 'done'].every(flag => flags.has(flag))).toBe(true);
  const before = runner.snapshot(); expect(() => runner.restore({ rest: -1 })).toThrow(); expect(runner.snapshot()).toEqual(before);
  expect(() => runner.update(Number.NaN)).toThrow();
});

test('Pine payment order and Driftwood live guards retain their old save flags', () => {
  const flags = new Flags('seams', false), grants: string[] = []; let shops = 0;
  const runner = new QuestStepRunner(pine, { flags, inventory: { add: (id, n) => { grants.push(`${id}:${n}`); }, take: () => false },
    calls: new Map([['trader', () => { shops++; }]]) });
  flags.set('errand:thanked'); runner.signal({ kind: 'talk', target: 'miller' }); runner.signal({ kind: 'talk', target: 'miller' });
  expect(flags.has('errand:paid')).toBe(true); expect(grants).toEqual(['lodge-ribbon:3', 'amber-resin:4']);
  runner.signal({ kind: 'talk', target: 'trader' }); expect(shops).toBe(1);
  runner.signal({ kind: 'follow', target: 'stag' }); expect(flags.has('followed:stag')).toBe(true);
  const actors = [{ kind: 'sailor', alive: true }];
  const guarded = new QuestStepRunner(driftwood, { flags, actors: () => actors });
  flags.set('dead:sailor'); expect(guarded.guard('iron-sword')).toBe('The drowned sailor guards the rack');
  const first = actors[0]; if (first === undefined) throw new Error('Missing actor'); first.alive = false;
  expect(guarded.guard('iron-sword')).toBeNull(); first.alive = true; expect(guarded.guard('iron-sword')).not.toBeNull();
  const fallback = new QuestStepRunner(driftwood, { flags, actors: () => undefined }); expect(fallback.guard('iron-sword')).toBeNull();
  const roster = { animals: actors }, borrowed = new QuestStepRunner(driftwood, { flags, actors: new Map([['actors', roster]]) });
  expect(borrowed.guard('iron-sword')).not.toBeNull(); roster.animals = []; expect(borrowed.guard('iron-sword')).toBeNull();
});

test('missing seams and duplicate rows refuse before effects or inventory writes', () => {
  const flags = new Flags('refused', false);
  expect(() => new QuestStepRunner(fixture, { flags })).toThrow();
  expect(() => parseQuestStepRows({ version: 1, guards: [], steps: [fixture.steps[0], fixture.steps[0]] })).toThrow();
  expect(() => new QuestStepRunner({ version: 1, guards: [], steps: [{ id: 'call', kind: 'talk', effects: [{ kind: 'call', owner: 'missing' }] }] }, { flags })).toThrow();
  expect(flags.all).toEqual([]);
});

test('a made-up lead resumes the exact legacy envelope and completes its own path', () => {
  const rows = { path: [[1, 2], [3, 4]], near: 1, first: 4, trot: 0.2, gone: 0.1, past: 2 };
  const lead = new QuestLeadWalk(rows);
  lead.load({ i: 1, mode: 'gone', t: 0.09 });
  expect(JSON.stringify(lead.save())).toBe('{"i":1,"mode":"gone","t":0.09}');
  expect(lead.step(0.02, true, { x: 3, z: 4 })).toEqual({ kind: 'appear', first: false });
  lead.step(0.01, true, { x: 3, z: 4 }); expect(lead.step(0.21, true, { x: 3, z: 4 })).toEqual({ kind: 'vanish', done: true });
  const before = lead.save(); expect(() => lead.load({ i: 3, mode: 'gone', t: 0 })).toThrow(); expect(lead.save()).toEqual(before);
});

test('made-up onboarding rows keep priority, live actor scans and existing learned controls', () => {
  const rows = { hostile: ['bandit'], scanEvery: 0.1, maxScan: 2, windupRadius: 8, hints: [
    { control: 'dodge', when: [{ kind: 'windup', seconds: 1 }] },
    { control: 'attack', when: [{ kind: 'nearest', relation: 'lt', radius: 4 }] },
    { control: 'lock', when: [{ kind: 'done', control: 'attack' }, { kind: 'lockable' }] },
    { control: 'use', when: [{ kind: 'prompt', contains: 'Speak' }], touch: 'Speak', desk: 'Use' },
    { control: 'move', when: [] },
    { control: 'jump', when: [{ kind: 'done', control: 'move' }, { kind: 'walked', metres: 5 }, { kind: 'nearest', relation: 'gt', radius: 8 }] },
  ], system: { id: 'copper-tutorial', after: [], before: [] } };
  const actor: Actor = { id: 'bandit', tags: [], state: [], attributes: { health: 10, maxHealth: 10 }, alive: true, applyDamage: () => false };
  const body = { kind: 'bandit', alive: true, hidden: false, position: { x: 3, z: 0 }, combatActor: () => actor };
  const learned = new Set<HintControl>(); let triggers: HintTrigger[] = [], prompt = '';
  const hints = { distance: 6, done: (control: HintControl) => learned.has(control), feed: (value: HintTrigger[]) => { triggers = value; } };
  const feed = new QuestHintFeed(rows, { hints, animals: () => [body], player: { position: { x: 0, z: 0 } }, prompt: () => prompt }, { state: 'available' });
  const shown = (): string[] => triggers.filter(row => row.when()).map(row => row.control);
  expect(triggers.map(row => row.control)).toEqual(['dodge', 'attack', 'lock', 'use', 'move', 'jump']);
  feed.update(0); expect(shown()).toEqual(['attack', 'move']);
  feed.windup(actor); expect(shown()[0]).toBe('dodge');
  learned.add('attack'); prompt = 'Speak to the smith';
  expect(shown()).toEqual(['dodge', 'attack', 'lock', 'use', 'move']);
  expect(triggers.find(row => row.control === 'use')?.touch).toBe('Speak');
  feed.update(1); expect(shown()).not.toContain('dodge');
  body.hidden = true; learned.add('move'); feed.update(0.1);
  expect(shown()).toContain('jump'); expect(shown()).not.toContain('attack');
  expect([...learned]).toEqual(['attack', 'move']);
});
