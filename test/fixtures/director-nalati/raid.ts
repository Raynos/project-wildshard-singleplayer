import type { RaidClockPorts } from '../../../src/shards/nalati-grasslands/creatures/raidClock';

/** Shipping legacy raid decisions, extracted verbatim in SF24 so the replay oracle is the code the live path calls. */
export function legacyRaidTick(raid: RaidClockPorts, dt: number): void {
  if (raid.raiding) {
    if (!raid.present) { raid.raiding = false; return; }
    if (raid.pendingT > 0) { raid.pendingT -= dt; if (raid.tracking) raid.pendingT = 0; else if (raid.pendingT > 0) return; }
    if (raid.tracking && !raid.broken) return;
    raid.raiding = false; raid.raidT = raid.next();
    if (!raid.preyAlive) raid.taken();
    else if (raid.broken || raid.cracked) raid.drivenOff();
    return;
  }
  raid.raidT -= dt;
  if (raid.raidT <= 0 && !raid.start()) raid.raidT = 30;
}
