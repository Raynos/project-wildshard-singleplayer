// Nalati's score (src/audio/SteppeScore.ts, NALATI-MERGE A2): the slot the scene asks for, down the fallback chain to one the
// build ships; decoded on demand (the wanted + the playing slot resident, nothing else); a slot that fails is skipped.
import { describe, expect, test, vi } from 'vitest';

const slot = (n: string) => ({ calm: `${n}-calm.m4a`, tension: `${n}-tension.m4a`, bpm: 100, beatsPerBar: 4, loopStart: 1, loopEnd: 20, duration: 22 });
vi.mock('../src/boot/audio.generated', () => ({
  MUSIC_MANIFESTS: { nalati: { style: 'nalati', slots: { 'steppe-grass': slot('g'), 'steppe-sky': slot('s'), 'steppe-night': slot('n'), 'steppe-king': slot('k') }, stings: { death: 'd.m4a' } } },
  SFX_MANIFESTS: {},
}));
vi.mock('../src/boot/bytes.generated', () => ({
  PUBLIC_BYTES: Object.fromEntries(['g', 's', 'n', 'k'].flatMap((n) => [`/assets/music/nalati/${n}-calm.m4a`, `/assets/music/nalati/${n}-tension.m4a`]).concat(['/assets/music/nalati/d.m4a']).map((u) => [u, 1000])),
}));

const { SteppeScore, steppeFiles, steppeBootFiles } = await import('../src/audio/SteppeScore');

const buf = (duration: number): AudioBuffer => ({ duration, length: duration * 48000, sampleRate: 48000, numberOfChannels: 2 } as AudioBuffer);
const tick = () => new Promise((resolve) => { setTimeout(resolve, 0); });

describe('SteppeScore', () => {
  test('the files: every slot + sting on the steppe; the bar decodes the grass theme + stings', () => {
    expect(steppeFiles()).toHaveLength(9);
    expect(steppeBootFiles()).toEqual(['/assets/music/nalati/g-calm.m4a', '/assets/music/nalati/g-tension.m4a', '/assets/music/nalati/d.m4a']);
  });

  test('the fallback chain: king > storm > night > the zone > grass', () => {
    const s = new SteppeScore(() => Promise.resolve(new ArrayBuffer(8)), () => Promise.resolve(buf(22)), () => undefined);
    expect(s.target()).toBe('steppe-grass');
    s.scene.zone = 'sky'; expect(s.target()).toBe('steppe-sky');
    s.scene.zone = 'snow'; expect(s.target()).toBe('steppe-grass'); // no snow theme in this build
    s.scene.storm = true; expect(s.target()).toBe('steppe-grass'); // no storm cue either
    s.scene.night = true; expect(s.target()).toBe('steppe-night');
    s.scene.boss = 'king'; expect(s.target()).toBe('steppe-king');
  });

  test('decoded on demand; only the wanted + the playing slot stay resident', async () => {
    let ready = 0;
    const s = new SteppeScore(() => Promise.resolve(new ArrayBuffer(8)), () => Promise.resolve(buf(22)), () => { ready++; });
    expect(s.want(undefined)).toBeUndefined();
    expect(s.pending).toBe(true);
    await tick(); await tick();
    expect(ready).toBe(1);
    expect(s.want(undefined)?.slot).toBe('steppe-grass');
    s.scene.zone = 'sky';
    expect(s.want('steppe-grass')).toBeUndefined();
    await tick(); await tick();
    expect(s.want('steppe-grass')?.slot).toBe('steppe-sky');
    expect(s.resident.sort()).toEqual(['steppe-grass', 'steppe-sky']);
    s.scene.night = true;
    s.want('steppe-sky');
    expect(s.resident).toEqual(['steppe-sky']); // grass is neither playing nor wanted: dropped
  });

  test('a slot whose loop runs past its file fails once and the chain skips it', async () => {
    const s = new SteppeScore(() => Promise.resolve(new ArrayBuffer(8)), () => Promise.resolve(buf(10)), () => undefined); // 10 s < loopEnd 20
    s.scene.zone = 'sky';
    expect(s.want(undefined)).toBeUndefined();
    await tick(); await tick();
    expect(s.target()).toBe('steppe-grass');
  });
});
