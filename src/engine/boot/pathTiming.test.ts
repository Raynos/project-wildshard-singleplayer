import { expect, it } from 'vitest';
import { loadPathTimings, savePathTimings } from './pathTiming';
import { saveStorage } from '../saves/slots';
import { installSaveEnvironment, saveEnvironment } from '../saves/environment';
import type { SaveStorage } from '../saves/store';

it('persists path calibration through the real defined record without overwriting legacy timings', () => {
  const previous = saveEnvironment(), data = new Map<string, string>();
  let denied = false;
  const storage: SaveStorage = { get length() { return data.size; }, key: index => [...data.keys()][index] ?? null,
    getItem: key => data.get(key) ?? null, setItem: (key, value) => { if (denied) throw new Error('Storage denied'); data.set(key, value); },
    removeItem: key => { data.delete(key); } };
  installSaveEnvironment({ storage: () => storage, persistent: () => false, persist: () => Promise.resolve(false) });
  const saved = saveStorage('device'), before = saved.getItem('boot.times');
  const key = { tier: 'phone', path: 'shardfile', identity: 'calibration-fixture' } as const;
  try {
    saved.setItem('boot.times:legacy-fixture', JSON.stringify({ world: 777 }));
    savePathTimings(key, { loadout: 40, gameplay: 200 }, { loadout: 160, gameplay: 190 });
    expect(loadPathTimings(key)).toEqual({ loadout: 100, gameplay: 195 });
    // The history reached the actual storage port, rather than a swallowed
    // undefined-slot error or an in-process-only timing cache.
    expect([...data.values()].some(raw => raw.includes('calibration-fixture'))).toBe(true);
    savePathTimings(key, { loadout: 60, gameplay: 210 });
    expect(loadPathTimings(key)).toEqual({ loadout: 80, gameplay: 202.5 });
    for (const other of [{ ...key, identity: 'other-fixture' }, { ...key, path: 'grid' }, { ...key, tier: 'desktop' as const }]) {
      expect(loadPathTimings(other)).toEqual({});
    }
    expect(saved.getItem('boot.times:legacy-fixture')).toBe(JSON.stringify({ world: 777 }));
    const persisted = [...data.values()];
    denied = true;
    expect(() => savePathTimings(key, { loadout: 120, gameplay: 217.5 })).not.toThrow();
    expect(loadPathTimings(key)).toEqual({ loadout: 100, gameplay: 210 });
    expect([...data.values()]).toEqual(persisted);
  } finally {
    denied = false;
    if (before === null) saved.removeItem('boot.times'); else saved.setItem('boot.times', before);
    installSaveEnvironment(previous);
  }
});
