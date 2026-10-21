import { expect, test } from 'vitest';
import { Rng } from '../src/engine/core/rng';
import { createCreatureSpawner } from '../src/game/plugin/brain';
import { PageActorGroups } from '../src/game/population/pageGroups';
import { ReturnGate } from '../src/game/population/respawn';
import { manager as realManager } from './fake/manager';
import { speciesDef } from '../src/engine/entities/species/registry';
import { Scope } from '../src/engine/app/scope';
import program from '../src/shards/driftwood-isle/behaviour/returns.generated.json';
import { overrideTerrain } from './fake/terrain';

test('materializes ordered groups through the manager and retires only owned actors', () => {
  interface Actor { herd: number; kind: string; pose: number[]; roll: number }
  const herds: { members: Actor[] }[] = [{ members: [] }], actors: Actor[] = [], retired: Actor[] = [], order: string[] = [];
  const rng = new Rng(29), control = new Rng(29);
  const manager = {
    herds,
    addHerd: (kind: string, x: number, z: number): number => { order.push(`herd:${kind}:${x}:${z}`); herds.push({ members: [] }); return herds.length - 1; },
    spawn: (kind: string, x: number, z: number, yaw: number, variant?: string): Actor => {
      order.push(`spawn:${variant ?? kind}`); const actor = { herd: -1, kind, pose: [x, z, yaw], roll: rng.next() }; actors.push(actor); return actor;
    },
    retire: (actor: Actor): void => { retired.push(actor); },
  };
  const foreign = manager.spawn('foreign', 0, 0, 0), spawner = createCreatureSpawner(manager);
  control.next(); order.length = 0;
  const centres = [{ x: 3, z: 4 }, { x: 8, z: 9 }], kinds = ['crab', 'monkey'];
  const rows = [{ kind: 'monkey', x: 8, z: 9, yaw: .8, variant: null, herd: 1 },
    { kind: 'crab', x: 3, z: 4, yaw: .2, variant: 'small', herd: 0 },
    { kind: 'sailor', x: 0, z: 0, yaw: 1, variant: 'sailor', herd: -1 }];
  for (const invalid of [[{ ...rows[0], kind: 'monkey', x: 8, z: 9, yaw: .8, variant: null, herd: 9 }],
    [{ kind: 'crab', x: Infinity, z: 4, yaw: 0, variant: null, herd: 0 }]]) {
    expect(() => spawner.place(centres, kinds, invalid)).toThrow('placement'); expect(order).toEqual([]);
  }
  spawner.place(centres, kinds, rows, (actor, row) => {
    expect(herds[actor.herd]?.members).toContain(actor); expect(actor.pose).toEqual([row.x, row.z, row.yaw]);
    expect(actor.roll).toBe(control.next()); order.push(`join:${row.kind}`);
  }, kind => { order.push(`group:${kind}`); });
  expect(order).toEqual(['herd:crab:3:4', 'spawn:small', 'join:crab', 'group:crab', 'herd:monkey:8:9', 'spawn:monkey', 'join:monkey', 'group:monkey']);
  expect(actors.some(actor => actor.kind === 'sailor')).toBe(false);
  const sailor = spawner.spawn('sailor', 0, 0, 1, 'sailor'); expect(sailor.herd).toBe(-1); control.next();
  expect(rng.next()).toBe(control.next());
  spawner.dispose(); spawner.dispose();
  expect(retired).toEqual(actors.filter(actor => actor !== foreign));
  expect(() => spawner.spawn('crab', 0, 0, 0)).toThrow('disposed');
  expect(() => spawner.group('crab', { x: 0, z: 0 }, [])).toThrow();
});

test('salt-marsh page rows retain actual AI, herd order, training refills and ownership', () => {
  const restore = overrideTerrain({ heightAt: () => 0, normalAt: () => [0, 1, 0], waterLevel: () => -100 });
  const scope = new Scope('marsh.groups'), fixture = realManager(), animals = fixture.manager;
  const groups = new PageActorGroups(animals, { program, law: { signal: 'practice', initial: { dead: 0 }, parameters: { delay: 2, away: 5 }, retain: { dead: 'dead' } } }, scope), variant = speciesDef('boar').variants[0]?.id;
  if (variant === undefined) throw new Error('Missing fixture species');
  const foreign = animals.spawn('boar', -10, -10, 0, variant);
  try {
    const row = { kind: 'boar', variant, x: 3, z: 4, yaw: .2, herd: 0, practice: true } as const;
    groups.place([{ x: 3, z: 4 }], ['boar'], [row]);
    const actor = groups.practice; if (actor === null) throw new Error('Missing training body');
    expect(actor.scripted).toBe(false); expect(animals.herds[actor.herd]?.members).toContain(actor);
    expect(groups.count('boar')).toBe(1); expect(groups.count('boar', true)).toBe(1);
    actor.alive = false;
    groups.updatePractice(2, { x: 3, z: 4 }); expect(groups.practice).toBe(actor);
    groups.updatePractice(.1, { x: 8, z: 4 }); expect(actor.hidden).toBe(false);
    actor.hidden = true; groups.updatePractice(.1, { x: 8, z: 4 });
    const replacement = groups.practice;
    expect(replacement).not.toBe(actor); expect(replacement?.scripted).toBe(false);
    expect(replacement?.entityId).not.toBe(actor.entityId); expect(groups.count('boar')).toBe(2);
    expect(animals.animals).toContain(actor); // the old fading shell remains until the owning manager retires it
    groups.dispose(); groups.dispose(); expect(animals.animals).toEqual([foreign]);
  } finally { groups.dispose(); animals.retire(foreign); restore(); scope.dispose(); }
});

test('native corpse gates keep the original fade clock while the player returns near', () => {
  const state = { dead: 0, fade: -1 }, row = { delay: 2, away: 5, fade: 1.5 };
  expect(ReturnGate.step(state, row, 1, true, 10)).toBe('none'); expect(state.dead).toBe(0);
  expect(ReturnGate.step(state, row, 2, false, 5)).toBe('fade'); expect(state).toEqual({ dead: 2, fade: 0 });
  expect(ReturnGate.step(state, row, 1.5, false, 4)).toBe('none'); expect(state.fade).toBe(1.5);
  expect(ReturnGate.step(state, row, 0, false, 5)).toBe('replace');
});
