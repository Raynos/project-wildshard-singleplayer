import { createAchievementCounters } from '@wildshard/game/achievements';
import { PINE_FEAT_COUNTERS } from '../data/questInventory';

/** Gameplay submits the same bounded outcomes in the page and renderer-free host. */
export interface PineFacts {
  readonly kill: (kind: string, variant?: string) => void;
  readonly event: (event: string, total?: number) => void;
  readonly syncFlags:ReturnType<typeof createAchievementCounters>['syncFlags'];
}
/** Storage and emission belong to the caller; this policy owns matching, saturation and stable fact identities. */
export interface PineFeatPorts {
  readonly read: () => Record<string, number>;
  readonly write: (counts: Record<string, number>) => void;
  readonly emit: (fact: string, entity: string) => void;
}
/** The page's counter law; submit each newly reached stable identity once, replaying saved identities only on migration. */
export function createPineFacts(ports: PineFeatPorts): PineFacts & { replay: () => void } {
  return createAchievementCounters(PINE_FEAT_COUNTERS,ports);
}

/** The native predicate includes the older moss-tinted fallback coat as well as the declared variant. */
export function isPineThrall(actor: { variant?: string; label?: string }): boolean {
  return actor.variant === 'thrall' || actor.label === 'Thrall';
}
/** Only an actual creature death calls this: ordinary and elite kills overlap, and a thrall also advances Weed Control. */
export function recordPineFeatKill(facts: Pick<PineFacts,'kill'|'event'>, actor: { kind: string; variant?: string; label?: string }): void {
  facts.kill(actor.kind, actor.variant);
  if (isPineThrall(actor)) facts.event('thrall');
}
