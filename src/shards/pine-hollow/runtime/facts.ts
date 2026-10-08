import * as v from 'valibot';
import { bindRuntimeLedger, bindRuntimeState, type RuntimeFacts } from '@wildshard/game/shardfile/hybridRows';
import type { ShardContext } from '@wildshard/game/shard/context';
import type { Progress } from '@wildshard/game/Progress';
import { progressSave } from '@wildshard/game/saves';
import { PINE_FEATS } from '../feats';
import source from '../shard.config';

const countsSchema = v.record(v.string(), v.pipe(v.number(), v.finite(), v.integer(), v.minValue(0)));
/** Gameplay submits bounded outcomes; the platform state and ledger own counters and earned titles. */
export interface PineFacts {
  readonly kill: (kind: string, variant?: string) => void;
  readonly event: (event: string, total?: number) => void;
}
/** C26 imports current counters once, retaining Progress solely as the unchanged journal/title presentation. */
export function bindPineFacts(ctx: Pick<ShardContext, 'app' | 'scope'>, progress: Pick<Progress, 'bindLedger' | 'refreshLedger'>, instance: string, facts: RuntimeFacts = bindRuntimeLedger(ctx, source, instance)): PineFacts {
  if (PINE_FEATS.length > 19 || PINE_FEATS.some((feat) => feat.count > 30)) throw new Error('Pine feat roster exceeds its bounded presentation adapter');
  const state = bindRuntimeState(ctx, source, 'pine.feat-counts', () => JSON.stringify(progressSave.read(instance).counts), instance);
  const read = (): Record<string, number> => {
    const value = state.read(); if (typeof value !== 'string') throw new Error('Pine feat counters need a JSON string');
    return v.parse(countsSchema, JSON.parse(value) as unknown);
  };
  const rows = PINE_FEATS.map((feat) => ({ feat, fact: `pine.feat.${feat.id}`,
    entities: Array.from({ length: feat.count }, (_, n) => `${feat.id}:${String(n + 1)}`) }));
  const witness = (index: number, total: number): void => {
    const row = rows[index]; if (row === undefined) return;
    for (let n = 0; n < 30; n++) {
      const entity = row.entities[n]; if (n < total && entity !== undefined) facts(row.fact, entity);
    }
  };
  const saved = read();
  for (let i = 0; i < 19; i++) { const row = rows[i]; if (row === undefined) break; witness(i, Math.min(row.feat.count, saved[row.feat.id] ?? 0)); }
  const achievement = (id: string) => facts.achievement(`pine-hollow.${id}`);
  progress.bindLedger({ count: (id) => achievement(id)?.count ?? 0, earned: (id) => achievement(id)?.earned ?? false,
    checkpoint: () => { const counters = state.write(JSON.stringify(read())), grants = facts.flush(); return counters && grants; } });
  const outcome = (kind: 'kill' | 'event', name: string, variant?: string, total?: number): void => {
    const current = read();
    for (let i = 0; i < 19; i++) {
      const row = rows[i]; if (row === undefined) break;
      const matches = kind === 'kill' ? row.feat.kind === name && (row.feat.variant === undefined || row.feat.variant === variant) : row.feat.event === name;
      if (!matches) continue;
      const before = current[row.feat.id] ?? 0, after = Math.min(row.feat.count, total === undefined ? before + 1 : Math.max(before, total));
      if (before === after) continue;
      current[row.feat.id] = after; state.write(JSON.stringify(current)); witness(i, after);
    }
    progress.refreshLedger();
  };
  return { kill: (kind, variant) => { outcome('kill', kind, variant); }, event: (event, total) => { outcome('event', event, undefined, total); } };
}
