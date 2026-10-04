import { resourceScope } from '@wildshard/engine/app/resources';
import { progressSave, saveSlug } from './saves';
import { updateSummary } from './summary';
import { findShard } from './shard/registry';
import type { ShardSlug } from './shard/slugs.generated';
/**
 * Progress — per-shard achievement progress, earned titles and the title you wear. Persisted in
 * localStorage ('ws.progress.v1', keyed by chunk id); the in-memory copy is the truth for the session
 * (iOS private mode throws on write).
 *
 *   const progress = new Progress(getActiveChunk().id);
 *   progress.recordKill(animal.kind, animal.variant);     // main.ts, on every kill → fires onEarned for each new unlock
 *   progress.onEarned = (def) => hud.toast(…);
 *   progress.rows                                          // [{ def, count, earned }] for the Achievements tab
 *   progress.title / progress.wear(def.id)                 // the worn title (the first earned one is worn automatically)
 */
import { achievementsFor, type AchievementDef } from './achievements';

interface ShardProgress { counts: Record<string, number>; earned: string[]; title: string | null; playS: number }
const PLAY_SAVE_S = 15;

/** what a shard's feats code records into (Driftwood's quest/Feats.ts, Nalati's adventure): the game layer's type, so two shards share it without importing each other (E357 F6) */
export interface ProgressSink { recordEvent: (event: string, total?: number) => void }

export interface ProgressRow { def: AchievementDef; count: number; earned: boolean; active: boolean }

export class Progress {
  private readonly scope = resourceScope().child('Progress');
  readonly defs: AchievementDef[];
  private shard: ShardProgress;
  onEarned?: (def: AchievementDef) => void;
  onChange?: () => void;

  constructor(readonly chunkId: string) {
    this.defs = achievementsFor(chunkId);
    this.shard = progressSave.read(saveSlug(chunkId));
    this.updateSummary();
    const flush = (): void => { if (this.unsaved > 0) { this.unsaved = 0; this.save(); } };
    if (typeof document !== 'undefined') { // not in the node tests
      this.scope.listen(window, 'pagehide', flush);
      this.scope.listen(document, 'visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    }
  }

  private unsaved = 0;
  /** seconds played on this shard (E132): main.ts counts the frames in the world, not the title or the menus */
  get playS(): number { return this.shard.playS; }
  addPlay(dt: number): void {
    if (!(dt > 0)) return;
    const s = Math.min(dt, 0.25);
    this.shard.playS = this.playS + s;
    this.unsaved += s;
    if (this.unsaved >= PLAY_SAVE_S) { this.unsaved = 0; this.save(); }
  }

  /** Plugin registrations refine the total after level.kit; legacy shards retain their table count. */
  setFeatTotal(total: number): void { this.featTotal = total; this.updateSummary(); }
  private featTotal: number | undefined;
  private updateSummary(): void {
    const slug = saveSlug(this.chunkId);
    if (findShard(slug) !== undefined) updateSummary(slug as ShardSlug, this.shard, this.featTotal ?? this.defs.length);
  }
  private save() { progressSave.write(this.shard, saveSlug(this.chunkId)); this.updateSummary(); }

  /** one kill of (kind, variant) — bumps every matching achievement, unlocks the ones that reach their count */
  recordKill(kind: string, variant?: string): void {
    let changed = false;
    for (const d of this.defs) {
      if (d.kind !== kind || (d.variant && d.variant !== variant)) continue;
      const n = Math.min(d.count, (this.shard.counts[d.id] ?? 0) + 1);
      if (n === this.shard.counts[d.id]) continue;
      this.shard.counts[d.id] = n; changed = true;
      if (n >= d.count && !this.shard.earned.includes(d.id)) {
        this.shard.earned.push(d.id);
        if (this.shard.title === null || this.shard.title === '') this.shard.title = d.id; // the first title is worn straight away
        this.onEarned?.(d);
      }
    }
    if (changed) { this.save(); this.onChange?.(); }
  }

  /**
   * An adventure event (achievements with `event`): bumps each matching achievement by one, or — with `total` —
   * raises it to that total (idempotent: a collectible count read back from the quest flags after a reload).
   */
  recordEvent(event: string, total?: number): void {
    let changed = false;
    for (const d of this.defs) {
      if (d.event === undefined || d.event !== event) continue;
      const was = this.shard.counts[d.id] ?? 0;
      const n = Math.min(d.count, total !== undefined ? Math.max(was, total) : was + 1);
      if (n === was) continue;
      this.shard.counts[d.id] = n; changed = true;
      if (n >= d.count && !this.shard.earned.includes(d.id)) {
        this.shard.earned.push(d.id);
        if (this.shard.title === null || this.shard.title === '') this.shard.title = d.id;
        this.onEarned?.(d);
      }
    }
    if (changed) { this.save(); this.onChange?.(); }
  }

  count(id: string): number { return this.shard.counts[id] ?? 0; }
  earned(id: string): boolean { return this.shard.earned.includes(id); }
  get earnedCount(): number { return this.shard.earned.length; }
  /** the worn title's def, if any */
  get title(): AchievementDef | null { return this.defs.find((d) => d.id === this.shard.title && this.earned(d.id)) ?? null; }
  /** wear an earned title (ignored when not earned) */
  wear(id: string): void {
    if (!this.earned(id) || this.shard.title === id) return;
    this.shard.title = id; this.save(); this.onChange?.();
  }
  get rows(): ProgressRow[] {
    const t = this.title;
    return this.defs.map((def) => ({ def, count: this.count(def.id), earned: this.earned(def.id), active: t?.id === def.id }));
  }
}
