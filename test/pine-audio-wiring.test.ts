// The audio-wiring lane (PINE-HOLLOW-REMASTER A-rows): Pine Hollow's own music + SFX ride on its loading bar only (E44 —
// Driftwood's list is unchanged), and the layout's zones become ambience spots.
import { describe, expect, it } from 'vitest';
import { audioFiles } from '../src/boot/audioFiles';
import { MUSIC_MANIFESTS, SFX_MANIFESTS } from '../src/boot/audio.generated';
import { pineZoneSpots } from '../src/pinehollow/audioWiring';

describe('the loading bar\'s audio per shard', () => {
  it('Driftwood (and no slug) lists no Pine Hollow file, and every base slot', () => {
    const d = audioFiles('driftwood-isle');
    expect(d).toEqual(audioFiles());
    expect([...d.music, ...d.sfx].some((p) => p.includes('pine-hollow'))).toBe(false);
    expect(d.music.some((p) => p.includes('/island-'))).toBe(true);
  });
  it('Pine Hollow adds its selected-style music and its whole SFX set, and drops the island slot', () => {
    const p = audioFiles('pine-hollow'), d = audioFiles('driftwood-isle');
    expect('pine-hollow-piano' in MUSIC_MANIFESTS && 'pine-hollow' in SFX_MANIFESTS).toBe(true); // src/boot/audio.generated.ts is current
    expect(p.music.some((f) => f.startsWith('/assets/music/pine-hollow-piano/'))).toBe(true);
    expect(p.music.some((f) => f.startsWith('/assets/music/pine-hollow-folk/'))).toBe(false); // the selected style only (piano, the default)
    expect(p.music.some((f) => f.includes('/island-'))).toBe(false);
    const own = p.sfx.filter((f) => f.startsWith('/assets/sfx/pine-hollow/'));
    expect(own.some((f) => f.includes('/bed-hollow-'))).toBe(true);
    expect(own.some((f) => f.includes('/oneshots-'))).toBe(true); // the one-shots + barks: one sprite (test/pine-sfx-sprite.test.ts)
    for (const f of d.sfx) expect(p.sfx).toContain(f); // every base set still comes along
  });
});

describe('Pine Hollow\'s ambience spots', () => {
  it('places every zone, the mill only while its wheel turns', () => {
    let wheel = 0;
    const spots = pineZoneSpots(() => wheel);
    for (const z of ['creek', 'waterfall', 'mill', 'ridge', 'oldgrowth', 'cave'] as const) expect(spots.some((s) => s.zone === z)).toBe(true);
    const mill = spots.find((s) => s.zone === 'mill');
    expect(mill?.gain?.()).toBe(0);
    wheel = 0.55;
    expect(mill?.gain?.()).toBe(1);
    for (const s of spots) { expect(Number.isFinite(s.x) && Number.isFinite(s.z)).toBe(true); expect(Math.abs(s.x) <= 260 && Math.abs(s.z) <= 260).toBe(true); }
  });
});
