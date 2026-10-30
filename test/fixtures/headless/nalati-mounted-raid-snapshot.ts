// oxlint-disable-next-line import/no-nodejs-modules -- Prove the writer owns a genuinely earned native checkpoint.
import assert from 'node:assert/strict';
import { earnNalatiMountedRaid } from './nalati-mounted-raid';
import { nativePopulationOf } from '../../../src/game/riding/nativePopulation';

const earned = await earnNalatiMountedRaid();
try {
  assert.equal(earned.mount.mounted, true);
  assert.equal(nativePopulationOf(earned.resident.host)?.raid.raids, 1);
  assert.ok(earned.pack.members.length > 0);
  assert.equal(earned.ridden.hp, earned.riddenHealth);
  console.info(JSON.stringify({ fixture: 'nalati-mounted-raid', tick: earned.resident.host.state.tick,
    horse: earned.ridden.entityId, raiders: earned.pack.members.length }));
} finally { earned.resident.dispose(); }
