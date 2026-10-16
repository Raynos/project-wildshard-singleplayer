import { expect, test } from 'vitest';
import { Rng } from '../src/engine/core/rng';
import { createCreatureSpawner } from '../src/game/plugin/brain';

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
