import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { withOwner } from '../src/engine/app/ownership';
import { SaveStore } from '../src/engine/saves/store';
import { Progress, type ProgressLedger } from '../src/game/Progress';
import { registerAchievements, type AchievementDef } from '../src/game/achievements';
import { PINE_FEATS } from '../src/shards/pine-hollow/feats';
import { Ledger } from '../src/game/ledger';
import { progressSave } from '../src/game/saves';
import { readSummary } from '../src/game/summary';
import { parseLedgerRules } from '../src/game/shardfile/ledger';
import { MemoryStorage } from './setup';

let release: (() => void) | undefined;
beforeAll(() => { release = registerAchievements('pine-hollow', PINE_FEATS); });
afterAll(() => { release?.(); });

const slug = 'pine-hollow', origin = { kind: 'engine' as const, source: 'encounter.outcome' };
function fixture() {
  const local = new MemoryStorage(), store = new SaveStore({ local, session: null });
  const rules = parseLedgerRules([{ fact: 'deer', origin, rewards: [{ kind: 'achievement', id: 'deer5', title: 'Ledger title is not presentation', threshold: 5 }] },
    { fact: 'ghost', origin, rewards: [{ kind: 'achievement', id: 'ghost', title: 'Another ledger label', threshold: 1 }] }]);
  const ledger = new Ledger(store, [{ id: 'pine-copy', shard: slug }], [{ shard: slug, revision: 1, rules }], []);
  const achievement = (id: string) => ledger.state().achievements[JSON.stringify([slug, id])];
  const projection: ProgressLedger = { count: (id) => achievement(id)?.count ?? 0, earned: (id) => achievement(id)?.earned ?? false,
    checkpoint: () => ledger.flush() };
  const grant = (name: string, tick: number): void => { ledger.record({ instance: 'pine-copy', shard: slug, revision: 1, entity: `animal.${tick}`, tick, ordinal: 0, name, origin }); };
  return { ledger, projection, grant, local };
}

it('projects ledger counts and earned state through the existing feat metadata, without replaying a legacy grant', () => {
  const scope = new Scope('Progress.ledger');
  try { withOwner(scope, () => {
    const f = fixture(); f.grant('ghost', 1); f.grant('deer', 2);
    const progress = new Progress(slug), earned = vi.fn<(def: AchievementDef) => void>(), changed = vi.fn<() => void>();
    progress.onEarned = earned; progress.onChange = changed;
    const write = vi.spyOn(progressSave, 'write'), before = f.ledger.state();
    progress.bindLedger(f.projection);
    expect(progress.rows.find((row) => row.def.id === 'ghost')).toMatchObject({ count: 1, earned: true, active: true,
      def: { name: 'Ghost Story', goal: 'Kill the Ghost stag', count: 1, title: 'Ghostbuster' } });
    expect(progress.count('deer5')).toBe(1); expect(progress.earnedCount).toBe(1);
    expect(readSummary().shards[slug]?.earned).toBe(1);
    progress.recordKill('deer', 'ghost'); progress.recordEvent('glass', 5); progress.refreshLedger();
    expect(f.ledger.state()).toEqual(before); expect(write).not.toHaveBeenCalled();
    expect(earned).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
  }); } finally { scope.dispose(); }
});

it('notifies new ledger feats once and keeps title selection as metadata without writing counters on kills', () => {
  const scope = new Scope('Progress.ledger.events');
  try { withOwner(scope, () => {
    const f = fixture(), progress = new Progress(slug), earned = vi.fn<(def: AchievementDef) => void>(), changed = vi.fn<() => void>();
    progress.bindLedger(f.projection); progress.onEarned = earned; progress.onChange = changed;
    const write = vi.spyOn(progressSave, 'write');
    f.grant('ghost', 1); progress.refreshLedger(); progress.refreshLedger();
    expect(earned).toHaveBeenCalledTimes(1); expect(changed).toHaveBeenCalledTimes(1);
    expect(progress.title?.id).toBe('ghost');
    for (let tick = 2; tick <= 6; tick++) { f.grant('deer', tick); progress.refreshLedger(); }
    expect(progress.count('deer5')).toBe(5); expect(progress.earnedCount).toBe(2);
    expect(earned).toHaveBeenCalledTimes(2); expect(progress.title?.id).toBe('ghost');
    progress.recordKill('deer'); progress.recordEvent('glass');
    expect(write).toHaveBeenCalledTimes(1); // The first automatic title is durable immediately, with no legacy count change.
    expect(progressSave.read(slug)).toMatchObject({ counts: {}, earned: [], title: 'ghost' });
    progress.wear('deer5');
    expect(progress.title?.id).toBe('deer5'); expect(write).toHaveBeenCalledTimes(2);
    expect(progressSave.read(slug)).toMatchObject({ counts: {}, earned: [], title: 'deer5' });
    const reload = new Progress(slug); reload.bindLedger(f.projection);
    expect(reload.title?.id).toBe('deer5'); expect(reload.count('deer5')).toBe(5);
  }); } finally { scope.dispose(); }
});

it('preserves the first-earned title after a hard reload before any play-time checkpoint', () => {
  const scope = new Scope('Progress.ledger.hard-reload');
  try { withOwner(scope, () => {
    const f = fixture(), progress = new Progress(slug);
    progress.bindLedger(f.projection);
    f.grant('ghost', 1); progress.refreshLedger();
    for (let tick = 2; tick <= 6; tick++) f.grant('deer', tick);
    progress.refreshLedger();
    expect(progress.playS).toBe(0); expect(progress.title?.id).toBe('ghost');
    const reload = new Progress(slug); reload.bindLedger(f.projection);
    expect(reload.title?.id).toBe('ghost');
    expect(progressSave.read(slug)).toMatchObject({ counts: {}, earned: [], title: 'ghost' });
  }); } finally { scope.dispose(); }
});

it('uses authoritative zero and false values instead of stale legacy counters', () => {
  const scope = new Scope('Progress.ledger.migration');
  try { withOwner(scope, () => {
    const progress = new Progress(slug); progress.recordKill('deer', 'ghost');
    expect(progress.earned('ghost')).toBe(true);
    const saved = progressSave.read(slug), f = fixture(), write = vi.spyOn(progressSave, 'write');
    progress.bindLedger(f.projection);
    expect(progress.count('deer5')).toBe(0); expect(progress.earned('ghost')).toBe(false);
    expect(progress.title).toBeNull(); expect(progress.earnedCount).toBe(0);
    expect(progressSave.read(slug)).toEqual(saved); expect(write).not.toHaveBeenCalled();
  }); } finally { scope.dispose(); }
});

it('keeps a worn legacy title and play time while ignoring legacy kill-counter ingress', () => {
  const scope = new Scope('Progress.ledger.title');
  try { withOwner(scope, () => {
    const progress = new Progress(slug), f = fixture();
    progress.recordKill('deer', 'ghost');
    for (let i = 0; i < 4; i++) progress.recordKill('deer');
    progress.wear('deer5'); progress.addPlay(0.25); progress.checkpoint();
    f.grant('ghost', 1);
    for (let tick = 2; tick <= 6; tick++) f.grant('deer', tick);
    const reload = new Progress(slug); reload.bindLedger(f.projection);
    expect(reload.title?.id).toBe('deer5'); expect(reload.playS).toBe(0.25);
    const saved = progressSave.read(slug), ledger = f.ledger.state(), write = vi.spyOn(progressSave, 'write');
    reload.recordKill('deer', 'ghost'); reload.recordEvent('glass', 100);
    expect(progressSave.read(slug)).toEqual(saved); expect(f.ledger.state()).toEqual(ledger);
    expect(write).not.toHaveBeenCalled();
  }); } finally { scope.dispose(); }
});

it('refuses and retries a checkpoint when the real ledger profile write fails, without granting twice', () => {
  const scope = new Scope('Progress.ledger.checkpoint');
  try { withOwner(scope, () => {
    const f = fixture(), progress = new Progress(slug);
    progress.bindLedger(f.projection); progress.addPlay(0.25);
    const write = vi.spyOn(f.local, 'setItem').mockImplementation(() => { throw new Error('Profile quota'); });
    f.grant('ghost', 1); progress.refreshLedger();
    expect(progress.earned('ghost')).toBe(true);
    expect(progress.checkpoint()).toBe(false); expect(progress.checkpoint()).toBe(false);
    expect(f.local.getItem('wildshard.save.v2.profile')).toBeNull();
    write.mockRestore();
    expect(progress.checkpoint()).toBe(true);
    expect(f.local.getItem('wildshard.save.v2.profile')).toContain('platform.ledger');
    expect(Object.keys(f.ledger.state().facts)).toHaveLength(1);
    expect(progress.count('ghost')).toBe(1); expect(progress.playS).toBe(0.25);
    const metadata = vi.spyOn(progressSave, 'write').mockReturnValue(false);
    expect(progress.checkpoint()).toBe(false);
    metadata.mockRestore(); expect(progress.checkpoint()).toBe(true);
  }); } finally { scope.dispose(); }
});
