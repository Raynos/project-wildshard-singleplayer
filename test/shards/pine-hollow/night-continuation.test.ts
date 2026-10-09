// oxlint-disable-next-line import/no-nodejs-modules -- Fence the unchanged shipping night scheduler's exact source.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Hash the unchanged gameplay methods independently of new continuation methods.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { Rng } from '../../../src/engine/core/rng';
import { NightBrain, type NightActor, type NightSpec } from '../../../src/shards/pine-hollow/quest/nightBrain';
import { OLD_GROWTH, KINGS_CLEARING, HAMLET_SITES, POND } from '../../../src/shards/pine-hollow/layout';

interface Actor extends NightActor { id: string; motion: { yaw: number; speed: number; turn: number }; controlled: boolean }
const spec: NightSpec = { max: 3, region: OLD_GROWTH, exclude: KINGS_CLEARING, face: HAMLET_SITES.wheel,
  mill: HAMLET_SITES.mill, water: POND.level, roamKinds: ['elk', 'boar'],
  race: [{ kind: 'boar', x: -189, z: -134 }, { kind: 'elk', x: -194, z: -148 }, { kind: 'boar', x: -198, z: -160 }] };
function setup() {
  const rng = new Rng(17), actors = new Map<string, Actor>(), events: unknown[] = [];
  const state = { next: 0, night: 1, errand: true };
  const actor = (id: string, x: number, z: number): Actor => {
    const motion = { yaw: 0, speed: 0, turn: 0 };
    return { id, position: { x, y: 2, z }, alive: true, hp: 100, maxHp: 100, lookWeight: 1, controlled: false, motion,
      setMotion: (yaw, speed, turn) => { Object.assign(motion, { yaw, speed, turn }); } };
  };
  const brain = new NightBrain<Actor>({ night: () => state.night, errand: () => state.errand,
    onErrandDone: () => { state.errand = false; events.push(['done']); }, next: () => rng.next(), height: () => 2,
    shot: (name, a) => { events.push(['shot', name, a.id]); },
    spawn: (kind, x, z, yaw) => { const a = actor(`night:${state.next++}`, x, z); actors.set(a.id, a); events.push(['spawn', kind, a.id, x, z, yaw]); return a; },
    own: a => { a.controlled = true; events.push(['own', a.id]); }, release: a => { a.controlled = false; events.push(['release', a.id]); },
    retire: a => { actors.delete(a.id); events.push(['retire', a.id]); }, burst: a => { events.push(['burst', a.id]); },
  }, spec);
  const snapshot = () => ({ brain: brain.snapshot(a => a.id), rng: rng.snapshot(), state: { ...state },
    actors: [...actors.values()].map(a => ({ id: a.id, position: { ...a.position }, alive: a.alive, hp: a.hp,
      maxHp: a.maxHp, lookWeight: a.lookWeight, controlled: a.controlled, motion: { ...a.motion } })) });
  const restore = (saved: ReturnType<typeof snapshot>): void => {
    actors.clear();
    for (const entry of saved.actors) {
      const a = actor(entry.id, entry.position.x, entry.position.z);
      Object.assign(a, { alive: entry.alive, hp: entry.hp, maxHp: entry.maxHp, lookWeight: entry.lookWeight, controlled: entry.controlled });
      Object.assign(a.position, entry.position); Object.assign(a.motion, entry.motion); actors.set(a.id, a);
    }
    rng.restore(saved.rng); Object.assign(state, saved.state);
    brain.prepareRestore(saved.brain, id => actors.get(id) ?? null)();
  };
  return { brain, state, actors, events, snapshot, restore };
}

it('preserves the shipping population update, placement and race arithmetic unchanged', () => {
  const source = readFileSync('src/shards/pine-hollow/quest/nightBrain.ts', 'utf8');
  const start = source.indexOf('  /** the roamers'), end = source.indexOf('  /** Actors belong');
  expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
  expect(createHash('sha256').update(source.slice(start, end).trimEnd()).digest('hex')).toBe('efa52104801da3412442541ded2c4c013fda25610664458c32833b9c656aa046');
});

it('restores every night population clock and identity silently through 10000 mixed roam/race/dawn ticks', () => {
  const original = setup(), resumed = setup(); resumed.restore(original.snapshot());
  for (let tick = 0; tick < 10_000; tick++) {
    const centre = tick % 1700 < 1100 ? OLD_GROWTH : HAMLET_SITES.mill;
    const feet = { x: centre.x + tick % 7, y: 2, z: centre.z + tick % 11 };
    for (const world of [original, resumed]) {
      world.state.night = tick % 1300 < 950 ? 1 : 0;
      if (tick % 2000 === 0) world.state.errand = true;
      if (tick % 101 === 0) {
        const a = [...world.actors.values()].find(candidate => candidate.alive);
        if (a !== undefined) { a.hp = 0; a.alive = false; }
      }
      world.brain.update(1 / 60, feet);
    }
    expect(resumed.snapshot()).toEqual(original.snapshot()); expect(resumed.events).toEqual(original.events);
    if (tick % 179 === 0) {
      const before = resumed.events.length; resumed.restore(original.snapshot()); expect(resumed.events).toHaveLength(before);
    }
  }
  expect(original.events.some(event => JSON.stringify(event).includes('spawn'))).toBe(true);
  expect(original.events.some(event => JSON.stringify(event).includes('retire'))).toBe(true);
  expect(original.events.some(event => JSON.stringify(event).includes('release'))).toBe(true);
});

it('refuses missing, aliased, duplicate and out-of-contract actors before mutation or effects', () => {
  const world = setup(), feet = { ...HAMLET_SITES.mill, y: 2 };
  world.brain.update(1, feet); const before = world.snapshot(), count = world.events.length;
  const saved = before.brain;
  expect(saved.race).toHaveLength(3);
  const bad = [{ ...saved, version: 2 }, { ...saved, spec: 'changed' }, { ...saved, acc: 1 },
    { ...saved, acc: Number.NaN }, { ...saved, race: saved.race.slice(1) },
    { ...saved, race: saved.race.map(row => ({ ...row, id: saved.race[0]?.id ?? '' })) },
    { ...saved, roam: [{ id: 'missing', flee: 0 }] }, { ...saved, roam: [{ id: 'missing', flee: 3.6 }] }];
  for (const value of bad) {
    expect(() => world.brain.prepareRestore(value, id => world.actors.get(id) ?? null)).toThrow();
    expect(world.snapshot()).toEqual(before); expect(world.events).toHaveLength(count);
  }
  const one = world.actors.values().next().value;
  if (one === undefined) throw new Error('Missing race');
  expect(() => world.brain.prepareRestore(saved, () => one)).toThrow('Aliased Pine night actors');
  expect(world.snapshot()).toEqual(before); expect(world.events).toHaveLength(count);
});
