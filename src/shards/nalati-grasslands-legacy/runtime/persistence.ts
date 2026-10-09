import * as v from 'valibot';
import { Flags } from '@wildshard/engine/world/interact/flags';
import type { ShardContext } from '@wildshard/game/shard/context';
import type { Shardfile } from '@wildshard/sdk/shardfile';
import { bindRuntimeLedger, bindRuntimeState, type RuntimeFacts } from '@wildshard/game/shardfile/hybridRows';
import type { BossPersistence } from '@wildshard/game/Boss';
import type { ElitePersistence } from '@wildshard/game/Elite';
import type { Progress } from '@wildshard/game/Progress';
import { bossesSave, elitesSave, progressSave } from '@wildshard/game/saves';
import { horseNamesSave, tulparSave } from '../ride/saves';
import { nalatiSkinsSave } from '../weapons/saves';
import { NALATI_FEATS } from '../feats';
import { NALATI_QUEST_FEATS } from '../data/ledger';

const natural = v.pipe(v.number(), v.finite(), v.minValue(0));
const bosses = v.record(v.string(), v.object({ defeated: v.boolean(), rewardTaken: v.boolean(), kills: natural }));
const elites = v.record(v.string(), v.object({ timer: natural, discovered: v.boolean(), skinTaken: v.boolean(), kills: natural, retired: v.boolean() }));
const cosmetics = v.object({ owned: v.array(v.string()), worn: v.record(v.string(), v.string()) });
const names = v.record(v.string(), v.string());
const counts = v.record(v.string(), v.pipe(natural, v.integer()));

/** Typed JSON record over one bounded platform state field. A refused save never silently advances progression. */
export interface NalatiRecord<T> { read: () => T; write: (value: T) => void }
function record<S extends v.GenericSchema>(ctx: Pick<ShardContext, 'app' | 'scope'>, source: Shardfile, instance: string,
  key: string, schema: S, legacy: () => v.InferOutput<S>): NalatiRecord<v.InferOutput<S>> {
  const field = bindRuntimeState(ctx, source, key, () => JSON.stringify(legacy()), instance);
  return { read: () => {
    const text = field.read();
    if (typeof text !== 'string') throw new Error(`Nalati JSON state must be a string: ${key}`);
    const value: unknown = JSON.parse(text);
    return v.parse(schema, value);
  }, write: (value) => {
    const text = JSON.stringify(v.parse(schema, value));
    if (!field.write(text)) throw new Error(`Nalati state could not be saved: ${key}`);
  } };
}

/** One authoritative continuation per placement, with legacy reads only at durable field initialization (C26). */
export interface NalatiPersistence {
  readonly flags: Flags;
  readonly facts: RuntimeFacts;
  readonly bosses: BossPersistence;
  readonly elites: ElitePersistence;
  readonly cosmetics: NalatiRecord<v.InferOutput<typeof cosmetics>>;
  readonly horseNames: NalatiRecord<Record<string, string>>;
  readonly bond: { read: () => string | null; write: (value: string) => void };
  readonly feat: (event: string, total?: number) => void;
  readonly kill: (kind: string, variant?: string) => void;
  readonly bindProgress: (progress: Pick<Progress, 'bindLedger' | 'refreshLedger'>) => void;
}

/** Bind Nalati's durable records and replay pre-ledger achievement counts without paying them twice. */
export function bindNalatiPersistence(ctx: Pick<ShardContext, 'app' | 'scope'>, source: Shardfile, instance = source.identity.slug): NalatiPersistence {
  const slug = source.identity.slug, flags = new Flags(instance), emit = bindRuntimeLedger(ctx, source, instance);
  let progress: Pick<Progress, 'bindLedger' | 'refreshLedger'> | undefined;
  const facts: RuntimeFacts = Object.assign((name: string, entity: string) => {
    const receipt = emit(name, entity); progress?.refreshLedger(); return receipt;
  }, { flush: emit.flush, achievement: emit.achievement });
  const horseNames = record(ctx, source, instance, 'nalati.horse-names', names, () => horseNamesSave.read(slug));
  const skinState = record(ctx, source, instance, 'nalati.cosmetics', cosmetics, () => nalatiSkinsSave.read(slug));
  const bossState = record(ctx, source, instance, 'nalati.bosses', bosses, () => bossesSave.read(slug));
  const eliteState = record(ctx, source, instance, 'nalati.elites', elites, () => elitesSave.read(slug));
  const featState = record(ctx, source, instance, 'nalati.feat-counts', counts, () => progressSave.read(slug).counts);
  const bondState = bindRuntimeState(ctx, source, 'nalati.bond', () => tulparSave.read(slug) ?? '', instance);
  const bond = { read: (): string | null => {
    const value = bondState.read(); if (typeof value !== 'string') throw new Error('Nalati bond must be a string'); return value === '' ? null : value;
  }, write: (value: string): void => {
    if (!bondState.write(value)) throw new Error('Nalati bond could not be saved');
    flags.set('tamed:horse'); if (value === 'argymaq') flags.set('tamed:argymaq');
  } };
  const witness = (id: string, total: number): void => {
    const chapter = Object.entries(NALATI_QUEST_FEATS).find(([, feat]) => feat === id)?.[0];
    if (chapter !== undefined) return; // The bound chapter emits its own completion witness.
    for (let n = 1; n <= Math.min(total, 25); n++) facts(`nalati.feat.${id}`, `feat.${id}.${String(n)}`);
  };
  for (let i = 0; i < Math.min(NALATI_FEATS.length, 17); i++) {
    const feat = NALATI_FEATS[i]; if (feat !== undefined) witness(feat.id, Math.min(feat.count, featState.read()[feat.id] ?? 0));
  }
  const recordFeatOutcome = (matches: (feat: (typeof NALATI_FEATS)[number]) => boolean, total?: number): void => {
    const saved = featState.read();
    for (let i = 0; i < Math.min(NALATI_FEATS.length, 17); i++) {
      const feat = NALATI_FEATS[i]; if (feat === undefined || !matches(feat)) continue;
      const before = saved[feat.id] ?? 0, after = Math.min(feat.count, total === undefined ? before + 1 : Math.max(before, total));
      if (after === before) continue;
      saved[feat.id] = after; featState.write(saved); witness(feat.id, after);
    }
  };
  const syncBosses = (value: v.InferOutput<typeof bosses>): void => { Object.entries(value).forEach(([id, row]) => { if (row.defeated) flags.set(`dead:${id}`); }); };
  const syncElites = (value: v.InferOutput<typeof elites>): void => { Object.entries(value).forEach(([id, row]) => { if (row.kills > 0 || row.retired) flags.set(`felled:${id}`); }); };
  const syncSkins = (value: v.InferOutput<typeof cosmetics>): void => { value.owned.forEach((id) => { flags.set(`owned:${id}`); }); };
  syncBosses(bossState.read()); syncElites(eliteState.read()); syncSkins(skinState.read());
  if (bond.read() !== null) { flags.set('tamed:horse'); if (bond.read() === 'argymaq') flags.set('tamed:argymaq'); }
  return { flags, facts, horseNames, bond, bindProgress: (view) => {
    progress = view;
    view.bindLedger({ count: (id) => facts.achievement(id)?.count ?? 0, earned: (id) => facts.achievement(id)?.earned ?? false,
      checkpoint: () => {
        const state = bondState.write(bondState.read());
        const ledger = facts.flush();
        return state && ledger;
      } });
  },
    bosses: { read: () => bossState.read(), write: (value) => { bossState.write(value); syncBosses(value); } },
    elites: { read: () => eliteState.read(), write: (value) => { eliteState.write(value); syncElites(value); } },
    cosmetics: { read: () => skinState.read(), write: (value) => { skinState.write(value); syncSkins(value); } },
    feat: (event, total) => { recordFeatOutcome((feat) => feat.event === event, total); },
    kill: (kind, variant) => { recordFeatOutcome((feat) => feat.kind === kind && (feat.variant === undefined || feat.variant === variant)); },
  };
}
