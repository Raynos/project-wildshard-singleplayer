import { expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { createCueRouter } from '../../../src/engine/audio/cueRouting';
import { parseAudioRouting } from '../../../src/game/shardfile/audioRouting';

it('keeps option references, conditional actions, declared defaults and synchronous voice order', () => {
  const hit = vi.fn(() => undefined), death = vi.fn(() => undefined), point = new Vector3(1, 2, 3);
  const routes = parseAudioRouting([{ id: 'cue.hit', when: [{ op: 'present', field: 'point' }], actions: [{ voice: 'impact', defaults: { strength: 1 } },
    { voice: 'vocal', when: [{ op: 'equals', field: 'killed', value: true }, { op: 'in', field: 'kind', values: ['boar', 'crab'] }], defaults: { gain: 1.3 } }] }]);
  const cue = createCueRouter(routes, { voices: new Map([['impact', hit], ['vocal', death]]) });
  expect(cue('cue.hit', { point, kind: 'crab', killed: true, strength: 0 })).toBe(true);
  expect(hit).toHaveBeenCalledExactlyOnceWith({ point, kind: 'crab', killed: true, strength: 0 });
  expect(death).toHaveBeenCalledExactlyOnceWith({ point, kind: 'crab', killed: true, strength: 0, gain: 1.3 });
  expect(hit.mock.invocationCallOrder[0]).toBeLessThan(death.mock.invocationCallOrder[0] ?? Infinity);
  expect(cue('cue.hit', { point, kind: 'unknown', killed: true })).toBe(true); expect(death).toHaveBeenCalledTimes(1);
  expect(cue('cue.hit', {})).toBe(false); expect(cue('cue.unknown', { point })).toBe(false);
});
it('schedules the declared echo only after successful primary playback, preserving failure and silent consumption', () => {
  const shot = vi.fn(() => false), echo = vi.fn(() => true), later = vi.fn<(run: () => void, seconds: number) => void>();
  const cue = createCueRouter(parseAudioRouting([{ id: 'cue.fire', actions: [{ voice: 'shot' }, { voice: 'echo', delay: 0.42, defaults: { gain: 0.55 } }] },
    { id: 'cue.reload', actions: [] }]), { voices: new Map([['shot', shot], ['echo', echo]]), later });
  expect(cue('cue.fire', {})).toBe(false); expect(later).not.toHaveBeenCalled();
  shot.mockReturnValue(true); expect(cue('cue.fire', {})).toBe(true);
  const scheduled = later.mock.calls[0]; if (scheduled === undefined) throw new Error('Missing echo');
  expect(scheduled[1]).toBe(0.42); expect(echo).not.toHaveBeenCalled(); scheduled[0](); expect(echo).toHaveBeenCalledExactlyOnceWith({ gain: 0.55 });
  expect(cue('cue.reload', {})).toBe(true);
});
it('admits every dependency before dispatch and refuses unbounded or executable author routing', () => {
  const route = parseAudioRouting([{ id: 'cue.fire', actions: [{ voice: 'missing' }] }]);
  expect(() => createCueRouter(route, { voices: new Map() })).toThrow('Unknown catalogue');
  const delayed = parseAudioRouting([{ id: 'cue.fire', actions: [{ voice: 'shot', delay: 0 }] }]);
  expect(() => createCueRouter(delayed, { voices: new Map([['shot', () => true]]) })).toThrow('scheduler');
  expect(() => parseAudioRouting([{ id: 'cue.fire', actions: [{ voice: 'shot', delay: 61 }] }])).toThrow();
  expect(() => parseAudioRouting([{ id: 'cue.fire', actions: [{ voice: () => undefined }] }])).toThrow();
});
