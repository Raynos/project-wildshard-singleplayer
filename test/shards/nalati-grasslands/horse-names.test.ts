// src/shards/nalati-grasslands/ride/horseNames.ts — NALATI-FINISH B1 (N13): the name you give a horse at the hitching rail, cleaned and saved.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanHorseName, horseKey, saveHorseName, savedHorseName, HORSE_NAME_MAX } from '../../../src/shards/nalati-grasslands/ride/horseNames';

describe('cleanHorseName', () => {
  it('trims, folds spaces and capitalises each word', () => {
    expect(cleanHorseName('  kara   jorga ')).toBe('Kara Jorga');
    expect(cleanHorseName('tulpar')).toBe('Tulpar');
  });
  it('keeps letters of any script, digits and \' - . — drops the rest', () => {
    expect(cleanHorseName('ақ<b>боз</b>!')).toBe('Ақbбозb');
    expect(cleanHorseName("o'neil-2.0 🐎")).toBe("O'neil-2.0");
  });
  it('is at most HORSE_NAME_MAX characters, and empty when nothing is left', () => {
    expect(cleanHorseName('a'.repeat(40)).length).toBe(HORSE_NAME_MAX);
    expect(cleanHorseName('   !!! ')).toBe('');
  });
});

describe('saved names', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it('round-trips per horse (its registered name + kind + variant: the track horse is not the camp bay), and survives no storage', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } });
    let records: Record<string, string> = {};
    const names = { read: () => ({ ...records }), write: (value: Record<string, string>) => { records = { ...value }; } };
    const bay = horseKey({ kind: 'horse', variant: 'camp-bay' }, 'Camp horse'), black = horseKey({ kind: 'horse', variant: 'camp-black' }, 'Camp horse');
    const track = horseKey({ kind: 'horse', variant: 'camp-bay' }, 'Track horse');
    expect(bay).toBe('Camp horse|horse:camp-bay');
    expect(savedHorseName(bay, names)).toBeNull();
    saveHorseName(bay, 'Kara Jorga', names);
    expect(savedHorseName(bay, names)).toBe('Kara Jorga');
    expect(savedHorseName(black, names)).toBeNull();
    expect(savedHorseName(track, names)).toBeNull();
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    expect(savedHorseName(bay, names)).toBe('Kara Jorga');
    expect(() => { saveHorseName(bay, 'X', names); }).not.toThrow();
  });
});
