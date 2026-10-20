import { expect, test } from 'vitest';
import { chargePlatformUsers, platformChargeback } from '../scripts/platform-chargebacks.mjs';
import { partitionPendingPlatformUsers, type PendingPlatformUser } from '../scripts/shard-platform.mjs';
import { componentInventory } from '../scripts/shard-components.mjs';

test('optional shared dispatch does not invent another arena or keeper user', () => {
  const arena = 'src/game/boss/arenaScript.ts', phase = 'src/game/plugin/bossPhase.ts';
  const groups = 'src/game/population/pageGroups.ts';
  const both = new Set(['nalati-grasslands', 'pine-hollow']);
  const modules = new Map([[arena, both], [phase, both], [groups, both]]);
  const bindings = new Map([[`${phase}\0ArenaBossScript`, both], [`${phase}\0bossFight`, both],
    [`${groups}\0PageGroups`, both], [`${groups}\0FixedPageSpawnTable`, both]]);
  chargePlatformUsers(modules, bindings);
  expect([...modules.get(arena) ?? []]).toEqual(['nalati-grasslands']);
  expect([...bindings.get(`${phase}\0ArenaBossScript`) ?? []]).toEqual(['nalati-grasslands']);
  expect([...bindings.get(`${groups}\0PageGroups`) ?? []]).toEqual(['nalati-grasslands']);
  expect(bindings.get(`${phase}\0bossFight`)).toEqual(both);
  expect(bindings.get(`${groups}\0FixedPageSpawnTable`)).toEqual(both);
  expect(platformChargeback('src/game/looks/staticCapture.ts', 'StaticCapture')).toBeNull();
  const arms = 'src/game/systems/viewmodel/graphArms.ts';
  const armsUsers = new Map([[arms, both]]);
  chargePlatformUsers(armsUsers, new Map());
  expect([...armsUsers.get(arms) ?? []]).toEqual(['nine-dragon-stack']);
  expect(platformChargeback(arms)).toBe('C6');
  expect(platformChargeback('src/game/systems/viewmodel/rigArms.ts', 'RigArms')).toBeNull();
});

test('day-one feature credit cannot erase a G520 chargeback', () => {
  const path = 'src/game/looks/painterlyLook.ts';
  const allowance: PendingPlatformUser = { module: path, documentation: 'docs/HOST-BAR.md',
    approvedFeature: { name: 'painterly look host', decision: { path: 'docs/plans/shard-platform/decisions.md', row: 'G478' } } };
  const rows = [{ path, name: 'PainterlyWorld', exported: true, lines: 40 },
    { path, name: 'PaintedPanorama', exported: true, lines: 80 }];
  const result = partitionPendingPlatformUsers('nalati-grasslands', [], rows, [allowance]);
  expect(result.exports).toEqual([rows[0]]);
  expect(result.pending.map(row => row.name)).toEqual(['PaintedPanorama']);
  const single = partitionPendingPlatformUsers('nalati-grasslands', [{ path, lines: 200 }], [rows[0]], [allowance]);
  expect(single.exports).toEqual([rows[0]]);
  expect(single.pending.map(row => row.lines)).toEqual([160]);
  const unapproved = partitionPendingPlatformUsers('nalati-grasslands', [{ path, lines: 200 }], [rows[0]], []);
  expect(unapproved.modules).toEqual([{ path, lines: 200 }]);
  expect(unapproved.exports).toEqual([]);
});

test('chargebacks retain their exact component and include creature schemas', () => {
  const sources = [
    { path: 'src/format/creatureGuest.ts', kind: 'sole-module', lines: 14 },
    { path: 'src/game/riding/pastureView.ts', kind: 'sole-module', lines: 27 },
    { path: 'src/game/looks/painterlyLook.ts', name: 'PainterlyWorld', kind: 'sole-export', lines: 40 },
  ] as const;
  const inventory = componentInventory('.', 'nalati-grasslands', [...sources], 81);
  expect(inventory.counts.C4).toBe(14);
  expect(inventory.counts.C7).toBe(27);
  expect(inventory.counts.C2).toBe(40);
  expect(inventory.unknown).toEqual([]);
});
