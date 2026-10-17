import { createAchievementCounters, type AchievementCounters, type AchievementCounterPorts, type AchievementCounterRows } from '@wildshard/game/achievements';

/** Gameplay submits the same bounded outcomes in the page and renderer-free host. */
export type PineFacts = Pick<AchievementCounters, 'kill' | 'event' | 'syncFlags'>;
/** The page's counter law; submit each newly reached stable identity once, replaying saved identities only on migration. */
export function createPineFacts(rows: AchievementCounterRows, ports: AchievementCounterPorts): PineFacts & { replay: () => void } {
  return createAchievementCounters(rows,ports);
}

/** The native predicate includes the older moss-tinted fallback coat as well as the declared variant. */
export function isPineThrall(actor: { variant?: string; label?: string }): boolean {
  return actor.variant === 'thrall' || actor.label === 'Thrall';
}
