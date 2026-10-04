import type { RaidClockPorts } from './raidClock';

/** Facts supplied by the native hunt recipe. The shared AI RNG remains in its existing call order. */
export function raidObservation(raid: RaidClockPorts): Readonly<Record<string, number>> {
  return { raiding: Number(raid.raiding), present: Number(raid.present), tracking: Number(raid.tracking), broken: Number(raid.broken),
    'prey-alive': Number(raid.preyAlive), cracked: Number(raid.cracked), delay: Math.max(0, raid.raidT) };
}
/** Script decisions dispatch native pack/rig/toast recipes; no native timer advances on this path. */
export function publishRaidEvent(raid: RaidClockPorts, key: string, value: number): void {
  if (key === 'raid.try') { raid.start(); return; }
  if (key === 'raid.abandon') { raid.raiding = false; return; }
  if (key !== 'raid.finish' || !Number.isInteger(value) || value < 0 || value > 2) throw new Error('Unknown raid director event');
  raid.raiding = false; raid.raidT = raid.next();
  if (value === 1) raid.taken(); else if (value === 2) raid.drivenOff();
}
