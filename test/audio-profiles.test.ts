import { expect, it } from 'vitest';
import { parseAudioData } from '../src/game/shardfile/audio';
import { selectScoreSlots } from '../src/engine/audio/scoreSelection';
import { emptyShardfile } from '../src/sdk/author';
import { emptyShardfileSource } from '../src/game/shardfile/loader';

const music = { id: 'fixture.score', base: 'grass', slots: ['grass', 'night', 'boss'], bootSlots: ['title', 'grass'], synthLead: 'pluck', minFade: 0,
  source: { dir: '/assets/music/fixture/', manifestKey: 'fixture' }, sets: {}, selectMode: 'all', selection: [
    { slots: ['boss'], when: [{ field: 'boss', op: 'equals', value: 'king' }] },
    { slots: ['night'], when: [{ field: 'night', op: 'equals', value: true }] }, { slots: ['grass'], when: [] },
  ] };
const audio = () => parseAudioData({ cues: [], ambience: null, score: 'default', music,
  samples: { set: 'fixture', bed: 'grass', loopGains: { grass: 0.5 } },
  zones: { id: 'fixture.zones', smoothSeconds: 0.1, tickHz: 10, silentSeconds: 8, holdSeconds: 3, levels: { grass: 0.7 }, wet: { cave: 0.55 }, zones: [{ id: 'grass', x: 0, z: 0, inner: 4, outer: 20, gain: 1 }] },
});
it('roundtrips bounded audio profiles and preserves ordered fallback chains including repeated slots', () => {
  const data = audio(), wire = JSON.stringify(data); expect(parseAudioData(JSON.parse(wire))).toEqual(data);
  const profile = data.music; if (profile === undefined) throw new Error('Missing score');
  expect(selectScoreSlots(profile.selection, profile.selectMode, { boss: 'king', night: true })).toEqual(['boss', 'night', 'grass']);
  expect(selectScoreSlots(profile.selection, 'first', { boss: 'king', night: true })).toEqual(['boss']);
  expect(selectScoreSlots([{ slots: ['grass', 'grass'], when: [] }], 'first', {})).toEqual(['grass', 'grass']);
  expect(selectScoreSlots([{ slots: ['night'], when: [{ field: 'well', op: 'greater', value: 0.5 }] }], 'all', { well: 0.5 })).toEqual([]);
});
it('refuses unknown score slots, path traversal, nonfinite gains and unbound profiles in the minimal loader', () => {
  expect(() => parseAudioData({ ...audio(), music: { ...music, selection: [{ slots: ['missing'], when: [] }] } })).toThrow();
  expect(() => parseAudioData({ ...audio(), music: { ...music, bootSlots: ['missing'] } })).toThrow();
  expect(() => parseAudioData({ ...audio(), music: { ...music, base: 'missing' } })).toThrow();
  const zones = audio().zones; if (zones === undefined) throw new Error('Missing zones');
  expect(() => parseAudioData({ ...audio(), zones: { ...zones, zones: [{ id: 'reversed', x: 0, z: 0, inner: 20, outer: 4, gain: 1 }] } })).toThrow();
  expect(() => parseAudioData({ ...audio(), zones: { ...zones, zones: [{ id: 'hard-cut', x: 0, z: 0, inner: 4, outer: 4, gain: 1 }] } })).toThrow();
  expect(() => parseAudioData({ ...audio(), music: { ...music, source: { dir: '/assets/music/../fixture/', manifestKey: 'fixture' } } })).toThrow();
  expect(() => parseAudioData({ ...audio(), samples: { set: 'fixture', bed: 'grass', loopGains: { grass: Infinity } } })).toThrow();
  const source = emptyShardfile({ slug: 'audio-test', name: 'Audio', author: 'Fixture', revision: 1, seed: 1 });
  for (const profile of ['music', 'samples', 'zones'] as const) {
    source.audio = parseAudioData({ cues: [], ambience: null, score: 'silent', [profile]: audio()[profile] });
    expect(() => emptyShardfileSource(source)).toThrow('full shardfile loader');
  }
});

it('retains an exact authored fade width and refuses an inconsistent outer radius', () => {
  const zones = audio().zones; if (zones === undefined) throw new Error('Missing zones');
  const row = { id: 'fractional', x: 0, z: 0, inner: 17.36, outer: 47.36, fade: 30, gain: 1 };
  expect(parseAudioData({ ...audio(), zones: { ...zones, zones: [row] } }).zones?.zones[0]?.fade).toBe(30);
  expect(() => parseAudioData({ ...audio(), zones: { ...zones, zones: [{ ...row, fade: 29 }] } })).toThrow();
});
