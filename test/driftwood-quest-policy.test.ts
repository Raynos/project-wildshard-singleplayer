import { expect, test } from 'vitest';
import { createQuestPlacements } from '../src/engine/world/interact/types';
import frames from '../src/shards/driftwood-isle/data/questFrames.json' with { type: 'json' };
import policy from '../src/shards/driftwood-isle/data/nativeQuest.json' with { type: 'json' };
import { HUT, LOOKOUT, WRECK, SHRINE, PIER } from '../src/shards/driftwood-isle/world/sites';
import { islandCoveSpec } from '../src/shards/driftwood-isle/generators/coveLayout';
import { DRIFTWOOD_INTERACT } from '../src/shards/driftwood-isle/data/interactables';
import { DRIFTWOOD_PLACES } from '../src/shards/driftwood-isle/data/discovery';

const cave = islandCoveSpec().cave;
const nativeFrames = { hut: HUT, lookout: LOOKOUT, shrine: SHRINE,
  wreck: { x: WRECK.x, z: WRECK.z, rot: WRECK.heading },
  cave: { x: cave.x, z: cave.z, rot: cave.yaw }, pier: { x: PIER.x, z: PIER.z, rot: 0 } };

test('authored quest frames retain all six native site origins and rotations', () => {
  expect(frames).toEqual(nativeFrames);
  const terrain = (x: number, z: number): number => x * .01 + z * .02;
  const before = createQuestPlacements({ terrain, frames: nativeFrames });
  const after = createQuestPlacements({ terrain, frames });
  for (const row of [...DRIFTWOOD_INTERACT.rows, ...DRIFTWOOD_PLACES]) expect(after.place(row.at)).toEqual(before.place(row.at));
  before.setAnchor('hut.npc', { x: 1, y: 2, z: 3, yaw: .4 });
  after.setAnchor('hut.npc', { x: 1, y: 2, z: 3, yaw: .4 });
  expect(after.place({ poi: 'hut', anchor: 'hut.npc', x: 2.4, z: -8.2 })).toEqual(before.place({ poi: 'hut', anchor: 'hut.npc', x: 2.4, z: -8.2 }));
});

test('native quest content retains command ABI, save adapter key and contact thresholds', () => {
  expect(policy).toEqual({ actor: 'driftwood.interact', actions: { talk: 0, sword: 1, zipline: 2, row: 100 },
    step: 'driftwood.quest', rewardFlag: 'seen:reward', touch: { radius: 1.1, height: 2.2 }, plate: { inset: .1, depth: .1 },
    talkRadius: 3.2, swordRadius: 2.6, limits: { rows: 64 }, barrelOwner: { kind: 'barrel', id: 'tide-barrel' } });
});
