import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerAchievements } from '../../../src/game/achievements';
import { NALATI_FEATS } from '../../../src/shards/nalati-grasslands/feats';
import { emptyShardfile } from '../../../src/sdk/author';
import { Scope } from '../../../src/engine/app/scope';
import { app } from '../../../src/engine/app/runtime';
import { bossesSave, elitesSave, progressSave } from '../../../src/game/saves';
import { Progress } from '../../../src/game/Progress';
import { withOwner } from '../../../src/engine/app/ownership';
import { parseShardfile } from '../../../src/game/shardfile/schema';
import { horseNamesSave, tulparSave } from '../../../src/shards/nalati-grasslands/ride/saves';
import { nalatiSkinsSave } from '../../../src/shards/nalati-grasslands/weapons/saves';
import { NALATI_STATE } from '../../../src/shards/nalati-grasslands/data/state';
import { NALATI_LEDGER } from '../../../src/shards/nalati-grasslands/data/ledger';
import { NALATI_QUEST_DATA } from '../../../src/shards/nalati-grasslands/data/quests';
import { bindNalatiPersistence } from '../../../src/shards/nalati-grasslands/runtime/persistence';
import { bindNalatiQuests } from '../../../src/shards/nalati-grasslands/runtime/quests';

let release: (() => void) | undefined;
beforeAll(() => { release = registerAchievements('nalati-grasslands', NALATI_FEATS); });
afterAll(() => { release?.(); });

const source = () => parseShardfile({ ...emptyShardfile({ slug: 'nalati-grasslands', name: 'Nalati Grasslands', author: 'Wildshard', revision: 1, seed: 0x4a1a }),
  runtime: { entry: 'runtime/index.ts', binds: ['state', 'ledger', 'quests'] },
  state: NALATI_STATE, ledger: NALATI_LEDGER, quests: NALATI_QUEST_DATA });
const slug = 'nalati-grasslands';

describe('Nalati current-save runtime-owner migration (C26)', () => {
  it('migrates current records once, persists edits, and leaves legacy slots unchanged', () => {
    horseNamesSave.write({ 'Camp horse|horse:camp-bay': 'Kara' }, slug);
    tulparSave.write('argymaq', slug);
    nalatiSkinsSave.write({ owned: ['irbis-sabre'], worn: { sabre: 'irbis-sabre' } }, slug);
    bossesSave.write({ 'golden-king': { defeated: true, rewardTaken: true, kills: 2 } }, slug);
    elitesSave.write({ aqbars: { timer: 900, discovered: true, skinTaken: true, kills: 1, retired: false } }, slug);
    progressSave.write({ counts: { wolf5: 3, wolf25: 3, tame: 1 }, earned: ['tame'], title: 'tame', playS: 40 }, slug);
    const original = { names: horseNamesSave.read(slug), bond: tulparSave.read(slug), skins: nalatiSkinsSave.read(slug),
      bosses: bossesSave.read(slug), elites: elitesSave.read(slug), progress: progressSave.read(slug) };
    const scope = new Scope('nalati.migration'), data = source();
    const state = bindNalatiPersistence({ app, scope }, data);
    expect(state.bond.read()).toBe('argymaq');
    expect(state.flags.has('tamed:argymaq')).toBe(true);
    expect(state.flags.has('dead:golden-king')).toBe(true);
    expect(state.flags.has('felled:aqbars')).toBe(true);
    expect(state.flags.has('owned:irbis-sabre')).toBe(true);
    expect(state.bosses.read(slug)['golden-king']?.rewardTaken).toBe(true);
    expect(state.elites.read(slug)['aqbars']?.timer).toBe(900);
    expect(state.horseNames.read()['Camp horse|horse:camp-bay']).toBe('Kara');
    state.horseNames.write({ 'Camp horse|horse:camp-bay': 'Jorga' });
    state.cosmetics.write({ owned: ['irbis-sabre', 'sky-wolf-bow'], worn: { bow: 'sky-wolf-bow' } });
    state.kill('wolf');
    scope.dispose();
    const reloadScope = new Scope('nalati.reload');
    try {
      const reloaded = bindNalatiPersistence({ app, scope: reloadScope }, data);
      expect(reloaded.horseNames.read()['Camp horse|horse:camp-bay']).toBe('Jorga');
      expect(reloaded.cosmetics.read().worn).toEqual({ bow: 'sky-wolf-bow' });
      expect(reloaded.facts.achievement('wolf5')?.count).toBe(4);
      expect(reloaded.facts.achievement('wolf25')?.count).toBe(4);
      const progress = withOwner(reloadScope, () => new Progress(slug));
      reloaded.bindProgress(progress);
      expect(progress.title?.id).toBe('tame'); expect(progress.playS).toBe(40);
      expect(progress.count('wolf5')).toBe(4);
      progress.recordKill('wolf'); expect(progress.count('wolf5')).toBe(4);
      expect(progress.checkpoint()).toBe(true);
      expect({ names: horseNamesSave.read(slug), bond: tulparSave.read(slug), skins: nalatiSkinsSave.read(slug),
        bosses: bossesSave.read(slug), elites: elitesSave.read(slug), progress: progressSave.read(slug) }).toEqual(original);
      expect(() => state.horseNames.read()).toThrow('disposed');
    } finally { reloadScope.dispose(); }
  });

  it('keeps placement records independent and binds the same chapter graph without regranting', () => {
    const data = source(), scope = new Scope('nalati.copies');
    try {
      const a = bindNalatiPersistence({ app, scope }, data, 'nalati-copy-a');
      const b = bindNalatiPersistence({ app, scope }, data, 'nalati-copy-b');
      a.horseNames.write({ camp: 'Ak' }); b.horseNames.write({ camp: 'Kara' });
      expect(a.horseNames.read()).toEqual({ camp: 'Ak' }); expect(b.horseNames.read()).toEqual({ camp: 'Kara' });
      const line = bindNalatiQuests({ app, scope }, a.flags, a.facts, data);
      expect(line.chapters.map((quest) => quest.def.id)).toEqual(['tulpar', 'golden-king', 'father-wind']);
      for (const flag of ['talked:elder', 'tamed:horse', 'won:kokpar', 'told:tulpar']) a.flags.set(flag);
      expect(line.chapters[0]?.isComplete).toBe(true);
      const before = a.facts.achievement('tulpar'); bindNalatiQuests({ app, scope }, a.flags, a.facts, data);
      expect(a.facts.achievement('tulpar')).toEqual(before);
      expect(b.flags.has('quest:tulpar')).toBe(false);
      expect(() => a.horseNames.write({ camp: 'a'.repeat(4096) })).toThrow();
      expect(a.horseNames.read()).toEqual({ camp: 'Ak' });
    } finally { scope.dispose(); }
  });
});
