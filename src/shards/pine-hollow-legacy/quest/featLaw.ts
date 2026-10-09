import { PINE_FEATS } from '../feats';
import { LANTERN_FLAGS, QUEST_DONE } from './wardensHollow';
import { RESIN_FLAG, TOKEN_FLAG, SECRET_FLAGS } from './table';

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
  if (PINE_FEATS.length > 19 || PINE_FEATS.some(feat => feat.count > 30)) throw new Error('Pine feat roster exceeds its bounded presentation adapter');
  const rows = PINE_FEATS.map(feat => ({ feat, fact: `pine.feat.${feat.id}`,
    entities: Array.from({ length: feat.count }, (_, n) => `${feat.id}:${String(n + 1)}`) }));
  const witness = (index: number, first: number, total: number): void => {
    const row = rows[index]; if (row === undefined) return;
    for (let n = 0; n < 30; n++) {
      const entity = row.entities[n]; if (n >= first && n < total && entity !== undefined) ports.emit(row.fact, entity);
    }
  };
  const outcome = (kind: 'kill' | 'event', name: string, variant?: string, total?: number): void => {
    const current = ports.read();
    for (let i = 0; i < 19; i++) {
      const row = rows[i]; if (row === undefined) break;
      const matches = kind === 'kill' ? row.feat.kind === name && (row.feat.variant === undefined || row.feat.variant === variant) : row.feat.event === name;
      if (!matches) continue;
      const before = current[row.feat.id] ?? 0, after = Math.min(row.feat.count, total === undefined ? before + 1 : Math.max(before, total));
      if (before === after) continue;
      current[row.feat.id] = after; ports.write(current); witness(i, before, after);
    }
  };
  return { kill: (kind, variant) => { outcome('kill', kind, variant); }, event: (event, total) => { outcome('event', event, undefined, total); },
    replay: () => { const saved = ports.read(); for (let i = 0; i < 19; i++) {
      const row = rows[i]; if (row === undefined) break; witness(i, 0, Math.min(row.feat.count, saved[row.feat.id] ?? 0));
    } } };
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
