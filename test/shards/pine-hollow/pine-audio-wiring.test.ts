import { createPineAudio } from '../../../src/shards/pine-hollow/audio/files';
import { createDriftwoodAudio } from '../../../src/shards/driftwood-isle/audio/files';
// The audio-wiring lane (PINE-HOLLOW-REMASTER A-rows): Pine Hollow's own music + SFX ride on its loading bar only (E44 —
// Driftwood's list is unchanged), and the layout's zones become ambience spots.
import { describe, expect, it } from 'vitest';
import { audioFiles, manifestFiles } from '../../../src/engine/boot/audioFiles';
import { MUSIC_MANIFESTS, SFX_MANIFESTS } from '../../../src/game/boot/audio.generated';
import { pineZoneSpots } from '../../../src/shards/pine-hollow/audio/wiring';

describe('the loading bar\'s audio per shard', () => {
  it('Driftwood lists its own SFX, no Pine Hollow file, and every base slot', async () => {
    const d = (await createDriftwoodAudio()).files();
    expect(d.sfx.some((file) => file.startsWith('/assets/sfx/driftwood-isle/'))).toBe(true);
    expect([...d.music, ...d.sfx].some((p) => p.includes('pine-hollow'))).toBe(false);
    expect(d.music.some((p) => p.includes('/island-'))).toBe(true);
  });
  it('Pine Hollow adds its selected-style music and its whole SFX set, and drops the island slot', async () => {
    const p = (await createPineAudio()).files(), d = (await createDriftwoodAudio()).files();
    expect('pine-hollow-piano' in MUSIC_MANIFESTS && 'pine-hollow' in SFX_MANIFESTS).toBe(true); // src/engine/boot/audio.generated.ts is current
    expect(p.music.some((f) => f.startsWith('/assets/music/pine-hollow-piano/'))).toBe(true);
    expect(p.music.some((f) => f.startsWith('/assets/music/pine-hollow-folk/'))).toBe(false); // the selected style only (piano, the default)
    expect(p.music.some((f) => f.includes('/island-'))).toBe(false);
    const own = p.sfx.filter((f) => f.startsWith('/assets/sfx/pine-hollow/'));
    expect(own.some((f) => f.includes('/bed-hollow-'))).toBe(true);
    expect(own.some((f) => f.includes('/oneshots-'))).toBe(true); // the one-shots + barks: one sprite (test/shards/pine-hollow/pine-sfx-sprite.test.ts)
    // The own sets carry their own sounds; shared files need no per-shard family exclusion table.
    const steppe = manifestFiles(SFX_MANIFESTS['nalati-grasslands']);
    const drift = new Set(manifestFiles(SFX_MANIFESTS['driftwood-isle']).map((file) => `/assets/sfx/driftwood-isle/${file}`));
    expect(steppe).toHaveLength(83);
    for (const file of steppe) { expect(p.sfx).not.toContain(`/assets/sfx/nalati-grasslands/${file}`); expect(d.sfx).not.toContain(`/assets/sfx/best/${file}`); }
    expect(drift.size).toBeGreaterThan(10);
    for (const f of drift) expect(d.sfx).toContain(f); // Driftwood keeps every one of its own
    for (const f of d.sfx) { if (drift.has(f)) expect(p.sfx).not.toContain(f); else expect(p.sfx).toContain(f); }
    for (const f of audioFiles().sfx) expect(f).not.toContain('/driftwood-isle/');
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
