import { expect, test } from 'vitest';
import type { ActRoutes } from '../src/engine/shared/sim/actRoutes';
import { netInteractCommands } from '../src/sdk/standalone/netInput';

const routes = (rows: readonly [string, number][]): ActRoutes => ({ interactions: new Map(rows.map(([id, value]) => [id, { actorId: 'quest', value }])), claims: new Map(), seen: null, refused: 0 }) as unknown as ActRoutes;
const press = (id: string): readonly { kind: 'interact'; seq: number; id: string }[] => [{ kind: 'interact', seq: 1, id }];

test('a page names a person, and a quest with one person calls that row talk', () => {
  expect(netInteractCommands(routes([['talk', 3]]), press('far.keeper.talk'), 'p')).toEqual([{ kind: 'script', actorId: 'quest', value: 3, playerId: 'p' }]);
});
test('a person with their own row keeps it, and no other id falls through to talk', () => {
  const both = routes([['talk', 3], ['castaway.talk', 7]]);
  expect(netInteractCommands(both, press('castaway.talk'), 'p')).toEqual([{ kind: 'script', actorId: 'quest', value: 7, playerId: 'p' }]);
  expect(netInteractCommands(both, press('logbook'), 'p')).toEqual([]);
  expect(both.refused).toBe(1);
});
