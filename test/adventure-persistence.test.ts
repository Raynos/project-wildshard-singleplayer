import { expect, test } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { app } from '../src/engine/app/runtime';
import { bossesSave, elitesSave, progressSave } from '../src/game/saves';
import { bindAdventurePersistence } from '../src/game/quest/persistence';
import source from '../src/shards/nalati-grasslands/shard.config';
import rows from '../src/shards/nalati-grasslands/data/persistence.generated.json' with { type: 'json' };

test('Nalati adopts old saves, replays stable feat identities and reloads only declared records', () => {
  const slug = source.identity.slug, instance = 'declared-nalati-old-save';
  const scope = new Scope(instance), next = new Scope(`${instance}-reload`);
  const previous = { bosses: bossesSave.read(slug), elites: elitesSave.read(slug), progress: progressSave.read(slug) };
  const bosses = { 'golden-king': { defeated: true, rewardTaken: true, kills: 2 } };
  const elites = { aqbars: { timer: 0, discovered: true, skinTaken: true, kills: 1, retired: false } };
  let reads = 0;
  const legacy = { names: () => { reads++; return { 'Camp horse|horse:camp-bay': 'Kara Jorga' }; },
    cosmetics: () => ({ owned: ['irbis-sabre'], worn: { sabre: 'irbis-sabre' } }), bond: () => '1' };
  bossesSave.write(bosses, slug); elitesSave.write(elites, slug);
  progressSave.write({ ...previous.progress, counts: { wolf5: 3, wolf25: 3, tulpar: 1 } }, slug);
  try {
    const saved = bindAdventurePersistence({ app, scope }, source, rows, instance, legacy);
    expect(saved.bosses.read()).toEqual(bosses); expect(saved.elites.read()).toEqual(elites);
    expect(saved.names.read()).toEqual({ 'Camp horse|horse:camp-bay': 'Kara Jorga' });
    expect(saved.flags.all).toEqual(expect.arrayContaining(['dead:golden-king', 'felled:aqbars', 'owned:irbis-sabre', 'tamed:horse']));
    expect(saved.flags.has('tamed:argymaq')).toBe(false); expect(reads).toBe(1);
    expect(saved.facts.achievement('wolf5')?.count).toBe(3);
    expect(saved.facts.achievement('tulpar')?.count ?? 0).toBe(0);
    saved.kill('wolf', 'alpha'); saved.feat('tame', 1); saved.feat('tame', 1);
    expect(saved.facts.achievement('wolf5')?.count).toBe(4);
    expect(saved.facts.achievement('wolf25')?.count).toBe(4);
    expect(saved.facts.achievement('alpha')?.count).toBe(1);
    expect(saved.facts.achievement('tame')?.count).toBe(1);
    // The same historical receipt must be a duplicate, never a fifth kill.
    saved.facts('nalati.feat.wolf5', 'feat.wolf5.4');
    expect(saved.facts.achievement('wolf5')?.count).toBe(4);
    saved.bond.write('argymaq'); expect(saved.flags.has('tamed:argymaq')).toBe(true);
    saved.names.write({ tulpar: 'Argymaq' });
    expect(() => saved.elites.write({ ...elites, aqbars: { ...elites.aqbars, kills: -1 } })).toThrow();
    expect(() => saved.names.read('another-cell')).toThrow('another instance');
    scope.dispose();
    bossesSave.write({}, slug); elitesSave.write({}, slug);
    progressSave.write({ ...previous.progress, counts: {} }, slug);
    const resumed = bindAdventurePersistence({ app, scope: next }, source, rows, instance, legacy);
    expect(resumed.bosses.read()).toEqual(bosses); expect(resumed.elites.read()).toEqual(elites);
    expect(resumed.names.read()).toEqual({ tulpar: 'Argymaq' });
    expect(resumed.bond.read()).toBe('argymaq'); expect(reads).toBe(1);
    expect(resumed.facts.achievement('wolf5')?.count).toBe(4);
    resumed.kill('wolf'); expect(resumed.facts.achievement('wolf5')?.count).toBe(5);
    expect(() => saved.bosses.read()).toThrow('disposed');
  } finally {
    scope.dispose(); next.dispose();
    bossesSave.write(previous.bosses, slug); elitesSave.write(previous.elites, slug); progressSave.write(previous.progress, slug);
  }
});
