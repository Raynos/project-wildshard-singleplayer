import { createAchievementCounters } from '@wildshard/game/achievements';
import { PINE_FEAT_COUNTERS } from '../data/questInventory';
import { LANTERN_FLAGS, QUEST_DONE } from '../data/wardensHollow';
import { RESIN_FLAG, TOKEN_FLAG, SECRET_FLAGS } from '../data/interactions';

/** Gameplay submits the same bounded outcomes in the page and renderer-free host. */
export interface PineFacts {
  readonly kill: (kind: string, variant?: string) => void;
  readonly event: (event: string, total?: number) => void;
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

/** The page's flag-driven achievement events, including earlier saves whose counters have not yet caught up. */
export function syncPineFlagFeats(flags: { has: (flag: string) => boolean; count: (prefix: string) => number }, facts: PineFacts): void {
  facts.event('lantern', LANTERN_FLAGS.filter(flag => flags.has(flag)).length);
  facts.event('resin', flags.count(RESIN_FLAG));
  facts.event('token', flags.count(TOKEN_FLAG));
  facts.event('secret', SECRET_FLAGS.filter(flag => flags.has(flag)).length);
  if (flags.has('used:ph-zip')) facts.event('zipline', 1);
  if (flags.has('errand:done')) facts.event('miller', 1);
  if (flags.has('dead:king')) facts.event('king', 1);
  if (flags.has(QUEST_DONE)) facts.event('quest', 1);
}

/** The native predicate includes the older moss-tinted fallback coat as well as the declared variant. */
export function isPineThrall(actor: { variant?: string; label?: string }): boolean {
  return actor.variant === 'thrall' || actor.label === 'Thrall';
}
/** Only an actual creature death calls this: ordinary and elite kills overlap, and a thrall also advances Weed Control. */
export function recordPineFeatKill(facts: PineFacts, actor: { kind: string; variant?: string; label?: string }): void {
  facts.kill(actor.kind, actor.variant);
  if (isPineThrall(actor)) facts.event('thrall');
}
