// src/player/horseNames.ts — NALATI-FINISH B1 (N13): the name you give a horse at the hitching rail, cleaned and saved.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanHorseName, horseKey, saveHorseName, savedHorseName, HORSE_NAME_MAX } from '../src/player/horseNames';

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
  it('round-trips per horse (kind + variant), and survives no storage', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } });
    const bay = { kind: 'horse', variant: 'camp-bay' }, black = { kind: 'horse', variant: 'camp-black' };
    expect(horseKey(bay)).toBe('horse:camp-bay');
    expect(savedHorseName(bay)).toBeNull();
    saveHorseName(bay, 'Kara Jorga');
    expect(savedHorseName(bay)).toBe('Kara Jorga');
    expect(savedHorseName(black)).toBeNull();
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    expect(savedHorseName(bay)).toBeNull();
    expect(() => { saveHorseName(bay, 'X'); }).not.toThrow();
  });
});
