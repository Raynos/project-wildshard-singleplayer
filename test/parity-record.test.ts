import { describe, expect, it } from 'vitest';
import { acceptFields, aggregate } from '../scripts/parity/record.mjs';
import { object, type RecordValue } from '../scripts/parity/value.mjs';
import type { Page } from 'playwright';

// No poses in these records, so aggregation must not use the browser page.
const page = {} as Page;
describe('parity record and accept preserve field shape', () => {
  it('aggregates dotted IDs and phases without constructing nested objects', async () => {
    const runs: RecordValue[] = [97, 93, 95].map((count) => ({
      boot: { systems: { 'fixed.pre': ['physics'] } },
      walk: { sounds: { event: { 'nd.step.stone': count, 'audio.startSampleBed': 1 } } },
    }));
    const result = await aggregate(page, runs, { sha: 'head', browser: 'test' });
    expect(object(object(object(result['walk'])['sounds'])['event'])).toEqual({ 'nd.step.stone': 95, 'audio.startSampleBed': 1 });
    expect(object(result['spread'])['walk.sounds.event.nd.step.stone']).toBe(4);
    expect(object(object(result['boot'])['systems'])).toEqual({ 'fixed.pre': ['physics'] });
  });
  it('replaces an accepted multiset and deletes removed and corrupt keys while retaining other fields', () => {
    const before: RecordValue = { walk: { stuck: 0, sounds: { event: { 'nd.step.stone': 97, old: 2, nd: { step: { stone: 93 } } }, ambient: ['keep'] } },
      spread: { 'walk.sounds.event.old': 2, 'walk.sounds.event.nd.step.stone': 4, 'walk.stuck': 0 }, selfMin: {} };
    const now: RecordValue = { walk: { stuck: 1, sounds: { event: { 'nd.step.stone': 95 }, ambient: [] } },
      spread: { 'walk.sounds.event.nd.step.stone': 2 }, selfMin: {}, sha: 'head', recorded: 'today' };
    const result = acceptFields(before, now, ['walk.sounds.event']);
    expect(result['walk']).toEqual({ stuck: 0, sounds: { event: { 'nd.step.stone': 95 }, ambient: ['keep'] } });
    expect(result['spread']).toEqual({ 'walk.sounds.event.nd.step.stone': 2, 'walk.stuck': 0 });
    expect(before['walk']).toEqual({ stuck: 0, sounds: { event: { 'nd.step.stone': 97, old: 2, nd: { step: { stone: 93 } } }, ambient: ['keep'] } });
  });
  it('replaces wildcard leaves including absent dotted IDs without broadening acceptance', () => {
    const before: RecordValue = { sounds: { 'nd.step.stone': 97, 'nd.step.old': 1, nd: { step: { old: 2 } }, other: 4 } };
    const now: RecordValue = { sounds: { 'nd.step.stone': 93, other: 9 } };
    expect(acceptFields(before, now, ['sounds.nd.step.*'])['sounds']).toEqual({ 'nd.step.stone': 93, other: 4 });
  });
});
