// Pine Hollow's one-shots + barks ship as ONE audio sprite (scripts/music/gen/sfx_sprite.py): the loading bar fetches one
// file, not 63 (228 requests on a phone cold launch against the 180 row). sfx.json `sprite: {file, gap, duration, clips}`.
import { describe, expect, it } from 'vitest';
import { audioFiles } from '../src/boot/audioFiles';
import { SFX_MANIFESTS } from '../src/boot/audio.generated';
import { PUBLIC_BYTES } from '../src/boot/bytes.generated';
import { pineShotFiles } from '../src/audio/PineHollowSfx';

const DIR = '/assets/sfx/pine-hollow/';
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const manifest = SFX_MANIFESTS['pine-hollow'];
const m = isObj(manifest) ? manifest : {};
const sprite = isObj(m['sprite']) ? m['sprite'] : {};
const clips = new Map<string, [number, number]>();
for (const [name, v] of Object.entries(isObj(sprite['clips']) ? sprite['clips'] : {})) {
  const pair: unknown[] = Array.isArray(v) ? v : [], a = pair[0], b = pair[1];
  if (typeof a === 'number' && typeof b === 'number') clips.set(name, [a, b]);
}
const oneshots = isObj(m['oneshots']) ? m['oneshots'] : {};
const familyFiles = (v: unknown): string[] => {
  const list: unknown[] = isObj(v) && Array.isArray(v['files']) ? v['files'] : [];
  return list.filter((f): f is string => typeof f === 'string');
};
const TABLE: Readonly<Record<string, number>> = PUBLIC_BYTES;

describe('Pine Hollow\'s one-shot sprite', () => {
  it('is what the bar fetches and decodes, and none of the packed files is', () => {
    expect(typeof sprite['file']).toBe('string');
    const url = `${DIR}${String(sprite['file'])}`;
    expect(url in TABLE).toBe(true); // src/boot/bytes.generated.ts is current
    const sfx = audioFiles('pine-hollow').sfx;
    expect(sfx).toContain(url);
    expect(pineShotFiles()).toEqual([url]);
    expect(clips.size).toBeGreaterThan(0);
    for (const name of clips.keys()) {
      expect(sfx).not.toContain(`${DIR}${name}`);
      expect(`${DIR}${name}` in TABLE).toBe(false);
    }
    expect(sfx.some((f) => f.startsWith(`${DIR}bed-hollow-`))).toBe(true); // the beds stay files of their own
  });
  it('has a clip for every take of every family, the barks included', () => {
    const families = Object.keys(oneshots);
    expect(families.some((f) => f.startsWith('bark-ranger-'))).toBe(true);
    for (const f of families) {
      const files = familyFiles(oneshots[f]);
      expect(files.length, f).toBeGreaterThan(0);
      for (const name of files) expect(clips.has(name), `${f}: ${name}`).toBe(true);
    }
  });
  it('lays the clips apart, inside the sprite', () => {
    const gap = typeof sprite['gap'] === 'number' ? sprite['gap'] : 0, total = typeof sprite['duration'] === 'number' ? sprite['duration'] : 0;
    expect(gap).toBeGreaterThanOrEqual(0.2);
    expect(total).toBeGreaterThan(0);
    const spans = [...clips.values()].sort((a, b) => a[0] - b[0]);
    let end = 0;
    for (const [start, dur] of spans) {
      expect(dur).toBeGreaterThan(0);
      expect(start - end).toBeGreaterThanOrEqual(gap - 1e-5); // silence before the first clip and between clips (6-decimal seconds)
      end = start + dur;
    }
    expect(end).toBeLessThanOrEqual(total);
  });
});
