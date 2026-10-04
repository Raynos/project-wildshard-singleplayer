import { directorVariant, installDeclaredDirector } from '@wildshard/game/shardfile/directorClient';
import { director } from '@wildshard/sdk/director';
import declaration from '../data/director.json' with { type: 'json' };
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

/** The game owns admission, fixed stepping and scope. A shared default-off row leaves the shipping raid clock unchanged. */
export async function installRaidDirector(context: Parameters<typeof installDeclaredDirector>[0] & Parameters<typeof directorVariant>[0],
  raid: RaidClockPorts, observePlayer: () => void, seed: number): Promise<boolean> {
  if (!directorVariant(context)) return false;
  await installDeclaredDirector(context, { data: director(declaration), seed, systemId: 'shard.nalati.director',
    bytes: async () => {
      const response = await fetch(new URL('../assets/bd63ceed22276962945fb02af7cd63ee5dab9e954c2ded723c2f3f650a25ed98', import.meta.url));
      if (!response.ok) throw new Error('Missing raid director module');
      return new Uint8Array(await response.arrayBuffer());
    },
    observe: () => { observePlayer(); return raidObservation(raid); }, publish: (event) => { publishRaidEvent(raid, event.key, event.value); },
  });
  return true;
}
